// An album as one zip (item 121; Mikey, 2026-11-23: "let the user choose"),
// written as each track is made: stored, not compressed (FLAC and Opus are
// compressed already), so the zip is the tracks' bytes and a few headers,
// and nothing is held but one track's place and checksum.
//
// A track is an entry: its local header (with its checksum and size left 0),
// its bytes as they come, then the header written again with them known (a
// write at its place, as FLAC's own header is: the private file, a chosen
// file, Android's file and memory can all do it). The central directory and
// its end come after the last track. Names are UTF-8 (the flag says so), the
// time the export's. No Zip64: an album over 4 GB is refused before it
// starts (js/export.js says so), and an entry or the whole is held under it.
//
// FLAC's header is written again too, once its length and MD5 are known,
// inside the entry (`patch`): the checksum the entry carries is of the bytes
// as they end, so the change is folded in by CRC-32's linearity (zlib's
// crc32_combine: the difference's checksum moved past the bytes after it),
// never by reading the file back.
//
// A track that fails mid-way (`drop`) keeps its bytes where they are, but
// the central directory leaves it out: a reader sees the tracks that were
// made, and nothing broken.
//
// Pure: it writes through `sink`, { write(bytes), writeAt(at, bytes) }, each
// may return a promise. test/zip.test.mjs and tools/export.mjs hold it, the
// latter against `unzip`.

// The standard CRC-32 (reflected, 0xEDB88320), as zip and PNG use it.
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

// The register over `bytes`, from `c`, with no conditioning (CRC-32 is that
// with ~0 before and after).
function raw(bytes, c) {
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return c >>> 0;
}

export function crc32(bytes, crc = 0) {
  return (raw(bytes, (crc ^ 0xffffffff) >>> 0) ^ 0xffffffff) >>> 0;
}

// GF(2) matrices for moving a register past zero bytes (zlib's).
function times(mat, vec) {
  let sum = 0;
  for (let i = 0; vec; i++, vec >>>= 1) if (vec & 1) sum ^= mat[i];
  return sum >>> 0;
}

function square(out, mat) {
  for (let n = 0; n < 32; n++) out[n] = times(mat, mat[n]);
}

// The register `c` moved past `len` zero bytes.
function zeros(c, len) {
  if (len <= 0 || !c) return c >>> 0;
  const odd = new Uint32Array(32);
  const even = new Uint32Array(32);
  odd[0] = 0xedb88320;
  for (let n = 1, row = 1; n < 32; n++, row <<= 1) odd[n] = row >>> 0;
  square(even, odd);
  square(odd, even);
  let n = len;
  for (;;) {
    square(even, odd);
    if (n & 1) c = times(even, c);
    n = Math.floor(n / 2);
    if (!n) break;
    square(odd, even);
    if (n & 1) c = times(odd, c);
    n = Math.floor(n / 2);
    if (!n) break;
  }
  return c >>> 0;
}

// The checksum of `length` bytes whose checksum was `crc`, once the bytes at
// `at` (`before`) are `after` instead.
export function crcPatched(crc, length, at, before, after) {
  if (before.length !== after.length) throw new Error('a patch must keep the length');
  const d = new Uint8Array(before.length);
  for (let i = 0; i < d.length; i++) d[i] = before[i] ^ after[i];
  return (crc ^ zeros(raw(d, 0), length - at - d.length)) >>> 0;
}

// The most a plain zip holds.
export const ZIP_MOST = 0xffffffff;
const ENTRIES_MOST = 0xffff;

const utf8 = new TextEncoder();

// MS-DOS's time and date, as a zip keeps them.
function dos(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = Math.max(1980, Math.min(2107, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// A file name a zip may hold: no slashes, nothing a player trips on.
export function entryName(name) {
  return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim() || 'track';
}

export class ZipWriter {
  constructor(sink, { date = new Date() } = {}) {
    this.sink = sink;
    this.at = 0;
    this.entries = [];
    this.open = null;
    this.stamp = dos(date);
  }

  async put(bytes) {
    if (this.at + bytes.length > ZIP_MOST) throw tooLarge();
    await this.sink.write(bytes);
    this.at += bytes.length;
  }

  // A new entry: its local header written, the bytes to follow.
  async begin(name) {
    if (this.open) throw new Error('an entry is open');
    if (this.entries.length >= ENTRIES_MOST) throw tooLarge();
    const n = utf8.encode(entryName(name));
    const head = new Uint8Array(30 + n.length);
    const v = new DataView(head.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true); // version needed: 2.0
    v.setUint16(6, 0x0800, true); // the name is UTF-8
    v.setUint16(8, 0, true); // stored
    v.setUint16(10, this.stamp.time, true);
    v.setUint16(12, this.stamp.date, true);
    // 14: the checksum, 18 and 22: the sizes, written again at the end.
    v.setUint16(26, n.length, true);
    v.setUint16(28, 0, true);
    head.set(n, 30);
    this.open = { name: n, head: this.at, data: this.at + head.length, crc: 0, size: 0 };
    await this.put(head);
  }

  // The entry's next bytes.
  async add(bytes) {
    const e = this.open;
    if (!e) throw new Error('no entry is open');
    await this.put(bytes);
    e.crc = crc32(bytes, e.crc);
    e.size += bytes.length;
  }

  // Bytes of the entry written again at `at` (from the entry's start):
  // `before` was there, `after` is.
  async patch(at, before, after) {
    const e = this.open;
    if (!e) throw new Error('no entry is open');
    if (at + after.length > e.size) throw new Error('a patch past what was written');
    await this.sink.writeAt(e.data + at, after);
    e.crc = crcPatched(e.crc, e.size, at, before, after);
  }

  // The entry is whole: its local header says its checksum and size.
  async end() {
    const e = this.open;
    if (!e) throw new Error('no entry is open');
    this.open = null;
    const known = new Uint8Array(12);
    const v = new DataView(known.buffer);
    v.setUint32(0, e.crc, true);
    v.setUint32(4, e.size, true);
    v.setUint32(8, e.size, true);
    await this.sink.writeAt(e.head + 14, known);
    this.entries.push(e);
  }

  // The entry failed: its bytes stay, unlisted.
  drop() {
    this.open = null;
  }

  // The central directory and its end. Returns the zip's size.
  async finish() {
    if (this.open) this.drop();
    const start = this.at;
    for (const e of this.entries) {
      const c = new Uint8Array(46 + e.name.length);
      const v = new DataView(c.buffer);
      v.setUint32(0, 0x02014b50, true);
      v.setUint16(4, 0x0314, true); // made by: version 2.0, Unix
      v.setUint16(6, 20, true);
      v.setUint16(8, 0x0800, true);
      v.setUint16(10, 0, true);
      v.setUint16(12, this.stamp.time, true);
      v.setUint16(14, this.stamp.date, true);
      v.setUint32(16, e.crc, true);
      v.setUint32(20, e.size, true);
      v.setUint32(24, e.size, true);
      v.setUint16(28, e.name.length, true);
      // 30 extra, 32 comment, 34 disk, 36 internal: 0.
      v.setUint32(38, (0o100644 << 16) >>> 0, true); // a plain file, rw-r--r--
      v.setUint32(42, e.head, true);
      c.set(e.name, 46);
      await this.put(c);
    }
    const end = new Uint8Array(22);
    const v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, this.entries.length, true);
    v.setUint16(10, this.entries.length, true);
    v.setUint32(12, this.at - start, true);
    v.setUint32(16, start, true);
    await this.put(end);
    return this.at;
  }
}

function tooLarge() {
  const e = new Error('more than one zip can hold');
  e.name = 'ZipLimit';
  return e;
}
