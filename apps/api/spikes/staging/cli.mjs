import { realpath } from "node:fs/promises";
import { createSpikeDatabase } from "../stage-a/database.mjs";
import { createStageBServer } from "../stage-b/routes.mjs";
import { createMediaRunner } from "../stage-b/jobs.mjs";
import { createStagingAdmission } from "./admission.mjs";
import { startStagingRuntime } from "./runtime.mjs";
import { readStagingConfig } from "./config.mjs";

let database;
try {
  const config = readStagingConfig();
  const { directory, port } = config;
  if (await realpath(directory) !== directory) {
    throw new Error("Use the isolated staging disk mount, not a symlink or community media directory.");
  }
  database = createSpikeDatabase(config);
  const { server, disk } = await createStageBServer({
    database, directory, runId: config.runId, admit: createStagingAdmission(),
  });
  const runtime = await startStagingRuntime({
    database, disk, server, runner: createMediaRunner(database, disk), port, paused: config.paused,
  });
  console.info(config.paused
    ? "Isolated staging paused; no harness listener or worker. Public ingress serves health only."
    : "Isolated staging started; public ingress serves health only. Harness: loopback port 3002.");
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      console.error("Staging shutdown deadline exceeded.");
      process.exit(1);
    }, 85000);
    try {
      await runtime.close();
      await database.close();
      console.info("Isolated staging stopped.");
    } catch (error) {
      console.error("Staging shutdown failed.", { code: error.code ?? error.name });
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} catch (error) {
  console.error("Staging startup failed.", {
    code: error.code ?? error.name,
    message: error.code ? "Verify isolated database, schema and disk configuration." : error.message,
  });
  if (database) await database.close();
  process.exitCode = 1;
}
