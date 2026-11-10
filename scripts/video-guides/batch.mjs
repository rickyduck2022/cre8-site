import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const check = args.includes("--check");
const ids = args.filter((argument) => argument !== "--check");
// Marketing templates (e.g. adverts) use their own recording profile; record them explicitly.
const selected = ids.length ? ids : readdirSync(new URL("./templates/", import.meta.url))
  .filter((name) => name.endsWith(".json"))
  .filter((name) => JSON.parse(readFileSync(new URL(`./templates/${name}`, import.meta.url), "utf8")).marketing !== true)
  .map((name) => name.slice(0, -5));
const failed = [];

// Keep two isolated browsers at most, one per device, on shared developer machines.
await Promise.all(["desktop", "mobile"].map(async (profile) => {
  for (const id of selected) {
    const status = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        fileURLToPath(new URL("./record.mjs", import.meta.url)), id, profile, ...(check ? ["--check"] : []),
      ], { stdio: "inherit", env: process.env });
      child.once("error", reject);
      child.once("exit", (code) => resolve(code));
    });
    if (status !== 0) failed.push(`${id} (${profile})`);
  }
}));
if (failed.length) {
  console.error(`Failed journeys:\n${failed.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Verified ${selected.length * 2} ${check ? "journey checks" : "videos"}.`);
}
