import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import WebSocket from "ws";
import { createApiServer, initializeData } from "../src/server.mjs";

async function startTestServer(directory = mkdtempSync(join(tmpdir(), "cre8-api-")), webDirectory, guidesDirectory) {
  const server = createApiServer({
    dataPath: join(directory, "community.json"),
    mediaDirectory: join(directory, "audio"),
    publicAudioDirectory: join(directory, "seed-audio"),
    webDirectory,
    guidesDirectory: guidesDirectory ?? join(directory, "no-guides"),
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    directory,
    close: () => new Promise((resolveClose, rejectClose) =>
      server.close((error) => error ? rejectClose(error) : resolveClose())),
  };
}

test("the production server serves the web app and its static assets", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-web-"));
  const webDirectory = join(directory, "web");
  mkdirSync(join(webDirectory, "assets"), { recursive: true });
  writeFileSync(join(webDirectory, "index.html"), "<main>cre8</main>");
  writeFileSync(join(webDirectory, "assets", "app.js"), "console.log('cre8');");
  writeFileSync(join(webDirectory, "sw.js"), "/* service worker */");
  writeFileSync(join(webDirectory, "manifest.webmanifest"), "{}");
  const server = await startTestServer(join(directory, "data"), webDirectory);
  try {
    const page = await fetch(server.baseUrl);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.equal(await page.text(), "<main>cre8</main>");

    const asset = await fetch(`${server.baseUrl}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /text\/javascript/);
    assert.equal(await asset.text(), "console.log('cre8');");

    const worker = await fetch(`${server.baseUrl}/sw.js`);
    assert.match(worker.headers.get("content-type"), /text\/javascript/);
    assert.equal(worker.headers.get("cache-control"), "no-cache");
    const manifest = await fetch(`${server.baseUrl}/manifest.webmanifest`);
    assert.match(manifest.headers.get("content-type"), /application\/manifest\+json/);

    const appRoute = await fetch(`${server.baseUrl}/crates/my-crate`);
    assert.equal(appRoute.status, 200);
    assert.equal(await appRoute.text(), "<main>cre8</main>");

    const missingAsset = await fetch(`${server.baseUrl}/assets/missing.js`);
    assert.equal(missingAsset.status, 404);
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the production server serves the published guide library at /guides", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-guides-"));
  const guidesDirectory = join(directory, "guides");
  mkdirSync(guidesDirectory, { recursive: true });
  writeFileSync(join(guidesDirectory, "index.html"), "<h1>cre8 user journey guides</h1>");
  writeFileSync(join(guidesDirectory, "find-dub.mp4"), Buffer.from("fake-mp4-bytes-0123456789"));
  writeFileSync(join(guidesDirectory, "find-dub.srt"), "1\n00:00:00,000 --> 00:00:05,000\nOpen the Dub Vault.\n");
  writeFileSync(join(guidesDirectory, "notes.secret"), "not served");
  const server = await startTestServer(join(directory, "data"), undefined, guidesDirectory);
  try {
    const redirect = await fetch(`${server.baseUrl}/guides`, { redirect: "manual" });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get("location"), "/guides/");

    const page = await fetch(`${server.baseUrl}/guides/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.equal(page.headers.get("cache-control"), "no-cache");
    assert.equal(await page.text(), "<h1>cre8 user journey guides</h1>");

    const video = await fetch(`${server.baseUrl}/guides/find-dub.mp4`);
    assert.equal(video.status, 200);
    assert.equal(video.headers.get("content-type"), "video/mp4");
    assert.equal(video.headers.get("accept-ranges"), "bytes");

    const clip = await fetch(`${server.baseUrl}/guides/find-dub.mp4`, { headers: { range: "bytes=0-7" } });
    assert.equal(clip.status, 206);
    assert.equal(clip.headers.get("content-range"), "bytes 0-7/25");
    assert.equal(await clip.text(), "fake-mp4");

    const captions = await fetch(`${server.baseUrl}/guides/find-dub.srt`);
    assert.equal(captions.status, 200);
    assert.match(captions.headers.get("content-type"), /application\/x-subrip/);

    assert.equal((await fetch(`${server.baseUrl}/guides/missing.mp4`)).status, 404);
    assert.equal((await fetch(`${server.baseUrl}/guides/notes.secret`)).status, 404);
    assert.equal((await fetch(`${server.baseUrl}/guides/..%2Fdata%2Fcommunity.json`)).status, 404);
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the production server reports an unpublished guide library at /guides", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/guides/`);
    assert.equal(response.status, 404);
    assert.match((await response.json()).error, /not published/);
  } finally {
    await server.close();
    rmSync(server.directory, { recursive: true, force: true });
  }
});

async function registerAccount(baseUrl, username) {
  const response = await fetch(`${baseUrl}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      displayName: username,
      genre: "Garage",
      password: "long-enough-password",
    }),
  });
  assert.equal(response.status, 201);
  return response.headers.get("set-cookie").split(";")[0];
}

test("external dub links expose only public metadata and streams, preserving authenticated downloads and revocation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-public-dub-"));
  const dataPath = join(directory, "community.json");
  const audioDirectory = join(directory, "audio");
  const data = initializeData(dataPath, audioDirectory);
  const owner = data.users.find((user) => user.username === "meladee");
  const audio = Buffer.alloc(44 + 100 * 8000 * 2, 7);
  audio.write("RIFF", 0);
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(8000, 24);
  audio.writeUInt32LE(16000, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36);
  audio.writeUInt32LE(audio.length - 44, 40);
  mkdirSync(audioDirectory, { recursive: true });
  writeFileSync(join(audioDirectory, "shared.wav"), audio);
  const artwork = Buffer.from("0123456789");
  writeFileSync(join(audioDirectory, "shared.png"), artwork);
  for (const [id, distribution, aListPublic] of [
    ["worldwide", "worldwide", false],
    ["public-alist", "alist", true],
    ["restricted-alist", "alist", false],
    ["private", "private", false],
  ]) {
    data.dubs.push({
      id, title: id, artistId: "artist-meladee", uploaderId: owner.id,
      uploadedAt: "2026-01-01", distribution, aListPublic, duration: "03:00",
      bpm: 140, genre: "Garage", artwork: "custom", message: "Listen",
      audioSource: "upload", storedAudioName: "shared.wav", storedArtworkName: "shared.png",
      audioFileName: "original.wav", privateField: "never-expose-this", version: 1,
    });
  }
  data.dubs.push({ ...data.dubs.find((dub) => dub.id === "worldwide"), id: "missing-media", storedAudioName: undefined, storedArtworkName: undefined });
  writeFileSync(join(audioDirectory, "invalid.wav"), "invalid audio");
  data.dubs.push({ ...data.dubs.find((dub) => dub.id === "worldwide"), id: "invalid-media", storedAudioName: "invalid.wav" });
  writeFileSync(dataPath, JSON.stringify(data));
  const server = await startTestServer(directory);
  const publicUrl = (id, suffix = "") => `${server.baseUrl}/api/public/dubs/${id}${suffix}`;
  try {
    const login = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "meladee", password: "meladee" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    for (const id of ["worldwide", "public-alist"]) {
      const metadata = await fetch(publicUrl(id));
      assert.equal(metadata.status, 200);
      assert.match(metadata.headers.get("cache-control"), /no-store/);
      const body = await metadata.json();
      assert.equal(body.authenticated, false);
      assert.equal(body.dub.title, id);
      assert.equal(body.dub.audioUrl, `/api/public/dubs/${id}/audio`);
      assert.equal(body.dub.artworkUrl, `/api/public/dubs/${id}/artwork`);
      assert.deepEqual(Object.keys(body.dub).sort(), [
        "id", "title", "artist", "artistAListApproved", "uploader", "uploaderDisplayName",
        "uploadedAt", "bpm", "genre", "duration", "likes", "downloads", "artwork",
        "message", "distribution", "aListPublic", "audioUrl", "artworkUrl",
        "previewSeconds",
      ].sort());
      assert.equal(body.dub.duration, "00:30");
      assert.equal(body.dub.previewSeconds, 30);
      const signedIn = await (await fetch(publicUrl(id), { headers: { cookie } })).json();
      assert.equal(signedIn.authenticated, true);
      assert.equal(signedIn.dub.audioUrl, `/api/dubs/${id}/audio`);
      assert.equal(signedIn.dub.duration, "03:00");
      for (const [media, mime] of [["audio", "audio/wav"], ["artwork", "image/png"]]) {
        const stream = await fetch(publicUrl(id, `/${media}`), { headers: { range: "bytes=2-5" } });
        assert.equal(stream.status, 206);
        assert.equal(stream.headers.get("content-type"), mime);
        assert.equal(stream.headers.get("content-disposition"), "inline");
        const totalBytes = media === "audio" ? 44 + 30 * 32000 : artwork.length;
        assert.equal(stream.headers.get("content-range"), `bytes 2-5/${totalBytes}`);
        assert.equal((await stream.arrayBuffer()).byteLength, 4);
        assert.equal((await fetch(publicUrl(id, `/${media}?download=1`))).status, 401);
        assert.equal((await fetch(publicUrl(id, `/${media}?download=1`), { headers: { cookie } })).status, 403);
      }
    }
    const suffix = await fetch(publicUrl("worldwide", "/audio"), { headers: { range: "bytes=-3" } });
    assert.equal(suffix.status, 206);
    assert.equal((await suffix.arrayBuffer()).byteLength, 3);
    assert.equal((await fetch(publicUrl("worldwide", "/audio"), { headers: { range: "bytes=1000000-" } })).status, 416);
    const outsiderCookie = await registerAccount(server.baseUrl, "preview-listener");
    const updatePreview = (previewSeconds, authCookie = cookie, id = "worldwide") => fetch(`${server.baseUrl}/api/dubs/${id}/preview`, {
      method: "PATCH", headers: { cookie: authCookie, "content-type": "application/json" },
      body: JSON.stringify({ previewSeconds }),
    });
    assert.equal((await updatePreview(60, "")).status, 401);
    assert.equal((await updatePreview(60, outsiderCookie)).status, 404);
    for (const invalid of [0, -30, 31, 300, "60", null]) {
      assert.equal((await updatePreview(invalid)).status, 400);
    }
    assert.equal((await updatePreview(60, cookie, "private")).status, 404);
    assert.equal((await updatePreview(60, cookie, "restricted-alist")).status, 404);
    for (const seconds of [60, 90, 30]) {
      assert.equal((await updatePreview(seconds)).status, 200);
      const preview = Buffer.from(await (await fetch(publicUrl("worldwide", "/audio?seconds=999&start=60"))).arrayBuffer());
      assert.equal(preview.toString("ascii", 0, 4), "RIFF");
      assert.equal(preview.length, 44 + seconds * 32000);
      assert.equal(preview.readUInt32LE(40) / preview.readUInt32LE(28), seconds);
      assert.equal((await (await fetch(publicUrl("worldwide"))).json()).dub.previewSeconds, seconds);
      assert.equal(JSON.parse(readFileSync(dataPath, "utf8")).dubs.find((dub) => dub.id === "worldwide").previewSeconds, seconds);
    }
    const authenticatedAudio = await fetch(publicUrl("worldwide", "/audio"), { headers: { cookie: outsiderCookie } });
    assert.deepEqual(Buffer.from(await authenticatedAudio.arrayBuffer()), audio);
    for (const id of ["private", "restricted-alist", "unknown"]) {
      for (const suffix of ["", "/audio", "/artwork"]) {
        assert.equal((await fetch(publicUrl(id, suffix))).status, 404);
        assert.equal((await fetch(publicUrl(id, suffix), { headers: { cookie } })).status, 404);
      }
    }
    for (const suffix of ["/audio", "/artwork"]) {
      assert.equal((await fetch(publicUrl("missing-media", suffix))).status, 404);
    }
    const invalidPreview = await fetch(publicUrl("invalid-media", "/audio"));
    assert.equal(invalidPreview.status, 503);
    assert.match((await invalidPreview.json()).error, /preview could not be prepared/);
    assert.equal((await fetch(`${server.baseUrl}/api/dubs/worldwide/audio?download=1`)).status, 401);
    assert.equal((await fetch(`${server.baseUrl}/api/dubs/worldwide/download`, { method: "POST" })).status, 401);
    const entitlement = await fetch(`${server.baseUrl}/api/dubs/worldwide/download`, { method: "POST", headers: { cookie } });
    assert.equal(entitlement.status, 200);
    const download = await entitlement.json();
    const attachment = await fetch(`${server.baseUrl}${download.audioUrl}`, { headers: { cookie } });
    assert.equal(attachment.status, 200);
    assert.match(attachment.headers.get("content-disposition"), /^attachment/);
    assert.deepEqual(Buffer.from(await attachment.arrayBuffer()), audio);
    const publicTrack = (await (await fetch(publicUrl("worldwide"))).json()).dub;
    assert.equal(publicTrack.downloads, 1);
    assert.equal(publicTrack.likes, 1);
    assert.equal(JSON.parse(readFileSync(dataPath, "utf8")).dubs.find((dub) => dub.id === "worldwide").previewSeconds, 30);

    const revoke = await fetch(`${server.baseUrl}/api/dubs/public-alist`, {
      method: "PATCH", headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "public-alist", artistId: "artist-meladee", aListPublic: false }),
    });
    assert.equal(revoke.status, 200);
    for (const suffix of ["", "/audio", "/artwork"]) {
      assert.equal((await fetch(publicUrl("public-alist", suffix))).status, 404);
    }
    assert.equal((await fetch(`${server.baseUrl}/api/dubs/worldwide`, { method: "DELETE", headers: { cookie } })).status, 200);
    assert.equal((await fetch(publicUrl("worldwide"))).status, 404);
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("playback positions are authenticated, validated, isolated and persisted", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-playback-"));
  const dataPath = join(directory, "community.json");
  const data = initializeData(dataPath, join(directory, "audio"));
  data.dubs.push({
    id: "track-one", title: "Track", artist: "Meladee", artistId: "artist-meladee",
    distribution: "worldwide",
    uploaderId: "user-meladee", uploadedAt: "2026-01-01T00:00:00Z",
    bitrateKbps: 192.7,
  });
  writeFileSync(dataPath, JSON.stringify(data));
  let server = await startTestServer(directory);
  const login = async (username) => {
    const response = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: username }),
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  try {
    const anonymous = await fetch(`${server.baseUrl}/api/playback`, { method: "PUT" });
    assert.equal(anonymous.status, 401);
    const cookie = await login("meladee");
    const otherCookie = await login("holik");
    const put = (body) => fetch(`${server.baseUrl}/api/playback`, {
      method: "PUT", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal((await put({ dubId: "missing", positionSeconds: 1 })).status, 404);
    assert.equal((await put({ dubId: "track-one", positionSeconds: -1 })).status, 400);
    assert.equal((await put({ dubId: "track-one", positionSeconds: "4" })).status, 400);
    assert.equal((await put(null)).status, 400);
    assert.equal((await put({ dubId: "track-one", positionSeconds: 42.5 })).status, 200);
    const other = await (await fetch(`${server.baseUrl}/api/community`, { headers: { cookie: otherCookie } })).json();
    assert.equal(other.lastPlayback, null);
    await server.close();
    server = await startTestServer(directory);
    const newCookie = await login("meladee");
    const snapshot = await (await fetch(`${server.baseUrl}/api/community`, { headers: { cookie: newCookie } })).json();
    assert.deepEqual(snapshot.lastPlayback, { dubId: "track-one", positionSeconds: 42.5 });
    assert.equal(snapshot.dubs[0].bitrateKbps, 193);
    const deleted = await fetch(`${server.baseUrl}/api/dubs/track-one`, { method: "DELETE", headers: { cookie: newCookie } });
    assert.equal(deleted.status, 200);
    const afterDelete = await (await fetch(`${server.baseUrl}/api/community`, { headers: { cookie: newCookie } })).json();
    assert.equal(afterDelete.lastPlayback, null);
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

function openChat(baseUrl, cookie, origin) {
  const headers = cookie ? { cookie } : {};
  if (origin) headers.origin = origin;
  return new WebSocket(baseUrl.replace(/^http/, "ws") + "/api/chat", {
    headers,
  });
}

function waitForUpgradeStatus(socket) {
  return new Promise((resolve, reject) => {
    socket.once("unexpected-response", (_request, response) => {
      resolve(response.statusCode);
      response.resume();
    });
    socket.once("error", reject);
  });
}

function waitForMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for a chat event."));
    }, 2000);
    function onMessage(data) {
      const event = JSON.parse(data.toString());
      if (!predicate(event)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      resolve(event);
    }
    socket.on("message", onMessage);
  });
}

function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
}

function waitForClose(socket) {
  return new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    socket.once("close", resolve);
  });
}

test("profile pictures reach members, dubs, friends and connected clients", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-avatars-"));
  const dataPath = join(directory, "community.json");
  const data = initializeData(dataPath, join(directory, "audio"));
  data.dubs.push({
    id: "avatar-dub", title: "Test Dub", artist: "Meladee", artistId: "artist-meladee",
    distribution: "worldwide",
    uploaderId: "user-meladee", uploadedAt: "2026-01-01T00:00:00Z",
  });
  writeFileSync(dataPath, JSON.stringify(data));
  const server = await startTestServer(directory);
  let socket;
  const login = async (username) => {
    const response = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: username }),
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const uploadAvatar = async (cookie) => {
    const response = await fetch(`${server.baseUrl}/api/uploads?type=avatar`, {
      method: "POST", headers: { cookie, "content-type": "image/png", "x-file-name": "avatar.png" },
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    assert.equal(response.status, 201);
    return (await response.json()).uploadId;
  };
  const updateAvatar = async (cookie, avatarUploadId) => {
    const response = await fetch(`${server.baseUrl}/api/profile`, {
      method: "PATCH", headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ avatarUploadId }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).member.avatarUrl;
  };
  try {
    const meladee = await login("meladee");
    const holik = await login("holik");
    socket = openChat(server.baseUrl, holik);
    await waitForOpen(socket);
    const firstUpload = await uploadAvatar(meladee);
    const updateEvent = waitForMessage(socket, (event) => event.type === "community.snapshot"
      && event.snapshot.suggestedMembers.some((member) => member.username === "meladee" && member.avatarUrl));
    const avatarUrl = await updateAvatar(meladee, firstUpload);
    const snapshot = (await updateEvent).snapshot;
    assert.equal(snapshot.suggestedMembers.find((member) => member.username === "meladee").avatarUrl, avatarUrl);
    assert.equal(snapshot.dubs[0].uploaderAvatarUrl, avatarUrl);
    assert.equal((await fetch(`${server.baseUrl}${avatarUrl}`, { headers: { cookie: holik } })).status, 200);
    const search = await (await fetch(`${server.baseUrl}/api/members?q=meladee`, { headers: { cookie: holik } })).json();
    assert.equal(search.members[0].avatarUrl, avatarUrl);
    const friendResponse = await fetch(`${server.baseUrl}/api/buddies`, {
      method: "POST", headers: { cookie: holik, "content-type": "application/json" },
      body: JSON.stringify({ username: "meladee" }),
    });
    assert.equal((await friendResponse.json()).buddies[0].avatarUrl, avatarUrl);
    const secondUpload = await uploadAvatar(meladee);
    const friendUpdate = waitForMessage(socket, (event) => event.type === "community.snapshot"
      && event.snapshot.buddies.some((buddy) => buddy.username === "meladee" && buddy.avatarUrl !== avatarUrl));
    const newUrl = await updateAvatar(meladee, secondUpload);
    assert.notEqual(newUrl, avatarUrl);
    assert.equal((await friendUpdate).snapshot.buddies[0].avatarUrl, newUrl);
  } finally {
    if (socket) {
      const closed = waitForClose(socket);
      socket.close();
      await closed;
    }
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("artists can register, sign in immediately, and retain their linked profile", async () => {
  let server = await startTestServer();
  try {
    const invalidRegistration = await fetch(`${server.baseUrl}/api/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "ab",
        displayName: "New Artist",
        password: "long-enough-password",
      }),
    });
    assert.equal(invalidRegistration.status, 400);

    const registration = await fetch(`${server.baseUrl}/api/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "New.Artist",
        displayName: "New Artist",
        genre: "UK Garage, Bassline",
        password: "long-enough-password",
      }),
    });
    assert.equal(registration.status, 201);
    const createdUser = await registration.json();
    const cookie = registration.headers.get("set-cookie").split(";")[0];
    const communityResponse = await fetch(`${server.baseUrl}/api/community`, {
      headers: { cookie },
    });
    assert.equal(communityResponse.status, 200);
    const community = await communityResponse.json();
    assert.equal(community.member.id, createdUser.user.id);
    assert.equal(community.member.username, "new.artist");
    assert.equal(community.artists.length, 1);
    assert.equal(community.artists[0].userId, createdUser.user.id);
    assert.equal(community.artists[0].name, "New Artist");
    assert.deepEqual(community.artists[0].genres, ["UK Garage", "Bassline"]);
    const memberSearch = await fetch(`${server.baseUrl}/api/members?q=holik`, { headers: { cookie } });
    assert.equal(memberSearch.status, 200);
    const matchedMember = (await memberSearch.json()).members[0];
    assert.equal(matchedMember.username, "holik");
    const artistIdSearch = await fetch(`${server.baseUrl}/api/members?q=artist-holik`, { headers: { cookie } });
    assert.equal((await artistIdSearch.json()).members[0].artistId, "artist-holik");
    const addById = await fetch(`${server.baseUrl}/api/buddies`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ id: matchedMember.artistId }),
    });
    assert.ok((await addById.json()).buddies.some((buddy) => buddy.username === "holik"));
    assert.ok(community.dubs.every((dub) => dub.artistId !== community.artists[0].id));

    const duplicateRegistration = await fetch(`${server.baseUrl}/api/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "NEW.ARTIST",
        displayName: "Duplicate Artist",
        password: "long-enough-password",
      }),
    });
    assert.equal(duplicateRegistration.status, 409);

    const simpleRegistration = await fetch(`${server.baseUrl}/api/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Fresh DJ", password: "long-enough-password" }),
    });
    assert.equal(simpleRegistration.status, 201);
    const simpleAccount = await simpleRegistration.json();
    assert.equal(simpleAccount.user.username, "fresh.dj");

    await server.close();
    server = await startTestServer(server.directory);
    const login = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "new.artist", password: "long-enough-password" }),
    });
    assert.equal(login.status, 200);
    const restoredCookie = login.headers.get("set-cookie").split(";")[0];
    const restored = await fetch(`${server.baseUrl}/api/community`, {
      headers: { cookie: restoredCookie },
    }).then((response) => response.json());
    assert.equal(restored.artists[0].userId, createdUser.user.id);

    const logout = await fetch(`${server.baseUrl}/api/logout`, {
      method: "POST",
      headers: { cookie: restoredCookie },
    });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
    const signedOutCommunity = await fetch(`${server.baseUrl}/api/community`, {
      headers: { cookie: restoredCookie },
    });
    assert.equal(signedOutCommunity.status, 401);
  } finally {
    await server.close();
    rmSync(server.directory, { recursive: true, force: true });
  }
});

test("starter account has no seeded tracks and retains uploaded community activity", async () => {
  let server = await startTestServer();
  try {
    const invalidLogin = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "meladee", password: "wrong" }),
    });
    assert.equal(invalidLogin.status, 401);

    const login = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "meladee", password: "meladee" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const communityResponse = await fetch(`${server.baseUrl}/api/community`, {
      headers: { cookie },
    });
    const community = await communityResponse.json();
    assert.equal(community.member.username, "meladee");
    assert.equal(community.artists[0].id, "artist-meladee");
    assert.deepEqual(community.dubs, []);
    const storedData = JSON.parse(readFileSync(join(server.directory, "community.json"), "utf8"));
    assert.deepEqual(storedData.users.map((user) => user.username).sort(), ["holik", "meladee"]);
    assert.deepEqual(storedData.artists.map((artist) => artist.id).sort(), ["artist-holik", "artist-meladee"]);
    assert.deepEqual(storedData.friendships, []);
    assert.deepEqual(storedData.conversations, []);
    assert.deepEqual(storedData.crates, []);

    const crateResponse = await fetch(`${server.baseUrl}/api/crates`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Late-night weapons" }),
    });
    assert.equal(crateResponse.status, 201);
    const crate = await crateResponse.json();

    const renameCrateResponse = await fetch(`${server.baseUrl}/api/crates/${crate.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Late-night selection" }),
    });
    assert.equal(renameCrateResponse.status, 200);
    assert.equal((await renameCrateResponse.json()).name, "Late-night selection");

    const duplicateCrateResponse = await fetch(`${server.baseUrl}/api/crates`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: " late-NIGHT SELECTION " }),
    });
    assert.equal(duplicateCrateResponse.status, 409);

    const invalidRenameResponse = await fetch(`${server.baseUrl}/api/crates/${crate.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: " " }),
    });
    assert.equal(invalidRenameResponse.status, 400);

    const temporaryCrateResponse = await fetch(`${server.baseUrl}/api/crates`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Disposable crate" }),
    });
    const temporaryCrate = await temporaryCrateResponse.json();
    const deleteCrateResponse = await fetch(`${server.baseUrl}/api/crates/${temporaryCrate.id}`, {
      method: "DELETE",
      headers: { cookie },
    });
    assert.equal(deleteCrateResponse.status, 200);
    assert.equal((await deleteCrateResponse.json()).id, temporaryCrate.id);
    const deletedCrateResponse = await fetch(`${server.baseUrl}/api/crates/${temporaryCrate.id}`, {
      method: "DELETE",
      headers: { cookie },
    });
    assert.equal(deletedCrateResponse.status, 404);

    const addedFriendResponse = await fetch(`${server.baseUrl}/api/buddies`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ username: "holik" }),
    });
    const withFriend = await addedFriendResponse.json();
    const holik = withFriend.buddies.find((buddy) => buddy.username === "holik");
    assert.ok(holik);
    const removedFriendResponse = await fetch(`${server.baseUrl}/api/buddies/${holik.id}`, {
      method: "DELETE",
      headers: { cookie },
    });
    assert.ok(!(await removedFriendResponse.json()).buddies.some((buddy) => buddy.id === holik.id));
    const readdedFriendResponse = await fetch(`${server.baseUrl}/api/buddies`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ username: "holik" }),
    });
    const holikFriendship = (await readdedFriendResponse.json()).buddies
      .find((buddy) => buddy.username === "holik");
    assert.ok(holikFriendship);

    const uploadResponse = await fetch(`${server.baseUrl}/api/uploads`, {
      method: "POST",
      headers: { cookie, "content-type": "audio/wav", "x-file-name": "New%20Dub.wav" },
      body: Buffer.from("RIFF-test"),
    });
    const { uploadId } = await uploadResponse.json();
    const artworkUploadResponse = await fetch(`${server.baseUrl}/api/uploads?type=artwork`, {
      method: "POST",
      headers: { cookie, "content-type": "image/png", "x-file-name": "cover%20art.png" },
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    assert.equal(artworkUploadResponse.status, 201);
    const { uploadId: artworkUploadId } = await artworkUploadResponse.json();
    const avatarUploadResponse = await fetch(`${server.baseUrl}/api/uploads?type=avatar`, {
      method: "POST",
      headers: { cookie, "content-type": "image/png", "x-file-name": "profile.png" },
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    assert.equal(avatarUploadResponse.status, 201);
    const { uploadId: avatarUploadId } = await avatarUploadResponse.json();
    const bannerUploadResponse = await fetch(`${server.baseUrl}/api/uploads?type=banner`, {
      method: "POST",
      headers: { cookie, "content-type": "image/png", "x-file-name": "banner.png" },
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    const { uploadId: bannerUploadId } = await bannerUploadResponse.json();
    const profileResponse = await fetch(`${server.baseUrl}/api/profile`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Meladee", role: "DJ / Producer", genre: "Drum & Bass, Jungle",
        bio: "In the studio", links: [{ label: "SoundCloud", url: "https://soundcloud.com/meladee" }],
        avatarUploadId, bannerUploadId,
      }),
    });
    assert.equal(profileResponse.status, 200);
    const updatedProfile = await profileResponse.json();
    assert.equal(updatedProfile.member.links[0].label, "SoundCloud");
    assert.equal((await fetch(`${server.baseUrl}${updatedProfile.member.avatarUrl}`, { headers: { cookie } })).status, 200);
    assert.equal((await fetch(`${server.baseUrl}${updatedProfile.member.bannerUrl}`, { headers: { cookie } })).status, 200);
    const dubResponse = await fetch(`${server.baseUrl}/api/dubs`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "New Dub",
        artistId: "artist-meladee",
        tags: ["Jungle", "Rollers"],
        genre: "Garage",
        durationSeconds: 1,
        uploadId,
        artworkUploadId,
      }),
    });
    assert.equal(dubResponse.status, 201);
    const newDub = await dubResponse.json();
    assert.equal(newDub.artistId, "artist-meladee");
    assert.equal(newDub.artwork, "uploaded-artwork");
    assert.equal(newDub.audioFormat, "WAV");
    assert.equal(newDub.duration, "00:01");
    assert.equal(newDub.bitrateKbps, 0);
    assert.deepEqual(newDub.tags, ["Jungle", "Rollers"]);
    assert.match(newDub.artworkUrl, new RegExp(`/api/dubs/${newDub.id}/artwork`));
    assert.ok(Number.isFinite(Date.parse(newDub.uploadedAt)));
    const editedDubResponse = await fetch(`${server.baseUrl}/api/dubs/${newDub.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Updated Dub",
        artistId: "artist-meladee",
        tags: ["Rollers", "Jungle"],
        bpm: 132,
        message: "Updated release notes.",
      }),
    });
    assert.equal(editedDubResponse.status, 200);
    const editedDub = await editedDubResponse.json();
    assert.equal(editedDub.title, "Updated Dub");
    assert.equal(editedDub.bpm, 132);
    assert.deepEqual(editedDub.tags, ["Rollers", "Jungle"]);
    const filteredDubs = await fetch(`${server.baseUrl}/api/dubs/search?q=updated&tag=Jungle&minBpm=130&maxBpm=140&fileType=WAV&minBitrate=0`, { headers: { cookie } });
    assert.equal(filteredDubs.status, 200);
    assert.deepEqual((await filteredDubs.json()).dubs.map((dub) => dub.id), [newDub.id]);
    const invalidDubSearch = await fetch(`${server.baseUrl}/api/dubs/search?minBpm=180&maxBpm=120`, { headers: { cookie } });
    assert.equal(invalidDubSearch.status, 400);
    const outOfRangeDubSearch = await fetch(`${server.baseUrl}/api/dubs/search?minBpm=301`, { headers: { cookie } });
    assert.equal(outOfRangeDubSearch.status, 400);
    assert.equal(editedDub.message, "Updated release notes.");
    const unauthorizedEdit = await fetch(`${server.baseUrl}/api/dubs/${newDub.id}`, {
      method: "PATCH",
      headers: { cookie: await registerAccount(server.baseUrl, "trackeditor"), "content-type": "application/json" },
      body: JSON.stringify({ title: "Not yours", artistId: "artist-meladee" }),
    });
    assert.equal(unauthorizedEdit.status, 404);
    const savedResponse = await fetch(
      `${server.baseUrl}/api/crates/${crate.id}/dubs/${newDub.id}`,
      { method: "PUT", headers: { cookie } },
    );
    assert.deepEqual((await savedResponse.json()).dubIds, [newDub.id]);
    const imageResponse = await fetch(`${server.baseUrl}${newDub.artworkUrl}`, {
      headers: { cookie },
    });
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get("content-type"), "image/png");

    const downloadResponse = await fetch(`${server.baseUrl}/api/dubs/${newDub.id}/download`, {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(downloadResponse.status, 200);
    const download = await downloadResponse.json();
    assert.equal(download.likes, 1);
    assert.equal(download.downloads, 1);

    const duplicateDownload = await fetch(`${server.baseUrl}/api/dubs/${newDub.id}/download`, {
      method: "POST",
      headers: { cookie },
    });
    const repeated = await duplicateDownload.json();
    assert.equal(repeated.likes, 1);
    assert.equal(repeated.downloads, 2);

    const fanCookie = await registerAccount(server.baseUrl, "downloadfan");
    const fanDownload = await fetch(`${server.baseUrl}/api/dubs/${newDub.id}/download`, {
      method: "POST",
      headers: { cookie: fanCookie },
    });
    assert.equal(fanDownload.status, 200);
    const uploaderSnapshot = await fetch(`${server.baseUrl}/api/community`, { headers: { cookie } }).then((response) => response.json());
    const uploaderDub = uploaderSnapshot.dubs.find((item) => item.id === newDub.id);
    assert.equal(uploaderDub.downloads, 3);
    assert.equal(uploaderDub.likes, 2);
    assert.equal(uploaderDub.downloaders.length, 2);
    assert.ok(uploaderDub.downloaders.some((downloader) => downloader.username === "downloadfan"));
    assert.equal(uploaderSnapshot.library.length, 2);
    const fanSnapshot = await fetch(`${server.baseUrl}/api/community`, { headers: { cookie: fanCookie } }).then((response) => response.json());
    const fanDub = fanSnapshot.dubs.find((item) => item.id === newDub.id);
    assert.equal(Object.hasOwn(fanDub, "downloaders"), false);
    assert.equal(fanSnapshot.library[0].dub.id, newDub.id);

    const messageResponse = await fetch(
      `${server.baseUrl}/api/conversations/${holikFriendship.id}/messages`,
      {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ text: "Persistent message", dubId: newDub.id }),
      },
    );
    assert.equal(messageResponse.status, 201);
    const refreshed = await messageResponse.json();
    assert.ok(refreshed.conversations[0].messages.some((message) => message.text === "Persistent message"));

    await server.close();
    server = await startTestServer(server.directory);
    const secondLogin = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "meladee", password: "meladee" }),
    });
    const secondCookie = secondLogin.headers.get("set-cookie").split(";")[0];
    const restored = await fetch(`${server.baseUrl}/api/community`, {
      headers: { cookie: secondCookie },
    }).then((response) => response.json());
    assert.ok(restored.dubs.some((item) => item.id === newDub.id && item.title === "Updated Dub" && item.likes === 2 && item.downloads === 3));
    const restoredImage = await fetch(`${server.baseUrl}${newDub.artworkUrl}`, {
      headers: { cookie: secondCookie },
    });
    assert.equal(restoredImage.status, 200);
    assert.ok(restored.crates.some((item) => item.id === crate.id && item.dubIds.includes(newDub.id)));
    assert.ok(restored.conversations[0].messages.some((message) => message.text === "Persistent message"));
    const storedAfterEdit = JSON.parse(readFileSync(join(server.directory, "community.json"), "utf8"));
    const artworkStoredPath = join(server.directory, "audio", storedAfterEdit.dubs.find((item) => item.id === newDub.id).storedArtworkName);
    const deleteResponse = await fetch(`${server.baseUrl}/api/dubs/${newDub.id}`, {
      method: "DELETE",
      headers: { cookie: secondCookie },
    });
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(await deleteResponse.json(), { id: newDub.id });
    assert.equal(existsSync(artworkStoredPath), false);
    const afterDelete = await fetch(`${server.baseUrl}/api/community`, { headers: { cookie: secondCookie } }).then((response) => response.json());
    assert.ok(!afterDelete.dubs.some((item) => item.id === newDub.id));
    assert.ok(!afterDelete.crates.some((item) => item.dubIds.includes(newDub.id)));
  } finally {
    await server.close();
    rmSync(server.directory, { recursive: true, force: true });
  }
});

test("unversioned legacy data is not deleted during startup", () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-reset-"));
  const dataPath = join(directory, "community.json");
  const mediaDirectory = join(directory, "audio");
  mkdirSync(mediaDirectory, { recursive: true });
  const staleMediaNames = ["old-track.wav", "old-cover.png", "unfinished.wav"];
  for (const name of staleMediaNames) writeFileSync(join(mediaDirectory, name), "old upload");
  writeFileSync(dataPath, JSON.stringify({
    users: [{ id: "old-user", username: "old-demo" }],
    artists: [{ id: "old-artist", userId: "old-user" }],
    dubs: [{
      id: "old-dub",
      storedAudioName: staleMediaNames[0],
      storedArtworkName: staleMediaNames[1],
    }],
    uploads: [{ storedName: staleMediaNames[2] }],
    friendships: [{ id: "old-friendship" }],
    conversations: [{ id: "old-conversation" }],
    likes: [{ id: "old-like" }],
    downloads: [{ id: "old-download" }],
    crates: [{ id: "old-crate" }],
  }));
  try {
    assert.throws(() => initializeData(dataPath, mediaDirectory), /requires manual migration/);
    const retainedData = JSON.parse(readFileSync(dataPath, "utf8"));
    assert.equal(retainedData.dubs[0].id, "old-dub");
    for (const name of staleMediaNames) assert.equal(existsSync(join(mediaDirectory, name)), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v3 migration preserves records and defaults existing dubs to Worldwide", () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-v3-migration-"));
  const dataPath = join(directory, "community.json");
  const mediaDirectory = join(directory, "audio");
  try {
    const data = initializeData(dataPath, mediaDirectory);
    data.schemaVersion = 3;
    delete data.dubGrants;
    data.dubs.push({ id: "legacy", uploaderId: "user-meladee", storedAudioName: "legacy.wav" });
    data.downloads.push({ dubId: "legacy", userId: "user-holik" });
    mkdirSync(mediaDirectory, { recursive: true });
    writeFileSync(join(mediaDirectory, "legacy.wav"), "audio");
    writeFileSync(dataPath, JSON.stringify(data));
    const migrated = initializeData(dataPath, mediaDirectory);
    assert.equal(migrated.schemaVersion, 7);
    assert.equal(migrated.dubs[0].distribution, "worldwide");
    assert.deepEqual(migrated.downloads, data.downloads);
    assert.equal(readFileSync(join(mediaDirectory, "legacy.wav"), "utf8"), "audio");
    assert.deepEqual(migrated.dubGrants, []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v4 migration preserves existing grants and A-List status", () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-v4-migration-"));
  const dataPath = join(directory, "community.json");
  try {
    const data = initializeData(dataPath, join(directory, "audio"));
    data.schemaVersion = 4;
    delete data.aListApplications;
    delete data.aListAccessDecisions;
    delete data.notifications;
    data.users[0].aListApproved = true;
    data.dubGrants.push({ dubId: "private", userId: data.users[1].id });
    writeFileSync(dataPath, JSON.stringify(data));
    const migrated = initializeData(dataPath, join(directory, "audio"));
    assert.equal(migrated.schemaVersion, 7);
    assert.equal(migrated.users[0].aListApproved, true);
    assert.deepEqual(migrated.dubGrants, data.dubGrants);
    assert.deepEqual(migrated.aListApplications, []);
    assert.deepEqual(migrated.notifications, []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("schema v5 migration preserves dubs and messages without guessing their shared version", () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-v5-migration-"));
  const dataPath = join(directory, "community.json");
  try {
    const data = initializeData(dataPath, join(directory, "audio"));
    data.schemaVersion = 5;
    delete data.dubShares;
    data.dubs.push({ id: "legacy", title: "Old track", distribution: "private", uploaderId: "user-meladee" });
    data.conversations.push({ ownerId: "user-meladee", buddyId: "old-friend", messages: [{ id: "old-message", sender: "you", text: "Shared", dubId: "legacy" }] });
    writeFileSync(dataPath, JSON.stringify(data));
    const migrated = initializeData(dataPath, join(directory, "audio"));
    assert.equal(migrated.schemaVersion, 7);
    assert.equal(migrated.dubs[0].version, 1);
    assert.deepEqual(migrated.dubShares, []);
    assert.equal(migrated.conversations[0].messages[0].dubId, "legacy");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("A-List applications, decisions, notifications and access persist across sessions", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-alist-"));
  const dataPath = join(directory, "community.json");
  const data = initializeData(dataPath, join(directory, "audio"));
  data.users.find((user) => user.username === "holik").aListApproved = true;
  data.dubs.push({ id: "artist-approval-test", title: "Public artist test", distribution: "worldwide", uploaderId: "user-meladee", artistId: "artist-meladee", uploadedAt: "2026-01-01T00:00:00Z" });
  data.dubs.push({ id: "exclusive", distribution: "alist", uploaderId: "user-holik", title: "Exclusive", uploadedAt: "2026-01-01T00:00:00Z", storedAudioName: "exclusive.wav", audioSource: "upload" });
  mkdirSync(join(directory, "audio"), { recursive: true });
  writeFileSync(join(directory, "audio", "exclusive.wav"), "audio");
  writeFileSync(dataPath, JSON.stringify(data));
  const oldAdmins = process.env.ADMIN_USERNAMES;
  process.env.ADMIN_USERNAMES = "holik";
  let server = await startTestServer(directory);
  let socket;
  let observerSocket;
  const login = async (username) => {
    const response = await fetch(`${server.baseUrl}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: username }) });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const call = (cookie, path, method = "GET", body) => fetch(`${server.baseUrl}${path}`, {
    method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const snapshot = async (cookie) => (await call(cookie, "/api/community")).json();
  const fields = {
    artistName: "Meladee", roles: ["DJ", "Producer"], djExperience: "10 years",
    producerExperience: "", events: ["Event"], supporters: ["Artist"], labels: ["Label"],
    social: { instagram: { url: "https://instagram.com/example", followers: 123 }, tiktok: { url: "https://tiktok.com/example" }, facebook: { url: "https://facebook.com/example" } },
    additionalInfo: "My application",
  };
  try {
    let applicant = await login("meladee");
    let admin = await login("holik");
    assert.equal((await snapshot(admin)).dubs.find((dub) => dub.id === "artist-approval-test").artistAListApproved, false);
    assert.equal((await (await call(admin, "/api/admin/overview")).json()).administrator.username, "holik");
    assert.equal((await call(applicant, "/api/admin/alist/members")).status, 403);
    assert.equal((await call(applicant, "/api/admin/alist/applications")).status, 403);
    assert.equal((await call(applicant, "/api/admin/alist/applications/fake/decision", "POST", { action: "approve" })).status, 403);
    assert.equal((await call(applicant, "/api/alist/application", "POST", { ...fields, roles: [] })).status, 400);
    assert.equal((await call(applicant, "/api/alist/application", "POST", { ...fields, social: { ...fields.social, instagram: { url: "javascript:alert(1)" } } })).status, 400);
    assert.equal((await call(applicant, "/api/alist/application", "POST", { ...fields, events: ["1", "2", "3", "4"] })).status, 400);
    const submitted = await call(applicant, "/api/alist/application", "POST", fields);
    assert.equal(submitted.status, 201);
    const application = await submitted.json();
    assert.equal(application.status, "pending");
    assert.equal((await snapshot(admin)).aListApplication, null);
    assert.equal((await call(applicant, "/api/alist/application", "POST", fields)).status, 409);
    const list = await (await call(admin, "/api/admin/alist/applications")).json();
    assert.equal(list.applications[0].versions[0].fields.social.instagram.followers, 123);
    const decisionPath = `/api/admin/alist/applications/${application.id}/decision`;
    assert.equal((await call(admin, decisionPath, "POST", { action: "request_information" })).status, 400);
    assert.equal((await call(admin, decisionPath, "POST", { action: "request_information", note: "Please add an event." })).status, 200);
    let state = await snapshot(applicant);
    assert.equal(state.aListApplication.status, "more_information");
    assert.match(state.notifications[0].message, /Please add an event/);
    assert.equal(state.notifications[0].read, false);
    assert.equal((await call(applicant, "/api/notifications/read", "POST")).status, 200);
    assert.equal((await snapshot(applicant)).notifications[0].read, true);
    const minimalFields = { artistName: "Meladee", roles: ["DJ"], djExperience: "10 years" };
    assert.equal((await call(applicant, "/api/alist/application", "POST", minimalFields)).status, 201);
    state = await snapshot(applicant);
    assert.equal(state.aListApplication.versions.length, 2);
    assert.equal(state.aListApplication.status, "pending");
    const minimal = state.aListApplication.versions[1].fields;
    assert.deepEqual(minimal.events, []);
    assert.deepEqual(minimal.supporters, []);
    assert.deepEqual(minimal.labels, []);
    for (const provider of ["instagram", "tiktok", "facebook", "soundcloud"]) {
      assert.deepEqual(minimal.social[provider], { url: "", followers: null });
    }
    socket = openChat(server.baseUrl, applicant);
    await waitForOpen(socket);
    observerSocket = openChat(server.baseUrl, admin);
    await waitForOpen(observerSocket);
    const observerApprovedEvent = waitForMessage(observerSocket, (event) => event.type === "community.snapshot" && event.snapshot.dubs.some((dub) => dub.id === "artist-approval-test" && dub.artistAListApproved && dub.uploaderAListApproved));
    const approvedEvent = waitForMessage(socket, (event) => event.type === "community.snapshot" && event.snapshot.member.aListApproved);
    assert.equal((await call(admin, decisionPath, "POST", { action: "approve", note: "Welcome!" })).status, 200);
    await observerApprovedEvent;
    const approved = (await approvedEvent).snapshot;
    assert.ok(approved.dubs.some((dub) => dub.id === "exclusive"));
    assert.equal((await call(applicant, "/api/dubs/exclusive/audio")).status, 200);
    const upload = await fetch(`${server.baseUrl}/api/uploads?type=audio`, { method: "POST", headers: { cookie: applicant, "x-file-name": "approved.wav", "content-type": "audio/wav" }, body: Buffer.from("audio") });
    const uploadId = (await upload.json()).uploadId;
    assert.equal((await call(applicant, "/api/dubs", "POST", { title: "Approved dub", artistId: approved.artists[0].id, distribution: "alist", uploadId })).status, 201);
    assert.equal((await call(admin, decisionPath, "POST", { action: "approve" })).status, 409);
    const revokedEvent = waitForMessage(socket, (event) => event.type === "community.snapshot" && !event.snapshot.member.aListApproved);
    const observerRevokedEvent = waitForMessage(observerSocket, (event) => event.type === "community.snapshot" && event.snapshot.dubs.some((dub) => dub.id === "artist-approval-test" && !dub.artistAListApproved && !dub.uploaderAListApproved));
    assert.equal((await call(admin, decisionPath, "POST", { action: "revoke", note: "Access revoked." })).status, 200);
    await observerRevokedEvent;
    const revoked = (await revokedEvent).snapshot;
    assert.equal(revoked.dubs.some((dub) => dub.id === "exclusive"), false);
    assert.equal((await call(applicant, "/api/dubs/exclusive/audio")).status, 404);
    assert.equal((await call(applicant, "/api/alist/application", "POST", fields)).status, 201);
    const reapplication = (await snapshot(applicant)).aListApplication;
    assert.notEqual(reapplication.id, application.id);
    assert.equal((await call(admin, decisionPath, "POST", { action: "approve" })).status, 409);
    assert.equal((await call(admin, `/api/admin/alist/applications/${reapplication.id}/decision`, "POST", { action: "reject" })).status, 200);
    socket.close(); await waitForClose(socket); socket = undefined;
    observerSocket.close(); await waitForClose(observerSocket); observerSocket = undefined;
    await server.close();
    server = await startTestServer(directory);
    applicant = await login("meladee");
    admin = await login("holik");
    state = await snapshot(applicant);
    assert.equal(state.aListApplication.status, "rejected");
    assert.equal(state.member.aListApproved, false);
    assert.equal(state.notifications.length, 4);
    assert.equal(state.notifications.filter((item) => !item.read).length, 3);
    assert.equal((await (await call(admin, "/api/admin/alist/applications")).json()).applications.length, 2);
    const approvedMembers = await (await call(admin, "/api/admin/alist/members")).json();
    assert.equal(approvedMembers.members.some((item) => item.username === "holik"), true);
    assert.equal((await call(applicant, "/api/admin/alist/members/user-holik/revoke", "POST", {})).status, 403);
    assert.equal((await call(admin, "/api/admin/alist/members/user-holik/revoke", "POST", { note: "Review" })).status, 200);
    assert.equal((await snapshot(admin)).member.aListApproved, false);
    assert.equal((await snapshot(admin)).notifications[0].read, false);
    assert.equal(JSON.parse(readFileSync(dataPath, "utf8")).aListAccessDecisions.at(-1).administrator, "holik");
    assert.equal((await call(admin, "/api/admin/alist/members/user-holik/revoke", "POST", {})).status, 409);
    const notificationId = state.notifications[0].id;
    assert.equal((await call(admin, `/api/notifications/${notificationId}`, "DELETE")).status, 404);
    assert.equal((await call(applicant, `/api/notifications/${notificationId}`, "DELETE")).status, 200);
    assert.equal((await call(applicant, "/api/notifications", "DELETE")).status, 200);
    assert.equal((await snapshot(applicant)).notifications.length, 0);
    assert.equal((await call(applicant, "/api/alist/application", "POST", fields)).status, 201);
  } finally {
    if (socket) socket.terminate();
    if (observerSocket) observerSocket.terminate();
    await server.close();
    if (oldAdmins === undefined) delete process.env.ADMIN_USERNAMES; else process.env.ADMIN_USERNAMES = oldAdmins;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("share history tracks each sender, friend and changed dub version across restarts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-share-version-"));
  const dataPath = join(directory, "community.json");
  const data = initializeData(dataPath, join(directory, "audio"));
  data.dubs.push({
    id: "versioned", version: 1, title: "Original", artist: "Meladee", artistId: "artist-meladee",
    uploaderId: "user-meladee", uploadedAt: "2026-01-01T00:00:00Z", distribution: "worldwide",
    bpm: 174, tags: ["Jungle"], genre: "Jungle", message: "Hello", duration: "03:00", artwork: "whitelabel",
  });
  writeFileSync(dataPath, JSON.stringify(data));
  let server = await startTestServer(directory);
  const login = async (username) => {
    const response = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: username }),
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const request = (cookie, path, method = "GET", body) => fetch(`${server.baseUrl}${path}`, {
    method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const snapshot = async (cookie) => (await request(cookie, "/api/community")).json();
  try {
    let owner = await login("meladee");
    const recipient = await login("holik");
    await request(owner, "/api/buddies", "POST", { username: "holik" });
    const buddyId = (await snapshot(owner)).buddies.find((buddy) => buddy.username === "holik").id;
    const share = () => request(owner, `/api/conversations/${buddyId}/messages`, "POST", { text: "Listen", dubId: "versioned" });
    assert.deepEqual((await snapshot(owner)).dubs[0].sharedBuddyIds, []);
    assert.equal((await share()).status, 201);
    let ownerSnapshot = await snapshot(owner);
    assert.deepEqual(ownerSnapshot.dubs[0].sharedBuddyIds, [buddyId]);
    assert.deepEqual((await snapshot(recipient)).dubs[0].sharedBuddyIds, []);
    const messageId = ownerSnapshot.conversations[0].messages[0].id;
    assert.equal((await request(owner, `/api/conversations/${buddyId}/messages/${messageId}`, "DELETE")).status, 200);
    assert.deepEqual((await snapshot(owner)).dubs[0].sharedBuddyIds, [buddyId]);
    const fields = { title: "Original", artistId: "artist-meladee", tags: ["Jungle"], bpm: 174, message: "Hello" };
    const unchanged = await (await request(owner, "/api/dubs/versioned", "PATCH", fields)).json();
    assert.equal(unchanged.version, 1);
    assert.deepEqual(unchanged.sharedBuddyIds, [buddyId]);
    const updated = await (await request(owner, "/api/dubs/versioned", "PATCH", { ...fields, title: "Updated" })).json();
    assert.equal(updated.version, 2);
    assert.deepEqual(updated.sharedBuddyIds, []);
    assert.equal((await share()).status, 201);
    const media = await fetch(`${server.baseUrl}/api/uploads?type=audio`, {
      method: "POST", headers: { cookie: owner, "x-file-name": "replacement.wav", "content-type": "application/octet-stream" },
      body: Buffer.from("replacement audio"),
    });
    assert.equal(media.status, 201);
    const replacement = await (await request(owner, "/api/dubs/versioned", "PATCH", { ...fields, title: "Updated", uploadId: (await media.json()).uploadId })).json();
    assert.equal(replacement.version, 3);
    assert.deepEqual(replacement.sharedBuddyIds, []);
    assert.equal((await share()).status, 201);
    await server.close();
    server = await startTestServer(directory);
    owner = await login("meladee");
    ownerSnapshot = await snapshot(owner);
    assert.equal(ownerSnapshot.dubs[0].version, 3);
    assert.deepEqual(ownerSnapshot.dubs[0].sharedBuddyIds, [buddyId]);
    assert.equal((await request(owner, "/api/dubs/versioned", "DELETE")).status, 200);
    assert.deepEqual(JSON.parse(readFileSync(dataPath, "utf8")).dubShares, []);
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("received share history includes accessible dubs of every distribution and legacy shares", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-received-shares-"));
  const dataPath = join(directory, "community.json");
  const data = initializeData(dataPath, join(directory, "audio"));
  data.users.find((user) => user.username === "holik").aListApproved = true;
  for (const [id, distribution, uploader] of [
    ["world", "worldwide", "meladee"], ["alist", "alist", "meladee"],
    ["private", "private", "meladee"], ["legacy", "worldwide", "meladee"],
    ["own", "worldwide", "holik"], ["unshared", "worldwide", "meladee"],
    ["no-access", "private", "meladee"], ["outgoing", "worldwide", "holik"],
  ]) {
    data.dubs.push({ id, title: id, artist: uploader, artistId: `artist-${uploader}`,
      uploaderId: `user-${uploader}`, uploader, uploaderDisplayName: uploader,
      distribution, uploadedAt: "2026-01-01T00:00:00Z", version: 2, bpm: 0,
      genre: "Jungle", duration: "00:00", artwork: "whitelabel", message: "" });
  }
  data.dubShares.push(
    ...["world", "alist", "private", "own", "no-access", "deleted"].map((dubId) => ({ dubId, senderId: "user-meladee", recipientId: "user-holik", version: 1 })),
    { dubId: "world", senderId: "someone-else", recipientId: "user-holik", version: 2 },
    { dubId: "outgoing", senderId: "user-holik", recipientId: "user-meladee", version: 2 },
  );
  data.dubGrants.push({ dubId: "private", userId: "user-holik" });
  data.conversations.push({ id: "legacy-conversation", ownerId: "user-holik", buddyId: "legacy-buddy", messages: [
    { id: "old-share", sender: "them", dubId: "legacy", text: "Shared", sentAt: "2020-01-01T00:00:00Z" },
    ...Array.from({ length: 31 }, (_, index) => ({ id: `message-${index}`, sender: "you", text: "Hello", sentAt: "2021-01-01T00:00:00Z" })),
  ] });
  writeFileSync(dataPath, JSON.stringify(data));
  let server = await startTestServer(directory);
  const login = async (username) => {
    const response = await fetch(`${server.baseUrl}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: username }) });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const snapshot = async (cookie) => (await fetch(`${server.baseUrl}/api/community`, { headers: { cookie } })).json();
  try {
    let recipient = await login("holik");
    const owner = await login("meladee");
    const before = await snapshot(recipient);
    assert.deepEqual(new Set(before.sharedDubIds), new Set(["world", "alist", "private", "legacy", "own"]));
    assert.equal(before.conversations.find((conversation) => conversation.buddyId === "legacy-buddy").messages.some((message) => message.id === "old-share"), false);
    assert.equal(before.sharedDubIds.length, 5);
    const revoke = await fetch(`${server.baseUrl}/api/dubs/private/grants/user-holik`, { method: "DELETE", headers: { cookie: owner } });
    assert.equal(revoke.status, 200);
    assert.equal((await snapshot(recipient)).sharedDubIds.includes("private"), false);
    await server.close();
    server = await startTestServer(directory);
    recipient = await login("holik");
    assert.deepEqual(new Set((await snapshot(recipient)).sharedDubIds), new Set(["world", "alist", "legacy", "own"]));
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("A-List public visibility and sharing with approved non-friends", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-alist-public-"));
  const dataPath = join(directory, "community.json");
  const data = initializeData(dataPath, join(directory, "audio"));
  for (const username of ["holik", "meladee"]) data.users.find((user) => user.username === username).aListApproved = true;
  writeFileSync(dataPath, JSON.stringify(data));
  let server = await startTestServer(directory);
  const login = async (username, password = username) => {
    const response = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const request = (cookie, path, method = "GET", body, headers = {}) => fetch(`${server.baseUrl}${path}`, {
    method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const snapshot = async (cookie) => (await request(cookie, "/api/community")).json();
  try {
    let owner = await login("holik");
    let approved = await login("meladee");
    let outsider = await registerAccount(server.baseUrl, "outsider");
    const ownerProfile = await snapshot(owner);
    const approvedId = (await snapshot(approved)).member.id;
    const outsiderId = (await snapshot(outsider)).member.id;
    const media = await fetch(`${server.baseUrl}/api/uploads?type=audio`, {
      method: "POST", headers: { cookie: owner, "x-file-name": "track.wav", "content-type": "application/octet-stream" },
      body: Buffer.from("audio data"),
    });
    const uploadId = (await media.json()).uploadId;
    const fields = { title: "Exclusive", artistId: ownerProfile.artists[0].id, tags: [], bpm: 0, message: "" };
    assert.equal((await request(owner, "/api/dubs", "POST", { ...fields, uploadId, distribution: "worldwide", aListPublic: true })).status, 400);
    assert.equal((await request(owner, "/api/dubs", "POST", { ...fields, uploadId, distribution: "alist", aListPublic: "true" })).status, 400);
    const publicMedia = await fetch(`${server.baseUrl}/api/uploads?type=audio`, {
      method: "POST", headers: { cookie: owner, "x-file-name": "public.wav", "content-type": "application/octet-stream" },
      body: Buffer.from("audio data"),
    });
    const publicUploadId = (await publicMedia.json()).uploadId;
    const createdPublic = await request(owner, "/api/dubs", "POST", { ...fields, title: "Public A-List", uploadId: publicUploadId, distribution: "alist", aListPublic: true });
    assert.equal(createdPublic.status, 201);
    const publicDub = await createdPublic.json();
    assert.equal(publicDub.aListPublic, true);
    assert.ok((await snapshot(outsider)).dubs.some((item) => item.id === publicDub.id));
    const created = await request(owner, "/api/dubs", "POST", { ...fields, uploadId, distribution: "alist" });
    assert.equal(created.status, 201);
    const dub = await created.json();
    assert.equal(dub.aListPublic, false);
    const sharePath = `/api/dubs/${dub.id}/share-member`;
    assert.equal((await request(owner, sharePath, "POST", { userId: outsiderId, text: "Listen" })).status, 404);
    assert.equal((await request(owner, sharePath, "POST", { userId: approvedId, text: "" })).status, 400);
    assert.equal((await snapshot(owner)).buddies.some((buddy) => buddy.userId === outsiderId || buddy.userId === approvedId), false);
    const delivery = await request(owner, sharePath, "POST", { userId: approvedId, text: "Listen" });
    assert.equal(delivery.status, 201);
    const { buddyId, snapshot: delivered } = await delivery.json();
    assert.ok(delivered.buddies.some((buddy) => buddy.id === buddyId && buddy.userId === approvedId));
    assert.ok((await snapshot(approved)).conversations.some((conversation) => conversation.messages.some((message) => message.dubId === dub.id)));
    assert.ok((await snapshot(approved)).sharedDubIds.includes(dub.id));
    assert.deepEqual(delivered.dubs.find((item) => item.id === dub.id).sharedBuddyIds, [buddyId]);
    assert.equal((await request(outsider, `/api/dubs/${dub.id}/audio`)).status, 404);
    assert.equal((await request(owner, `/api/dubs/${dub.id}`, "PATCH", { ...fields, aListPublic: "true" })).status, 400);
    let changed = await (await request(owner, `/api/dubs/${dub.id}`, "PATCH", { ...fields, aListPublic: true })).json();
    assert.equal(changed.aListPublic, true);
    assert.equal(changed.version, dub.version + 1);
    assert.deepEqual(changed.sharedBuddyIds, []);
    assert.ok((await snapshot(outsider)).dubs.some((item) => item.id === dub.id));
    assert.ok((await (await request(outsider, "/api/dubs/search?distribution=feed&distributionType=alist")).json()).dubs.some((item) => item.id === dub.id));
    assert.equal((await request(outsider, "/api/dubs/search?distribution=alist")).status, 403);
    assert.equal((await request(outsider, `/api/dubs/${dub.id}/audio`, "GET", undefined, { range: "bytes=0-2" })).status, 206);
    assert.equal((await request(owner, sharePath, "POST", { userId: outsiderId, text: "Listen" })).status, 404);
    const added = await (await request(owner, "/api/buddies", "POST", { username: "outsider" })).json();
    const outsiderBuddy = added.buddies.find((buddy) => buddy.userId === outsiderId).id;
    assert.equal((await request(owner, `/api/conversations/${outsiderBuddy}/messages`, "POST", { text: "Listen", dubId: dub.id })).status, 201);
    assert.equal((await request(outsider, "/api/playback", "PUT", { dubId: dub.id, positionSeconds: 2 })).status, 200);
    await server.close();
    server = await startTestServer(directory);
    owner = await login("holik");
    approved = await login("meladee");
    outsider = await login("outsider", "long-enough-password");
    assert.equal((await snapshot(owner)).dubs.find((item) => item.id === dub.id).aListPublic, true);
    changed = await (await request(owner, `/api/dubs/${dub.id}`, "PATCH", { ...fields, aListPublic: false })).json();
    assert.equal(changed.version, dub.version + 2);
    const after = await snapshot(outsider);
    assert.equal(after.dubs.some((item) => item.id === dub.id), false);
    assert.equal(after.sharedDubIds.includes(dub.id), false);
    assert.equal(after.lastPlayback, null);
    assert.ok(after.conversations.some((conversation) => conversation.messages.some((message) => message.text === "This dub is no longer available." && !message.dubId)));
    assert.equal((await request(outsider, `/api/dubs/${dub.id}/audio`)).status, 404);
    assert.equal((await request(owner, `/api/conversations/${outsiderBuddy}/messages`, "POST", { text: "Listen", dubId: dub.id })).status, 404);
    assert.ok((await snapshot(approved)).dubs.some((item) => item.id === dub.id));
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("distribution permissions protect discovery, media, messaging and revocation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-distribution-"));
  const dataPath = join(directory, "community.json");
  const data = initializeData(dataPath, join(directory, "audio"));
  data.users.find((user) => user.username === "holik").aListApproved = true;
  writeFileSync(dataPath, JSON.stringify(data));
  let server = await startTestServer(directory);
  let socket;
  const login = async (username) => {
    const response = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: username }),
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const request = (cookie, path, method = "GET", body, extraHeaders = {}) => fetch(`${server.baseUrl}${path}`, {
    method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}), ...extraHeaders },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const snapshot = async (cookie) => (await request(cookie, "/api/community")).json();
  const upload = async (cookie, type, filename) => {
    const response = await fetch(`${server.baseUrl}/api/uploads?type=${type}`, {
      method: "POST", headers: { cookie, "x-file-name": filename, "content-type": "application/octet-stream" },
      body: Buffer.from("test media bytes"),
    });
    assert.equal(response.status, 201);
    return (await response.json()).uploadId;
  };
  try {
    const owner = await login("meladee");
    let approved = await login("holik");
    const outsider = await registerAccount(server.baseUrl, "outsider");
    const ownerProfile = await snapshot(owner);
    const approvedProfile = await snapshot(approved);
    assert.equal(ownerProfile.suggestedMembers.find((member) => member.username === "holik").aListApproved, true);
    const suggestedProfile = ownerProfile.suggestedMembers.find((member) => member.username === "holik");
    assert.equal(suggestedProfile.id, approvedProfile.member.id);
    assert.equal(suggestedProfile.role, approvedProfile.member.role);
    assert.equal(suggestedProfile.bio, approvedProfile.member.bio);
    assert.deepEqual(suggestedProfile.groups, []);
    assert.equal(suggestedProfile.passwordHash, undefined);
    assert.equal((await (await request(owner, "/api/members?q=holik")).json()).members[0].aListApproved, true);
    const makeDub = async (cookie, artistId, distribution, title) => {
      const uploadId = await upload(cookie, "audio", `${title}.wav`);
      const artworkUploadId = await upload(cookie, "artwork", `${title}.png`);
      const response = await request(cookie, "/api/dubs", "POST", { title, artistId, uploadId, artworkUploadId, distribution });
      assert.equal(response.status, 201);
      return response.json();
    };
    const privateDub = await makeDub(owner, ownerProfile.artists[0].id, "private", "Secret");
    const publicDub = await makeDub(owner, ownerProfile.artists[0].id, "worldwide", "Public");
    const exclusiveDub = await makeDub(approved, approvedProfile.artists[0].id, "alist", "Exclusive");
    assert.equal((await request(owner, "/api/dubs", "POST", { distribution: "alist" })).status, 403);
    assert.equal((await request(owner, "/api/dubs", "POST", { distribution: "invalid" })).status, 400);
    assert.equal((await request(owner, `/api/dubs/${privateDub.id}`, "PATCH", { distribution: "worldwide" })).status, 400);
    assert.equal((await request(owner, "/api/profile", "PATCH", { aListApproved: true })).status, 200);
    assert.equal((await snapshot(owner)).member.aListApproved, false);
    for (const cookie of [owner, outsider]) {
      const community = await snapshot(cookie);
      assert.equal(community.dubs.some((dub) => dub.id === exclusiveDub.id), false);
      assert.equal((await request(cookie, `/api/dubs/${exclusiveDub.id}/audio`, "GET", undefined, { range: "bytes=0-2" })).status, 404);
      assert.equal((await request(cookie, `/api/dubs/${exclusiveDub.id}/artwork`)).status, 404);
      assert.equal((await request(cookie, "/api/dubs/search?distribution=alist")).status, 403);
    }
    assert.equal((await request(approved, `/api/dubs/${exclusiveDub.id}/audio`, "GET", undefined, { range: "bytes=0-2" })).status, 206);
    assert.equal((await request(approved, "/api/dubs/search?distribution=alist")).status, 200);
    assert.deepEqual((await (await request(approved, "/api/dubs/search")).json()).dubs.map((dub) => dub.id), [publicDub.id]);
    const feedIds = async (cookie, query = "") => (await (await request(cookie, `/api/dubs/search?distribution=feed${query}`)).json()).dubs.map((dub) => dub.id);
    assert.deepEqual(new Set(await feedIds(approved)), new Set([publicDub.id, exclusiveDub.id]));
    assert.deepEqual(await feedIds(owner), [publicDub.id]);
    assert.deepEqual(await feedIds(outsider), [publicDub.id]);
    assert.deepEqual(await feedIds(approved, "&q=Exclusive"), [exclusiveDub.id]);
    assert.deepEqual(await feedIds(owner, "&q=Exclusive"), []);
    assert.deepEqual(await feedIds(approved, "&q=Secret"), []);
    assert.deepEqual(await feedIds(owner, "&distributionType=private"), [privateDub.id]);
    assert.deepEqual(new Set(await feedIds(owner, "&distributionType=private&distributionType=worldwide")), new Set([privateDub.id, publicDub.id]));
    assert.deepEqual(await feedIds(outsider, "&distributionType=private"), []);
    assert.deepEqual(await feedIds(owner, "&distributionType=alist"), []);
    assert.deepEqual(await feedIds(approved, "&distributionType=alist"), [exclusiveDub.id]);
    assert.equal((await request(owner, "/api/dubs/search?distribution=feed&distributionType=invalid")).status, 400);
    assert.equal((await request(owner, "/api/dubs/search?distributionType=private")).status, 400);
    assert.equal((await snapshot(outsider)).dubs.some((dub) => dub.id === privateDub.id), false);
    assert.equal((await request(outsider, `/api/dubs/${privateDub.id}/audio`)).status, 404);
    assert.equal((await request(outsider, `/api/dubs/${privateDub.id}/artwork`)).status, 404);
    assert.equal((await request(outsider, `/api/dubs/${privateDub.id}/download`, "POST")).status, 404);
    assert.equal((await request(outsider, "/api/playback", "PUT", { dubId: privateDub.id, positionSeconds: 1 })).status, 404);
    const crate = await (await request(outsider, "/api/crates", "POST", { name: "Test" })).json();
    assert.equal((await request(outsider, `/api/crates/${crate.id}/dubs/${privateDub.id}`, "PUT")).status, 404);

    await request(owner, "/api/buddies", "POST", { username: "outsider" });
    await request(outsider, "/api/buddies", "POST", { username: "holik" });
    const ownerBuddy = (await snapshot(owner)).buddies.find((buddy) => buddy.username === "outsider");
    const outsiderBuddy = (await snapshot(outsider)).buddies.find((buddy) => buddy.username === "holik");
    const approvedBuddy = (await snapshot(approved)).buddies.find((buddy) => buddy.username === "outsider");
    assert.equal((await snapshot(outsider)).buddies.find((buddy) => buddy.username === "holik").aListApproved, true);
    const deniedShare = await request(approved, `/api/conversations/${approvedBuddy.id}/messages`, "POST", { text: "Exclusive", dubId: exclusiveDub.id });
    assert.equal(deniedShare.status, 404);
    assert.match((await deniedShare.json()).error, /approved A-List members/);
    socket = openChat(server.baseUrl, outsider);
    await waitForOpen(socket);
    const grantedEvent = waitForMessage(socket, (event) => event.type === "community.snapshot" && event.snapshot.dubs.some((dub) => dub.id === privateDub.id));
    assert.equal((await request(owner, `/api/conversations/${ownerBuddy.id}/messages`, "POST", { text: "Shared a dub: Secret", dubId: privateDub.id })).status, 201);
    await grantedEvent;
    assert.ok((await snapshot(outsider)).sharedDubIds.includes(privateDub.id));
    assert.deepEqual(await feedIds(outsider, "&distributionType=private&q=Secret"), [privateDub.id]);
    assert.equal((await request(outsider, `/api/dubs/${privateDub.id}/audio`, "GET", undefined, { range: "bytes=0-2" })).status, 206);
    assert.equal((await request(outsider, `/api/dubs/${privateDub.id}/artwork`)).status, 200);
    assert.equal((await (await request(outsider, "/api/dubs/search?q=Secret")).json()).dubs.length, 0);
    assert.equal((await request(outsider, `/api/dubs/${privateDub.id}/download`, "POST")).status, 200);
    const ownerPrivate = (await snapshot(owner)).dubs.find((dub) => dub.id === privateDub.id);
    assert.equal(ownerPrivate.downloaders[0].username, "outsider");
    assert.equal(ownerPrivate.downloaders[0].aListApproved, false);
    assert.equal((await request(outsider, "/api/playback", "PUT", { dubId: privateDub.id, positionSeconds: 1 })).status, 200);
    assert.equal((await request(outsider, `/api/crates/${crate.id}/dubs/${privateDub.id}`, "PUT")).status, 200);
    assert.equal((await request(outsider, `/api/conversations/${outsiderBuddy.id}/messages`, "POST", { text: "Forward", dubId: privateDub.id })).status, 404);
    assert.equal((await request(owner, `/api/conversations/${ownerBuddy.id}/messages`, "POST", { text: "Shared again", dubId: privateDub.id })).status, 201);
    const recipientId = (await snapshot(outsider)).member.id;
    assert.equal((await request(outsider, `/api/dubs/${privateDub.id}/grants/${recipientId}`, "DELETE")).status, 404);
    const grants = (await snapshot(owner)).dubs.find((dub) => dub.id === privateDub.id).grants;
    assert.equal(grants.length, 1);
    assert.equal(grants[0].id, recipientId);
    const revokedEvent = waitForMessage(socket, (event) => event.type === "community.snapshot" && !event.snapshot.dubs.some((dub) => dub.id === privateDub.id));
    assert.equal((await request(owner, `/api/dubs/${privateDub.id}/grants/${recipientId}`, "DELETE")).status, 200);
    const revoked = (await revokedEvent).snapshot;
    assert.equal(revoked.sharedDubIds.includes(privateDub.id), false);
    assert.deepEqual(await feedIds(outsider, "&distributionType=private"), []);
    assert.equal(revoked.lastPlayback, null);
    assert.equal(revoked.library.some((item) => item.dub.id === privateDub.id), false);
    assert.equal(revoked.crates[0].dubIds.includes(privateDub.id), false);
    assert.equal(revoked.conversations.find((conversation) => conversation.buddyId === (revoked.buddies.find((buddy) => buddy.username === "meladee")).id).messages[0].text, "This dub is no longer available.");
    assert.equal((await request(outsider, `/api/dubs/${privateDub.id}/audio`)).status, 404);
    const ownerBuddyFromOutsider = revoked.buddies.find((buddy) => buddy.username === "meladee");
    const history = await (await request(outsider, `/api/conversations/${ownerBuddyFromOutsider.id}/messages`)).json();
    assert.equal(history.messages[0].dubId, undefined);
    assert.equal(history.messages[0].text, "This dub is no longer available.");
    const publicShare = await request(outsider, `/api/conversations/${outsiderBuddy.id}/messages`, "POST", { text: "Have a listen", dubId: publicDub.id });
    assert.equal(publicShare.status, 201);
    const receivedPublic = (await snapshot(approved)).conversations.find((conversation) => conversation.buddyId === approvedBuddy.id).messages.at(-1);
    assert.equal(receivedPublic.text, "Have a listen");
    assert.equal(receivedPublic.dubId, publicDub.id);
    socket.close();
    await waitForClose(socket);
    socket = undefined;
    await server.close();
    const persisted = JSON.parse(readFileSync(dataPath, "utf8"));
    persisted.users.find((user) => user.username === "holik").aListApproved = false;
    writeFileSync(dataPath, JSON.stringify(persisted));
    server = await startTestServer(directory);
    approved = await login("holik");
    assert.equal((await snapshot(approved)).dubs.some((dub) => dub.id === exclusiveDub.id), false);
    assert.equal((await request(approved, `/api/dubs/${exclusiveDub.id}/audio`)).status, 404);
    const outsiderLogin = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "outsider", password: "long-enough-password" }),
    });
    const newOutsider = outsiderLogin.headers.get("set-cookie").split(";")[0];
    assert.equal((await request(newOutsider, `/api/dubs/${privateDub.id}/audio`)).status, 404);
  } finally {
    if (socket) socket.terminate();
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v2 migration removes only built-in dubs and their activity", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-v2-migration-"));
  const dataPath = join(directory, "community.json");
  const retainedMediaPath = join(directory, "audio", "uploaded.wav");
  mkdirSync(join(directory, "audio"), { recursive: true });
  writeFileSync(retainedMediaPath, "user audio");
  writeFileSync(dataPath, JSON.stringify({
    schemaVersion: 2,
    users: [{ id: "user-meladee", username: "meladee" }],
    artists: [{ id: "artist-meladee", userId: "user-meladee" }],
    dubs: [
      ...[
        "dub-coffeeshop",
        "dub-miller",
        "dub-ozone",
        "dub-phoenix",
        "dub-wizard",
        "dub-jungle-tunes",
        "dub-ketterings-kitchen",
        "dub-renegade",
      ].map((id) => ({ id, audioSource: "seed" })),
      { id: "uploaded-dub", audioSource: "upload", storedAudioName: "uploaded.wav" },
    ],
    friendships: [],
    conversations: [],
    likes: [
      { userId: "user-meladee", dubId: "dub-coffeeshop" },
      { userId: "user-meladee", dubId: "uploaded-dub" },
    ],
    downloads: [
      { userId: "user-meladee", dubId: "dub-coffeeshop" },
      { userId: "user-meladee", dubId: "dub-renegade" },
    ],
    crates: [{
      id: "crate",
      dubIds: ["dub-coffeeshop", "dub-renegade", "uploaded-dub"],
    }],
    uploads: [],
  }));
  let server = await startTestServer(directory);

  try {
    const migrated = JSON.parse(readFileSync(dataPath, "utf8"));
    assert.equal(migrated.schemaVersion, 7);
    assert.equal(migrated.dubs[0].distribution, "worldwide");
    assert.deepEqual(migrated.dubs.map((dub) => dub.id), ["uploaded-dub"]);
    assert.deepEqual(migrated.likes.map((like) => like.dubId), ["uploaded-dub"]);
    assert.deepEqual(migrated.downloads, []);
    assert.deepEqual(migrated.crates[0].dubIds, ["uploaded-dub"]);
    assert.equal(readFileSync(retainedMediaPath, "utf8"), "user audio");

    await server.close();
    server = await startTestServer(directory);
    const persisted = JSON.parse(readFileSync(dataPath, "utf8"));
    assert.equal(persisted.schemaVersion, 7);
    assert.deepEqual(persisted.dubs.map((dub) => dub.id), ["uploaded-dub"]);
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("initializes existing one-way friendships as bidirectional relationships", () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-friendship-migration-"));
  const dataPath = join(directory, "community.json");
  const mediaDirectory = join(directory, "audio");

  try {
    const data = initializeData(dataPath, mediaDirectory);
    const alice = data.users.find((user) => user.username === "meladee");
    const bob = data.users.find((user) => user.username === "holik");
    data.friendships.push({
      id: "legacy-alice-to-bob",
      ownerId: alice.id,
      friendUserId: bob.id,
      presence: bob.presence,
      genre: bob.genre,
      role: bob.role,
      bio: bob.bio,
      groups: ["Friends"],
      unread: 0,
    });
    writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);

    const migrated = initializeData(dataPath, mediaDirectory);
    assert.equal(migrated.friendships.length, 2);
    assert.ok(migrated.friendships.some((item) => item.ownerId === alice.id && item.friendUserId === bob.id));
    assert.ok(migrated.friendships.some((item) => item.ownerId === bob.id && item.friendUserId === alice.id));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("authenticated chat delivers persisted messages to the recipient and closes sockets on logout", async () => {
  const server = await startTestServer();
  const aliceCookie = await registerAccount(server.baseUrl, "alice");
  const bobCookie = await registerAccount(server.baseUrl, "bobby");
  const aliceSocket = openChat(server.baseUrl, aliceCookie, "http://localhost:5173");
  const bobSocket = openChat(server.baseUrl, bobCookie, "http://localhost:5173");
  const aliceConnected = waitForMessage(aliceSocket, (event) => event.type === "connected");
  const bobConnected = waitForMessage(bobSocket, (event) => event.type === "connected");

  try {
    await Promise.all([waitForOpen(aliceSocket), waitForOpen(bobSocket)]);
    assert.equal((await aliceConnected).type, "connected");
    assert.equal((await bobConnected).type, "connected");

    const bobFriendAdded = waitForMessage(
      bobSocket,
      (event) => event.type === "community.snapshot" &&
        event.snapshot.buddies.some((buddy) => buddy.username === "alice"),
    );
    const addBuddy = await fetch(`${server.baseUrl}/api/buddies`, {
      method: "POST",
      headers: { cookie: aliceCookie, "content-type": "application/json" },
      body: JSON.stringify({ username: "bobby" }),
    });
    const aliceSnapshot = await addBuddy.json();
    const friendship = aliceSnapshot.buddies.find((buddy) => buddy.username === "bobby");
    assert.ok(friendship);
    assert.ok((await bobFriendAdded).snapshot.buddies.some((buddy) => buddy.username === "alice"));

    const duplicateAdd = await fetch(`${server.baseUrl}/api/buddies`, {
      method: "POST",
      headers: { cookie: bobCookie, "content-type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });
    assert.equal((await duplicateAdd.json()).buddies.filter((buddy) => buddy.username === "alice").length, 1);
    const aliceAfterDuplicateAdd = await fetch(`${server.baseUrl}/api/community`, {
      headers: { cookie: aliceCookie },
    }).then((response) => response.json());
    assert.equal(
      aliceAfterDuplicateAdd.buddies.filter((buddy) => buddy.username === "bobby").length,
      1,
    );

    const messageEvent = waitForMessage(
      bobSocket,
      (event) => event.type === "community.snapshot" &&
        event.snapshot.conversations.some((conversation) =>
          conversation.messages.some((message) => message.text === "Hello in real time"),
        ),
    );
    const messageResponse = await fetch(
      `${server.baseUrl}/api/conversations/${friendship.id}/messages`,
      {
        method: "POST",
        headers: { cookie: aliceCookie, "content-type": "application/json" },
        body: JSON.stringify({ text: "Hello in real time" }),
      },
    );
    assert.equal(messageResponse.status, 201);
    assert.ok((await messageResponse.json()).conversations[0].messages
      .some((message) => message.text === "Hello in real time"));

    const delivered = await messageEvent;
    const bobConversation = delivered.snapshot.conversations.find(
      (conversation) => conversation.messages.some((message) => message.text === "Hello in real time"),
    );
    assert.equal(
      bobConversation.messages.find((message) => message.text === "Hello in real time").sender,
      "them",
    );
    assert.equal(delivered.snapshot.buddies[0].unread, 1);
    const bobFriendshipId = delivered.snapshot.buddies[0].id;
    const markRead = await fetch(
      `${server.baseUrl}/api/conversations/${bobFriendshipId}/read`,
      { method: "POST", headers: { cookie: bobCookie } },
    );
    assert.equal(markRead.status, 200);
    assert.equal((await markRead.json()).buddies[0].unread, undefined);

    const removeFriend = await fetch(`${server.baseUrl}/api/buddies/${friendship.id}`, {
      method: "DELETE",
      headers: { cookie: aliceCookie },
    });
    assert.equal(removeFriend.status, 200);
    assert.deepEqual((await removeFriend.json()).buddies, []);
    const bobbyAfterRemoval = await fetch(`${server.baseUrl}/api/community`, {
      headers: { cookie: bobCookie },
    }).then((response) => response.json());
    assert.deepEqual(bobbyAfterRemoval.buddies, []);
    assert.deepEqual(bobbyAfterRemoval.conversations, []);

    const logoutClosed = waitForClose(aliceSocket);
    const logout = await fetch(`${server.baseUrl}/api/logout`, {
      method: "POST",
      headers: { cookie: aliceCookie },
    });
    assert.equal(logout.status, 200);
    await logoutClosed;
    assert.equal(bobSocket.readyState, WebSocket.OPEN);
  } finally {
    aliceSocket.close();
    bobSocket.close();
    await Promise.all([waitForClose(aliceSocket), waitForClose(bobSocket)]);
    await server.close();
    rmSync(server.directory, { recursive: true, force: true });
  }
});

test("chat WebSocket requires authentication and rejects untrusted browser origins", async () => {
  const server = await startTestServer();
  const unauthenticatedSocket = openChat(server.baseUrl);
  const unauthenticatedResponse = waitForUpgradeStatus(unauthenticatedSocket);
  const cookie = await registerAccount(server.baseUrl, "origincheck");
  const foreignOriginSocket = openChat(
    server.baseUrl,
    cookie,
    "https://attacker.example",
  );
  const foreignOriginResponse = waitForUpgradeStatus(foreignOriginSocket);
  try {
    assert.equal(await unauthenticatedResponse, 401);
    assert.equal(await foreignOriginResponse, 401);
  } finally {
    unauthenticatedSocket.terminate();
    foreignOriginSocket.terminate();
    await server.close();
    rmSync(server.directory, { recursive: true, force: true });
  }
});
