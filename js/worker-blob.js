// A module Worker for the Android app.
//
// In a browser, a module Worker loads its imports itself. In the app's
// WebView it can't. The files are the app's own, served to the page from
// inside the APK by `shouldInterceptRequest`. A Worker's own requests (its
// imports, a `fetch`) never reach that, so they fail as network loads that
// the app blocks. Measured on the emulator (Chromium 124): a Worker's own
// script loads, and a module Worker with no imports loads. A Worker that
// imports a file of the app does not load, whatever headers the files send.
//
// So the page does the loading. `moduleWorkerUrl` reads the Worker's file
// and every file that it imports (the page's requests are served). It
// rewrites each static import to a Blob URL of that file, made the same
// way. Then it gives back a Blob URL for the Worker, which loads because the
// Blobs are the page's.
// - Only static imports of relative files are followed. A dynamic
//   `import()` stays as written, because the Worker never runs it.
// - A Worker file may not use `import.meta` (none does).

// `import ... from './x.js'`, `export ... from './x.js'` and `import './x.js'`.
const STATIC = /(\bfrom\s+|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\2/g;

// A Blob URL for the module at `entry` (an address), with its imports.
export function moduleWorkerUrl(entry) {
  const made = new Map();
  const build = (url, trail) => {
    if (trail.includes(url)) throw new Error(`the import of ${url} is circular`);
    if (made.has(url)) return made.get(url);
    const blob = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: ${response.status}`);
      const text = await response.text();
      const deps = new Map();
      for (const m of text.matchAll(STATIC)) {
        const dep = new URL(m[3], url).href;
        if (!deps.has(dep)) deps.set(dep, await build(dep, [...trail, url]));
      }
      const body = text.replace(STATIC, (all, kw, quote, spec) => `${kw}${quote}${deps.get(new URL(spec, url).href)}${quote}`);
      return URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
    })();
    made.set(url, blob);
    return blob;
  };
  return build(new URL(entry, location.href).href, []);
}
