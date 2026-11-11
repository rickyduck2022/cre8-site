import { createSpikeDatabase, readSpikeConfig } from "../stage-a/database.mjs";
import { claimJob } from "./jobs.mjs";

const database = createSpikeDatabase(readSpikeConfig());
const job = await claimJob(database);
await database.close();
process.send(job);
setInterval(() => {}, 1000);
