import {
  ArrowLeft,
  CalendarPlus,
  ChevronRight,
  Ellipsis,
  HeartHandshake,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import {
  Button,
  Card,
  DashboardEmptyState,
  StatusBadge,
} from "../../components/dashboard/DashboardPrimitives";
import Skeleton from "../../components/loading/Skeleton";
import PageHeader from "../../components/dashboard/PageHeader";
import {
  createDependent,
  getDependent,
  removeDependent,
  updateDependent,
} from "../../services/api/patientApi";
import { useAuth } from "../../context/useAuth";
import { getToastError, showError, showSuccess } from "../../utils/toast";
import {
  appointmentDate,
  appointmentTime,
  todayInManila,
} from "../../utils/patientFormatters";

const relationships = [
  "Son",
  "Daughter",
  "Spouse",
  "Parent",
  "Sibling",
  "Other",
];

function getAge(dateOfBirth) {
  if (!dateOfBirth) return "Age unavailable";
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  )
    age -= 1;
  return `${Math.max(age, 0)} ${age === 1 ? "year" : "years"} old`;
}

function formatDate(value) {
  if (!value) return "Date of birth unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function initials(dependent) {
  return (
    `${dependent.firstName?.[0] || ""}${dependent.lastName?.[0] || ""}`.toUpperCase() ||
    "D"
  );
}

function dependentName(dependent) {
  return (
    `${dependent.firstName || ""} ${dependent.lastName || ""}`.trim() ||
    "Unnamed dependent"
  );
}

function upcomingAppointment(dependent) {
  const appointment = dependent.nextAppointment;
  if (!appointment) return "No upcoming appointments";
  return `${appointmentDate(appointment)} · ${appointmentTime(appointment)} · ${appointment.service?.name || "Therapy"}`;
}

function DependentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const dashboard = useOutletContext();
  const { dependents = [], loading, error, retry } = dashboard || {};
  const [formOpen, setFormOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  if (id)
    return (
      <DependentDetail
        id={id}
        onBack={() => navigate("/dashboard/dependents")}
      />
    );
  if (loading) return <DependentsSkeleton />;
  if (error) return <PageError error={error} retry={retry} />;

  const guardian = Boolean(user?.isGuardian || dependents.length);
  return (
    <main className="dashboard-content dependents-page">
      <section className="dashboard-section patient-page-section">
        <PageHeader
          eyebrow="For your family"
          title="My dependents"
          description="Manage the family members you book appointments for."
          action={
            <Button type="button" onClick={() => setFormOpen(true)}>
              <Plus size={16} aria-hidden="true" /> Add dependent
            </Button>
          }
          meta={
            guardian ? (
              <p className="dependents-count">
                You’re managing {dependents.length}{" "}
                {dependents.length === 1 ? "dependent" : "dependents"}
              </p>
            ) : null
          }
        >
          {guardian && (
            <span className="dependent-guardian-badge">Guardian</span>
          )}
        </PageHeader>
        {dependents.length ? (
          <ul className="dependents-grid" aria-label="Your dependents">
            {dependents.map((dependent) => (
              <li key={dependent._id}>
                <DependentCard
                  dependent={dependent}
                  onOpen={() =>
                    navigate(`/dashboard/dependents/${dependent._id}`)
                  }
                  onEdit={() => setEditingDependent(dependent)}
                  onRemove={() => setRemoveTarget(dependent)}
                />
              </li>
            ))}
            <li>
              <button
                className="dependent-add-card"
                type="button"
                onClick={() => setFormOpen(true)}
              >
                <span className="dependent-add-icon">
                  <Plus size={20} />
                </span>
                <strong>Add another dependent</strong>
                <span>Keep family appointments together</span>
              </button>
            </li>
          </ul>
        ) : (
          <div className="dependent-empty-state-shell">
            <DashboardEmptyState
              icon={<UsersRound size={26} aria-hidden="true" />}
              title="No dependents yet"
              message="Add a child or family member to book and manage their appointments from your account."
              action={
                <Button type="button" onClick={() => setFormOpen(true)}>
                  <Plus size={16} aria-hidden="true" /> Add your first dependent
                </Button>
              }
            />
            <p className="dependent-helper">
              You’ll be labeled as their guardian on appointments.
            </p>
          </div>
        )}
      </section>
      {(formOpen || editingDependent) && (
        <DependentForm
          dependent={editingDependent}
          onClose={() => {
            setFormOpen(false);
            setEditingDependent(null);
          }}
          onSaved={async () => {
            setFormOpen(false);
            setEditingDependent(null);
            if (!user?.isGuardian) setUser({ ...user, isGuardian: true });
            await retry();
          }}
        />
      )}
      {removeTarget && (
        <RemoveDialog
          dependent={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onRemoved={async () => {
            setRemoveTarget(null);
            await retry();
          }}
        />
      )}
    </main>
  );
}

function DependentCard({ dependent, onOpen, onEdit, onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const name = dependentName(dependent);
  const relationship = dependent.relationship || "Other";
  return (
    <Card
      className="dependent-card"
      tabIndex="0"
      role="button"
      onClick={(event) => {
        if (!event.target.closest("button, a")) onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <div className="dependent-card-header">
        <span className="avatar dependent-card-avatar">
          {initials(dependent)}
        </span>
        <div className="dependent-card-name">
          <strong title={name}>{name}</strong>
          <span className="dependent-relationship" title={relationship}>
            {relationship}
          </span>
        </div>
        <span className="dependent-card-mark">
          <HeartHandshake size={14} aria-hidden="true" />
        </span>
      </div>
      <div className="dependent-card-details">
        <strong>{getAge(dependent.dateOfBirth)}</strong>
        <span>Born {formatDate(dependent.dateOfBirth)}</span>
      </div>
      <div className="dependent-card-next">
        <span>Next appointment</span>
        <p>{upcomingAppointment(dependent)}</p>
      </div>
      <div className="dependent-card-footer">
        <Link
          className="dashboard-primary-button"
          to={`/dashboard/book?dependent=${dependent._id}`}
          onClick={(event) => event.stopPropagation()}
        >
          <CalendarPlus size={15} aria-hidden="true" /> Book appointment
        </Link>
        <button
          className="dependent-view-button"
          type="button"
          onClick={onOpen}
        >
          View <ChevronRight size={14} />
        </button>
        <div className="dependent-menu-wrap">
          <button
            className="icon-button"
            type="button"
            aria-label={`More actions for ${name}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Ellipsis size={18} />
          </button>
          {menuOpen && (
            <div className="dependent-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function DependentForm({ dependent, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    firstName: dependent?.firstName || "",
    lastName: dependent?.lastName || "",
    dateOfBirth: dependent?.dateOfBirth
      ? new Date(dependent.dateOfBirth).toISOString().slice(0, 10)
      : "",
    relationship: dependent?.relationship || "",
    medicalNotes: dependent?.medicalNotes || "",
  });

  useEffect(() => {
    dialogRef.current?.querySelector("input")?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        "button, input, select, textarea",
      );
      if (!focusable?.length) return;
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
  function validate(values = form) {
    const nextErrors = {};
    if (!values.firstName.trim()) nextErrors.firstName = "Enter a first name.";
    else if (/\d/.test(values.firstName))
      nextErrors.firstName = "Names cannot contain numbers.";
    if (!values.lastName.trim()) nextErrors.lastName = "Enter a last name.";
    else if (/\d/.test(values.lastName))
      nextErrors.lastName = "Names cannot contain numbers.";
    if (!values.dateOfBirth) nextErrors.dateOfBirth = "Choose a date of birth.";
    else if (values.dateOfBirth > todayInManila())
      nextErrors.dateOfBirth = "Date of birth cannot be in the future.";
    else if (values.dateOfBirth < "1900-01-01")
      nextErrors.dateOfBirth = "Choose a date after 1900.";
    if (!values.relationship)
      nextErrors.relationship = "Choose a relationship.";
    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  }
  function update(event) {
    const next = { ...form, [event.target.name]: event.target.value };
    setForm(next);
    if (errors[event.target.name]) validate(next);
  }
  async function submit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (dependent) {
        await updateDependent(dependent._id, form);
        showSuccess("Dependent updated.");
      } else {
        await createDependent(form);
        showSuccess("Dependent added.");
      }
      await onSaved();
    } catch (requestError) {
      showError(getToastError(requestError, "Unable to save dependent."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="patient-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="patient-modal dependent-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependent-dialog-title"
      >
        <div className="dependent-dialog-header">
          <div>
            <p className="dashboard-eyebrow">For your family</p>
            <h2 id="dependent-dialog-title">
              {dependent ? "Edit dependent" : "Add a dependent"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <form className="dependent-form" onSubmit={submit} noValidate>
          <FormField
            label="First name"
            name="firstName"
            value={form.firstName}
            error={errors.firstName}
            onChange={update}
            onBlur={() => validate()}
          />
          <FormField
            label="Last name"
            name="lastName"
            value={form.lastName}
            error={errors.lastName}
            onChange={update}
            onBlur={() => validate()}
          />
          <FormField
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            min="1900-01-01"
            max={todayInManila()}
            value={form.dateOfBirth}
            error={errors.dateOfBirth}
            onChange={update}
            onBlur={() => validate()}
          />
          <label>
            Relationship
            <select
              name="relationship"
              value={form.relationship}
              onChange={update}
              onBlur={() => validate()}
            >
              <option value="">Select relationship</option>
              {relationships.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            {errors.relationship && (
              <span className="form-field-error">{errors.relationship}</span>
            )}
          </label>
          <label className="form-field-wide">
            Notes{" "}
            <textarea
              name="medicalNotes"
              rows="4"
              maxLength="1000"
              value={form.medicalNotes}
              onChange={update}
              placeholder="Conditions or special needs to keep in mind"
            />
          </label>
          <div className="dependent-dialog-actions form-field-wide">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function FormField({ label, name, error, onBlur, ...props }) {
  return (
    <label>
      {label}
      <input
        name={name}
        {...props}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="form-field-error">{error}</span>}
    </label>
  );
}

function RemoveDialog({ dependent, onClose, onRemoved }) {
  const [removing, setRemoving] = useState(false);
  async function remove() {
    setRemoving(true);
    try {
      await removeDependent(dependent._id);
      showSuccess("Dependent removed.");
      await onRemoved();
    } catch (requestError) {
      showError(getToastError(requestError, "Unable to remove dependent."));
    } finally {
      setRemoving(false);
    }
  }
  return (
    <div
      className="patient-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="patient-modal dependent-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-dependent-title"
      >
        <div className="dependent-dialog-header">
          <div>
            <p className="dashboard-eyebrow">Remove dependent</p>
            <h2 id="remove-dependent-title">
              Remove {dependentName(dependent)}?
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p className="dependent-remove-copy">
          Their past appointments will stay in your records.
        </p>
        <div className="dependent-dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Keep dependent
          </Button>
          <button
            className="dashboard-danger-button"
            type="button"
            disabled={removing}
            onClick={remove}
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </section>
    </div>
  );
}

function DependentDetail({ id, onBack }) {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({ loading: true, error: "", data: null });
  useEffect(() => {
    let active = true;
    getDependent(id)
      .then((response) => {
        if (active)
          setState({ loading: false, error: "", data: response.data });
      })
      .catch((requestError) => {
        if (active)
          setState({
            loading: false,
            error: getToastError(requestError, "Unable to load dependent."),
            data: null,
          });
      });
    return () => {
      active = false;
    };
  }, [id, reloadToken]);
  if (state.loading)
    return (
      <main className="dashboard-content">
        <Card className="dependent-detail-card">
          <Skeleton variant="heading" width="240px" height="32px" />
          <Skeleton variant="text" width="100%" height="16px" />
        </Card>
      </main>
    );
  if (state.error)
    return (
      <PageError
        error={state.error}
        retry={() => setReloadToken((current) => current + 1)}
      />
    );
  const { dependent, appointments = [], sessions = [] } = state.data;
  const name = dependentName(dependent);
  const upcoming = appointments.filter(
    (appointment) =>
      appointment.status === "confirmed" &&
      new Date(appointment.scheduledStart) >= new Date(),
  );
  const previous = appointments.filter(
    (appointment) => !upcoming.includes(appointment),
  );
  return (
    <main className="dashboard-content dependents-page">
      <section className="dashboard-section patient-page-section">
        <button className="dependent-back" type="button" onClick={onBack}>
          <ArrowLeft size={15} /> My dependents
        </button>
        <div className="dependent-detail-header">
          <div className="dependent-detail-identity">
            <span className="avatar dependent-card-avatar">
              {initials(dependent)}
            </span>
            <div>
              <p className="dashboard-eyebrow">Dependent profile</p>
              <h1>{name}</h1>
              <p>
                {dependent.relationship || "Family member"} ·{" "}
                {getAge(dependent.dateOfBirth)} · Born{" "}
                {formatDate(dependent.dateOfBirth)}
              </p>
            </div>
          </div>
          <Link
            className="dashboard-primary-button"
            to={`/dashboard/book?dependent=${dependent._id}`}
          >
            <CalendarPlus size={16} /> Book appointment for{" "}
            {dependent.firstName}
          </Link>
        </div>
        <div className="dependent-detail-columns">
          <DetailList
            title="Upcoming appointments"
            appointments={upcoming}
            empty="No upcoming appointments."
          />
          <DetailList
            title="Previous appointments"
            appointments={previous}
            empty="No previous appointments."
          />
          <section className="dependent-history">
            <h2>Session history</h2>
            {sessions.length ? (
              sessions.map((session) => (
                <div className="dependent-history-row" key={session._id}>
                  <strong>{formatDate(session.sessionDate)}</strong>
                  <span>{session.service?.name || "Therapy session"}</span>
                  <small>
                    {session.patientVisibleNotes ||
                      "Session notes are available in your records."}
                  </small>
                </div>
              ))
            ) : (
              <p>No sessions yet.</p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function DetailList({ title, appointments, empty }) {
  return (
    <section className="dependent-history">
      <h2>{title}</h2>
      {appointments.length ? (
        appointments.map((appointment) => (
          <div className="dependent-history-row" key={appointment._id}>
            <strong>{appointmentDate(appointment)}</strong>
            <span>
              {appointmentTime(appointment)} ·{" "}
              {appointment.service?.name || "Therapy"}
            </span>
            <StatusBadge status={appointment.status} />
          </div>
        ))
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

function DependentsSkeleton() {
  return (
    <main className="dashboard-content dependents-page" aria-busy="true">
      <section className="dashboard-section patient-page-section">
        <div className="section-title-row page-header">
          <div className="page-header-copy">
            <Skeleton variant="text" width="130px" height="10px" />
            <Skeleton variant="heading" width="220px" height="36px" />
            <Skeleton variant="text" width="330px" height="14px" />
          </div>
          <Skeleton variant="button" width="145px" height="42px" />
        </div>
        <div className="dependents-grid">
          {[1, 2, 3].map((item) => (
            <Card className="dependent-card-skeleton" key={item}>
              <Skeleton variant="circle" width="44px" height="44px" />
              <Skeleton variant="heading" width="60%" height="20px" />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="button" width="100%" height="36px" />
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

function PageError({ error, retry }) {
  return (
    <main className="dashboard-content">
      <Card className="dependent-error-card">
        <span className="empty-icon">
          <RefreshCw size={22} aria-hidden="true" />
        </span>
        <h1>We couldn’t load your dependents</h1>
        <p>{error}</p>
        <Button type="button" onClick={retry}>
          Try again
        </Button>
      </Card>
    </main>
  );
}

export default DependentsPage;
