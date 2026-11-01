/**
 * Seed entry point.
 *
 * Configuration comes from `backend/.env` (loaded by `src/config/env.ts`), not
 * from flags or a second copy of the config, so the API and the seed always
 * target the same database:
 *   MONGO_URI       where the fixtures are written
 *   SEED_PASSWORD   the password every seeded demo account gets
 *
 * All arguments are forwarded to `scripts/seed.ts`, which does the actual work:
 *   npm run seed                     seed demo data (idempotent, safe to re-run)
 *   npm run seed -- --minimal        smaller fixture set
 *   npm run seed -- --count-patients=20
 *   npm run seed:reset               remove seed-owned records, then re-seed
 *   npm run seed:reset -- --yes      same, without the interactive prompt
 *
 * Run from `backend/`, or from the repository root with `npm run seed`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { ENV_PATH, PACKAGE_ROOT } from "./src/config/paths.js";

const USAGE = `Seed AbsoluteCare's MongoDB database from backend/.env.

  npm run seed                       seed demo data (idempotent, safe to re-run)
  npm run seed -- --minimal          smaller fixture set
  npm run seed -- --count-patients=N 12-20 patients (3+ with --minimal)
  npm run seed:reset                 remove seed-owned records, then re-seed
  npm run seed:reset -- --yes        same, without the interactive prompt

Required in backend/.env:
  MONGO_URI       connection string including the database name
  SEED_PASSWORD   password for every seeded demo account

New machine / new cluster checklist:
  1. cp .env.example .env            (from backend/)
  2. npm install && npm install --prefix backend
  3. Allow your current IP in Atlas > Network Access
  4. npm run seed

Seeded logins are printed at the end of a successful run.`;

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

function fail(headline: string, details: string[]): never {
  console.error(`\nSeed cannot start: ${headline}\n`);
  for (const line of details) console.error(`  ${line}`);
  console.error("");
  process.exit(1);
}

/** Database name from a mongodb:// or mongodb+srv:// URI ("" when absent). */
function databaseName(uri: string): string {
  const scheme = /^mongodb(\+srv)?:\/\//i.exec(uri);
  if (!scheme) return "";
  const rest = uri.slice(scheme[0].length);
  const address = rest.split(/[?#]/)[0] ?? "";
  const slash = address.indexOf("/");
  return slash === -1 ? "" : address.slice(slash + 1);
}

/** Host and database only, so credentials never reach the terminal. */
function describeTarget(uri: string): string {
  const database = databaseName(uri) || "(no database)";
  try {
    return `${new URL(uri).host}/${database}`;
  } catch {
    return database;
  }
}

if (
  !existsSync(
    path.join(PACKAGE_ROOT, "node_modules", "mongoose", "package.json"),
  )
) {
  fail("dependencies are not installed.", [
    "Install them first:",
    "  npm install",
    "  (or `npm install --prefix backend` from the repository root)",
  ]);
}

// Loads backend/.env through dotenv; shell variables still win.
const { MONGO_URI } = await import("./src/config/env.js");

if (!existsSync(ENV_PATH) && !process.env.MONGO_URI) {
  fail("backend/.env was not found.", [
    "backend/.env is the source of MONGO_URI and SEED_PASSWORD.",
    "Create it from the template:",
    "  cp .env.example .env        (from backend/)",
    "Then set MONGO_URI and SEED_PASSWORD.",
  ]);
}

const database = databaseName(MONGO_URI);

if (!database) {
  fail("MONGO_URI has no database name.", [
    "The API and the seed must target the same database, so name it explicitly:",
    "  MONGO_URI=mongodb+srv://user:pass@host/absolutecare?retryWrites=true",
    "",
    `Currently pointing at: ${describeTarget(MONGO_URI)}`,
  ]);
}

if (process.env.NODE_ENV === "production") {
  fail("NODE_ENV is production.", [
    "Seeding production is refused. Run with a development/test database.",
  ]);
}

if (!(process.env.SEED_PASSWORD ?? "").trim()) {
  fail("SEED_PASSWORD is not set in backend/.env.", [
    "It becomes the password for every seeded demo account.",
    "Add it to backend/.env:",
    "  SEED_PASSWORD=choose-a-password",
  ]);
}

console.log(
  `Seeding ${describeTarget(MONGO_URI)}${args.includes("--reset") ? " (reset first)" : ""} ...`,
);

await import("./scripts/seed.js");
