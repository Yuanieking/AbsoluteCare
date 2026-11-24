# Architectural Pattern

## Layered Model-View-Controller (MVC) Pattern

AbsoluteCare uses a layered variant of the Model-View-Controller architecture within a client-server model. A React single-page application (the View) talks only through a JSON REST API to an Express backend. In the backend, request handling is split into routes, middleware, controllers and services, and persistence is handled by Mongoose models. This keeps clinic operations organized for the four user roles (patients, therapists, secretaries and administrators), lets the frontend and backend be built separately, and gives each layer one job: presentation, request coordination, business logic or data integrity.

## Implementation in the System

### Model Layer

- Built with MongoDB through the Mongoose 9 ODM. The 16 models are in `backend/src/models/`, and the database connection is set up in `backend/src/config/db.js`.
- Defines the system's core entities: `User`, `Dependent`, `Appointment`, `Session`, `TherapyService`, `Specialization`, `Notification` and `GeneratedDocument`. Supporting entities cover administration and auditing: `AuditLog`, `SettingsAuditLog`, `AppSetting`, `IntegrationCredential`, `GoogleDriveConnection`, `DocumentCounter`, `RecordEditors` and `SettingsVerification`.
- Enforces data integrity at the schema level:
  - required fields and `ref`-based relations (for example, a `Session` references its `Appointment`, patient `User`, therapist `User` and `TherapyService`);
  - enumerated values such as appointment status (`pending`, `confirmed`, `completed`, `cancelled`, `no_show`), payment method (`cash`, `gcash`, `card`, `other`), user role (`user`, `therapist`, `admin`, `secretary`) and document type (`clinic_report`, `patient_summary`, `visit_record`, `receipt`);
  - minimum values such as `durationMinutes: { min: 30 }`;
  - a unique email per user.
- Keeps records traceable and efficient. Most schemas use `timestamps: true`, which also provides the `updatedAt` values used for `If-Match` concurrency checks. Compound indexes on `Appointment` speed up schedule queries, and `select: false` hides sensitive fields such as generated PDF buffers and settings edit leases.

### View Layer

- Built as a React 19 single-page application in TypeScript (strict mode), bundled with Vite 8 and styled with Tailwind CSS 4 and Radix UI primitives. Routing uses React Router 7 (`frontend/src/app/router.tsx`), and pages are lazy-loaded behind Suspense skeletons.
- Provides role-specific modules:
  - **Patients:** `PatientDashboardPage`, `BookAppointmentPage`, `AppointmentsPage`, `ProgressPage` and `DependentsPage`.
  - **Therapists:** `TherapistDashboardPage`, `TherapistAvailabilityPage`, `TherapistPatientsPage` and `TherapistRecordsPage`.
  - **Secretaries:** `SecretaryDashboardPage`, `SecretarySchedulePage` and `SecretaryPaymentsPage`.
  - **Administrators:** `AdminDashboardPage`, `UsersPage`, `PermissionsPage`, `ServicesPage`, `PaymentsPage`, `ReportsPage`, `AuditTrail` and `SettingsPage`.
  - **Shared and public:** `DocumentsPage` and the public document `VerifyPage`.
- Organized by feature under `frontend/src/features/<role>/`. Each feature module separates its concerns into `api.ts` (HTTP calls), `queries.ts` and `mutations.ts` (TanStack Query hooks), `schemas.ts` (Zod form validation used with React Hook Form) and `types.ts`. The page components hold the screen logic, while reusable presentational components live in `frontend/src/components/` (`ui/`, `domain/`, `layout/`, `charts/`, `form/`, `data-table/`).
- Manages application-wide state through context providers in `frontend/src/app/providers.tsx` (`QueryClientProvider`, `SettingsProvider`, `AuthProvider`, `NotificationsProvider`). `ProtectedRoute` limits each role's pages through `allowedRoles`. All server communication goes through a single Axios client (`frontend/src/lib/api/client.ts`), which turns API errors into user-friendly messages.

### Controller Layer

- Built with Express 5. Twenty route modules in `backend/src/routes/`, mounted in `backend/src/app.js`, map the API's 152 documented endpoints to 19 controllers in `backend/src/controllers/`. Examples are `patientController.js`, `therapistController.js`, `secretaryController.js`, `adminAppointmentController.js` and `documentController.js`. The route files contain 156 registrations, because four notification endpoints (`GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/read-all` and `PATCH /notifications/:id/read`) are registered in both `notificationRoutes.js` and `patientRoutes.js`. The settings routes are also mounted a second time under `/admin/settings`, and these are treated as aliases rather than separate endpoints.
- Validates requests with Zod 4 schemas from `backend/src/schemas/` (for example, `appointmentSchema.js`, `dependentSchema.js` and `authSchema.js`), either inside controllers through `schema.parse` or through the reusable `validate.js` middleware. Controllers then call services and return JSON responses. Controllers never import models directly.
- Handles the main clinic operations:
  - patient registration and authentication;
  - appointment booking, rescheduling and cancellation;
  - management of dependents;
  - therapist availability and session records;
  - payment recording by secretaries;
  - administration of users, services and specializations;
  - document generation and public verification;
  - notifications;
  - system settings and backups.
- Sends all failures through a central error pipeline. The typed errors in `backend/src/errors/AppError.js` (such as `UnauthorizedError`, `ForbiddenError` and `NotFoundError`) are formatted by `errorHandler` and `notFoundHandler` in `backend/src/middleware/errorHandler.js`.

### Middleware Layer

- Runs cross-cutting concerns before requests reach controllers. These are `securityHeaders.js`, `rateLimit.js`, `sanitizeInput.js`, `auditMiddleware.js` and `verifyRecaptcha.js`, together with Express JSON parsing and `cookie-parser`.
- Enforces authentication and role-based access control. `protectRoute` verifies the JWT session cookie. `requireRole`, `requireAccess` and `requirePermission` in `authMiddleware.js`, plus `requirePatient` in `patientMiddleware.js`, check roles and permissions. `validateObjectId.js` and `appointmentScope.js` guard route parameters and limit which appointments a user can reach.

### Service and Integration Layer

- Contains the business logic and all persistence in `backend/src/services/`. Examples are `patientService.js`, `availabilityService.js`, `adminAppointmentService.js`, `concurrencyService.js` (timestamp-based conflict detection) and `auditService.js`. Services do not use Express request or response objects.
- Connects to outside systems: email through the Brevo API (`mailer.js`, with templates in `backend/src/emails/`), Google Calendar sync (`calendarService.js`), Google Drive document storage (`driveService.js`) and PDF generation with PDFKit (`documentPdfService.js`).
- Runs background work from `backend/src/jobs/`. `appointmentReminderJob.js` runs every 15 minutes and `documentSyncJob.js` runs every 5 minutes, both scheduled from `app.js`.

## Benefits

- **Clear separation across the network boundary:** the React client relies only on the JSON API contract, so the clinic interface can be redesigned without touching persistence or business rules.
- **Business rules can be reused and changed safely:** services such as `availabilityService.js` and `notificationService.js` are shared by patient, therapist, secretary and admin controllers, so a scheduling or notification rule is written once.
- **Consistent security and validation:** authentication, role checks, rate limiting, input sanitization and auditing are applied the same way through middleware, and Zod schemas define every request shape.
- **Data integrity under concurrent use:** Mongoose schema constraints, combined with `If-Match` timestamp checks in `concurrencyService.js`, stop staff from silently overwriting each other's appointment, session and dependent records.
- **Modular feature growth:** new modules such as document generation and verification were added as their own route → controller → service → model chain with a matching `features/documents/` frontend module, without disrupting the existing role workflows.

## Summary Mapping Table

| Component | Actual Location | Technology Used | Examples |
| --- | --- | --- | --- |
| Model | `/backend/src/models/` | MongoDB, Mongoose 9 | `userModel.js`, `appointmentModel.js`, `sessionModel.js`, `dependentModel.js`, `therapyServiceModel.js`, `generatedDocumentModel.js`, `notificationModel.js`, `auditLogModel.js` |
| View | `/frontend/src/features/`, `/frontend/src/components/`, `/frontend/src/app/` | React 19, TypeScript, Vite 8, React Router 7, TanStack Query, Tailwind CSS 4, Radix UI | `PatientDashboardPage.tsx`, `BookAppointmentPage.tsx`, `TherapistAvailabilityPage.tsx`, `SecretaryPaymentsPage.tsx`, `AdminDashboardPage.tsx`, `DocumentsPage.tsx`, `router.tsx` |
| Controller (Routes) | `/backend/src/routes/` | Express 5 Router | `authRoutes.js`, `patientRoutes.js`, `therapistRoutes.js`, `secretaryRoutes.js`, `adminAppointmentRoutes.js`, `documentRoutes.js` |
| Controller (Handlers) | `/backend/src/controllers/` | Express 5, JavaScript (ESM) | `authController.js`, `patientController.js`, `therapistController.js`, `secretaryController.js`, `adminUserController.js`, `documentController.js` |
| Validation Schemas | `/backend/src/schemas/` | Zod 4 | `authSchema.js`, `appointmentSchema.js`, `dependentSchema.js`, `availabilitySchema.js`, `documentSchema.js` |
| Middleware | `/backend/src/middleware/` | Express middleware, JSON Web Tokens (`jsonwebtoken`), reCAPTCHA | `authMiddleware.js`, `patientMiddleware.js`, `rateLimit.js`, `sanitizeInput.js`, `auditMiddleware.js`, `errorHandler.js` |
| Service / Integration | `/backend/src/services/`, `/backend/src/jobs/`, `/backend/src/emails/` | JavaScript (ESM), PDFKit, Brevo API, Google Calendar and Drive APIs | `patientService.js`, `availabilityService.js`, `concurrencyService.js`, `mailer.js`, `calendarService.js`, `driveService.js`, `appointmentReminderJob.js` |
| Utilities and Errors | `/backend/src/utils/`, `/backend/src/errors/` | JavaScript (ESM) | `appointmentDates.js`, `jwt.js`, `payments.js`, `secretBox.js`, `AppError.js` |
