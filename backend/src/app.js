import "./config/audit.js";
import "./config/integrations.js";
import express from "express";
import path from "node:path";
import { FRONTEND_URL, PORT } from "./config/env.js";
import { ASSETS_DIR } from "./config/paths.js";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import recordEditorsRoutes from "./routes/recordEditorsRoutes.js";
import { recordWriteContext, recordTarget } from "./services/recordConcurrency.js";
import patientRoutes from "./routes/patientRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import googleDriveRoutes from "./routes/googleDriveRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import publicVerifyRoutes from "./routes/publicVerifyRoutes.js";
import therapistRoutes from "./routes/therapistRoutes.js";
import secretaryRoutes from "./routes/secretaryRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminAppointmentRoutes from "./routes/adminAppointmentRoutes.js";
import adminServiceRoutes from "./routes/adminServiceRoutes.js";
import adminSpecializationRoutes from "./routes/adminSpecializationRoutes.js";
import adminRecordRoutes from "./routes/adminRecordRoutes.js";
import adminMonitoringRoutes from "./routes/adminMonitoringRoutes.js";
import { runAppointmentReminderJob } from "./jobs/appointmentReminderJob.js";
import { runDocumentSyncJob } from "./jobs/documentSyncJob.js";
import { isPublicVerificationUrl } from "./services/documentService.js";
import connectDB from "./config/db.js";
import { verifyMailer } from "./services/mailer.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import { getSettings } from "./services/settingsService.js";
import { getIntegrationStatus } from "./config/integrations.js";
import { validateEmailAssets } from "./emails/layout.js";
import { refreshRuntimeConfig } from "./config/runtimeConfig.js";
import {
  markRestartApplied,
  pruneRetiredCredentials,
} from "./services/integrationCredentialService.js";
import { syncBootstrapAdmins } from "./services/adminBootstrapService.js";
import { setHttpServer } from "./services/restartService.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { createRateLimiter, globalRateLimit } from "./middleware/rateLimit.js";
import { sanitizeInput } from "./middleware/sanitizeInput.js";
import { auditRequest } from "./middleware/auditMiddleware.js";
import auditRoutes from "./routes/auditRoutes.js";
import { importLegacyAudit } from "./services/auditService.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(auditRequest);

// ** GET /static/email/logo.png - logo used in emails.
app.get("/static/email/logo.png", (req, res) => {
  res.sendFile(path.join(ASSETS_DIR, "email/logo.png"));
});

const allowedOrigins = (process.env.CORS_ORIGINS || FRONTEND_URL)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS origin is not allowed: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // ** Concurrency: browsers must be allowed to send If-Match (timestamp guard) cross-origin.
  allowedHeaders: ["Content-Type", "Authorization", "If-Match", "X-Editor-Session"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
const editorRateLimit = createRateLimiter({
  windowMs: 60_000, limit: 120, body: { message: "Too many editor updates." },
});
const apiV1 = express.Router();
apiV1.use((req, res, next) => req.path.startsWith("/record-editors/")
  ? editorRateLimit(req, res, next) : globalRateLimit(req, res, next));

app.use(cookieParser());
apiV1.use("/admin/backup", backupRoutes);
apiV1.use(express.json());

apiV1.use(sanitizeInput);
apiV1.use((req, res, next) => recordWriteContext.run({
  target: recordTarget(req.path, req.method),
  ifMatch: req.get("If-Match"),
  editorSession: req.get("X-Editor-Session"),
}, next));

apiV1.use("/record-editors", recordEditorsRoutes);
apiV1.use("/audit", auditRoutes);
apiV1.use("/auth", authRoutes);
apiV1.use("/integrations", calendarRoutes);
apiV1.use("/integrations", googleDriveRoutes);
apiV1.use("/verify", publicVerifyRoutes);
apiV1.use("/documents", documentRoutes);
apiV1.use("/therapist", therapistRoutes);
apiV1.use("/secretary", secretaryRoutes);
apiV1.use("/admin/users", adminUserRoutes);
apiV1.use("/admin/appointments", adminAppointmentRoutes);
apiV1.use("/admin/services", adminServiceRoutes);
apiV1.use("/admin/specializations", adminSpecializationRoutes);
apiV1.use("/admin", adminRecordRoutes);
apiV1.use("/admin", adminMonitoringRoutes);
apiV1.use("/notifications", notificationRoutes);
apiV1.use("/settings", settingsRoutes);
apiV1.use("/admin/settings", settingsRoutes);
if (process.env.NODE_ENV !== "production") {
  const { default: devEmailRoutes } =
    await import("./routes/devEmailRoutes.js");
  apiV1.use("/dev", devEmailRoutes);
}
apiV1.use("/", patientRoutes);

app.use("/api/v1", apiV1);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server Running on port ${PORT}`);
  validateEmailAssets();
  void verifyMailer();
  connectDB()
    .then(async () => {
      await importLegacyAudit();
      await refreshRuntimeConfig();
      await syncBootstrapAdmins();
      await markRestartApplied();
      await pruneRetiredCredentials();
      const settings = await getSettings();
      const status = Object.entries(getIntegrationStatus());
      for (const [key, integration] of status) {
        const field = `${key}Enabled`;
        if (settings.integrations[field] && !integration.configured) {
          console.warn(
            `Integration ${key} is enabled in settings but not configured: ${integration.missing.join(", ")}`,
          );
        }
      }
    })
    .catch((error) =>
      console.error(
        "Database initialization failed:",
        error instanceof Error ? error.message : String(error),
      ),
    );
  if (!isPublicVerificationUrl()) {
    console.warn(
      "documents: FRONTEND_URL is not public, so document verification links will not open off this machine.",
    );
  }
  runAppointmentReminderJob().catch((error) =>
    console.error(
      "Initial reminder job failed:",
      error instanceof Error ? error.message : String(error),
    ),
  );
  setInterval(
    () =>
      runAppointmentReminderJob().catch((error) =>
        console.error(
          "Reminder job failed:",
          error instanceof Error ? error.message : String(error),
        ),
      ),
    15 * 60 * 1000,
  );
  runDocumentSyncJob().catch((error) =>
    console.error(
      "Initial document sync failed:",
      error instanceof Error ? error.message : String(error),
    ),
  );
  setInterval(
    () =>
      runDocumentSyncJob().catch((error) =>
        console.error(
          "Document sync failed:",
          error instanceof Error ? error.message : String(error),
        ),
      ),
    5 * 60 * 1000,
  );
});

setHttpServer(server);
