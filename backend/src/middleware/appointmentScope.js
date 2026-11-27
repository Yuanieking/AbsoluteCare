import { isAssignedTherapist } from "../services/adminAppointmentService.js";

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
