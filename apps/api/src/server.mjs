import { closeSync, createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { createPushService, validPushSubscription } from "./push.mjs";
import { createAudioPreviewService, dubPreviewSeconds, previewDurations } from "./audioPreview.mjs";
import { storedZip } from "./zipStore.mjs";
import { parseWindowWorkspace } from "./windowWorkspace.mjs";
import { afterCommit, afterRollback, commitContext, respondAfterCommit } from "./commitEffects.mjs";

const apiDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultDataPath = resolve(process.env.COMMUNITY_DATA_PATH ?? resolve(apiDirectory, "../data/community.json"));
const defaultMediaDirectory = resolve(process.env.COMMUNITY_MEDIA_DIRECTORY ?? resolve(apiDirectory, "../data/audio"));
const defaultPublicAudioDirectory = resolve(apiDirectory, "../assets/audio");
const defaultWebDirectory = resolve(process.env.WEB_DIST_DIRECTORY ?? resolve(apiDirectory, "../../web/dist"));
const defaultAdminDirectory = resolve(process.env.ADMIN_DIST_DIRECTORY ?? resolve(apiDirectory, "../../admin/dist"));
const defaultGuidesDirectory = resolve(process.env.GUIDES_DIRECTORY ?? resolve(apiDirectory, "../../../docs/guides/videos"));
const maxAudioUploadBytes = 100 * 1024 * 1024;
const maxArtworkUploadBytes = 10 * 1024 * 1024;
const maxPackItems = 50;
const maxPackBytes = 500 * 1024 * 1024;
const onboardingLessonIds = ["media", "browse", "workspace", "upload", "sharing", "community"];
function onboardingProgress(user) {
  const saved = user.onboarding?.version === 1 ? user.onboarding : {};
  const platform = (key) => ({
    dismissed: saved[key]?.dismissed === true,
    completed: onboardingLessonIds.filter((id) => saved[key]?.completed?.includes(id)),
  });
  return { version: 1, desktop: platform("desktop"), mobile: platform("mobile") };
}
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const dataSchemaVersion = 7;
const conversationPageSize = 30;
const dubTags = new Set(["Jump Up", "Rollers", "Dancefloor", "Jungle", "Liquid", "Neurofunk", "Vocal", "Deep", "Minimal", "Techstep", "Atmospheric", "Old School"]);
function normalizeDubTags(tags) {
  return Array.isArray(tags)
    ? [...new Set(tags.map((tag) => String(tag).trim()).filter((tag) => dubTags.has(tag)))].slice(0, 12)
    : [];
}
function audioFormat(fileName) {
  return extname(String(fileName ?? "")).slice(1).toLocaleUpperCase() || undefined;
}
function audioDurationSeconds(value) {
  return Number.isFinite(value) && value > 0 && value <= 86400 ? value : undefined;
}
function formatAudioDuration(seconds) {
  if (!seconds) return "00:00";
  const totalSeconds = Math.floor(seconds);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
function averageBitrateKbps(bytes, durationSeconds) {
  if (!bytes || !durationSeconds) return undefined;
  return Math.round(bytes * 8 / durationSeconds / 1000);
}
const removedSeedDubIds = new Set([
  "dub-coffeeshop",
  "dub-miller",
  "dub-ozone",
  "dub-phoenix",
  "dub-wizard",
  "dub-jungle-tunes",
  "dub-ketterings-kitchen",
  "dub-renegade",
]);

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex"),
  };
}

export function createSeedState() {
  const meladeeCredentials = hashPassword("meladee");
  const meladee = {
    id: "user-meladee",
    username: "meladee",
    displayName: "Meladee",
    passwordSalt: meladeeCredentials.salt,
    passwordHash: meladeeCredentials.hash,
    presence: "online",
    genre: "UK Garage, Bassline",
    role: "DJ / Producer",
    bio: "Collecting late-night rollers and sharing the ones that stay with me.",
  };
  const holikCredentials = hashPassword("holik");
  const holik = {
    id: "user-holik",
    username: "holik",
    displayName: "Holik",
    passwordSalt: holikCredentials.salt,
    passwordHash: holikCredentials.hash,
    presence: "offline",
    genre: "Uncategorized",
    role: "DJ / Producer",
    bio: "",
  };
  return {
    schemaVersion: dataSchemaVersion,
    users: [meladee, holik],
    artists: [
      {
        id: "artist-meladee",
        userId: meladee.id,
        name: "Meladee",
        genres: ["UK Garage", "Bassline"],
        role: "DJ / Producer",
      },
      {
        id: "artist-holik",
        userId: holik.id,
        name: "Holik",
        genres: [],
        role: "DJ / Producer",
      },
    ],
    dubs: [],
    friendships: [],
    conversations: [],
    likes: [],
    downloads: [],
    crates: [],
    uploads: [],
    dubGrants: [],
    aListApplications: [],
    aListAccessDecisions: [],
    notifications: [],
    dubShares: [],
    pushSubscriptions: [],
    packs: [],
  };
}

export function initializeData(dataPath = defaultDataPath, mediaDirectory = defaultMediaDirectory) {
  mkdirSync(resolve(dataPath, ".."), { recursive: true });
  if (!existsSync(dataPath)) {
    const data = createSeedState();
    writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
    return data;
  }
  const data = normalizeCommunityData(JSON.parse(readFileSync(dataPath, "utf8")), mediaDirectory);
  writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

export function normalizeCommunityData(data, mediaDirectory = defaultMediaDirectory) {
  if (data.schemaVersion === undefined) {
    throw new Error("Unversioned community data requires manual migration; existing data and media have not been changed.");
  }
  if (data.schemaVersion === 2) {
    data.dubs = data.dubs.filter((dub) => !removedSeedDubIds.has(dub.id));
    data.likes = (data.likes ?? []).filter((like) => !removedSeedDubIds.has(like.dubId));
    data.downloads = (data.downloads ?? []).filter((download) => !removedSeedDubIds.has(download.dubId));
    const remainingDubIds = new Set(data.dubs.map((dub) => dub.id));
    data.crates = (data.crates ?? []).map((crate) => ({
      ...crate,
      dubIds: (crate.dubIds ?? []).filter((dubId) => remainingDubIds.has(dubId)),
    }));
    data.schemaVersion = 3;
  }
  if (data.schemaVersion === 3) {
    data.dubs = data.dubs.map((dub) => ({ ...dub, distribution: "worldwide" }));
    data.dubGrants = [];
    data.schemaVersion = 4;
  }
  if (data.schemaVersion === 4) {
    data.aListApplications = [];
    data.aListAccessDecisions = [];
    data.notifications = [];
    data.schemaVersion = 5;
  }
  if (data.schemaVersion === 5) {
    data.dubs = data.dubs.map((dub) => ({ ...dub, version: 1 }));
    data.dubShares = [];
    data.schemaVersion = 6;
  }
  if (data.schemaVersion === 6) {
    data.packs = [];
    data.schemaVersion = 7;
  }
  if (data.schemaVersion !== dataSchemaVersion) {
    throw new Error(`Unsupported community data schema version: ${data.schemaVersion}.`);
  }
  const meladee = data.users.find((user) => user.username === "meladee");
  if (!meladee) throw new Error("The required meladee account is missing from community data.");
  if (!data.artists.some((artist) => artist.id === "artist-meladee")) {
    data.artists.push({ id: "artist-meladee", userId: meladee.id, name: "Meladee", genres: ["UK Garage", "Bassline"], role: "DJ / Producer" });
  }
  data.dubs = data.dubs.map((dub) => ({
    ...dub,
    version: dub.version ?? 1,
    audioBytes: dub.audioBytes ?? (dub.storedAudioName && existsSync(resolve(mediaDirectory, basename(dub.storedAudioName)))
      ? statSync(resolve(mediaDirectory, basename(dub.storedAudioName))).size : undefined),
    bitrateKbps: Number.isFinite(dub.bitrateKbps) ? Math.round(dub.bitrateKbps) : undefined,
    artistId: dub.artistId ?? "artist-meladee",
    uploaderId: dub.uploaderId ?? meladee.id,
    artwork: dub.artworkUrl ? dub.artwork : "whitelabel",
    audioSource: dub.audioSource ?? "upload",
  }));
  for (const dub of data.dubs) {
    dub.audioUrl ??= `/api/dubs/${dub.id}/audio`;
  }
  for (const key of ["friendships", "conversations", "likes", "downloads", "crates", "uploads", "dubGrants", "aListApplications", "aListAccessDecisions", "notifications", "dubShares", "pushSubscriptions", "packs"]) {
    data[key] ??= [];
  }
  backfillBidirectionalFriendships(data);
  return data;
}

function saveData(dataPath, data) {
  const temporaryPath = `${dataPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(temporaryPath, dataPath);
}

function validateAdminSeed({ username, password }) {
  if (username === undefined && password === undefined) return null;
  if (typeof username !== "string" || !/^[a-z0-9._-]{3,24}$/.test(username)) {
    throw new Error("ADMIN_SEED_USERNAME must be 3-24 lowercase letters, numbers, dots, underscores, or hyphens.");
  }
  if (typeof password !== "string" || password.length === 0 || password.length > 128) {
    throw new Error("ADMIN_SEED_PASSWORD must be set and at most 128 characters.");
  }
  return { username, password };
}

function seedAdministrator(data, dataPath, seed, persist = () => saveData(dataPath, data)) {
  if (!seed) return;
  const existing = data.users.find((user) => user.username.toLowerCase() === seed.username);
  if (existing) {
    if (existing.seededAdministrator !== true) {
      throw new Error(`Cannot seed administrator: username "${seed.username}" already belongs to an existing account.`);
    }
    return;
  }
  const credentials = hashPassword(seed.password);
  const user = {
    id: randomUUID(),
    username: seed.username,
    displayName: "Admin",
    createdAt: new Date().toISOString(),
    passwordSalt: credentials.salt,
    passwordHash: credentials.hash,
    seededAdministrator: true,
    presence: "offline",
    genre: "Uncategorized",
    role: "DJ / Producer",
    bio: "",
    links: [],
  };
  data.users.push(user);
  data.artists.push({ id: randomUUID(), userId: user.id, name: user.displayName, genres: [], role: user.role });
  persist();
}

function json(response, status, value, headers = {}) {
  const encoded = JSON.stringify(value);
  return respondAfterCommit(status, () => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
    response.end(encoded);
  });
}

function readJson(request, maxBytes = 1024 * 1024) {
  if (request.destroyed) return Promise.reject(Object.assign(new Error("Request was interrupted."), { status: 400 }));
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let bytes = 0;
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    request.on("error", reject);
    request.on("aborted", () => reject(Object.assign(new Error("Request was interrupted."), { status: 400 })));
  });
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie ?? "").split(";").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0
      ? ["", ""]
      : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }).filter(([key]) => key));
}

function getAudioPath(dub, mediaDirectory, publicAudioDirectory) {
  if (dub.audioSource === "upload") {
    return resolve(mediaDirectory, basename(dub.audioFileName));
  }
  return resolve(publicAudioDirectory, basename(dub.audioFileName));
}

function audioRange(request, response, size) {
  const range = request.headers.range;
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      response.writeHead(416, { "content-range": `bytes */${size}` });
      response.end();
      return null;
    }
    start = match[1] ? Number(match[1]) : 0;
    end = match[2] ? Number(match[2]) : end;
    if (!match[1] && match[2]) {
      start = Math.max(0, size - end);
      end = size - 1;
    }
    if (start > end || end >= size) {
      response.writeHead(416, { "content-range": `bytes */${size}` });
      response.end();
      return null;
    }
    status = 206;
  }
  return { start, end, status };
}

function streamPreview(request, response, audio) {
  if (commitContext.getStore() && !commitContext.getStore().finished) {
    return respondAfterCommit(200, () => streamPreview(request, response, audio));
  }
  const range = audioRange(request, response, audio.length);
  if (!range) return;
  const { start, end, status } = range;
  response.writeHead(status, {
    "accept-ranges": "bytes",
    "content-length": end - start + 1,
    "content-type": "audio/wav",
    "content-disposition": "inline",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    ...(status === 206 ? { "content-range": `bytes ${start}-${end}/${audio.length}` } : {}),
  });
  response.end(audio.subarray(start, end + 1));
}

function streamAudio(request, response, filePath, downloadName) {
  if (commitContext.getStore() && !commitContext.getStore().finished) {
    return respondAfterCommit(200, () => streamAudio(request, response, filePath, downloadName));
  }
  const file = statSync(filePath);
  const range = audioRange(request, response, file.size);
  if (!range) return;
  const { start, end, status } = range;
  const headers = {
    "accept-ranges": "bytes",
    "content-length": end - start + 1,
    "content-type": ({
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".flac": "audio/flac",
      ".ogg": "audio/ogg",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    })[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
  if (status === 206) headers["content-range"] = `bytes ${start}-${end}/${file.size}`;
  if (downloadName) {
    headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
  }
  const fileDescriptor = openSync(filePath, "r");
  response.writeHead(status, headers);
  const stream = createReadStream(filePath, { fd: fileDescriptor, start, end, autoClose: true });
  stream.on("error", () => {
    if (!response.headersSent) response.writeHead(500);
    response.destroy();
  });
  stream.pipe(response);
}

const guideContentTypes = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".srt": "application/x-subrip; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
};

function serveGuidesRequest(request, response, route, guidesDirectory) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const requestedPath = decodeURIComponent(route).replace(/^[/\\]+/, "");
  const filePath = resolve(guidesDirectory, requestedPath || "index.html");
  const relativePath = relative(guidesDirectory, filePath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) return false;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
  const contentType = guideContentTypes[extname(filePath).toLowerCase()];
  if (!contentType) return false;
  const file = statSync(filePath);
  const range = audioRange(request, response, file.size);
  if (!range) return true;
  const { start, end, status } = range;
  response.writeHead(status, {
    "accept-ranges": "bytes",
    "cache-control": contentType.startsWith("text/html") ? "no-cache" : "public, max-age=3600",
    "content-length": end - start + 1,
    "content-type": contentType,
    "x-content-type-options": "nosniff",
    ...(status === 206 ? { "content-range": `bytes ${start}-${end}/${file.size}` } : {}),
  });
  if (request.method === "HEAD") {
    response.end();
    return true;
  }
  const stream = createReadStream(filePath, { start, end });
  stream.on("error", () => {
    if (!response.headersSent) response.writeHead(500);
    response.destroy();
  });
  stream.pipe(response);
  return true;
}

function serveWebRequest(request, response, route, webDirectory) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const indexPath = join(webDirectory, "index.html");
  if (!existsSync(indexPath)) return false;

  const requestedPath = decodeURIComponent(route);
  const requestedFile = resolve(webDirectory, requestedPath.replace(/^[/\\]+/, "") || "index.html");
  const relativePath = relative(webDirectory, requestedFile);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    json(response, 404, { error: "Not found." });
    return true;
  }

  let filePath = requestedFile;
  if (!existsSync(filePath)) {
    if (extname(requestedPath)) {
      json(response, 404, { error: "Not found." });
      return true;
    }
    filePath = indexPath;
  } else if (!statSync(filePath).isFile()) {
    filePath = indexPath;
  }

  const extension = extname(filePath).toLowerCase();
  const contentType = ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  })[extension] ?? "application/octet-stream";
  const file = statSync(filePath);
  response.writeHead(200, {
    "cache-control": filePath === indexPath || requestedPath === "/sw.js"
      ? "no-cache"
      : requestedPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    "content-length": file.size,
    "content-type": contentType,
    "x-content-type-options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    console.error("Web asset stream failed:", error.message);
    if (!response.headersSent) json(response, 500, { error: "Unable to serve web asset." });
    else response.destroy();
  });
  stream.pipe(response);
  return true;
}

const aListRoles = new Set(["DJ", "Producer", "DJ & Producer", "MC / Vocalist", "Other"]);
const aListProviders = ["instagram", "tiktok", "facebook", "soundcloud"];

function isAdministrator(user) {
  return String(process.env.ADMIN_USERNAMES ?? "").split(",")
    .map((name) => name.trim().toLocaleLowerCase()).filter(Boolean)
    .includes(user.username.toLocaleLowerCase());
}

function validateApplication(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("Provide an application."), { status: 400 });
  const text = (value, label, max, required = false) => {
    if (value === undefined || value === null) value = "";
    if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
      throw Object.assign(new Error(`Provide a valid ${label}${required ? " (required)" : ""}, up to ${max} characters.`), { status: 400 });
    }
    return value.trim();
  };
  const list = (value, label) => {
    if (value === undefined || value === null) value = [];
    if (!Array.isArray(value) || value.length > 3) throw Object.assign(new Error(`Provide up to three ${label}.`), { status: 400 });
    return value.map((item) => text(item, label, 120)).filter(Boolean);
  };
  if (!Array.isArray(input.roles) || input.roles.length === 0 || input.roles.some((role) => !aListRoles.has(role))) {
    throw Object.assign(new Error("Select at least one valid role."), { status: 400 });
  }
  const social = {};
  for (const provider of aListProviders) {
    const entry = input.social?.[provider] ?? {};
    if (typeof entry !== "object" || Array.isArray(entry)) throw Object.assign(new Error(`Provide valid ${provider} details.`), { status: 400 });
    const url = text(entry.url, `${provider} URL`, 300);
    if (url) {
      let parsed;
      try { parsed = new URL(url); } catch { throw Object.assign(new Error(`Provide a valid ${provider} URL.`), { status: 400 }); }
      if (!["http:", "https:"].includes(parsed.protocol)) throw Object.assign(new Error(`Provide a valid ${provider} URL.`), { status: 400 });
    }
    const count = entry.followers;
    if (count !== null && count !== undefined && (!Number.isSafeInteger(count) || count < 0 || count > 10000000000)) {
      throw Object.assign(new Error(`Provide a valid ${provider} follower count.`), { status: 400 });
    }
    social[provider] = { url, followers: count ?? null };
  }
  return {
    artistName: text(input.artistName, "artist name", 100, true),
    roles: [...new Set(input.roles)],
    djExperience: text(input.djExperience, "DJ experience", 100, true),
    producerExperience: text(input.producerExperience, "producing experience", 100),
    events: list(input.events, "events"),
    supporters: list(input.supporters, "supporting artists"),
    labels: list(input.labels, "record labels"),
    social,
    additionalInfo: text(input.additionalInfo, "additional information", 2000),
  };
}

function canAccessDub(data, dub, user) {
  if (!dub || !user) return false;
  if (dub.distribution === "worldwide") return true;
  if (dub.distribution === "alist") return dub.aListPublic === true || user.aListApproved === true;
  if (dub.distribution === "private") {
    return dub.uploaderId === user.id
      || data.dubGrants.some((grant) => grant.dubId === dub.id && grant.userId === user.id)
      || (data.packs ?? []).some((pack) => pack.status === "published"
        && pack.distribution === "private"
        && pack.dubIds?.includes(dub.id)
        && (pack.grants ?? []).some((grant) => (grant.userId ?? grant.id) === user.id));
  }
  return false;
}

function canAccessPack(pack, user) {
  if (!pack || pack.status !== "published" || !user) return false;
  if (pack.ownerId === user.id) return true;
  if (pack.distribution === "worldwide") return true;
  if (pack.distribution === "alist") return pack.aListPublic === true || user.aListApproved === true;
  return pack.distribution === "private"
    && (pack.grants ?? []).some((grant) => (grant.userId ?? grant.id) === user.id);
}

function dubMediaKind(data, dub) {
  if (dub.mediaKind === "vocal" || data.packs.some((pack) => pack.status === "published" && pack.kind === "vocal" && pack.dubIds.includes(dub.id))) return "vocal";
  return data.packs.some((pack) => pack.status === "published" && pack.kind === "sample" && pack.dubIds.includes(dub.id))
    ? "sample" : "dub";
}

function canIncludePackKind(kind, mediaKind) {
  return kind === "sample" ? mediaKind === "sample" || mediaKind === "vocal" : kind === mediaKind;
}

function packMemberKind(data, pack, dub) {
  return dub.draftPackId === pack.id ? dub.mediaKind === "vocal" ? "vocal" : pack.kind : dubMediaKind(data, dub);
}

function packResponse(data, pack, user, { includeOwnerGrants = false } = {}) {
  const owner = data.users.find((item) => item.id === pack.ownerId);
  const response = {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    kind: pack.kind,
    status: pack.status,
    distribution: pack.distribution,
    aListPublic: pack.aListPublic === true,
    licence: pack.licence ?? "",
    artworkUrl: pack.artworkUploadId || pack.fallbackArtworkName || data.dubs.find((item) => item.id === pack.dubIds[0])?.storedArtworkName
      ? `/api/${pack.status === "published" && (pack.distribution === "worldwide" || (pack.distribution === "alist" && pack.aListPublic === true)) ? "public/" : ""}packs/${encodeURIComponent(pack.id)}/artwork`
      : undefined,
    ownerUsername: owner?.username ?? "unknown",
    ownerDisplayName: owner?.displayName ?? "Unknown",
    canManage: Boolean(user && pack.ownerId === user.id),
    ...(user?.id === pack.ownerId ? { zipDownloads: pack.zipDownloads ?? 0 } : {}),
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
    totalBytes: pack.dubIds.reduce((total, dubId) => {
      const dub = data.dubs.find((item) => item.id === dubId);
      return total + (dub?.audioBytes ?? 0);
    }, 0),
    items: pack.dubIds.map((dubId) => {
      const dub = data.dubs.find((item) => item.id === dubId);
      const key = pack.keys?.[dubId] ?? dub?.key;
      if (!dub) return undefined;
      const visibleDub = packDubResponse(data, pack, dub, user);
      return { dub: visibleDub, ...(key ? { key } : {}) };
    }).filter(Boolean),
  };
  if (includeOwnerGrants && user?.id === pack.ownerId) {
    response.grants = (pack.grants ?? []).map((grant) => {
      const member = data.users.find((item) => item.id === (grant.userId ?? grant.id));
      return member ? { id: member.id, username: member.username, displayName: member.displayName } : undefined;
    }).filter(Boolean);
  }
  return response;
}

function packDubResponse(data, pack, dub, user) {
  const response = publicDub(data, dub, user?.id);
  response.mediaKind = pack.kind;
  if (pack.status === "draft" && dub.draftPackId === pack.id) {
    response.distribution = pack.distribution;
    response.aListPublic = pack.distribution === "alist" && pack.aListPublic === true;
  }
  return response;
}

function packAudience(dub) {
  if (dub?.draftPackId && dub.draftAudience) return dub.draftAudience;
  return { distribution: dub.distribution, aListPublic: dub.distribution === "alist" && dub.aListPublic === true };
}

function validatePackText(value, label, max, fallback = "") {
  const text = value === undefined ? fallback : value;
  if (typeof text !== "string" || text.trim().length > max) {
    throw Object.assign(new Error(`Provide a valid ${label} up to ${max} characters.`), { status: 400 });
  }
  return text.trim();
}

function packInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Provide a valid pack request."), { status: 400 });
  }
  return value;
}

function canShareDubExternally(dub) {
  return dub?.distribution === "worldwide" || (dub?.distribution === "alist" && dub.aListPublic === true);
}

function externallySharedDub(data, dub, authenticated) {
  const track = publicDub(data, dub);
  const baseUrl = `/api/public/dubs/${encodeURIComponent(dub.id)}`;
  const [minutes, seconds] = String(track.duration ?? "").split(":").map(Number);
  const fullDuration = minutes * 60 + seconds;
  return {
    id: track.id,
    mediaKind: track.mediaKind,
    title: track.title,
    artist: track.artist,
    artistAListApproved: track.artistAListApproved,
    uploader: track.uploader,
    uploaderDisplayName: track.uploaderDisplayName,
    uploadedAt: track.uploadedAt,
    bpm: track.bpm,
    genre: track.genre,
    tags: track.tags,
    duration: authenticated ? track.duration : formatAudioDuration(Math.min(
      dubPreviewSeconds(dub),
      audioDurationSeconds(fullDuration) ?? dubPreviewSeconds(dub),
    )),
    previewSeconds: dubPreviewSeconds(dub),
    likes: track.likes,
    downloads: track.downloads,
    artwork: track.artwork,
    message: track.message,
    distribution: track.distribution,
    aListPublic: track.aListPublic,
    audioUrl: authenticated ? `/api/dubs/${encodeURIComponent(dub.id)}/audio` : `${baseUrl}/audio`,
    artworkUrl: dub.storedArtworkName ? `${baseUrl}/artwork` : undefined,
  };
}

function visibleMessage(data, user, message) {
  if (message.packId && !canAccessPack(data.packs?.find((pack) => pack.id === message.packId), user)) {
    return { ...message, packId: undefined, text: "This pack is no longer available." };
  }
  if (!message.dubId || canAccessDub(data, data.dubs.find((dub) => dub.id === message.dubId), user)) return message;
  return { ...message, dubId: undefined, text: "This dub is no longer available." };
}

function publicDub(data, dub, currentUserId) {
  const {
    storedAudioName,
    storedArtworkName,
    audioSource,
    audioBytes,
    draftPackId,
    draftAudience,
    packUploadId,
    ...publicFields
  } = dub;
  const uploader = data.users.find((item) => item.id === dub.uploaderId);
  const artist = data.artists.find((item) => item.id === dub.artistId);
  const artistUser = data.users.find((item) => item.id === artist?.userId);
  const result = {
    ...publicFields,
    mediaKind: dubMediaKind(data, dub),
    artist: artist?.name ?? publicFields.artist,
    artistAListApproved: artistUser?.aListApproved === true,
    uploaderAListApproved: uploader?.aListApproved === true,
    uploader: uploader?.username ?? publicFields.uploader,
    uploaderDisplayName: uploader?.displayName ?? publicFields.uploaderDisplayName,
    uploaderAvatarUrl: uploader?.avatarUrl,
    likes: data.likes.filter((like) => like.dubId === dub.id).length,
    downloads: data.downloads.filter((download) => download.dubId === dub.id).length,
    likedByCurrentUser: data.likes.some((like) => like.dubId === dub.id && like.userId === currentUserId),
    sharedBuddyIds: data.friendships
      .filter((friendship) => friendship.ownerId === currentUserId && data.dubShares.some((share) =>
        share.dubId === dub.id && share.senderId === currentUserId && share.recipientId === friendship.friendUserId && share.version === dub.version))
      .map((friendship) => friendship.id),
  };
  if (dub.uploaderId === currentUserId) {
    const downloaderByUser = new Map();
    for (const download of data.downloads.filter((item) => item.dubId === dub.id)) {
      const downloader = data.users.find((item) => item.id === download.userId);
      downloaderByUser.set(download.userId, {
        username: downloader?.username ?? "artist",
        displayName: downloader?.displayName ?? "Artist",
        avatarUrl: downloader?.avatarUrl,
        aListApproved: downloader?.aListApproved === true,
        downloadedAt: download.downloadedAt,
      });
    }
    result.downloaders = [...downloaderByUser.values()];
    if (dub.distribution === "private") {
      result.grants = data.dubGrants
        .filter((grant) => grant.dubId === dub.id)
        .map((grant) => data.users.find((item) => item.id === grant.userId))
        .filter(Boolean)
        .map(({ id, username, displayName, avatarUrl, aListApproved }) => ({ id, username, displayName, avatarUrl, aListApproved: aListApproved === true }));
    }
  }
  return result;
}

function crateNameKey(name) {
  return String(name ?? "").trim().toLocaleLowerCase();
}

function publicCrates(data, userId) {
  const user = data.users.find((item) => item.id === userId);
  const grouped = new Map();
  for (const crate of data.crates.filter((item) => item.userId === userId)) {
    const key = crateNameKey(crate.name);
    const existing = grouped.get(key);
    if (existing) {
      existing.dubIds = [...new Set([...existing.dubIds, ...(crate.dubIds ?? []).filter((id) => canAccessDub(data, data.dubs.find((dub) => dub.id === id), user))])];
    } else {
      grouped.set(key, { id: crate.id, name: crate.name, dubIds: (crate.dubIds ?? []).filter((id) => canAccessDub(data, data.dubs.find((dub) => dub.id === id), user)) });
    }
  }
  return [...grouped.values()];
}

function visibleWindowWorkspace(data, user) {
  if (!user.windowWorkspace) return null;
  const workspace = user.windowWorkspace;
  const filterLayout = (layout) => ({
    ...layout,
    windows: layout.windows.filter((entry) => {
      if (entry.id === "player") return true;
      if (entry.id.startsWith("workspace:")) return (workspace.workspaces ?? []).some((context) => context.id === entry.id.slice(10));
      if (entry.id.startsWith("profile:")) return data.users.some((profile) => profile.username === entry.id.slice(8));
      if (entry.id.startsWith("track:")) return canAccessDub(data, data.dubs.find((dub) => dub.id === entry.id.slice(6)), user);
      if (entry.id.startsWith("pack:")) {
        const pack = data.packs.find((item) => item.id === entry.id.slice(5));
        return pack && (pack.ownerId === user.id || canAccessPack(pack, user));
      }
      return data.friendships.some((friendship) => friendship.ownerId === user.id && friendship.id === entry.id.slice(13));
    }),
    playerTrackId: canAccessDub(data, data.dubs.find((dub) => dub.id === layout.playerTrackId), user) ? layout.playerTrackId : null,
  });
  const root = filterLayout(workspace);
  const visibleLayout = (source) => {
    const layout = filterLayout(source);
    return { ...layout, ...(layout.openedDependencies ? { openedDependencies: layout.openedDependencies.filter((id) => layout.windows.some((entry) => entry.id === id)) } : {}) };
  };
  return {
    ...root,
    ...(root.openedDependencies ? { openedDependencies: root.openedDependencies.filter((id) => root.windows.some((entry) => entry.id === id)) } : {}),
    ...(workspace.workspaces ? { workspaces: workspace.workspaces.map((context) => {
      return { ...context, layout: visibleLayout(context.layout),
        ...(context.savedLayout ? { savedLayout: visibleLayout(context.savedLayout) } : {}) };
    }) } : {}),
  };
}

function communitySnapshot(data, user) {
  const artists = data.artists.filter((artist) => artist.userId === user.id);
  const friendships = data.friendships.filter((friendship) => friendship.ownerId === user.id);
  const friendUserIds = new Set(friendships.map((friendship) => friendship.friendUserId));
  const receivedPackIds = new Set(data.conversations
    .filter((conversation) => conversation.ownerId === user.id)
    .flatMap((conversation) => conversation.messages
      .filter((message) => message.sender === "them" && message.packId && !message.unsent)
      .map((message) => message.packId)));
  const receivedPacks = data.packs.filter((pack) => canAccessPack(pack, user)
    && (receivedPackIds.has(pack.id) || (pack.grants ?? []).some((grant) => (grant.userId ?? grant.id) === user.id)));
  const receivedDubIds = new Set([
    ...receivedPacks.flatMap((pack) => pack.dubIds),
    ...data.dubShares.filter((share) => share.recipientId === user.id).map((share) => share.dubId),
    ...data.dubGrants.filter((grant) => grant.userId === user.id).map((grant) => grant.dubId),
    ...data.conversations.filter((conversation) => conversation.ownerId === user.id)
      .flatMap((conversation) => conversation.messages.filter((message) => message.sender === "them" && message.dubId).map((message) => message.dubId)),
  ]);
  const accessibleDubs = data.dubs
    .filter((dub) => !dub.draftPackId && canAccessDub(data, dub, user))
    .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt));
  const conversations = data.conversations
    .filter((conversation) => conversation.ownerId === user.id)
    .map(({ buddyId, messages }) => ({
      buddyId,
      messages: messages.slice(-conversationPageSize).map((message) => visibleMessage(data, user, message)),
      hasMoreMessages: messages.length > conversationPageSize,
    }));
  const buddies = friendships.map((friendship) => {
    const buddyUser = data.users.find((item) => item.id === friendship.friendUserId);
    const conversation = conversations.find((item) => item.buddyId === friendship.id);
    return {
      id: friendship.id,
      username: buddyUser?.username ?? friendship.id,
      userId: buddyUser?.id,
      displayName: buddyUser?.displayName ?? friendship.id,
      presence: friendship.presence,
      genre: buddyUser?.genre ?? friendship.genre,
      role: buddyUser?.role ?? friendship.role,
      bio: buddyUser?.bio ?? friendship.bio,
      avatarUrl: buddyUser?.avatarUrl,
      aListApproved: buddyUser?.aListApproved === true,
      bannerUrl: buddyUser?.bannerUrl,
      links: buddyUser?.links ?? [],
      groups: friendship.groups,
      unread: friendship.unread || undefined,
      messages: conversation?.messages,
    };
  });
  return {
    windowWorkspace: visibleWindowWorkspace(data, user),
    lastPlayback: user.lastPlayback && canAccessDub(data, data.dubs.find((dub) => dub.id === user.lastPlayback.dubId), user)
      ? user.lastPlayback : null,
    aListApplication: data.aListApplications.filter((application) => application.userId === user.id).at(-1) ?? null,
    notifications: data.notifications.filter((notification) => notification.userId === user.id)
      .map(({ userId, ...notification }) => notification),
    member: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      presence: user.presence,
      genre: user.genre,
      role: user.role,
      bio: user.bio,
      groups: ["Friends"],
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      links: user.links ?? [],
      aListApproved: user.aListApproved === true,
    },
    artists,
    dubs: accessibleDubs.map((dub) => publicDub(data, dub, user.id)),
    draftDubs: data.dubs.filter((dub) => dub.draftPackId && dub.uploaderId === user.id
      && data.packs.some((pack) => pack.id === dub.draftPackId && pack.ownerId === user.id && pack.status === "draft"))
      .map((dub) => publicDub(data, dub, user.id)),
    packs: data.packs.filter((pack) => pack.status === "published" && canAccessPack(pack, user))
      .map((pack) => packResponse(data, pack, user)),
    sharedDubIds: accessibleDubs.filter((dub) => receivedDubIds.has(dub.id)).map((dub) => dub.id),
    sharedPackIds: receivedPacks.map((pack) => pack.id),
    buddies,
    conversations,
    likedDubIds: data.likes.filter((like) => like.userId === user.id && canAccessDub(data, data.dubs.find((dub) => dub.id === like.dubId), user)).map((like) => like.dubId),
    suggestedMembers: data.users
      .filter((other) => other.id !== user.id && !friendUserIds.has(other.id))
      .map(({ id, username, displayName, genre, avatarUrl, bannerUrl, aListApproved, presence, role, bio, links }) => ({
        id, username, displayName, genre, avatarUrl, bannerUrl, presence, role, bio,
        links: links ?? [], groups: [], aListApproved: aListApproved === true,
      })),
    crates: publicCrates(data, user.id),
    library: data.downloads
      .filter((download) => download.userId === user.id)
      .filter((download) => canAccessDub(data, data.dubs.find((dub) => dub.id === download.dubId), user))
      .slice()
      .sort((left, right) => Date.parse(right.downloadedAt) - Date.parse(left.downloadedAt))
      .map((download) => ({
        downloadedAt: download.downloadedAt,
        dub: publicDub(data, data.dubs.find((item) => item.id === download.dubId), user.id),
      })),
  };
}

function getConversationMessagePage(data, user, buddyId, beforeId) {
  const friendship = data.friendships.find(
    (item) => item.id === buddyId && item.ownerId === user.id,
  );
  if (!friendship) return { error: "Friend not found.", status: 404 };

  const conversation = data.conversations.find(
    (item) => item.ownerId === user.id && item.buddyId === buddyId,
  );
  const messages = conversation?.messages ?? [];
  let endIndex = messages.length;
  if (beforeId) {
    endIndex = messages.findIndex((message) => message.id === beforeId);
    if (endIndex === -1) return { error: "Message cursor not found.", status: 400 };
  }
  const startIndex = Math.max(0, endIndex - conversationPageSize);
  return {
    buddyId,
    messages: messages.slice(startIndex, endIndex).map((message) => visibleMessage(data, user, message)),
    hasMoreMessages: startIndex > 0,
  };
}

function findOrCreateFriendship(data, owner, friend) {
  let friendship = data.friendships.find(
    (item) => item.ownerId === owner.id && item.friendUserId === friend.id,
  );
  if (!friendship) {
    friendship = {
      id: randomUUID(),
      ownerId: owner.id,
      friendUserId: friend.id,
      presence: friend.presence,
      genre: friend.genre,
      role: friend.role,
      bio: friend.bio,
      groups: ["Friends"],
      unread: 0,
    };
    data.friendships.push(friendship);
  }
  return friendship;
}

function backfillBidirectionalFriendships(data) {
  for (const friendship of [...data.friendships]) {
    const owner = data.users.find((item) => item.id === friendship.ownerId);
    const friend = data.users.find((item) => item.id === friendship.friendUserId);
    if (owner && friend && owner.id !== friend.id) {
      findOrCreateFriendship(data, friend, owner);
    }
  }
}

function findOrCreateConversation(data, ownerId, buddyId) {
  let conversation = data.conversations.find(
    (item) => item.ownerId === ownerId && item.buddyId === buddyId,
  );
  if (!conversation) {
    conversation = { id: randomUUID(), ownerId, buddyId, messages: [] };
    data.conversations.push(conversation);
  }
  return conversation;
}

function createConversationMessage(data, user, buddyId, input) {
  const friendship = data.friendships.find(
    (item) => item.id === buddyId && item.ownerId === user.id,
  );
  if (!friendship) return { error: "Friend not found.", status: 404 };
  const text = String(input.text ?? "").trim();
  if (!text || text.length > 2000) {
    return { error: "Message must contain between 1 and 2000 characters.", status: 400 };
  }
  const recipient = data.users.find((item) => item.id === friendship.friendUserId);
  if (!recipient) return { error: "Friend not found.", status: 404 };
  if (input.packId !== undefined && (typeof input.packId !== "string" || !input.packId || input.dubId !== undefined)) {
    return { error: "Share either a dub or a pack.", status: 400 };
  }
  if (input.packId) {
    const pack = data.packs?.find((item) => item.id === input.packId);
    if (!pack || pack.status !== "published" || !canAccessPack(pack, user)
      || (pack.distribution === "private" && pack.ownerId !== user.id)) {
      return { error: "The shared pack is unavailable.", status: 404 };
    }
    if (pack.distribution === "alist" && !pack.aListPublic && !recipient.aListApproved) {
      return { error: "A-List packs can only be shared with approved A-List members.", status: 403 };
    }
    if (pack.distribution === "private" && !(pack.grants ?? []).some((grant) => (grant.userId ?? grant.id) === recipient.id)) {
      if (input.confirmPackAccess !== true) {
        return { error: "Confirm access to all current pack files before sharing.", status: 409 };
      }
      pack.grants ??= [];
      pack.grants.push({ userId: recipient.id, grantedAt: new Date().toISOString() });
      pack.updatedAt = new Date().toISOString();
    }
  }
  if (input.dubId) {
    const dub = data.dubs.find((item) => item.id === input.dubId);
    if (!canAccessDub(data, dub, user) || (dub.distribution === "private" && dub.uploaderId !== user.id)) {
      return { error: "The shared dub is unavailable to this recipient.", status: 404 };
    }
    if (dub.distribution === "alist" && dub.aListPublic !== true && recipient.aListApproved !== true) {
      return { error: "A-List dubs can only be shared with approved A-List members.", status: 404 };
    }
    if (dub.distribution === "private" && !data.dubGrants.some((grant) => grant.dubId === dub.id && grant.userId === recipient.id)) {
      data.dubGrants.push({ dubId: dub.id, userId: recipient.id });
    }
    data.dubShares = data.dubShares.filter((share) =>
      share.dubId !== dub.id || share.senderId !== user.id || share.recipientId !== recipient.id);
    data.dubShares.push({ dubId: dub.id, senderId: user.id, recipientId: recipient.id, version: dub.version });
  }
  const recipientFriendship = findOrCreateFriendship(data, recipient, user);
  const sentAt = new Date().toISOString();
  const messageId = randomUUID();
  const dubId = input.dubId || undefined;
  const senderMessage = { id: messageId, sender: "you", text, sentAt, dubId, packId: input.packId || undefined };
  const recipientMessage = { ...senderMessage, sender: "them" };
  findOrCreateConversation(data, user.id, friendship.id).messages.push(senderMessage);
  findOrCreateConversation(data, recipient.id, recipientFriendship.id).messages.push(recipientMessage);
  recipientFriendship.unread = (recipientFriendship.unread ?? 0) + 1;
  return { message: senderMessage, recipientId: recipient.id, recipientBuddyId: recipientFriendship.id };
}

function unsendConversationMessage(data, user, buddyId, messageId) {
  const friendship = data.friendships.find(
    (item) => item.id === buddyId && item.ownerId === user.id,
  );
  if (!friendship) return { error: "Friend not found.", status: 404 };
  const conversation = data.conversations.find(
    (item) => item.ownerId === user.id && item.buddyId === buddyId,
  );
  const message = conversation?.messages.find((item) => item.id === messageId);
  if (!message || message.sender !== "you") {
    return { error: "Message not found.", status: 404 };
  }
  if (message.unsent) return { recipientId: friendship.friendUserId };

  message.text = "";
  message.dubId = undefined;
  message.packId = undefined;
  message.unsent = true;
  const recipientFriendship = data.friendships.find(
    (item) => item.ownerId === friendship.friendUserId && item.friendUserId === user.id,
  );
  const recipientConversation = recipientFriendship && data.conversations.find(
    (item) => item.ownerId === friendship.friendUserId && item.buddyId === recipientFriendship.id,
  );
  const recipientMessage = recipientConversation?.messages.find((item) => item.id === messageId);
  if (recipientMessage) {
    recipientMessage.text = "";
    recipientMessage.dubId = undefined;
    recipientMessage.packId = undefined;
    recipientMessage.unsent = true;
  }
  return { recipientId: friendship.friendUserId };
}

function isAllowedWebSocketOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;

  const allowedOrigins = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedOrigins.includes(origin)) return true;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }
  const forwardedProtocol = String(request.headers["x-forwarded-proto"] ?? "http")
    .split(",")[0]
    .trim();
  const requestProtocol = forwardedProtocol === "https" ? "https:" : "http:";
  if (parsedOrigin.host === request.headers.host && parsedOrigin.protocol === requestProtocol) {
    return true;
  }
  return process.env.NODE_ENV !== "production" &&
    (parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1");
}

function uploadFile(request, targetPath, maxBytes, mediaLabel) {
  return new Promise((resolveUpload, reject) => {
    let bytes = 0;
    const output = createWriteStream(targetPath, { flags: "wx" });
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        request.destroy(Object.assign(new Error(`${mediaLabel} uploads are too large.`), { status: 413 }));
      }
    });
    pipeline(request, output).then(() => resolveUpload(bytes), (error) => {
      if (existsSync(targetPath)) unlinkSync(targetPath);
      reject(error);
    });
  });
}

export function createApiServer({
  dataPath = defaultDataPath,
  mediaDirectory = defaultMediaDirectory,
  publicAudioDirectory = defaultPublicAudioDirectory,
  webDirectory = defaultWebDirectory,
  adminDirectory = defaultAdminDirectory,
  guidesDirectory = defaultGuidesDirectory,
  storage,
  adminSeed = { username: process.env.ADMIN_SEED_USERNAME, password: process.env.ADMIN_SEED_PASSWORD },
  pushService = createPushService({
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  }),
} = {}) {
  const validatedAdminSeed = validateAdminSeed(adminSeed);
  const data = storage?.data ?? initializeData(dataPath, mediaDirectory);
  if (!storage) seedAdministrator(data, dataPath, validatedAdminSeed);
  mkdirSync(mediaDirectory, { recursive: true });
  const sessions = storage?.sessions ?? new Map();
  const socketsByUser = new Map();
  const socketSessions = new WeakMap();
  const socketExpiryTimers = new WeakMap();
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const persist = () => storage ? storage.markDirty() : saveData(dataPath, data);
  const audioPreview = createAudioPreviewService();

  const handleRequest = async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const cookies = parseCookies(request);
    const route = url.pathname;
    const session = route.startsWith("/api/") ? sessions.get(cookies.cre8_session) : undefined;
    const user = session && session.expiresAt > Date.now()
      ? data.users.find((item) => item.id === session.userId)
      : undefined;
    const match = route.match(/^\/api\/(dubs|buddies|crates|conversations)\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/);
    const packRouteMatch = route.match(/^\/api\/packs\/([^/]+)(?:\/(.*))?$/);
    const publicPackMatch = route.match(/^\/api\/public\/packs\/([^/]+)$/);
    const publicPackArtworkMatch = route.match(/^\/api\/public\/packs\/([^/]+)\/artwork$/);

    try {
      if (request.method === "GET" && route === "/api/health") {
        json(response, 200, { status: "ok" });
        return;
      }
      if (route !== "/api" && !route.startsWith("/api/")) {
        if (route === "/admin" || route.startsWith("/admin/")) {
          if (!serveWebRequest(request, response, route.replace(/^\/admin/, "") || "/", adminDirectory)) {
            json(response, 404, { error: "Admin app is not built." });
          }
          return;
        }
        if (route === "/guides") {
          response.writeHead(301, { location: "/guides/" });
          response.end();
          return;
        }
        if (route.startsWith("/guides/")) {
          if (!serveGuidesRequest(request, response, route.slice("/guides".length), guidesDirectory)) {
            json(response, 404, { error: "Guide library is not published. Run pnpm guides:publish." });
          }
          return;
        }
        if (!serveWebRequest(request, response, route, webDirectory)) {
          json(response, 404, { error: "Not found." });
        }
        return;
      }
      if (request.method === "POST" && route === "/api/login") {
        const credentials = await readJson(request);
        const account = data.users.find((item) => item.username.toLowerCase() === String(credentials.username ?? "").trim().toLowerCase());
        if (!account || !account.passwordSalt || !account.passwordHash || typeof credentials.password !== "string") {
          json(response, 401, { error: "Invalid username or password." });
          return;
        }
        const candidate = scryptSync(credentials.password, account.passwordSalt, 64);
        const expected = Buffer.from(account.passwordHash, "hex");
        if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
          json(response, 401, { error: "Invalid username or password." });
          return;
        }
        const token = randomBytes(32).toString("hex");
        sessions.set(token, { userId: account.id, expiresAt: Date.now() + sessionLifetimeSeconds * 1000 });
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        json(response, 200, { user: { id: account.id, username: account.username, displayName: account.displayName } }, {
          "set-cookie": `cre8_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`,
        });
        return;
      }
      if (request.method === "POST" && route === "/api/register") {
        const input = await readJson(request);
        const displayName = String(input.displayName ?? "").trim();
        const requestedUsername = String(input.username ?? "").trim().toLowerCase();
        const baseUsername = (requestedUsername || displayName.toLowerCase())
          .replace(/[^a-z0-9._-]+/g, ".")
          .replace(/^[._-]+|[._-]+$/g, "")
          .slice(0, 24);
        const password = input.password;
        const genres = Array.isArray(input.genres)
          ? input.genres.map((item) => String(item).trim().slice(0, 40)).filter(Boolean).slice(0, 2)
          : input.genre
            ? String(input.genre).slice(0, 100).split(",").map((item) => item.trim().slice(0, 40)).filter(Boolean).slice(0, 2)
            : ["Drum & Bass"];
        if (!displayName || displayName.length > 60) {
          json(response, 400, { error: "Enter an artist name up to 60 characters." });
          return;
        }
        if (requestedUsername && !/^[a-z0-9._-]{3,24}$/.test(requestedUsername)) {
          json(response, 400, { error: "Username must be 3-24 characters and use letters, numbers, dots, underscores, or hyphens." });
          return;
        }
        const generatedUsername = baseUsername.length >= 3
          ? baseUsername
          : `artist-${randomBytes(3).toString("hex")}`;
        if (typeof password !== "string" || password.length < 8 || password.length > 128) {
          json(response, 400, { error: "Password must be between 8 and 128 characters." });
          return;
        }
        let username = generatedUsername;
        if (!requestedUsername) {
          let suffix = 2;
          while (data.users.some((item) => item.username.toLowerCase() === username)) {
            const ending = `-${suffix++}`;
            username = `${generatedUsername.slice(0, 24 - ending.length)}${ending}`;
          }
        } else if (data.users.some((item) => item.username.toLowerCase() === username)) {
          json(response, 409, { error: "That username is already taken." });
          return;
        }
        const credentials = hashPassword(password);
        const account = {
          id: randomUUID(),
          username,
          displayName,
          createdAt: new Date().toISOString(),
          passwordSalt: credentials.salt,
          passwordHash: credentials.hash,
          presence: "online",
          genre: genres.join(", ") || "Drum & Bass",
          role: "DJ / Producer",
          bio: "",
          links: [],
        };
        const artist = {
          id: randomUUID(),
          userId: account.id,
          name: displayName,
          genres: genres.length > 0 ? genres : ["Drum & Bass"],
          role: account.role,
        };
        data.users.push(account);
        data.artists.push(artist);
        persist();
        const token = randomBytes(32).toString("hex");
        sessions.set(token, { userId: account.id, expiresAt: Date.now() + sessionLifetimeSeconds * 1000 });
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        json(response, 201, { user: { id: account.id, username, displayName } }, {
          "set-cookie": `cre8_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`,
        });
        return;
      }
      if (request.method === "POST" && route === "/api/logout") {
        sessions.delete(cookies.cre8_session);
        for (const socket of socketsByUser.get(session?.userId) ?? []) {
          if (socketSessions.get(socket) === cookies.cre8_session) afterCommit(() => socket.close(1000, "Signed out"));
        }
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        json(response, 200, { status: "ok" }, {
          "set-cookie": `cre8_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
        });
        return;
      }
      const publicDubMatch = route.match(/^\/api\/public\/dubs\/([^/]+)(?:\/(audio|artwork))?$/);
      if (request.method === "GET" && publicDubMatch) {
        response.setHeader("cache-control", "private, no-store");
        const dub = data.dubs.find((item) => item.id === decodeURIComponent(publicDubMatch[1]));
        if (!canShareDubExternally(dub)) {
          json(response, 404, { error: "This shared dub is unavailable or is not public." });
          return;
        }
        if (url.searchParams.has("download")) {
          json(response, user ? 403 : 401, { error: "Sign in and use the download action to download this dub." });
          return;
        }
        const mediaType = publicDubMatch[2];
        if (!mediaType) {
          json(response, 200, { dub: externallySharedDub(data, dub, Boolean(user)), authenticated: Boolean(user) });
          return;
        }
        const filePath = mediaType === "artwork"
          ? dub.storedArtworkName && resolve(mediaDirectory, basename(dub.storedArtworkName))
          : dub.audioSource === "upload"
            ? dub.storedAudioName && resolve(mediaDirectory, basename(dub.storedAudioName))
            : getAudioPath(dub, mediaDirectory, publicAudioDirectory);
        if (!filePath || !existsSync(filePath)) {
          json(response, 404, { error: mediaType === "artwork" ? "Track artwork file not found." : "Audio file not found." });
          return;
        }
        response.setHeader("content-disposition", "inline");
        if (mediaType === "audio" && !user) {
          const seconds = dubPreviewSeconds(dub);
          const preview = await audioPreview(filePath, seconds);
          const currentDub = data.dubs.find((item) => item.id === dub.id);
          if (!canShareDubExternally(currentDub) || dubPreviewSeconds(currentDub) !== seconds) {
            json(response, 404, { error: "This shared dub is unavailable or has changed. Reload the page." });
            return;
          }
          if (!response.destroyed) streamPreview(request, response, preview);
          return;
        }
        streamAudio(request, response, filePath);
        return;
      }
      if (request.method === "GET" && publicPackMatch) {
        response.setHeader("cache-control", "private, no-store");
        const pack = data.packs.find((item) => item.id === decodeURIComponent(publicPackMatch[1]));
        const publiclyAvailable = pack?.status === "published"
          && (pack.distribution === "worldwide" || (pack.distribution === "alist" && pack.aListPublic === true));
        if (!pack || pack.status !== "published" || (!canAccessPack(pack, user) && !publiclyAvailable)) {
          json(response, 404, { error: "This pack is unavailable or is not accessible." });
          return;
        }
        const result = packResponse(data, pack, user, { includeOwnerGrants: true });
        if (!user) {
          result.items = pack.dubIds.map((dubId) => data.dubs.find((item) => item.id === dubId))
            .filter(Boolean)
            .map((dub) => {
              const key = pack.keys?.[dub.id] ?? dub.key;
              return { dub: externallySharedDub(data, dub, false), ...(key ? { key } : {}) };
            });
        }
        json(response, 200, { pack: result, authenticated: Boolean(user) });
        return;
      }
      if (request.method === "GET" && publicPackArtworkMatch) {
        response.setHeader("cache-control", "private, no-store");
        const pack = data.packs.find((item) => item.id === decodeURIComponent(publicPackArtworkMatch[1]));
        const publiclyAvailable = pack?.status === "published"
          && (pack.distribution === "worldwide" || (pack.distribution === "alist" && pack.aListPublic === true));
        if (!pack || pack.status !== "published" || (!canAccessPack(pack, user) && !(publiclyAvailable && !user))) {
          json(response, 404, { error: "Pack artwork not found." });
          return;
        }
        const upload = pack.artworkUploadId
          ? data.uploads.find((item) => item.id === pack.artworkUploadId && item.userId === pack.ownerId && item.type === "artwork")
          : undefined;
        const dubArtwork = pack.fallbackArtworkName
          ?? data.dubs.find((item) => item.id === pack.dubIds[0])?.storedArtworkName;
        const filePath = upload
          ? resolve(mediaDirectory, basename(upload.storedName))
          : dubArtwork ? resolve(mediaDirectory, basename(dubArtwork)) : undefined;
        if (!filePath || !existsSync(filePath)) {
          json(response, 404, { error: "Pack artwork not found." });
          return;
        }
        streamAudio(request, response, filePath);
        return;
      }
      if (!user) {
        json(response, 401, { error: "Sign in to continue." });
        return;
      }
      if (request.method === "GET" && route === "/api/packs") {
        const packs = data.packs
          .filter((pack) => pack.ownerId === user.id || canAccessPack(pack, user))
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
          .map((pack) => packResponse(data, pack, user, { includeOwnerGrants: true }));
        json(response, 200, { packs });
        return;
      }
      if (request.method === "POST" && route === "/api/packs") {
        const input = packInput(await readJson(request));
        const title = validatePackText(input?.title, "pack title", 100, "Untitled pack") || "Untitled pack";
        const description = validatePackText(input?.description, "pack description", 2000);
        const kind = input?.kind ?? "dub";
        const distribution = input?.distribution ?? "private";
        const aListPublic = input?.aListPublic ?? false;
        if (!["dub", "sample", "vocal"].includes(kind) || !["worldwide", "private", "alist"].includes(distribution)
          || typeof aListPublic !== "boolean" || (distribution !== "alist" && aListPublic)) {
          json(response, 400, { error: "Provide a valid pack kind and audience." });
          return;
        }
        if (distribution === "alist" && user.aListApproved !== true) {
          json(response, 403, { error: "A-List approval is required for this pack audience." });
          return;
        }
        const now = new Date().toISOString();
        const pack = {
          id: randomUUID(),
          title,
          description,
          kind,
          status: "draft",
          zipDownloads: 0,
          distribution,
          aListPublic,
          licence: validatePackText(input?.licence, "licence text", 5000),
          ownerId: user.id,
          dubIds: [],
          keys: {},
          grants: [],
          createdAt: now,
          updatedAt: now,
        };
        data.packs.push(pack);
        persist();
        json(response, 201, { pack: packResponse(data, pack, user, { includeOwnerGrants: true }) });
        return;
      }
      if (packRouteMatch) {
        const packId = decodeURIComponent(packRouteMatch[1]);
        const action = packRouteMatch[2] ?? "";
        const pack = data.packs.find((item) => item.id === packId);
        const isOwner = pack?.ownerId === user.id;
        const packForUser = () => pack && (isOwner || canAccessPack(pack, user));
        const currentPack = () => packResponse(data, pack, user, { includeOwnerGrants: true });
        const resolveDubMedia = (dub) => dub?.audioSource === "upload"
          ? resolve(mediaDirectory, basename(dub.storedAudioName ?? ""))
          : dub ? getAudioPath(dub, mediaDirectory, publicAudioDirectory) : undefined;
        const validatePackFiles = () => {
          if (!pack || pack.status !== "published" || pack.dubIds.length === 0) {
            throw Object.assign(new Error("This pack is not available for download."), { status: 404 });
          }
          const entries = [];
          let total = 0;
          for (let index = 0; index < pack.dubIds.length; index += 1) {
            const dub = data.dubs.find((item) => item.id === pack.dubIds[index]);
            if (!dub || dub.uploaderId !== pack.ownerId || !canAccessDub(data, dub, user)) {
              throw Object.assign(new Error("A track in this pack is no longer available to you."), { status: 404 });
            }
            const filePath = resolveDubMedia(dub);
            if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
              throw Object.assign(new Error("A track's original audio file is unavailable."), { status: 404 });
            }
            const size = statSync(filePath).size;
            total += size;
            const extension = extname(dub.audioFileName ?? filePath).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
            const title = String(dub.title ?? "Track").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().slice(0, 80) || "Track";
            entries.push({ name: `${String(index + 1).padStart(2, "0")} - ${title}${extension}`, path: filePath });
          }
          if (total > maxPackBytes) {
            throw Object.assign(new Error("Pack exceeds the 500 MB download limit."), { status: 413 });
          }
          if (pack.kind !== "dub" && pack.licence) entries.push({ name: "LICENCE.txt", content: `${pack.licence}\n` });
          const artwork = pack.artworkUploadId
            ? data.uploads.find((item) => item.id === pack.artworkUploadId && item.userId === pack.ownerId && item.type === "artwork")
            : undefined;
          if (pack.artworkUploadId && !artwork) {
            throw Object.assign(new Error("Pack artwork is unavailable."), { status: 404 });
          }
          if (artwork) {
            const artworkPath = resolve(mediaDirectory, basename(artwork.storedName));
            if (!existsSync(artworkPath) || !statSync(artworkPath).isFile()) {
              throw Object.assign(new Error("Pack artwork is unavailable."), { status: 404 });
            }
            entries.push({ name: `cover${extname(artwork.audioFileName).toLowerCase()}`, path: artworkPath });
          }
          return entries;
        };
        if (request.method === "GET" && !action) {
          if (!packForUser()) {
            json(response, 404, { error: "Pack not found." });
            return;
          }
          json(response, 200, { pack: currentPack(), authenticated: true });
          return;
        }
        if (request.method === "GET" && action === "artwork") {
          if (!packForUser()) {
            json(response, 404, { error: "Pack artwork not found." });
            return;
          }
          const upload = pack.artworkUploadId
            ? data.uploads.find((item) => item.id === pack.artworkUploadId && item.userId === pack.ownerId && item.type === "artwork")
            : undefined;
          const dubArtwork = pack.fallbackArtworkName
            ?? data.dubs.find((item) => item.id === pack.dubIds[0])?.storedArtworkName;
          const filePath = upload
            ? resolve(mediaDirectory, basename(upload.storedName))
            : dubArtwork ? resolve(mediaDirectory, basename(dubArtwork)) : undefined;
          if (!filePath || !existsSync(filePath)) {
            json(response, 404, { error: "Pack artwork not found." });
            return;
          }
          streamAudio(request, response, filePath);
          return;
        }
        if (request.method === "GET" && action === "archive") {
          if (!packForUser()) {
            json(response, 404, { error: "Pack not found." });
            return;
          }
          const entries = validatePackFiles();
          const safeTitle = String(pack.title || "pack").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "pack";
          await respondAfterCommit(200, async () => {
            response.writeHead(200, {
              "cache-control": "private, no-store",
              "content-type": "application/zip",
              "content-disposition": `attachment; filename="${safeTitle}.zip"; filename*=UTF-8''${encodeURIComponent(`${safeTitle}.zip`)}`,
              "x-content-type-options": "nosniff",
            });
            await pipeline(Readable.from(storedZip(entries)), response);
          });
          return;
        }
        if (request.method === "POST" && action === "download") {
          if (!packForUser() || pack.status !== "published") {
            json(response, 404, { error: "Pack not found." });
            return;
          }
          validatePackFiles();
          const downloadedAt = new Date().toISOString();
          pack.zipDownloads = (pack.zipDownloads ?? 0) + 1;
          for (const dubId of pack.dubIds) {
            data.downloads.push({ id: randomUUID(), userId: user.id, dubId, downloadedAt });
            if (!data.likes.some((like) => like.userId === user.id && like.dubId === dubId)) {
              data.likes.push({ userId: user.id, dubId, likedAt: downloadedAt });
            }
          }
          persist();
          broadcastCommunity(user.id);
          if (pack.ownerId !== user.id) broadcastCommunity(pack.ownerId);
          json(response, 200, {
            downloadUrl: `/api/packs/${encodeURIComponent(pack.id)}/archive`,
            fileName: `${String(pack.title || "pack").replace(/[^a-z0-9._ -]/gi, "").trim() || "pack"}.zip`,
          });
          return;
        }
        if (!isOwner) {
          json(response, 404, { error: "Pack not found." });
          return;
        }
        if (request.method === "PATCH" && !action) {
          const input = packInput(await readJson(request));
          const title = input.title === undefined ? pack.title : validatePackText(input.title, "pack title", 100, "Untitled pack");
          const description = input.description === undefined ? pack.description : validatePackText(input.description, "pack description", 2000);
          const kind = input.kind === undefined ? pack.kind : input.kind;
          const distribution = input.distribution === undefined ? pack.distribution : input.distribution;
          let aListPublic = input.aListPublic === undefined ? pack.aListPublic === true : input.aListPublic;
          const licence = input.licence === undefined ? pack.licence : validatePackText(input.licence, "licence text", 5000);
          if (input.aListPublic !== undefined && typeof input.aListPublic !== "boolean") {
            json(response, 400, { error: "A-List public access must be true or false." });
            return;
          }
          if (!title || !["dub", "sample", "vocal"].includes(kind) || !["worldwide", "private", "alist"].includes(distribution)) {
            json(response, 400, { error: "Provide a title, pack kind, and valid distribution." });
            return;
          }
          if (distribution !== "alist") {
            if (input.aListPublic === true) {
              json(response, 400, { error: "A-List public access is only available for A-List packs." });
              return;
            }
            aListPublic = false;
          } else if (typeof aListPublic !== "boolean") {
            json(response, 400, { error: "A-List public access must be true or false." });
            return;
          }
          if (distribution === "alist" && user.aListApproved !== true) {
            json(response, 403, { error: "A-List approval is required for this pack audience." });
            return;
          }
          if (pack.status === "published" && distribution !== pack.distribution) {
            json(response, 409, { error: "A pack's distribution cannot be changed after publishing." });
            return;
          }
          if (pack.status === "published" && pack.distribution === "alist" && aListPublic !== (pack.aListPublic === true)) {
            json(response, 409, { error: "A published A-List pack's audience cannot be changed." });
            return;
          }
          if (pack.status === "published" && input.dubIds !== undefined && Array.isArray(input.dubIds) && input.dubIds.length === 0) {
            json(response, 400, { error: "A published pack must contain at least one track." });
            return;
          }
          if (pack.status === "published" && kind !== "dub" && !licence?.trim()) {
            json(response, 400, { error: "Sample and Vocal packs require user-written usage terms before publishing." });
            return;
          }
          let dubIds = pack.dubIds;
          if (input.dubIds !== undefined) {
            if (!Array.isArray(input.dubIds) || input.dubIds.length > maxPackItems
              || input.dubIds.some((id) => typeof id !== "string") || new Set(input.dubIds).size !== input.dubIds.length) {
              json(response, 400, { error: "Packs can contain up to 50 unique tracks in a specified order." });
              return;
            }
            dubIds = input.dubIds;
          }
          for (const dubId of dubIds) {
            const dub = data.dubs.find((item) => item.id === dubId && item.uploaderId === user.id);
            if (!dub) {
              json(response, 400, { error: `Track ${dubId} is not one of your tracks.` });
              return;
            }
            const audience = packAudience(dub);
            if (!canIncludePackKind(kind, packMemberKind(data, pack, dub))) {
              json(response, 409, { error: `Track "${dub.title}" has an incompatible media type. Dub Packs accept dubs; Sample Packs accept samples and vocals; Vocal Packs accept only vocals.` });
              return;
            }
            if (dub.draftPackId && dub.draftPackId !== pack.id) {
              json(response, 409, { error: "A track created inside another draft cannot be moved between packs." });
              return;
            }
            if (!(pack.status === "draft" && dub.draftPackId === pack.id)
              && (audience.distribution !== distribution || audience.aListPublic !== aListPublic)) {
              json(response, 409, { error: `Track "${dub.title}" has an incompatible audience (${audience.distribution}${audience.distribution === "alist" ? `, public=${audience.aListPublic}` : ""}).` });
              return;
            }
          }
          if (pack.status === "published" && dubIds.some((id) => !pack.dubIds.includes(id))
            && pack.grants?.length && input.confirmNewAccess !== true) {
            json(response, 409, { error: "Adding tracks will share them with current pack recipients; confirmNewAccess is required." });
            return;
          }
          const artworkUploadId = input.artworkUploadId === null ? undefined
            : input.artworkUploadId === undefined ? pack.artworkUploadId : input.artworkUploadId;
          if (artworkUploadId && !data.uploads.some((item) => item.id === artworkUploadId && item.userId === user.id && item.type === "artwork")) {
            json(response, 400, { error: "Choose an artwork upload owned by you." });
            return;
          }
          const totalBytes = dubIds.reduce((total, dubId) => {
            const dub = data.dubs.find((item) => item.id === dubId);
            const filePath = resolveDubMedia(dub);
            return total + (filePath && existsSync(filePath) ? statSync(filePath).size : 0);
          }, 0);
          if (totalBytes > maxPackBytes) {
            json(response, 413, { error: "Packs cannot exceed 500 MB of audio." });
            return;
          }
          for (const removedId of pack.dubIds.filter((id) => !dubIds.includes(id))) {
            const removedDub = data.dubs.find((item) => item.id === removedId);
            if (removedDub?.draftPackId === pack.id) {
              removedDub.distribution = "private";
              removedDub.aListPublic = false;
              delete removedDub.draftPackId;
            }
          }
          if (pack.status === "draft" && (distribution !== pack.distribution || aListPublic !== (pack.aListPublic === true))) {
            for (const dubId of dubIds) {
              const draftDub = data.dubs.find((item) => item.id === dubId && item.draftPackId === pack.id);
              if (draftDub) draftDub.draftAudience = { distribution, aListPublic };
            }
          }
          pack.title = title;
          pack.description = description;
          pack.kind = kind;
          pack.distribution = distribution;
          pack.aListPublic = aListPublic;
          pack.licence = licence;
          pack.dubIds = [...dubIds];
          pack.artworkUploadId = artworkUploadId;
          if (!artworkUploadId) {
            pack.fallbackArtworkName = data.dubs.find((item) => item.id === pack.dubIds[0])?.storedArtworkName;
          }
          pack.updatedAt = new Date().toISOString();
          persist();
          for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
          json(response, 200, { pack: currentPack() });
          return;
        }
        if (request.method === "POST" && action === "tracks") {
          const input = packInput(await readJson(request));
          if (pack.distribution === "alist" && user.aListApproved !== true) {
            json(response, 403, { error: "A-List approval is required to add tracks to this pack." });
            return;
          }
          const requestId = input.requestId === undefined ? undefined : validatePackText(input.requestId, "request ID", 100);
          const requestedDubId = requestId && pack.trackRequests?.[requestId];
          const replayDubId = (requestedDubId && pack.dubIds.includes(requestedDubId) ? requestedDubId : undefined)
            || (input.uploadId && pack.dubIds.find((id) => data.dubs.find((item) => item.id === id)?.packUploadId === input.uploadId));
          if (replayDubId) {
            const replayDub = data.dubs.find((item) => item.id === replayDubId);
            if (replayDub) {
              json(response, 201, { pack: currentPack(), dub: publicDub(data, replayDub, user.id) });
              return;
            }
          }
          if (pack.dubIds.length >= maxPackItems) {
            json(response, 400, { error: "Packs can contain at most 50 tracks." });
            return;
          }
          const title = validatePackText(input.title, "track title", 100);
          const artist = data.artists.find((item) => item.id === input.artistId && item.userId === user.id);
          const upload = data.uploads.find((item) => item.id === input.uploadId && item.userId === user.id && item.type === "audio");
          if (!title || !artist || !upload) {
            json(response, 400, { error: "Provide a title, your artist profile, and an uploaded audio file." });
            return;
          }
          if (pack.status === "published" && pack.grants?.length && input.confirmNewAccess !== true) {
            json(response, 409, { error: "Adding a track will share it with current pack recipients; confirmNewAccess is required." });
            return;
          }
          const durationSeconds = audioDurationSeconds(Number(input.durationSeconds));
          const trackKey = validatePackText(input.key, "track key", 20);
          const dub = {
            id: randomUUID(),
            ...(pack.kind === "vocal" ? { mediaKind: "vocal" } : {}),
            distribution: "private",
            ...(pack.distribution === "alist" ? { aListPublic: false } : {}),
            title,
            artist: artist.name,
            artistId: artist.id,
            uploaderId: user.id,
            uploader: user.username,
            uploaderDisplayName: user.displayName,
            uploadedAt: new Date().toISOString(),
            version: 1,
            bpm: Number.isInteger(input.bpm) && input.bpm >= 1 && input.bpm <= 300 ? input.bpm : 0,
            key: typeof input.key === "string" ? input.key.trim().slice(0, 20) || undefined : undefined,
            tags: normalizeDubTags(input.tags),
            genre: normalizeDubTags(input.tags).join(", ").slice(0, 160) || "Uncategorized",
            duration: formatAudioDuration(durationSeconds),
            audioFormat: audioFormat(upload.audioFileName),
            audioBytes: upload.bytes,
            audioBytes: upload.bytes,
            bitrateKbps: averageBitrateKbps(upload.bytes, durationSeconds),
            artwork: "whitelabel",
            message: String(input.message ?? "").trim().slice(0, 400) || "A new dub from the studio.",
            key: trackKey || undefined,
            audioUrl: `/api/dubs/${randomUUID()}/audio`,
            audioFileName: upload.audioFileName,
            storedAudioName: upload.storedName,
            audioSource: "upload",
            draftPackId: pack.id,
            draftAudience: { distribution: pack.distribution, aListPublic: pack.aListPublic === true },
            packUploadId: upload.id,
          };
          dub.audioUrl = `/api/dubs/${dub.id}/audio`;
          const nextTotal = [...pack.dubIds, dub.id].reduce((total, id) => {
            const item = id === dub.id ? dub : data.dubs.find((entry) => entry.id === id);
            return total + (item?.audioBytes ?? 0);
          }, 0);
          if (nextTotal > maxPackBytes) {
            json(response, 413, { error: "Packs cannot exceed 500 MB of audio." });
            return;
          }
          data.dubs.unshift(dub);
          data.uploads = data.uploads.filter((item) => item.id !== upload.id);
          pack.dubIds.push(dub.id);
          pack.keys ??= {};
          if (trackKey) pack.keys[dub.id] = trackKey;
          if (requestId) {
            pack.trackRequests ??= {};
            pack.trackRequests[requestId] = dub.id;
          }
          pack.updatedAt = new Date().toISOString();
          if (pack.status === "published") {
            dub.distribution = pack.distribution;
            dub.aListPublic = pack.distribution === "alist" && pack.aListPublic === true;
            delete dub.draftPackId;
            delete dub.draftAudience;
          }
          persist();
          json(response, 201, { pack: currentPack(), dub: packDubResponse(data, pack, dub, user) });
          return;
        }
        const trackMetadataMatch = action.match(/^tracks\/([^/]+)$/);
        if (request.method === "PATCH" && trackMetadataMatch) {
          const dubId = decodeURIComponent(trackMetadataMatch[1]);
          const dub = data.dubs.find((item) => item.id === dubId && item.uploaderId === user.id);
          if (!dub || !pack.dubIds.includes(dub.id)) {
            json(response, 404, { error: "Track not found in this pack." });
            return;
          }
          const input = packInput(await readJson(request));
          const next = {};
          if (input.title !== undefined) {
            next.title = validatePackText(input.title, "track title", 100);
            if (!next.title) { json(response, 400, { error: "Track title is required." }); return; }
          }
          if (input.artistId !== undefined) {
            const artist = data.artists.find((item) => item.id === input.artistId && item.userId === user.id);
            if (!artist) { json(response, 400, { error: "Choose one of your artist profiles." }); return; }
            next.artistId = artist.id;
            next.artist = artist.name;
          }
          if (input.tags !== undefined) {
            next.tags = normalizeDubTags(input.tags);
            next.genre = next.tags.join(", ").slice(0, 160) || "Uncategorized";
          }
          if (input.bpm !== undefined) next.bpm = Number.isInteger(input.bpm) && input.bpm >= 1 && input.bpm <= 300 ? input.bpm : 0;
          if (input.key !== undefined) {
            next.key = validatePackText(input.key, "track key", 20) || undefined;
          }
          if (input.message !== undefined) next.message = validatePackText(input.message, "track message", 400);
          Object.assign(dub, next);
          if (input.key !== undefined) {
            pack.keys ??= {};
            if (dub.key) pack.keys[dub.id] = dub.key;
            else delete pack.keys[dub.id];
          }
          pack.updatedAt = new Date().toISOString();
          persist();
          for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
          json(response, 200, { pack: currentPack(), dub: packDubResponse(data, pack, dub, user) });
          return;
        }
        if (request.method === "POST" && action === "publish") {
          if (pack.distribution === "alist" && user.aListApproved !== true) {
            json(response, 403, { error: "A-List approval is required to publish this pack." });
            return;
          }
          if (!["dub", "sample", "vocal"].includes(pack.kind) || pack.dubIds.length === 0 || pack.dubIds.length > maxPackItems) {
            json(response, 400, { error: "A pack must contain between 1 and 50 tracks before publishing." });
            return;
          }
          if (pack.kind !== "dub" && !pack.licence?.trim()) {
            json(response, 400, { error: "Sample and Vocal packs require user-written usage terms before publishing." });
            return;
          }
          for (const dubId of pack.dubIds) {
            const dub = data.dubs.find((item) => item.id === dubId && item.uploaderId === user.id);
            const audience = dub && packAudience(dub);
            if (dub && !canIncludePackKind(pack.kind, packMemberKind(data, pack, dub))) {
              json(response, 409, { error: `Track "${dub.title}" has an incompatible media type for this pack.` });
              return;
            }
            if (!dub || audience.distribution !== pack.distribution || audience.aListPublic !== (pack.aListPublic === true)) {
              json(response, 409, { error: `Track "${dub?.title ?? dubId}" has an incompatible audience and cannot be published in this pack.` });
              return;
            }
            const filePath = resolveDubMedia(dub);
            if (!filePath || !existsSync(filePath)) {
              json(response, 404, { error: `Audio file for "${dub.title}" is unavailable.` });
              return;
            }
          }
          const totalBytes = pack.dubIds.reduce((total, dubId) => total + statSync(resolveDubMedia(data.dubs.find((item) => item.id === dubId))).size, 0);
          if (totalBytes > maxPackBytes) {
            json(response, 413, { error: "Packs cannot exceed 500 MB of audio." });
            return;
          }
          pack.status = "published";
          for (const dubId of pack.dubIds) {
            const dub = data.dubs.find((item) => item.id === dubId);
            if (dub) delete dub.draftPackId;
            if (dub) {
              dub.distribution = pack.distribution;
              dub.aListPublic = pack.distribution === "alist" && pack.aListPublic === true;
              delete dub.draftAudience;
            }
          }
          if (!pack.artworkUploadId) {
            const firstArtwork = data.dubs.find((item) => item.id === pack.dubIds[0])?.storedArtworkName;
            if (firstArtwork) pack.fallbackArtworkName = firstArtwork;
          }
          pack.updatedAt = new Date().toISOString();
          persist();
          for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
          json(response, 200, { pack: currentPack() });
          return;
        }
        if (request.method === "DELETE" && !action) {
          for (const dub of data.dubs.filter((item) => item.draftPackId === pack.id)) {
            dub.distribution = "private";
            dub.aListPublic = false;
            delete dub.draftPackId;
          }
          data.packs = data.packs.filter((item) => item.id !== pack.id);
          persist();
          json(response, 200, { id: pack.id });
          return;
        }
        if (request.method === "POST" && action === "share") {
          const input = packInput(await readJson(request));
          if (pack.status !== "published" || pack.distribution !== "private") {
            json(response, 400, { error: "Only published private packs can be shared with selected friends." });
            return;
          }
          if (!Array.isArray(input.buddyIds) || input.buddyIds.some((id) => typeof id !== "string")) {
            json(response, 400, { error: "Provide the selected friend IDs." });
            return;
          }
          const friends = input.buddyIds.map((buddyId) => data.friendships.find((item) => item.id === buddyId && item.ownerId === user.id));
          if (friends.some((friend) => !friend)) {
            json(response, 400, { error: "Every selected recipient must be an existing friend." });
            return;
          }
          const userIds = [...new Set(friends.map((friend) => friend.friendUserId))];
          const oldIds = new Set((pack.grants ?? []).map((grant) => grant.userId ?? grant.id));
          const additions = userIds.filter((id) => !oldIds.has(id));
          if (additions.length && oldIds.size && input.confirmNewAccess !== true) {
            json(response, 409, { error: "Adding recipients grants them pack access; confirmNewAccess is required." });
            return;
          }
          pack.grants = userIds.map((userId) => ({ userId, grantedAt: oldIds.has(userId)
            ? pack.grants.find((grant) => (grant.userId ?? grant.id) === userId)?.grantedAt
            : new Date().toISOString() }));
          pack.updatedAt = new Date().toISOString();
          for (const recipientId of additions) {
            const recipient = data.users.find((item) => item.id === recipientId);
            if (!recipient) continue;
            const recipientFriendship = findOrCreateFriendship(data, recipient, user);
            const senderFriendship = findOrCreateFriendship(data, user, recipient);
            const sentAt = new Date().toISOString();
            const messageId = randomUUID();
            const text = `${user.displayName} shared “${pack.title}”: /#pack?id=${encodeURIComponent(pack.id)}`;
            findOrCreateConversation(data, user.id, senderFriendship.id).messages.push({
              id: messageId, sender: "you", text, sentAt, packId: pack.id,
            });
            findOrCreateConversation(data, recipient.id, recipientFriendship.id).messages.push({
              id: messageId, sender: "them", text, sentAt, packId: pack.id,
            });
            recipientFriendship.unread = (recipientFriendship.unread ?? 0) + 1;
          }
          persist();
          for (const connectedUserId of new Set([...oldIds, ...userIds])) broadcastCommunity(connectedUserId);
          json(response, 200, { pack: currentPack() });
          return;
        }
        const revokePackGrantMatch = action.match(/^grants\/([^/]+)$/);
        if (request.method === "DELETE" && revokePackGrantMatch) {
          const userId = decodeURIComponent(revokePackGrantMatch[1]);
          const oldLength = pack.grants?.length ?? 0;
          pack.grants = (pack.grants ?? []).filter((grant) => (grant.userId ?? grant.id) !== userId);
          if (pack.grants.length === oldLength) {
            json(response, 404, { error: "Pack recipient not found." });
            return;
          }
          pack.updatedAt = new Date().toISOString();
          persist();
          broadcastCommunity(userId);
          json(response, 200, { pack: currentPack() });
          return;
        }
        json(response, 404, { error: "Pack route not found." });
        return;
      }
      if (match && match[1] === "dubs" && match[3] === "preview" && request.method === "PATCH") {
        const dub = data.dubs.find((item) => item.id === match[2] && item.uploaderId === user.id);
        if (!dub || !canShareDubExternally(dub)) {
          json(response, 404, { error: "Public dub not found." });
          return;
        }
        const input = await readJson(request);
        if (!previewDurations.includes(input?.previewSeconds)) {
          json(response, 400, { error: "Choose a 30, 60 or 90 second preview." });
          return;
        }
        dub.previewSeconds = input.previewSeconds;
        persist();
        for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
        json(response, 200, { previewSeconds: dub.previewSeconds });
        return;
      }
      if (route === "/api/push/config" && request.method === "GET") {
        json(response, 200, { publicKey: pushService?.publicKey ?? null });
        return;
      }
      if (route === "/api/push/status" && request.method === "POST") {
        const input = await readJson(request);
        if (!input || typeof input.endpoint !== "string" || input.endpoint.length > 2048) {
          json(response, 400, { error: "Invalid push endpoint." });
          return;
        }
        json(response, 200, { enabled: data.pushSubscriptions.some((item) => item.userId === user.id && item.subscription.endpoint === input.endpoint) });
        return;
      }
      if (route === "/api/push/subscription" && request.method === "POST") {
        if (!pushService) {
          json(response, 503, { error: "Push notifications are not configured on this server." });
          return;
        }
        if (!isAllowedWebSocketOrigin(request)) {
          json(response, 403, { error: "Invalid request origin." });
          return;
        }
        const subscription = await readJson(request);
        if (!validPushSubscription(subscription)) {
          json(response, 400, { error: "Invalid push subscription." });
          return;
        }
        if (data.pushSubscriptions.filter((item) => item.userId === user.id && item.subscription.endpoint !== subscription.endpoint).length >= 20) {
          json(response, 400, { error: "Too many push subscriptions for this account." });
          return;
        }
        data.pushSubscriptions = data.pushSubscriptions.filter((item) => item.subscription.endpoint !== subscription.endpoint);
        data.pushSubscriptions.push({ userId: user.id, subscription: {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        } });
        persist();
        json(response, 200, { status: "ok" });
        return;
      }
      if (route === "/api/push/subscription" && request.method === "DELETE") {
        if (!isAllowedWebSocketOrigin(request)) {
          json(response, 403, { error: "Invalid request origin." });
          return;
        }
        const input = await readJson(request);
        if (!input || typeof input.endpoint !== "string" || input.endpoint.length > 2048) {
          json(response, 400, { error: "Invalid push endpoint." });
          return;
        }
        data.pushSubscriptions = data.pushSubscriptions.filter((item) => item.userId !== user.id || item.subscription.endpoint !== input.endpoint);
        persist();
        json(response, 200, { status: "ok" });
        return;
      }
      if (route.startsWith("/api/admin/") && !isAdministrator(user)) {
          json(response, 403, { error: "This account is not configured as an administrator." });
          return;
      }
      if (route === "/api/admin/overview" && request.method === "GET") {
        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const accessibleDubs = data.dubs.filter((dub) => !dub.draftPackId && canAccessDub(data, dub, user));
        const accessibleDubIds = new Set(accessibleDubs.map((dub) => dub.id));
        const recentDubs = accessibleDubs.filter((dub) => Date.parse(dub.uploadedAt) >= since);
        const recentUsers = data.users.filter((account) => Date.parse(account.createdAt ?? 0) >= since);
        const activity = Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setUTCHours(0, 0, 0, 0);
          date.setUTCDate(date.getUTCDate() - (6 - index));
          const next = new Date(date);
          next.setUTCDate(next.getUTCDate() + 1);
          return {
            date: date.toISOString().slice(0, 10),
            uploads: accessibleDubs.filter((dub) => Date.parse(dub.uploadedAt) >= date.getTime() && Date.parse(dub.uploadedAt) < next.getTime()).length,
            members: data.users.filter((account) => Date.parse(account.createdAt ?? 0) >= date.getTime() && Date.parse(account.createdAt ?? 0) < next.getTime()).length,
          };
        });
        const userById = new Map(data.users.map((account) => [account.id, account]));
        const dubs = accessibleDubs.map((dub) => ({
          id: dub.id, title: dub.title, artist: dub.artist, artistId: dub.artistId,
          uploader: dub.uploaderDisplayName || userById.get(dub.uploaderId)?.displayName || dub.uploader,
          username: userById.get(dub.uploaderId)?.username ?? dub.uploader,
          uploadedAt: dub.uploadedAt, genre: dub.genre, tags: dub.tags ?? [],
          likes: data.likes.filter((like) => like.dubId === dub.id).length,
          downloads: data.downloads.filter((download) => download.dubId === dub.id).length,
        })).sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
        const users = data.users.map((account) => ({
          id: account.id, username: account.username, displayName: account.displayName,
          genre: account.genre, role: account.role, presence: account.presence,
          createdAt: account.createdAt ?? null,
          uploads: accessibleDubs.filter((dub) => dub.uploaderId === account.id).length,
          friends: data.friendships.filter((friendship) => friendship.ownerId === account.id).length,
        })).sort((a, b) => (Date.parse(b.createdAt ?? 0) || 0) - (Date.parse(a.createdAt ?? 0) || 0));
        const topDubs = [...dubs].sort((a, b) => b.downloads - a.downloads).slice(0, 5);
        json(response, 200, {
          generatedAt: new Date().toISOString(),
          administrator: { username: user.username, displayName: user.displayName },
          metrics: {
            members: users.length, tracks: dubs.length,
            downloads: data.downloads.filter((download) => accessibleDubIds.has(download.dubId)).length,
            connections: new Set(
              data.friendships.map((friendship) =>
                JSON.stringify([friendship.ownerId, friendship.friendUserId].sort()),
              ),
            ).size,
            uploadsThisWeek: recentDubs.length, membersThisWeek: recentUsers.length,
          },
          users, dubs, topDubs, activity,
        });
        return;
      }
      if (route === "/api/alist/application" && request.method === "POST") {
        const fields = validateApplication(await readJson(request));
        const latest = data.aListApplications.filter((application) => application.userId === user.id).at(-1);
        if (user.aListApproved === true || latest?.status === "pending") {
          json(response, 409, { error: "An application is already pending or your account is approved." });
          return;
        }
        const now = new Date().toISOString();
        let application;
        if (latest?.status === "more_information") {
          application = latest;
          application.versions.push({ fields, submittedAt: now });
          application.status = "pending";
          application.updatedAt = now;
        } else {
          application = { id: randomUUID(), userId: user.id, status: "pending", createdAt: now, updatedAt: now, versions: [{ fields, submittedAt: now }], decisions: [] };
          data.aListApplications.push(application);
        }
        persist();
        broadcastCommunity(user.id);
        json(response, 201, application);
        return;
      }
      if (route === "/api/admin/alist/applications" && request.method === "GET") {
        json(response, 200, { applications: data.aListApplications.map((application) => {
          const applicant = data.users.find((item) => item.id === application.userId);
          return { ...application, username: applicant?.username ?? "unknown", displayName: applicant?.displayName ?? "Unknown", approved: applicant?.aListApproved === true };
        }).reverse() });
        return;
      }
      if (route === "/api/admin/alist/members" && request.method === "GET") {
        json(response, 200, { members: data.users.filter((item) => item.aListApproved === true).map(({ id, username, displayName }) => ({ id, username, displayName })) });
        return;
      }
      const revokeMemberMatch = route.match(/^\/api\/admin\/alist\/members\/([^/]+)\/revoke$/);
      if (revokeMemberMatch && request.method === "POST") {
        const input = await readJson(request);
        const applicant = data.users.find((item) => item.id === revokeMemberMatch[1]);
        if (!applicant) { json(response, 404, { error: "Member not found." }); return; }
        if (applicant.aListApproved !== true) { json(response, 409, { error: "This member does not have A-List access." }); return; }
        if (input?.note !== undefined && (typeof input.note !== "string" || input.note.trim().length > 2000)) {
          json(response, 400, { error: "Provide a valid note up to 2000 characters." }); return;
        }
        const note = input?.note?.trim() ?? "";
        const now = new Date().toISOString();
        const decision = { action: "revoke", note, administratorId: user.id, administrator: user.username, decidedAt: now };
        const latest = data.aListApplications.filter((item) => item.userId === applicant.id).at(-1);
        if (latest?.status === "approved") {
          latest.status = "revoked";
          latest.updatedAt = now;
          latest.decisions.push(decision);
        }
        data.aListAccessDecisions.push({ userId: applicant.id, ...decision });
        applicant.aListApproved = false;
        data.notifications.push({ id: randomUUID(), userId: applicant.id, message: `Your A-List access has been revoked. You can apply again.${note ? ` ${note}` : ""}`, type: "info", createdAt: now, read: false });
        persist();
        for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
        json(response, 200, { status: "revoked" });
        return;
      }
      const decisionMatch = route.match(/^\/api\/admin\/alist\/applications\/([^/]+)\/decision$/);
      if (decisionMatch && request.method === "POST") {
        const input = await readJson(request);
        const application = data.aListApplications.find((item) => item.id === decisionMatch[1]);
        const applicant = application && data.users.find((item) => item.id === application.userId);
        if (!application || !applicant) {
          json(response, 404, { error: "Application not found." });
          return;
        }
        const action = input?.action;
        const note = typeof input?.note === "string" ? input.note.trim() : "";
        if (!["approve", "reject", "request_information", "revoke"].includes(action) || (input?.note !== undefined && typeof input.note !== "string") || note.length > 2000 || (action === "request_information" && !note)) {
          json(response, 400, { error: "Provide a valid decision and include a note when requesting information." });
          return;
        }
        const latest = data.aListApplications.filter((item) => item.userId === applicant.id).at(-1);
        if (latest !== application || (action === "revoke" ? application.status !== "approved" || applicant.aListApproved !== true : application.status !== "pending")) {
          json(response, 409, { error: "This application is no longer eligible for that decision." });
          return;
        }
        const now = new Date().toISOString();
        const statuses = { approve: "approved", reject: "rejected", request_information: "more_information", revoke: "revoked" };
        application.status = statuses[action];
        application.updatedAt = now;
        application.decisions.push({ action, note, administratorId: user.id, administrator: user.username, decidedAt: now });
        applicant.aListApproved = action === "approve";
        const messages = {
          approve: "Your A-List application has been approved.",
          reject: "Your A-List application was not approved. You can apply again.",
          request_information: "More information is needed for your A-List application.",
          revoke: "Your A-List access has been revoked. You can apply again.",
        };
        data.notifications.push({ id: randomUUID(), userId: applicant.id, message: `${messages[action]}${note ? ` ${note}` : ""}`, type: "info", createdAt: now, read: false });
        persist();
        for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
        json(response, 200, { status: application.status });
        return;
      }
      if (route === "/api/notifications/read" && request.method === "POST") {
        for (const notification of data.notifications) if (notification.userId === user.id) notification.read = true;
        persist();
        broadcastCommunity(user.id);
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (route === "/api/notifications" && request.method === "DELETE") {
        data.notifications = data.notifications.filter((notification) => notification.userId !== user.id);
        persist();
        broadcastCommunity(user.id);
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      const notificationMatch = route.match(/^\/api\/notifications\/([^/]+)$/);
      if (notificationMatch && request.method === "DELETE") {
        const index = data.notifications.findIndex((notification) => notification.id === notificationMatch[1] && notification.userId === user.id);
        if (index === -1) {
          json(response, 404, { error: "Notification not found." });
          return;
        }
        data.notifications.splice(index, 1);
        persist();
        broadcastCommunity(user.id);
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (request.method === "GET" && route === "/api/community") {
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (request.method === "GET" && route === "/api/workspace") {
        json(response, 200, visibleWindowWorkspace(data, user), { "cache-control": "private, no-store" });
        return;
      }
      if (request.method === "GET" && route === "/api/onboarding") {
        json(response, 200, onboardingProgress(user), { "cache-control": "private, no-store" });
        return;
      }
      if (request.method === "PATCH" && route === "/api/onboarding") {
        const input = await readJson(request);
        if (input?.ownerId !== user.id) {
          json(response, 409, { error: "Tutorial progress belongs to a different account. Reload before saving." });
          return;
        }
        if (!["desktop", "mobile"].includes(input.platform)
          || !["dismiss", "complete"].includes(input.action)
          || (input.action === "complete" && !onboardingLessonIds.includes(input.lessonId))) {
          json(response, 400, { error: "Provide a valid tutorial platform, action and lesson." });
          return;
        }
        const progress = onboardingProgress(user);
        progress[input.platform].dismissed = true;
        if (input.action === "complete" && !progress[input.platform].completed.includes(input.lessonId)) {
          progress[input.platform].completed.push(input.lessonId);
        }
        user.onboarding = progress;
        persist();
        json(response, 200, onboardingProgress(user), { "cache-control": "private, no-store" });
        return;
      }
      if (request.method === "PUT" && route === "/api/workspace") {
        const input = await readJson(request);
        if (input?.ownerId !== user.id) {
          json(response, 409, { error: "This window workspace belongs to a different account. Reload before saving." });
          return;
        }
        const parsed = parseWindowWorkspace(input.workspace);
        if (parsed.error) {
          json(response, 400, { error: parsed.error });
          return;
        }
        user.windowWorkspace = parsed.workspace;
        user.windowWorkspace = visibleWindowWorkspace(data, user);
        persist();
        json(response, 200, user.windowWorkspace, { "cache-control": "private, no-store" });
        return;
      }
      if (request.method === "PUT" && route === "/api/playback") {
        const input = await readJson(request);
        if (!input || typeof input !== "object" || typeof input.dubId !== "string") {
          json(response, 400, { error: "Provide a valid dub and playback position." });
          return;
        }
        if (!canAccessDub(data, data.dubs.find((dub) => dub.id === input.dubId), user)) {
          json(response, 404, { error: "Dub not found." });
          return;
        }
        if (typeof input.positionSeconds !== "number" || !Number.isFinite(input.positionSeconds) || input.positionSeconds < 0) {
          json(response, 400, { error: "Provide a valid playback position." });
          return;
        }
        user.lastPlayback = { dubId: input.dubId, positionSeconds: input.positionSeconds };
        persist();
        json(response, 200, user.lastPlayback);
        return;
      }
      if (request.method === "GET" && route === "/api/dubs/search") {
        const mediaKind = url.searchParams.get("mediaKind");
        if (mediaKind !== null && !["dub", "sample", "vocal"].includes(mediaKind)) {
          json(response, 400, { error: "Choose a valid media kind." });
          return;
        }
        const distribution = url.searchParams.get("distribution") ?? "worldwide";
        if (!["worldwide", "alist", "feed"].includes(distribution)) {
          json(response, 400, { error: "Choose a valid feed." });
          return;
        }
        if (distribution === "alist" && user.aListApproved !== true) {
          json(response, 403, { error: "A-List approval is required." });
          return;
        }
        const distributionTypes = url.searchParams.getAll("distributionType");
        if (distributionTypes.length && (distribution !== "feed" || distributionTypes.some((type) => !["worldwide", "private", "alist"].includes(type)))) {
          json(response, 400, { error: "Choose valid distribution types for the feed." });
          return;
        }
        const query = String(url.searchParams.get("q") ?? "").trim().slice(0, 120).toLocaleLowerCase();
        const tags = url.searchParams.getAll("tag").map((tag) => tag.trim()).filter((tag) => dubTags.has(tag));
        const fileType = String(url.searchParams.get("fileType") ?? "").trim().toLocaleUpperCase();
        const rangeValue = (key, maximum) => {
          const value = url.searchParams.get(key);
          if (value === null || value === "") return undefined;
          const number = Number(value);
          return Number.isFinite(number) && number >= 0 && number <= maximum ? number : NaN;
        };
        const minBpm = rangeValue("minBpm", 300);
        const maxBpm = rangeValue("maxBpm", 300);
        const minBitrate = rangeValue("minBitrate", 1000);
        const maxBitrate = rangeValue("maxBitrate", 1000);
        if ([minBpm, maxBpm, minBitrate, maxBitrate].some(Number.isNaN) || (minBpm !== undefined && maxBpm !== undefined && minBpm > maxBpm) || (minBitrate !== undefined && maxBitrate !== undefined && minBitrate > maxBitrate)) {
          json(response, 400, { error: "Provide BPM values from 0 to 300 and bitrate values from 0 to 1000, with minimums no greater than maximums." });
          return;
        }
        const matchingPackDubIds = new Set(query ? data.packs
          .filter((pack) => pack.status === "published" && canAccessPack(pack, user)
            && (!mediaKind || pack.kind === mediaKind)
            && `${pack.title} ${pack.description} ${pack.kind === "vocal" ? "Vocal Pack" : pack.kind === "sample" ? "Sample Pack" : "Dub Pack"}`.toLocaleLowerCase().includes(query))
          .flatMap((pack) => pack.dubIds) : []);
        const filtered = data.dubs.filter((dub) => {
          if (dub.draftPackId) return false;
          if (mediaKind && dubMediaKind(data, dub) !== mediaKind) return false;
          if ((distribution === "feed" ? !(distributionTypes.length ? distributionTypes : ["worldwide", "alist"]).includes(dub.distribution) : dub.distribution !== distribution) || !canAccessDub(data, dub, user)) return false;
          const dubTags = dub.tags ?? [];
          const format = dub.audioFormat ?? audioFormat(dub.audioFileName);
          const searchable = [dub.title, dub.artist, dub.uploader, dub.uploaderDisplayName, dub.genre, dub.message, format, ...dubTags].filter(Boolean).join(" ").toLocaleLowerCase();
          if (query && !searchable.includes(query) && !matchingPackDubIds.has(dub.id)) return false;
          if (tags.length && !tags.some((tag) => dubTags.includes(tag))) return false;
          if (fileType && format?.toLocaleUpperCase() !== fileType) return false;
          if (minBpm !== undefined && (!Number.isFinite(dub.bpm) || dub.bpm < minBpm)) return false;
          if (maxBpm !== undefined && (!Number.isFinite(dub.bpm) || dub.bpm > maxBpm)) return false;
          if (minBitrate !== undefined && (!Number.isFinite(dub.bitrateKbps) || dub.bitrateKbps < minBitrate)) return false;
          if (maxBitrate !== undefined && (!Number.isFinite(dub.bitrateKbps) || dub.bitrateKbps > maxBitrate)) return false;
          return true;
        }).sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
        json(response, 200, { dubs: filtered.map((dub) => publicDub(data, dub, user.id)) });
        return;
      }
      const profileMediaMatch = route.match(/^\/api\/profiles\/([^/]+)\/(avatar|banner)$/);
      if (request.method === "GET" && profileMediaMatch) {
        const profileUser = data.users.find((candidate) => candidate.id === profileMediaMatch[1]);
        const storedName = profileMediaMatch[2] === "avatar"
          ? profileUser?.avatarStoredName
          : profileUser?.bannerStoredName;
        if (!storedName) {
          json(response, 404, { error: "Profile image not found." });
          return;
        }
        const filePath = resolve(mediaDirectory, basename(storedName));
        if (!existsSync(filePath)) {
          json(response, 404, { error: "Profile image file not found." });
          return;
        }
        streamAudio(request, response, filePath);
        return;
      }
      if (request.method === "GET" && route === "/api/members") {
        const query = String(url.searchParams.get("q") ?? "").trim().toLocaleLowerCase();
        const friendIds = new Set(data.friendships
          .filter((friendship) => friendship.ownerId === user.id)
          .map((friendship) => friendship.friendUserId));
        const members = query.length < 2 ? [] : data.users
          .filter((candidate) => candidate.id !== user.id && !friendIds.has(candidate.id))
          .filter((candidate) => candidate.username.toLocaleLowerCase().includes(query)
            || candidate.id.toLocaleLowerCase() === query
            || data.artists.some((artist) => artist.userId === candidate.id && artist.id.toLocaleLowerCase() === query))
          .slice(0, 8)
          .map((candidate) => ({
            id: candidate.id,
            artistId: data.artists.find((artist) => artist.userId === candidate.id)?.id,
            username: candidate.username,
            displayName: candidate.displayName,
            genre: candidate.genre,
            avatarUrl: candidate.avatarUrl,
            aListApproved: candidate.aListApproved === true,
          }));
        json(response, 200, { members });
        return;
      }
      if (match && match[1] === "conversations" && request.method === "GET" && match[3] === "messages") {
        const page = getConversationMessagePage(data, user, match[2], url.searchParams.get("before"));
        if (page.error) {
          json(response, page.status, { error: page.error });
          return;
        }
        json(response, 200, page);
        return;
      }
      if (request.method === "POST" && route === "/api/uploads") {
        const audioFileName = basename(decodeURIComponent(request.headers["x-file-name"] ?? ""));
        const extension = extname(audioFileName).toLowerCase();
        const requestedType = url.searchParams.get("type");
        const type = ["artwork", "avatar", "banner"].includes(requestedType) ? requestedType : "audio";
        const isImage = type !== "audio";
        const allowedExtensions = isImage
          ? [".jpg", ".jpeg", ".png", ".webp"]
          : [".wav", ".mp3", ".ogg", ".m4a", ".aac", ".flac", ".webm"];
        if (!audioFileName || !allowedExtensions.includes(extension)) {
          json(response, 400, { error: isImage ? "Choose a JPG, PNG, or WebP image." : "Choose a supported audio file." });
          return;
        }
        const uploadId = randomUUID();
        const storedName = `${uploadId}${extension}`;
        const targetPath = join(mediaDirectory, storedName);
        const bytes = await uploadFile(
          request,
          targetPath,
          isImage ? maxArtworkUploadBytes : maxAudioUploadBytes,
          isImage ? "Image" : "Audio",
        );
        afterRollback(() => {
          if (existsSync(targetPath)) unlinkSync(targetPath);
        });
        const upload = { id: uploadId, type, storedName, audioFileName, contentType: request.headers["content-type"] ?? "application/octet-stream", bytes, userId: user.id };
        data.uploads.push(upload);
        persist();
        json(response, 201, { uploadId });
        return;
      }
      if (request.method === "DELETE" && route.startsWith("/api/uploads/")) {
        const uploadId = route.slice("/api/uploads/".length);
        if (data.packs.some((pack) => pack.ownerId === user.id && pack.artworkUploadId === uploadId)) {
          json(response, 409, { error: "This upload is in use as pack artwork." });
          return;
        }
        const uploadIndex = data.uploads.findIndex((item) => item.id === uploadId && item.userId === user.id);
        if (uploadIndex !== -1) {
          const [upload] = data.uploads.splice(uploadIndex, 1);
          const uploadedPath = resolve(mediaDirectory, basename(upload.storedName));
          afterCommit(() => { if (existsSync(uploadedPath)) unlinkSync(uploadedPath); });
          persist();
        }
        json(response, 200, { status: "ok" });
        return;
      }
      if (request.method === "POST" && route === "/api/dubs") {
        const input = await readJson(request);
        if (input.mediaKind !== undefined && !["dub", "vocal"].includes(input.mediaKind)) {
          json(response, 400, { error: "Choose Dub or Vocal for an individual upload." }); return;
        }
        const distribution = input.distribution ?? "worldwide";
        if (!["private", "worldwide", "alist"].includes(distribution)) {
          json(response, 400, { error: "Choose a valid distribution option." });
          return;
        }
        if (distribution === "alist" && user.aListApproved !== true) {
          json(response, 403, { error: "A-List approval is required to upload an exclusive dub." });
          return;
        }
        if (input.aListPublic !== undefined && (distribution !== "alist" || typeof input.aListPublic !== "boolean")) {
          json(response, 400, { error: "Public access is only available for A-List dubs and must be true or false." });
          return;
        }
        const title = String(input.title ?? "").trim();
        const artistId = String(input.artistId ?? "");
        const artist = data.artists.find((item) => item.id === artistId && item.userId === user.id);
        const upload = data.uploads.find((item) => item.id === input.uploadId && item.userId === user.id && item.type === "audio");
        const artworkUpload = input.artworkUploadId
          ? data.uploads.find((item) => item.id === input.artworkUploadId && item.userId === user.id && item.type === "artwork")
          : undefined;
        if (!title || title.length > 100 || !artist || !upload || (input.artworkUploadId && !artworkUpload)) {
          json(response, 400, { error: "Provide a title, your artist profile, and an uploaded audio file." });
          return;
        }
        const durationSeconds = audioDurationSeconds(Number(input.durationSeconds));
        const dub = {
          id: randomUUID(),
          ...(input.mediaKind === "vocal" ? { mediaKind: "vocal" } : {}),
          distribution,
          ...(distribution === "alist" ? { aListPublic: input.aListPublic === true } : {}),
          title,
          artist: artist.name,
          artistId: artist.id,
          uploaderId: user.id,
          uploader: user.username,
          uploaderDisplayName: user.displayName,
          uploadedAt: new Date().toISOString(),
          version: 1,
          bpm: Number.isInteger(input.bpm) && input.bpm >= 1 && input.bpm <= 300 ? input.bpm : 0,
          tags: normalizeDubTags(input.tags),
          genre: normalizeDubTags(input.tags).join(", ").slice(0, 160)
            || String(input.genre ?? "").trim().slice(0, 60) || "Uncategorized",
          duration: formatAudioDuration(durationSeconds),
          audioFormat: audioFormat(upload.audioFileName),
          bitrateKbps: averageBitrateKbps(upload.bytes, durationSeconds),
          artwork: artworkUpload ? "uploaded-artwork" : "whitelabel",
          message: String(input.message ?? "").trim().slice(0, 400) || "A new dub from the studio.",
          audioUrl: `/api/dubs/${randomUUID()}/audio`,
          audioFileName: upload.audioFileName,
          storedAudioName: upload.storedName,
          audioSource: "upload",
        };
        dub.audioUrl = `/api/dubs/${dub.id}/audio`;
        if (artworkUpload) {
          dub.artworkUrl = `/api/dubs/${dub.id}/artwork`;
          dub.storedArtworkName = artworkUpload.storedName;
          dub.artworkFileName = artworkUpload.audioFileName;
        }
        data.dubs.unshift(dub);
        data.uploads = data.uploads.filter((item) => item.id !== upload.id && item.id !== artworkUpload?.id);
        persist();
        for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
        json(response, 201, publicDub(data, dub, user.id));
        return;
      }
      if (match && match[1] === "dubs" && !match[3] && request.method === "PATCH") {
        const dub = data.dubs.find((item) => item.id === match[2] && item.uploaderId === user.id);
        if (!dub) {
          json(response, 404, { error: "Dub not found." });
          return;
        }
        const input = await readJson(request);
        if (input.mediaKind !== undefined && !["dub", "vocal"].includes(input.mediaKind)) {
          json(response, 400, { error: "Choose Dub or Vocal for an individual upload." }); return;
        }
        if (input.mediaKind !== undefined && data.packs.some((pack) => pack.status === "published" && pack.dubIds.includes(dub.id)
          && !canIncludePackKind(pack.kind, dubMediaKind(data, { ...dub, mediaKind: input.mediaKind })))) {
          json(response, 409, { error: "Remove this file from incompatible published packs before changing its media type." });
          return;
        }
        if (input.distribution !== undefined && input.distribution !== dub.distribution) {
          json(response, 400, { error: "A dub's distribution cannot be changed after upload." });
          return;
        }
        if (input.aListPublic !== undefined && (dub.distribution !== "alist" || typeof input.aListPublic !== "boolean")) {
          json(response, 400, { error: "Public access is only available for A-List dubs and must be true or false." });
          return;
        }
        if (!canAccessDub(data, dub, user)) {
          json(response, 404, { error: "Dub not found." });
          return;
        }
        const title = String(input.title ?? "").trim();
        const artistId = String(input.artistId ?? "");
        const artist = data.artists.find((item) => item.id === artistId && item.userId === user.id);
        const audioUpload = input.uploadId
          ? data.uploads.find((item) => item.id === input.uploadId && item.userId === user.id && item.type === "audio")
          : undefined;
        const artworkUpload = input.artworkUploadId
          ? data.uploads.find((item) => item.id === input.artworkUploadId && item.userId === user.id && item.type === "artwork")
          : undefined;
        if (!title || title.length > 100 || !artist || (input.uploadId && !audioUpload) || (input.artworkUploadId && !artworkUpload)) {
          json(response, 400, { error: "Provide a title, your artist profile, and valid replacement media." });
          return;
        }

        const nextTags = normalizeDubTags(input.tags);
        const nextGenre = nextTags.join(", ").slice(0, 160) || "Uncategorized";
        const nextBpm = Number.isInteger(input.bpm) && input.bpm >= 1 && input.bpm <= 300 ? input.bpm : 0;
        const nextMessage = String(input.message ?? "").trim().slice(0, 400);
        const nextAListPublic = input.aListPublic ?? (dub.aListPublic === true);
        const changed = dub.title !== title || dub.artistId !== artist.id
          || (input.mediaKind !== undefined && (dub.mediaKind ?? "dub") !== input.mediaKind)
          || (dub.distribution === "alist" && (dub.aListPublic === true) !== nextAListPublic)
          || JSON.stringify(dub.tags ?? []) !== JSON.stringify(nextTags)
          || dub.genre !== nextGenre || dub.bpm !== nextBpm || dub.message !== nextMessage
          || Boolean(audioUpload || artworkUpload);
        const replacedMedia = [];
        if (changed) dub.version += 1;
        if (input.mediaKind !== undefined) dub.mediaKind = input.mediaKind;
        if (dub.distribution === "alist") dub.aListPublic = nextAListPublic;
        dub.title = title;
        dub.artist = artist.name;
        dub.artistId = artist.id;
        dub.tags = nextTags;
        dub.genre = nextGenre;
        dub.bpm = nextBpm;
        dub.message = nextMessage;
        if (audioUpload) {
          for (const account of data.users) {
            if (account.lastPlayback?.dubId === dub.id) delete account.lastPlayback;
          }
          if (dub.storedAudioName) replacedMedia.push(dub.storedAudioName);
          dub.storedAudioName = audioUpload.storedName;
          dub.audioFileName = audioUpload.audioFileName;
          dub.audioSource = "upload";
          dub.audioUrl = `/api/dubs/${dub.id}/audio`;
          const durationSeconds = audioDurationSeconds(Number(input.durationSeconds));
          dub.duration = formatAudioDuration(durationSeconds);
          dub.audioFormat = audioFormat(audioUpload.audioFileName);
          dub.bitrateKbps = averageBitrateKbps(audioUpload.bytes, durationSeconds);
        }
        if (artworkUpload) {
          if (dub.storedArtworkName) replacedMedia.push(dub.storedArtworkName);
          dub.storedArtworkName = artworkUpload.storedName;
          dub.artworkFileName = artworkUpload.audioFileName;
          dub.artwork = "uploaded-artwork";
          dub.artworkUrl = `/api/dubs/${dub.id}/artwork`;
        }
        data.uploads = data.uploads.filter((item) => item.id !== audioUpload?.id && item.id !== artworkUpload?.id);
        persist();
        for (const storedName of replacedMedia) {
          const oldMediaPath = resolve(mediaDirectory, basename(storedName));
          afterCommit(() => { if (existsSync(oldMediaPath)) unlinkSync(oldMediaPath); });
        }
        for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
        json(response, 200, publicDub(data, dub, user.id));
        return;
      }
      if (match && match[1] === "dubs" && !match[3] && request.method === "DELETE") {
        const dubIndex = data.dubs.findIndex((item) => item.id === match[2] && item.uploaderId === user.id);
        if (dubIndex === -1) {
          json(response, 404, { error: "Dub not found." });
          return;
        }
        const [dub] = data.dubs.splice(dubIndex, 1);
        for (const account of data.users) {
          if (account.lastPlayback?.dubId === dub.id) delete account.lastPlayback;
        }
        const affectedUserIds = new Set([user.id]);
        for (const download of data.downloads.filter((item) => item.dubId === dub.id)) affectedUserIds.add(download.userId);
        for (const crate of data.crates) {
          if ((crate.dubIds ?? []).includes(dub.id)) {
            affectedUserIds.add(crate.userId);
            crate.dubIds = crate.dubIds.filter((dubId) => dubId !== dub.id);
          }
        }
        data.likes = data.likes.filter((item) => item.dubId !== dub.id);
        data.downloads = data.downloads.filter((item) => item.dubId !== dub.id);
        data.dubGrants = data.dubGrants.filter((item) => item.dubId !== dub.id);
        data.dubShares = data.dubShares.filter((item) => item.dubId !== dub.id);
        for (const pack of data.packs) {
          if (!pack.dubIds.includes(dub.id)) continue;
          pack.dubIds = pack.dubIds.filter((id) => id !== dub.id);
          if (pack.keys) delete pack.keys[dub.id];
          if (!pack.artworkUploadId) {
            pack.fallbackArtworkName = data.dubs.find((item) => item.id === pack.dubIds[0])?.storedArtworkName;
          }
          pack.updatedAt = new Date().toISOString();
          if (pack.status === "published" && pack.dubIds.length === 0) {
            pack.status = "draft";
            pack.grants = [];
          }
        }
        persist();
        for (const storedName of [dub.storedAudioName, dub.storedArtworkName]) {
          if (!storedName) continue;
          const mediaPath = resolve(mediaDirectory, basename(storedName));
          afterCommit(() => { if (existsSync(mediaPath)) unlinkSync(mediaPath); });
        }
        for (const connectedUserId of socketsByUser.keys()) affectedUserIds.add(connectedUserId);
        for (const affectedUserId of affectedUserIds) broadcastCommunity(affectedUserId);
        json(response, 200, { id: dub.id });
        return;
      }
      if (match && match[1] === "dubs" && request.method === "GET" && match[3] === "artwork") {
        const dub = data.dubs.find((item) => item.id === match[2]);
        if (!canAccessDub(data, dub, user) || !dub.storedArtworkName) {
          json(response, 404, { error: "Track artwork not found." });
          return;
        }
        const filePath = resolve(mediaDirectory, basename(dub.storedArtworkName));
        if (!existsSync(filePath)) {
          json(response, 404, { error: "Track artwork file not found." });
          return;
        }
        streamAudio(request, response, filePath);
        return;
      }
      if (match && match[1] === "dubs" && request.method === "GET" && match[3] === "audio") {
        const dub = data.dubs.find((item) => item.id === match[2]);
        if (!canAccessDub(data, dub, user)) {
          json(response, 404, { error: "Dub not found." });
          return;
        }
        const filePath = dub.audioSource === "upload"
          ? resolve(mediaDirectory, basename(dub.storedAudioName))
          : getAudioPath(dub, mediaDirectory, publicAudioDirectory);
        if (!existsSync(filePath)) {
          json(response, 404, { error: "Audio file not found." });
          return;
        }
        streamAudio(request, response, filePath, url.searchParams.has("download") ? dub.audioFileName : undefined);
        return;
      }
      if (match && match[1] === "dubs" && request.method === "POST" && match[2] && match[3] === "download") {
        const dub = data.dubs.find((item) => item.id === match[2]);
        if (!canAccessDub(data, dub, user)) {
          json(response, 404, { error: "Dub not found." });
          return;
        }
        const filePath = dub.audioSource === "upload"
          ? resolve(mediaDirectory, basename(dub.storedAudioName))
          : getAudioPath(dub, mediaDirectory, publicAudioDirectory);
        if (!existsSync(filePath)) {
          json(response, 404, { error: "The original audio file is unavailable." });
          return;
        }
        const audioDescriptor = openSync(filePath, "r");
        closeSync(audioDescriptor);
        const event = { id: randomUUID(), userId: user.id, dubId: dub.id, downloadedAt: new Date().toISOString() };
        data.downloads.push(event);
        if (!data.likes.some((like) => like.userId === user.id && like.dubId === dub.id)) {
          data.likes.push({ userId: user.id, dubId: dub.id, likedAt: event.downloadedAt });
        }
        persist();
        broadcastCommunity(user.id);
        if (dub.uploaderId !== user.id) broadcastCommunity(dub.uploaderId);
        json(response, 200, {
          audioUrl: `${dub.audioUrl}?download=1`,
          audioFileName: dub.audioFileName,
          likes: data.likes.filter((like) => like.dubId === dub.id).length,
          downloads: data.downloads.filter((item) => item.dubId === dub.id).length,
          liked: true,
        });
        return;
      }
      if (match && match[1] === "dubs" && match[3] === "grants" && match[4] && request.method === "DELETE") {
        const dub = data.dubs.find((item) => item.id === match[2] && item.uploaderId === user.id && item.distribution === "private");
        const grantIndex = data.dubGrants.findIndex((grant) => grant.dubId === match[2] && grant.userId === match[4]);
        if (!dub || grantIndex === -1) {
          json(response, 404, { error: "Private dub grant not found." });
          return;
        }
        const [grant] = data.dubGrants.splice(grantIndex, 1);
        persist();
        broadcastCommunity(user.id);
        broadcastCommunity(grant.userId);
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (match && match[1] === "dubs" && match[3] === "share-member" && !match[4] && request.method === "POST") {
        const input = await readJson(request);
        const dub = data.dubs.find((item) => item.id === match[2]);
        const recipient = data.users.find((item) => item.id === input.userId);
        const text = String(input.text ?? "").trim();
        if (!text || text.length > 2000) {
          json(response, 400, { error: "Message must contain between 1 and 2000 characters." });
          return;
        }
        if (!canAccessDub(data, dub, user) || dub.distribution !== "alist" || dub.aListPublic === true
          || !recipient || recipient.id === user.id || recipient.aListApproved !== true) {
          json(response, 404, { error: "The shared dub is unavailable to this recipient." });
          return;
        }
        const friendship = findOrCreateFriendship(data, user, recipient);
        const result = createConversationMessage(data, user, friendship.id, { text, dubId: dub.id });
        if (result.error) {
          json(response, result.status, { error: result.error });
          return;
        }
        persist();
        sendMessagePush(user, result);
        broadcastCommunity(user.id);
        broadcastCommunity(recipient.id);
        json(response, 201, { buddyId: friendship.id, snapshot: communitySnapshot(data, user) });
        return;
      }
      if (request.method === "POST" && route === "/api/buddies") {
        const input = await readJson(request);
        const friendLookup = String(input.username ?? input.id ?? "").trim().toLowerCase();
        const friend = data.users.find((item) => item.username.toLowerCase() === friendLookup || item.id.toLowerCase() === friendLookup
          || data.artists.some((artist) => artist.userId === item.id && artist.id.toLowerCase() === friendLookup));
        if (!friend || friend.id === user.id) {
          json(response, 404, { error: "Member not found." });
          return;
        }
        findOrCreateFriendship(data, user, friend);
        findOrCreateFriendship(data, friend, user);
        persist();
        broadcastCommunity(user.id);
        broadcastCommunity(friend.id);
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (match && match[1] === "buddies" && request.method === "DELETE" && !match[3]) {
        const friendship = data.friendships.find((item) => item.id === match[2] && item.ownerId === user.id);
        const relationship = friendship && data.friendships.filter(
          (item) =>
            (item.ownerId === friendship.ownerId && item.friendUserId === friendship.friendUserId)
            || (item.ownerId === friendship.friendUserId && item.friendUserId === friendship.ownerId),
        );
        const friendshipIds = new Set((relationship ?? []).map((item) => item.id));
        data.friendships = data.friendships.filter((item) => !friendshipIds.has(item.id));
        data.conversations = data.conversations.filter((item) => !friendshipIds.has(item.buddyId));
        persist();
        if (friendship) {
          broadcastCommunity(user.id);
          broadcastCommunity(friendship.friendUserId);
        }
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (match && match[1] === "conversations" && request.method === "POST" && match[3] === "messages") {
        const input = await readJson(request);
        const result = createConversationMessage(data, user, match[2], input);
        if (result.error) {
          json(response, result.status, { error: result.error });
          return;
        }
        persist();
        sendMessagePush(user, result);
        broadcastCommunity(user.id);
        broadcastCommunity(result.recipientId);
        json(response, 201, communitySnapshot(data, user));
        return;
      }
      if (match && match[1] === "conversations" && request.method === "DELETE" && match[3] === "messages" && match[4]) {
        const result = unsendConversationMessage(data, user, match[2], match[4]);
        if (result.error) {
          json(response, result.status, { error: result.error });
          return;
        }
        persist();
        broadcastCommunity(user.id);
        broadcastCommunity(result.recipientId);
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (match && match[1] === "conversations" && request.method === "POST" && match[3] === "read") {
        const friendship = data.friendships.find((item) => item.id === match[2] && item.ownerId === user.id);
        if (friendship) friendship.unread = 0;
        persist();
        broadcastCommunity(user.id);
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (request.method === "PATCH" && route === "/api/profile") {
        const input = await readJson(request);
        const profileImageUploads = [];
        for (const [field, expectedType, storedField, urlField, sizeLimit] of [
          ["avatarUploadId", "avatar", "avatarStoredName", "avatarUrl", 2 * 1024 * 1024],
          ["bannerUploadId", "banner", "bannerStoredName", "bannerUrl", maxArtworkUploadBytes],
        ]) {
          if (!input[field]) continue;
          const upload = data.uploads.find((item) => item.id === input[field] && item.userId === user.id && item.type === expectedType);
          if (!upload || upload.bytes > sizeLimit) {
            json(response, 400, { error: "Choose a valid profile image." });
            return;
          }
          profileImageUploads.push({ upload, storedField, urlField, expectedType });
        }
        for (const field of ["displayName", "bio", "genre", "role"]) {
          if (typeof input[field] === "string") user[field] = input[field].trim().slice(0, field === "bio" ? 500 : 100);
        }
        if (Array.isArray(input.links)) {
          user.links = input.links
            .filter((link) => link && typeof link.label === "string" && typeof link.url === "string")
            .map((link) => ({ label: link.label.trim().slice(0, 40), url: link.url.trim().slice(0, 300) }))
            .filter((link) => link.label && /^https?:\/\//i.test(link.url))
            .slice(0, 5);
        }
        const replacedMedia = [];
        for (const { upload, storedField, urlField, expectedType } of profileImageUploads) {
          if (user[storedField] && user[storedField] !== upload.storedName) replacedMedia.push(user[storedField]);
          user[storedField] = upload.storedName;
          user[urlField] = `/api/profiles/${encodeURIComponent(user.id)}/${expectedType}?v=${encodeURIComponent(upload.id)}`;
          data.uploads = data.uploads.filter((item) => item.id !== upload.id);
        }
        for (const artist of data.artists.filter((item) => item.userId === user.id)) {
          artist.name = user.displayName;
          artist.genres = user.genre.split(",").map((genre) => genre.trim()).filter(Boolean);
          artist.role = user.role;
        }
        persist();
        for (const storedName of replacedMedia) {
          const oldImagePath = resolve(mediaDirectory, basename(storedName));
          afterCommit(() => { if (existsSync(oldImagePath)) unlinkSync(oldImagePath); });
        }
        for (const connectedUserId of socketsByUser.keys()) broadcastCommunity(connectedUserId);
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (request.method === "POST" && route === "/api/crates") {
        const input = await readJson(request);
        const name = String(input.name ?? "").trim();
        if (!name || name.length > 60) {
          json(response, 400, { error: "Crate names must contain between 1 and 60 characters." });
          return;
        }
        if (data.crates.some((crate) => crate.userId === user.id && crateNameKey(crate.name) === crateNameKey(name))) {
          json(response, 409, { error: "A crate with that name already exists." });
          return;
        }
        const crate = { id: randomUUID(), userId: user.id, name, dubIds: [] };
        data.crates.push(crate);
        persist();
        broadcastCommunity(user.id);
        json(response, 201, { id: crate.id, name: crate.name, dubIds: crate.dubIds });
        return;
      }
      if (match && match[1] === "crates" && !match[3] && request.method === "PATCH") {
        const crate = data.crates.find((item) => item.id === match[2] && item.userId === user.id);
        if (!crate) {
          json(response, 404, { error: "Crate not found." });
          return;
        }
        const input = await readJson(request);
        const name = String(input.name ?? "").trim();
        if (!name || name.length > 60) {
          json(response, 400, { error: "Crate names must contain between 1 and 60 characters." });
          return;
        }
        const oldNameKey = crateNameKey(crate.name);
        const newNameKey = crateNameKey(name);
        if (data.crates.some((item) =>
          item.userId === user.id && crateNameKey(item.name) === newNameKey && crateNameKey(item.name) !== oldNameKey,
        )) {
          json(response, 409, { error: "A crate with that name already exists." });
          return;
        }
        for (const item of data.crates) {
          if (item.userId === user.id && crateNameKey(item.name) === oldNameKey) item.name = name;
        }
        persist();
        broadcastCommunity(user.id);
        json(response, 200, publicCrates(data, user.id).find((item) => item.id === crate.id));
        return;
      }
      if (match && match[1] === "crates" && !match[3] && request.method === "DELETE") {
        const crateIndex = data.crates.findIndex((item) => item.id === match[2] && item.userId === user.id);
        if (crateIndex === -1) {
          json(response, 404, { error: "Crate not found." });
          return;
        }
        const crateName = crateNameKey(data.crates[crateIndex].name);
        data.crates = data.crates.filter((item) =>
          item.userId !== user.id || crateNameKey(item.name) !== crateName,
        );
        persist();
        broadcastCommunity(user.id);
        json(response, 200, { id: match[2] });
        return;
      }
      if (match && match[1] === "crates" && match[3] === "dubs" && request.method === "PUT") {
        const crate = data.crates.find((item) => item.id === match[2] && item.userId === user.id);
        const dub = data.dubs.find((item) => item.id === match[4]);
        if (!crate || !canAccessDub(data, dub, user)) {
          json(response, 404, { error: "Crate or dub not found." });
          return;
        }
        for (const item of data.crates) {
          if (item.userId === user.id && crateNameKey(item.name) === crateNameKey(crate.name)) {
            item.dubIds ??= [];
            if (!item.dubIds.includes(dub.id)) item.dubIds.push(dub.id);
          }
        }
        persist();
        broadcastCommunity(user.id);
        json(response, 200, publicCrates(data, user.id).find((item) => item.id === crate.id));
        return;
      }
      if (match && match[1] === "crates" && match[3] === "dubs" && request.method === "DELETE") {
        const crate = data.crates.find((item) => item.id === match[2] && item.userId === user.id);
        if (!crate) {
          json(response, 404, { error: "Crate not found." });
          return;
        }
        for (const item of data.crates) {
          if (item.userId === user.id && crateNameKey(item.name) === crateNameKey(crate.name)) {
            item.dubIds = (item.dubIds ?? []).filter((dubId) => dubId !== match[4]);
          }
        }
        persist();
        broadcastCommunity(user.id);
        json(response, 200, publicCrates(data, user.id).find((item) => item.id === crate.id));
        return;
      }
      json(response, 404, { error: "Endpoint not found." });
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (error.code === "ENOENT") {
        json(response, 404, { error: "Audio file not found." });
        return;
      }
      if (storage && !error.status) {
        console.error("Community command failed.", { code: error.code ?? error.name });
        json(response, 503, { error: "The server could not complete the request. Please retry." });
        return;
      }
      json(response, error.status ?? 500, { error: error.message || "The server could not complete the request." });
    }
  };

  const server = createServer((request, response) => {
    const fail = (error) => {
      console.error("Community request failed.", { code: error.code ?? error.name });
      if (response.headersSent) response.destroy();
      else {
        response.removeHeader("set-cookie");
        response.writeHead(error instanceof URIError ? 400 : 503, {
          "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store",
        });
        response.end(JSON.stringify({ error: error instanceof URIError ? "Malformed request." : "Community storage is unavailable. Please retry." }));
      }
    };
    void Promise.resolve().then(() => {
      if (!storage || !new URL(request.url ?? "/", "http://localhost").pathname.startsWith("/api/")) {
        return handleRequest(request, response);
      }
      if (!["GET", "HEAD"].includes(request.method) && !isAllowedWebSocketOrigin(request)) {
        json(response, 403, { error: "Invalid request origin." });
        return;
      }
      response.setHeader("cache-control", "private, no-store");
      response.setHeader("x-content-type-options", "nosniff");
      return storage.run(parseCookies(request).cre8_session, () => {
        if (request.destroyed || response.destroyed) throw Object.assign(new Error("Request was interrupted."), { code: "REQUEST_ABORTED" });
        return handleRequest(request, response);
      });
    }).catch(fail);
  });
  if (storage) {
    server.requestTimeout = 120000;
    server.headersTimeout = 10000;
    server.keepAliveTimeout = 5000;
  }

  function sendMessagePush(sender, result) {
    if (commitContext.getStore() && !commitContext.getStore().finished) {
      return afterCommit(() => sendMessagePush(sender, result));
    }
    if (!pushService) return;
    const dub = result.message.dubId && data.dubs.find((item) => item.id === result.message.dubId);
    const title = dub ? `${sender.displayName} shared a dub` : `Message from ${sender.displayName}`;
    const body = dub ? `${dub.title}: ${result.message.text}` : result.message.text;
    const payload = { title, body: body.slice(0, 180), buddyId: result.recipientBuddyId };
    for (const item of data.pushSubscriptions.filter((entry) => entry.userId === result.recipientId)) {
      void Promise.resolve().then(() => pushService.send(item.subscription, payload)).catch((error) => {
        if (error.statusCode === 404 || error.statusCode === 410) {
          const remove = () => {
            data.pushSubscriptions = data.pushSubscriptions.filter((entry) =>
              entry.userId !== item.userId || entry.subscription.endpoint !== item.subscription.endpoint);
            persist();
          };
          return Promise.resolve().then(() => storage ? storage.run(undefined, remove) : remove()).catch((persistError) => {
            console.error("Failed to remove expired push subscription.", { code: persistError.code ?? persistError.name });
          });
        } else {
          console.error("Push notification delivery failed:", error.message);
        }
      });
    }
  }

  function broadcastCommunity(userId) {
    if (commitContext.getStore() && !commitContext.getStore().finished) {
      return afterCommit(() => broadcastCommunity(userId));
    }
    const user = data.users.find((item) => item.id === userId);
    if (!user) return;
    const payload = JSON.stringify({
      type: "community.snapshot",
      snapshot: communitySnapshot(data, user),
    });
    for (const socket of socketsByUser.get(userId) ?? []) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      socket.send(payload, (error) => {
        if (error) {
          console.error("Chat WebSocket delivery failed:", error.message);
          socket.terminate();
        }
      });
    }
  }

  const handleUpgrade = (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const cookies = parseCookies(request);
    const sessionToken = cookies.cre8_session;
    const session = sessions.get(sessionToken);
    const user = session && session.expiresAt > Date.now()
      ? data.users.find((item) => item.id === session.userId)
      : undefined;

    if (url.pathname !== "/api/chat") {
      socket.destroy();
      return;
    }
    if (!user || !sessionToken || !isAllowedWebSocketOrigin(request)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    afterCommit(() => webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      const userSockets = socketsByUser.get(user.id) ?? new Set();
      userSockets.add(webSocket);
      socketsByUser.set(user.id, userSockets);
      socketSessions.set(webSocket, sessionToken);
      const expiryTimer = setTimeout(
        () => webSocket.close(1008, "Session expired"),
        Math.max(0, session.expiresAt - Date.now()),
      );
      expiryTimer.unref();
      socketExpiryTimers.set(webSocket, expiryTimer);
      webSocket.on("error", (error) => {
        console.error("Chat WebSocket error:", error.message);
      });
      webSocket.send(JSON.stringify({ type: "connected" }), (error) => {
        if (error) {
          console.error("Chat WebSocket handshake delivery failed:", error.message);
          webSocket.terminate();
        }
      });
      webSocket.on("close", () => {
        clearTimeout(socketExpiryTimers.get(webSocket));
        userSockets.delete(webSocket);
        if (userSockets.size === 0) socketsByUser.delete(user.id);
      });
    }));
  };
  server.on("upgrade", (request, socket, head) => {
    void Promise.resolve().then(() => storage
      ? storage.run(parseCookies(request).cre8_session, () => handleUpgrade(request, socket, head))
      : handleUpgrade(request, socket, head)).catch((error) => {
      console.error("Community WebSocket authorization failed.", { code: error.code ?? error.name });
      socket.destroy();
    });
  });

  const closeSockets = () => {
    for (const sockets of socketsByUser.values()) {
      for (const socket of sockets) socket.terminate();
    }
  };
  server.on("shutdown", closeSockets);
  server.on("close", () => {
    closeSockets();
    webSocketServer.close();
  });

  return server;
}

export async function createPostgresApiServer(options = {}) {
  const { createCommunityPostgres, readCommunityDatabaseConfig } = await import("./communityPostgres.mjs");
  const storage = options.storage ?? createCommunityPostgres(readCommunityDatabaseConfig());
  try {
    await storage.run(undefined, () => {
      seedAdministrator(storage.data, undefined,
        validateAdminSeed(options.adminSeed ?? { username: process.env.ADMIN_SEED_USERNAME, password: process.env.ADMIN_SEED_PASSWORD }),
        () => storage.markDirty());
    });
    const server = createApiServer({ ...options, storage });
    return { server, storage };
  } catch (error) {
    if (!options.storage) await storage.close();
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  const mode = process.env.COMMUNITY_STORAGE ?? "json";
  if (!["json", "postgres"].includes(mode)) throw new Error("COMMUNITY_STORAGE must be json or postgres.");
  let server;
  let storage;
  try {
    ({ server, storage } = mode === "postgres" ? await createPostgresApiServer() : { server: createApiServer() });
  } catch (error) {
    console.error("Community startup failed.", {
      code: error.code ?? error.name,
      message: mode === "postgres" ? "Verify explicit PostgreSQL configuration, migrations, initialization and media paths." : error.message,
    });
    process.exitCode = 1;
  }
  if (server) {
    server.listen(port, host, () => {
      console.log(`cre8 server listening on http://${host}:${port}`);
    });
    if (storage) {
      let stopping = false;
      const stop = () => {
        if (stopping) return;
        stopping = true;
        const deadline = setTimeout(() => {
          console.error("Community shutdown deadline exceeded.");
          process.exit(1);
        }, 15000);
        server.emit("shutdown");
        server.close(async () => {
          try { await storage.close(); }
          catch (error) {
            console.error("Community database shutdown failed.", { code: error.code ?? error.name });
            process.exitCode = 1;
          } finally { clearTimeout(deadline); }
        });
        server.closeIdleConnections();
        setTimeout(() => server.closeAllConnections(), 10000).unref();
      };
      process.once("SIGTERM", stop);
      process.once("SIGINT", stop);
    }
  }
}
