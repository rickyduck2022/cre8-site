import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, statfs, unlink, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { httpError } from "../stage-a/store.mjs";

export const maxAudioBytes = 100 * 1024 * 1024;
export const audioFormats = { ".wav": "wav", ".mp3": "mp3", ".ogg": "ogg", ".m4a": "mov", ".aac": "aac", ".flac": "flac", ".webm": "matroska" };
const keyPattern = /^[a-f0-9-]{36}\.(wav|mp3|ogg|m4a|aac|flac|webm|zip)$/;

export function mediaDirectory(directory, runId) {
  if (!directory || !isAbsolute(directory) || basename(resolve(directory)) !== `cre8_spike_${runId}`) {
    throw new Error("SPIKE_MEDIA_DIRECTORY must be an absolute isolated directory named cre8_spike_<SPIKE_RUN_ID>.");
  }
  return resolve(directory);
}

export async function createDiskStore(directory, runId) {
  const root = mediaDirectory(directory, runId);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink() || (await realpath(root)).toLowerCase() !== root.toLowerCase()) {
    throw new Error("Spike media directory must not traverse symlinks or junctions.");
  }
  const marker = join(root, ".cre8-spike");
  const entries = await readdir(root);
  if (!entries.includes(".cre8-spike")) {
    if (entries.length) throw new Error("Refusing a nonempty media directory without a spike marker.");
    await writeFile(marker, runId, { flag: "wx", mode: 0o600 });
  }
  if (!(await lstat(marker)).isFile() || (await lstat(marker)).isSymbolicLink()) throw new Error("Spike marker must be a regular file.");
  if (await readFile(marker, "utf8") !== runId) throw new Error("Spike media isolation marker does not match.");
  const path = (key) => {
    if (!keyPattern.test(key ?? "")) throw new Error("Invalid immutable media key.");
    return join(root, key);
  };
  async function checkedPath(key) {
    const file = path(key);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("Media must be a regular private file.");
    return file;
  }
  async function inspect(key) {
    const file = await checkedPath(key);
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
    return { bytes, checksum: hash.digest("hex") };
  }
  return {
    root, path, checkedPath, inspect,
    newKey: (extension) => `${randomUUID()}${extension}`,
    async capacity(requiredBytes = maxAudioBytes) {
      const info = await statfs(root);
      if (info.bavail * info.bsize < requiredBytes + 100 * 1024 * 1024) {
        throw httpError(507, "Insufficient free space for another upload.");
      }
    },
    async remove(key) {
      try { await unlink(path(key)); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    },
    async receive(key, source, expectedBytes) {
      await this.capacity();
      const hash = createHash("sha256");
      let bytes = 0;
      const limiter = new Transform({
        transform(chunk, encoding, callback) {
          bytes += chunk.length;
          if (bytes > expectedBytes || bytes > maxAudioBytes) return callback(httpError(413, "Upload exceeds its reserved byte limit."));
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      try {
        await pipeline(source, limiter, createWriteStream(path(key), { flags: "wx", mode: 0o600 }));
        if (bytes !== expectedBytes) throw httpError(400, "Upload size does not match its reservation.");
        const handle = await open(path(key), "r+");
        try { await handle.sync(); } finally { await handle.close(); }
        return { bytes, checksum: hash.digest("hex") };
      } catch (error) {
        if (error.code !== "EEXIST") await this.remove(key);
        throw error;
      }
    },
    async verify(key, bytes, checksum) {
      const actual = await inspect(key);
      if (actual.bytes !== Number(bytes) || actual.checksum !== checksum) throw httpError(503, "Media integrity verification failed.");
      return this.checkedPath(key);
    },
    async files() {
      const result = [];
      for (const key of await readdir(root)) {
        if (key === ".cre8-spike") continue;
        if (!keyPattern.test(key)) throw new Error("Unexpected file in isolated media directory; reconciliation stopped.");
        const info = await lstat(path(key));
        if (!info.isFile() || info.isSymbolicLink()) throw new Error("Unexpected media directory entry.");
        result.push({ key, mtimeMs: info.mtimeMs });
      }
      return result;
    },
  };
}

export async function streamFile(request, response, disk, { key, bytes, checksum, type, name }) {
  const file = await disk.verify(key, bytes, checksum);
  const size = Number(bytes);
  let start = 0;
  let end = size - 1;
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return unsatisfied();
    if (!match[1]) {
      const suffix = Number(match[2]);
      if (!Number.isSafeInteger(suffix) || suffix <= 0) return unsatisfied();
      start = Math.max(0, size - suffix);
    } else {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || start > end) return unsatisfied();
    }
  }
  response.writeHead(range ? 206 : 200, {
    "content-type": type,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
    "content-length": end - start + 1,
    "content-disposition": name ? `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(name)}` : "inline",
    ...(range ? { "content-range": `bytes ${start}-${end}/${size}` } : {}),
  });
  if (request.method === "HEAD") { response.end(); return; }
  await pipeline(createReadStream(file, { start, end }), response);
  function unsatisfied() {
    response.writeHead(416, { "content-range": `bytes */${size}`, "cache-control": "private, no-store" });
    response.end();
  }
}
