import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, X } from "lucide-react";
import Skeleton from "../../../components/dashboard/Skeleton";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import {
  approveAdminReschedule,
  assignAppointmentTherapist,
  cancelAdminAppointment,
  completeAdminAppointment,
  confirmAdminAppointment,
  declineAdminReschedule,
  getAdminAppointments,
  getAvailableTherapists,
  noShowAdminAppointment,
  rescheduleAdminAppointment,
} from "../../../services/api/adminAppointmentApi";
import { getToastError, showError, showPromise } from "../../../utils/toast";
import FilterBar from "../../../components/staff/FilterBar";
import DateRangeControl from "../../../components/staff/DateRangeControl";

const tabs = [
  ["pending", "Pending"],
  ["upcoming", "Confirmed"],
  ["previous", "History"],
];
const statusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
const statusClass = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  completed: "status-completed",
  cancelled: "status-cancelled",
  no_show: "status-no-show",
};
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Date to be set";
const appointmentDate = (appointment) =>
  appointment.scheduledStart ||
  `${appointment.requestedDate}T${appointment.requestedTime}:00+08:00`;

function Modal({ title, children, onClose, danger = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector("button, input, select, textarea")?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const focusable = [
        ...ref.current.querySelectorAll("button, input, select, textarea"),
      ].filter((item) => !item.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  return (
    <div
      className="staff-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={`staff-modal appointment-modal ${danger ? "appointment-modal-danger" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-modal-title"
      >
        <div className="staff-modal-header">
          <h2 id="appointment-modal-title">{title}</h2>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function AppointmentFacts({ appointment }) {
  return (
    <div className="appointment-facts">
      <div>
        <span>Patient</span>
        <strong>
          {appointment.patient?.firstname} {appointment.patient?.lastname}
        </strong>
      </div>
      <div>
        <span>Service</span>
        <strong>
          {appointment.serviceSnapshot?.name || appointment.service?.name} ·{" "}
          {appointment.serviceSnapshot?.duration ||
            appointment.service?.duration}{" "}
          min · ₱
          {Number(
            appointment.serviceSnapshot?.fee ?? appointment.service?.fee ?? 0,
          ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </strong>
      </div>
      <div>
        <span>Date and time</span>
        <strong>{formatDate(appointmentDate(appointment))}</strong>
      </div>
      <div>
        <span>Therapist</span>
        <strong>
          {appointment.therapist
            ? `${appointment.therapist.firstname} ${appointment.therapist.lastname}`
            : "Unassigned"}
        </strong>
      </div>
    </div>
  );
}

function AdminAppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    tab: searchParams.get("tab") || "pending",
    status: searchParams.get("status") || "all",
    search: searchParams.get("search") || "",
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
    page: 1,
  });
  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [therapists, setTherapists] = useState([]);

  function load() {
    getAdminAppointments(filters)
      .then((response) => {
        setAppointments(response.data.appointments);
        setPagination(response.data.pagination);
      })
      .catch((error) =>
        showError(getToastError(error, "Unable to load appointments.")),
      )
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    getAdminAppointments(filters)
      .then((response) => {
        setAppointments(response.data.appointments);
        setPagination(response.data.pagination);
      })
      .catch((error) =>
        showError(getToastError(error, "Unable to load appointments.")),
      )
      .finally(() => setLoading(false));
    const interval = window.setInterval(() => {
      getAdminAppointments(filters).then((response) => {
        setAppointments(response.data.appointments);
        setPagination(response.data.pagination);
      });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [filters]);
  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next, { replace: true });
  };
  function finishAction(request, success) {
    showPromise(request, {
      loading: "Updating appointment...",
      success,
      error: "Unable to update this appointment.",
    });
    request
      .then(() => {
        setModal(null);
        load();
      })
      .catch(() => undefined);
  }
  function openAssign(appointment) {
    setModal({ type: "assign", appointment });
    setTherapists([]);
    getAvailableTherapists(appointment._id)
      .then((response) => setTherapists(response.data.therapists))
      .catch((error) =>
        showError(
          getToastError(error, "Unable to check therapist availability."),
        ),
      );
  }

  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow="Scheduling"
          title="Appointments"
          description="Move each patient request through the clinic schedule."
        />
        <FilterBar
          tabs={tabs.map(([key, label]) => ({ key, label }))}
          activeTab={filters.tab}
          onTabChange={(value) => setFilter("tab", value)}
          search={filters.search}
          onSearch={(value) => setFilter("search", value)}
          searchPlaceholder="Search patient or therapist"
        >
          <select
            aria-label="Filter appointment status"
            value={filters.status}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <DateRangeControl
            from={filters.from}
            to={filters.to}
            onChange={(range) => {
              setFilter("from", range.from);
              setFilter("to", range.to);
            }}
          />
        </FilterBar>
        {loading ? (
          <div className="staff-loading-block">
            <Skeleton variant="heading" width="45%" height="22px" />
            <Skeleton variant="text" width="100%" height="46px" />
            <Skeleton variant="text" width="100%" height="46px" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="staff-empty-state">
            <strong>No appointments found</strong>
            <span>There are no appointments matching this view.</span>
          </div>
        ) : (
          <div className="appointment-table-wrap">
            <table className="appointment-admin-table">
              <thead>
                <tr>
                  <th>Date and time</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Therapist</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment._id}
                    appointment={appointment}
                    onAssign={openAssign}
                    onAction={(type) => setModal({ type, appointment })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="user-pagination">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() =>
              setFilters({ ...filters, page: pagination.page - 1 })
            }
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.pages || 1}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() =>
              setFilters({ ...filters, page: pagination.page + 1 })
            }
          >
            Next
          </button>
        </div>
      </section>
      {modal?.type === "assign" && (
        <Modal title="Assign therapist" onClose={() => setModal(null)}>
          <AppointmentFacts appointment={modal.appointment} />
          <form
            className="appointment-action-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              finishAction(
                assignAppointmentTherapist(modal.appointment._id, data),
                "Therapist assigned.",
              );
            }}
          >
            <label>
              Available therapist
              <select name="therapistId" required disabled={!therapists.length}>
                <option value="">
                  {therapists.length
                    ? "Select a therapist"
                    : "No available therapist for this date/time"}
                </option>
                {therapists.map((therapist) => (
                  <option value={therapist._id} key={therapist._id}>
                    {therapist.firstname} {therapist.lastname}
                  </option>
                ))}
              </select>
            </label>
            {!therapists.length && (
              <p className="appointment-inline-note">
                No available therapist for this date/time. Propose an
                alternative time before trying again.
              </p>
            )}
            <label>
              Note (optional)
              <textarea name="note" rows="3" />
            </label>
            <div className="profile-edit-actions">
              <button
                className="profile-cancel-button"
                type="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="staff-section-primary"
                type="submit"
                disabled={!therapists.length}
              >
                Assign therapist
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.type === "confirm" && (
        <Modal title="Confirm appointment" onClose={() => setModal(null)}>
          <AppointmentFacts appointment={modal.appointment} />
          <p className="appointment-modal-copy">
            This will reserve the therapist's time and notify the patient.
          </p>
          <div className="profile-edit-actions">
            <button
              className="profile-cancel-button"
              type="button"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              className="staff-section-primary"
              type="button"
              onClick={() =>
                finishAction(
                  confirmAdminAppointment(modal.appointment._id),
                  "Appointment confirmed.",
                )
              }
            >
              Confirm appointment
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "reschedule" && (
        <Modal title="Reschedule appointment" onClose={() => setModal(null)}>
          <AppointmentFacts appointment={modal.appointment} />
          <form
            className="appointment-action-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              finishAction(
                rescheduleAdminAppointment(modal.appointment._id, data),
                "Appointment rescheduled.",
              );
            }}
          >
            <label>
              New date
              <input name="newDate" type="date" required />
            </label>
            <label>
              New time
              <input name="newTime" type="time" required />
            </label>
            <label>
              Reason (optional)
              <textarea name="reason" rows="3" />
            </label>
            <div className="profile-edit-actions">
              <button
                className="profile-cancel-button"
                type="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="staff-section-primary" type="submit">
                Save new time
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.type === "review" && (
        <Modal title="Review reschedule request" onClose={() => setModal(null)}>
          <AppointmentFacts appointment={modal.appointment} />
          <div className="appointment-request-callout">
            <strong>
              {modal.appointment.rescheduleRequest.requestedBy} requested
            </strong>
            <span>
              {modal.appointment.rescheduleRequest.proposedDate} at{" "}
              {modal.appointment.rescheduleRequest.proposedTime}
            </span>
            <p>
              {modal.appointment.rescheduleRequest.reason ||
                "No reason provided."}
            </p>
          </div>
          <div className="profile-edit-actions">
            <button
              className="profile-cancel-button"
              type="button"
              onClick={() =>
                finishAction(
                  declineAdminReschedule(modal.appointment._id, {
                    reason: "The proposed time is not available.",
                  }),
                  "Reschedule request declined.",
                )
              }
            >
              Decline
            </button>
            <button
              className="staff-section-primary"
              type="button"
              onClick={() =>
                finishAction(
                  approveAdminReschedule(modal.appointment._id),
                  "Reschedule request approved.",
                )
              }
            >
              Approve
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "requestReview" && (
        <Modal
          title="Review appointment request"
          onClose={() => setModal(null)}
        >
          <AppointmentFacts appointment={modal.appointment} />
          <div className="appointment-request-callout">
            <strong>Patient contact</strong>
            <span>
              {modal.appointment.patient?.email} ·{" "}
              {modal.appointment.patient?.phone || "Phone not added"}
            </span>
            <p>
              {modal.appointment.notes ||
                "No notes or special requirements were added."}
            </p>
          </div>
          <p className="appointment-modal-copy">
            Review the request, then assign an available therapist from this
            panel. The service duration and fee shown here are the booking
            snapshot.
          </p>
          <div className="profile-edit-actions">
            <button
              className="profile-cancel-button"
              type="button"
              onClick={() => setModal(null)}
            >
              Close
            </button>
            <button
              className="staff-section-primary"
              type="button"
              onClick={() => openAssign(modal.appointment)}
            >
              Assign therapist
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "cancel" && (
        <Modal title="Cancel appointment" danger onClose={() => setModal(null)}>
          <AppointmentFacts appointment={modal.appointment} />
          <form
            className="appointment-action-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              finishAction(
                cancelAdminAppointment(modal.appointment._id, {
                  reason:
                    data.reason === "Other"
                      ? data.notes
                      : `${data.reason}${data.notes ? `: ${data.notes}` : ""}`,
                }),
                "Appointment cancelled.",
              );
            }}
          >
            <label>
              Reason
              <select name="reason" required>
                <option value="">Choose a reason</option>
                <option>Patient requested</option>
                <option>Therapist unavailable</option>
                <option>Clinic closure</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Notes
              <textarea
                name="notes"
                rows="3"
                required
                placeholder="Add context for the record"
              />
            </label>
            <div className="profile-edit-actions">
              <button
                className="profile-cancel-button"
                type="button"
                onClick={() => setModal(null)}
              >
                Keep appointment
              </button>
              <button className="staff-danger-button" type="submit">
                Cancel appointment
              </button>
            </div>
          </form>
        </Modal>
      )}
      {(modal?.type === "complete" || modal?.type === "noShow") && (
        <Modal
          title={
            modal.type === "complete"
              ? "Mark appointment completed"
              : "Mark appointment no-show"
          }
          onClose={() => setModal(null)}
        >
          <AppointmentFacts appointment={modal.appointment} />
          <p className="appointment-modal-copy">
            {modal.type === "complete"
              ? "No session record exists yet. The therapist will need to add session details separately."
              : "This records that the patient did not attend the scheduled appointment."}
          </p>
          <div className="profile-edit-actions">
            <button
              className="profile-cancel-button"
              type="button"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              className={
                modal.type === "noShow"
                  ? "staff-danger-button"
                  : "staff-section-primary"
              }
              type="button"
              onClick={() =>
                finishAction(
                  modal.type === "complete"
                    ? completeAdminAppointment(modal.appointment._id)
                    : noShowAdminAppointment(modal.appointment._id),
                  modal.type === "complete"
                    ? "Appointment completed."
                    : "Appointment marked no-show.",
                )
              }
            >
              {modal.type === "complete" ? "Mark completed" : "Mark no-show"}
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "view" && (
        <Modal title="Appointment details" onClose={() => setModal(null)}>
          <AppointmentFacts appointment={modal.appointment} />
          <p className="appointment-modal-copy">
            Status: {statusLabels[modal.appointment.status]}. Created{" "}
            {new Date(modal.appointment.createdAt).toLocaleDateString()}.
          </p>
        </Modal>
      )}
    </main>
  );
}

function AppointmentRow({ appointment, onAssign, onAction }) {
  const history = ["completed", "cancelled", "no_show"].includes(
    appointment.status,
  );
  const pastConfirmed =
    appointment.status === "confirmed" &&
    appointment.scheduledEnd &&
    new Date(appointment.scheduledEnd) <= new Date();
  return (
    <tr>
      <td data-label="Date and time">
        {formatDate(appointmentDate(appointment))}
      </td>
      <td data-label="Patient">
        <strong>
          {appointment.patient?.firstname} {appointment.patient?.lastname}
        </strong>
      </td>
      <td data-label="Service">{appointment.service?.name}</td>
      <td data-label="Therapist">
        {appointment.therapist
          ? `${appointment.therapist.firstname} ${appointment.therapist.lastname}`
          : "Unassigned"}
      </td>
      <td data-label="Status">
        <span className={`status-badge ${statusClass[appointment.status]}`}>
          {statusLabels[appointment.status]}
        </span>
        {appointment.rescheduleRequest?.status === "requested" && (
          <span className="appointment-request-badge">
            Reschedule requested
          </span>
        )}
      </td>
      <td className="appointment-admin-actions">
        {history ? (
          <button
            type="button"
            title="View details"
            onClick={() => onAction("view")}
          >
            <Eye size={15} />
          </button>
        ) : appointment.status === "pending" && !appointment.therapist ? (
          <button
            className="staff-section-primary"
            type="button"
            onClick={() => onAction("requestReview")}
          >
            Review request
          </button>
        ) : appointment.status === "pending" ? (
          <>
            <button
              className="staff-section-primary"
              type="button"
              onClick={() => onAction("confirm")}
            >
              Confirm
            </button>
            <button type="button" onClick={() => onAssign(appointment)}>
              Reassign
            </button>
            <button type="button" onClick={() => onAction("cancel")}>
              Cancel
            </button>
          </>
        ) : pastConfirmed ? (
          <>
            <button
              className="staff-section-primary"
              type="button"
              onClick={() => onAction("complete")}
            >
              Mark completed
            </button>
            <button type="button" onClick={() => onAction("noShow")}>
              No-show
            </button>
          </>
        ) : (
          <>
            {appointment.rescheduleRequest?.status === "requested" && (
              <button type="button" onClick={() => onAction("review")}>
                Review request
              </button>
            )}
            <button type="button" onClick={() => onAction("reschedule")}>
              Reschedule
            </button>
            <button type="button" onClick={() => onAction("cancel")}>
              Cancel
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export default AdminAppointmentsPage;
