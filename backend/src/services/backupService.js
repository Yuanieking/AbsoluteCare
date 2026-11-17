import mongoose from "mongoose";
import { AppError } from "../errors/AppError.js";
import { BACKUP_LIMIT, backupManifestSchema } from "../schemas/backupSchema.js";
import AppSetting from "../models/appSettingModel.js";
import SettingsAuditLog from "../models/settingsAuditLogModel.js";
import SettingsVerification from "../models/settingsVerificationModel.js";
import User from "../models/userModel.js";
import AuditLog from "../models/auditLogModel.js";
import { randomUUID } from "node:crypto";
import { verifySettingsToken } from "./verificationActions.js";

const { EJSON } = mongoose.mongo.BSON;

export class BackupError extends AppError {
  constructor(code, message, status = 400) {
    super(status, { code, message });
  }
}

export async function authorizeBackup(adminId, action, token) {
  const payload = await verifySettingsToken(adminId, action, token);
  if (!payload?.verificationId) {
    throw new BackupError("VERIFICATION_REQUIRED", "Superuser verification is required.", 403);
  }
  // A JWT alone is insufficient: consume its live row atomically to prevent replay.
  const spent = await SettingsVerification.findOneAndUpdate(
    {
      _id: payload.verificationId,
      admin: adminId,
      action,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );
  if (!spent) {
    throw new BackupError("VERIFICATION_REQUIRED", "Request a fresh superuser verification code.", 403);
  }
}

export function serializeBackup(backup) {
  const text = EJSON.stringify(backup, { relaxed: false });
  if (Buffer.byteLength(text, "utf8") > BACKUP_LIMIT) {
    throw new BackupError("BACKUP_TOO_LARGE", "Browser backups are limited to 32 MiB. Use MongoDB Database Tools for this database.", 413);
  }
  return text;
}

export function parseBackup(text) {
  try {
    if (Buffer.byteLength(text, "utf8") > BACKUP_LIMIT) throw new Error();
    const backup = backupManifestSchema.parse(EJSON.parse(text, { relaxed: false }));
    for (const docs of Object.values(backup.collections)) {
      const ids = new Set();
      for (const doc of docs) {
        if (doc._id == null || (typeof doc._id !== "string" && !(doc._id instanceof mongoose.mongo.ObjectId))) {
          throw new Error("Each document needs a string or ObjectId _id.");
        }
        const id = EJSON.stringify(doc._id, { relaxed: false });
        if (ids.has(id)) throw new Error("Duplicate document ID.");
        ids.add(id);
        // Check serializability before opening a destructive transaction.
        mongoose.mongo.BSON.serialize(doc);
      }
    }
    return backup;
  } catch {
    throw new BackupError("INVALID_BACKUP", "Invalid backup format, collection, document, or duplicate ID.");
  }
}

async function collections(db) {
  const entries = await db.listCollections({}, { nameOnly: false }).toArray();
  if (entries.some((entry) => entry.type === "view")) {
    throw new BackupError("UNSUPPORTED_COLLECTION", "Database views require MongoDB Database Tools.", 409);
  }
  const names = entries.map((entry) => entry.name).filter((name) => !name.startsWith("system."));
  if (names.some((name) => !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name))) {
    throw new BackupError("UNSUPPORTED_COLLECTION", "A collection name is not supported by browser backups. Use MongoDB Database Tools.", 409);
  }
  return names.sort();
}

async function atomic(work) {
  const db = mongoose.connection.db;
  if (!db) throw new BackupError("DATABASE_UNAVAILABLE", "Database connection is not ready.", 503);
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") {
    throw new BackupError("TRANSACTIONS_REQUIRED", "Safe backup/restore requires a MongoDB replica set or sharded cluster. No data was changed.", 409);
  }
  const names = await collections(db);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(db, names, session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    });
  } catch (error) {
    if (error instanceof BackupError) throw error;
    // Driver errors can include document values. Never return/log secret-bearing payloads.
    throw new BackupError("BACKUP_FAILED", "The database operation failed; no partial replacement was committed.", 500);
  } finally {
    await session.endSession();
  }
}

async function audit(db, session, adminId, field, count) {
  await db.collection(AuditLog.collection.name).insertOne({
    _id: randomUUID(), at: new Date(), actorId: new mongoose.Types.ObjectId(adminId),
    actorRole: "admin", actorName: "Admin", category: "backup", action: `backup.${field}`,
    resourceType: "Database", resourceId: "clinic", changes: [], result: "success", source: "live",
  }, { session });
  await db.collection(SettingsAuditLog.collection.name).insertOne({
    _id: new mongoose.Types.ObjectId(),
    admin: new mongoose.Types.ObjectId(adminId),
    section: "backup",
    field,
    newValue: { documents: count },
    createdAt: new Date(),
  }, { session });
}

// ponytail: bounded in-memory logical backup (32 MiB); use mongodump beyond this ceiling.
export async function createBackup(adminId) {
  return atomic(async (db, names, session) => {
    const data = {};
    let bytes = 0;
    let count = 0;
    for (const name of names) {
      data[name] = [];
      const cursor = db.collection(name).find({}, { session });
      try {
        for await (const doc of cursor) {
          bytes += Buffer.byteLength(EJSON.stringify(doc, { relaxed: false }), "utf8");
          if (bytes > BACKUP_LIMIT) throw new BackupError("BACKUP_TOO_LARGE", "Use MongoDB Database Tools for databases over 32 MiB.", 413);
          data[name].push(doc);
          count += 1;
        }
      } finally {
        await cursor.close();
      }
    }
    const text = serializeBackup({
      format: "absolutecare-backup", version: 1, createdAt: new Date(), collections: data,
    });
    await audit(db, session, adminId, "export", count);
    return text;
  });
}

export async function restoreBackup(text, adminId) {
  const backup = parseBackup(text);
  const settingsName = AppSetting.collection.name;
  const settings = backup.collections[settingsName];
  const users = backup.collections[User.collection.name];
  if (settings?.length !== 1 || settings[0].key !== "singleton" ||
      !users?.some((user) => user.role === "admin" && user.isActive === true && !user.removedAt)) {
    throw new BackupError("INVALID_BACKUP", "A restore requires singleton settings and at least one active administrator.");
  }
  // Restoring must not silently reopen the clinic while an operator verifies it.
  settings[0].system = { ...settings[0].system, maintenanceMode: true };
  return atomic(async (db, names, session) => {
    const current = await db.collection(settingsName).findOne({ key: "singleton" }, { session });
    if (current?.system?.maintenanceMode !== true) {
      throw new BackupError("MAINTENANCE_REQUIRED", "Enable maintenance mode before restoring.", 409);
    }
    if (Object.keys(backup.collections).some((name) => !names.includes(name))) {
      throw new BackupError("COLLECTION_SETUP_REQUIRED", "Initialize all backup collections and their indexes on the target database before restoring.", 409);
    }
    // Keep indexes/collection options. No drop, no sequential wipe outside a transaction.
    const allNames = [...new Set([...names, ...Object.keys(backup.collections)])];
    // Audit history is append-only, even across recovery to an earlier snapshot.
    for (const name of allNames) {
      if (name !== AuditLog.collection.name) await db.collection(name).deleteMany({}, { session });
    }
    let total = 0;
    for (const [name, docs] of Object.entries(backup.collections)) {
      // Old verification rows must never resurrect a spent authorization token.
      if (name === SettingsVerification.collection.name) continue;
      if (name === AuditLog.collection.name) {
        for (const doc of docs) {
          await db.collection(name).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { session, upsert: true });
        }
        continue;
      }
      for (let start = 0; start < docs.length; start += 500) {
        await db.collection(name).insertMany(docs.slice(start, start + 500), { session, ordered: true });
      }
      total += docs.length;
    }
    await audit(db, session, adminId, "restore", total);
    return { total };
  });
}
