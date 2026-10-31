import { useEffect, useRef, useState } from "react";
import { Eye, Search, X } from "lucide-react";
import Skeleton from "../../../components/dashboard/Skeleton";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import {
  getSecretaryAppointment,
  getSecretarySchedule,
  recordSecretaryPayment,
} from "../../../services/api/secretaryApi";
import { getToastError, showError, showPromise } from "../../../utils/toast";

const statusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
const statusClasses = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  completed: "status-completed",
  cancelled: "status-cancelled",
  no_show: "status-no-show",
};
const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const dateTime = (appointment) =>
  appointment.scheduledStart ||
  `${appointment.requestedDate}T${appointment.requestedTime}:00+08:00`;

function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector("button, input, select, textarea")?.focus();
    function handleKey(event) {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const items = [
        ...ref.current.querySelectorAll("button, input, select, textarea"),
      ].filter((item) => !item.disabled);
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      }
      if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return (
    <div
      className="staff-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="staff-modal secretary-modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="secretary-modal-title"
      >
        <div className="staff-modal-header">
          <h2 id="secretary-modal-title">{title}</h2>
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

function PaymentForm({ appointment, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const request = recordSecretaryPayment(
      appointment._id,
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    showPromise(request, {
      loading: "Recording payment...",
      success: "Payment recorded.",
      error: "Unable to record payment.",
    });
    try {
      const response = await request;
      onSaved(response.data.appointment);
      onClose();
    } catch {
      return;
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="secretary-action-form" onSubmit={submit}>
      <label>
        Amount
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={
            appointment.payment?.amount || appointment.service?.fee || 0
          }
          required
        />
      </label>
      <label>
        Payment method
        <select name="method" defaultValue="cash">
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Reference number (if applicable)
        <input name="referenceNumber" />
      </label>
      <label>
        Notes
        <textarea name="notes" rows="3" />
      </label>
      <div className="profile-edit-actions">
        <button
          className="profile-cancel-button"
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="staff-section-primary"
          type="submit"
          disabled={saving}
        >
          Record payment
        </button>
      </div>
    </form>
  );
}

function SchedulePage() {
  const [filters, setFilters] = useState({
    status: "confirmed",
    date: "",
    therapist: "",
    search: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, search: searchInput })),
      300,
    );
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    getSecretarySchedule(filters)
      .then((response) => {
        setAppointments(response.data.appointments);
        setTherapists(response.data.therapists);
      })
      .catch((error) =>
        showError(getToastError(error, "Unable to load the schedule.")),
      )
      .finally(() => setLoading(false));
  }, [filters]);
  function refresh() {
    getSecretarySchedule(filters)
      .then((response) => setAppointments(response.data.appointments))
      .catch(() => undefined);
  }
  function updateAppointment(updated) {
    setAppointments((current) =>
      current.map((item) => (item._id === updated._id ? updated : item)),
    );
  }
  async function openDetails(appointment) {
    setModal({ type: "loading", appointment });
    try {
      const response = await getSecretaryAppointment(appointment._id);
      setModal({ type: "details", appointment: response.data.appointment });
    } catch (error) {
      showError(getToastError(error, "Unable to load appointment details."));
      setModal(null);
    }
  }
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow="Scheduling"
          title="Clinic schedule"
          description="Read-only appointment information for the front desk."
        />
        <div className="secretary-toolbar">
          <label className="user-search">
            <Search size={16} />
            <span className="sr-only">Search appointments</span>
            <input
              placeholder="Search patient, therapist, or email"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <select
            aria-label="Appointment status"
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
          >
            <option value="confirmed">Upcoming confirmed</option>
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Date range"
            value={filters.date}
            onChange={(event) =>
              setFilters({ ...filters, date: event.target.value })
            }
          >
            <option value="">Any date</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
          </select>
          <select
            aria-label="Therapist"
            value={filters.therapist}
            onChange={(event) =>
              setFilters({ ...filters, therapist: event.target.value })
            }
          >
            <option value="">All therapists</option>
            {therapists.map((therapist) => (
              <option value={therapist._id} key={therapist._id}>
                {therapist.firstname} {therapist.lastname}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="staff-loading-block">
            <Skeleton variant="heading" width="42%" height="22px" />
            <Skeleton variant="text" width="100%" height="46px" />
            <Skeleton variant="text" width="100%" height="46px" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="staff-empty-state">
            <strong>
              {filters.search
                ? "No results match your search"
                : "No appointments scheduled"}
            </strong>
            <span>Try another date, status, or therapist.</span>
          </div>
        ) : (
          <div className="secretary-table-wrap">
            <table className="secretary-table">
              <thead>
                <tr>
                  <th>Date and time</th>
                  <th>Patient</th>
                  <th>Therapist</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment._id}>
                    <td data-label="Date and time">
                      {new Date(dateTime(appointment)).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td data-label="Patient">
                      <strong>
                        {appointment.patient?.firstname}{" "}
                        {appointment.patient?.lastname}
                      </strong>
                      <small>
                        {appointment.patient?.phone ||
                          appointment.patient?.email}
                      </small>
                    </td>
                    <td data-label="Therapist">
                      {appointment.therapist
                        ? `${appointment.therapist.firstname} ${appointment.therapist.lastname}`
                        : "Unassigned"}
                    </td>
                    <td data-label="Service">{appointment.service?.name}</td>
                    <td data-label="Status">
                      <span
                        className={`status-badge ${statusClasses[appointment.status]}`}
                      >
                        {statusLabels[appointment.status]}
                      </span>
                    </td>
                    <td data-label="Payment">
                      <span
                        className={`payment-badge payment-${appointment.payment?.status || "unpaid"}`}
                      >
                        {appointment.payment?.status === "paid"
                          ? "Paid"
                          : "Unpaid"}
                      </span>
                    </td>
                    <td className="secretary-row-actions">
                      <button
                        type="button"
                        title="View details"
                        onClick={() => openDetails(appointment)}
                      >
                        <Eye size={15} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal?.type === "loading" && (
        <Modal title="Appointment details" onClose={() => setModal(null)}>
          <div className="staff-loading-block">
            <Skeleton variant="text" width="100%" height="24px" />
            <Skeleton variant="text" width="100%" height="24px" />
          </div>
        </Modal>
      )}
      {modal?.type === "details" && (
        <Modal title="Appointment details" onClose={() => setModal(null)}>
          <div className="secretary-detail-grid">
            <div>
              <span>Patient</span>
              <strong>
                {modal.appointment.patient?.firstname}{" "}
                {modal.appointment.patient?.lastname}
              </strong>
              <small>
                {modal.appointment.patient?.phone || "No phone"}
                <br />
                {modal.appointment.patient?.email}
              </small>
            </div>
            <div>
              <span>Service</span>
              <strong>{modal.appointment.service?.name}</strong>
              <small>{modal.appointment.service?.duration} minutes</small>
            </div>
            <div>
              <span>Therapist</span>
              <strong>
                {modal.appointment.therapist
                  ? `${modal.appointment.therapist.firstname} ${modal.appointment.therapist.lastname}`
                  : "Unassigned"}
              </strong>
            </div>
            <div>
              <span>Date and time</span>
              <strong>
                {new Date(dateTime(modal.appointment)).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </strong>
            </div>
            <div>
              <span>Status</span>
              <strong>
                <span
                  className={`status-badge ${statusClasses[modal.appointment.status]}`}
                >
                  {statusLabels[modal.appointment.status]}
                </span>
              </strong>
            </div>
            <div>
              <span>Payment</span>
              <strong>
                <span
                  className={`payment-badge payment-${modal.appointment.payment?.status || "unpaid"}`}
                >
                  {modal.appointment.payment?.status === "paid"
                    ? `Paid · ${money(modal.appointment.payment.amount)}`
                    : `Unpaid · ${money(modal.appointment.payment.amount)}`}
                </span>
              </strong>
            </div>
          </div>
          {modal.appointment.cancelReason && (
            <p className="secretary-readonly-note">
              Cancellation reason: {modal.appointment.cancelReason}
            </p>
          )}
          <p className="secretary-readonly-note">
            Scheduling changes are managed by the clinic administrator.
          </p>
          {modal.appointment.payment?.status !== "paid" && (
            <button
              className="staff-section-primary"
              type="button"
              onClick={() =>
                setModal({ type: "payment", appointment: modal.appointment })
              }
            >
              Record payment
            </button>
          )}
        </Modal>
      )}
      {modal?.type === "payment" && (
        <Modal
          title="Record payment"
          onClose={() =>
            setModal({ type: "details", appointment: modal.appointment })
          }
        >
          <PaymentForm
            appointment={modal.appointment}
            onClose={() =>
              setModal({ type: "details", appointment: modal.appointment })
            }
            onSaved={(updated) => {
              updateAppointment(updated);
              refresh();
              setModal({ type: "details", appointment: updated });
            }}
          />
        </Modal>
      )}
    </main>
  );
}

export default SchedulePage;
