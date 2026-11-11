import { readSpikeConfig } from "../stage-a/database.mjs";

export function readStagingConfig(env = process.env, nodeMajor = process.versions.node.split(".")[0]) {
  if (env.SPIKE_STAGING_ACK !== "isolated-synthetic-only") {
    throw new Error("SPIKE_STAGING_ACK must explicitly acknowledge isolated synthetic staging.");
  }
  if (nodeMajor !== "22") throw new Error("Use the Node 22 staging image.");
  const config = readSpikeConfig(env);
  if (config.runId !== "render_stage") throw new Error("The staging image requires SPIKE_RUN_ID=render_stage.");
  const directory = "/var/data/cre8_spike_render_stage";
  if (env.SPIKE_MEDIA_DIRECTORY !== directory) throw new Error("Use the isolated staging disk mount.");
  const port = Number(env.PORT ?? 10000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3002) {
    throw new Error("PORT must be 1024-65535 and distinct from loopback port 3002.");
  }
  if (!["true", "false"].includes(env.SPIKE_STAGING_PAUSED ?? "false")) {
    throw new Error("SPIKE_STAGING_PAUSED must be true or false.");
  }
  return { ...config, directory, port, paused: env.SPIKE_STAGING_PAUSED === "true" };
}
