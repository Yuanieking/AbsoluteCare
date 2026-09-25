import { useEffect, useState } from "react";
import { Camera, Edit3, Save, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { getApiErrorMessage } from "../../services/api/authApi";
import { updatePatientProfile } from "../../services/api/patientApi";
import { useAuth } from "../../context/useAuth";
import { showPromise } from "../../utils/toast";
import {
  isValidPhone,
  normalizePhone,
  PHONE_ERROR,
  sanitizePhone,
} from "../../utils/validators";

const emptyProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  address: "",
  profilePicture: "",
};

function toFormProfile(profile) {
  return {
    ...emptyProfile,
    ...profile,
    firstName: profile?.firstName || profile?.firstname || "",
    lastName: profile?.lastName || profile?.lastname || "",
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
  };
}

function getTodayInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function formatDateOfBirth(value) {
  if (!value) return "Not provided";

  const match = String(value)
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "Not provided";

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(date.getTime())) return "Not provided";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function ProfilePage() {
  const { profile } = useOutletContext();
  const { setUser } = useAuth();
  const [form, setForm] = useState(emptyProfile);
  const [savedProfile, setSavedProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const displayProfile = savedProfile || profile;
  const displayForm = toFormProfile(displayProfile);

  const initialsSource = editing ? form : displayForm;
  const initials =
    `${initialsSource.firstName[0] || ""}${initialsSource.lastName[0] || ""}`.toUpperCase() ||
    "AC";
  const isGoogleAccount = displayProfile?.authProvider === "google";
  const hasChanges =
    editing && JSON.stringify(form) !== JSON.stringify(displayForm);

  useEffect(() => {
    function warnBeforeLeave(event) {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [hasChanges]);

  function updateField(event) {
    const { name, value } = event.target;
    setErrors((current) => ({ ...current, [name]: "", form: "" }));
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEditing() {
    setForm(displayForm);
    setErrors({});
    setEditing(true);
  }

  function cancelEditing() {
    if (
      hasChanges &&
      !window.confirm("Discard your unsaved profile changes?")
    ) {
      return;
    }
    setForm(displayForm);
    setErrors({});
    setEditing(false);
  }

  function handlePicture(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setErrors({ form: "Choose an image file smaller than 2 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setForm((current) => ({ ...current, profilePicture: reader.result }));
    reader.readAsDataURL(file);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.firstName.trim())
      nextErrors.firstName = "First name is required.";
    if (!form.lastName.trim()) nextErrors.lastName = "Last name is required.";
    if (form.phone && !isValidPhone(form.phone)) {
      nextErrors.phone = PHONE_ERROR;
    }
    if (form.dateOfBirth && form.dateOfBirth > getTodayInputValue()) {
      nextErrors.dateOfBirth = "Date of birth cannot be in the future.";
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    const request = updatePatientProfile({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: normalizePhone(form.phone.trim()),
      dateOfBirth: form.dateOfBirth || null,
      address: form.address.trim(),
      profilePicture: form.profilePicture,
    });
    showPromise(request, {
      loading: "Saving profile...",
      success: "Profile updated.",
      error: "Couldn't save your profile.",
    });
    try {
      const response = await request;
      const updatedUser = response.data?.user || response.data;
      setUser(updatedUser);
      setSavedProfile(updatedUser);
      setForm(toFormProfile(updatedUser));
      setEditing(false);
    } catch (error) {
      const backendErrors = error.response?.data?.errors;
      const fieldErrors = Array.isArray(backendErrors)
        ? backendErrors.reduce((result, issue) => {
            const field = issue.path?.[0];
            if (field) result[field] = issue.message;
            return result;
          }, {})
        : {};

      setErrors({
        ...fieldErrors,
        form: Object.keys(fieldErrors).length
          ? "Please correct the highlighted profile fields."
          : getApiErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dashboard-content">
      <section className="dashboard-section profile-view-card">
        <div className="profile-card-header">
          <div>
            <p className="dashboard-eyebrow">Your account</p>
            <h1>Profile</h1>
            {displayProfile?.isGuardian && (
              <span className="staff-status staff-status-active">Guardian</span>
            )}
          </div>
          {!editing && (
            <button
              className="dashboard-primary-button"
              type="button"
              onClick={startEditing}
            >
              <Edit3 size={16} /> Edit profile
            </button>
          )}
        </div>
        {editing ? (
          <form className="patient-profile-form" onSubmit={saveProfile}>
            <ProfilePicture
              form={form}
              initials={initials}
              onChange={handlePicture}
            />
            <EditableField
              name="firstName"
              label="First name"
              value={form.firstName}
              error={errors.firstName}
              onChange={updateField}
            />
            <EditableField
              name="lastName"
              label="Last name"
              value={form.lastName}
              error={errors.lastName}
              onChange={updateField}
            />
            <EditableField
              name="phone"
              label="Phone"
              value={form.phone}
              inputMode="numeric"
              type="tel"
              onInput={(event) => {
                event.currentTarget.value = sanitizePhone(
                  event.currentTarget.value,
                );
              }}
              error={errors.phone}
              onChange={updateField}
              placeholder="Not provided"
            />
            <EditableField
              name="dateOfBirth"
              label="Date of birth"
              value={form.dateOfBirth}
              type="date"
              min="1900-01-01"
              max={getTodayInputValue()}
              onChange={updateField}
              error={errors.dateOfBirth}
            />
            <EditableField
              name="address"
              label="Address"
              value={form.address}
              onChange={updateField}
              placeholder="Not provided"
              wide
            />
            <ReadOnlyField
              label="Email"
              value={form.email}
              note={
                isGoogleAccount
                  ? "Managed by Google"
                  : "Email changes require verification."
              }
            />
            {errors.form && (
              <p className="profile-error profile-field-wide" role="alert">
                {errors.form}
              </p>
            )}
            <div className="profile-edit-actions">
              <button
                className="profile-cancel-button"
                type="button"
                onClick={cancelEditing}
                disabled={saving}
              >
                <X size={16} /> Cancel
              </button>
              <button
                className="dashboard-primary-button"
                type="submit"
                disabled={saving}
              >
                <Save size={16} />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <ProfileDetails form={displayForm} initials={initials} />
        )}
      </section>
    </main>
  );
}

function ProfilePicture({ form, initials, onChange }) {
  return (
    <div className="profile-picture-control">
      {form.profilePicture ? (
        <img
          className="profile-avatar"
          src={form.profilePicture}
          alt="Profile"
        />
      ) : (
        <span className="avatar profile-avatar">{initials}</span>
      )}
      <label className="profile-picture-button">
        <Camera size={15} /> Change picture
        <input type="file" accept="image/*" onChange={onChange} />
      </label>
    </div>
  );
}

function EditableField({
  name,
  label,
  value,
  error,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  wide,
}) {
  return (
    <label className={wide ? "profile-field-wide" : ""}>
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        className={type === "date" && !value ? "profile-date-input-empty" : ""}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="profile-inline-error">{error}</span>}
    </label>
  );
}

function ReadOnlyField({ label, value, note }) {
  return (
    <div className="profile-detail">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function ProfileDetails({ form, initials }) {
  return (
    <div className="profile-details-layout">
      <div className="profile-details-identity">
        {form.profilePicture ? (
          <img
            className="profile-avatar"
            src={form.profilePicture}
            alt="Profile"
          />
        ) : (
          <span className="avatar profile-avatar">{initials}</span>
        )}
        <strong>
          {form.firstName || "Patient"} {form.lastName}
        </strong>
        <span>{form.email || "Not provided"}</span>
      </div>
      <div className="profile-details-grid">
        <ReadOnlyField label="First name" value={form.firstName} />
        <ReadOnlyField label="Last name" value={form.lastName} />
        <ReadOnlyField label="Phone" value={form.phone} />
        <ReadOnlyField
          label="Date of birth"
          value={formatDateOfBirth(form.dateOfBirth)}
        />
        <ReadOnlyField label="Address" value={form.address} />
        <ReadOnlyField label="Email" value={form.email} />
        {form.createdAt && (
          <ReadOnlyField
            label="Account created"
            value={new Date(form.createdAt).toLocaleDateString()}
          />
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
