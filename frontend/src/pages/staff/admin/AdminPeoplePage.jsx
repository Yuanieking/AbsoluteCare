import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import Skeleton from "../../../components/dashboard/Skeleton";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import SearchFilterBar from "../../../components/staff/SearchFilterBar";
import {
  getAdminUsers,
  updateAdminPatient,
  updateAdminTherapist,
  updateAdminTherapistAvailability,
  updateAdminTherapistSpecialization,
} from "../../../services/api/adminUserApi";
import { getToastError, showError, showPromise } from "../../../utils/toast";
import {
  AccountStatusBadge,
  RowActions,
  StackedCell,
} from "../../../components/staff/AdminPrimitives";
import {
  formatAdminDate,
  formatAdminPhone,
} from "../../../utils/adminFormatters";
import { sanitizePhone } from "../../../utils/validators";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function PersonModal({ person, role, onClose, onSaved }) {
  const [form, setForm] = useState({
    ...person,
    specialization: Array.isArray(person.specialization)
      ? person.specialization.join(", ")
      : person.specialization || "",
    workingDays: person.workingDays || [],
    workingHours: person.workingHours || { start: "08:00", end: "17:00" },
  });
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggleDay = (day) =>
    update(
      "workingDays",
      form.workingDays.includes(day)
        ? form.workingDays.filter((item) => item !== day)
        : [...form.workingDays, day],
    );
  async function submit(event) {
    event.preventDefault();
    const basic = {
      firstname: form.firstname,
      lastname: form.lastname,
      email: form.email,
      phone: form.phone,
      profilePicture: form.profilePicture,
      ...(role === "therapist"
        ? { address: form.address }
        : { dateOfBirth: form.dateOfBirth, address: form.address }),
    };
    const requests =
      role === "patient"
        ? [updateAdminPatient(person._id, basic)]
        : [
            updateAdminTherapist(person._id, basic),
            updateAdminTherapistSpecialization(person._id, {
              specialization: form.specialization
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            }),
            updateAdminTherapistAvailability(person._id, {
              workingDays: form.workingDays,
              workingHours: form.workingHours,
            }),
          ];
    const request = Promise.all(requests);
    showPromise(request, {
      loading: "Saving record...",
      success: "Record updated.",
      error: "Unable to save this record.",
    });
    try {
      const responses = await request;
      onSaved(
        responses[responses.length - 1].data.user || responses[0].data.user,
      );
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
        aria-labelledby="person-dialog-title"
      >
        <div className="staff-modal-header">
          <div>
            <span className="staff-page-eyebrow">Administration</span>
            <h2 id="person-dialog-title">Edit {role} record</h2>
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
          <div className="form-grid-two">
            <label>
              First name
              <input
                value={form.firstname}
                onChange={(event) => update("firstname", event.target.value)}
                required
              />
            </label>
            <label>
              Last name
              <input
                value={form.lastname}
                onChange={(event) => update("lastname", event.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              required
            />
          </label>
          <div className="form-grid-two">
            <label>
              Phone
              <input
                value={form.phone || ""}
                onChange={(event) =>
                  update("phone", sanitizePhone(event.target.value))
                }
                type="tel"
                inputMode="numeric"
              />
            </label>
            {role === "patient" ? (
              <label>
                Date of birth
                <input
                  type="date"
                  value={form.dateOfBirth || ""}
                  onChange={(event) =>
                    update("dateOfBirth", event.target.value)
                  }
                />
              </label>
            ) : (
              <label>
                Profile picture URL
                <input
                  value={form.profilePicture || ""}
                  onChange={(event) =>
                    update("profilePicture", event.target.value)
                  }
                />
              </label>
            )}
          </div>
          <label>
            Address
            <textarea
              rows="2"
              value={form.address || ""}
              onChange={(event) => update("address", event.target.value)}
            />
          </label>
          {role === "therapist" && (
            <>
              <label>
                Specializations
                <input
                  value={form.specialization}
                  onChange={(event) =>
                    update("specialization", event.target.value)
                  }
                  placeholder="Sports injury, Neuro rehab"
                />
              </label>
              <fieldset className="availability-fieldset">
                <legend>Working days</legend>
                <div className="day-toggle-row">
                  {days.map((day) => (
                    <button
                      className={
                        form.workingDays.includes(day) ? "is-selected" : ""
                      }
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="form-grid-two">
                  <label>
                    Starts
                    <input
                      type="time"
                      value={form.workingHours.start}
                      onChange={(event) =>
                        update("workingHours", {
                          ...form.workingHours,
                          start: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Ends
                    <input
                      type="time"
                      value={form.workingHours.end}
                      onChange={(event) =>
                        update("workingHours", {
                          ...form.workingHours,
                          end: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </fieldset>
            </>
          )}
          <div className="profile-edit-actions">
            <button
              className="profile-cancel-button"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="staff-section-primary" type="submit">
              Save record
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function AdminPeoplePage({ role }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const load = useCallback(
    () =>
      getAdminUsers({ role, status: "all", search: query, limit: 50 })
        .then((response) => setPeople(response.data.users))
        .catch((error) =>
          showError(getToastError(error, `Unable to load ${role}s.`)),
        )
        .finally(() => setLoading(false)),
    [query, role],
  );
  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);
  const save = (person) =>
    setPeople((current) =>
      current.map((item) => (item._id === person._id ? person : item)),
    );
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow="Administration"
          title={`${role[0].toUpperCase()}${role.slice(1)} records`}
          description={
            role === "therapist"
              ? "Maintain therapist details and the single source of truth for availability."
              : "Keep patient contact and profile information accurate."
          }
        />
        <SearchFilterBar
          search={search}
          onSearch={setSearch}
          chips={
            search
              ? [{ label: `Search: ${search}`, onRemove: () => setSearch("") }]
              : []
          }
          onClear={() => setSearch("")}
        />
        {loading ? (
          <div className="staff-loading-block">
            <Skeleton variant="text" width="100%" height="46px" />
            <Skeleton variant="text" width="100%" height="46px" />
          </div>
        ) : people.length === 0 ? (
          <div className="staff-empty-state">
            <strong>No results match your search</strong>
            <button type="button" onClick={() => setSearch("")}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="appointment-table-wrap">
            <table className="appointment-admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  {role === "therapist" && (
                    <>
                      <th>Specialization</th>
                      <th>Availability</th>
                    </>
                  )}
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person._id}>
                    <td>
                      <StackedCell
                        primary={`${person.firstname} ${person.lastname}`}
                        secondary={
                          role === "patient"
                            ? person.dateOfBirth
                              ? formatAdminDate(person.dateOfBirth)
                              : "Not added"
                            : `${person.workingDays?.length || 0} working days`
                        }
                      />
                    </td>
                    <td>
                      <StackedCell
                        primary={person.email}
                        secondary={formatAdminPhone(person.phone)}
                      />
                    </td>
                    {role === "therapist" && (
                      <>
                        <td>
                          <span
                            className={
                              !person.specialization?.length
                                ? "admin-warning-value"
                                : ""
                            }
                          >
                            {Array.isArray(person.specialization)
                              ? person.specialization.join(", ") || "Not set"
                              : person.specialization || "Not set"}
                          </span>
                          {(!person.specialization?.length ||
                            !person.workingDays?.length) && (
                            <span
                              className="admin-setup-chip"
                              title="Add specialization and working days before assigning appointments"
                            >
                              Needs setup
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              !person.workingDays?.length
                                ? "admin-warning-value"
                                : ""
                            }
                          >
                            {person.workingDays?.length
                              ? `${person.workingDays.join(", ")} · ${person.workingHours?.start || "08:00"} – ${person.workingHours?.end || "17:00"}`
                              : "No working days set"}
                          </span>
                        </td>
                      </>
                    )}
                    <td>
                      <AccountStatusBadge user={person} />
                    </td>
                    <td>
                      <RowActions onEdit={() => setSelected(person)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <PersonModal
          person={selected}
          role={role}
          onClose={() => setSelected(null)}
          onSaved={save}
        />
      )}
    </main>
  );
}
