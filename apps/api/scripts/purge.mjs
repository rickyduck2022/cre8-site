import { existsSync, lstatSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { createSeedState } from "../src/server.mjs";

const localDataPath = fileURLToPath(new URL("../data/community.json", import.meta.url));

export function purgeData(dataPath) {
  if (!existsSync(dataPath)) {
    throw new Error(`Database does not exist: ${dataPath}`);
  }
  if (!lstatSync(dataPath).isFile()) {
    throw new Error(`Database must be a regular file, not a symlink or directory: ${dataPath}`);
  }

  const temporaryPath = `${dataPath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(createSeedState(), null, 2)}\n`, { flag: "wx" });
    renameSync(temporaryPath, dataPath);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.COMMUNITY_DATA_PATH !== undefined) {
    throw new Error("Purge is only available for the default local database without COMMUNITY_DATA_PATH set.");
  }
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--yes") || args.length > 1) {
    throw new Error("Usage: pnpm dev:purge [--yes]");
  }
  console.log(`This will reset ${localDataPath} to the seeded accounts and delete all other database records.`);
  console.log("Stop the API first. Uploaded media files will not be deleted.");
  if (!args.includes("--yes")) {
    if (!process.stdin.isTTY) throw new Error("Confirmation requires a terminal; use --yes to run non-interactively.");
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try {
      answer = await prompt.question("Type PURGE to continue: ");
    } finally {
      prompt.close();
    }
    if (answer !== "PURGE") {
      console.log("Purge cancelled; no data was changed.");
      return;
    }
  }
  purgeData(localDataPath);
  console.log("Database reset. Seeded logins: meladee / meladee and holik / holik.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Purge failed: ${error.message}`);
    process.exitCode = 1;
  });
}
