import type { QueryFilter } from "mongoose";
import Appointment, {
  type Appointment as AppointmentData,
} from "../models/appointmentModel.js";
import { notify } from "../services/notificationService.js";
import { getSettings } from "../services/settingsService.js";

export async function runAppointmentReminderJob(): Promise<void> {
  const { notifications } = await getSettings();
  if (notifications?.remindersEnabled === false) return;
  const leadHours = [
    ...new Set(
      (notifications?.reminderLeadHours?.length
        ? notifications.reminderLeadHours
        : [24, 1]
      ).filter((hours) => Number.isFinite(hours) && hours > 0),
    ),
  ];
  const now = new Date();
  for (const hours of leadHours) {
    const windowStart = new Date(
      now.getTime() + (hours - 0.5) * 60 * 60 * 1000,
    );
    const windowEnd = new Date(now.getTime() + (hours + 0.5) * 60 * 60 * 1000);
    const candidateFilter = {
      status: "confirmed",
      scheduledStart: { $gte: windowStart, $lt: windowEnd },
      remindersSentHours: { $ne: hours },
    } as QueryFilter<AppointmentData>;
    const candidates = await Appointment.find(candidateFilter).select(
      "_id patient dependent",
    );
    await Promise.all(
      candidates.map(async (candidate) => {
        // Claim the window before sending so a second job run cannot repeat it.
        const claimed = await Appointment.findOneAndUpdate(
          {
            _id: candidate._id,
            remindersSentHours: { $ne: hours },
          } as QueryFilter<AppointmentData>,
          {
            $addToSet: { remindersSentHours: hours },
            $set: { reminderSentAt: new Date() },
          },
          // ** Concurrency: background bookkeeping must not bump updatedAt, or an
          // ** admin's pending If-Match edit would be rejected as stale.
          { new: true, timestamps: false },
        );
        if (!claimed) return;
        const label =
          hours === 24
            ? "tomorrow"
            : hours === 1
              ? "in about an hour"
              : `in about ${hours} hours`;
        await notify({
          user: claimed.patient,
          type: "appointment_reminder",
          title: "Appointment reminder",
          message: `You have an appointment ${label}.`,
          appointment: claimed._id,
          dependent: claimed.dependent,
          link: `/dashboard/appointments/${claimed._id}`,
        });
      }),
    );
  }
}
