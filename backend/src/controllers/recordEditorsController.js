import { recordEditorSchema, recordEditorsParamsSchema } from "../schemas/recordEditorsSchema.js";
import { updateRecordEditors } from "../services/recordEditorsService.js";

export async function recordEditors(req, res) {
  const { kind, id } = recordEditorsParamsSchema.parse(req.params);
  const { sessionId } = recordEditorSchema.parse(req.body);
  const activeEditors = await updateRecordEditors(req.user, kind, id, sessionId, req.method === "DELETE");
  res.json({ activeEditors });
}
