import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

async function crc32File(filePath) {
  let crc = 0xffffffff;
  for await (const chunk of createReadStream(filePath)) {
    for (const byte of chunk) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function localHeader(name, size, crc, time, date) {
  const encodedName = Buffer.from(name);
  const header = Buffer.alloc(30 + encodedName.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(encodedName.length, 26);
  header.writeUInt16LE(0, 28);
  encodedName.copy(header, 30);
  return header;
}

function centralHeader(name, size, crc, time, date, offset) {
  const encodedName = Buffer.from(name);
  const header = Buffer.alloc(46 + encodedName.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(time, 12);
  header.writeUInt16LE(date, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(encodedName.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  encodedName.copy(header, 46);
  return header;
}

export async function* storedZip(entries) {
  if (entries.length > 65535) throw new Error("Too many files for a ZIP archive.");
  const dateTime = dosDateTime();
  const prepared = [];
  let offset = 0;
  for (const entry of entries) {
    const name = String(entry.name ?? basename(entry.path ?? "file")).replace(/[\\/\0]/g, "_");
    const encodedName = Buffer.from(name);
    if (!encodedName.length || encodedName.length > 65535) throw new Error("Invalid ZIP entry name.");
    const size = entry.content === undefined ? statSync(entry.path).size : Buffer.byteLength(entry.content);
    if (size > 0xffffffff || offset + size > 0xffffffff) throw new Error("ZIP32 archive size limit exceeded.");
    const crc = entry.content === undefined
      ? await crc32File(entry.path)
      : crc32(Buffer.from(entry.content));
    const header = localHeader(name, size, crc, dateTime.time, dateTime.date);
    prepared.push({ ...entry, name, size, crc, header, offset });
    offset += header.length + size;
  }
  const centralOffset = offset;
  for (const entry of prepared) {
    yield entry.header;
    if (entry.content !== undefined) yield Buffer.from(entry.content);
    else for await (const chunk of createReadStream(entry.path)) yield chunk;
  }
  for (const entry of prepared) yield centralHeader(entry.name, entry.size, entry.crc, dateTime.time, dateTime.date, entry.offset);
  const centralSize = prepared.reduce((sum, entry) => sum + 46 + Buffer.byteLength(entry.name), 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(prepared.length, 8);
  end.writeUInt16LE(prepared.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  yield end;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
