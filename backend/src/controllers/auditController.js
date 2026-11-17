import { auditIdSchema, auditQuerySchema } from "../schemas/auditSchema.js";
import { exportAudit, getAudit, listAudit } from "../services/auditService.js";

function actor(req) { return { id: req.user.userId, role: req.user.role }; }
export async function listAuditHandler(req, res) {
  res.json(await listAudit(auditQuerySchema.parse(req.query), actor(req)));
}
export async function auditDetailHandler(req, res) {
  res.json({ entry: await getAudit(auditIdSchema.parse(req.params.id), actor(req)) });
}
export async function exportAuditHandler(req, res) {
  const query = auditQuerySchema.parse(req.query);
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="absolutecare-audit.csv"' });
  for await (const chunk of exportAudit(query, actor(req))) {
    if (res.destroyed) break;
    if (!res.write(chunk)) {
      await new Promise((resolve) => { res.once("drain", resolve); res.once("close", resolve); });
    }
  }
  res.end();
}
