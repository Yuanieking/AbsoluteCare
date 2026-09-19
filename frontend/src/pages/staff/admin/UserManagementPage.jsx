import { useCallback, useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import Skeleton from "../../../components/dashboard/Skeleton";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import {
  activateAdminUser,
  archiveAdminUser,
  createAdminUser,
  deactivateAdminUser,
  getAdminUsers,
  removeAdminUser,
  updateAdminUser,
} from "../../../services/api/adminUserApi";
import { getToastError, showError, showPromise } from "../../../utils/toast";
import { sanitizePhone } from "../../../utils/validators";
import { useAuth } from "../../../context/useAuth";
import {
  AccountStatusBadge,
  RoleBadge,
  RowActions,
  StackedCell,
} from "../../../components/staff/AdminPrimitives";

const roles = {
  patient: "Patient",
  user: "Patient",
  therapist: "Therapist",
  secretary: "Secretary",
  admin: "Admin",
};
const blank = {
  firstname: "",
  lastname: "",
  email: "",
  role: "patient",
  phone: "",
};

function UserModal({ user, onClose, onSaved }) {
  const [credentials, setCredentials] = useState("");
  const [passwordMode, setPasswordMode] = useState("auto");
  const [manualPassword, setManualPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(
    user
      ? {
          ...blank,
          ...user,
          role: user.role === "user" ? "patient" : user.role,
        }
      : blank,
  );
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    if (!user && passwordMode === "manual" && manualPassword.length < 8) {
      setFormError("Manual passwords must be at least 8 characters.");
      return;
    }
    const request = user
      ? updateAdminUser(user._id, form)
      : createAdminUser({
          ...form,
          ...(passwordMode === "manual" ? { password: manualPassword } : {}),
        });
    showPromise(request, {
      loading: "Saving user...",
      success: user ? "User updated." : `Invite sent to ${form.email}.`,
      error: "Unable to save this user.",
    });
    try {
      const response = await request;
      onSaved(response.data.user);
      if (!user && response.data.temporaryPassword) {
        setCredentials(response.data.temporaryPassword);
      } else {
        onClose();
      }
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
        aria-labelledby="user-dialog-title"
      >
        <div className="staff-modal-header">
          <div>
            <span className="staff-page-eyebrow">Administration</span>
            <h2 id="user-dialog-title">{user ? "Edit user" : "Add user"}</h2>
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
        {credentials && (
          <div className="staff-security-note" role="status">
            <strong>Temporary password</strong>
            <code>{credentials}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(credentials)}
            >
              Copy password
            </button>
            <small>
              Copy it now. It will not be shown again and must be changed on
              first login.
            </small>
          </div>
        )}
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
          {!user && (
            <>
              <label>
                Credentials
                <select
                  value={passwordMode}
                  onChange={(event) => setPasswordMode(event.target.value)}
                >
                  <option value="auto">Auto-generate temporary password</option>
                  <option value="manual">Set a password manually</option>
                </select>
              </label>
              {passwordMode === "manual" && (
                <label>
                  Temporary password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={manualPassword}
                    onChange={(event) => setManualPassword(event.target.value)}
                    minLength="8"
                    required
                  />
                </label>
              )}
            </>
          )}
          {formError && (
            <p className="profile-error" role="alert">
              {formError}
            </p>
          )}
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
              Role
              <select
                value={form.role}
                onChange={(event) => update("role", event.target.value)}
              >
                <option value="therapist">Therapist</option>
                <option value="secretary">Secretary</option>
              </select>
            </label>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(event) =>
                  update("phone", sanitizePhone(event.target.value))
                }
                type="tel"
                inputMode="numeric"
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
            <button
              className="staff-section-primary"
              type="submit"
              disabled={Boolean(credentials)}
            >
              Save user
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    role: "all",
    status: "all",
    search: "",
  });
  const [modal, setModal] = useState(null);
  const load = useCallback(
    () =>
      getAdminUsers(filters)
        .then((response) => setUsers(response.data.users))
        .catch((error) =>
          showError(getToastError(error, "Unable to load users.")),
        )
        .finally(() => setLoading(false)),
    [filters],
  );
  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);
  const save = (user) =>
    setUsers((current) =>
      current.some((item) => item._id === user._id)
        ? current.map((item) => (item._id === user._id ? user : item))
        : [user, ...current],
    );
  async function statusAction(user, action) {
    const request =
      action === "activate"
        ? activateAdminUser(user._id)
        : action === "deactivate"
          ? deactivateAdminUser(user._id)
          : archiveAdminUser(user._id);
    showPromise(request, {
      loading: `${action[0].toUpperCase()}${action.slice(1)}ing user...`,
      success: `User ${action}d.`,
      error: "Unable to change account status.",
    });
    try {
      const response = await request;
      save(response.data.user);
    } catch {
      return;
    }
  }
  async function remove(user) {
    const confirmation = window.prompt(
      `Type ${user.firstname} ${user.lastname} to remove this account.`,
    );
    if (confirmation === null) return;
    const request = removeAdminUser(user._id, confirmation);
    showPromise(request, {
      loading: "Removing user...",
      success: "User removed.",
      error: "Unable to remove this user.",
    });
    try {
      await request;
      setUsers((current) => current.filter((item) => item._id !== user._id));
    } catch {
      return;
    }
  }
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow="Administration"
          title="User management"
          description="Manage access without losing the history behind a clinic account."
          action={
            <button
              className="staff-section-primary"
              type="button"
              onClick={() => setModal({ user: null })}
            >
              <Plus size={15} />
              Add user
            </button>
          }
        />
        <div className="user-management-toolbar">
          <div className="user-tabs">
            {[
              ["all", "All"],
              ["patient", "Patients"],
              ["therapist", "Therapists"],
              ["secretary", "Secretaries"],
            ].map(([value, label]) => (
              <button
                className={filters.role === value ? "is-active" : ""}
                type="button"
                key={value}
                onClick={() =>
                  setFilters((current) => ({ ...current, role: value }))
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label className="user-search">
            <Search size={16} />
            <span className="sr-only">Search users</span>
            <input
              placeholder="Search name or email"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
            />
          </label>
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {loading ? (
          <div className="staff-loading-block">
            <Skeleton variant="text" width="100%" height="46px" />
            <Skeleton variant="text" width="100%" height="46px" />
          </div>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <StackedCell
                        primary={`${user.firstname} ${user.lastname}`}
                        secondary={user.email}
                      />
                    </td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td>
                      <AccountStatusBadge user={user} />
                    </td>
                    <td className="user-actions">
                      <RowActions
                        self={
                          String(currentUser?.id || currentUser?._id) ===
                          String(user._id)
                        }
                        onView={() => setModal({ user, view: true })}
                        onEdit={() => setModal({ user })}
                        menu={[
                          {
                            key: user.isActive ? "deactivate" : "activate",
                            label: user.isActive ? "Deactivate" : "Activate",
                            onClick: () =>
                              statusAction(
                                user,
                                user.isActive ? "deactivate" : "activate",
                              ),
                          },
                          {
                            key: "archive",
                            label: "Archive",
                            onClick: () => statusAction(user, "archive"),
                          },
                          {
                            key: "remove",
                            label: "Remove",
                            danger: true,
                            onClick: () => remove(user),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal &&
        (modal.view ? (
          <div
            className="staff-modal-backdrop"
            onMouseDown={() => setModal(null)}
          >
            <section
              className="staff-modal"
              role="dialog"
              aria-modal="true"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="staff-modal-header">
                <h2>
                  {modal.user.firstname} {modal.user.lastname}
                </h2>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setModal(null)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="user-detail-list">
                <div>
                  <span>Email</span>
                  <strong>{modal.user.email}</strong>
                </div>
                <div>
                  <span>Role</span>
                  <strong>{roles[modal.user.role]}</strong>
                </div>
                <div>
                  <span>Account status</span>
                  <strong>
                    {modal.user.isArchived
                      ? "Archived"
                      : modal.user.isActive
                        ? "Active"
                        : "Deactivated"}
                  </strong>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <UserModal
            user={modal.user}
            onClose={() => setModal(null)}
            onSaved={save}
          />
        ))}
    </main>
  );
}
