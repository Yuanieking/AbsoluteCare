import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import Skeleton from "../../../components/dashboard/Skeleton";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import {
  createAdminService,
  getAdminServices,
  removeAdminService,
  updateAdminService,
} from "../../../services/api/adminServiceApi";
import { getToastError, showError, showPromise } from "../../../utils/toast";
import {
  RowActions,
  StackedCell,
} from "../../../components/staff/AdminPrimitives";
import {
  formatAdminCurrency,
  formatAdminDuration,
} from "../../../utils/adminFormatters";

const blank = { name: "", description: "", duration: 60, fee: 0, category: "" };

function ServiceModal({ service, onClose, onSaved }) {
  const [form, setForm] = useState(service ? { ...blank, ...service } : blank);
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    const request = service
      ? updateAdminService(service._id, form)
      : createAdminService(form);
    showPromise(request, {
      loading: "Saving service...",
      success: service ? "Service updated." : "Service added.",
      error: "Unable to save this service.",
    });
    try {
      const response = await request;
      onSaved(response.data.service);
      onClose();
    } catch {
      return;
    }
  }
  return (
    <div
      className="staff-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="staff-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-dialog-title"
      >
        <div className="staff-modal-header">
          <div>
            <span className="staff-page-eyebrow">Administration</span>
            <h2 id="service-dialog-title">
              {service ? "Edit service" : "Add service"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <form className="admin-user-form" onSubmit={submit}>
          <label>
            Service name
            <input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
            />
          </label>
          <label>
            Description
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </label>
          <label>
            Category or specialization
            <input
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              placeholder="Sports injury"
            />
          </label>
          <div className="form-grid-two">
            <label>
              Duration (minutes)
              <input
                type="number"
                min="1"
                value={form.duration}
                onChange={(event) => update("duration", event.target.value)}
                required
              />
            </label>
            <label>
              Fee (₱)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fee}
                onChange={(event) => update("fee", event.target.value)}
                required
              />
            </label>
          </div>
          <div className="profile-edit-actions">
            <button
              className="profile-cancel-button"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="staff-section-primary" type="submit">
              Save service
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const load = () =>
    getAdminServices()
      .then((response) => setServices(response.data.services))
      .catch((error) =>
        showError(getToastError(error, "Unable to load services.")),
      )
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  async function remove(service) {
    if (
      !window.confirm(
        "This service will no longer be available for new bookings. Existing appointments won't be affected.",
      )
    )
      return;
    const request = removeAdminService(service._id);
    showPromise(request, {
      loading: "Removing service...",
      success: "Service removed from new bookings.",
      error: "Unable to remove this service.",
    });
    try {
      await request;
      load();
    } catch {
      return;
    }
  }
  function saveService(service) {
    setServices((current) =>
      modal.service
        ? current.map((item) => (item._id === service._id ? service : item))
        : [service, ...current],
    );
  }
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow="Administration"
          title="Therapy services"
          description="Keep the service catalogue and booking prices current."
          action={
            <button
              className="staff-section-primary"
              type="button"
              onClick={() => setModal({ service: null })}
            >
              <Plus size={15} />
              Add service
            </button>
          }
        />
        {loading ? (
          <div className="staff-loading-block">
            <Skeleton variant="text" width="100%" height="46px" />
            <Skeleton variant="text" width="100%" height="46px" />
          </div>
        ) : services.length === 0 ? (
          <div className="staff-empty-state">
            <strong>No therapy services configured</strong>
            <span>Add the first service to open bookings.</span>
          </div>
        ) : (
          <div className="appointment-table-wrap">
            <table className="appointment-admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Duration</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service._id}>
                    <td>
                      <StackedCell
                        primary={service.name}
                        secondary={
                          service.description ||
                          service.category ||
                          "General therapy"
                        }
                      />
                    </td>
                    <td>{formatAdminDuration(service.duration)}</td>
                    <td>
                      <span
                        className={!service.fee ? "admin-warning-value" : ""}
                      >
                        {formatAdminCurrency(service.fee)}
                      </span>
                      {!service.fee && (
                        <span
                          className="admin-setup-chip"
                          title="Payments for this service will record ₱0.00"
                        >
                          Fee not set
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`admin-account-status status-${service.isActive ? "active" : "archived"}`}
                      >
                        {service.isActive ? "Active" : "Retired"}
                      </span>
                    </td>
                    <td>
                      <RowActions
                        onEdit={() => setModal({ service })}
                        menu={
                          service.isActive
                            ? [
                                {
                                  key: "retire",
                                  label: "Retire service",
                                  danger: true,
                                  onClick: () => remove(service),
                                },
                              ]
                            : []
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal && (
        <ServiceModal
          service={modal.service}
          onClose={() => setModal(null)}
          onSaved={saveService}
        />
      )}
    </main>
  );
}

export default ServicesPage;
