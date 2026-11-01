import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MONGO_URI, JWT_SECRET } from "../src/config/env.js";
import { jwtOptions } from "../src/config/jwtOptions.js";

await mongoose.connect(MONGO_URI);
const user = await mongoose.connection.db!.collection("users").findOne({ email: "admin@absolutecare.test" });
await mongoose.disconnect();
if (!user) { console.error("no user"); process.exit(1); }
const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, jwtOptions);

const base = "http://localhost:8080";
const headers = { Cookie: `session=${token}` };
const r = await fetch(`${base}/admin/reports?from=2026-10-01T00:00:00.000Z&to=2026-11-30T23:59:59.999Z`, { headers });
console.log("reports status", r.status);
const rj = await r.json();
console.log(JSON.stringify(rj, null, 2).slice(0, 4000));