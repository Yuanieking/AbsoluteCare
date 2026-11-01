import mongoose from "mongoose";
import { MONGO_URI } from "../src/config/env.js";
import { getReportData } from "../src/services/adminMonitoringService.js";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log(`db=${mongoose.connection.name}`);
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const { trend, patientCount, unpaid } = await getReportData(from, now);
  console.log(`patients=${patientCount} unpaid=${JSON.stringify(unpaid)}`);
  console.log(`points=${trend.length}`);
  console.log("first:", JSON.stringify(trend[0]));
  console.log("mid:", JSON.stringify(trend[Math.floor(trend.length / 2)]));
  console.log("last:", JSON.stringify(trend.at(-1)));
  console.log(
    "requests distinct:",
    [...new Set(trend.map((p) => p.requests))].join(","),
  );
  console.log(
    "patients distinct:",
    [...new Set(trend.map((p) => p.patients))].join(","),
  );
  console.log(
    "outstanding distinct:",
    [...new Set(trend.map((p) => p.outstanding))].join(","),
  );
  console.log(
    "appointments per day:",
    trend.map((p) => p.appointments).join(","),
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
