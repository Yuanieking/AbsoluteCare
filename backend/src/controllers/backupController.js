import { exportBackupSchema, restoreBackupSchema } from "../schemas/backupSchema.js";
import { authorizeBackup, createBackup, restoreBackup } from "../services/backupService.js";
import { invalidateSettingsCache } from "../services/settingsService.js";
import { invalidateRuntimeConfigCache } from "../config/runtimeConfig.js";

export async function exportBackup(req, res) {
  const { verificationToken } = exportBackupSchema.parse(req.body);
  await authorizeBackup(req.user.userId, "exportBackup", verificationToken);
  const text = await createBackup(req.user.userId);
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="absolutecare-backup-${date}.json"`,
    "Cache-Control": "no-store",
  });
  res.send(text);
}

export async function importBackup(req, res) {
  const { backup, verificationToken } = restoreBackupSchema.parse(req.body);
  await authorizeBackup(req.user.userId, "restoreBackup", verificationToken);
  const result = await restoreBackup(backup, req.user.userId);
  invalidateSettingsCache();
  await invalidateRuntimeConfigCache();
  res.clearCookie("session", { path: "/" });
  res.set("Cache-Control", "no-store");
  res.json({
    message: "Backup restored. Maintenance mode remains on. Sign in with a restored administrator account to verify the data.",
    ...result,
  });
}
