import { createSpikeDatabase, migrate, readSpikeConfig, verifySchema } from "./database.mjs";
import { seedFixtures } from "./fixtures.mjs";
import { createStageAServer } from "./server.mjs";

const command = process.argv[2];
let database;
try {
  if (!["migrate", "seed", "serve"].includes(command)) throw new Error("Use migrate, seed or serve.");
  database = createSpikeDatabase(readSpikeConfig());
  if (command === "migrate") {
    await migrate(database);
    console.log("Stage A isolated database migrated.");
  } else if (command === "seed") {
    await verifySchema(database);
    await seedFixtures(database);
    console.log("Stage A synthetic fixtures seeded; existing passwords were not reset.");
  } else {
    const port = Number(process.env.SPIKE_PORT ?? 3002);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SPIKE_PORT must be 1-65535.");
    const server = await createStageAServer({ database });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    console.log(`Stage A harness listening on http://127.0.0.1:${port}; not the community API.`);
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      const timer = setTimeout(() => server.closeAllConnections(), 10000);
      server.close(async () => {
        clearTimeout(timer);
        try {
          await database.close();
        } catch (error) {
          console.error("Stage A shutdown failed.", { code: error.code ?? error.name });
          process.exitCode = 1;
        }
      });
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }
  if (command !== "serve") await database.close();
} catch (error) {
  console.error("Stage A command failed.", {
    code: error.code ?? error.name,
    message: error.code ? "Database operation failed; verify isolated configuration/connectivity." : error.message,
  });
  if (database) await database.close();
  process.exitCode = 1;
}
