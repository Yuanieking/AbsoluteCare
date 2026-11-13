import Specialization from "../models/specializationModel.js";
import User from "../models/userModel.js";

const keyOf = (name) => name.trim().toLowerCase();

/**
 * Every specialization an admin can pick: the saved catalog plus any value
 * already assigned to a therapist (covers records created before the catalog).
 */
export async function listSpecializations() {
  const [saved, assigned] = await Promise.all([
    Specialization.find().sort({ name: 1 }).lean(),
    User.distinct("specialization", { role: "therapist" }),
  ]);
  const byKey = new Map();
  for (const name of [
    ...saved.map((item) => item.name),
    ...assigned.filter((item) => typeof item === "string"),
  ]) {
    const key = keyOf(name);
    if (key && !byKey.has(key)) byKey.set(key, name.trim());
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/** Idempotent: names already in the catalog (case-insensitive) are left as is. */
export async function registerSpecializations(names) {
  const operations = names
    .map((name) => ({ name: name.trim(), nameKey: keyOf(name) }))
    .filter((item) => item.nameKey)
    .map(({ name, nameKey }) => ({
      updateOne: {
        filter: { nameKey },
        update: { $setOnInsert: { name, nameKey } },
        upsert: true,
      },
    }));
  if (operations.length) await Specialization.bulkWrite(operations);
}
