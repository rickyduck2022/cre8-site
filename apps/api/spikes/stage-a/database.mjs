import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const migrationUrls = [
  new URL("./001-initial.sql", import.meta.url),
  new URL("../stage-b/002-media.sql", import.meta.url),
];
export const schema = "cre8_stage_a";

async function loadMigrations() {
  return Promise.all(migrationUrls.map(async (url, index) => {
    const sql = (await readFile(url, "utf8")).replace(/\r\n?/g, "\n");
    return { version: index + 1, sql, checksum: createHash("sha256").update(sql).digest("hex") };
  }));
}

function checkVersions(versions, migrations, complete) {
  if ((complete && versions.length !== migrations.length) || versions.length > migrations.length
    || versions.some((row, index) => row.version !== migrations[index].version || row.checksum !== migrations[index].checksum)) {
    throw new Error("Spike schema version/checksum mismatch; use the matching code and isolated database.");
  }
}

export function readSpikeConfig(env = process.env) {
  const runId = env.SPIKE_RUN_ID;
  if (!/^[a-z0-9_]{3,32}$/.test(runId ?? "")) {
    throw new Error("SPIKE_RUN_ID must contain 3-32 lowercase letters, digits or underscores.");
  }
  let url;
  try {
    url = new URL(env.SPIKE_DATABASE_URL);
  } catch {
    throw new Error("SPIKE_DATABASE_URL must identify a disposable PostgreSQL database.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !url.hostname || url.pathname !== `/cre8_spike_${runId}` || url.hash
    || [...url.searchParams.keys()].some((key) => key !== "sslmode")
    || url.searchParams.getAll("sslmode").length > 1
    || (url.searchParams.has("sslmode") && url.searchParams.get("sslmode") !== "verify-full")) {
    throw new Error("Use a dedicated database named cre8_spike_<SPIKE_RUN_ID>; connection overrides are forbidden.");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    && url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("Remote Stage A databases require sslmode=verify-full.");
  }
  return { connectionString: url.href, runId };
}

export function createSpikeDatabase(config, { logger = console } = {}) {
  config = readSpikeConfig({ SPIKE_DATABASE_URL: config.connectionString, SPIKE_RUN_ID: config.runId });
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
    lock_timeout: 5000,
    idle_in_transaction_session_timeout: 10000,
    options: `-c search_path=${schema},pg_catalog`,
    application_name: `cre8-stage-a-${config.runId}`,
  });
  pool.on("error", (error) => logger.error("Stage A idle database connection failed.", { code: error.code }));
  async function transaction(work) {
    const client = await pool.connect();
    let discard = false;
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        discard = true;
        logger.error("Stage A transaction rollback failed.", { code: rollbackError.code });
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }
  return { pool, transaction, close: () => pool.end() };
}

export async function migrate(database) {
  const migrations = await loadMigrations();
  await database.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(794821003)");
    const { rows: foreignTables } = await client.query(`
      SELECT schemaname, tablename FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema', $1)
        AND schemaname NOT LIKE 'pg_toast%'
    `, [schema]);
    if (foreignTables.length) throw new Error("Stage A refuses a database containing non-spike tables.");
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    const { rows } = await client.query("SELECT to_regclass($1) AS relation", [`${schema}.schema_migrations`]);
    if (rows[0].relation) {
      const versions = await client.query("SELECT version, checksum FROM schema_migrations ORDER BY version");
      checkVersions(versions.rows, migrations, false);
      for (const migration of migrations.slice(versions.rows.length)) {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)", [migration.version, migration.checksum]);
      }
    } else {
      for (const migration of migrations) {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)", [migration.version, migration.checksum]);
      }
    }
  });
}

export async function verifySchema(database) {
  const migrations = await loadMigrations();
  const { rows } = await database.pool.query("SELECT version, checksum FROM schema_migrations ORDER BY version");
  checkVersions(rows, migrations, true);
}
