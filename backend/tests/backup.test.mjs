import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import {
  BackupError,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from "../src/services/backupService.js";
import { restoreBackupSchema } from "../src/schemas/backupSchema.js";

const actor = "111111111111111111111111";
const oid = () => new mongoose.Types.ObjectId();
const manifest = (collections) => ({
  format: "absolutecare-backup",
  version: 1,
  createdAt: new Date(),
  collections,
});
const snapshot = () =>
  manifest({
    users: [
      { _id: oid(), role: "admin", isActive: true, password: "bcrypt-hash" },
    ],
    appsettings: [
      { _id: oid(), key: "singleton", system: { maintenanceMode: false } },
    ],
    integrationcredentials: [
      { _id: oid(), valueEncrypted: "encrypted-secret" },
    ],
  });

test("Canonical JSON preserves BSON types and stored secrets", () => {
  const original = snapshot();
  original.collections.users[0].createdAt = new Date(
    "2026-11-17T01:02:03.123Z",
  );
  const parsed = parseBackup(serializeBackup(original));
  assert.equal(
    String(parsed.collections.users[0]._id),
    String(original.collections.users[0]._id),
  );
  assert.equal(
    parsed.collections.users[0].createdAt.getTime(),
    original.collections.users[0].createdAt.getTime(),
  );
  assert.equal(parsed.collections.users[0].password, "bcrypt-hash");
  assert.equal(
    parsed.collections.integrationcredentials[0].valueEncrypted,
    "encrypted-secret",
  );
});

test("Malformed/empty backups, bad documents and duplicate IDs fail before restore", async () => {
  for (const collections of [
    {},
    [],
    { "system.users": [] },
    { $bad: [] },
    { users: [null] },
    { users: [42] },
    { users: [{}] },
    { users: [{ _id: "same" }, { _id: "same" }] },
  ]) {
    assert.throws(
      () => parseBackup(serializeBackup(manifest(collections))),
      BackupError,
    );
  }
  assert.throws(() => parseBackup("not json"), BackupError);
  assert.throws(
    () => parseBackup(serializeBackup({ ...snapshot(), version: 9 })),
    BackupError,
  );
  await assert.rejects(
    restoreBackup(serializeBackup(manifest({ users: [] })), actor),
    BackupError,
  );
  assert.equal(
    restoreBackupSchema.safeParse({
      verificationToken: "token",
      backup: "{}",
      confirmation: "yes",
    }).success,
    false,
  );
});

// Persistence fake implements transaction commit/abort, never connects to clinic data.
async function withDatabase(
  run,
  { standalone = false, failInsert = false } = {},
) {
  const oldDb = mongoose.connection.db;
  const oldSession = mongoose.startSession;
  let state = {
    users: [{ _id: "old-admin", role: "admin", isActive: true }],
    appsettings: [
      { _id: "settings", key: "singleton", system: { maintenanceMode: true } },
    ],
    integrationcredentials: [{ _id: "secret", valueEncrypted: "old-secret" }],
    settingsauditlogs: [],
    settingsverifications: [{ _id: "old-token" }],
    obsolete: [{ _id: "old-data" }],
    auditlogs: [
      {
        _id: "retained-event",
        at: new Date(),
        category: "account",
        action: "User.update",
      },
    ],
  };
  let pending;
  const session = {};
  const db = {
    admin: () => ({
      command: async () => (standalone ? {} : { setName: "test" }),
    }),
    listCollections: () => ({
      toArray: async () =>
        Object.keys(state).map((name) => ({ name, type: "collection" })),
    }),
    collection(name) {
      const checked = (options) => {
        assert.equal(options.session, session);
        return (pending[name] ||= []);
      };
      return {
        find: (_, options) => {
          const rows = [...checked(options)];
          return {
            async *[Symbol.asyncIterator]() {
              yield* rows;
            },
            close: async () => {},
          };
        },
        findOne: async (_, options) => checked(options)[0],
        deleteMany: async (_, options) => {
          checked(options);
          pending[name] = [];
        },
        insertMany: async (rows, options) => {
          if (failInsert && name === "integrationcredentials")
            throw new Error("simulated unique index failure");
          checked(options).push(...rows);
        },
        insertOne: async (row, options) => checked(options).push(row),
        updateOne: async (filter, update, options) => {
          if (!checked(options).some((row) => row._id === filter._id))
            checked(options).push(update.$setOnInsert);
        },
      };
    },
  };
  session.withTransaction = async (work, options) => {
    assert.equal(options.readConcern.level, "snapshot");
    pending = structuredClone(state);
    const value = await work();
    state = pending;
    return value;
  };
  session.endSession = async () => {};
  mongoose.connection.db = db;
  mongoose.startSession = async () => session;
  try {
    await run(() => state);
  } finally {
    mongoose.connection.db = oldDb;
    mongoose.startSession = oldSession;
  }
}

test("Restore commits all collections together, retains maintenance and discards stale authorizations", async () => {
  const data = snapshot();
  data.collections.settingsverifications = [{ _id: "resurrected-token" }];
  data.collections.auditlogs = [
    { _id: "snapshot-event", at: new Date(), action: "Session.update" },
  ];
  await withDatabase(async (state) => {
    const result = await restoreBackup(serializeBackup(data), actor);
    assert.equal(state().users[0].password, "bcrypt-hash");
    assert.equal(
      state().integrationcredentials[0].valueEncrypted,
      "encrypted-secret",
    );
    assert.deepEqual(state().obsolete, []);
    assert.deepEqual(state().settingsverifications, []);
    assert.ok(state().auditlogs.some((row) => row._id === "retained-event"));
    assert.ok(state().auditlogs.some((row) => row._id === "snapshot-event"));
    assert.ok(state().auditlogs.some((row) => row.action === "backup.restore"));
    assert.equal(state().appsettings[0].system.maintenanceMode, true);
    assert.equal(state().settingsauditlogs[0].field, "restore");
    assert.ok(result.total > 0);
  });
});

test("Restore failure rolls back previous deletes and inserts", async () => {
  await withDatabase(
    async (state) => {
      const before = structuredClone(state());
      await assert.rejects(
        restoreBackup(serializeBackup(snapshot()), actor),
        (error) => error.payload?.code === "BACKUP_FAILED",
      );
      assert.deepEqual(state(), before);
    },
    { failInsert: true },
  );
});

test("Disabled maintenance and missing target collections refuse restore without data loss", async () => {
  await withDatabase(async (state) => {
    state().appsettings[0].system.maintenanceMode = false;
    const before = structuredClone(state());
    await assert.rejects(
      restoreBackup(serializeBackup(snapshot()), actor),
      (error) => error.payload?.code === "MAINTENANCE_REQUIRED",
    );
    assert.deepEqual(state(), before);
    state().appsettings[0].system.maintenanceMode = true;
    const backup = snapshot();
    backup.collections.newcollection = [{ _id: "new" }];
    await assert.rejects(
      restoreBackup(serializeBackup(backup), actor),
      (error) => error.payload?.code === "COLLECTION_SETUP_REQUIRED",
    );
    assert.equal(state().users[0]._id, "old-admin");
  });
});

test("Standalone database is refused without deleting data", async () => {
  await withDatabase(
    async (state) => {
      const before = structuredClone(state());
      await assert.rejects(
        restoreBackup(serializeBackup(snapshot()), actor),
        (error) => error.payload?.code === "TRANSACTIONS_REQUIRED",
      );
      assert.deepEqual(state(), before);
    },
    { standalone: true },
  );
});

test("Export reads a snapshot including credential ciphertext and audits without exposing values", async () => {
  await withDatabase(async (state) => {
    const parsed = parseBackup(await createBackup(actor));
    assert.equal(
      parsed.collections.integrationcredentials[0].valueEncrypted,
      "old-secret",
    );
    assert.equal(state().settingsauditlogs[0].field, "export");
    assert.ok(
      !JSON.stringify(state().settingsauditlogs).includes("old-secret"),
    );
  });
});
