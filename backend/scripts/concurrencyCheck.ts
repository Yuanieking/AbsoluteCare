// ** Self-check for timestamp concurrency control (If-Match on updatedAt).
// ** Run: npm run build && npx tsx scripts/concurrencyCheck.ts
// ** Uses the configured MongoDB, a throwaway therapy service, and the compiled server.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { FRONTEND_URL, JWT_SECRET, MONGO_URI } from "../src/config/env.js";
import TherapyService from "../src/models/therapyServiceModel.js";
import User from "../src/models/userModel.js";
import {
  assertNotStale,
  freshFilter,
  guardFresh,
} from "../src/services/concurrencyService.js";

const port = 18080 + Math.floor(Math.random() * 1000);
const base = `http://localhost:${port}`;
const stale = '"2000-01-01T00:00:00.000Z"';

await mongoose.connect(MONGO_URI);
const admin = await User.findOne({
  role: "admin",
  isActive: true,
  isArchived: { $ne: true },
  removedAt: null,
  mustChangePassword: { $ne: true },
});
assert.ok(admin, "Need one active admin in the database (npm run seed).");
const cookie = `session=${jwt.sign({ userId: String(admin._id) }, JWT_SECRET)}`;
const service = await TherapyService.create({
  name: "Concurrency check (temporary)",
  duration: 30,
  fee: 0,
  isActive: false,
});
const server = spawn(process.execPath, ["dist/src/app.js"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  // ** 1. Document-level compare-and-swap: two writers read the same version.
  const first = await TherapyService.findById(service._id);
  const second = await TherapyService.findById(service._id);
  const seen = `"${service.updatedAt.toISOString()}"`;
  guardFresh(first!, seen);
  guardFresh(second!, seen);
  first!.fee = 1;
  await first!.save();
  second!.fee = 2;
  await assert.rejects(second!.save(), { name: "DocumentNotFoundError" });
  first!.fee = 3;
  await first!.save(); // pin cleared after our own save: follow-up save still works
  assert.throws(() => guardFresh(second!, seen), /changed by someone else/);
  console.log(
    "PASS guardFresh: second writer rejected, own follow-up save allowed",
  );

  // ** 2. Atomic single-statement writes.
  const missed = await TherapyService.findOneAndUpdate(
    { _id: service._id, ...freshFilter(stale) },
    { fee: 9 },
  );
  assert.equal(missed, null);
  await assert.rejects(
    assertNotStale(stale, () => TherapyService.exists({ _id: service._id })),
    /changed by someone else/,
  );
  console.log("PASS freshFilter/assertNotStale: stale atomic write -> 409");

  // ** 3. Real HTTP through the compiled server.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("server did not start")),
      20_000,
    );
    server.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Server Running")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", (code) => reject(new Error(`server exited ${code}`)));
  });
  // "Server Running" prints before MongoDB connects; wait until auth lookups succeed.
  for (let attempt = 0; ; attempt++) {
    const ready = await fetch(`${base}/admin/services`, {
      headers: { cookie },
    });
    if (ready.ok) break;
    if (attempt > 30) throw new Error(`server not ready: ${ready.status}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const patch = (ifMatch?: string, method = "PATCH") =>
    fetch(`${base}/admin/services/${service._id}`, {
      method,
      headers: {
        cookie,
        "content-type": "application/json",
        ...(ifMatch ? { "if-match": ifMatch } : {}),
      },
      body: JSON.stringify({ fee: 5 }),
    });

  const preflight = await fetch(`${base}/admin/services/${service._id}`, {
    method: "OPTIONS",
    headers: {
      origin: FRONTEND_URL.split(",")[0]!.trim(),
      "access-control-request-method": "PATCH",
      "access-control-request-headers": "if-match,content-type",
    },
  });
  assert.match(
    preflight.headers.get("access-control-allow-headers") ?? "",
    /If-Match/i,
  );
  console.log("PASS CORS preflight allows If-Match");

  const rejected = await patch(stale);
  assert.equal(rejected.status, 409);
  assert.equal(
    ((await rejected.json()) as { code: string }).code,
    "STALE_RECORD",
  );
  console.log("PASS PATCH stale If-Match -> 409 STALE_RECORD");

  const current = await TherapyService.findById(service._id).lean();
  const okResponse = await patch(`"${current!.updatedAt.toISOString()}"`);
  assert.equal(okResponse.status, 200);
  console.log("PASS PATCH current If-Match -> 200");

  const replay = await patch(`"${current!.updatedAt.toISOString()}"`);
  assert.equal(replay.status, 409);
  console.log("PASS replaying the old timestamp -> 409");

  assert.equal((await patch()).status, 200);
  console.log("PASS PATCH without If-Match -> 200 (opt-in)");

  assert.equal((await patch('"not-a-date"')).status, 400);
  console.log("PASS malformed If-Match -> 400");

  assert.equal((await patch(stale, "DELETE")).status, 409);
  console.log("PASS DELETE stale If-Match -> 409");
} finally {
  server.kill();
  await TherapyService.deleteOne({ _id: service._id });
  await mongoose.disconnect();
}
console.log("All concurrency checks passed.");
