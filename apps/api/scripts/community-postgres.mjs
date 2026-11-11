import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createCommunityPostgres, readCommunityDatabaseConfig, validateCommunityState } from "../src/communityPostgres.mjs";
import { createSeedState, normalizeCommunityData } from "../src/server.mjs";

export async function inspectImport(source, mediaDirectory) {
  if (!isAbsolute(source) || !isAbsolute(mediaDirectory)) throw new Error("Import source and media paths must be explicit absolute paths.");
  const sourceInfo = await stat(source);
  if (!sourceInfo.isFile() || sourceInfo.size > 64 * 1024 * 1024) throw new Error("Import source must be a regular JSON file no larger than 64 MiB.");
  const root = await realpath(mediaDirectory);
  const initial = normalizeCommunityData(JSON.parse(await readFile(source, "utf8")), root);
  validateCommunityState(initial);
  const names = new Set([
    ...initial.dubs.flatMap((item) => [item.storedAudioName, item.storedArtworkName]),
    ...initial.users.flatMap((item) => [item.avatarStoredName, item.bannerStoredName]),
    ...initial.uploads.map((item) => item.storedName),
    ...initial.packs.map((item) => item.fallbackArtworkName),
  ].filter(Boolean));
  const media = [];
  for (const name of names) {
    if (typeof name !== "string" || basename(name) !== name || /[/\\]/.test(name) || name === "." || name === "..") {
      throw new Error("Import contains an unsafe media reference.");
    }
    const path = resolve(root, name);
    if (await realpath(path) !== path) throw new Error("Import refuses symlinked media references.");
    const info = await stat(path);
    if (!info.isFile() || info.size === 0) throw new Error("Import contains missing, empty or non-file media.");
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    media.push({ name, bytes: info.size, checksum: hash.digest("hex") });
  }
  if (initial.dubs.some((dub) => dub.audioSource !== "upload")) {
    throw new Error("Import of public/seed audio requires an explicit media migration; refusing to guess its location.");
  }
  return { initial, media, counts: Object.fromEntries(Object.entries(initial).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let storage;
  try {
    const command = process.argv[2];
    if (!["migrate", "seed-synthetic", "inspect-import", "import"].includes(command)) {
      throw new Error("Use migrate, seed-synthetic, inspect-import or import.");
    }
    if (command === "inspect-import" || command === "import") {
      const source = process.env.COMMUNITY_IMPORT_PATH;
      const mediaDirectory = process.env.COMMUNITY_MEDIA_DIRECTORY;
      if (!source || !mediaDirectory) throw new Error("COMMUNITY_IMPORT_PATH and COMMUNITY_MEDIA_DIRECTORY are required.");
      const inspected = await inspectImport(source, mediaDirectory);
      console.info("Community import inspection passed.", { counts: inspected.counts, verifiedMedia: inspected.media.length });
      if (command === "import") {
        if (process.env.COMMUNITY_IMPORT_ACK !== "offline-backup-verified") {
          throw new Error("Import requires COMMUNITY_IMPORT_ACK=offline-backup-verified and a stopped source API.");
        }
        storage = createCommunityPostgres(readCommunityDatabaseConfig());
        await storage.initialize(inspected.initial);
        console.info("Community import committed; source JSON and media were not changed.");
      }
    } else {
      const config = readCommunityDatabaseConfig();
      storage = createCommunityPostgres(config);
      if (command === "migrate") {
        await storage.migrate();
        console.info("Community PostgreSQL schema migrated; no records imported or seeded.");
      } else {
        if (process.env.NODE_ENV === "production" || process.env.COMMUNITY_SYNTHETIC_ACK !== "disposable-local-only"
          || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.connectionString).hostname)) {
          throw new Error("Synthetic accounts are local-only; require COMMUNITY_SYNTHETIC_ACK=disposable-local-only outside production.");
        }
        await storage.initialize(createSeedState());
        console.info("Community disposable synthetic fixtures initialized.");
      }
    }
  } catch (error) {
    console.error("Community database command failed.", {
      code: error.code ?? error.name,
      message: error.code || error instanceof SyntaxError
        ? "Verify isolated connection, schema, JSON format, constraints and filesystem access." : error.message,
    });
    process.exitCode = 1;
  } finally { if (storage) await storage.close(); }
}
