import { httpError } from "../stage-a/store.mjs";

export async function userPolicy(client, user) {
  if (!user) return null;
  const { rows } = await client.query("SELECT id, a_list_approved FROM users WHERE id = $1", [user.id]);
  return rows[0] ?? null;
}

export function audienceAccess(item, user) {
  return !!user && (item.distribution === "worldwide"
    || (item.distribution === "alist" && (item.a_list_public || user.a_list_approved)));
}

export async function loadPack(client, id, { lock = false } = {}) {
  const { rows } = await client.query(`SELECT * FROM media_packs WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`, [id]);
  if (!rows.length) throw httpError(404, "Pack not found.");
  return rows[0];
}

export async function packAccess(client, pack, user, { guest = false } = {}) {
  if (user?.id === pack.owner_id) return true;
  if (pack.status !== "published") return false;
  if (!user) return guest && (pack.distribution === "worldwide" || (pack.distribution === "alist" && pack.a_list_public));
  if (audienceAccess(pack, user)) return true;
  return pack.distribution === "private" && !!(await client.query(
    "SELECT 1 FROM media_pack_grants WHERE pack_id = $1 AND user_id = $2", [pack.id, user.id],
  )).rowCount;
}

export async function dubAccess(client, dub, user, { guest = false } = {}) {
  if (!user) return guest && !dub.draft_pack_id
    && (dub.distribution === "worldwide" || (dub.distribution === "alist" && dub.a_list_public));
  if (dub.owner_id === user.id) return true;
  if (dub.draft_pack_id) return false;
  if (audienceAccess(dub, user)) return true;
  if (dub.distribution !== "private") return false;
  const result = await client.query(`
    SELECT 1 FROM media_dub_grants WHERE dub_id = $1 AND user_id = $2
    UNION ALL
    SELECT 1 FROM media_pack_items i JOIN media_packs p ON p.id = i.pack_id
      JOIN media_pack_grants g ON g.pack_id = p.id
    WHERE i.dub_id = $1 AND g.user_id = $2 AND p.status = 'published' AND p.distribution = 'private'
  `, [dub.id, user.id]);
  return !!result.rowCount;
}

export async function packItems(client, id) {
  return (await client.query(`
    SELECT d.*, a.state AS asset_state, a.stored_key, a.expected_bytes, a.checksum,
      a.preview_key, a.preview_bytes, a.preview_checksum, a.file_name
    FROM media_pack_items i JOIN media_dubs d ON d.id = i.dub_id JOIN media_assets a ON a.id = d.asset_id
    WHERE i.pack_id = $1 ORDER BY i.position
  `, [id])).rows;
}

export async function describeDub(client, dub) {
  const sample = await client.query(`
    SELECT 1 FROM media_pack_items i JOIN media_packs p ON p.id = i.pack_id
    WHERE i.dub_id = $1 AND p.kind = 'sample' AND p.status = 'published' LIMIT 1
  `, [dub.id]);
  return { id: dub.id, title: dub.title, distribution: dub.distribution, aListPublic: dub.a_list_public,
    mediaKind: sample.rowCount ? "sample" : "dub", audioUrl: `/api/dubs/${dub.id}/audio` };
}
