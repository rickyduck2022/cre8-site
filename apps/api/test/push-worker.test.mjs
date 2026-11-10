import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

function worker(clients = []) {
  const handlers = {};
  const notifications = [];
  const opened = [];
  const self = {
    location: { origin: "https://example.test" },
    addEventListener: (type, handler) => { handlers[type] = handler; },
    registration: { showNotification: async (title, options) => { notifications.push({ title, options }); } },
    clients: { matchAll: async () => clients, openWindow: async (url) => { opened.push(url); } },
  };
  runInNewContext(readFileSync(new URL("../../web/public/push-worker.js", import.meta.url), "utf8"), { self, URL, console, encodeURIComponent });
  return { handlers, notifications, opened };
}

test("push worker shows message details and focuses the existing app on click", async () => {
  const messages = [];
  let focused = false;
  const client = { url: "https://example.test/#dubs", postMessage: (message) => messages.push(message), focus: async () => { focused = true; } };
  const { handlers, notifications } = worker([client]);
  let task;
  handlers.push({ data: { json: () => ({ title: "From Amber", body: "A dub", buddyId: "buddy-1" }) }, waitUntil: (promise) => { task = promise; } });
  await task;
  assert.equal(notifications[0].title, "From Amber");
  assert.equal(notifications[0].options.body, "A dub");
  let closed = false;
  handlers.notificationclick({ notification: { data: notifications[0].options.data, close: () => { closed = true; } }, waitUntil: (promise) => { task = promise; } });
  await task;
  assert.equal(closed, true);
  assert.equal(focused, true);
  assert.equal(messages[0].type, "push.openConversation");
  assert.equal(messages[0].buddyId, "buddy-1");
});

test("push worker opens the targeted conversation when the app is closed", async () => {
  const { handlers, opened } = worker();
  let task;
  handlers.notificationclick({ notification: { data: { buddyId: "buddy/1" }, close() {} }, waitUntil: (promise) => { task = promise; } });
  await task;
  assert.deepEqual(opened, ["https://example.test/#messenger?buddy=buddy%2F1"]);
});
