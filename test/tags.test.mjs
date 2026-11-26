// An exported file's tags (js/tags.js): the tags a loop and an
// album's track get, FLAC's VORBIS_COMMENT and PICTURE blocks read back
// from the format's spec, Opus's picture comment, a picture's size from its
// bytes, and OpusTags with a cover over several Ogg pages (js/ogg.js) joined
// again by the reader. The files themselves, read by ffprobe, are
// tools/export.mjs's.
//
//   node test/tags.test.mjs

import { tagsOf, comments, flacBlocks, notLast, opusComments, pictureBody, pictureSize, pictureOf, vorbisBody, VENDOR } from '../js/tags.js';
import { OggOpus } from '../js/ogg.js';
import { pages, joined } from '../tools/ogg-read.mjs';

let failures = 0;
let checks = 0;
const check = (ok, what) => {
  checks++;
  if (!ok) {
    failures++;
    console.log(`  FAIL ${what}`);
  }
};
const dec = new TextDecoder();

console.log('tags: what a file says');
const day = new Date(2026, 10, 24, 9, 30);
const single = tagsOf({ loop: { name: 'ham-nuir', code: 'FBAAAAQBMNN' }, artist: 'App', date: day });
check(JSON.stringify(single) === JSON.stringify([['TITLE', 'ham-nuir'], ['ARTIST', 'App'], ['DATE', '2026-11-24'], ['COMMENT', 'FBAAAAQBMNN']]),
  `a single loop: its name, the app, the day, its code; no album (${JSON.stringify(single)})`);
const track = tagsOf({ loop: { name: 'ฝนตก 🎧', code: 'E9frFmBcg' }, album: { title: 'Rainy Sunday', track: 2, total: 4 }, artist: 'App', date: day });
check(comments(track).join('|') === 'TITLE=ฝนตก 🎧|ARTIST=App|ALBUM=Rainy Sunday|ALBUMARTIST=App|TRACKNUMBER=2|TRACKTOTAL=4|DATE=2026-11-24|COMMENT=E9frFmBcg',
  `an album's track: the album, its number and the total (${comments(track).join('|')})`);
check(tagsOf({ loop: { name: '', code: '' }, artist: '', date: day }).length === 1, 'an empty tag is left out, not written empty');

// A Vorbis comment body read back: the vendor and each comment, UTF-8.
function readVorbis(b, at = 0) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const vl = v.getUint32(at, true);
  const vendor = dec.decode(b.subarray(at + 4, at + 4 + vl));
  let p = at + 4 + vl;
  const n = v.getUint32(p, true);
  p += 4;
  const list = [];
  for (let i = 0; i < n; i++) {
    const l = v.getUint32(p, true);
    list.push(dec.decode(b.subarray(p + 4, p + 4 + l)));
    p += 4 + l;
  }
  return { vendor, list, end: p };
}
const body = vorbisBody(VENDOR, comments(track));
const back = readVorbis(body);
check(back.vendor === VENDOR && back.list.join('|') === comments(track).join('|') && back.end === body.length, 'a Vorbis comment body reads back whole (Thai and emoji in UTF-8)');

console.log('tags: FLAC\'s blocks');
// A small PNG's header: 8 bytes of signature, IHDR's length, type, width, height.
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 2, 0x58, 0, 0, 2, 0x58, 8, 2, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, 1, 0x2c, 2, 0x58, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]);
check(JSON.stringify(pictureSize(png)) === JSON.stringify({ width: 600, height: 600, mime: 'image/png' }), `a PNG's size from IHDR (${JSON.stringify(pictureSize(png))})`);
check(JSON.stringify(pictureSize(jpeg)) === JSON.stringify({ height: 300, width: 600, mime: 'image/jpeg' }), `a JPEG's size from its start of frame (${JSON.stringify(pictureSize(jpeg))})`);
const pic = pictureOf(jpeg);
const blocks = flacBlocks(track, pic);
const bv = new DataView(blocks.buffer);
const len0 = (blocks[1] << 16) | (blocks[2] << 8) | blocks[3];
check(blocks[0] === 4, 'the first block is VORBIS_COMMENT, not the last');
check(readVorbis(blocks, 4).list.join('|') === comments(track).join('|'), 'its comments read back');
const p = 4 + len0;
const len1 = (blocks[p + 1] << 16) | (blocks[p + 2] << 8) | blocks[p + 3];
check(blocks[p] === (0x80 | 6) && p + 4 + len1 === blocks.length, 'then PICTURE, the last block, ending the run');
const pb = p + 4;
const mimeLen = bv.getUint32(pb + 4);
const mime = dec.decode(blocks.subarray(pb + 8, pb + 8 + mimeLen));
const q = pb + 8 + mimeLen;
const descLen = bv.getUint32(q);
const r = q + 4 + descLen;
check(bv.getUint32(pb) === 3 && mime === 'image/jpeg' && bv.getUint32(r) === 600 && bv.getUint32(r + 4) === 300 && bv.getUint32(r + 8) === 24 && bv.getUint32(r + 16) === jpeg.length
  && Buffer.compare(Buffer.from(blocks.subarray(r + 20)), Buffer.from(jpeg)) === 0, 'the picture: the front cover, its type, its size and its bytes');
check(flacBlocks(single)[0] === (0x80 | 4), 'with no picture, the comments are the last block');
const head = new Uint8Array(42);
head.set([0x66, 0x4c, 0x61, 0x43, 0x80, 0, 0, 34]);
const cleared = notLast(head);
check(cleared[4] === 0 && head[4] === 0x80 && cleared.length === 42, 'STREAMINFO made not the last block, on a copy');

console.log('tags: Opus');
const oc = opusComments(track, pic);
const mbp = oc[oc.length - 1];
check(mbp.startsWith('METADATA_BLOCK_PICTURE=') && Buffer.compare(Buffer.from(mbp.slice(23), 'base64'), Buffer.from(pictureBody(pic))) === 0,
  'the cover as METADATA_BLOCK_PICTURE: the PICTURE block\'s body in base64');
// A large cover: OpusTags over several pages, joined again.
const big = { mime: 'image/jpeg', width: 600, height: 600, bytes: new Uint8Array(200000).map((_, i) => (i * 7) & 255) };
const w = new OggOpus({ channels: 2, preSkip: 312, serial: 7, comments: opusComments(track, big) });
const hdr = w.header();
const ps = pages(hdr);
const js = joined(ps);
check(ps.length >= 5 && ps.slice(2).every((pg) => (pg.flags & 1) === 1) && (ps[1].flags & 1) === 0 && ps.every((pg) => pg.granule === 0),
  `a 200 KB cover: OpusTags over ${ps.length - 1} pages, each after the first marked continued, every granule 0`);
check(js.length === 2 && dec.decode(js[1].packet.subarray(0, 8)) === 'OpusTags' && js[1].page === ps.length - 1, 'joined again: OpusHead and one OpusTags, ending on the last header page');
const tagsBack = js[1] && readVorbis(js[1].packet, 8);
check(tagsBack && tagsBack.list.length === oc.length && tagsBack.list[tagsBack.list.length - 1].length === `METADATA_BLOCK_PICTURE=`.length + Math.ceil(pictureBody(big).length / 3) * 4,
  'its comments whole, the picture\'s among them');
check(ps.every((pg, i) => pg.sequence === i), 'the pages in sequence');
// The audio after it numbers on from the header pages.
const audio = w.add(new Uint8Array([0xfc, 1, 2, 3]));
const tail = w.finish(960);
const all = pages(new Uint8Array([...hdr, ...audio.flatMap((a) => [...a]), ...tail.flatMap((a) => [...a])]));
check(all.every((pg, i) => pg.sequence === i) && (all[all.length - 1].flags & 4) === 4, 'the audio pages number on after them, the last the end of stream');
// A packet of exactly 255 x 255 bytes needs a page with a single 0 segment to end it.
const edge = new OggOpus({ channels: 1, preSkip: 0, comments: ['X='.padEnd(255 * 255 - 8 - 4 - 'WebCodecs Opus'.length - 4 - 4, 'x')] });
const eps = pages(edge.header());
check(eps.length === 3 && eps[2].segments === 1 && joined(eps)[1].packet.length === 255 * 255, 'a packet of exactly 65,025 bytes ends on a page of one 0 segment');

console.log(failures ? `\ntags: ${failures} of ${checks} checks failed` : `\ntags: all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
