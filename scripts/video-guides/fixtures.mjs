import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

export async function prepareGuideFixture(context, origin, guide, variables, assets) {
  if (!guide.fixture) return;
  const sessions = new Map();
  async function call(username, path, body, method = "POST", headers = {}) {
    const response = await fetch(`${origin}${path}`, {
      method, headers: { ...(sessions.has(username) ? { cookie: sessions.get(username) } : {}), ...headers,
        ...(body && !(body instanceof Buffer) ? { "content-type": "application/json" } : {}) },
      ...(body === undefined ? {} : { body: body instanceof Buffer ? body : JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`Guide fixture ${path}: ${response.status} ${result.error ?? ""}`);
    const cookie = response.headers.get("set-cookie");
    if (cookie) sessions.set(username, cookie.split(";")[0]);
    return result;
  }
  for (const [username, displayName] of [["guideadmin", "Community Admin"], ["demoartist", "Demo Artist"], ["demorecipient", "Demo Listener"], ["newartist", "New Artist"]]) {
    await call(username, "/api/register", { username, displayName, genre: "Jungle", password: variables.demoPassword });
  }
  const fields = {
    artistName: "Demo Artist", roles: ["DJ", "Producer"], djExperience: "8 years of clubs and community radio",
    producerExperience: "5 years of jungle releases", events: ["Night Sessions"], supporters: ["Local Selectors"],
    labels: ["Independent"], additionalInfo: "Monthly radio resident supporting emerging producers.",
    social: { instagram: { url: "https://instagram.com/example", followers: 1234 } },
  };
  const application = await call("demoartist", "/api/alist/application", fields);
  await call("guideadmin", `/api/admin/alist/applications/${application.id}/decision`, { action: "approve", note: "Welcome to the A-List community." });
  if (guide.fixture !== "new-application") await call("newartist", "/api/alist/application", { ...fields, artistName: "New Artist" });
  const snapshot = await call("demoartist", "/api/community", undefined, "GET");
  const artistId = snapshot.artists[0].id;
  const friends = await call("demoartist", "/api/buddies", { username: "demorecipient" });
  const buddyId = friends.buddies.find((buddy) => buddy.username === "demorecipient").id;
  await call("demorecipient", "/api/buddies", { username: "demoartist" });
  const audio = readFileSync(assets.audio);
  for (const [kind, distribution, title] of [
    ["dub", "worldwide", "Night Sessions"], ["sample", "worldwide", "Jungle Toolkit"],
    ["dub", "private", "Private Sessions"], ["sample", "private", "Private Toolkit"],
    ["dub", "alist", "A-List Exclusives"],
  ]) {
    const { pack } = await call("demoartist", "/api/packs", {
      title, kind, distribution, aListPublic: distribution === "alist", licence: "Original productions only. No standalone resale.",
      description: "A curated release from Demo Artist.",
    });
    for (const [index, trackTitle] of ["Opening", "After Hours"].entries()) {
      const { uploadId } = await call("demoartist", "/api/uploads", audio, "POST", { "content-type": "audio/wav", "x-file-name": "guide.wav" });
      await call("demoartist", `/api/packs/${pack.id}/tracks`, {
        uploadId, title: `${title} - ${trackTitle}`, artistId, tags: ["Jungle"], bpm: 174,
        durationSeconds: 100, key: "F minor", requestId: randomUUID(),
      });
    }
    await call("demoartist", `/api/packs/${pack.id}/publish`, {});
    if (distribution === "private") await call("demoartist", `/api/conversations/${buddyId}/messages`, {
      packId: pack.id, text: `Here is ${title}. Let me know your favourite sound.`, confirmPackAccess: true,
    });
  }
  const username = guide.fixture === "admin" ? "guideadmin" : guide.fixture === "received" ? "demorecipient"
    : ["application", "new-application"].includes(guide.fixture) ? "newartist" : "demoartist";
  if (guide.fixture === "application") {
    const applications = await call("guideadmin", "/api/admin/alist/applications", undefined, "GET");
    const submitted = applications.applications.find((item) => item.username === "newartist");
    await call("guideadmin", `/api/admin/alist/applications/${submitted.id}/decision`, { action: "request_information", note: "Please add your next radio date." });
  }
  const [name, value] = sessions.get(username).split("=");
  await context.addCookies([{ name, value, url: origin }]);
}
