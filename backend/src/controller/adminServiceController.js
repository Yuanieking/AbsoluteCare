import Appointment from "../models/appointmentModel.js";
import TherapyService from "../models/therapyServiceModel.js";

const fields = ["name", "description", "duration", "fee", "category"];

function servicePayload(body) {
  return Object.fromEntries(
    fields
      .filter((key) => body[key] !== undefined)
      .map((key) => [
        key,
        key === "name" || key === "description" || key === "category"
          ? String(body[key]).trim()
          : Number(body[key]),
      ]),
  );
}

function validatePayload(payload) {
  if (!payload.name?.trim()) return "Service name is required.";
  if (!Number.isFinite(payload.duration) || payload.duration <= 0)
    return "Duration must be greater than zero.";
  if (!Number.isFinite(payload.fee) || payload.fee < 0)
    return "Fee must be zero or greater.";
  return null;
}

export async function listServices(req, res) {
  const services = await TherapyService.find().sort({ isActive: -1, name: 1 });
  res.json({ services });
}

export async function createService(req, res) {
  const payload = servicePayload(req.body);
  const error = validatePayload(payload);
  if (error) return res.status(400).json({ message: error });
  const service = await TherapyService.create({
    ...payload,
    auditLog: [{ action: "created", by: req.user.userId }],
  });
  res.status(201).json({ service, message: "Therapy service added." });
}

export async function updateService(req, res) {
  const service = await TherapyService.findById(req.params.id);
  if (!service)
    return res.status(404).json({ message: "Therapy service not found." });
  const payload = servicePayload(req.body);
  const error = validatePayload({ ...service.toObject(), ...payload });
  if (error) return res.status(400).json({ message: error });
  Object.assign(service, payload);
  service.auditLog.push({ action: "updated", by: req.user.userId });
  await service.save();
  res.json({ service, message: "Therapy service updated." });
}

export async function removeService(req, res) {
  const service = await TherapyService.findById(req.params.id);
  if (!service)
    return res.status(404).json({ message: "Therapy service not found." });
  service.isActive = false;
  service.auditLog.push({ action: "removed", by: req.user.userId });
  await service.save();
  res.json({ service, message: "Therapy service removed from new bookings." });
}

export async function getServiceUsage(req, res) {
  const count = await Appointment.countDocuments({ service: req.params.id });
  res.json({ count });
}
