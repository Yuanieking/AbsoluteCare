import mongoose from "mongoose";
import { MONGO_URI } from "../src/config/env.js";
await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db!;
const dates = await db.collection("appointments").aggregate([
  { $match: { scheduledStart: { $ne: null } } },
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledStart" } }, count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]).toArray();
console.log(JSON.stringify(dates, null, 2));
const created = await db.collection("users").aggregate([
  { $match: { role: "user", removedAt: null } },
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]).toArray();
console.log("patients created", JSON.stringify(created, null, 2));
await mongoose.disconnect();