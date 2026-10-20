import { useEffect, useState } from "react";
import { CalendarPlus, Check, Clock3, UserRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "../../services/api/authApi";
import {
  getDependents,
  getServices,
  requestAppointment,
} from "../../services/api/patientApi";
import { todayInManila } from "../../utils/patientFormatters";
import { getToastError, showPromise } from "../../utils/toast";
import { PageSkeleton } from "../../components/loading/PageSkeleton";

function BookAppointmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [form, setForm] = useState({
    service: "",
    requestedDate: "",
    requestedTime: "",
    dependent: searchParams.get("dependent") || "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getServices(), getDependents()])
      .then(([serviceResponse, dependentResponse]) => {
        setServices(serviceResponse.data?.services || []);
        setDependents(dependentResponse.data?.dependents || []);
      })
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, []);

  function update(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const request = requestAppointment({
      ...form,
      dependent: form.dependent || null,
    });
    showPromise(request, {
      loading: "Submitting your request...",
      success: "Appointment request sent.",
      error: "Couldn't submit your request.",
    });
    try {
      await request;
      navigate("/dashboard/appointments");
    } catch (requestError) {
      setError(getToastError(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageSkeleton variant="cards" />;

  return (
    <main className="dashboard-content">
      <section className="dashboard-section patient-page-section">
        <div className="section-title-row">
          <div>
            <p className="dashboard-eyebrow">Plan your next visit</p>
            <h1>Book an appointment</h1>
          </div>
        </div>
        <form className="patient-booking-form" onSubmit={submit}>
          <fieldset className="booking-service-field profile-field-wide">
            <legend>Choose a therapy service</legend>
            <div className="booking-service-options">
              {services.map((service) => (
                <label
                  className={`booking-service-option${form.service === service._id ? " is-selected" : ""}`}
                  key={service._id}
                >
                  <input
                    name="service"
                    type="radio"
                    value={service._id}
                    checked={form.service === service._id}
                    onChange={update}
                    required
                  />
                  <span className="booking-service-option-copy">
                    <strong>{service.name}</strong>
                    <span>{service.description}</span>
                    <small>
                      {service.duration} minutes
                      {service.fee > 0
                        ? ` · ₱${service.fee}`
                        : " · Clinic fee confirmed after review"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Preferred date
            <input
              name="requestedDate"
              type="date"
              min={todayInManila()}
              value={form.requestedDate}
              onChange={update}
              required
            />
          </label>
          <label>
            Preferred time
            <input
              name="requestedTime"
              type="time"
              value={form.requestedTime}
              onChange={update}
              required
            />
          </label>
          {dependents.length > 0 && (
            <label>
              For whom
              <select name="dependent" value={form.dependent} onChange={update}>
                <option value="">Myself</option>
                {dependents.map((dependent) => (
                  <option key={dependent._id} value={dependent._id}>
                    {dependent.firstName} {dependent.lastName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="profile-field-wide">
            Notes for the care team
            <textarea
              name="notes"
              value={form.notes}
              onChange={update}
              rows="4"
              maxLength="1000"
              placeholder="Anything we should know before your visit?"
            />
          </label>
          {error && (
            <p className="profile-error profile-field-wide" role="alert">
              {error}
            </p>
          )}
          <button
            className="dashboard-primary-button profile-field-wide"
            type="submit"
            disabled={saving}
          >
            {saving ? (
              "Sending request…"
            ) : (
              <>
                <CalendarPlus size={16} /> Request appointment
              </>
            )}
          </button>
        </form>
        <div className="booking-detail-strip">
          <span>
            <Clock3 size={15} /> Choose a preferred time
          </span>
          <span>
            <UserRound size={15} /> We’ll assign your therapist
          </span>
          <span>
            <Check size={15} /> Review before confirmation
          </span>
        </div>
      </section>
    </main>
  );
}

export default BookAppointmentPage;
