// The old address: its Worker (old-address/worker.js) sends
// every path on to the same path on the new one, gives a page visit the page
// that offers the Library once, and gives the installed app a last service
// worker; the Library it packs into the link reads back here (js/storage.js's
// unpackMove), names in any script intact; and the addresses in the two
// Worker configs are the app's own (js/main.js's APP_URL). The browser half
// (an installed app at the old address sent on, its Library moved across) is
// tools/old-address.mjs.
// Run with:  node test/old-address.test.mjs

import fs from 'node:fs';
import vm from 'node:vm';
import worker, { pack } from '../old-address/worker.js';
import { unpackMove } from '../js/storage.js';

let failures = 0;
function check(label, condition, detail = '') {
  console.log(condition ? `  pass  ${label}` : `  FAIL  ${label} ${detail}`);
  if (!condition) failures++;
}
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
// JSONC: the configs' own comments are whole lines.
const jsonc = (f) => JSON.parse(read(f).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'));

const OLD = 'https://driftloom.nowmichaelclark.workers.dev';
const NEW = 'https://balladfalls.com';
const env = { NEW_ORIGIN: NEW };
const get = (path, headers = {}, method = 'GET') => worker.fetch(new Request(`${OLD}${path}`, { method, headers }), env);
const visit = (path) => get(path, { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' });

console.log('\nThe addresses');
{
  const appUrl = read('js/main.js').match(/const APP_URL = '([^']+)'/)[1];
  const site = jsonc('wrangler.jsonc');
  const old = jsonc('old-address/wrangler.jsonc');
  check('the site\'s custom domain is APP_URL\'s host', site.routes.some((r) => r.custom_domain && `https://${r.pattern}/` === appUrl), JSON.stringify(site.routes));
  check('the site\'s Worker is "balladfalls"', site.name === 'balladfalls', site.name);
  check('the old address\'s Worker takes the old name, "driftloom"', old.name === 'driftloom', old.name);
  check('its bundle keeps no __name helper (keep_names off)', old.keep_names === false);
  check('it sends everything to APP_URL', `${old.vars.NEW_ORIGIN}/` === appUrl, old.vars.NEW_ORIGIN);
  check('the site does not upload the old address\'s folder', read('.assetsignore').split('\n').includes('old-address'));
}

console.log('\nEvery path is sent on');
for (const path of ['/', '/speed', '/rank.html', '/js/main.js', '/icons/icon-512.png', '/manifest.webmanifest', '/a/b?x=1&y=two', '/?c=old']) {
  const res = await get(path);
  check(`${path}: 301 to the same path and query`, res.status === 301 && res.headers.get('location') === `${NEW}${path}`, `${res.status} ${res.headers.get('location')}`);
}
{
  const res = await get('/', {}, 'POST');
  check('a POST is sent on too', res.status === 301 && res.headers.get('location') === `${NEW}/`);
  const crawler = await get('/', { 'user-agent': 'Mozilla/5.0 (compatible; Discordbot/2.0)', accept: 'text/html' });
  check('a link preview (no Sec-Fetch-Mode) gets the redirect, not the page', crawler.status === 301);
}

console.log('\nA page visit gets the page');
{
  const res = await visit('/some/where?q=1');
  const html = await res.text();
  check('200, HTML, never cached', res.status === 200 && /text\/html/.test(res.headers.get('content-type')) && res.headers.get('cache-control') === 'no-store');
  check('it goes on to the same path and query', html.includes(JSON.stringify(`${NEW}/some/where?q=1`)));
  check('without scripts it goes on all the same', html.includes(`<noscript><meta http-equiv="refresh" content="0;url=${NEW}/some/where?q=1">`));
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  let parses = true;
  try { new Function(script); } catch (e) { parses = String(e); }
  check('its script parses', parses === true, parses);
  // Run it as a browser with no Library would, but with its functions as
  // Wrangler's bundler gives them (wrapped in __name, which no browser has):
  // the deployed page once stopped there, blank, and never went on.
  const bundled = script.replace(/const \$ = \(id\) => ([^;]+);/, 'const $ = /* @__PURE__ */ __name((id) => $1, "$");');
  const went = [];
  const el = () => ({ hidden: true, focus() {}, addEventListener() {}, set textContent(v) {}, set href(v) {} });
  const sandbox = {
    document: { getElementById: el },
    location: { hash: '#c=ELAAAAAF_DHAbt', replace: (u) => went.push(u) },
    localStorage: { getItem: () => null, setItem() {} },
    navigator: {}, matchMedia: () => ({ matches: false }),
    TextEncoder, Blob, Response, btoa, JSON,
  };
  let ran = true;
  try { vm.runInNewContext(bundled, sandbox); } catch (e) { ran = String(e); }
  check('its script runs from bundled functions too', ran === true && bundled.includes('__name(('), ran);
  check('with no Library it goes straight on, the link\'s code kept', went[0] === `${NEW}/some/where?q=1#c=ELAAAAAF_DHAbt`, JSON.stringify(went));
  check('it says the name and where', html.includes('Ballad Falls') && html.includes('balladfalls.com'));
  const lib = await (await visit('/library?x=1')).text();
  check('/library always offers, and goes to the new address\'s start', lib.includes(`, true);`) && lib.includes(JSON.stringify(`${NEW}/`)));
  const odd = await (await visit('/%3C/script%3E%3Cb%3E')).text();
  check('a path can\'t close the script', (odd.match(/<\/script>/g) || []).length === 1);
}

console.log('\nThe installed app\'s last service worker');
{
  const res = await get('/sw.js', { 'service-worker': 'script' });
  const text = await res.text();
  check('200, JavaScript, never cached', res.status === 200 && /javascript/.test(res.headers.get('content-type')) && res.headers.get('cache-control') === 'no-store');
  check('it takes over at once, empties the caches and unregisters, and serves nothing',
    text.includes('skipWaiting') && text.includes('caches.delete') && text.includes('unregister()') && !text.includes("'fetch'"));
  let parses = true;
  try { new Function(text); } catch (e) { parses = String(e); }
  check('it parses', parses === true, parses);
}

console.log('\nThe Library, through the link');
{
  const lib = JSON.parse(read('test/library-v183.json'));
  const backup = JSON.stringify({ format: 'driftloom.v1', loops: lib.saves, albums: lib.albums });
  const text = await pack(backup);
  check('deflated where the browser can', text[0] === 'z', text.slice(0, 8));
  check('the link\'s text is base64url only', /^[A-Za-z0-9_-]+$/.test(text.slice(1)));
  const back = await unpackMove(text);
  check('it reads back to the same backup, Thai and emoji names too', JSON.stringify(back) === backup);
  check(`twenty loops are about ${Math.round(text.length / 100) / 10} KB of link (under the page's 400 KB)`, text.length < 400000);
  const keep = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  const plain = await pack(backup);
  globalThis.CompressionStream = keep;
  check('as it is where the browser can\'t deflate', plain[0] === 'j' && JSON.stringify(await unpackMove(plain)) === backup);
  let refused = 0;
  for (const bad of ['', 'x123', 'jbm90IGpzb24', `j${btoa('{"format":"other","loops":[]}')}`]) {
    try { await unpackMove(bad); } catch { refused++; }
  }
  check('anything else is refused, not taken', refused === 4, `${refused} of 4`);
}

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
