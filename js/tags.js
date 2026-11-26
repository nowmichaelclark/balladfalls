// An exported file's tags (Mikey, 2026-11-23: "that album and its songs
// should be properly tagged with things like track number, etc."): what a
// music player shows of a loop or an album's track. They are written beside
// the samples, never in them.
//
//   FLAC  a VORBIS_COMMENT block and a PICTURE block after STREAMINFO (the
//         core writes STREAMINFO as the last block; `notLast` clears that
//         bit, and the blocks here follow it)
//   Opus  the same comments in OpusTags (js/ogg.js), the picture as
//         METADATA_BLOCK_PICTURE, the FLAC block's body in base64, which is
//         how Ogg players read a cover
//   MIDI  the track's name (js/midi.js)
//
// The tags (`tagsOf`):
// - TITLE: the loop's name;
// - ARTIST and ALBUMARTIST: the app's one name constant, given in (never
//   written here);
// - ALBUM, TRACKNUMBER and TRACKTOTAL: an album's;
// - DATE: the day it was exported;
// - COMMENT: the loop's code, so that the file says how to play it again.
// All are UTF-8, so Thai and emoji names travel whole. The picture is the
// loop's own cover, drawn by js/cover.js as the Library draws it.
//
// This module is pure: no DOM, no file. The export's Worker and
// tools/export.mjs both use it, and test/tags.test.mjs holds the bytes.

const utf8 = new TextEncoder();

// FLAC's metadata block types (the FLAC format, section "METADATA_BLOCK").
const VORBIS_COMMENT = 4;
const PICTURE = 6;
// A picture's type: the front cover.
const FRONT_COVER = 3;

// What a file's vendor string says made it.
export const VENDOR = 'dlcore';

// The tags for a file. `loop` is { name, code }. `album` is { title, track,
// total }, or null for a single loop. `artist` is the app's name. `date` is
// a Date.
export function tagsOf({ loop, album = null, artist = '', date = new Date() }) {
  const t = [];
  const put = (key, value) => {
    const v = String(value == null ? '' : value).trim();
    if (v) t.push([key, v]);
  };
  put('TITLE', loop && loop.name);
  put('ARTIST', artist);
  if (album) {
    put('ALBUM', album.title);
    put('ALBUMARTIST', artist);
    put('TRACKNUMBER', album.track);
    put('TRACKTOTAL', album.total);
  }
  put('DATE', dayOf(date));
  put('COMMENT', loop && loop.code);
  return t;
}

// A date as Vorbis comments write it: YYYY-MM-DD, the local day.
function dayOf(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

// The tags as comments: "KEY=value".
export const comments = (tags) => tags.map(([k, v]) => `${k}=${v}`);

// A Vorbis comment's body (no magic, no framing bit): the vendor and the
// comments, each a 32-bit little-endian length and its UTF-8. OpusTags and
// FLAC's VORBIS_COMMENT block are both this.
export function vorbisBody(vendor, list) {
  const v = utf8.encode(vendor);
  const c = list.map((s) => utf8.encode(s));
  const b = new Uint8Array(4 + v.length + 4 + c.reduce((n, x) => n + 4 + x.length, 0));
  const dv = new DataView(b.buffer);
  let at = 0;
  dv.setUint32(at, v.length, true);
  b.set(v, at + 4);
  at += 4 + v.length;
  dv.setUint32(at, c.length, true);
  at += 4;
  for (const x of c) {
    dv.setUint32(at, x.length, true);
    b.set(x, at + 4);
    at += 4 + x.length;
  }
  return b;
}

// A picture's body as FLAC's PICTURE block holds it (big-endian): its type,
// media type, description, size, depth, colors and bytes. `picture`:
// { mime, width, height, bytes: Uint8Array }.
export function pictureBody(picture) {
  const mime = utf8.encode(picture.mime || 'image/jpeg');
  const description = utf8.encode(picture.description || '');
  const data = picture.bytes;
  const b = new Uint8Array(32 + mime.length + description.length + data.length);
  const dv = new DataView(b.buffer);
  let at = 0;
  const u32 = (n) => { dv.setUint32(at, n >>> 0, false); at += 4; };
  u32(FRONT_COVER);
  u32(mime.length);
  b.set(mime, at);
  at += mime.length;
  u32(description.length);
  b.set(description, at);
  at += description.length;
  u32(picture.width || 0);
  u32(picture.height || 0);
  u32(24);
  u32(0);
  u32(data.length);
  b.set(data, at);
  return b;
}

// One FLAC metadata block: its header (the last bit, its type, a 24-bit
// length) and its body.
function block(type, body, last) {
  if (body.length >= 1 << 24) throw new Error('a metadata block too large for FLAC');
  const b = new Uint8Array(4 + body.length);
  b[0] = (last ? 0x80 : 0) | type;
  b[1] = (body.length >> 16) & 255;
  b[2] = (body.length >> 8) & 255;
  b[3] = body.length & 255;
  b.set(body, 4);
  return b;
}

// The metadata blocks a FLAC file holds after STREAMINFO: the comments, and
// the picture where there is one (the last block).
export function flacBlocks(tags, picture = null) {
  const parts = [block(VORBIS_COMMENT, vorbisBody(VENDOR, comments(tags)), !picture)];
  if (picture) parts.push(block(PICTURE, pictureBody(picture), true));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// A copy of the core's file header (`fLaC` and STREAMINFO, 42 bytes), with
// STREAMINFO no longer the last block, so that blocks can follow it.
export function notLast(header) {
  const h = Uint8Array.from(header);
  if (h.length >= 5 && h[0] === 0x66 && h[1] === 0x4c && h[2] === 0x61 && h[3] === 0x43) h[4] &= 0x7f;
  return h;
}

// Bytes as base64 (btoa in a page, a Worker and Node alike).
export function base64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// The comments that OpusTags holds: the tags, and the picture as Ogg
// players read one.
export function opusComments(tags, picture = null) {
  const list = comments(tags);
  if (picture) list.push(`METADATA_BLOCK_PICTURE=${base64(pictureBody(picture))}`);
  return list;
}

// A picture's width and height from its bytes (a PNG's IHDR, a JPEG's start
// of frame), or zeros.
export function pictureSize(bytes) {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20), mime: 'image/png' };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) { at++; continue; }
      const marker = bytes[at + 1];
      const len = (bytes[at + 2] << 8) | bytes[at + 3];
      // The start of frame markers (C0 to CF but C4, C8 and CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (bytes[at + 5] << 8) | bytes[at + 6], width: (bytes[at + 7] << 8) | bytes[at + 8], mime: 'image/jpeg' };
      }
      at += 2 + len;
    }
    return { width: 0, height: 0, mime: 'image/jpeg' };
  }
  return { width: 0, height: 0, mime: 'application/octet-stream' };
}

// A picture from its bytes.
export function pictureOf(bytes) {
  if (!bytes || !bytes.length) return null;
  const { width, height, mime } = pictureSize(bytes);
  return { mime, width, height, bytes };
}
