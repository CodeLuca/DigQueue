import { spawn } from "node:child_process";

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

async function main() {
  const baseUrl = (process.env.SMOKE_BASE_URL || "").trim();
  if (!baseUrl) {
    throw new Error("SMOKE_BASE_URL is required for live release verification.");
  }

  console.log(`release-verify-live: using ${baseUrl}`);
  if (!(process.env.SMOKE_COOKIE || "").trim()) {
    console.log("release-verify-live: SMOKE_COOKIE not set, authenticated smoke probes will be skipped.");
  }

  console.log("release-verify-live: running local release verification...");
  await runCommand("yarn", ["release:verify"]);
  console.log("release-verify-live: running live smoke verification...");
  await runCommand("yarn", ["smoke:core"]);
  console.log("release-verify-live: complete.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`release-verify-live failed: ${message}`);
  process.exitCode = 1;
});
