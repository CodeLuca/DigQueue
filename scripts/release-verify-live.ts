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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBaseUrlReady(baseUrl: string) {
  const timeoutMs = Number(process.env.LIVE_VERIFY_WAIT_TIMEOUT_MS || 180_000);
  const intervalMs = Number(process.env.LIVE_VERIFY_WAIT_INTERVAL_MS || 5_000);
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastError = "no request attempted";

  while (Date.now() <= deadline) {
    attempt += 1;
    try {
      const response = await fetch(baseUrl, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status < 500) {
        console.log(`release-verify-live: live URL responded on attempt ${attempt} with ${response.status}.`);
        return;
      }

      lastError = `received ${response.status}`;
      console.log(`release-verify-live: waiting for live URL, attempt ${attempt} got ${response.status}.`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.log(`release-verify-live: waiting for live URL, attempt ${attempt} failed: ${lastError}`);
    }

    if (Date.now() + intervalMs > deadline) break;
    await sleep(intervalMs);
  }

  throw new Error(`live URL did not become ready within ${timeoutMs}ms (${lastError})`);
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
  console.log("release-verify-live: waiting for live deployment readiness...");
  await waitForBaseUrlReady(baseUrl);
  console.log("release-verify-live: running live smoke verification...");
  await runCommand("yarn", ["smoke:core"]);
  console.log("release-verify-live: complete.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`release-verify-live failed: ${message}`);
  process.exitCode = 1;
});
