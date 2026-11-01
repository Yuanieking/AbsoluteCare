/**
 * Backfills `workingHoursByDay` from the legacy global `workingHours` range.
 *
 * Idempotent: a therapist that already has per-day hours, or has no working
 * days set (unrestricted), is skipped. Safe to re-run.
 *
 *   npm run backfill:working-hours
 *   npm run backfill:working-hours -- --dry-run
 */
import mongoose from "mongoose";
import { MONGO_URI } from "../src/config/env.js";
import User, { type UserDoc } from "../src/models/userModel.js";
import { scheduleOf, summarize } from "../src/services/availabilityService.js";

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  const therapists = (await User.find({
    role: "therapist",
    removedAt: null,
  })) as unknown as UserDoc[];

  let updated = 0;
  let skipped = 0;
  for (const therapist of therapists) {
    const alreadyPerDay = Boolean(therapist.workingHoursByDay?.length);
    if (alreadyPerDay || !therapist.workingDays?.length) {
      skipped += 1;
      continue;
    }
    const days = scheduleOf(therapist);
    console.log(
      `${dryRun ? "[dry-run] " : ""}${therapist.firstname} ${therapist.lastname}: ${days
        .map((day) => `${day.day} ${day.start}-${day.end}`)
        .join(", ")}`,
    );
    if (!dryRun) {
      therapist.workingHoursByDay = days;
      therapist.workingHours = summarize(days);
      await therapist.save();
    }
    updated += 1;
  }
  console.log(
    `${dryRun ? "Would update" : "Updated"} ${updated}, skipped ${skipped}.`,
  );
  await mongoose.disconnect();
}

main().catch(async (error: unknown) => {
  console.error(
    "Backfill failed:",
    error instanceof Error ? error.message : String(error),
  );
  await mongoose.disconnect();
  process.exitCode = 1;
});
