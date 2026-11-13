import mongoose from "mongoose";
import { ALLOW_SELF_RESTART } from "../config/env.js";

const COOLDOWN_MS = 60_000;

let httpServer = null;
let lastRestartAt = 0;

export function setHttpServer(server) {
  httpServer = server;
}

function runningUnderSupervisor() {
  return Boolean(
    process.env.pm_id !== undefined ||
    process.env.NOTIFY_SOCKET ||
    process.env.CONTAINER ||
    process.env.container ||
    process.env.KUBERNETES_SERVICE_HOST,
  );
}

export function supervisorCommand() {
  if (process.env.pm_id !== undefined) return "pm2 restart absolutecare-api";
  if (process.env.NOTIFY_SOCKET)
    return "sudo systemctl restart absolutecare-api";
  if (process.env.CONTAINER || process.env.container)
    return "docker restart <container-name>";
  if (process.env.KUBERNETES_SERVICE_HOST)
    return "kubectl rollout restart deployment/absolutecare-api";
  return "Stop the server and start it again (Ctrl+C, then npm start).";
}

export function selfRestartSupported() {
  return Boolean(ALLOW_SELF_RESTART && httpServer && runningUnderSupervisor());
}

export function isPrimaryInstance() {
  if (process.env.NODE_APP_INSTANCE !== undefined)
    return process.env.NODE_APP_INSTANCE === "0";
  if (process.env.APP_PRIMARY !== undefined)
    return process.env.APP_PRIMARY === "1";
  return true;
}

export function restartCooldownRemaining() {
  return Math.max(0, COOLDOWN_MS - (Date.now() - lastRestartAt));
}

export function triggerRestart({ delayMs = 250 } = {}) {
  lastRestartAt = Date.now();
  setTimeout(async () => {
    console.log("restart: closing for a supervisor restart");
    try {
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
    } catch (error) {
      console.error("restart: server close failed:", error.message);
    }
    try {
      await mongoose.connection.close();
    } catch (error) {
      console.error("restart: database close failed:", error.message);
    }
    process.exit(0);
  }, delayMs);
}
