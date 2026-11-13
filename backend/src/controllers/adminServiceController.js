import {
  countServiceUsage,
  createService as createServiceRecord,
  findServiceById,
  listServices as listServiceRecords,
  removeService as removeServiceRecord,
  updateService as updateServiceRecord,
} from "../services/serviceCatalogService.js";
import { guardFresh } from "../services/concurrencyService.js";

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
  ); // values are narrowed to the payload shape above
}

function validatePayload(payload) {
  if (!payload.name?.trim()) return "Service name is required.";
  if (
    payload.duration === undefined ||
    !Number.isFinite(payload.duration) ||
    payload.duration <= 0
  )
    return "Duration must be greater than zero.";
  if (
    payload.fee === undefined ||
    !Number.isFinite(payload.fee) ||
    payload.fee < 0
  )
    return "Fee must be zero or greater.";
  return null;
}

export async function listServices(req, res) {
  const services = await listServiceRecords();
  res.json({ services });
}

export async function createService(req, res) {
  const payload = servicePayload(req.body);
  const error = validatePayload(payload);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }
  const service = await createServiceRecord(payload, req.user.userId);
  res.status(201).json({ service, message: "Therapy service added." });
}

export async function updateService(req, res) {
  const service = await findServiceById(String(req.params.id));
  if (!service) {
    res.status(404).json({ message: "Therapy service not found." });
    return;
  }
  // ** Concurrency: reject if the service changed since the client read it.
  guardFresh(service, req.get("If-Match"));
  const payload = servicePayload(req.body);
  const error = validatePayload({ ...service.toObject(), ...payload });
  if (error) {
    res.status(400).json({ message: error });
    return;
  }
  await updateServiceRecord(service, payload, req.user.userId);
  res.json({ service, message: "Therapy service updated." });
}

export async function removeService(req, res) {
  const service = await findServiceById(String(req.params.id));
  if (!service) {
    res.status(404).json({ message: "Therapy service not found." });
    return;
  }
  // ** Concurrency: reject if the service changed since the client read it.
  guardFresh(service, req.get("If-Match"));
  await removeServiceRecord(service, req.user.userId);
  res.json({
    service,
    message: "Therapy service removed from new bookings.",
  });
}

export async function getServiceUsage(req, res) {
  const count = await countServiceUsage(String(req.params.id));
  res.json({ count });
}
