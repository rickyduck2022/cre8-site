import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { createDiskStore, mediaDirectory } from "./disk.mjs";

test("private disk refuses unsafe roots, paths, overwrite and mismatched bytes", async () => {
  const parent = await mkdtemp(join(tmpdir(), "cre8-disk-check-"));
  const root = join(parent, "cre8_spike_disk_test");
  try {
    assert.throws(() => mediaDirectory(parent, "disk_test"));
    assert.throws(() => mediaDirectory("relative", "disk_test"));
    await mkdir(root);
    await writeFile(join(root, "unfamiliar"), "keep");
    await assert.rejects(createDiskStore(root, "disk_test"), /nonempty/);
    await rm(join(root, "unfamiliar"));
    const disk = await createDiskStore(root, "disk_test");
    assert.throws(() => disk.path("../community.json"));
    const key = disk.newKey(".wav");
    const bytes = Buffer.from("synthetic");
    const received = await disk.receive(key, Readable.from([bytes]), bytes.length);
    await disk.verify(key, bytes.length, received.checksum);
    await assert.rejects(disk.receive(key, Readable.from([bytes]), bytes.length), { code: "EEXIST" });
    await disk.verify(key, bytes.length, received.checksum);
    const incomplete = disk.newKey(".wav");
    await assert.rejects(disk.receive(incomplete, Readable.from([bytes]), bytes.length + 1), { status: 400 });
    await assert.rejects(disk.inspect(incomplete), { code: "ENOENT" });
    const oversized = disk.newKey(".wav");
    await assert.rejects(disk.receive(oversized, Readable.from([bytes]), 1), { status: 413 });
    await assert.rejects(disk.inspect(oversized), { code: "ENOENT" });
    await writeFile(disk.path(key), "tampered");
    await assert.rejects(disk.verify(key, bytes.length, received.checksum), { status: 503 });
    await writeFile(join(root, ".cre8-spike"), "different");
    await assert.rejects(createDiskStore(root, "disk_test"), /marker/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
