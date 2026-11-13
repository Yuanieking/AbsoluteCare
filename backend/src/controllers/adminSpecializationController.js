import { registerSpecializationsSchema } from "../schemas/specializationSchema.js";
import {
  listSpecializations as listSpecializationNames,
  registerSpecializations as registerSpecializationNames,
} from "../services/specializationService.js";

export async function listSpecializations(req, res) {
  res.json({ specializations: await listSpecializationNames() });
}

export async function registerSpecializations(req, res) {
  const { names } = registerSpecializationsSchema.parse(req.body);
  await registerSpecializationNames(names);
  res.json({ specializations: await listSpecializationNames() });
}
