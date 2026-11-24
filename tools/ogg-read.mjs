// A reader for Ogg files, written from the specs (RFC 3533) and used to hold
// the writer (js/ogg.js) to them: test/ogg.test.mjs, and tools/rows.mjs for
// the files the app exports. Every page's checksum is verified.

import { crc32 } from '../js/ogg.js';

// Pages of an Ogg file, every checksum verified: { flags, granule, serial,
// sequence, packets: [Uint8Array], continued, segments }.
export function pages(bytes) {
  const out = [];
  let at = 0;
  while (at < bytes.length) {
    if (String.fromCharCode(...bytes.subarray(at, at + 4)) !== 'OggS') throw new Error(`no OggS at ${at}`);
    const v = new DataView(bytes.buffer, bytes.byteOffset + at);
    const n = bytes[at + 26];
    const table = bytes.subarray(at + 27, at + 27 + n);
    const data = table.reduce((s, x) => s + x, 0);
    const size = 27 + n + data;
    const copy = bytes.slice(at, at + size);
    const want = new DataView(copy.buffer).getUint32(22, true);
    new DataView(copy.buffer).setUint32(22, 0, true);
    if (crc32(copy) !== want) throw new Error(`bad CRC on the page at ${at}`);
    const packets = [];
    let p = at + 27 + n;
    let cur = 0;
    let open = false;
    for (const s of table) {
      cur += s;
      open = s === 255;
      if (!open) {
        packets.push(bytes.slice(p, p + cur));
        p += cur;
        cur = 0;
      }
    }
    // A packet that goes on to the next page (item 121: OpusTags with a
    // cover): its part on this page, for `joined`.
    const tail = open ? bytes.slice(p, p + cur) : null;
    out.push({
      flags: bytes[at + 5], version: bytes[at + 4], granule: v.getUint32(6, true) + v.getUint32(10, true) * 2 ** 32,
      serial: v.getUint32(14, true), sequence: v.getUint32(18, true), packets, open, tail, segments: n, size,
    });
    at += size;
  }
  return out;
}

// The stream's packets whole, joined across pages: [{ packet, page }], the
// page each ends on. A page marked continued carries on the packet the page
// before left open.
export function joined(ps) {
  const out = [];
  let carry = null;
  ps.forEach((pg, i) => {
    const continued = (pg.flags & 1) === 1;
    let list = pg.packets;
    if (continued && carry) {
      if (list.length) {
        out.push({ packet: cat(carry, list[0]), page: i });
        list = list.slice(1);
        carry = null;
      } else if (pg.tail) {
        carry = cat(carry, pg.tail);
        return;
      }
    }
    for (const packet of list) out.push({ packet, page: i });
    carry = pg.tail || null;
  });
  return out;
}

function cat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
