import fs from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import {
  MANAGED_KEYS,
  INTEGRATION_GROUPS,
  INTEGRATION_KEYS,
} from "../config/integrationKeys.js";
import { ENV_WRITE } from "../config/env.js";
import { ENV_PATH, PACKAGE_ROOT } from "../config/paths.js";
import { isPrimaryInstance } from "./restartService.js";

const BACKUP_PATH = path.join(PACKAGE_ROOT, ".env.bak");

// Keys from the retired SMTP/Gmail mail path. They are stripped on the next
// rewrite so old installs do not keep dead credentials in .env.
const RETIRED_KEYS = new Set([
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_PASSWORD",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
]);

const GROUP_TITLES = new Map<string, string>(
  INTEGRATION_GROUPS.map((group) => [group.id, group.title] as const),
);
const KEY_GROUP = new Map<string, string>(
  INTEGRATION_KEYS.map((entry) => [entry.key, entry.group] as const),
);
const GROUP_ORDER = INTEGRATION_GROUPS.map((group) => group.id);

export interface EnvWriteResult {
  outcome: "ok" | "skipped_readonly" | "skipped_secondary" | "failed";
  managedWritten?: number;
  changed?: number;
  reason?: string;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function keyOrderOf(content: string): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const line of stripBom(content).split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    const key = match?.[1];
    if (key && !seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  }
  return order;
}

function needsQuotes(value: string): boolean {
  return value.length === 0 || /[\s#"'$`]/.test(value) || /^[;#]/.test(value);
}

export function formatEnvValue(raw: unknown): string {
  const value = String(raw ?? "").replace(/[ \t]+$/, "");
  if (/[\r\n]/.test(value)) {
    throw new Error("Values cannot contain line breaks.");
  }
  if (!needsQuotes(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Best-effort rewrite of backend/.env from the resolved credential set.
 */
export async function rewriteEnvFile(
  overrides: Map<string, string> = new Map(),
): Promise<EnvWriteResult> {
  if (ENV_WRITE === "off" || process.env.ENV_WRITE === "off") {
    return { outcome: "skipped_readonly", reason: "ENV_WRITE=off" };
  }
  if (!isPrimaryInstance()) {
    return { outcome: "skipped_secondary", reason: "non-primary instance" };
  }

  try {
    let existingContent = "";
    let existingMode = 0o600;
    let hadEnvFile = true;
    try {
      existingContent = await fs.promises.readFile(ENV_PATH, "utf8");
      existingMode = (await fs.promises.stat(ENV_PATH)).mode & 0o777;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        hadEnvFile = false;
        existingContent = "";
      } else if (code === "EROFS" || code === "EACCES") {
        return { outcome: "skipped_readonly", reason: code };
      } else {
        throw error;
      }
    }

    let existing: Record<string, string> = {};
    let originalOrder: string[] = [];
    if (hadEnvFile) {
      try {
        existing = parseDotenv(stripBom(existingContent));
        originalOrder = keyOrderOf(existingContent);
      } catch (error) {
        console.error(
          `env: rewrite aborted (parse failed: ${(error as Error).message})`,
        );
        return { outcome: "failed", reason: "parse failed" };
      }
    }

    // Merge: DB override wins; otherwise keep the existing .env line;
    // never write a managed key whose resolved value is empty.
    const merged = new Map<string, string>();
    for (const key of MANAGED_KEYS) {
      const override = (overrides.get(key) ?? "").trim();
      if (override) {
        merged.set(key, override);
        continue;
      }
      const kept = (existing[key] ?? "").trim();
      if (kept) merged.set(key, kept);
    }
    // Validate before touching disk: newlines are rejected per spec.
    for (const [key, value] of merged) {
      if (/[\r\n]/.test(value)) {
        console.error(`env: rewrite aborted (line break in ${key})`);
        return { outcome: "failed", reason: `line break in ${key}` };
      }
    }

    // Backup before writing (mode preserved).
    if (hadEnvFile) {
      try {
        await fs.promises.copyFile(ENV_PATH, BACKUP_PATH);
        try {
          await fs.promises.chmod(BACKUP_PATH, existingMode);
        } catch {
          // Mode preservation is best-effort.
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "EROFS" || code === "EACCES") {
          return { outcome: "skipped_readonly", reason: code };
        }
        console.error(`env: backup failed (${(error as Error).message})`);
        return { outcome: "failed", reason: "backup failed" };
      }
    }

    const lines = [
      "# AbsoluteCare environment",
      "# Managed by the admin integration settings page. Manual edits to the keys below",
      "# will be overwritten the next time credentials are saved in the app.",
      `# Generated ${new Date().toISOString()}`,
      "",
    ];

    let managedWritten = 0;
    for (const groupId of GROUP_ORDER) {
      const title = GROUP_TITLES.get(groupId) || groupId;
      lines.push(`# --- ${title} ---`);
      const keysInGroup = INTEGRATION_KEYS.filter(
        (entry) => entry.group === groupId,
      ).map((entry) => entry.key);
      for (const key of keysInGroup) {
        if (!merged.has(key)) continue;
        lines.push(`${key}=${formatEnvValue(merged.get(key))}`);
        managedWritten += 1;
      }
      lines.push("");
    }

    const unmanagedInOrder = originalOrder.filter(
      (key) =>
        !MANAGED_KEYS.has(key) && !RETIRED_KEYS.has(key) && key in existing,
    );
    // Include unmanaged keys that dotenv parsed but whose line shape the
    // order scanner missed (defensive; keeps values untouched).
    for (const key of Object.keys(existing)) {
      if (
        !MANAGED_KEYS.has(key) &&
        !RETIRED_KEYS.has(key) &&
        !unmanagedInOrder.includes(key)
      ) {
        unmanagedInOrder.push(key);
      }
    }
    if (unmanagedInOrder.length) {
      lines.push("# --- Unmanaged ---");
      for (const key of unmanagedInOrder) {
        lines.push(`${key}=${formatEnvValue(existing[key] ?? "")}`);
      }
      lines.push("");
    }

    let changed = 0;
    for (const key of MANAGED_KEYS) {
      const before = (existing[key] ?? "").trim();
      const after = merged.has(key) ? merged.get(key) : "";
      if (before !== after) changed += 1;
    }

    const tmpPath = path.join(PACKAGE_ROOT, `.env.tmp-${process.pid}`);
    try {
      await fs.promises.writeFile(tmpPath, `${lines.join("\n")}`, {
        mode: 0o600,
      });
      if (hadEnvFile && existingMode === 0o644) {
        await fs.promises.chmod(tmpPath, 0o644);
        console.warn("env: .env has mode 0644; prefer 0600 for secret files");
      }
      await fs.promises.rename(tmpPath, ENV_PATH);
    } catch (error) {
      try {
        await fs.promises.unlink(tmpPath);
      } catch {
        // Ignore cleanup failures.
      }
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EROFS" || code === "EACCES") {
        return { outcome: "skipped_readonly", reason: code };
      }
      console.error(`env: rewrite failed (${(error as Error).message})`);
      return { outcome: "failed", reason: (error as Error).message };
    }

    console.log(
      `env: rewrote ${managedWritten} managed keys (${changed} changed)`,
    );
    return { outcome: "ok", managedWritten, changed };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES") {
      return { outcome: "skipped_readonly", reason: code };
    }
    console.error(
      `env: rewrite failed (${(error as Error)?.message || error})`,
    );
    return {
      outcome: "failed",
      reason: (error as Error)?.message || "unknown",
    };
  }
}
