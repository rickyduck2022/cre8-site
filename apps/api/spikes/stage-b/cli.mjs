import { createSpikeDatabase, readSpikeConfig } from "../stage-a/database.mjs";
import { createDiskStore } from "./disk.mjs";
import { createStageBServer } from "./routes.mjs";
import { createMediaRunner } from "./jobs.mjs";
import { reconcile } from "./media.mjs";
import { verifySchema } from "../stage-a/database.mjs";
import { seedMediaFixtures } from "./fixtures.mjs";

let database;
try {
  const command = process.argv[2];
  if (!["serve", "work", "reconcile", "seed"].includes(command)) throw new Error("Use serve, work, reconcile or seed.");
  const config = readSpikeConfig();
  database = createSpikeDatabase(config);
  await verifySchema(database);
  const directory = process.env.SPIKE_MEDIA_DIRECTORY;
  if (command === "seed") {
    await seedMediaFixtures(database);
    console.log("Stage B synthetic personas and friendship fixtures seeded.");
    await database.close();
  } else if (command === "serve") {
    const port = Number(process.env.SPIKE_PORT ?? 3002);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SPIKE_PORT must be 1-65535.");
    const { server } = await createStageBServer({ database, directory, runId: config.runId });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    console.log(`Stage B isolated harness listening on http://127.0.0.1:${port}.`);
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => server.closeAllConnections(), 10000);
      server.close(async () => {
        clearTimeout(deadline);
        try { await database.close(); }
        catch (error) {
          console.error("Stage B shutdown failed.", { code: error.code ?? error.name });
          process.exitCode = 1;
        }
      });
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  } else {
    const disk = await createDiskStore(directory, config.runId);
    if (command === "reconcile") console.log("Stage B reconciliation:", await reconcile(database, disk));
    else {
      const runner = createMediaRunner(database, disk);
      const controller = new AbortController();
      const stop = () => controller.abort();
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      try {
        let completed = 0;
        while (!controller.signal.aborted && await runner.runOnce({ signal: controller.signal })) completed++;
        console.log(`Stage B processed ${completed} jobs; no further due jobs.`);
      } finally {
        process.removeListener("SIGINT", stop);
        process.removeListener("SIGTERM", stop);
      }
    }
    await database.close();
  }
} catch (error) {
  console.error("Stage B command failed.", {
    code: error.code ?? error.name,
    message: error.code ? "Isolated database/media operation failed; inspect safe job status." : error.message,
  });
  if (database) await database.close();
  process.exitCode = 1;
}
