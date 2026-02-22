import net from "node:net";
import { spawn } from "node:child_process";

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

async function findOpenPort(startPort, maxAttempts = 50) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    if (await canListen(port)) return port;
  }
  throw new Error(`Unable to find an open port in range ${startPort}-${startPort + maxAttempts - 1}`);
}

async function main() {
  const { basePort, passthrough } = parseArgs(process.argv.slice(2));
  const port = await findOpenPort(basePort);

  if (port !== basePort) {
    console.log(`[dev] Port ${basePort} is busy, starting on ${port}`);
  } else {
    console.log(`[dev] Starting on port ${port}`);
  }

  const child = spawn("yarn", ["next", "dev", "--port", String(port), ...passthrough], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
