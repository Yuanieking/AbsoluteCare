import "./config/integrations.js";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import path from "node:path";
import { FRONTEND_URL, PORT } from "./config/env.js";
import { ASSETS_DIR } from "./config/paths.js";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import therapistRoutes from "./routes/therapistRoutes.js";
import secretaryRoutes from "./routes/secretaryRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminAppointmentRoutes from "./routes/adminAppointmentRoutes.js";
import adminServiceRoutes from "./routes/adminServiceRoutes.js";
import adminRecordRoutes from "./routes/adminRecordRoutes.js";
import adminMonitoringRoutes from "./routes/adminMonitoringRoutes.js";
import { runAppointmentReminderJob } from "./jobs/appointmentReminderJob.js";
import connectDB from "./config/db.js";
import { verifyMailer } from "./services/mailer.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import { getSettings } from "./services/settingsService.js";
import { getIntegrationStatus } from "./config/integrations.js";
import { validateEmailAssets } from "./emails/layout.js";
import { refreshRuntimeConfig } from "./config/runtimeConfig.js";
import { markRestartApplied } from "./services/integrationCredentialService.js";
import { syncBootstrapAdmins } from "./services/adminBootstrapService.js";
import { setHttpServer } from "./services/restartService.js";
import { AppError } from "./errors/AppError.js";

const app = express();

app.get("/static/email/logo.png", (req, res) => {
  res.sendFile(path.join(ASSETS_DIR, "email/logo.png"));
});

const allowedOrigins = (process.env.CORS_ORIGINS || FRONTEND_URL)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS origin is not allowed: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/integrations", calendarRoutes);
app.use("/therapist", therapistRoutes);
app.use("/secretary", secretaryRoutes);
app.use("/admin/users", adminUserRoutes);
app.use("/admin/appointments", adminAppointmentRoutes);
app.use("/admin/services", adminServiceRoutes);
app.use("/admin", adminRecordRoutes);
app.use("/admin", adminMonitoringRoutes);
app.use("/notifications", notificationRoutes);
app.use("/settings", settingsRoutes);
app.use("/admin/settings", settingsRoutes);
if (process.env.NODE_ENV !== "production") {
  const { default: devEmailRoutes } =
    await import("./routes/devEmailRoutes.js");
  app.use("/dev", devEmailRoutes);
}
app.use("/", patientRoutes);

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof AppError) {
    return res.status(error.status).json(error.payload);
  }
  const named = error as { name?: string; issues?: unknown; errors?: unknown };
  if (named?.name === "ZodError") {
    return res.status(400).json({
      message: "Please correct the highlighted fields.",
      errors: named.issues || named.errors,
    });
  }
  return next(error);
});

const server = app.listen(PORT, () => {
  console.log(`Server Running on port ${PORT}`);
  validateEmailAssets();
  void verifyMailer();
  connectDB()
    .then(async () => {
      await refreshRuntimeConfig();
      await syncBootstrapAdmins();
      await markRestartApplied();
      const settings = await getSettings();
      const status = Object.entries(
        getIntegrationStatus() as unknown as Record<
          string,
          { configured: boolean; missing: string[] }
        >,
      );
      for (const [key, integration] of status) {
        const field = `${key}Enabled`;
        if (
          (settings.integrations as unknown as Record<string, unknown>)[
            field
          ] &&
          !integration.configured
        ) {
          console.warn(
            `Integration ${key} is enabled in settings but not configured: ${integration.missing.join(", ")}`,
          );
        }
      }
    })
    .catch((error: unknown) =>
      console.error(
        "Database initialization failed:",
        error instanceof Error ? error.message : String(error),
      ),
    );
  runAppointmentReminderJob().catch((error: unknown) =>
    console.error(
      "Initial reminder job failed:",
      error instanceof Error ? error.message : String(error),
    ),
  );
  setInterval(
    () =>
      runAppointmentReminderJob().catch((error: unknown) =>
        console.error(
          "Reminder job failed:",
          error instanceof Error ? error.message : String(error),
        ),
      ),
    15 * 60 * 1000,
  );
});

setHttpServer(server);
