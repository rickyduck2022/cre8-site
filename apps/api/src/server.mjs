import { closeSync, createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { WebSocket, WebSocketServer } from "ws";

const apiDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultDataPath = resolve(process.env.COMMUNITY_DATA_PATH ?? resolve(apiDirectory, "../data/community.json"));
const defaultMediaDirectory = resolve(process.env.COMMUNITY_MEDIA_DIRECTORY ?? resolve(apiDirectory, "../data/audio"));
const defaultPublicAudioDirectory = resolve(apiDirectory, "../assets/audio");
const defaultWebDirectory = resolve(process.env.WEB_DIST_DIRECTORY ?? resolve(apiDirectory, "../../web/dist"));
const defaultAdminDirectory = resolve(process.env.ADMIN_DIST_DIRECTORY ?? resolve(apiDirectory, "../../admin/dist"));
const maxAudioUploadBytes = 100 * 1024 * 1024;
const maxArtworkUploadBytes = 10 * 1024 * 1024;
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const dataSchemaVersion = 3;
const conversationPageSize = 30;
const dubTags = new Set(["Jump Up", "Rollers", "Dancefloor", "Jungle", "Liquid", "Neurofunk", "Vocal", "Deep", "Minimal", "Techstep", "Atmospheric", "Old School"]);
function normalizeDubTags(tags) {
  return Array.isArray(tags)
    ? [...new Set(tags.map((tag) => String(tag).trim()).filter((tag) => dubTags.has(tag)))].slice(0, 12)
    : [];
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

function createSeedState() {
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
  };
}

function removeStoredMedia(data, mediaDirectory) {
  const mediaRoot = resolve(mediaDirectory);
  const storedNames = [
    ...data.dubs.flatMap((dub) => [dub.storedAudioName, dub.storedArtworkName]),
    ...data.uploads.map((upload) => upload.storedName),
    ...data.users.flatMap((user) => [user.avatarStoredName, user.bannerStoredName]),
  ].filter((name) => typeof name === "string" && name.length > 0);

  for (const storedName of new Set(storedNames)) {
    const storedPath = resolve(mediaRoot, basename(storedName));
    if (storedPath !== mediaRoot && existsSync(storedPath)) unlinkSync(storedPath);
  }
}

export function initializeData(dataPath = defaultDataPath, mediaDirectory = defaultMediaDirectory) {
  mkdirSync(resolve(dataPath, ".."), { recursive: true });
  if (!existsSync(dataPath)) {
    const data = createSeedState();
    writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
    return data;
  }
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  if (data.schemaVersion === undefined) {
    removeStoredMedia(data, mediaDirectory);
    const freshData = createSeedState();
    writeFileSync(dataPath, `${JSON.stringify(freshData, null, 2)}\n`);
    return freshData;
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
    data.schemaVersion = dataSchemaVersion;
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
    artistId: dub.artistId ?? "artist-meladee",
    uploaderId: dub.uploaderId ?? meladee.id,
    artwork: dub.artworkUrl ? dub.artwork : "whitelabel",
    audioSource: dub.audioSource ?? "upload",
  }));
  for (const dub of data.dubs) {
    dub.audioUrl ??= `/api/dubs/${dub.id}/audio`;
  }
  for (const key of ["friendships", "conversations", "likes", "downloads", "crates", "uploads"]) {
    data[key] ??= [];
  }
  writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

function saveData(dataPath, data) {
  const temporaryPath = `${dataPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(temporaryPath, dataPath);
}

function json(response, status, value, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(value));
}

function readJson(request, maxBytes = 1024 * 1024) {
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

function streamAudio(request, response, filePath, downloadName) {
  const file = statSync(filePath);
  const range = request.headers.range;
  let start = 0;
  let end = file.size - 1;
  let status = 200;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      response.writeHead(416, { "content-range": `bytes */${file.size}` });
      response.end();
      return;
    }
    start = match[1] ? Number(match[1]) : 0;
    end = match[2] ? Number(match[2]) : end;
    if (!match[1] && match[2]) {
      start = Math.max(0, file.size - end);
      end = file.size - 1;
    }
    if (start > end || end >= file.size) {
      response.writeHead(416, { "content-range": `bytes */${file.size}` });
      response.end();
      return;
    }
    status = 206;
  }
  const headers = {
    "accept-ranges": "bytes",
    "content-length": end - start + 1,
    "content-type": ({
      ".wav": "audio/wav",
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
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  })[extension] ?? "application/octet-stream";
  const file = statSync(filePath);
  response.writeHead(200, {
    "cache-control": filePath === indexPath
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

function publicDub(data, dub, currentUserId) {
  const {
    storedAudioName,
    storedArtworkName,
    audioSource,
    ...publicFields
  } = dub;
  const uploader = data.users.find((item) => item.id === dub.uploaderId);
  const artist = data.artists.find((item) => item.id === dub.artistId);
  const result = {
    ...publicFields,
    artist: artist?.name ?? publicFields.artist,
    uploader: uploader?.username ?? publicFields.uploader,
    uploaderDisplayName: uploader?.displayName ?? publicFields.uploaderDisplayName,
    likes: data.likes.filter((like) => like.dubId === dub.id).length,
    downloads: data.downloads.filter((download) => download.dubId === dub.id).length,
    likedByCurrentUser: data.likes.some((like) => like.dubId === dub.id && like.userId === currentUserId),
  };
  if (dub.uploaderId === currentUserId) {
    const downloaderByUser = new Map();
    for (const download of data.downloads.filter((item) => item.dubId === dub.id)) {
      const downloader = data.users.find((item) => item.id === download.userId);
      downloaderByUser.set(download.userId, {
        username: downloader?.username ?? "artist",
        displayName: downloader?.displayName ?? "Artist",
        downloadedAt: download.downloadedAt,
      });
    }
    result.downloaders = [...downloaderByUser.values()];
  }
  return result;
}

function crateNameKey(name) {
  return String(name ?? "").trim().toLocaleLowerCase();
}

function publicCrates(data, userId) {
  const grouped = new Map();
  for (const crate of data.crates.filter((item) => item.userId === userId)) {
    const key = crateNameKey(crate.name);
    const existing = grouped.get(key);
    if (existing) {
      existing.dubIds = [...new Set([...existing.dubIds, ...(crate.dubIds ?? [])])];
    } else {
      grouped.set(key, { id: crate.id, name: crate.name, dubIds: [...(crate.dubIds ?? [])] });
    }
  }
  return [...grouped.values()];
}

function communitySnapshot(data, user) {
  const artists = data.artists.filter((artist) => artist.userId === user.id);
  const friendships = data.friendships.filter((friendship) => friendship.ownerId === user.id);
  const friendUserIds = new Set(friendships.map((friendship) => friendship.friendUserId));
  const conversations = data.conversations
    .filter((conversation) => conversation.ownerId === user.id)
    .map(({ buddyId, messages }) => ({
      buddyId,
      messages: messages.slice(-conversationPageSize),
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
      bannerUrl: buddyUser?.bannerUrl,
      links: buddyUser?.links ?? [],
      groups: friendship.groups,
      unread: friendship.unread || undefined,
      messages: conversation?.messages,
    };
  });
  return {
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
    },
    artists,
    dubs: data.dubs
      .slice()
      .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt))
      .map((dub) => publicDub(data, dub, user.id)),
    buddies,
    conversations,
    likedDubIds: data.likes.filter((like) => like.userId === user.id).map((like) => like.dubId),
    suggestedMembers: data.users
      .filter((other) => other.id !== user.id && !friendUserIds.has(other.id))
      .map(({ id, username, displayName, genre }) => ({ id, username, displayName, genre })),
    crates: publicCrates(data, user.id),
    library: data.downloads
      .filter((download) => download.userId === user.id)
      .filter((download) => data.dubs.some((dub) => dub.id === download.dubId))
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
    messages: messages.slice(startIndex, endIndex),
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
  if (input.dubId && !data.dubs.some((dub) => dub.id === input.dubId)) {
    return { error: "The shared dub could not be found.", status: 404 };
  }

  const recipient = data.users.find((item) => item.id === friendship.friendUserId);
  if (!recipient) return { error: "Friend not found.", status: 404 };
  const recipientFriendship = findOrCreateFriendship(data, recipient, user);
  const sentAt = new Date().toISOString();
  const messageId = randomUUID();
  const dubId = input.dubId || undefined;
  const senderMessage = { id: messageId, sender: "you", text, sentAt, dubId };
  const recipientMessage = { ...senderMessage, sender: "them" };
  findOrCreateConversation(data, user.id, friendship.id).messages.push(senderMessage);
  findOrCreateConversation(data, recipient.id, recipientFriendship.id).messages.push(recipientMessage);
  recipientFriendship.unread = (recipientFriendship.unread ?? 0) + 1;
  return { message: senderMessage, recipientId: recipient.id };
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
} = {}) {
  const data = initializeData(dataPath, mediaDirectory);
  mkdirSync(mediaDirectory, { recursive: true });
  const sessions = new Map();
  const socketsByUser = new Map();
  const socketSessions = new WeakMap();
  const socketExpiryTimers = new WeakMap();
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const persist = () => saveData(dataPath, data);

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const cookies = parseCookies(request);
    const session = sessions.get(cookies.cre8_session);
    const user = session && session.expiresAt > Date.now()
      ? data.users.find((item) => item.id === session.userId)
      : undefined;
    const route = url.pathname;
    const match = route.match(/^\/api\/(dubs|buddies|crates|conversations)\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/);

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
          if (socketSessions.get(socket) === cookies.cre8_session) socket.close(1000, "Signed out");
        }
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        json(response, 200, { status: "ok" }, {
          "set-cookie": `cre8_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
        });
        return;
      }
      if (!user) {
        json(response, 401, { error: "Sign in to continue." });
        return;
      }
      if (route === "/api/admin/overview" && request.method === "GET") {
        const administrators = new Set(String(process.env.ADMIN_USERNAMES ?? "")
          .split(",").map((name) => name.trim().toLocaleLowerCase()).filter(Boolean));
        if (!administrators.has(user.username.toLocaleLowerCase())) {
          json(response, 403, { error: "This account is not configured as an administrator." });
          return;
        }
        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentDubs = data.dubs.filter((dub) => Date.parse(dub.uploadedAt) >= since);
        const recentUsers = data.users.filter((account) => Date.parse(account.createdAt ?? 0) >= since);
        const activity = Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setUTCHours(0, 0, 0, 0);
          date.setUTCDate(date.getUTCDate() - (6 - index));
          const next = new Date(date);
          next.setUTCDate(next.getUTCDate() + 1);
          return {
            date: date.toISOString().slice(0, 10),
            uploads: data.dubs.filter((dub) => Date.parse(dub.uploadedAt) >= date.getTime() && Date.parse(dub.uploadedAt) < next.getTime()).length,
            members: data.users.filter((account) => Date.parse(account.createdAt ?? 0) >= date.getTime() && Date.parse(account.createdAt ?? 0) < next.getTime()).length,
          };
        });
        const userById = new Map(data.users.map((account) => [account.id, account]));
        const dubs = data.dubs.map((dub) => ({
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
          uploads: data.dubs.filter((dub) => dub.uploaderId === account.id).length,
          friends: data.friendships.filter((friendship) => friendship.ownerId === account.id).length,
        })).sort((a, b) => (Date.parse(b.createdAt ?? 0) || 0) - (Date.parse(a.createdAt ?? 0) || 0));
        const topDubs = [...dubs].sort((a, b) => b.downloads - a.downloads).slice(0, 5);
        json(response, 200, {
          generatedAt: new Date().toISOString(),
          metrics: {
            members: users.length, tracks: dubs.length,
            downloads: data.downloads.length, connections: data.friendships.length,
            uploadsThisWeek: recentDubs.length, membersThisWeek: recentUsers.length,
          },
          users, dubs, topDubs, activity,
        });
        return;
      }
      if (request.method === "GET" && route === "/api/community") {
        json(response, 200, communitySnapshot(data, user));
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
        const upload = { id: uploadId, type, storedName, audioFileName, contentType: request.headers["content-type"] ?? "application/octet-stream", bytes, userId: user.id };
        data.uploads.push(upload);
        persist();
        json(response, 201, { uploadId });
        return;
      }
      if (request.method === "DELETE" && route.startsWith("/api/uploads/")) {
        const uploadId = route.slice("/api/uploads/".length);
        const uploadIndex = data.uploads.findIndex((item) => item.id === uploadId && item.userId === user.id);
        if (uploadIndex !== -1) {
          const [upload] = data.uploads.splice(uploadIndex, 1);
          const uploadedPath = resolve(mediaDirectory, basename(upload.storedName));
          if (existsSync(uploadedPath)) unlinkSync(uploadedPath);
          persist();
        }
        json(response, 200, { status: "ok" });
        return;
      }
      if (request.method === "POST" && route === "/api/dubs") {
        const input = await readJson(request);
        const title = String(input.title ?? "").trim();
        const artistId = String(input.artistId ?? "");
        const artist = data.artists.find((item) => item.id === artistId && item.userId === user.id);
        const upload = data.uploads.find((item) => item.id === input.uploadId && item.userId === user.id && item.type !== "artwork");
        const artworkUpload = input.artworkUploadId
          ? data.uploads.find((item) => item.id === input.artworkUploadId && item.userId === user.id && item.type === "artwork")
          : undefined;
        if (!title || title.length > 100 || !artist || !upload || (input.artworkUploadId && !artworkUpload)) {
          json(response, 400, { error: "Provide a title, your artist profile, and an uploaded audio file." });
          return;
        }
        const dub = {
          id: randomUUID(),
          title,
          artist: artist.name,
          artistId: artist.id,
          uploaderId: user.id,
          uploader: user.username,
          uploaderDisplayName: user.displayName,
          uploadedAt: new Date().toISOString(),
          bpm: Number.isInteger(input.bpm) && input.bpm >= 1 && input.bpm <= 300 ? input.bpm : 0,
          tags: normalizeDubTags(input.tags),
          genre: normalizeDubTags(input.tags).join(", ").slice(0, 160)
            || String(input.genre ?? "").trim().slice(0, 60) || "Uncategorized",
          duration: "00:00",
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

        const replacedMedia = [];
        dub.title = title;
        dub.artist = artist.name;
        dub.artistId = artist.id;
        dub.tags = normalizeDubTags(input.tags);
        dub.genre = dub.tags.join(", ").slice(0, 160) || "Uncategorized";
        dub.bpm = Number.isInteger(input.bpm) && input.bpm >= 1 && input.bpm <= 300 ? input.bpm : 0;
        dub.message = String(input.message ?? "").trim().slice(0, 400);
        if (audioUpload) {
          if (dub.storedAudioName) replacedMedia.push(dub.storedAudioName);
          dub.storedAudioName = audioUpload.storedName;
          dub.audioFileName = audioUpload.audioFileName;
          dub.audioSource = "upload";
          dub.audioUrl = `/api/dubs/${dub.id}/audio`;
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
          if (existsSync(oldMediaPath)) unlinkSync(oldMediaPath);
        }
        broadcastCommunity(user.id);
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
        persist();
        for (const storedName of [dub.storedAudioName, dub.storedArtworkName]) {
          if (!storedName) continue;
          const mediaPath = resolve(mediaDirectory, basename(storedName));
          if (existsSync(mediaPath)) unlinkSync(mediaPath);
        }
        for (const affectedUserId of affectedUserIds) broadcastCommunity(affectedUserId);
        json(response, 200, { id: dub.id });
        return;
      }
      if (match && match[1] === "dubs" && request.method === "GET" && match[3] === "artwork") {
        const dub = data.dubs.find((item) => item.id === match[2]);
        if (!dub?.storedArtworkName) {
          json(response, 404, { error: "This dub uses the default whitelabel artwork." });
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
        if (!dub) {
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
        if (!dub) {
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
      if (request.method === "POST" && route === "/api/buddies") {
        const input = await readJson(request);
        const friendLookup = String(input.username ?? input.id ?? "").trim().toLowerCase();
        const friend = data.users.find((item) => item.username.toLowerCase() === friendLookup || item.id.toLowerCase() === friendLookup
          || data.artists.some((artist) => artist.userId === item.id && artist.id.toLowerCase() === friendLookup));
        if (!friend || friend.id === user.id) {
          json(response, 404, { error: "Member not found." });
          return;
        }
        const existing = data.friendships.find((item) => item.ownerId === user.id && item.friendUserId === friend.id);
        if (!existing) {
          data.friendships.push({
            id: randomUUID(),
            ownerId: user.id,
            friendUserId: friend.id,
            presence: friend.presence,
            genre: friend.genre,
            role: friend.role,
            bio: friend.bio,
            groups: ["Friends"],
            unread: 0,
          });
          persist();
          broadcastCommunity(user.id);
        }
        json(response, 200, communitySnapshot(data, user));
        return;
      }
      if (match && match[1] === "buddies" && request.method === "DELETE" && !match[3]) {
        const friendship = data.friendships.find((item) => item.id === match[2] && item.ownerId === user.id);
        data.friendships = data.friendships.filter((item) => item !== friendship);
        data.conversations = data.conversations.filter((item) => item.buddyId !== match[2] || item.ownerId !== user.id);
        persist();
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
        broadcastCommunity(user.id);
        broadcastCommunity(result.recipientId);
        json(response, 201, communitySnapshot(data, user));
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
          user[urlField] = `/api/profiles/${encodeURIComponent(user.id)}/${expectedType}`;
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
          if (existsSync(oldImagePath)) unlinkSync(oldImagePath);
        }
        broadcastCommunity(user.id);
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
        if (!crate || !dub) {
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
      json(response, error.status ?? 500, { error: error.message || "The server could not complete the request." });
    }
  });

  function broadcastCommunity(userId) {
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

  server.on("upgrade", (request, socket, head) => {
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

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
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
    });
  });

  server.on("close", () => {
    for (const sockets of socketsByUser.values()) {
      for (const socket of sockets) socket.terminate();
    }
    webSocketServer.close();
  });

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  createApiServer().listen(port, host, () => {
    console.log(`cre8 server listening on http://${host}:${port}`);
  });
}
