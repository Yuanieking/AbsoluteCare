import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function findPackageRoot(start: string): string {
  let current = start;
  for (;;) {
    if (fs.existsSync(path.join(current, "package.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

export const PACKAGE_ROOT = findPackageRoot(
  path.dirname(fileURLToPath(import.meta.url)),
);
export const ENV_PATH = path.join(PACKAGE_ROOT, ".env");
export const ASSETS_DIR = path.join(PACKAGE_ROOT, "assets");
export const SRC_DIR = path.join(PACKAGE_ROOT, "src");
