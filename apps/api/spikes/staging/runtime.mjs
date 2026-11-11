import { createServer } from "node:http";
import { json } from "../stage-a/server.mjs";

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const error = (cause) => { server.off("listening", ready); reject(cause); };
    const ready = () => { server.off("error", error); resolve(); };
    server.once("error", error);
    server.once("listening", ready);
    server.listen(port, host);
  });
}

function pause(milliseconds, signal) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
}

async function closeServer(server) {
  if (!server.listening) return;
  const timer = setTimeout(() => server.closeAllConnections(), 10000);
  try {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  } finally {
    clearTimeout(timer);
  }
}

export async function startStagingRuntime({
  database, disk, server, runner, port, host = "0.0.0.0", logger = console,
  pollMilliseconds = 2000, probeMilliseconds = 5000, loopbackPort = 3002, paused = false, now = Date.now,
}) {
  const controller = new AbortController();
  const state = { stopping: false, lastProbe: 0, dependencyReady: false, workerReady: true, busySince: 0 };
  const health = createServer({ maxHeaderSize: 4096 }, (request, response) => {
    if (!["GET", "HEAD"].includes(request.method) || request.url !== "/api/health") {
      response.setHeader("connection", "close");
      json(response, 404, { error: "Not found." });
      return;
    }
    const ready = !state.stopping && state.dependencyReady && state.workerReady
      && now() - state.lastProbe < 15000
      && (!state.busySince || now() - state.busySince < 80000);
    json(response, ready ? 200 : 503, { status: ready ? (paused ? "paused" : "ready") : "unavailable" });
  });
  health.requestTimeout = 5000;
  health.headersTimeout = 5000;
  health.keepAliveTimeout = 1000;
  health.maxConnections = 16;
  server.maxConnections = 8;
  try {
    if (!paused) await listen(server, loopbackPort, "127.0.0.1");
    await listen(health, port, host);
  } catch (error) {
    await closeServer(server);
    throw error;
  }
  const worker = (async () => {
    if (paused) return;
    while (!controller.signal.aborted) {
      state.busySince = now();
      try {
        await runner.runOnce({ signal: controller.signal });
        state.workerReady = true;
      } catch (error) {
        state.workerReady = false;
        logger.error("Staging worker iteration failed.", { code: error.code ?? error.name });
      } finally {
        state.busySince = 0;
      }
      await pause(pollMilliseconds, controller.signal);
    }
  })();
  const probes = (async () => {
    let lastSample = 0;
    while (!controller.signal.aborted) {
      try {
        await database.pool.query("SELECT 1");
        await disk.capacity(0);
        state.lastProbe = now();
        state.dependencyReady = true;
      } catch (error) {
        state.dependencyReady = false;
        logger.error("Staging readiness probe failed.", { code: error.code ?? error.name });
      }
      if (now() - lastSample >= 30000) {
        lastSample = now();
        const memory = process.memoryUsage();
        logger.info("Staging resource sample.", {
          rssBytes: memory.rss, heapUsedBytes: memory.heapUsed,
          uptimeSeconds: Math.floor(process.uptime()), workerBusy: Boolean(state.busySince),
        });
      }
      await pause(probeMilliseconds, controller.signal);
    }
  })();
  let closing;
  return {
    health,
    close() {
      if (!closing) {
        state.stopping = true;
        controller.abort();
        closing = (async () => {
          await Promise.all([closeServer(health), closeServer(server), worker, probes]);
        })();
      }
      return closing;
    },
  };
}
