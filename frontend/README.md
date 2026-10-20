# AbsoluteCare frontend

## Environment

Set `VITE_API_URL` to the backend origin when it is not running at
`http://localhost:5000`. The backend must allow that origin with credentials.

## Data migration notes

- Existing dependent records need a one-time migration from `patient` to
  `guardian`, with `dateOfBirth` converted to a MongoDB Date. New records use
  `guardian`, `sex`, `medicalNotes`, and `isActive`.
- Existing appointments remain owned by the guardian in `patient`; dependent
  appointments use the optional `dependent` reference. Session records created
  after this change preserve the same dependent reference.
- Existing users receive defaults for `mustChangePassword`, accepted terms, and
  notification preferences. Normalize existing phone numbers to `+63XXXXXXXXXX`
  after reviewing invalid values before enabling strict validation in production.

## Manual testing checklist

- Add, edit, remove, and view a dependent, then book an appointment for them.
- Try invalid email and phone values in signup and profile/admin forms.
- Confirm password fields clear after auth failure and when switching auth modes.
- Confirm signup terms are required, including the Google button.
- Confirm the landing header uses “Book an appointment”.
- Complete a forgot-password request and reset-link round trip with SMTP configured.
- Create a therapist or secretary as admin, use the one-time password, and complete forced password change.
- Connect Google Calendar and confirm a confirmed appointment syncs.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
