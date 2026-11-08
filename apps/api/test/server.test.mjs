import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import WebSocket from "ws";
import { createApiServer } from "../src/server.mjs";

async function startTestServer(directory = mkdtempSync(join(tmpdir(), "cre8-api-")), webDirectory) {
  const server = createApiServer({
    dataPath: join(directory, "community.json"),
    mediaDirectory: join(directory, "audio"),
    publicAudioDirectory: join(directory, "seed-audio"),
    webDirectory,
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
        uploadId,
        artworkUploadId,
      }),
    });
    assert.equal(dubResponse.status, 201);
    const newDub = await dubResponse.json();
    assert.equal(newDub.artistId, "artist-meladee");
    assert.equal(newDub.artwork, "uploaded-artwork");
    assert.deepEqual(newDub.tags, ["Jungle", "Rollers"]);
    assert.match(newDub.artworkUrl, new RegExp(`/api/dubs/${newDub.id}/artwork`));
    assert.ok(Number.isFinite(Date.parse(newDub.uploadedAt)));
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
    assert.ok(restored.dubs.some((item) => item.id === newDub.id && item.likes === 2 && item.downloads === 3));
    const restoredImage = await fetch(`${server.baseUrl}${newDub.artworkUrl}`, {
      headers: { cookie: secondCookie },
    });
    assert.equal(restoredImage.status, 200);
    assert.ok(restored.crates.some((item) => item.id === crate.id && item.dubIds.includes(newDub.id)));
    assert.ok(restored.conversations[0].messages.some((message) => message.text === "Persistent message"));
  } finally {
    await server.close();
    rmSync(server.directory, { recursive: true, force: true });
  }
});

test("legacy demo database is reset once to the two requested artists and no tracks", async () => {
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
  let server = await startTestServer(directory);

  try {
    const cleanData = JSON.parse(readFileSync(dataPath, "utf8"));
    assert.deepEqual(cleanData.users.map((user) => user.username).sort(), ["holik", "meladee"]);
    assert.deepEqual(cleanData.artists.map((artist) => artist.id).sort(), ["artist-holik", "artist-meladee"]);
    assert.deepEqual(cleanData.dubs, []);
    for (const name of staleMediaNames) assert.equal(existsSync(join(mediaDirectory, name)), false);

    for (const [username, password] of [["meladee", "meladee"], ["holik", "holik"]]) {
      const login = await fetch(`${server.baseUrl}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie").split(";")[0];
      const snapshot = await fetch(`${server.baseUrl}/api/community`, {
        headers: { cookie },
      }).then((response) => response.json());
      assert.equal(snapshot.member.username, username);
      assert.equal(snapshot.artists.length, 1);
    }

    const registration = await registerAccount(server.baseUrl, "newartist");
    assert.ok(registration);
    await server.close();
    server = await startTestServer(directory);
    const persistedData = JSON.parse(readFileSync(dataPath, "utf8"));
    assert.ok(persistedData.users.some((user) => user.username === "newartist"));
    assert.deepEqual(persistedData.dubs, []);
  } finally {
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
    assert.equal(migrated.schemaVersion, 3);
    assert.deepEqual(migrated.dubs.map((dub) => dub.id), ["uploaded-dub"]);
    assert.deepEqual(migrated.likes.map((like) => like.dubId), ["uploaded-dub"]);
    assert.deepEqual(migrated.downloads, []);
    assert.deepEqual(migrated.crates[0].dubIds, ["uploaded-dub"]);
    assert.equal(readFileSync(retainedMediaPath, "utf8"), "user audio");

    await server.close();
    server = await startTestServer(directory);
    const persisted = JSON.parse(readFileSync(dataPath, "utf8"));
    assert.equal(persisted.schemaVersion, 3);
    assert.deepEqual(persisted.dubs.map((dub) => dub.id), ["uploaded-dub"]);
  } finally {
    await server.close();
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

    const addBuddy = await fetch(`${server.baseUrl}/api/buddies`, {
      method: "POST",
      headers: { cookie: aliceCookie, "content-type": "application/json" },
      body: JSON.stringify({ username: "bobby" }),
    });
    const aliceSnapshot = await addBuddy.json();
    const friendship = aliceSnapshot.buddies.find((buddy) => buddy.username === "bobby");
    assert.ok(friendship);

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
