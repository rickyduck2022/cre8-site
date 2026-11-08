import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiDirectory = resolve(rootDirectory, "apps/api");
const webDirectory = resolve(rootDirectory, "apps/web");
const adminDirectory = resolve(rootDirectory, "apps/admin");

const services = [
  {
    name: "api",
    command: process.execPath,
    args: ["--watch", "src/server.mjs"],
    cwd: apiDirectory,
  },
  {
    name: "web",
    command: process.execPath,
    args: [
      resolve(webDirectory, "node_modules/vite/bin/vite.js"),
      "--host",
      process.env.WEB_HOST ?? "0.0.0.0",
      "--port",
      process.env.WEB_PORT ?? "5173",
    ],
    cwd: webDirectory,
  },
  {
    name: "admin",
    command: process.execPath,
    args: [
      resolve(adminDirectory, "node_modules/vite/bin/vite.js"),
      "--host",
      process.env.ADMIN_HOST ?? "0.0.0.0",
      "--port",
      process.env.ADMIN_PORT ?? "5174",
    ],
    cwd: adminDirectory,
  },
];

const children = [];
let shuttingDown = false;
let shutdownPromise;

function shutdown(exitCode) {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  process.exitCode = exitCode;
  shutdownPromise = Promise.all(
    children.map(
      (child) =>
        new Promise((resolveChild) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolveChild();
            return;
          }
          child.once("close", resolveChild);
          child.kill();
        }),
    ),
  ).then(() => undefined);
  return shutdownPromise;
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[${service.name}] ${error.message}`);
    void shutdown(1);
  });
  child.on("close", (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[${service.name}] stopped${signal ? ` after ${signal}` : ` with exit code ${code}`}.`,
    );
    void shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("SIGBREAK", () => void shutdown(0));
