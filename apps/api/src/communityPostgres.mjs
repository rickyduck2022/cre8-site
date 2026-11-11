import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { commitContext } from "./commitEffects.mjs";

export const communityCollections = [
  "users", "artists", "dubs", "friendships", "conversations", "likes",
  "downloads", "crates", "uploads", "dubGrants", "aListApplications",
  "aListAccessDecisions", "notifications", "dubShares", "pushSubscriptions", "packs",
];
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function readCommunityDatabaseConfig(env = process.env) {
  if (env.COMMUNITY_STORAGE !== "postgres") throw new Error("Explicit COMMUNITY_STORAGE=postgres is required.");
  const name = env.COMMUNITY_DATABASE_NAME;
  if (!/^cre8_community_[a-z0-9_]{3,32}$/.test(name ?? "")) {
    throw new Error("COMMUNITY_DATABASE_NAME must be cre8_community_<3-32 lowercase letters/digits/underscores>.");
  }
  let url;
  try { url = new URL(env.COMMUNITY_DATABASE_URL); }
  catch { throw new Error("COMMUNITY_DATABASE_URL must identify the dedicated community PostgreSQL database."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname !== `/${name}` || url.hash
    || [...url.searchParams.keys()].some((key) => key !== "sslmode")
    || url.searchParams.getAll("sslmode").length > 1
    || (url.searchParams.has("sslmode") && url.searchParams.get("sslmode") !== "verify-full")
    || (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.searchParams.get("sslmode") !== "verify-full")) {
    throw new Error("Use the explicit dedicated database name, verified remote TLS and no connection overrides.");
  }
  return { connectionString: url.href, name };
}

export function validateCommunityState(data) {
  if (!data || data.schemaVersion !== 7
    || Object.keys(data).some((key) => key !== "schemaVersion" && !communityCollections.includes(key))) {
    throw new Error("Import requires an exact supported version-7 community state.");
  }
  for (const key of communityCollections) {
    if (!Array.isArray(data[key]) || data[key].some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
      throw new Error(`Invalid community collection: ${key}.`);
    }
  }
  const users = new Set(data.users.map((user) => user.id));
  const dubs = new Set(data.dubs.map((dub) => dub.id));
  const artists = new Set(data.artists.map((artist) => artist.id));
  const uploadIds = new Set(data.uploads.map((upload) => upload.id));
  const packs = new Set(data.packs.map((pack) => pack.id));
  const requireReference = (set, id) => {
    if (typeof id !== "string" || !set.has(id)) throw new Error("Community import contains a dangling domain reference.");
  };
  for (const user of data.users) {
    if (typeof user.id !== "string" || !/^[a-z0-9._-]{3,24}$/i.test(user.username ?? "")
      || !/^[a-f0-9]{32}$/i.test(user.passwordSalt ?? "") || !/^[a-f0-9]{128}$/i.test(user.passwordHash ?? "")) {
      throw new Error("Community users require valid identities and existing password hashes.");
    }
  }
  for (const artist of data.artists) requireReference(users, artist.userId);
  for (const dub of data.dubs) {
    requireReference(users, dub.uploaderId);
    requireReference(artists, dub.artistId);
    if (dub.audioSource === "upload" && (typeof dub.storedAudioName !== "string" || !dub.storedAudioName)) {
      throw new Error("Uploaded community dubs require an explicit original media reference.");
    }
    if (dub.draftPackId) requireReference(packs, dub.draftPackId);
  }
  for (const friendship of data.friendships) {
    requireReference(users, friendship.ownerId);
    requireReference(users, friendship.friendUserId);
  }
  for (const key of ["likes", "downloads", "dubGrants", "crates", "uploads", "aListApplications", "aListAccessDecisions", "notifications", "pushSubscriptions"]) {
    for (const item of data[key]) {
      requireReference(users, item.userId);
      if (item.dubId) requireReference(dubs, item.dubId);
      for (const id of item.dubIds ?? []) requireReference(dubs, id);
    }
  }
  for (const pack of data.packs) {
    requireReference(users, pack.ownerId);
    for (const id of pack.dubIds ?? []) requireReference(dubs, id);
    for (const grant of pack.grants ?? []) requireReference(users, grant.userId);
    if (pack.artworkUploadId) requireReference(uploadIds, pack.artworkUploadId);
  }
  for (const share of data.dubShares) {
    requireReference(dubs, share.dubId);
    requireReference(users, share.senderId);
    requireReference(users, share.recipientId);
  }
  const friendships = new Set(data.friendships.map((item) => item.id));
  for (const conversation of data.conversations) {
    requireReference(users, conversation.ownerId);
    requireReference(friendships, conversation.buddyId);
  }
}

async function migration() {
  const sql = (await readFile(new URL("./community-postgres.sql", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
  return { sql, checksum: createHash("sha256").update(sql).digest("hex") };
}

export function createCommunityPostgres(config, { logger = console } = {}) {
  config = readCommunityDatabaseConfig({
    COMMUNITY_STORAGE: "postgres", COMMUNITY_DATABASE_URL: config.connectionString, COMMUNITY_DATABASE_NAME: config.name,
  });
  const pool = new pg.Pool({
    connectionString: config.connectionString, max: 3, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000, statement_timeout: 10000, lock_timeout: 5000,
    idle_in_transaction_session_timeout: 120000, application_name: "cre8-community-compat",
  });
  pool.on("error", (error) => logger.error("Community idle database connection failed.", { code: error.code }));
  let queue = Promise.resolve();
  let pending = 0;
  const state = () => {
    const current = commitContext.getStore();
    if (!current || current.owner !== storage) throw new Error("Community state accessed outside its transaction.");
    return current;
  };
  const data = new Proxy({}, {
    get: (_, key) => state().data[key],
    set: (_, key, value) => { state().data[key] = value; return true; },
    ownKeys: () => Reflect.ownKeys(state().data),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  const sessions = {
    get(token) { return /^[a-f0-9]{64}$/.test(token ?? "") ? state().sessions.get(hashToken(token)) : undefined; },
    set(token, session) { state().sessions.set(hashToken(token), session); },
    delete(token) { if (typeof token === "string") state().sessions.delete(hashToken(token)); },
  };
  async function check(client, { allowEmpty = false } = {}) {
    const { checksum } = await migration();
    const { rows } = await client.query("SELECT * FROM cre8_community.metadata WHERE singleton = true FOR UPDATE");
    if (rows.length !== 1 || rows[0].migration_checksum !== checksum || rows[0].data_schema !== 7
      || (!allowEmpty && !rows[0].initialized)) {
      throw new Error("Community database schema/checksum mismatch or missing explicit initialization.");
    }
    return rows[0];
  }
  async function writeCollections(client, data, original) {
    for (const key of communityCollections) {
      const encoded = JSON.stringify(data[key]);
      if (encoded === original.get(key)) continue;
      await client.query("DELETE FROM cre8_community.records WHERE collection = $1", [key]);
      await client.query(`INSERT INTO cre8_community.records(collection, position, payload)
        SELECT $1, ordinal::integer - 1, value FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS item(value, ordinal)`,
      [key, encoded]);
    }
  }
  const storage = {
    pool, data, sessions,
    markDirty() { state().dirty = true; },
    async migrate() {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(794821010)");
        const existing = await client.query("SELECT to_regnamespace('cre8_community') AS namespace");
        if (!existing.rows[0].namespace) {
          const foreign = await client.query("SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND schemaname NOT LIKE 'pg_toast%'");
          if (foreign.rowCount) throw new Error("Refusing to initialize community storage in a database containing other tables.");
          const { sql, checksum } = await migration();
          await client.query(sql);
          await client.query("INSERT INTO cre8_community.metadata(singleton, migration_checksum, data_schema) VALUES (true, $1, 7)", [checksum]);
        } else await check(client, { allowEmpty: true });
        await client.query("COMMIT");
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch (rollbackError) {
          logger.error("Community migration rollback failed.", { code: rollbackError.code ?? rollbackError.name });
          client.release(true);
          throw error;
        }
        client.release();
        throw error;
      }
      client.release();
    },
    async initialize(initial) {
      validateCommunityState(initial);
      const client = await pool.connect();
      let discard = false;
      try {
        await client.query("BEGIN");
        const metadata = await check(client, { allowEmpty: true });
        const existing = await client.query("SELECT 1 FROM cre8_community.records LIMIT 1");
        if (metadata.initialized || existing.rowCount) throw new Error("Community import/seed refuses to overwrite an existing database.");
        await writeCollections(client, initial, new Map());
        await client.query("UPDATE cre8_community.metadata SET initialized = true, revision = revision + 1");
        await client.query("COMMIT");
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch (rollbackError) {
          discard = true;
          logger.error("Community import rollback failed.", { code: rollbackError.code ?? rollbackError.name });
        }
        throw error;
      } finally { client.release(discard); }
    },
    run(token, work) {
      if (pending >= 16) return Promise.reject(Object.assign(new Error("Community transaction admission limit reached."), { code: "COMMUNITY_BUSY" }));
      pending++;
      const execute = async () => {
        const client = await pool.connect();
        const context = {
          owner: storage, effects: [], rollbackEffects: [], response: null, status: 200,
          sessions: new Map(), data: { schemaVersion: 7 }, dirty: false, finished: false,
        };
        let discard = false;
        let committing = false;
        try {
          await client.query("BEGIN");
          await check(client);
          const result = await client.query("SELECT collection, payload FROM cre8_community.records ORDER BY collection, position");
          for (const key of communityCollections) context.data[key] = [];
          for (const row of result.rows) context.data[row.collection].push(row.payload);
          const original = new Map(communityCollections.map((key) => [key, JSON.stringify(context.data[key])]));
          if (/^[a-f0-9]{64}$/.test(token ?? "")) {
            const result = await client.query("SELECT user_id, expires_at FROM cre8_community.sessions WHERE token_hash = $1 AND expires_at > now()", [hashToken(token)]);
            if (result.rowCount) context.sessions.set(hashToken(token), { userId: result.rows[0].user_id, expiresAt: result.rows[0].expires_at.getTime() });
          }
          const originalSessions = new Map(context.sessions);
          return await commitContext.run(context, async () => {
            const value = await work();
            if (context.status >= 400) {
              await client.query("ROLLBACK");
              context.finished = true;
              for (const effect of context.rollbackEffects) await effect();
            } else {
              if (context.dirty) {
                await writeCollections(client, context.data, original);
                await client.query("UPDATE cre8_community.metadata SET revision = revision + 1");
              }
              for (const [hash, session] of context.sessions) {
                if (originalSessions.get(hash) === session) continue;
                await client.query("INSERT INTO cre8_community.sessions(token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [hash, session.userId, new Date(session.expiresAt)]);
              }
              for (const hash of originalSessions.keys()) {
                if (!context.sessions.has(hash)) await client.query("DELETE FROM cre8_community.sessions WHERE token_hash = $1", [hash]);
              }
              await client.query("DELETE FROM cre8_community.sessions WHERE expires_at <= now()");
              committing = true;
              await client.query("COMMIT");
              context.finished = true;
              for (const effect of context.effects) {
                try { await effect(); }
                catch (error) { logger.error("Community post-commit effect failed.", { code: error.code ?? error.name }); }
              }
            }
            await context.response?.();
            return value;
          });
        } catch (error) {
          try { await client.query("ROLLBACK"); } catch (rollbackError) {
            discard = true;
            logger.error("Community transaction rollback failed.", { code: rollbackError.code ?? rollbackError.name });
          }
          if (!discard && !committing && !context.finished) {
            for (const effect of context.rollbackEffects) {
              try { await effect(); }
              catch (cleanupError) { logger.error("Community rollback cleanup failed.", { code: cleanupError.code ?? cleanupError.name }); }
            }
          }
          // A lost COMMIT acknowledgment is ambiguous: leave new media for reconciliation.
          throw error;
        } finally { client.release(discard); }
      };
      const result = queue.then(execute).finally(() => { pending--; });
      queue = result.catch(() => {});
      return result;
    },
    close: () => pool.end(),
  };
  return storage;
}
