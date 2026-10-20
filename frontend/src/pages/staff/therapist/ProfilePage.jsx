import { useEffect, useState } from "react";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import { useAuth } from "../../../context/useAuth";
import {
  getTherapistProfile,
  updateTherapistProfile,
} from "../../../services/api/therapistApi";
import { showPromise } from "../../../utils/toast";
import { sanitizePhone } from "../../../utils/validators";
import { StaffPageSkeleton } from "../../../components/loading/PageSkeleton";

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const { setUser } = useAuth();
  useEffect(() => {
    getTherapistProfile()
      .then((response) => setProfile(response.data.profile))
      .catch(() => undefined);
  }, []);
  if (!profile) return <StaffPageSkeleton variant="cards" />;
  async function save(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const request = updateTherapistProfile(data);
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
  const specialization = Array.isArray(profile.specialization)
    ? profile.specialization
    : [profile.specialization].filter(Boolean);
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow="Account"
          title="Profile"
          description="Your professional identity and personal contact details."
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
          <form className="therapist-profile-form" onSubmit={save}>
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
              Address
              <input name="address" defaultValue={profile.address} />
            </label>
            <label>
              Profile photo URL
              <input
                name="profilePicture"
                type="url"
                defaultValue={profile.profilePicture}
              />
            </label>
            <div className="therapist-modal-actions">
              <button type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="staff-section-primary" type="submit">
                Save changes
              </button>
            </div>
          </form>
        ) : (
          <div className="therapist-profile-grid">
            <div>
              <span>Photo</span>
              {profile.profilePicture ? (
                <img
                  className="therapist-profile-photo"
                  src={profile.profilePicture}
                  alt={`${profile.firstname} ${profile.lastname}`}
                />
              ) : (
                <small>No profile photo added</small>
              )}
            </div>
            <div>
              <span>Name</span>
              <strong>
                {profile.firstname} {profile.lastname}
              </strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profile.email}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{profile.phone || "Not added"}</strong>
            </div>
            <div>
              <span>Specialization</span>
              <div className="tag-list">
                {specialization.length ? (
                  specialization.map((item) => <span key={item}>{item}</span>)
                ) : (
                  <small>Not set</small>
                )}
              </div>
              <small>
                Specialization is managed by the clinic administrator.
              </small>
            </div>
            <div>
              <span>Availability</span>
              <strong>{profile.workingDays?.join(", ") || "Not set"}</strong>
              <small>
                {profile.workingHours?.start} - {profile.workingHours?.end}
              </small>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
export default ProfilePage;
