// The old address, driftloom.nowmichaelclark.workers.dev, after the new name
// (session 31a). Deployed on launch day under the old Worker's name
// (wrangler.jsonc here; docs/notes/for-mikey.md). It answers:
//
// - /sw.js: a last service worker. The testers' installed app has the old
//   one, which serves the app from its cache whenever the network fails it;
//   this one empties the caches and unregisters itself, so the address only
//   ever answers from here.
// - a page visit (a browser's navigation, Sec-Fetch-Mode: navigate): a small
//   page. With no Library, or once it has been offered, it sends the browser
//   straight on to the same path on the new address, the link's code (the
//   fragment, "#c=...": session 24) kept. With saved loops, it offers once to
//   bring them across (the backup, packed into the new address's link, which
//   js/main.js takes), or to save the backup file; nothing is lost on "Not
//   now". In the installed app it also says where the app went. /library
//   always offers, for a mind changed later.
// - anything else (a crawler, a link preview, a file, a browser too old to say
//   it is navigating): a permanent redirect to the same path and query.
//
// The old site's storage keys are read here as the old app wrote them
// (js/storage.js); the backup's format is its exportAll's.

const LAST_SW = `// The last service worker at the old address (session 31a): the app moved
// to its new address. Empty every cache and step aside, so each request goes
// to the network, which answers with the move.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
  );
});
`;

// The Library as a link's text: the backup's JSON, deflated where the browser
// can ("z") or as it is ("j"), in base64url. js/storage.js's unpackMove reads
// it. Runs in the page (its source is put there) and in the tests.
export async function pack(json) {
  let bytes = new TextEncoder().encode(json);
  let kind = 'j';
  if (typeof CompressionStream === 'function') {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      kind = 'z';
    } catch { /* sent as it is */ }
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return kind + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The page's own part: `to` is the new address with the same path and query.
function page(to, always) {
  // A link longer than this goes as a file instead (browsers take a few
  // hundred kilobytes in an address at the least; a Library is rarely 50).
  const MAX = 400000;
  const $ = (id) => document.getElementById(id);
  const KEYS = { saves: 'driftloom.saves.v1', albums: 'driftloom.albums.v1', done: 'driftloom.moved.v1' };
  const read = (key) => {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  };
  const mark = (how) => { try { localStorage.setItem(KEYS.done, how); } catch { /* offered again next time */ } };
  const target = to + location.hash;
  const go = (url) => location.replace(url);

  // The old service worker and its caches go whatever happens next.
  try { navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {}); } catch { /* none */ }
  try { caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {}); } catch { /* none */ }

  const installed = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay']
    .some((m) => matchMedia(`(display-mode: ${m})`).matches);
  const loops = read(KEYS.saves);
  let done = null;
  try { done = localStorage.getItem(KEYS.done); } catch { /* no storage, no Library */ }
  const offer = loops.length > 0 && (always || !done);
  if (!offer && !installed) { go(target); return; }

  $('open').href = target;
  if (installed) $('installed').hidden = false;
  if (!offer) { $('main').hidden = false; $('open').focus(); return; }

  const backup = JSON.stringify({ format: 'driftloom.v1', loops, albums: read(KEYS.albums) });
  $('count').textContent = `${loops.length} loop${loops.length === 1 ? '' : 's'}`;
  $('offer').hidden = false;
  $('go').hidden = true;
  $('main').hidden = false;
  $('bring').focus();
  $('bring').addEventListener('click', async () => {
    $('bring').disabled = true;
    const text = await pack(backup);
    if (text.length > MAX) {
      $('toolong').hidden = false;
      $('bring').disabled = false;
      return;
    }
    mark('moved');
    const hash = location.hash.slice(1);
    go(`${to}#move=${text}${hash ? `&then=${encodeURIComponent(hash)}` : ''}`);
  });
  $('later').addEventListener('click', () => { mark('declined'); go(target); });
  $('file').addEventListener('click', (e) => {
    e.preventDefault();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
    a.download = 'driftloom-loops.json';
    document.body.append(a);
    a.click();
    a.remove();
  });
}

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

function movePage(to, always) {
  const host = new URL(to).host;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ballad Falls</title>
<link rel="canonical" href="${attr(to)}">
<noscript><meta http-equiv="refresh" content="0;url=${attr(to)}"></noscript>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0c1618; color: #e8efec;
    font: 17px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 26rem; padding: 24px 16px; }
  h1 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 .5rem; font-weight: 600; }
  p { margin: .5rem 0; color: #b9c8c3; }
  .keys { display: flex; flex-wrap: wrap; gap: 10px; margin: 1.25rem 0 .75rem; }
  button, .key { font: inherit; border-radius: 999px; padding: .6rem 1.2rem; border: 1px solid #3c5a57; cursor: pointer;
    background: transparent; color: #e8efec; text-decoration: none; }
  #bring, #open { background: #8fd3c1; border-color: #8fd3c1; color: #0c1618; font-weight: 600; }
  a { color: #8fd3c1; }
  button:focus-visible, a:focus-visible { outline: 2px solid #e8efec; outline-offset: 2px; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main id="main" hidden>
  <h1>Driftloom is Ballad Falls now</h1>
  <p>The same music, at <a href="${attr(to)}">${attr(host)}</a>.</p>
  <p id="installed" hidden>Install it from there, then remove this app.</p>
  <div id="offer" hidden>
    <p>Bring your Library? <span id="count"></span>.</p>
    <div class="keys"><button id="bring" type="button">Bring it</button><button id="later" type="button">Not now</button></div>
    <p>Or <a id="file" href="#">save a backup file</a> and restore it there (More, Advanced, Files, restore).</p>
    <p id="toolong" hidden>Your Library is too big for a link: save the backup file, then restore it there (More, Advanced, Files, restore).</p>
  </div>
  <div class="keys" id="go"><a class="key" id="open" href="${attr(to)}">Open Ballad Falls</a></div>
</main>
<script>
${pack.toString().replace(/^export /, '')}
(${page.toString()})(${js(to)}, ${always ? 'true' : 'false'});
</script>
</body>
</html>
`;
}

const NO_STORE = { 'cache-control': 'no-store' };

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const origin = (env.NEW_ORIGIN || 'https://balladfalls.com').replace(/\/$/, '');
    if (url.pathname === '/sw.js') {
      return new Response(LAST_SW, { headers: { 'content-type': 'text/javascript; charset=utf-8', ...NO_STORE } });
    }
    const always = url.pathname === '/library';
    const to = `${origin}${always ? '/' : url.pathname}${always ? '' : url.search}`;
    const visit = request.method === 'GET' && request.headers.get('sec-fetch-mode') === 'navigate';
    if (visit) {
      return new Response(movePage(to, always), { headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE } });
    }
    return new Response(null, { status: 301, headers: { location: to, ...NO_STORE } });
  },
};
