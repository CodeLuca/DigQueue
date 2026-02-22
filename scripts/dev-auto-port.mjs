import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";

function parseArgs(argv) {
  let requestedPort = Number.parseInt(process.env.PORT ?? "", 10);
  const passthrough = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port" || arg === "-p") {
      const next = argv[i + 1];
      if (next) {
        requestedPort = Number.parseInt(next, 10);
        i += 1;
      }
      continue;
    }
    passthrough.push(arg);
  }

  const basePort = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 3000;
  return { basePort, passthrough };
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host: "0.0.0.0" }, () => {
      server.close(() => resolve(true));
    });
  });
}

function canConnect(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(350);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

async function isPortInUse(port) {
  const connectionChecks = await Promise.allSettled([canConnect(port, "127.0.0.1"), canConnect(port, "::1")]);
  return connectionChecks.some((result) => result.status === "fulfilled" && result.value === true);
}

async function findOpenPort(startPort, maxAttempts = 50) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    // Check both "port can bind" and "port already accepting connections" to avoid racey false positives.
    const [canBind, alreadyInUse] = await Promise.all([canListen(port), isPortInUse(port)]);
    if (canBind && !alreadyInUse) return port;
  }
  throw new Error(`Unable to find an open port in range ${startPort}-${startPort + maxAttempts - 1}`);
}

function resolveDevDistDir(port) {
  return `.next-port-${port}`;
}

function launchNextDev(port, passthrough) {
  const env = {
    ...process.env,
    NEXT_DEV_DIST_DIR: resolveDevDistDir(port),
  };
  const child = spawn("yarn", ["next", "dev", "--port", String(port), ...passthrough], {
    stdio: "inherit",
    env,
  });
  return child;
}

function lockFileExists(port) {
  const lockPath = path.join(process.cwd(), resolveDevDistDir(port), "dev", "lock");
  return existsSync(lockPath);
}

async function main() {
  const { basePort, passthrough } = parseArgs(process.argv.slice(2));
  const port = await findOpenPort(basePort);

  if (port !== basePort) {
    console.log(`[dev] Port ${basePort} is busy, starting on ${port}`);
  } else {
    console.log(`[dev] Starting on port ${port}`);
  }

  const child = launchNextDev(port, passthrough);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    if (code === 1 && lockFileExists(port)) {
      console.error(`[dev] Next dev lock is present at ${resolveDevDistDir(port)}/dev/lock. If another instance is already running on that port, stop it and rerun.`);
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
