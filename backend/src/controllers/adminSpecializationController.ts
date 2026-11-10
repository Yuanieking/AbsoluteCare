import type { Request, Response } from "express";
import { registerSpecializationsSchema } from "../schemas/specializationSchema.js";
import {
  listSpecializations as listSpecializationNames,
  registerSpecializations as registerSpecializationNames,
} from "../services/specializationService.js";

export async function listSpecializations(
  req: Request,
  res: Response,
): Promise<void> {
  res.json({ specializations: await listSpecializationNames() });
}

export async function registerSpecializations(
  req: Request,
  res: Response,
): Promise<void> {
  const { names } = registerSpecializationsSchema.parse(req.body);
  await registerSpecializationNames(names);
  res.json({ specializations: await listSpecializationNames() });
}
