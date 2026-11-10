import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApiServer, initializeData } from "../src/server.mjs";
import { validPushSubscription } from "../src/push.mjs";

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString("base64url"), auth: Buffer.alloc(16).toString("base64url") },
};

test("push subscriptions reject invalid keys and unsafe endpoints", () => {
  assert.equal(validPushSubscription(subscription), true);
  for (const endpoint of [
    "http://fcm.googleapis.com/test", "https://localhost/test",
    "https://fcm.googleapis.com.attacker.test/test", "https://fcm.googleapis.com:444/test",
    "https://user@fcm.googleapis.com/test",
  ]) {
    assert.equal(validPushSubscription({ ...subscription, endpoint }), false);
  }
  assert.equal(validPushSubscription({ ...subscription, keys: { p256dh: "bad", auth: "bad" } }), false);
});

test("push subscriptions persist, follow recipient ownership, and deliver messages and shared dubs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-push-"));
  const dataPath = join(directory, "community.json");
  const mediaDirectory = join(directory, "audio");
  const data = initializeData(dataPath, mediaDirectory);
  data.users.find((user) => user.id === "user-meladee").aListApproved = true;
  data.users.find((user) => user.id === "user-holik").aListApproved = true;
  data.friendships.push(
    { id: "sender-buddy", ownerId: "user-meladee", friendUserId: "user-holik", unread: 0 },
    { id: "recipient-buddy", ownerId: "user-holik", friendUserId: "user-meladee", unread: 0 },
  );
  data.dubs.push({ id: "dub-one", title: "Night Drive", artist: "Meladee", uploaderId: "user-meladee", distribution: "worldwide", version: 1 });
  data.dubs.push({ id: "dub-alist", title: "Exclusive", artist: "Meladee", uploaderId: "user-meladee", distribution: "alist", version: 1 });
  writeFileSync(dataPath, JSON.stringify(data));
  const sent = [];
  let deliveryError;
  const pushService = { publicKey: "public-key", send: async (target, payload) => {
    if (deliveryError) throw deliveryError;
    sent.push({ target, payload });
  } };
  const server = createApiServer({ dataPath, mediaDirectory, pushService });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, method, cookie, body) => fetch(base + path, {
    method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  async function login(username) {
    const response = await call("/api/login", "POST", null, { username, password: username });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  }
  try {
    const sender = await login("meladee");
    const recipient = await login("holik");
    assert.equal((await call("/api/push/subscription", "POST", null, subscription)).status, 401);
    assert.equal((await call("/api/push/subscription", "POST", recipient, { ...subscription, endpoint: "https://127.0.0.1/" })).status, 400);
    assert.equal((await call("/api/push/subscription", "POST", recipient, subscription)).status, 200);
    assert.equal(JSON.parse(readFileSync(dataPath)).pushSubscriptions.length, 1);
    assert.equal((await (await call("/api/push/status", "POST", sender, { endpoint: subscription.endpoint })).json()).enabled, false);
    assert.equal((await (await call("/api/push/status", "POST", recipient, { endpoint: subscription.endpoint })).json()).enabled, true);

    assert.equal((await call("/api/conversations/sender-buddy/messages", "POST", sender, { text: "Hello" })).status, 201);
    assert.deepEqual(sent[0].payload, { title: "Message from Meladee", body: "Hello", buddyId: "recipient-buddy" });
    assert.equal((await call("/api/conversations/sender-buddy/messages", "POST", sender, { text: "Listen", dubId: "dub-one" })).status, 201);
    assert.deepEqual(sent[1].payload, { title: "Meladee shared a dub", body: "Night Drive: Listen", buddyId: "recipient-buddy" });
    assert.equal((await call("/api/dubs/dub-alist/share-member", "POST", sender, { userId: "user-holik", text: "For you" })).status, 201);
    assert.deepEqual(sent[2].payload, { title: "Meladee shared a dub", body: "Exclusive: For you", buddyId: "recipient-buddy" });
    assert.equal((await call("/api/push/subscription", "DELETE", sender, { endpoint: subscription.endpoint })).status, 200);
    assert.equal(JSON.parse(readFileSync(dataPath)).pushSubscriptions.length, 1);
    assert.equal((await call("/api/push/subscription", "DELETE", recipient, { endpoint: subscription.endpoint })).status, 200);
    assert.equal(JSON.parse(readFileSync(dataPath)).pushSubscriptions.length, 0);
    assert.equal((await call("/api/push/subscription", "POST", recipient, subscription)).status, 200);
    deliveryError = Object.assign(new Error("Expired"), { statusCode: 410 });
    assert.equal((await call("/api/conversations/sender-buddy/messages", "POST", sender, { text: "Expired endpoint" })).status, 201);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(JSON.parse(readFileSync(dataPath)).pushSubscriptions.length, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
