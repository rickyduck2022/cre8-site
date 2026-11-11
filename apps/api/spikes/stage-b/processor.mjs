import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { storedZip } from "../../src/zipStore.mjs";
import { audioFormats } from "./disk.mjs";

const execute = promisify(execFile);
const controller = new AbortController();
process.on("disconnect", () => controller.abort());
process.on("message", async (message) => {
  if (message.cancel) { controller.abort(); return; }
  try {
    const output = join(message.root, message.outputKey);
    if (message.kind === "validate") {
      const source = message.files[0];
      const common = ["-hide_banner", "-loglevel", "error", "-nostdin", "-xerror", "-max_alloc", "67108864", "-threads", "1",
        "-protocol_whitelist", "file,pipe", "-f", audioFormats[extname(source.path)], "-i", source.path,
        "-map", "0:a:0", "-vn", "-threads", "1"];
      await execute(process.env.FFMPEG_PATH || ffmpegPath, [...common, "-f", "null", "-"], {
        timeout: 30000, maxBuffer: 65536, windowsHide: true, signal: controller.signal,
      });
      const { stdout } = await execute(process.env.FFMPEG_PATH || ffmpegPath,
        [...common, "-t", "30", "-ac", "1", "-ar", "16000", "-f", "s16le", "pipe:1"], {
          encoding: "buffer", timeout: 30000, maxBuffer: 30 * 32000 + 65536, windowsHide: true, signal: controller.signal,
        });
      if (!stdout.length || stdout.length > 30 * 32000) throw new Error("Invalid preview size.");
      const header = Buffer.alloc(44);
      header.write("RIFF");
      header.writeUInt32LE(stdout.length + 36, 4);
      header.write("WAVEfmt ", 8);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22);
      header.writeUInt32LE(16000, 24);
      header.writeUInt32LE(32000, 28);
      header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34);
      header.write("data", 36);
      header.writeUInt32LE(stdout.length, 40);
      await writeFile(output, Buffer.concat([header, stdout]), { flag: "wx", mode: 0o600 });
    } else {
      await pipeline(Readable.from(storedZip(message.files)), createWriteStream(output, { flags: "wx", mode: 0o600 }), { signal: controller.signal });
    }
    process.send({ ok: true }, () => process.disconnect());
  } catch (error) {
    process.send({ ok: false, code: error.name === "AbortError" ? "CANCELED" : "PROCESSING_FAILED" }, () => process.disconnect());
  }
});
