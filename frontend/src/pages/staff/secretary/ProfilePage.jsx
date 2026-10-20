import { useEffect, useState } from "react";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import { useAuth } from "../../../context/useAuth";
import {
  getSecretaryProfile,
  updateSecretaryProfile,
} from "../../../services/api/secretaryApi";
import { showPromise } from "../../../utils/toast";
import { sanitizePhone } from "../../../utils/validators";
import { StaffPageSkeleton } from "../../../components/loading/PageSkeleton";

const initials = (profile) =>
  `${profile?.firstname?.[0] || ""}${profile?.lastname?.[0] || ""}`.toUpperCase() ||
  "AC";

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const { setUser } = useAuth();
  useEffect(() => {
    getSecretaryProfile()
      .then((response) => setProfile(response.data.profile))
      .catch(() => undefined);
  }, []);
  if (!profile) return <StaffPageSkeleton variant="cards" />;
  async function save(event) {
    event.preventDefault();
    const request = updateSecretaryProfile(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    showPromise(request, {
      loading: "Saving profile...",
      success: "Profile updated.",
      error: "Couldn't save your profile.",
    });
    try {
      const response = await request;
      setProfile(response.data.profile);
      setUser(response.data.profile);
      setEditing(false);
    } catch {
      return;
    }
  }
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page profile-view-card">
        <StaffPageHeader
          eyebrow="Account"
          title="Profile"
          description="Keep your clinic contact details current."
          action={
            !editing && (
              <button
                className="staff-section-primary"
                type="button"
                onClick={() => setEditing(true)}
              >
                Edit profile
              </button>
            )
          }
        />
        {editing ? (
          <form className="staff-profile-form" onSubmit={save}>
            <div className="profile-picture-control">
              <div className="staff-avatar profile-avatar">
                {initials(profile)}
              </div>
              <label>
                Profile picture URL
                <input
                  name="profilePicture"
                  type="url"
                  defaultValue={profile.profilePicture}
                />
              </label>
            </div>
            <label>
              First name
              <input
                name="firstname"
                defaultValue={profile.firstname}
                required
              />
            </label>
            <label>
              Last name
              <input name="lastname" defaultValue={profile.lastname} required />
            </label>
            <label>
              Phone
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                defaultValue={profile.phone}
                onInput={(event) => {
                  event.currentTarget.value = sanitizePhone(
                    event.currentTarget.value,
                  );
                }}
              />
            </label>
            <label>
              Email
              <input value={profile.email} readOnly />
            </label>
            <div className="profile-edit-actions">
              <button
                className="profile-cancel-button"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button className="staff-section-primary" type="submit">
                Save changes
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-details-layout">
            <div className="profile-details-identity">
              {profile.profilePicture ? (
                <img
                  className="profile-avatar"
                  src={profile.profilePicture}
                  alt={`${profile.firstname} ${profile.lastname}`}
                />
              ) : (
                <div className="staff-avatar profile-avatar">
                  {initials(profile)}
                </div>
              )}
              <strong>
                {profile.firstname} {profile.lastname}
              </strong>
              <span>{profile.email}</span>
            </div>
            <div className="profile-details-grid">
              <div className="profile-detail">
                <span>First name</span>
                <strong>{profile.firstname}</strong>
              </div>
              <div className="profile-detail">
                <span>Last name</span>
                <strong>{profile.lastname}</strong>
              </div>
              <div className="profile-detail">
                <span>Email</span>
                <strong>{profile.email}</strong>
              </div>
              <div className="profile-detail">
                <span>Phone</span>
                <strong>{profile.phone || "Not added"}</strong>
              </div>
              <div className="profile-detail">
                <span>Role</span>
                <strong>
                  <span className="staff-status staff-status-active">
                    Secretary
                  </span>
                </strong>
              </div>
              <div className="profile-detail">
                <span>Account status</span>
                <strong>
                  <span className="staff-status staff-status-active">
                    Active
                  </span>
                </strong>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default ProfilePage;
