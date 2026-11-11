import { createHash } from "node:crypto";
import { authenticate, httpError } from "../stage-a/store.mjs";
import { createStageAServer, json, readInput } from "../stage-a/server.mjs";
import { catalogue, mediaCommand, mediaLock, packDescription } from "./domain.mjs";
import { createDiskStore, streamFile } from "./disk.mjs";
import { describeDub, dubAccess, loadPack, packAccess, userPolicy } from "./policy.mjs";
import { receiveUpload, reserveUpload } from "./media.mjs";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

export async function createStageBServer({ database, directory, runId, logger = console, admit }) {
  const disk = await createDiskStore(directory, runId);
  async function read(token, work) {
    return database.transaction(async (client) => {
      await mediaLock(client);
      const user = token ? await userPolicy(client, await authenticate(client, token, { lock: true })) : null;
      return work(client, user);
    });
  }
  const mediaRoutes = async ({ request, response, path, method, token, store }) => {
    const match = path.match(/^\/api\/(uploads|dubs|packs)(?:\/([^/]+))?(?:\/(audio|archive|publish|tracks|messages|grants))?(?:\/([^/]+))?$/);
    if (method === "GET" && ["/api/community", "/api/dubs/search", "/api/messages"].includes(path)) {
      const user = await store.session(token);
      const body = await read(token, async (client, policy) => {
        if (path === "/api/messages") {
          const { rows } = await client.query("SELECT id, sender_id, recipient_id, pack_id, text FROM media_messages WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at", [user.id]);
          return { messages: rows };
        }
        return catalogue(client, policy, new URL(request.url, "http://localhost").searchParams.get("q")?.trim().toLowerCase().slice(0, 120) ?? "");
      });
      json(response, 200, body);
      return true;
    }
    if (!match) return false;
    const [, resource, encodedId, action, encodedTarget] = match;
    const id = encodedId && decodeURIComponent(encodedId);
    const target = encodedTarget && decodeURIComponent(encodedTarget);
    if (resource === "uploads" && id && method === "PUT" && !action) {
      const user = await store.session(token);
      const body = await receiveUpload(database, disk, user, id, request, logger);
      json(response, 202, body);
      return true;
    }
    if (resource === "uploads" && id && method === "GET") {
      const user = await store.session(token);
      const { rows } = await database.pool.query("SELECT id, state, expected_bytes FROM media_assets WHERE id = $1 AND owner_id = $2", [id, user.id]);
      if (!rows.length) throw httpError(404, "Upload not found.");
      json(response, 200, { id, state: rows[0].state, bytes: Number(rows[0].expected_bytes) });
      return true;
    }
    if (id && ["GET", "HEAD"].includes(method) && ["packs", "dubs"].includes(resource)) {
      let file;
      const result = await read(token, async (client, user) => {
        if (resource === "packs") {
          const pack = await loadPack(client, id);
          if (!await packAccess(client, pack, user, { guest: true })) throw httpError(404, "Pack not found.");
          if (action === "archive") {
            if (!user || pack.status !== "published") throw httpError(404, "Archive not found.");
            const { rows } = await client.query("SELECT * FROM media_jobs WHERE pack_id = $1 AND revision = $2 AND kind = 'archive' AND state = 'done'", [id, pack.revision]);
            if (!rows.length) throw httpError(409, "Archive is not ready for this revision.");
            file = { key: rows[0].result_key, bytes: rows[0].result_bytes, checksum: rows[0].result_checksum,
              type: "application/zip", name: `${pack.title}.zip` };
          } else if (!action) return packDescription(client, pack);
          else throw httpError(404, "Pack resource not found.");
        } else {
          const { rows } = await client.query(`
            SELECT d.*, a.state AS asset_state, a.stored_key, a.expected_bytes, a.checksum,
              a.preview_key, a.preview_bytes, a.preview_checksum, a.file_name
            FROM media_dubs d JOIN media_assets a ON a.id = d.asset_id WHERE d.id = $1
          `, [id]);
          const dub = rows[0];
          if (!dub || !await dubAccess(client, dub, user, { guest: true })) throw httpError(404, "Track not found.");
          if (!action) return describeDub(client, dub);
          if (action !== "audio" || dub.asset_state !== "ready") throw httpError(404, "Track audio not found.");
          const download = new URL(request.url, "http://localhost").searchParams.has("download");
          if (!user && download) throw httpError(401, "Sign in to download originals.");
          file = user ? { key: dub.stored_key, bytes: dub.expected_bytes, checksum: dub.checksum,
            type: "application/octet-stream", name: download ? dub.file_name : undefined }
            : { key: dub.preview_key, bytes: dub.preview_bytes, checksum: dub.preview_checksum, type: "audio/wav" };
        }
        // Verify bytes while command serialization still protects the permission check.
        await disk.verify(file.key, file.bytes, file.checksum);
      });
      if (file) {
        // Recheck after filesystem I/O before opening a new transfer.
        await read(token, async (client, user) => {
          if (resource === "packs") {
            const pack = await loadPack(client, id);
            if (!user || !await packAccess(client, pack, user)) throw httpError(404, "Pack not found.");
            const current = await client.query("SELECT 1 FROM media_jobs WHERE pack_id = $1 AND revision = $2 AND result_key = $3 AND state = 'done'", [id, pack.revision, file.key]);
            if (!current.rowCount) throw httpError(409, "Archive revision changed.");
          } else {
            const dub = (await client.query("SELECT * FROM media_dubs WHERE id = $1", [id])).rows[0];
            if (!dub || !await dubAccess(client, dub, user, { guest: true })) throw httpError(404, "Track not found.");
          }
        });
        await streamFile(request, response, disk, file);
      } else json(response, 200, result);
      return true;
    }
    const allowed = (resource === "uploads" && ((!id && method === "POST") || (id && method === "DELETE")))
      || (resource === "dubs" && ((!id && method === "POST") || (id && action === "grants" && ["POST", "DELETE"].includes(method))))
      || (resource === "packs" && ((!id && method === "POST") || (id && !action && method === "PATCH")
        || (id && ["archive", "publish", "tracks", "messages"].includes(action) && method === "POST")
        || (id && action === "grants" && target && method === "DELETE")));
    if (!allowed) throw httpError(404, "Media endpoint not found.");
    const input = ["POST", "PATCH"].includes(method) ? await readInput(request) : {};
    const fingerprint = createHash("sha256").update(JSON.stringify(stable([method, path, input]))).digest("hex");
    const result = await store.command(token, request.headers["idempotency-key"], fingerprint, async (client, user) => {
      if (resource === "uploads") {
        if (!id) return reserveUpload(client, user, input, disk);
        await mediaLock(client);
        const used = await client.query("SELECT 1 FROM media_dubs WHERE asset_id = $1", [id]);
        if (used.rowCount) throw httpError(409, "Upload is referenced by a track.");
        const updated = await client.query("UPDATE media_assets SET state = 'deleting' WHERE id = $1 AND owner_id = $2 AND state <> 'deleted' RETURNING id", [id, user.id]);
        if (!updated.rowCount) throw httpError(404, "Upload not found.");
        return { status: 200, body: { id, state: "deleting" }, eventType: "upload.deleting" };
      }
      return mediaCommand(client, user, { resource, id, action, target, input, method }, disk);
    });
    json(response, result.status, result.body);
    return true;
  };
  const server = await createStageAServer({ database, logger, mediaRoutes, admit });
  server.requestTimeout = 180000;
  return { server, disk };
}
