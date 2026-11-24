// Every control named for a screen reader (session 30e, queue item 113:
// fewer words on screen is never fewer for a listener who can't see it).
// The real app in headless Chromium, taken through every screen and state a
// listener meets, and on each:
//
//   names         every button, switch, slider, tab, tick, link and box on
//                 screen is in the accessibility tree with a name that has a
//                 word or a number in it (Chromium's own computed name, not
//                 the markup's)
//   switches      every switch and tick says whether it is on, a layer's as
//                 its row shows it (session 30k: a speaker on the screen)
//   descriptions  a control whose explainer left the screen still has it as
//                 its computed description (DESCRIBED below)
//   markup        every control in the page, shown or not, has something to
//                 be named by; every id a label or description points at is
//                 there; nothing focusable sits inside aria-hidden
//   fit           Share, its Export view (each of the four states) and Album
//                 from seed hold their keys without scrolling or clipping
//                 (SIZES, each at three text sizes)
//
//   node tools/names.mjs [--shots DIR] [--verbose] [--port 8773]
//
// --shots: every screen at 360 px and a tablet's width, light and dark, and
// one sheet of them for each of the four; and Track length on short phones
// (360x640, 320x568), on and on and a time set (`short_*`).
//
// Chromium from Playwright (npm install --no-save playwright@1.56.1).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { encodeSong, encodeAlbum, linkOf } from '../js/share.js';
import { newSpec } from '../js/gen.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const PORT = Number(flag('--port', 8773));
const SHOTS = flag('--shots', '');
const VERBOSE = argv.includes('--verbose');
const ORIGIN = `http://127.0.0.1:${PORT}`;

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ['playwright', 'playwright-core']) {
    try { return require(id); } catch { /* try the next one */ }
  }
  console.error('names: Playwright is not installed.  npm install --no-save playwright@1.56.1');
  process.exit(3);
  return null;
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav', '.flac': 'audio/flac', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
};

function serve(port) {
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(new URL(req.url, ORIGIN).pathname));
    if (file.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONTROLS = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, '
  + '[role="button"], [role="switch"], [role="slider"], [role="tab"], [role="checkbox"], [role="radio"], [role="link"], [tabindex="0"]';

// What lost its line on screen keeps it as a description.
const DESCRIBED = [
  '#loopName', '#trkNum', '#copySong', '#pasteCode', '#goExport', '#shareSong', '#goSeedAlbum',
  '[data-format]', '#exportMidi', '#exportCancel', '#exportOk', '#seedCount', '#seedAlbumCode', '#seedAlbumLink', '#seedAlbumSave',
  '#savePane [role="checkbox"]', '#goAdvanced', '#monoMode', '#liteMode',
  '#exportJson', '#importBtn', '#copyBackup', '#pasteBackup', '#trimDown', '#trimUp', '#diagCopy',
  '.speed-link', '#go',
].join(', ');

const PHONE = { name: '360', width: 360, height: 740 };
const TABLET = { name: 'tablet', width: 768, height: 1024 };
const SIZES = [
  { name: '320x640', width: 320, height: 640 },
  { name: '360x640', width: 360, height: 640 },
  PHONE,
  { name: '412', width: 412, height: 915 },
  TABLET,
  { name: 'landscape tablet', width: 1180, height: 820 },
];
const SCALES = [100, 130, 200];
const THEMES = { light: 't-dawn', dark: 't-nocturne' };

// ---------------------------------------------------------- the screens

const click = (page, selector) => page.evaluate((s) => {
  const n = document.querySelector(s);
  if (!n) throw new Error(`no ${s}`);
  n.click();
}, selector);

const toNow = async (page) => {
  if (await page.evaluate(() => document.getElementById('viewNow').hidden)) await click(page, '#nowBtn');
};
const toTab = async (page, tab) => {
  if (await page.evaluate(() => document.getElementById('viewLibrary').hidden)) await click(page, '#libraryBtn');
  await click(page, `[data-tab="${tab}"]`);
};
const toSave = async (page, tab) => {
  if (await page.evaluate(() => document.getElementById('viewSave').hidden)) await click(page, '#saveBtn');
  await click(page, `[data-stab="${tab}"]`);
};
const toVibe = async (page) => {
  await toNow(page);
  await click(page, '#vibesBtn');
};
const openAlbum = async (page, title) => {
  await toTab(page, 'albums');
  await sleep(150);
  await page.evaluate((t) => {
    const r = [...document.querySelectorAll('.lrow.album')].find((x) => x.querySelector('.lrow-title').textContent.includes(t));
    if (!r) throw new Error(`no album ${t}`);
    r.querySelector('.lrow-main').click();
  }, title);
};
// One of Export's states, in the app's own words (an export is the rows').
const exportState = (page, which) => page.evaluate(async (w) => {
  const { WORDS } = await import(new URL('js/export.js', location.href).href);
  document.getElementById('exportFill').style.width = '42%';
  document.getElementById('exportProgress').textContent = WORDS.progress(42, '3 min');
  document.getElementById('exportNote').textContent = WORDS.background;
  document.getElementById('exportSaved').textContent = WORDS.saved('Ballad Falls.flac', '238 MB', '45 min');
  document.getElementById('exportWhy').textContent = WORDS.space('1.2 GB', '300 MB');
  for (const s of ['Choose', 'Run', 'Done', 'Failed']) document.getElementById(`export${s}`).hidden = s !== w;
}, which);

// In this order, each from where the one before left the app. The page
// opens on an album's link: the album saved, its first track ready.
const SCREENS = [
  ['now, in an album', toNow],
  ['now, album left', async (p) => { await toNow(p); await click(p, '#nowAction'); }],
  ['vibe', toVibe],
  ['vibes, none', async (p) => { await click(p, '#picksList .pk-line-mood .pk-val'); }],
  ['vibes, picked', async (p) => { await click(p, '#vibesList button:nth-child(2)'); await click(p, '#vibesList button:nth-child(5)'); }],
  ['vibe, picked', async (p) => { await click(p, '#vibesClose'); }],
  ['bars', async (p) => { await click(p, '#picksList .pk-go-bars'); }],
  ['bars, endless', async (p) => { await click(p, '#lenEndless'); }],
  ['track length, on and on', async (p) => { await click(p, '#lenCancel'); await click(p, '#picksList .pk-track'); }],
  ['track length, set', async (p) => {
    await p.evaluate(() => {
      const n = document.getElementById('trkNum');
      n.value = '45:00';
      n.dispatchEvent(new Event('blur'));
    });
  }],
  ['vibe, track set', async (p) => { await click(p, '#trkDone'); }],
  ['tempo', async (p) => { await click(p, '#picksList .pk-go-tempo'); }],
  ['tempo, a range', async (p) => {
    await p.evaluate(() => {
      for (const [id, v] of [['tmpLo', 70], ['tmpHi', 85]]) {
        const s = document.getElementById(id);
        s.value = String(v);
        s.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }],
  ['key', async (p) => { await click(p, '#tmpDone'); await click(p, '#picksList .pk-go-key'); await click(p, '#keyGrid button:nth-child(4)'); }],
  ['key, scales', async (p) => { await click(p, '#viewKey .pv-tab[data-tab="scale"]'); await click(p, '#keyNext'); }],
  ['style', async (p) => { await click(p, '#keyDone'); await click(p, '#picksList .pk-go-style'); await click(p, '#styGrid button:nth-child(1)'); }],
  ['voices', async (p) => {
    await click(p, '#styDone');
    await click(p, '#picksList .pk-go-voices');
    await click(p, '#voxGrid button:nth-child(1)');
    await click(p, '#voxOff');
  }],
  ['vibe, every line picked', async (p) => { await click(p, '#voxDone'); }],
  ['sound', async (p) => {
    for (let i = 0; i < 3 && await p.evaluate(() => document.getElementById('viewSounds').hidden); i++) await click(p, '#viewBtn');
  }],
  ['layers', async (p) => { await click(p, '#viewBtn'); }],
  ['layers, one off', async (p) => { await click(p, '.layer[data-layer="bass"] .btn-on'); }],
  ['layers, on again', async (p) => { await click(p, '.layer[data-layer="bass"] .btn-on'); }],
  ['save', async (p) => { await toSave(p, 'albums'); }],
  ['save, about to delete', async (p) => { await click(p, '#savePane .lrow.in .lrow-main'); }],
  ['save, changed', async (p) => { await click(p, '.layer .btn-roll'); await sleep(300); await toSave(p, 'albums'); }],
  ['share', async (p) => { await toSave(p, 'share'); }],
  ['export', async (p) => { await click(p, '#goExport'); await sleep(1500); }],
  ['export, running', (p) => exportState(p, 'Run')],
  ['export, done', (p) => exportState(p, 'Done')],
  ['export, failed', (p) => exportState(p, 'Failed')],
  ['album from seed', async (p) => { await exportState(p, 'Choose'); await click(p, '#exportBack'); await click(p, '#goSeedAlbum'); }],
  ['share, clipboard refused', async (p) => {
    await click(p, '#seedBack');
    await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async () => { throw new Error('refused'); }, readText: async () => '' },
    }));
    await click(p, '#copySong');
  }],
  ['library, albums', async (p) => { await toTab(p, 'albums'); }],
  ['album', async (p) => { await openAlbum(p, 'Rainy'); }],
  ['album, about to remove', async (p) => { await click(p, '.lrow.track .row-keys button:last-child'); }],
  ['album, about to delete', async (p) => {
    await click(p, '.end-keys button');
    await p.evaluate(() => { document.querySelector('#libPane .scroll').scrollTop = 1e6; });
  }],
  ['move a loop', async (p) => { await click(p, '.lrow.track .row-keys button'); }],
  ['add loops', async (p) => { await click(p, '#libPane .page-foot button:last-child'); await click(p, '.hero-keys button:nth-child(2)'); }],
  ['empty album', async (p) => { await openAlbum(p, 'Favorite'); }],
  ['library, loops', async (p) => { await toTab(p, 'loops'); }],
  ['more', async (p) => { await toTab(p, 'more'); }],
  ['advanced', async (p) => {
    await click(p, '#goAdvanced');
    await p.evaluate(() => { document.querySelector('#libAdvanced .scroll').scrollTop = 0; });
  }],
  ['advanced, files', async (p) => { await p.evaluate(() => document.getElementById('exportJson').scrollIntoView({ block: 'center' })); }],
  ['advanced, the end', async (p) => { await p.evaluate(() => { document.querySelector('#libAdvanced .scroll').scrollTop = 1e6; }); }],
];

// The screens that need a page of their own.
const ALONE = [
  ['now, a first visit', { url: () => `${ORIGIN}/` }],
  ['now, a long piece', { url: () => linkOf(`${ORIGIN}/`, encodeSong(newSpec(11, { length: 1024 }))) }],
  ['plain line', { url: () => `${ORIGIN}/`, init: () => { Object.defineProperty(globalThis, 'WebAssembly', { value: undefined }); } }],
  ['speed test', { url: () => `${ORIGIN}/speed.html` }],
];

// ----------------------------------------------------------- the checks

const failures = new Set();
const named = new Map();
let looked = 0;
let described = 0;
let switches = 0;

function fail(where, what) {
  const line = `${where}: ${what}`;
  if (failures.has(line)) return;
  failures.add(line);
  console.log(`  FAIL  ${line}`);
}

async function checkScreen(page, cdp, where) {
  const list = await page.evaluate(([sel, desc]) => {
    const all = [...document.querySelectorAll(sel)].filter((e) => e.checkVisibility({ visibilityProperty: true }));
    window.__controls = all;
    return all.map((e) => ({
      what: e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}.${e.className} "${e.textContent.trim().slice(0, 40)}"`,
      described: e.matches(desc),
      // A layer's switch, as the screen shows it: dimmed is off.
      checked: e.matches('.layer .btn-on') ? String(!e.closest('.layer').classList.contains('dim')) : null,
    }));
  }, [CONTROLS, DESCRIBED]);
  for (const [i, c] of list.entries()) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: `window.__controls[${i}]` });
    if (!result.objectId) continue;
    let node;
    try {
      const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false });
      node = nodes[0];
    } catch {
      continue;   // redrawn while it was being read
    }
    looked++;
    if (!node || node.ignored) {
      fail(where, `${c.what} is not in the accessibility tree`);
      continue;
    }
    const name = String((node.name && node.name.value) || '').trim();
    if (!/[\p{L}\p{N}]/u.test(name)) {
      fail(where, `${c.what} has no name (${JSON.stringify(name)})`);
      continue;
    }
    // A switch or a tick says whether it is on (session 30k: the layers' on
    // and off are a speaker now, the word only a screen reader's).
    const role = node.role && node.role.value;
    if (role === 'switch' || role === 'checkbox') {
      const checked = (node.properties || []).find((q) => q.name === 'checked');
      const v = checked && String(checked.value.value);
      if (v !== 'true' && v !== 'false') fail(where, `${c.what} "${name}" doesn't say whether it is on (${JSON.stringify(v)})`);
      else if (c.checked !== null && v !== c.checked) fail(where, `${c.what} "${name}" says ${v === 'true' ? 'on' : 'off'}, shown ${c.checked === 'true' ? 'on' : 'off'}`);
      else switches++;
    }
    named.set(`${c.what} ${name}`, where);
    if (c.described) {
      described++;
      if (!String((node.description && node.description.value) || '').trim()) fail(where, `${c.what} "${name}" lost its description`);
    }
    if (VERBOSE) console.log(`  ok    ${where}: ${c.what} "${name}"`);
  }
  const markup = await page.evaluate((sel) => {
    const out = [];
    for (const e of document.querySelectorAll('[aria-labelledby], [aria-describedby]')) {
      for (const attr of ['aria-labelledby', 'aria-describedby']) {
        for (const id of (e.getAttribute(attr) || '').split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) out.push(`${attr} points at #${id}, which is not there`);
        }
      }
    }
    // A plain-line page is never wired: its hidden keys have no words yet.
    const plain = !document.getElementById('plainLine') || !document.getElementById('plainLine').hidden;
    for (const e of document.querySelectorAll(sel)) {
      const word = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title')
        || e.textContent.trim() || (e.labels && e.labels.length);
      const unused = e.closest('[hidden]') && (plain || ['nowPicks', 'nowAction'].includes(e.id));
      if (!word && !unused) out.push(`${e.tagName.toLowerCase()}#${e.id} has nothing to be named by`);
      if (e.closest('[aria-hidden="true"]') && e.tabIndex >= 0) out.push(`${e.tagName.toLowerCase()}#${e.id} can be focused inside aria-hidden`);
    }
    return out;
  }, CONTROLS);
  for (const m of markup) fail(where, m);
}

async function checkFit(browser, code, size, scale) {
  const { ctx, page } = await open(browser, { url: linkOf(`${ORIGIN}/`, code), size, scale });
  const where = `fit @ ${size.name}, text ${scale}%`;
  const clipped = (box, keys) => page.evaluate(([b, k]) => {
    const e = document.querySelector(b);
    const out = [];
    if (e.scrollHeight > e.clientHeight + 1) out.push(`${b} overflows (${e.scrollHeight} > ${e.clientHeight})`);
    for (const x of document.querySelectorAll(k)) {
      if (!x.checkVisibility()) continue;
      if (x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1) out.push(`"${x.textContent.trim()}" is clipped in its key`);
    }
    return out;
  }, [box, keys]);
  await toSave(page, 'share');
  await sleep(200);
  for (const p of await clipped('#saveShare .scroll', '#saveShare .vkey')) fail(where, p);
  await click(page, '#goExport');
  await sleep(700);
  for (const which of ['Choose', 'Run', 'Done', 'Failed']) {
    await exportState(page, which);
    await page.evaluate((w) => {
      if (w !== 'Choose') return;
      const about = document.getElementById('exportAbout');
      about.hidden = false;
      about.textContent = '2 h 48 min · flac ~1.9 GB, opus ~121 MB';
    }, which);
    for (const p of await clipped('#exportSheet', '#viewExport .vkey')) fail(where, `${which.toLowerCase()}: ${p}`);
  }
  await exportState(page, 'Choose');
  await click(page, '#exportBack');
  await click(page, '#goSeedAlbum');
  for (const p of await clipped('#seedAlbum', '#viewSeed .vkey')) fail(where, p);
  await ctx.close();
}

// Track length on the short phones 30c's fix is for, its infinity key
// among the controls (tools/rows.mjs checks that each can be touched).
async function shortShots(browser, code) {
  for (const [width, height] of [[360, 640], [320, 568]]) {
    const size = { name: `${width}x${height}`, width, height };
    for (const mode of ['light', 'dark']) {
      const { ctx, page } = await open(browser, { url: linkOf(`${ORIGIN}/`, code), size, mode });
      await toVibe(page);
      await click(page, '#picksList .pk-track');
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, `short_track-on-and-on_${size.name}_${mode}.png`) });
      await page.evaluate(() => {
        const n = document.getElementById('trkNum');
        n.value = '45:00';
        n.dispatchEvent(new Event('blur'));
      });
      await sleep(300);
      await page.screenshot({ path: path.join(SHOTS, `short_track-set_${size.name}_${mode}.png`) });
      await ctx.close();
    }
  }
}

// ----------------------------------------------------------------- run

async function open(browser, { url, size = PHONE, scale = 100, mode = 'dark', init = null }) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, colorScheme: mode, serviceWorkers: 'block' });
  await ctx.addInitScript((theme) => {
    try { localStorage.setItem('driftloom.prefs.v1', JSON.stringify({ theme })); } catch { /* no storage */ }
  }, THEMES[mode]);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(url, `page error: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 60000 });
  if (scale !== 100) await page.addStyleTag({ content: `html { font-size: ${scale}% !important; }` });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await sleep(1000);
  return { ctx, page };
}

async function sheet(browser, shots, size, file) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const cols = size === PHONE ? 8 : 6;
  const figures = shots.map(([name, png]) => `<figure><img src="data:image/png;base64,${png.toString('base64')}"><figcaption>${name}</figcaption></figure>`).join('');
  await page.setContent(`<style>body{margin:8px;font:12px system-ui;background:#fff;color:#111}main{display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px}figure{margin:0}img{width:100%;display:block}figcaption{padding:3px 0}</style><main>${figures}</main>`);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
}

async function main() {
  const { chromium } = loadPlaywright();
  const server = await serve(PORT);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const album = encodeAlbum('Rainy Day Mix', [newSpec(31337, ['rainy', 'mellow']), newSpec(4242), newSpec(777, 'bars=64,bpm=80')]);
  const modes = SHOTS ? ['light', 'dark'] : ['dark'];
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  try {
    for (const size of [PHONE, TABLET]) {
      for (const mode of modes) {
        const shots = [];
        // The screenshot first: an armed key waits only three seconds.
        const see = async (page, cdp, name) => {
          await sleep(400);
          if (SHOTS) {
            const png = await page.screenshot();
            fs.writeFileSync(path.join(SHOTS, `${name.replace(/[^a-z0-9]+/gi, '-')}_${size.name}_${mode}.png`), png);
            shots.push([name, png]);
          }
          await checkScreen(page, cdp, `${name} @ ${size.name}, ${mode}`);
        };
        const { ctx, page } = await open(browser, { url: linkOf(`${ORIGIN}/`, album), size, mode });
        const cdp = await ctx.newCDPSession(page);
        for (const [name, go] of SCREENS) {
          try {
            await go(page);
            await see(page, cdp, name);
          } catch (e) {
            fail(`${name} @ ${size.name}, ${mode}`, `could not be shown: ${e.message.split('\n')[0]}`);
          }
        }
        await ctx.close();
        for (const [name, how] of ALONE) {
          const own = await open(browser, { url: how.url(), init: how.init, size, mode });
          await see(own.page, await own.ctx.newCDPSession(own.page), name);
          await own.ctx.close();
        }
        if (SHOTS) await sheet(browser, shots, size, path.join(SHOTS, `sheet_${size.name}_${mode}.png`));
      }
    }
    const loop = encodeSong(newSpec(11));
    for (const size of SIZES) for (const scale of SCALES) await checkFit(browser, loop, size, scale);
    if (SHOTS) await shortShots(browser, loop);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\nnames: ${named.size} different named controls, ${looked} looks at a control, ${described} descriptions, ${switches} switches said on or off, on ${SCREENS.length + ALONE.length} screens; fit at ${SIZES.length} sizes and ${SCALES.length} text sizes; ${failures.size} failed`);
  process.exit(failures.size ? 1 : 0);
}

main().catch((e) => {
  console.error(`names: ${e.stack}`);
  process.exit(1);
});
