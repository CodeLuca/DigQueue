import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

type LatestDeploymentStatus =
  | {
      ok: true;
      deploymentId: string;
      status: string;
    }
  | {
      ok: false;
      reason: string;
    };

type ServiceDeploymentStatus =
  | {
      ok: true;
      deploymentId: string;
      status: string;
    }
  | {
      ok: false;
      reason: string;
    };

async function getLatestRailwayDeploymentStatus(): Promise<LatestDeploymentStatus> {
  try {
    const { stdout } = await execFileAsync("railway", ["deployment", "list"], {
      env: process.env,
      timeout: 15_000,
    });
    const line = stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => /^[0-9a-f-]{36}\s+\|/.test(value));

    if (!line) {
      return { ok: false, reason: "latest deployment line not found" };
    }

    const match = line.match(/^([0-9a-f-]{36})\s+\|\s+([A-Z_]+)\s+\|/);
    if (!match) {
      return { ok: false, reason: `could not parse deployment line: ${line}` };
    }

    return {
      ok: true,
      deploymentId: match[1],
      status: match[2],
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getRailwayServiceStatus(): Promise<ServiceDeploymentStatus> {
  try {
    const { stdout } = await execFileAsync("railway", ["service", "status"], {
      env: process.env,
      timeout: 15_000,
    });
    const deploymentMatch = stdout.match(/^Deployment:\s+([0-9a-f-]{36})$/m);
    const statusMatch = stdout.match(/^Status:\s+([A-Z_]+)$/m);

    if (!deploymentMatch || !statusMatch) {
      return { ok: false, reason: "service status output missing deployment or status" };
    }

    return {
      ok: true,
      deploymentId: deploymentMatch[1],
      status: statusMatch[1],
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function isRailwayPendingStatus(status: string) {
  return status === "INITIALIZING" || status === "BUILDING" || status === "DEPLOYING";
}

type RailwayProbeResult =
  | {
      ok: true;
      latest: Extract<LatestDeploymentStatus, { ok: true }>;
      service: Extract<ServiceDeploymentStatus, { ok: true }>;
    }
  | {
      ok: false;
      reason: string;
    };

async function getRailwayPromotionProbe(): Promise<RailwayProbeResult> {
  const latest = await getLatestRailwayDeploymentStatus();
  if (!latest.ok) {
    return { ok: false, reason: `deployment list: ${latest.reason}` };
  }

  const service = await getRailwayServiceStatus();
  if (!service.ok) {
    return { ok: false, reason: `service status: ${service.reason}` };
  }

  return {
    ok: true,
    latest,
    service,
  };
}

async function waitForRailwayPromotion() {
  const enabled = (process.env.LIVE_VERIFY_WAIT_FOR_RAILWAY || "1").trim() !== "0";
  if (!enabled) return;

  const timeoutMs = Number(process.env.LIVE_VERIFY_RAILWAY_TIMEOUT_MS || 300_000);
  const intervalMs = Number(process.env.LIVE_VERIFY_RAILWAY_INTERVAL_MS || 5_000);
  const maxProbeFailures = Number(process.env.LIVE_VERIFY_RAILWAY_MAX_PROBE_FAILURES || 3);
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastMessage = "no Railway status checked";
  let consecutiveProbeFailures = 0;

  while (Date.now() <= deadline) {
    attempt += 1;
    const probe = await getRailwayPromotionProbe();

    if (!probe.ok) {
      consecutiveProbeFailures += 1;
      lastMessage = probe.reason;

      if (consecutiveProbeFailures >= maxProbeFailures) {
        console.log(
          `release-verify-live: skipping Railway promotion wait after ${consecutiveProbeFailures} probe failure(s) (${probe.reason}).`,
        );
        return;
      }

      console.log(
        `release-verify-live: Railway promotion probe failed on attempt ${attempt} (${probe.reason}); retrying.`,
      );
      if (Date.now() + intervalMs > deadline) break;
      await sleep(intervalMs);
      continue;
    }

    consecutiveProbeFailures = 0;
    const { latest, service } = probe;
    lastMessage = `latest=${latest.deploymentId}:${latest.status}, service=${service.deploymentId}:${service.status}`;

    if (latest.status === "SUCCESS" && service.status === "SUCCESS" && latest.deploymentId === service.deploymentId) {
      console.log(`release-verify-live: Railway deployment promoted on attempt ${attempt} (${latest.deploymentId}).`);
      return;
    }

    if (!isRailwayPendingStatus(latest.status) && latest.status !== "SUCCESS") {
      throw new Error(`latest Railway deployment did not succeed (${lastMessage})`);
    }

    console.log(`release-verify-live: waiting for Railway promotion, attempt ${attempt} (${lastMessage}).`);
    if (Date.now() + intervalMs > deadline) break;
    await sleep(intervalMs);
  }

  throw new Error(`latest Railway deployment was not promoted within ${timeoutMs}ms (${lastMessage})`);
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
  console.log("release-verify-live: waiting for Railway deployment promotion...");
  await waitForRailwayPromotion();
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
