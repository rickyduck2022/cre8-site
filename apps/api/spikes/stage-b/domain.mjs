import { randomUUID } from "node:crypto";
import { httpError } from "../stage-a/store.mjs";
import { audienceAccess, describeDub, dubAccess, loadPack, packAccess, packItems, userPolicy } from "./policy.mjs";

export async function mediaLock(client) {
  // The small POC serializes media commands; replace with measured row-level locking before scale.
  await client.query("SELECT pg_advisory_xact_lock(794821004)");
}

function text(value, label, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw httpError(400, `Provide valid ${label}.`);
  return value.trim();
}

function audience(input, user) {
  const distribution = input.distribution ?? "worldwide";
  if (!["worldwide", "private", "alist"].includes(distribution)) throw httpError(400, "Invalid distribution.");
  if (input.aListPublic !== undefined && typeof input.aListPublic !== "boolean") throw httpError(400, "Invalid A-List audience.");
  if (input.aListPublic && distribution !== "alist") throw httpError(400, "Public A-List requires A-List distribution.");
  if (distribution === "alist" && !user.a_list_approved) throw httpError(403, "A-List approval is required.");
  return { distribution, public: input.aListPublic === true };
}

export async function ownedPack(client, id, user) {
  const pack = await loadPack(client, id, { lock: true });
  if (pack.owner_id !== user.id) throw httpError(404, "Pack not found.");
  return pack;
}

async function newDub(client, user, input, pack) {
  const id = randomUUID();
  const title = text(input.title, "track title", 100);
  const policy = pack ? { distribution: pack.distribution, public: pack.a_list_public } : audience(input, user);
  const asset = await client.query("SELECT id FROM media_assets WHERE id = $1 AND owner_id = $2 AND state = 'ready' FOR UPDATE",
    [input.uploadId, user.id]);
  if (!asset.rowCount) throw httpError(409, "Choose your validated ready upload.");
  await client.query(`
    INSERT INTO media_dubs(id, owner_id, asset_id, title, distribution, a_list_public, draft_pack_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [id, user.id, input.uploadId, title, policy.distribution, policy.public, pack?.status === "draft" ? pack.id : null]);
  return id;
}

async function replaceItems(client, pack, ids, confirm) {
  if (!Array.isArray(ids) || ids.length > 50 || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length
    || (pack.status === "published" && !ids.length)) throw httpError(400, "Provide up to 50 unique ordered tracks; published packs cannot be empty.");
  const old = await packItems(client, pack.id);
  if (pack.status === "published" && ids.some((id) => !old.some((dub) => dub.id === id))
    && (await client.query("SELECT 1 FROM media_pack_grants WHERE pack_id = $1 LIMIT 1", [pack.id])).rowCount && confirm !== true) {
    throw httpError(409, "Confirm new access for existing recipients.");
  }
  for (const id of ids) {
    const { rows } = await client.query("SELECT * FROM media_dubs WHERE id = $1", [id]);
    const dub = rows[0];
    if (!dub || dub.owner_id !== pack.owner_id || (dub.draft_pack_id && dub.draft_pack_id !== pack.id)
      || dub.distribution !== pack.distribution || dub.a_list_public !== pack.a_list_public) {
      throw httpError(409, "Pack tracks must belong to you and have the exact same audience.");
    }
  }
  await client.query("DELETE FROM media_pack_items WHERE pack_id = $1", [pack.id]);
  for (const [position, id] of ids.entries()) {
    await client.query("INSERT INTO media_pack_items(pack_id, dub_id, position) VALUES ($1, $2, $3)", [pack.id, id, position]);
  }
}

export async function packDescription(client, pack) {
  const dubs = [];
  for (const item of await packItems(client, pack.id)) dubs.push(await describeDub(client, item));
  return { id: pack.id, title: pack.title, kind: pack.kind, distribution: pack.distribution,
    aListPublic: pack.a_list_public, licence: pack.licence, status: pack.status, revision: pack.revision, dubs };
}

export async function mediaCommand(client, currentUser, { resource, id, action, target, input, method }, disk) {
  await mediaLock(client);
  const user = await userPolicy(client, currentUser);
  if (resource === "dubs" && !id) {
    const dubId = await newDub(client, user, input);
    return { status: 201, body: await describeDub(client, (await client.query("SELECT * FROM media_dubs WHERE id = $1", [dubId])).rows[0]),
      eventType: "dub.created" };
  }
  if (resource === "packs" && !id) {
    const policy = audience(input, user);
    const title = text(input.title, "pack title", 100);
    const kind = input.kind ?? "dub";
    if (!["dub", "sample"].includes(kind)) throw httpError(400, "Invalid pack kind.");
    if (input.licence !== undefined && (typeof input.licence !== "string" || input.licence.length > 5000)) throw httpError(400, "Invalid licence.");
    const packId = randomUUID();
    await client.query(`
      INSERT INTO media_packs(id, owner_id, title, kind, distribution, a_list_public, licence)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [packId, user.id, title, kind, policy.distribution, policy.public, input.licence?.trim() ?? ""]);
    const pack = await loadPack(client, packId);
    if (input.dubIds) await replaceItems(client, pack, input.dubIds, false);
    return { status: 201, body: await packDescription(client, pack), eventType: "pack.created" };
  }
  if (resource === "dubs" && action === "grants") {
    const { rows } = await client.query("SELECT * FROM media_dubs WHERE id = $1 AND owner_id = $2 AND distribution = 'private'", [id, user.id]);
    if (!rows.length) throw httpError(404, "Private track not found.");
    const recipient = target ?? input.userId;
    if (!(await client.query("SELECT 1 FROM users WHERE id = $1", [recipient])).rowCount) throw httpError(404, "Recipient not found.");
    if (method === "DELETE") await client.query("DELETE FROM media_dub_grants WHERE dub_id = $1 AND user_id = $2", [id, recipient]);
    else await client.query("INSERT INTO media_dub_grants(dub_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, recipient]);
    return { status: 200, body: { id }, eventType: "dub.grants.changed" };
  }
  if (resource !== "packs") throw httpError(404, "Media command not found.");
  if (action === "archive") {
    const pack = await loadPack(client, id, { lock: true });
    if (pack.status !== "published" || !await packAccess(client, pack, user)) throw httpError(404, "Pack not found.");
    const jobId = randomUUID();
    const { rows } = await client.query(`
      INSERT INTO media_jobs(id, kind, pack_id, revision) VALUES ($1, 'archive', $2, $3)
      ON CONFLICT (pack_id, revision) WHERE kind = 'archive' DO UPDATE SET pack_id = EXCLUDED.pack_id
      RETURNING id, state
    `, [jobId, id, pack.revision]);
    return { status: 202, body: { id: rows[0].id, state: rows[0].state, revision: pack.revision }, eventType: "archive.requested" };
  }
  const pack = await ownedPack(client, id, user);
  if (pack.distribution === "alist" && !user.a_list_approved && ["tracks", "publish"].includes(action)) {
    throw httpError(403, "A-List approval is required.");
  }
  if (action === "messages") {
    if (method !== "POST" || pack.status !== "published") throw httpError(409, "Publish the pack before sharing.");
    const recipient = await userPolicy(client, { id: input.recipientId });
    if (!recipient || recipient.id === user.id) throw httpError(400, "Choose another existing recipient.");
    if (!(await client.query("SELECT 1 FROM media_friendships WHERE owner_id = $1 AND friend_id = $2", [user.id, recipient.id])).rowCount) {
      throw httpError(404, "Choose an existing friend.");
    }
    const message = text(input.text, "message text", 2000);
    if (!audienceAccess(pack, recipient) && pack.distribution === "alist") throw httpError(403, "Recipient requires A-List approval.");
    if (pack.distribution === "private" && !await packAccess(client, pack, recipient)) {
      if (input.confirmPackAccess !== true) throw httpError(409, "Confirm access to all pack files.");
      await client.query("INSERT INTO media_pack_grants(pack_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, recipient.id]);
    }
    const messageId = randomUUID();
    await client.query("INSERT INTO media_messages(id, sender_id, recipient_id, pack_id, text) VALUES ($1, $2, $3, $4, $5)",
      [messageId, user.id, recipient.id, id, message]);
    await client.query("INSERT INTO outbox(user_id, event_type, aggregate_id) VALUES ($1, 'message.received', $2)", [recipient.id, messageId]);
    return { status: 201, body: { id: messageId, packId: id }, eventType: "message.sent" };
  }
  if (action === "grants" && method === "DELETE") {
    await client.query("DELETE FROM media_pack_grants WHERE pack_id = $1 AND user_id = $2", [id, target]);
  } else if (action === "tracks" && method === "POST") {
    const dubId = await newDub(client, user, input, pack);
    const items = await packItems(client, id);
    await replaceItems(client, pack, [...items.map((dub) => dub.id), dubId], input.confirmNewAccess);
    if (pack.status === "published") await validatePublish(client, pack, disk);
  } else if (action === "publish") {
    if (pack.distribution === "alist" && !user.a_list_approved) throw httpError(403, "A-List approval is required.");
    await validatePublish(client, pack, disk);
    await client.query("UPDATE media_packs SET status = 'published' WHERE id = $1", [id]);
    await client.query("UPDATE media_dubs SET draft_pack_id = NULL WHERE draft_pack_id = $1 AND id IN (SELECT dub_id FROM media_pack_items WHERE pack_id = $1)", [id]);
  } else if (!action && method === "PATCH") {
    if (input.distribution !== undefined || input.aListPublic !== undefined) throw httpError(409, "This POC keeps the pack audience immutable.");
    const kind = input.kind ?? pack.kind;
    if (!["dub", "sample"].includes(kind)) throw httpError(400, "Invalid pack kind.");
    const title = input.title === undefined ? pack.title : text(input.title, "pack title", 100);
    const licence = input.licence === undefined ? pack.licence : typeof input.licence === "string" && input.licence.length <= 5000 ? input.licence.trim() : null;
    if (licence === null) throw httpError(400, "Invalid licence.");
    await client.query("UPDATE media_packs SET kind = $2, title = $3, licence = $4 WHERE id = $1", [id, kind, title, licence]);
    if (input.dubIds !== undefined) await replaceItems(client, pack, input.dubIds, input.confirmNewAccess);
    if (pack.status === "published") await validatePublish(client, { ...pack, kind, licence }, disk);
  } else {
    throw httpError(404, "Pack command not found.");
  }
  await client.query("UPDATE media_packs SET revision = revision + 1 WHERE id = $1", [id]);
  return { status: 200, body: await packDescription(client, await loadPack(client, id)), eventType: "pack.changed" };
}

async function validatePublish(client, pack, disk) {
  const items = await packItems(client, pack.id);
  if (!items.length || items.length > 50) throw httpError(400, "Publish between 1 and 50 tracks.");
  if (pack.kind === "sample" && !pack.licence.trim()) throw httpError(400, "Sample packs require written usage terms.");
  let total = 0;
  for (const item of items) {
    if (item.asset_state !== "ready" || item.owner_id !== pack.owner_id || item.distribution !== pack.distribution
      || item.a_list_public !== pack.a_list_public) throw httpError(409, "Pack files must be ready and have the exact pack audience.");
    await disk.verify(item.stored_key, item.expected_bytes, item.checksum);
    total += Number(item.expected_bytes);
  }
  if (total > 500 * 1024 * 1024) throw httpError(413, "Packs cannot exceed 500 MiB.");
}

export async function catalogue(client, user, query = "") {
  const result = { dubs: [], packs: [] };
  for (const dub of (await client.query("SELECT * FROM media_dubs ORDER BY id")).rows) {
    if (!dub.draft_pack_id && await dubAccess(client, dub, user) && dub.title.toLowerCase().includes(query)) {
      result.dubs.push(await describeDub(client, dub));
    }
  }
  for (const pack of (await client.query("SELECT * FROM media_packs ORDER BY id")).rows) {
    if (await packAccess(client, pack, user)) result.packs.push(await packDescription(client, pack));
  }
  return result;
}
