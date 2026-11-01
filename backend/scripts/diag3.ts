import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MONGO_URI, JWT_SECRET } from "../src/config/env.js";
import { jwtOptions } from "../src/config/jwtOptions.js";

await mongoose.connect(MONGO_URI);
const user = await mongoose.connection.db!.collection("users").findOne({ email: "admin@absolutecare.test" });
await mongoose.disconnect();
const token = jwt.sign({ userId: user!._id.toString() }, JWT_SECRET, jwtOptions);

const base = "http://localhost:8080";
const headers = { Cookie: `session=${token}` };
for (const path of [
  "/admin/appointments?tab=pending&page=1&limit=5",
  "/admin/appointments?tab=upcoming&page=1&limit=8",
  "/admin/reports?from=2026-11-01T00:00:00.000Z&to=2026-11-01T23:59:59.999Z",
]) {
  const r = await fetch(base + path, { headers });
  const j = await r.json();
  console.log(path, r.status, JSON.stringify(j).slice(0, 300));
}