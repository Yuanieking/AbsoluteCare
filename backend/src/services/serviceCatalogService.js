import { Types } from "mongoose";
import Appointment from "../models/appointmentModel.js";
import TherapyService from "../models/therapyServiceModel.js";

export async function listServices() {
  return TherapyService.find().sort({ isActive: -1, name: 1 });
}

export async function findServiceById(id) {
  return TherapyService.findById(id);
}

export async function createService(payload, actorId) {
  return TherapyService.create({
    ...payload,
    auditLog: [{ action: "created", by: new Types.ObjectId(actorId) }],
  });
}

export async function updateService(service, payload, actorId) {
  Object.assign(service, payload);
  service.auditLog.push({
    action: "updated",
    by: new Types.ObjectId(actorId),
  });
  await service.save();
}

export async function removeService(service, actorId) {
  service.isActive = false;
  service.auditLog.push({
    action: "removed",
    by: new Types.ObjectId(actorId),
  });
  await service.save();
}

export async function countServiceUsage(id) {
  // filter is a plain Mongo object; cast at the mongoose boundary
  return Appointment.countDocuments({
    service: id,
  });
}
