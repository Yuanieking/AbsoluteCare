import { z } from "zod";

export const BACKUP_LIMIT = 32 * 1024 * 1024;
const verificationToken = z.string().min(1).max(4096);
export const exportBackupSchema = z.object({ verificationToken }).strict();
export const restoreBackupSchema = z
  .object({
    verificationToken,
    confirmation: z.literal("RESTORE"),
    backup: z.string().min(1).max(BACKUP_LIMIT),
  })
  .strict();

const collectionName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]*$/);
export const backupManifestSchema = z
  .object({
    format: z.literal("absolutecare-backup"),
    version: z.coerce
      .number()
      .int()
      .refine((value) => value === 1),
    createdAt: z.date(),
    collections: z.record(
      collectionName,
      z.array(z.record(z.string(), z.unknown())),
    ),
  })
  .strict()
  .refine((value) => Object.keys(value.collections).length > 0, {
    message: "The backup must contain at least one collection.",
  });
