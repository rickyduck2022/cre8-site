import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createApiServer } from "../src/server.mjs";

async function startServer() {
  const directory = resolve("apps/api/data", `.pack-test-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  const server = createApiServer({
    dataPath: join(directory, "community.json"),
    mediaDirectory: join(directory, "audio"),
    publicAudioDirectory: join(directory, "seed-audio"),
    webDirectory: join(directory, "web"),
    adminDirectory: join(directory, "admin"),
    guidesDirectory: join(directory, "guides"),
    pushService: null,
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return {
    server,
    directory,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolveClose, rejectClose) =>
      server.close((error) => error ? rejectClose(error) : resolveClose())),
  };
}

async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

async function register(baseUrl, username) {
  const response = await fetch(`${baseUrl}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      displayName: "Pack Recipient",
      genre: "Garage",
      password: "long-enough-password",
    }),
  });
  assert.equal(response.status, 201);
  return response.headers.get("set-cookie").split(";")[0];
}

async function api(baseUrl, cookie, path, method = "GET", body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response;
}

async function uploadAudio(baseUrl, cookie, name = "sample.mp3") {
  const response = await fetch(`${baseUrl}/api/uploads`, {
    method: "POST",
    headers: { cookie, "x-file-name": name, "content-type": "audio/mpeg" },
    body: Buffer.from("safe audio fixture"),
  });
  assert.equal(response.status, 201);
  return (await response.json()).uploadId;
}

async function uploadArtwork(baseUrl, cookie) {
  const response = await fetch(`${baseUrl}/api/uploads?type=artwork`, {
    method: "POST",
    headers: { cookie, "x-file-name": "cover.png", "content-type": "image/png" },
    body: Buffer.from("pack cover fixture"),
  });
  assert.equal(response.status, 201);
  return (await response.json()).uploadId;
}

test("packs publish, authorize members, retain independent dub grants and stream safe archives", async () => {
  const context = await startServer();
  try {
    const ownerCookie = await login(context.baseUrl, "meladee", "meladee");
    const recipientCookie = await register(context.baseUrl, `pack-friend-${randomUUID().slice(0, 8)}`);
    const ownerSnapshot = await (await api(context.baseUrl, ownerCookie, "/api/community")).json();
    const artistId = ownerSnapshot.artists[0].id;
    const buddyResponse = await api(context.baseUrl, ownerCookie, "/api/buddies", "POST", {
      username: (await (await api(context.baseUrl, recipientCookie, "/api/community")).json()).member.username,
    });
    assert.equal(buddyResponse.status, 200);
    const buddyId = (await buddyResponse.json()).buddies[0].id;

    const createdResponse = await api(context.baseUrl, ownerCookie, "/api/packs", "POST", {
      title: "Night Loops",
      kind: "sample",
      distribution: "private",
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.ok(created.pack.canManage);
    const packId = created.pack.id;
    const uploadId = await uploadAudio(context.baseUrl, ownerCookie);
    const trackInput = {
      title: "Late Night Loop",
      artistId,
      tags: ["Garage"],
      bpm: 132,
      key: "Am",
      message: "Original loop",
      uploadId,
      durationSeconds: 12,
      requestId: "add-night-loop",
    };
    const trackResponse = await api(context.baseUrl, ownerCookie, `/api/packs/${packId}/tracks`, "POST", trackInput);
    assert.equal(trackResponse.status, 201);
    const added = await trackResponse.json();
    assert.ok(added.pack);
    const dubId = added.dub.id;
    const replay = await api(context.baseUrl, ownerCookie, `/api/packs/${packId}/tracks`, "POST", trackInput);
    assert.equal((await replay.json()).dub.id, dubId);
    assert.equal((await api(context.baseUrl, ownerCookie, "/api/community")).status, 200);
    const ownerTracks = (await (await api(context.baseUrl, ownerCookie, "/api/community")).json()).dubs;
    assert.equal(ownerTracks.some((dub) => dub.id === dubId), false);
    assert.equal((await (await api(context.baseUrl, ownerCookie, "/api/community")).json()).packs.some((pack) => pack.id === packId), false);
    assert.equal((await api(context.baseUrl, null, `/api/public/packs/${packId}`)).status, 404);
    assert.equal((await api(context.baseUrl, recipientCookie, `/api/dubs/${dubId}/audio`)).status, 404);

    const metadataResponse = await api(context.baseUrl, ownerCookie, `/api/packs/${packId}/tracks/${dubId}`, "PATCH", {
      title: "Late Night Loop (Edited)",
      key: "Gm",
    });
    assert.equal(metadataResponse.status, 200);
    assert.equal(metadataResponse.headers.get("content-type").includes("application/json"), true);
    const metadata = await metadataResponse.json();
    assert.equal(metadata.pack.items[0].dub.title, "Late Night Loop (Edited)");
    assert.equal(metadata.pack.items[0].key, "Gm");

    const missingLicence = await api(context.baseUrl, ownerCookie, `/api/packs/${packId}/publish`, "POST", {});
    assert.equal(missingLicence.status, 400);
    const artworkUploadId = await uploadArtwork(context.baseUrl, ownerCookie);
    const edit = await api(context.baseUrl, ownerCookie, `/api/packs/${packId}`, "PATCH", {
      licence: "You may use these sounds in original music.",
      artworkUploadId,
    });
    assert.equal(edit.status, 200);
    assert.equal((await api(context.baseUrl, ownerCookie, `/api/uploads/${artworkUploadId}`, "DELETE")).status, 409);
    const publishedResponse = await api(context.baseUrl, ownerCookie, `/api/packs/${packId}/publish`, "POST", {});
    assert.equal(publishedResponse.status, 200);
    const publicOwnerPack = (await publishedResponse.json()).pack;
    assert.equal(publicOwnerPack.status, "published");
    assert.equal(publicOwnerPack.grants.length, 0);
    const artworkResponse = await api(context.baseUrl, ownerCookie, publicOwnerPack.artworkUrl);
    assert.equal(artworkResponse.status, 200);
    const ownerPublishedSnapshot = await (await api(context.baseUrl, ownerCookie, "/api/community")).json();
    assert.ok(ownerPublishedSnapshot.packs.some((pack) => pack.id === packId));
    assert.equal((await (await api(context.baseUrl, recipientCookie, "/api/community")).json()).packs.some((pack) => pack.id === packId), false);
    const packSearchPath = "/api/dubs/search?distribution=feed&distributionType=private&q=Night%20Loops";
    assert.ok((await (await api(context.baseUrl, ownerCookie, packSearchPath)).json()).dubs.some((dub) => dub.id === dubId));
    assert.equal((await (await api(context.baseUrl, recipientCookie, packSearchPath)).json()).dubs.length, 0);

    const shareResponse = await api(context.baseUrl, ownerCookie, `/api/packs/${packId}/share`, "POST", {
      buddyIds: [buddyId],
    });
    assert.equal(shareResponse.status, 200);
    assert.deepEqual((await shareResponse.json()).pack.grants.map((grant) => grant.id), [
      (await (await api(context.baseUrl, recipientCookie, "/api/community")).json()).member.id,
    ]);
    const privateDeepLink = await api(context.baseUrl, recipientCookie, `/api/public/packs/${packId}`);
    assert.equal(privateDeepLink.status, 200);
    assert.equal((await privateDeepLink.json()).pack.canManage, false);
    assert.equal((await api(context.baseUrl, recipientCookie, `/api/packs/${packId}`)).status, 200);
    assert.ok((await (await api(context.baseUrl, recipientCookie, "/api/packs")).json()).packs.some((item) => item.id === packId));
    assert.equal((await api(context.baseUrl, recipientCookie, `/api/dubs/${dubId}/audio`)).status, 200);

    const recipientSnapshot = await (await api(context.baseUrl, recipientCookie, "/api/community")).json();
    assert.ok(recipientSnapshot.packs.some((pack) => pack.id === packId && pack.items[0].dub.id === dubId));
    assert.ok(recipientSnapshot.conversations.some((conversation) =>
      conversation.messages.some((message) => message.packId === packId && message.text.includes(`/#pack?id=${packId}`))));
    const messageResponse = await api(context.baseUrl, ownerCookie, `/api/conversations/${buddyId}/messages`, "POST", {
      text: "Here is an individual copy too.",
      dubId,
    });
    assert.equal(messageResponse.status, 201);

    const downloadResponse = await api(context.baseUrl, recipientCookie, `/api/packs/${packId}/download`, "POST", {});
    assert.equal(downloadResponse.status, 200);
    const archiveUrl = (await downloadResponse.json()).downloadUrl;
    const archiveResponse = await fetch(`${context.baseUrl}${archiveUrl}`, { headers: { cookie: recipientCookie } });
    assert.equal(archiveResponse.status, 200, await archiveResponse.clone().text());
    assert.match(archiveResponse.headers.get("content-type"), /application\/zip/);
    const archive = Buffer.from(await archiveResponse.arrayBuffer());
    assert.equal(archive.readUInt32LE(0), 0x04034b50);
    assert.ok(archive.includes(Buffer.from("LICENCE.txt")));
    assert.ok(archive.includes(Buffer.from("You may use these sounds in original music.")));
    assert.ok(archive.includes(Buffer.from("01 - Late Night Loop (Edited).mp3")));
    const accountedDub = (await (await api(context.baseUrl, ownerCookie, "/api/community")).json()).dubs.find((dub) => dub.id === dubId);
    assert.equal(accountedDub.downloads, 1);
    assert.equal(accountedDub.likes, 1);

    const revokePack = await api(context.baseUrl, ownerCookie, `/api/packs/${packId}/grants/${(await (await api(context.baseUrl, recipientCookie, "/api/community")).json()).member.id}`, "DELETE");
    assert.equal(revokePack.status, 200);
    assert.equal((await api(context.baseUrl, recipientCookie, `/api/public/packs/${packId}`)).status, 404);
    assert.equal((await (await api(context.baseUrl, recipientCookie, "/api/community")).json()).packs.some((pack) => pack.id === packId), false);
    assert.equal((await (await api(context.baseUrl, recipientCookie, packSearchPath)).json()).dubs.length, 0);
    assert.equal((await api(context.baseUrl, recipientCookie, `/api/dubs/${dubId}/audio`)).status, 200);
    const revokeDub = await api(context.baseUrl, ownerCookie, `/api/dubs/${dubId}/grants/${(await (await api(context.baseUrl, recipientCookie, "/api/community")).json()).member.id}`, "DELETE");
    assert.equal(revokeDub.status, 200);
    assert.equal((await api(context.baseUrl, recipientCookie, `/api/dubs/${dubId}/audio`)).status, 404);

    const anonymousPublic = await api(context.baseUrl, null, `/api/public/packs/${packId}`);
    assert.equal(anonymousPublic.status, 404);
  } finally {
    await context.close();
    rmSync(context.directory, { recursive: true, force: true });
  }
});

test("deleting an unpublished pack keeps its new tracks private", async () => {
  const context = await startServer();
  try {
    const cookie = await login(context.baseUrl, "meladee", "meladee");
    const profile = await (await api(context.baseUrl, cookie, "/api/community")).json();
    const pack = (await (await api(context.baseUrl, cookie, "/api/packs", "POST", {
      title: "Discarded draft",
      distribution: "worldwide",
    })).json()).pack;
    const uploadId = await uploadAudio(context.baseUrl, cookie);
    const added = await (await api(context.baseUrl, cookie, `/api/packs/${pack.id}/tracks`, "POST", {
      title: "Private until publish",
      artistId: profile.artists[0].id,
      uploadId,
      durationSeconds: 4,
    })).json();
    const dubId = added.dub.id;
    assert.equal((await api(context.baseUrl, null, `/api/public/dubs/${dubId}`)).status, 404);
    assert.equal((await api(context.baseUrl, cookie, `/api/packs/${pack.id}`, "DELETE")).status, 200);
    assert.equal((await api(context.baseUrl, null, `/api/public/dubs/${dubId}`)).status, 404);
    const packList = await (await api(context.baseUrl, cookie, "/api/packs")).json();
    assert.equal(packList.packs.some((item) => item.id === pack.id), false);
  } finally {
    await context.close();
    rmSync(context.directory, { recursive: true, force: true });
  }
});

test("worldwide pack deep links expose guest-clipped tracks and public pack artwork", async () => {
  const context = await startServer();
  try {
    const cookie = await login(context.baseUrl, "meladee", "meladee");
    const profile = await (await api(context.baseUrl, cookie, "/api/community")).json();
    const pack = (await (await api(context.baseUrl, cookie, "/api/packs", "POST", {
      title: "Worldwide Dub Pack",
      distribution: "worldwide",
    })).json()).pack;
    const uploadId = await uploadAudio(context.baseUrl, cookie);
    await api(context.baseUrl, cookie, `/api/packs/${pack.id}/tracks`, "POST", {
      title: "Long Dub",
      artistId: profile.artists[0].id,
      uploadId,
      durationSeconds: 240,
    });
    const artworkUploadId = await uploadArtwork(context.baseUrl, cookie);
    await api(context.baseUrl, cookie, `/api/packs/${pack.id}`, "PATCH", { artworkUploadId });
    const published = await api(context.baseUrl, cookie, `/api/packs/${pack.id}/publish`, "POST", {});
    assert.equal(published.status, 200);
    const result = await api(context.baseUrl, null, `/api/public/packs/${pack.id}`);
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.authenticated, false);
    assert.equal(body.pack.items[0].dub.duration, "00:30");
    assert.match(body.pack.items[0].dub.audioUrl, /^\/api\/public\/dubs\//);
    assert.equal((await api(context.baseUrl, null, body.pack.artworkUrl)).status, 200);
  } finally {
    await context.close();
    rmSync(context.directory, { recursive: true, force: true });
  }
});
