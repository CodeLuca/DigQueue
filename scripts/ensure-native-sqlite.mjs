import { spawnSync } from "node:child_process";

async function loadNativeModule() {
  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(":memory:");
    db.prepare("select 1").get();
    db.close();
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}

function isNodeModuleMismatch(error) {
  const message = String(error?.message ?? error ?? "");
  return message.includes("NODE_MODULE_VERSION") || message.includes("was compiled against a different Node.js version");
}

function runRebuild() {
  const yarnCmd = process.platform === "win32" ? "yarn.cmd" : "yarn";
  return spawnSync(yarnCmd, ["rebuild", "better-sqlite3"], { stdio: "inherit" });
}

const first = await loadNativeModule();
if (first.ok) {
  process.exit(0);
}

if (!isNodeModuleMismatch(first.error)) {
  console.error("[native-check] better-sqlite3 failed for a non-version reason:");
  console.error(first.error);
  process.exit(1);
}

console.warn("[native-check] Detected NODE_MODULE_VERSION mismatch. Rebuilding better-sqlite3 for current Node...");
const rebuild = runRebuild();
if (rebuild.status !== 0) {
  console.error("[native-check] Rebuild failed. Try running `yarn native:fix` manually.");
  process.exit(rebuild.status ?? 1);
}

const second = await loadNativeModule();
if (second.ok) {
  console.log("[native-check] better-sqlite3 rebuilt successfully for current Node version.");
  process.exit(0);
}

console.error("[native-check] Rebuild completed but module still failed to load.");
console.error(second.error);
process.exit(1);
