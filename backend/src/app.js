import "./config/integrations.js";
import express from "express";
import path from "node:path";
import { FRONTEND_URL, PORT } from "./config/env.js";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./router/authRoutes.js";
import patientRoutes from "./router/patientRoutes.js";
import calendarRoutes from "./router/calendarRoutes.js";
import therapistRoutes from "./router/therapistRoutes.js";
import secretaryRoutes from "./router/secretaryRoutes.js";
import adminUserRoutes from "./router/adminUserRoutes.js";
import adminAppointmentRoutes from "./router/adminAppointmentRoutes.js";
import adminServiceRoutes from "./router/adminServiceRoutes.js";
import adminRecordRoutes from "./router/adminRecordRoutes.js";
import adminMonitoringRoutes from "./router/adminMonitoringRoutes.js";
import { runAppointmentReminderJob } from "./jobs/appointmentReminderJob.js";
import connectDB from "./config/db.js";
import { verifyMailer } from "./services/mailer.js";
import notificationRoutes from "./router/notificationRoutes.js";
import settingsRoutes from "./router/settingsRoutes.js";
import { getSettings } from "./services/settingsService.js";
import { getIntegrationStatus } from "./config/integrations.js";
import { validateEmailAssets } from "./emails/layout.js";

const app = express();

app.get("/static/email/logo.png", (req, res) => {
  res.sendFile(path.resolve(process.cwd(), "assets/email/logo.png"));
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
    await import("./router/devEmailRoutes.js");
  app.use("/dev", devEmailRoutes);
}
app.use("/", patientRoutes);

app.use((error, req, res, next) => {
  if (error.name === "ZodError") {
    return res.status(400).json({
      message: "Please correct the highlighted fields.",
      errors: error.issues || error.errors,
    });
  }
  return next(error);
});

app.listen(PORT, () => {
  console.log(`Server Running on port ${PORT}`);
  validateEmailAssets();
  void verifyMailer();
  connectDB()
    .then(async () => {
      const settings = await getSettings();
      const status = getIntegrationStatus();
      for (const [key, integration] of Object.entries(status)) {
        const field = `${key}Enabled`;
        if (settings.integrations?.[field] && !integration.configured) {
          console.warn(
            `Integration ${key} is enabled in settings but not configured: ${integration.missing.join(", ")}`,
          );
        }
      }
    })
    .catch((error) =>
      console.error("Database initialization failed:", error.message),
    );
  runAppointmentReminderJob().catch((error) =>
    console.error("Initial reminder job failed:", error.message),
  );
  setInterval(
    () =>
      runAppointmentReminderJob().catch((error) =>
        console.error("Reminder job failed:", error.message),
      ),
    15 * 60 * 1000,
  );
});
