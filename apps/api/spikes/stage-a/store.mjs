import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export const sessionSeconds = 7 * 24 * 60 * 60;
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
export const httpError = (status, message) => Object.assign(new Error(message), { status });
const userFields = (row) => ({ id: row.id, username: row.username, displayName: row.display_name });

export async function authenticate(client, token, { lock = false } = {}) {
  if (!/^[a-f0-9]{64}$/.test(token ?? "")) throw httpError(401, "Sign in to continue.");
  const { rows } = await client.query(`
    SELECT u.id, u.username, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
    ${lock ? "FOR SHARE OF s" : ""}
  `, [hashToken(token)]);
  if (!rows.length) throw httpError(401, "Sign in to continue.");
  return userFields(rows[0]);
}

export function createStageAStore(database) {
  let hashing = 0;
  return {
    async login(input) {
      if (typeof input.username !== "string" || input.username.length > 100
        || typeof input.password !== "string" || !input.password.length || input.password.length > 128) {
        throw httpError(401, "Invalid username or password.");
      }
      if (hashing >= 4) throw httpError(503, "Credential processing is busy. Retry shortly.");
      hashing++;
      let account;
      let candidate;
      try {
        const { rows } = await database.pool.query("SELECT * FROM users WHERE username = $1",
          [input.username.trim().toLowerCase()]);
        account = rows[0];
        candidate = await derive(input.password, account?.password_salt ?? "stage-a-unknown-user", 64);
      } finally {
        hashing--;
      }
      if (!account || !timingSafeEqual(candidate, Buffer.from(account.password_hash, "hex"))) {
        throw httpError(401, "Invalid username or password.");
      }
      const token = randomBytes(32).toString("hex");
      await database.pool.query(`
        INSERT INTO sessions(token_hash, user_id, expires_at)
        VALUES ($1, $2, now() + $3 * interval '1 second')
      `, [hashToken(token), account.id, sessionSeconds]);
      return { user: userFields(account), token };
    },
    session: (token) => authenticate(database.pool, token),
    async logout(token) {
      if (/^[a-f0-9]{64}$/.test(token ?? "")) {
        await database.pool.query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1", [hashToken(token)]);
      }
    },
    async list(token) {
      return database.transaction(async (client) => {
        const user = await authenticate(client, token, { lock: true });
        return { crates: await queryCrates(client, user.id) };
      });
    },
    async command(token, key, fingerprint, work) {
      if (typeof key !== "string" || !/^[\x21-\x7e]{1,100}$/.test(key)) {
        throw httpError(400, "Provide an Idempotency-Key containing 1-100 visible ASCII characters.");
      }
      return database.transaction(async (client) => {
        const user = await authenticate(client, token, { lock: true });
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [JSON.stringify([user.id, key])]);
        const { rows } = await client.query("SELECT * FROM idempotency_records WHERE user_id = $1 AND key = $2", [user.id, key]);
        if (rows.length) {
          if (rows[0].fingerprint !== fingerprint) throw httpError(409, "Idempotency-Key was already used for a different request.");
          return { status: rows[0].status, body: rows[0].response };
        }
        const result = await work(client, user);
        await client.query(`
          INSERT INTO idempotency_records(user_id, key, fingerprint, status, response)
          VALUES ($1, $2, $3, $4, $5)
        `, [user.id, key, fingerprint, result.status, result.body]);
        await client.query("INSERT INTO outbox(user_id, event_type, aggregate_id) VALUES ($1, $2, $3)",
          [user.id, result.eventType ?? "crate.changed", result.body.id]);
        return result;
      });
    },
  };
}

async function queryCrates(client, userId, id = null) {
  const { rows } = await client.query(`
    SELECT c.id, c.name,
      COALESCE(array_agg(i.dub_id ORDER BY i.position) FILTER (
        WHERE d.id IS NOT NULL AND (d.distribution = 'worldwide' OR d.owner_id = c.user_id)
      ), ARRAY[]::text[]) AS dub_ids
    FROM crates c LEFT JOIN crate_items i ON i.crate_id = c.id
      LEFT JOIN fixture_dubs d ON d.id = i.dub_id
    WHERE c.user_id = $1 AND ($2::text IS NULL OR c.id = $2)
    GROUP BY c.id ORDER BY c.created_at, c.id
  `, [userId, id]);
  return rows.map((row) => ({ id: row.id, name: row.name, dubIds: row.dub_ids }));
}

export async function publicCrate(client, id, userId) {
  const crates = await queryCrates(client, userId, id);
  if (!crates.length) throw httpError(404, "Crate not found.");
  return crates[0];
}

export function crateName(input) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 60) {
    throw httpError(400, "Crate names must contain between 1 and 60 characters.");
  }
  const name = input.name.trim();
  return { name, key: name.toLocaleLowerCase() };
}

export async function mutateCrate(client, user, { method, id, dubId, input }) {
  if (!id) {
    const name = crateName(input);
    const createdId = randomUUID();
    await client.query("INSERT INTO crates(id, user_id, name, name_key) VALUES ($1, $2, $3, $4)",
      [createdId, user.id, name.name, name.key]);
    return { status: 201, body: { id: createdId, name: name.name, dubIds: [] } };
  }
  const locked = await client.query("SELECT id FROM crates WHERE id = $1 AND user_id = $2 FOR UPDATE", [id, user.id]);
  if (!locked.rowCount) throw httpError(404, "Crate not found.");
  if (!dubId && method === "DELETE") {
    await client.query("DELETE FROM crates WHERE id = $1", [id]);
    return { status: 200, body: { id } };
  }
  if (!dubId && method === "PATCH") {
    const name = crateName(input);
    await client.query("UPDATE crates SET name = $1, name_key = $2 WHERE id = $3", [name.name, name.key, id]);
  } else if (method === "PUT") {
    const dub = await client.query(`
      SELECT id FROM fixture_dubs WHERE id = $1 AND (distribution = 'worldwide' OR owner_id = $2) FOR SHARE
    `, [dubId, user.id]);
    if (!dub.rowCount) throw httpError(404, "Crate or dub not found.");
    await client.query(`
      INSERT INTO crate_items(crate_id, dub_id, position)
      SELECT $1, $2, COALESCE(max(position) + 1, 0) FROM crate_items WHERE crate_id = $1
      ON CONFLICT (crate_id, dub_id) DO NOTHING
    `, [id, dubId]);
  } else {
    await client.query("DELETE FROM crate_items WHERE crate_id = $1 AND dub_id = $2", [id, dubId]);
  }
  return { status: 200, body: await publicCrate(client, id, user.id) };
}
