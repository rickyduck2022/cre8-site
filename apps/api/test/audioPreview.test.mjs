import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { createAudioPreviewService, dubPreviewSeconds } from "../src/audioPreview.mjs";

test("previews decode to the configured duration, reuse cached clips, and never pad short tracks", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cre8-preview-"));
  function writeWave(name, seconds) {
    const pcm = Buffer.alloc(seconds * 32000);
    const header = Buffer.alloc(44);
    header.write("RIFF");
    header.writeUInt32LE(pcm.length + 36, 4);
    header.write("WAVEfmt ", 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(16000, 24);
    header.writeUInt32LE(32000, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcm.length, 40);
    const path = join(directory, name);
    writeFileSync(path, Buffer.concat([header, pcm]));
    return path;
  }
  try {
    const preview = createAudioPreviewService();
    const path = writeWave("long.wav", 100);
    for (const seconds of [30, 60, 90]) {
      const [first, second] = await Promise.all([preview(path, seconds), preview(path, seconds)]);
      assert.equal(first, second);
      assert.equal(await preview(path, seconds), first);
      assert.equal(first.length, 44 + seconds * 32000);
      assert.equal(first.readUInt32LE(40) / first.readUInt32LE(28), seconds);
    }
    const short = await preview(writeWave("short.wav", 2), 30);
    assert.equal(short.length, 44 + 2 * 32000);
    const updatedShort = await preview(writeWave("short.wav", 3), 30);
    assert.notEqual(updatedShort, short);
    assert.equal(updatedShort.length, 44 + 3 * 32000);
    writeWave("short.wav", 2);
    for (const [extension, codec] of [
      ["mp3", "libmp3lame"], ["flac", "flac"], ["ogg", "libvorbis"],
      ["m4a", "aac"], ["aac", "aac"], ["webm", "libopus"],
    ]) {
      const encodedPath = join(directory, `short.${extension}`);
      execFileSync(process.env.FFMPEG_PATH || ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-nostdin",
        "-i", join(directory, "short.wav"), "-c:a", codec, encodedPath,
      ], { timeout: 10000, windowsHide: true });
      const converted = await preview(encodedPath, 30);
      assert.equal(converted.toString("ascii", 0, 4), "RIFF");
      const duration = converted.readUInt32LE(40) / converted.readUInt32LE(28);
      assert.ok(duration > 0 && duration < 3, `${extension} preview duration: ${duration}`);
    }
    assert.equal(dubPreviewSeconds({}), 30);
    assert.equal(dubPreviewSeconds({ previewSeconds: 10000 }), 30);
    await assert.rejects(preview(path, 10000), /Unsupported preview/);
    writeFileSync(join(directory, "broken.wav"), "not audio");
    await assert.rejects(preview(join(directory, "broken.wav"), 30), { status: 503 });
    writeWave("broken.wav", 2);
    assert.equal((await preview(join(directory, "broken.wav"), 30)).length, 44 + 2 * 32000);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
