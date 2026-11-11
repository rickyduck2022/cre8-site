import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { authenticate, createStageAStore, httpError, mutateCrate, publicCrate, sessionSeconds } from "./store.mjs";
import { verifySchema } from "./database.mjs";

export function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

export async function readInput(request) {
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
    throw httpError(415, "Use application/json.");
  }
  const buffer = await new Promise((resolve, reject) => {
    const buffers = [];
    let bytes = 0;
    const cleanup = () => {
      request.off("data", data);
      request.off("end", end);
      request.off("error", error);
      request.off("aborted", aborted);
    };
    const error = (cause) => { cleanup(); reject(cause); };
    const aborted = () => error(httpError(400, "Request was interrupted."));
    const end = () => { cleanup(); resolve(Buffer.concat(buffers)); };
    const data = (chunk) => {
      bytes += chunk.length;
      if (bytes > 16384) {
        cleanup();
        request.resume();
        reject(httpError(413, "Request body is too large."));
      } else {
        buffers.push(chunk);
      }
    };
    request.on("data", data);
    request.on("end", end);
    request.on("error", error);
    request.on("aborted", aborted);
  });
  let input;
  try {
    input = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw httpError(400, "Provide valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw httpError(400, "Provide a JSON object.");
  return input;
}

function sessionCookie(request) {
  const cookie = (request.headers.cookie ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith("cre8_session="));
  return cookie?.slice("cre8_session=".length);
}

function cookie(token, secure) {
  return `cre8_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${token ? sessionSeconds : 0}${secure ? "; Secure" : ""}`;
}

export async function createStageAServer({ database, logger = console, secureCookies = false, mediaRoutes, admit }) {
  await verifySchema(database);
  const store = createStageAStore(database);
  const server = createServer({ maxHeaderSize: 16384 }, async (request, response) => {
    const requestId = randomUUID();
    response.setHeader("x-request-id", requestId);
    request.on("error", (error) => logger.error("Stage A request stream failed.", {
      requestId, code: error.code ?? error.name,
    }));
    try {
      const authority = new URL(`${secureCookies ? "https" : "http"}://${request.headers.host}`);
      if (!["127.0.0.1", "localhost", "[::1]"].includes(authority.hostname)
        || Number(authority.port || (secureCookies ? 443 : 80)) !== server.address().port) {
        throw httpError(403, "The isolated harness requires a loopback host.");
      }
      const url = new URL(request.url, "http://localhost");
      const path = url.pathname;
      const method = request.method;
      if (!["GET", "HEAD"].includes(method) && request.headers.origin
        && request.headers.origin !== `${secureCookies ? "https" : "http"}://${request.headers.host}`) {
        throw httpError(403, "Untrusted request origin.");
      }
      admit?.(request, response);
      if (method === "GET" && path === "/api/health") {
        await database.pool.query("SELECT 1");
        return json(response, 200, { status: "ok", spike: "stage-a" });
      }
      if (method === "POST" && path === "/api/login") {
        const { user, token } = await store.login(await readInput(request));
        return json(response, 200, { user }, { "set-cookie": cookie(token, secureCookies) });
      }
      const token = sessionCookie(request);
      if (mediaRoutes && await mediaRoutes({ request, response, path, method, token, store })) return;
      if (method === "POST" && path === "/api/logout") {
        await store.logout(token);
        return json(response, 200, { status: "ok" }, { "set-cookie": cookie("", secureCookies) });
      }
      if (method === "GET" && path === "/api/session") {
        return json(response, 200, { user: await store.session(token) });
      }
      if (method === "GET" && path === "/api/crates") {
        return json(response, 200, await store.list(token));
      }
      const match = path.match(/^\/api\/crates\/([^/]+)(?:\/dubs\/([^/]+))?$/);
      const id = match && decodeURIComponent(match[1]);
      const dubId = match?.[2] && decodeURIComponent(match[2]);
      if (match && !dubId && method === "GET") {
        const result = await database.transaction(async (client) => {
          const user = await authenticate(client, token, { lock: true });
          return publicCrate(client, id, user.id);
        });
        return json(response, 200, result);
      }
      const create = path === "/api/crates" && method === "POST";
      const edit = match && (dubId ? ["PUT", "DELETE"].includes(method) : ["PATCH", "DELETE"].includes(method));
      if (create || edit) {
        const input = ["POST", "PATCH"].includes(method) ? await readInput(request) : {};
        const fingerprint = createHash("sha256").update(JSON.stringify([
          method, id || null, dubId || null, input.name ?? null,
        ])).digest("hex");
        const result = await store.command(token, request.headers["idempotency-key"], fingerprint,
          (client, user) => mutateCrate(client, user, { method, id, dubId, input }));
        return json(response, result.status, result.body);
      }
      throw httpError(404, "Endpoint not found in Stage A.");
    } catch (error) {
      logger.error("Stage A request failed.", { requestId, code: error.code ?? error.name });
      let status = error.status ?? (error.code === "23505" ? 409 : 503);
      let message = error.status ? error.message : error.code === "23505" ? "A conflicting record already exists." : "Stage A database operation failed.";
      if (error instanceof URIError) {
        status = 400;
        message = "Malformed request path.";
      }
      if (!response.headersSent && !response.destroyed) json(response, status, { error: message });
      else response.destroy();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
