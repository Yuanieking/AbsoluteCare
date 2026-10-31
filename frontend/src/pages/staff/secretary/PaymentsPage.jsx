import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import Skeleton from "../../../components/dashboard/Skeleton";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import {
  getSecretaryPayments,
  recordSecretaryPayment,
  updateSecretaryPayment,
} from "../../../services/api/secretaryApi";
import { getToastError, showError, showPromise } from "../../../utils/toast";

const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

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
        aria-labelledby="payment-modal-title"
      >
        <div className="staff-modal-header">
          <h2 id="payment-modal-title">{title}</h2>
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

function PaymentForm({ appointment, editing, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const request = editing
      ? updateSecretaryPayment(appointment._id, data)
      : recordSecretaryPayment(appointment._id, data);
    showPromise(request, {
      loading: editing ? "Updating payment..." : "Recording payment...",
      success: editing ? "Payment status updated." : "Payment recorded.",
      error: "Unable to save payment.",
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
        Payment status
        <select
          name="status"
          defaultValue={
            editing ? appointment.payment?.status || "paid" : "paid"
          }
        >
          <option value="paid">Paid</option>
          {editing && <option value="unpaid">Unpaid</option>}
        </select>
      </label>
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
        <select
          name="method"
          defaultValue={appointment.payment?.method || "cash"}
        >
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Reference number
        <input
          name="referenceNumber"
          defaultValue={appointment.payment?.referenceNumber || ""}
        />
      </label>
      <label>
        {editing ? "Reason or notes" : "Notes"}
        <textarea
          name={editing ? "reason" : "notes"}
          rows="3"
          defaultValue={appointment.payment?.notes || ""}
          required={editing && appointment.payment?.status === "paid"}
        />
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
          {editing ? "Save payment" : "Record payment"}
        </button>
      </div>
    </form>
  );
}

function PaymentsPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    getSecretaryPayments({ status, search })
      .then((response) => setAppointments(response.data.appointments))
      .catch((error) =>
        showError(getToastError(error, "Unable to load payments.")),
      )
      .finally(() => setLoading(false));
  }, [status, search]);
  function updateAppointment(updated) {
    setAppointments((current) =>
      current.map((item) => (item._id === updated._id ? updated : item)),
    );
  }
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow="Finance"
          title="Payments"
          description="Record and correct payment information for clinic visits."
          action={
            <span className="secretary-payment-key">
              Paid and unpaid are payment records, separate from appointment
              status.
            </span>
          }
        />
        <div className="secretary-toolbar">
          <label className="user-search">
            <Search size={16} />
            <span className="sr-only">Search patients</span>
            <input
              placeholder="Search patient name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Payment status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All payments</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
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
            <strong>No payment records found</strong>
            <span>Only confirmed and completed appointments appear here.</span>
          </div>
        ) : (
          <div className="secretary-table-wrap">
            <table className="secretary-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Amount</th>
                  <th>Payment status</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment._id}>
                    <td data-label="Date">
                      {new Date(
                        appointment.scheduledStart,
                      ).toLocaleDateString()}
                    </td>
                    <td data-label="Patient">
                      <strong>
                        {appointment.patient?.firstname}{" "}
                        {appointment.patient?.lastname}
                      </strong>
                      <small>{appointment.patient?.email}</small>
                    </td>
                    <td data-label="Service">{appointment.service?.name}</td>
                    <td data-label="Amount">
                      {money(appointment.payment?.amount)}
                    </td>
                    <td data-label="Payment status">
                      <span
                        className={`payment-badge payment-${appointment.payment?.status || "unpaid"}`}
                      >
                        {appointment.payment?.status === "paid"
                          ? "Paid"
                          : "Unpaid"}
                      </span>
                    </td>
                    <td data-label="Method">
                      {appointment.payment?.status === "paid"
                        ? appointment.payment.method
                        : "Not recorded"}
                    </td>
                    <td className="secretary-row-actions">
                      {appointment.payment?.status === "paid" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setModal({ appointment, editing: true })
                          }
                        >
                          <Pencil size={14} />
                          Edit payment
                        </button>
                      ) : (
                        <button
                          className="staff-section-primary"
                          type="button"
                          onClick={() =>
                            setModal({ appointment, editing: false })
                          }
                        >
                          <Plus size={14} />
                          Record payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal && (
        <Modal
          title={modal.editing ? "Edit payment" : "Record payment"}
          onClose={() => setModal(null)}
        >
          <PaymentForm
            appointment={modal.appointment}
            editing={modal.editing}
            onClose={() => setModal(null)}
            onSaved={updateAppointment}
          />
        </Modal>
      )}
    </main>
  );
}

export default PaymentsPage;
