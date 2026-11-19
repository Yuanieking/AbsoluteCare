import { isAssignedTherapist } from "../services/adminAppointmentService.js";

/**
 * Route param guard: therapists may only act on appointments assigned to them.
 * Anything else answers 404 so other patients' visits are not even confirmed to exist.
 */
export async function therapistOwnsAppointment(req, res, next, id) {
  try {
    if (
      req.user?.role === "therapist" &&
      !(await isAssignedTherapist(id, req.user.userId))
    ) {
      res.status(404).json({ message: "Appointment not found." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
