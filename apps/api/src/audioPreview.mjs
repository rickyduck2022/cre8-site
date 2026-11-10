import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { promisify } from "node:util";
import { extname } from "node:path";
import ffmpegPath from "ffmpeg-static";

const execute = promisify(execFile);
export const previewDurations = [30, 60, 90];
export const defaultPreviewSeconds = 30;

export function dubPreviewSeconds(dub) {
  return previewDurations.includes(dub.previewSeconds) ? dub.previewSeconds : defaultPreviewSeconds;
}

export function createAudioPreviewService() {
  const cache = new Map();
  const pending = new Map();

  return async function audioPreview(filePath, seconds) {
    if (!previewDurations.includes(seconds)) throw new Error("Unsupported preview length.");
    const file = statSync(filePath);
    const key = JSON.stringify([filePath, file.size, file.mtimeMs, seconds]);
    if (cache.has(key)) {
      const cached = cache.get(key);
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 2) throw Object.assign(new Error("Preview processing is busy. Please try again shortly."), { status: 503 });
    const encoding = Promise.resolve().then(async () => {
      try {
        const format = {
          ".wav": "wav", ".mp3": "mp3", ".ogg": "ogg", ".m4a": "mov",
          ".aac": "aac", ".flac": "flac", ".webm": "matroska",
        }[extname(filePath).toLowerCase()];
        if (!format) throw new Error("Unsupported preview source format.");
        const { stdout } = await execute(process.env.FFMPEG_PATH || ffmpegPath, [
          "-hide_banner", "-loglevel", "error", "-nostdin",
          "-protocol_whitelist", "file,pipe", "-f", format,
          "-i", filePath, "-t", String(seconds), "-map", "0:a:0",
          "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "pipe:1",
        ], { encoding: "buffer", maxBuffer: seconds * 32000 + 65536, timeout: 30000, windowsHide: true });
        if (!stdout.length || stdout.length > seconds * 32000) throw new Error("Invalid preview audio length.");
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
        const result = Buffer.concat([header, stdout]);
        cache.set(key, result);
        while (cache.size > 16) cache.delete(cache.keys().next().value);
        return result;
      } catch (error) {
        console.error("Audio preview generation failed:", error.message);
        throw Object.assign(new Error("This preview could not be prepared. Please try again shortly."), { status: 503 });
      } finally {
        pending.delete(key);
      }
    });
    pending.set(key, encoding);
    return encoding;
  };
}
