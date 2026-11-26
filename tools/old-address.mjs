#!/usr/bin/env node
// The move to the new address, in Chromium (the move's yardsticks): an
// installed app at the old address, its Library saved, is sent on and its
// Library moves across; a link to the old address opens its loop at the new
// one; "Not now" leaves the Library where it was and stops asking; and a fresh
// browser at the new address plays.
//
// Two local servers stand in for the two addresses: the old one serves this
// repository's app (as the testers have it installed today) until the "launch",
// then old-address/worker.js, as Cloudflare will; the new one serves the app.
// The old one is 127.0.0.1 and the new one localhost, two origins, so their
// storage is apart as the real two are. "Installed" is the app's service worker
// in control and the page told its display mode is standalone (headless
// Chromium installs nothing, and its emulation has no display mode).
//
//   node tools/old-address.mjs
//
// Needs Playwright's Chromium (as tools/a11y.mjs). Not part of the gate:
// test/old-address.test.mjs is the Worker's own check, in Node.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import worker from '../old-address/worker.js';
import { encodeSong } from '../js/share.js';
import { newSpec } from '../js/gen.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = 'http://127.0.0.1:8611';
const NEW = 'http://localhost:8612';
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
};

let failures = 0;
function check(label, condition, detail = '') {
  console.log(condition ? `  pass  ${label}` : `  FAIL  ${label} ${detail}`);
  if (!condition) failures++;
}

function staticFile(req, res, origin) {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, origin).pathname));
  if (file.endsWith(path.sep)) file = path.join(file, 'index.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

// The old address: the app, or (moved) the Worker, given what Cloudflare gives it.
let moved = false;
const seen = [];
async function oldAddress(req, res) {
  if (!moved) return staticFile(req, res, OLD);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  seen.push({ path: req.url, mode: req.headers['sec-fetch-mode'] || '', dest: req.headers['sec-fetch-dest'] || '' });
  const answer = await worker.fetch(new Request(`${OLD}${req.url}`, { method: req.method, headers }), { NEW_ORIGIN: NEW });
  res.writeHead(answer.status, Object.fromEntries(answer.headers));
  res.end(Buffer.from(await answer.arrayBuffer()));
}

const listen = (handler, port) => new Promise((resolve) => {
  const server = http.createServer(handler);
  server.listen(port, '127.0.0.1', () => resolve(server));
});

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ['playwright', 'playwright-core']) {
    try { return require(id); } catch { /* the next */ }
  }
  console.error('old-address: Playwright is not installed.  npm install --no-save playwright@1.56.1');
  process.exit(3);
  return null;
}

const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/library-v183.json'), 'utf8'));
const spec = newSpec(424242, ['rainy']);
const CODE = encodeSong(spec);
const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), key);
const toast = (page) => page.waitForFunction(() => {
  const t = document.getElementById('toast');
  return t && t.classList.contains('show') && t.textContent.trim();
}, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => '');

// An installed app at the old address today: the site, its worker in control,
// the Library saved.
async function installOld(ctx) {
  moved = false;
  const page = await ctx.newPage();
  await page.goto(`${OLD}/`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.evaluate(({ saves, albums }) => {
    localStorage.setItem('driftloom.saves.v1', JSON.stringify(saves));
    localStorage.setItem('driftloom.albums.v1', JSON.stringify(albums));
  }, { saves: lib.saves, albums: lib.albums });
  return page;
}

// Chromium's emulation has no display mode, so the page's question is
// answered as an installed app's would be.
async function standalone(page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
  });
}

async function main() {
  const { chromium } = loadPlaywright();
  const servers = [await listen(oldAddress, 8611), await listen((q, s) => staticFile(q, s, NEW), 8612)];
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('\nThe installed app at the old address, on launch day');
    {
      const ctx = await browser.newContext();
      const page = await installOld(ctx);
      check('before: the old app is installed, its worker in control, 20 loops saved',
        (await page.evaluate(() => !!navigator.serviceWorker.controller)) && (await stored(page, 'driftloom.saves.v1')).length === 20);
      moved = true;
      seen.length = 0;
      await standalone(page);
      await page.goto(`${OLD}/`);
      await page.waitForSelector('#main:not([hidden])', { timeout: 15000 });
      const nav = seen.find((r) => r.path === '/');
      check('its start page comes from the network through the old worker, as a navigation', !!nav && nav.mode === 'navigate', JSON.stringify(seen.slice(0, 4)));
      check('it says where the app went', (await page.textContent('h1')).includes('Ballad Falls') && await page.isVisible('#installed'));
      check('and offers the Library once: "20 loops"', await page.isVisible('#offer') && (await page.textContent('#count')) === '20 loops');
      await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0 && (await caches.keys()).length === 0, null, { timeout: 20000 })
        .then(() => check('the old service worker is gone and the cached app with it', true))
        .catch(async () => check('the old service worker is gone and the cached app with it', false,
          JSON.stringify(await page.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).length, caches: await caches.keys() })))));
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#file')]);
      const file = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      check('"save a backup file" saves the backup restore reads', file.format === 'driftloom.v1' && file.loops.length === 20 && file.albums.length === 3);
      await Promise.all([page.waitForURL(`${NEW}/**`), page.click('#bring')]);
      const said = await toast(page);
      check('"Bring it": at the new address, it says so', said.startsWith('Library moved'), said);
      const saves = await stored(page, 'driftloom.saves.v1');
      const albums = await stored(page, 'driftloom.albums.v1');
      check('the 20 loops are there, Thai and emoji names too', saves.length === 20 && saves.some((e) => e.id === 'fx17' && e.spec.name === lib.saves.find((x) => x.id === 'fx17').spec.name));
      check('and the album "Rainy Sunday" with its 10', albums.some((a) => a.title === 'Rainy Sunday' && a.ids.length === 10));
      check('the link is cleaned from the address bar', page.url() === `${NEW}/`, page.url());
      await page.reload();
      check('kept after a reload', (await stored(page, 'driftloom.saves.v1')).length === 20);

      await page.goto(`${OLD}/`);
      await page.waitForSelector('#main:not([hidden])', { timeout: 15000 });
      check('opened again: it says where, offers nothing, a key to go', !(await page.isVisible('#offer')) && (await page.getAttribute('#open', 'href')) === `${NEW}/`);
      await ctx.close();
    }

    console.log('\nThe last service worker, on its own');
    {
      // The installed app's own update check, with no page from the new
      // Worker yet (an app left open since before the launch).
      const ctx = await browser.newContext();
      const page = await installOld(ctx);
      moved = true;
      seen.length = 0;
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
      const gone = await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0 && (await caches.keys()).length === 0, null, { timeout: 20000 })
        .then(() => true).catch(() => false);
      check('the update check fetches /sw.js from the new Worker', seen.some((r) => r.path.startsWith('/sw.js')), JSON.stringify(seen.map((r) => r.path)));
      check('and the last worker empties the caches and unregisters', gone);
      await page.reload();
      await page.waitForSelector('#main:not([hidden])', { timeout: 15000 });
      check('the next load is the move page, not the cached app', (await page.textContent('h1')).includes('Ballad Falls'));
      await ctx.close();
    }

    console.log('\nA link to the old address, in a browser tab');
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      moved = true;
      const urls = [];
      page.on('framenavigated', (f) => { if (f === page.mainFrame()) urls.push(f.url()); });
      await page.goto(`${OLD}/?from=chat#c=${CODE}`);
      await page.waitForURL(`${NEW}/**`, { timeout: 15000 });
      const said = await toast(page);
      check('no Library: straight on, path, query and code kept', urls.includes(`${NEW}/?from=chat#c=${CODE}`), urls.join(' '));
      check('the loop opens there', said.startsWith('Imported') && (await stored(page, 'driftloom.saves.v1')).some((e) => e.spec.seed === spec.seed), said);
      await page.goto(`${OLD}/deep/path?x=1`);
      await page.waitForURL(`${NEW}/deep/path?x=1`, { timeout: 15000 });
      check('any other path goes to the same path', page.url() === `${NEW}/deep/path?x=1`, page.url());
      await ctx.close();
    }

    console.log('\nWith a Library: "Not now"');
    {
      const ctx = await browser.newContext();
      await (await installOld(ctx)).close();
      moved = true;
      const page = await ctx.newPage();
      await page.goto(`${OLD}/#c=${CODE}`);
      await page.waitForSelector('#offer:not([hidden])', { timeout: 15000 });
      check('a link opened in a tab offers first', await page.isVisible('#bring') && !(await page.isVisible('#installed')));
      await Promise.all([page.waitForURL(`${NEW}/**`), page.click('#later')]);
      await toast(page);
      check('"Not now": on with the code, only that loop at the new address', (await stored(page, 'driftloom.saves.v1')).length === 1);
      await page.goto(`${OLD}/`);
      await page.waitForURL(`${NEW}/**`, { timeout: 15000 });
      check('the next visit goes straight on (offered once)', page.url().startsWith(NEW));
      await page.goto(`${OLD}/library`);
      await page.waitForSelector('#offer:not([hidden])', { timeout: 15000 });
      check('the Library is still at the old address, and /library offers it again',
        (await stored(page, 'driftloom.saves.v1')).length === 20 && (await page.textContent('#count')) === '20 loops');
      await Promise.all([page.waitForURL(`${NEW}/**`), page.click('#bring')]);
      await toast(page);
      check('brought then: 21 loops at the new address', (await stored(page, 'driftloom.saves.v1')).length === 21);
      await ctx.close();
    }

    console.log('\nA fresh browser at the new address');
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${NEW}/`);
      check('the title is the new name', (await page.title()) === 'Ballad Falls', await page.title());
      await page.waitForFunction(() => !document.getElementById('playBtn').disabled, null, { timeout: 20000 }).catch(() => {});
      await page.click('#playBtn');
      const playing = await page.waitForFunction(() => document.getElementById('playBtn').getAttribute('aria-label') === 'Pause', null, { timeout: 20000 })
        .then(() => true).catch(() => false);
      check('Play plays', playing);
      await ctx.close();
    }
  } finally {
    await browser.close();
    for (const s of servers) s.close();
  }
  if (failures) {
    console.log(`\n${failures} failed`);
    process.exit(1);
  }
  console.log('\nall passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
