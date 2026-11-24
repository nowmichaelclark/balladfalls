#!/usr/bin/env node
// Every icon the app uses, made from one source, icons/icon.svg (item 120):
// the page's favicons, the web app's icons (192, 512, the maskable 512),
// the apple-touch-icon, Android's adaptive icon (its background, foreground
// and monochrome layers, at every density), the status bar's icon, and the
// F-Droid listing's icon and feature graphic. A change to the icon is an
// edit to icons/icon.svg and a run of this script; commit what it writes.
//
//   node tools/icons.mjs                  write every icon, after the checks
//   node tools/icons.mjs --check          the checks only (nothing written)
//   node tools/icons.mjs --sheet out.png  also write a contact sheet: every
//                                         size, launchers on light and dark,
//                                         the themed icon, the listing
//
// The checks: what icons/icon.svg marks with class="key" (the sun, the
// falls, its first ripple) lies inside the maskable icon's safe zone (the
// circle of 40% of its size, the W3C's) and inside Android's adaptive-icon
// safe zone (the 66 dp circle of the 108 dp layer), and the whole
// monochrome layer inside Android's too. Exits 1 if one fails.
//
// Needs ImageMagick 7 (`magick`) with librsvg, which renders the SVG; the
// same version writes the same bytes. Nothing else: Node 22, no packages.

import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'icons/icon.svg');
const svg = readFileSync(SOURCE, 'utf8');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const sheetAt = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null;
const tmp = mkdtempSync(join(tmpdir(), 'icons-'));

// Crops of the scene, in the source's units ([x, y, width, height]). The
// icon is 0 0 512 512; the scene is drawn out to -128..640 each way.
const ICON = [0, 0, 512, 512];
const MASKABLE = [-32, -32, 576, 576]; // a little room past the icon
const ADAPTIVE = [-128, -128, 768, 768]; // the 108 dp layer: its 72 dp is the icon
const FEATURE = [-128, 115, 768, 375]; // 1024 x 500
const STATUS = [40, 38, 440, 440]; // the monochrome drawing, filling 24 dp

// What each picture shows of the source's three groups.
const SHOW = {
  full: '#monochrome{display:none}',
  background: '#foreground,#monochrome{display:none}',
  foreground: '#background,#monochrome{display:none}',
  monochrome: '#background,#foreground{display:none} #monochrome{display:inline}',
  key: '#background,#monochrome{display:none} #foreground *{visibility:hidden} #foreground .key{visibility:visible}',
};

function variant(crop, w, h, show) {
  let s = svg.replace('viewBox="0 0 512 512"', `viewBox="${crop.join(' ')}" width="${w}" height="${h}"`);
  if (s === svg) throw new Error('icons/icon.svg: its root must say viewBox="0 0 512 512"');
  return s.replace(/<svg[^>]*>/, (open) => `${open}\n<style>${SHOW[show]}</style>`);
}

let n = 0;
function render(crop, w, h, show, out, format = 'PNG32') {
  const file = join(tmp, `v${n++}.svg`);
  writeFileSync(file, variant(crop, w, h, show));
  mkdirSync(dirname(out), { recursive: true });
  execFileSync('magick', ['-background', 'none', file, '-strip', '-define', 'png:exclude-chunks=date,time', `${format}:${out}`]);
  const [pw, ph] = execFileSync('magick', ['identify', '-format', '%w %h', out]).toString().split(' ').map(Number);
  if (pw !== w || ph !== h) throw new Error(`${out}: ${pw} x ${ph}, not ${w} x ${h}`);
  return out;
}

// The largest alpha of `show` outside the circle of `fraction` of the size,
// centered: 0 when all of it is inside.
function outside(crop, show, fraction) {
  const S = 512;
  const png = render(crop, S, S, show, join(tmp, `check${n}.png`));
  const c = S / 2;
  const r = fraction * S;
  return Number(execFileSync('magick', [png, '-alpha', 'extract',
    '(', '-size', `${S}x${S}`, 'xc:white', '-fill', 'black', '-draw', `circle ${c},${c} ${c},${c + r}`, ')',
    '-compose', 'multiply', '-composite', '-format', '%[fx:maxima]', 'info:']).toString());
}

const ANDROID_SAFE = 33 / 108; // the 66 dp circle's radius, of the 108 dp layer
const checks = [
  ['the key inside the maskable icon\'s safe zone (40%)', outside(MASKABLE, 'key', 0.4)],
  ['the key inside Android\'s safe zone (66 of 108 dp)', outside(ADAPTIVE, 'key', ANDROID_SAFE)],
  ['the monochrome layer inside Android\'s safe zone', outside(ADAPTIVE, 'monochrome', ANDROID_SAFE)],
];
let failed = 0;
for (const [what, alpha] of checks) {
  const ok = alpha <= 0.02; // an edge's antialiasing, no more
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `: alpha ${alpha.toFixed(3)} outside it`}`);
}
if (failed) { rmSync(tmp, { recursive: true }); process.exit(1); }
if (checkOnly) { rmSync(tmp, { recursive: true }); process.exit(0); }

// The icons.
const at = (p) => join(root, p);
const res = 'android/app/src/main/res';
const listing = 'fastlane/metadata/android/en-US/images';
const written = [
  render(ICON, 32, 32, 'full', at('icons/favicon-32.png')),
  render(ICON, 180, 180, 'full', at('icons/apple-touch-icon.png'), 'PNG24'),
  render(ICON, 192, 192, 'full', at('icons/icon-192.png'), 'PNG24'),
  render(ICON, 512, 512, 'full', at('icons/icon-512.png'), 'PNG24'),
  render(MASKABLE, 512, 512, 'full', at('icons/maskable-512.png'), 'PNG24'),
  render(ICON, 512, 512, 'full', at(`${listing}/icon.png`), 'PNG24'),
  render(FEATURE, 1024, 500, 'full', at(`${listing}/featureGraphic.png`), 'PNG24'),
];
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITIES)) {
  const px = 108 * k;
  written.push(render(ADAPTIVE, px, px, 'background', at(`${res}/mipmap-${d}/ic_launcher_background.png`), 'PNG24'));
  written.push(render(ADAPTIVE, px, px, 'foreground', at(`${res}/mipmap-${d}/ic_launcher_foreground.png`)));
  written.push(render(ADAPTIVE, px, px, 'monochrome', at(`${res}/mipmap-${d}/ic_launcher_monochrome.png`)));
  written.push(render(STATUS, 24 * k, 24 * k, 'monochrome', at(`${res}/drawable-${d}/ic_stat_driftloom.png`)));
}
console.log(`wrote ${written.length} icons`);

if (sheetAt) sheet(sheetAt);
rmSync(tmp, { recursive: true });

// The contact sheet: each row a set of tiles, every tile labeled.
function sheet(out) {
  const t = (name) => join(tmp, `${name}.png`);
  const mk = (...a) => execFileSync('magick', a.flat());
  const LIGHT = '#e9e6ef';
  const DARK = '#1f1f24';
  const tile = (img, w, h, bg, label, name) => {
    mk(['-size', `${w}x${h}`, `xc:${bg}`, '(', img, '-resize', `${w - 8}x${h - 8}>`, ')', '-gravity', 'center', '-composite',
      '+size', '-background', '#fafafa', '-fill', '#444', '-pointsize', '13', `label:${label}`, '-gravity', 'center', '-append',
      '-bordercolor', '#fafafa', '-border', '8', t(name)]);
    return t(name);
  };
  // Android's launcher: the layers stacked, the 72 dp middle shown, in a mask.
  const layer = (p) => at(`${res}/mipmap-xxxhdpi/${p}.png`);
  mk([layer('ic_launcher_background'), layer('ic_launcher_foreground'), '-composite', '-gravity', 'center', '-crop', '288x288+0+0', '+repage', t('launch')]);
  const masked = (shape, size, name) => {
    const r = shape === 'circle' ? size / 2 : size * 0.3;
    mk([t('launch'), '-resize', `${size}x${size}`,
      '(', '-size', `${size}x${size}`, 'xc:none', '-fill', 'white', '-draw', `roundrectangle 0,0 ${size - 1},${size - 1} ${r},${r}`, ')',
      '-compose', 'DstIn', '-composite', t(name)]);
    return t(name);
  };
  const themed = (fg, bg, size, name) => {
    mk([layer('ic_launcher_monochrome'), '-gravity', 'center', '-crop', '288x288+0+0', '+repage', '-resize', `${size}x${size}`,
      '-fill', fg, '-colorize', '100', t(`${name}-m`)]);
    mk(['-size', `${size}x${size}`, 'xc:none', '-fill', bg, '-draw', `circle ${size / 2},${size / 2} ${size / 2},0`, t(`${name}-m`), '-compose', 'over', '-composite', t(name)]);
    return t(name);
  };
  const icon = (p) => at(`icons/${p}`);
  mk([icon('favicon-32.png'), '-resize', '16x16', t('fav16')]);
  mk([t('fav16'), '-filter', 'point', '-resize', '64x64', t('fav16x4')]);
  mk([icon('maskable-512.png'), '-resize', '256x256', '-fill', 'none', '-stroke', '#ffffff', '-strokewidth', '1.5',
    '-draw', 'circle 128,128 128,25.6', t('mask')]);
  mk([at(`${res}/drawable-xxxhdpi/ic_stat_driftloom.png`), '-filter', 'point', '-resize', '96x96', t('statx4')]);
  const rows = [
    [tile(t('fav16'), 40, 40, LIGHT, 'favicon 16', 'a1'), tile(t('fav16x4'), 72, 72, LIGHT, '16, enlarged', 'a2'),
      tile(icon('favicon-32.png'), 48, 48, LIGHT, 'favicon 32', 'a3'), tile(icon('apple-touch-icon.png'), 196, 196, LIGHT, 'apple-touch 180', 'a4'),
      tile(icon('icon-192.png'), 208, 208, LIGHT, 'icon 192', 'a5'), tile(t('mask'), 272, 272, LIGHT, 'maskable 512, its safe zone', 'a6')],
    [tile(masked('circle', 96, 'c96'), 120, 120, LIGHT, 'launcher, light', 'b1'), tile(masked('squircle', 96, 's96'), 120, 120, LIGHT, 'rounded', 'b2'),
      tile(masked('circle', 48, 'c48'), 72, 72, LIGHT, '48 dp at 1x', 'b3'),
      tile(t('c96'), 120, 120, DARK, 'launcher, dark', 'b4'), tile(t('s96'), 120, 120, DARK, 'rounded', 'b5'), tile(t('c48'), 72, 72, DARK, '48 dp at 1x', 'b6'),
      tile(themed('#2d3a5c', '#d6e0ff', 48, 'th1'), 72, 72, '#f4f4f8', 'themed 48, light', 'b7'),
      tile(themed('#d6e0ff', '#2d3550', 48, 'th2'), 72, 72, '#121318', 'themed 48, dark', 'b8'),
      tile(at(`${res}/drawable-mdpi/ic_stat_driftloom.png`), 40, 40, '#202124', 'status 24', 'b9'),
      tile(t('statx4'), 112, 112, '#202124', 'status, enlarged', 'b10')],
    [tile(at(`${listing}/icon.png`), 264, 264, LIGHT, 'listing icon 512', 'c1'),
      tile(at(`${listing}/featureGraphic.png`), 640, 320, LIGHT, 'feature graphic 1024 x 500', 'c2')],
  ].map((tiles, i) => {
    mk(['-background', '#fafafa', ...tiles, '-gravity', 'south', '+append', t(`row${i}`)]);
    return t(`row${i}`);
  });
  mk(['-background', '#fafafa', ...rows, '-gravity', 'west', '-append', '-bordercolor', '#fafafa', '-border', '12', '+repage', out]);
  console.log(`wrote the contact sheet: ${out}`);
}
