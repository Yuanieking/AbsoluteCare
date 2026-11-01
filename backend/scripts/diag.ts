import mongoose from "mongoose";
import { MONGO_URI } from "../src/config/env.js";

async function main() {
  console.log("MONGO_URI", MONGO_URI);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  console.log("db", db.databaseName);
  const collections = await db.listCollections().toArray();
  console.log("collections", collections.map((c) => c.name));
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(c.name, count);
  }
  // sample appointment statuses
  const appts = db.collection("appointments");
  const byStatus = await appts.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray();
  console.log("appt byStatus", byStatus);
  const sample = await appts.findOne({});
  console.log("sample appointment", JSON.stringify(sample, null, 2)?.slice(0, 1500));
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });