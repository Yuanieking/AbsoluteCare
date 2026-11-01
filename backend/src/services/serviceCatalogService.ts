import { Types, type QueryFilter } from "mongoose";
import Appointment, {
  type Appointment as AppointmentRecord,
} from "../models/appointmentModel.js";
import TherapyService, {
  type TherapyService as TherapyServiceRecord,
  type TherapyServiceDoc,
} from "../models/therapyServiceModel.js";

export type ServicePayload = Partial<
  Pick<
    TherapyServiceRecord,
    "name" | "description" | "duration" | "fee" | "category"
  >
>;

export async function listServices(): Promise<TherapyServiceDoc[]> {
  return TherapyService.find().sort({ isActive: -1, name: 1 });
}

export async function findServiceById(
  id: string,
): Promise<TherapyServiceDoc | null> {
  return TherapyService.findById(id);
}

export async function createService(
  payload: ServicePayload,
  actorId: string,
): Promise<TherapyServiceDoc> {
  return TherapyService.create({
    ...payload,
    auditLog: [{ action: "created", by: new Types.ObjectId(actorId) }],
  });
}

export async function updateService(
  service: TherapyServiceDoc,
  payload: ServicePayload,
  actorId: string,
): Promise<void> {
  Object.assign(service, payload);
  service.auditLog.push({
    action: "updated",
    by: new Types.ObjectId(actorId),
  });
  await service.save();
}

export async function removeService(
  service: TherapyServiceDoc,
  actorId: string,
): Promise<void> {
  service.isActive = false;
  service.auditLog.push({
    action: "removed",
    by: new Types.ObjectId(actorId),
  });
  await service.save();
}

export async function countServiceUsage(id: string): Promise<number> {
  // filter is a plain Mongo object; cast at the mongoose boundary
  return Appointment.countDocuments({
    service: id,
  } as QueryFilter<AppointmentRecord>);
}
