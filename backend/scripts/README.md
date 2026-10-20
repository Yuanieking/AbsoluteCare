# Development seed

Run from `backend/`:

```bash
npm run seed
npm run seed -- --minimal
npm run seed -- --count-patients=20
npm run seed:reset
npm run seed:reset -- --yes
```

The script loads `MONGO_URI` from `.env` (the project uses `MONGO_URI`, not `MONGODB_URI`) and refuses production or non-development database names. `--reset` removes only records owned by the seed: `.test` users, named seed services, seed-tagged appointments, their sessions, dependents, and related notifications. Use `--yes` for non-interactive reset runs.

Set `SEED_PASSWORD` to override the printed demo password. The default is `Password123!`. The script uses a fixed Faker seed, real Mongoose models, bcrypt password hashing, and validates duplicate emails, therapist collisions, session ownership, and payment amounts before printing its summary.

Demo accounts printed by the script include:

- `admin@absolutecare.test`
- `secretary@absolutecare.test`
- `therapist1@absolutecare.test`
- `jeff.ivan@absolutecare.test`

All use the configured seed password. The output also lists collection counts and the generated credentials.
