import { z } from "zod";

export const recordEditorsParamsSchema = z.object({
  kind: z.enum(["users", "dependents", "appointments", "sessions", "services", "settings"]),
  id: z.string().regex(/^(?:[a-f\d]{24}|singleton)$/i),
});
export const recordEditorSchema = z.object({
  sessionId: z.string().uuid(),
});
