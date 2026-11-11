import assert from "node:assert/strict";
import { test } from "node:test";
import { createSpikeDatabase, readSpikeConfig } from "./database.mjs";

test("Stage A refuses implicit, production-looking and connection-override targets", () => {
  const valid = { SPIKE_RUN_ID: "test_123", SPIKE_DATABASE_URL: "postgres://localhost/cre8_spike_test_123" };
  assert.equal(readSpikeConfig(valid).runId, "test_123");
  assert.doesNotThrow(() => readSpikeConfig({ ...valid, SPIKE_DATABASE_URL: valid.SPIKE_DATABASE_URL + "?sslmode=verify-full" }));
  for (const env of [
    {}, { ...valid, SPIKE_RUN_ID: "../production" },
    { ...valid, SPIKE_DATABASE_URL: "postgres://localhost/community" },
    { ...valid, SPIKE_DATABASE_URL: "postgres://localhost/cre8_spike_different" },
    { ...valid, SPIKE_DATABASE_URL: valid.SPIKE_DATABASE_URL + "?options=-csearch_path=public" },
    { ...valid, SPIKE_DATABASE_URL: valid.SPIKE_DATABASE_URL + "?database=community" },
    { ...valid, SPIKE_DATABASE_URL: valid.SPIKE_DATABASE_URL + "?sslmode=no-verify" },
    { ...valid, SPIKE_DATABASE_URL: valid.SPIKE_DATABASE_URL + "?sslmode=verify-full&sslmode=no-verify" },
    { ...valid, SPIKE_DATABASE_URL: valid.SPIKE_DATABASE_URL + "?host=somewhere-else" },
    { ...valid, SPIKE_DATABASE_URL: "postgres://remote.example/cre8_spike_test_123" },
  ]) {
    assert.throws(() => readSpikeConfig(env));
  }
  assert.throws(() => createSpikeDatabase({ connectionString: "postgres://localhost/community", runId: "test_123" }));
});
