import Appointment from "../models/appointmentModel.js";
import { notify } from "../services/notificationService.js";

export async function runAppointmentReminderJob() {
  const now = new Date();
  const windows = [
    { hours: 24, field: "reminder24SentAt", label: "tomorrow" },
    { hours: 1, field: "reminder1SentAt", label: "in about an hour" },
  ];
  for (const window of windows) {
    const windowStart = new Date(
      now.getTime() + (window.hours - 0.5) * 60 * 60 * 1000,
    );
    const windowEnd = new Date(
      now.getTime() + (window.hours + 0.5) * 60 * 60 * 1000,
    );
    const candidates = await Appointment.find({
      status: "confirmed",
      scheduledStart: { $gte: windowStart, $lt: windowEnd },
      [window.field]: null,
    }).select("_id patient dependent");
    await Promise.all(
      candidates.map(async (candidate) => {
        const claimed = await Appointment.findOneAndUpdate(
          { _id: candidate._id, [window.field]: null },
          { $set: { [window.field]: new Date(), reminderSentAt: new Date() } },
          { new: true },
        );
        if (!claimed) return;
        await notify({
          user: claimed.patient,
          type: "appointment_reminder",
          title: "Appointment reminder",
          message: `You have an appointment ${window.label}.`,
          appointment: claimed._id,
          dependent: claimed.dependent,
          link: `/dashboard/appointments/${claimed._id}`,
        });
      }),
    );
  }
}
