# Ponytail Audit — AbsoluteCare

Whole-repo over-engineering scan (`ponytail-audit`), 2026-10-30. Ranked biggest cut
first. Scope is complexity only: correctness, security and performance findings are
deliberately out of scope.

Tags: `delete:` / `stdlib:` / `native:` / `yagni:` / `shrink:`

---

## Findings

`delete:` The vendored bklit sparkline (1097) plus its geometry module (312) are reached only by the dev gallery's `BarSparkline`. Replace with nothing; keep the gallery's other entries. [frontend/src/components/charts/sparkline.tsx, sparkline-geometry.ts, frontend/src/features/dev/ComponentGallery.tsx]

`delete:` Twelve shadcn primitives with zero importers — avatar, breadcrumb, calendar, card, pagination, progress, radio-group, scroll-area, separator, slider, tabs, tooltip (888 lines). Replace with nothing; `npx shadcn add` restores any on demand. [frontend/src/components/ui/]

`delete:` `lib/api/therapist.ts` (57) re-declares the 12-function client that already exists in `features/therapist/api.ts`; only `getTherapistAppointments` is used, once. Delete the file, import from the feature client. [frontend/src/lib/api/therapist.ts]

`delete:` `lib/api/settings.ts` (55) duplicates `features/admin/settings/api.ts`; only `getPublicSettings` has a caller, the other 18 exports are dead or shadowed. Keep one function, move it to `features/settings/`. [frontend/src/lib/api/settings.ts]

`delete:` `shimmering-text.tsx` (91) has zero importers. [frontend/src/components/shimmering-text.tsx]

`delete:` `y-axis-ticks.ts` (26) has zero importers, internal or external. [frontend/src/components/charts/y-axis-ticks.ts]

`delete:` Rate limiter in `providerValidation` — `attempts` map, `validationAttemptAllowed`, `recordValidationAttempt`, `ATTEMPT_WINDOW_MS`, `MAX_ATTEMPTS` — has zero callers. [backend/src/services/providerValidation.ts:6-47]

`yagni:` `envWriter` takes a lock file, retries, and prunes 5 backups before writing, while `isPrimaryInstance()` already guarantees a single writer. Drop the lock and the backup ring; one `writeFile` + one `.bak` is enough. [backend/src/services/envWriter.ts:13-131]

`yagni:` `envWriter` builds `GROUP_TITLES`, `KEY_GROUP` and `GROUP_ORDER` at module load from the same registry it already imports. Derive them at the three call sites instead. [backend/src/services/envWriter.ts:20-26]

`shrink:` `calendarService` hand-rolls `encryptionKey`/`encrypt`/`decrypt` in the exact `iv:tag:data` AES-GCM format `utils/secretBox.ts` already ships, then re-exports `encrypt` that nobody imports. Import `encryptSecret`/`decryptSecret`. [backend/src/services/calendarService.ts:19-56,355]

`yagni:` `mailer` sha256-hashes the mail config on every send just to decide whether to rebuild a transport from fields it already reads cheaply. Compare the config fields, or just build the transport. [backend/src/services/mailer.ts:191-215]

`native:` `sendEmail` wraps `transport.sendMail` in `Promise.race` with a manual 10s rejection, while nodemailer already runs on `connectionTimeout`/`greetingTimeout`/`socketTimeout` set to the same value. [backend/src/services/mailer.ts:246-266]

`yagni:` `verifyTransport` only calls `verifyMailer()` and re-reads module state; `passwordResetEmail` only forwards to a template function. Call the callees directly. [backend/src/services/mailer.ts:295-328]

`shrink:` `getEnv(key, defaultValue)` takes a required string default, so its `if (value === undefined) throw` branch is unreachable. Drop the branch. [backend/src/config/env.ts:6-14]

`delete:` `SRC_DIR` is exported and used nowhere, and its comment already contradicts its value under `dist/`. [backend/src/config/paths.ts:21]

`shrink:` `features/secretary/format.ts` re-implements Manila day keys, date/time formatting and a six-month bucketing loop that `lib/format/patient.ts` already provides, and rebuilds an `Intl.DateTimeFormat` on every call. Hoist the formatters, reuse the shared helpers. [frontend/src/features/secretary/format.ts]

`stdlib:` `lib/utils.ts` hand-rolls `twMerge(clsx(inputs))` while the `cn` package — already imported by 29 UI files — ships that exact function. Import `cn` from `cn`, delete the wrapper. [frontend/src/lib/utils.ts]

`native:` `date-fns` is a dependency with zero imports; `Intl.DateTimeFormat` covers all formatting in the tree. Drop it. [frontend/package.json]

`native:` `react-day-picker` is imported only by the unused `ui/calendar.tsx`; remove the dep with the component. [frontend/package.json]

`delete:` `@types/d3-scale` and `@types/d3-shape` are installed as direct devDeps but no source imports either package directly. Drop both. [frontend/package.json]

`delete:` `clsx` and `tailwind-merge` are direct deps used only by the 7-line `cn` wrapper above. Drop both once the wrapper goes. [frontend/package.json]

---

## Notes (not cuts)

- `components/charts/` is 34 modules for 5 rendered components, but `index.ts` documents it as vendored-and-unmodified so `npx shadcn add @bklit/...` keeps working. Treat it as third-party: don't refactor, but do cut the unused sparkline above.
- `backend/src/services/authService.ts` is a thin pass-through over Mongoose, but `AGENTS.md` forbids controllers importing `models/`. Architecture, not over-engineering — leave it.
- `layout.ts`/`preview.ts` under `src/emails` back the `email:preview`/`email:test` scripts; they are dev tooling, not drift.

---

net: -2,700 lines, -6 deps possible.
