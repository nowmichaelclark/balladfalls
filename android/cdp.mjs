// The app's page, driven from a computer through the WebView's DevTools
// protocol (session 27): what android/smoke.mjs and `tools/rows.mjs --app`
// share. A debuggable (test) build offers the protocol over adb
// (MainActivity turns it on). No test library: a few calls of the protocol,
// shaped like the Playwright page tools/rows.mjs drives in a browser
// (`evaluate`, `addInitScript`, `reload`, `keyboard.press`, `click`).
//
// It waits for the page as it is, never as it was a moment ago (the smoke
// job's two flakes, #411 and #412): a fresh install can restart the app
// under it (the system relaunches an activity when its package finishes
// optimizing), which gives the app a new process, a new inspector socket
// and a new page. So every connect finds the app's process now (starting
// the app if none runs), its socket, the newest page of the app's origin,
// and waits until that page has stood still for a moment, loaded, before
// it is used; and any call whose page went away connects again that way.
//
// Needs Node 22 (its WebSocket and fetch) and, for a device, adb on the path.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const transport = (message) => Object.assign(new Error(message), { transport: true });
const APP_ORIGIN = /^https?:\/\/(appassets\.androidplatform\.net|localhost|127\.0\.0\.1)/;

// The app's id, from android/gradle.properties.
export function appId() {
  const props = fs.readFileSync(path.join(HERE, 'gradle.properties'), 'utf8');
  return (props.match(/^driftloom\.applicationId=(.+)$/m) || [])[1];
}

export function adb(...args) {
  return execFileSync('adb', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export async function until(what, fn, ms, every = 500) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { last = e; }
    await sleep(every);
  }
  throw new Error(`timed out (${Math.round(ms / 1000)} s) waiting for ${what}${last ? `: ${last.message}` : ''}`);
}

// The app's process now, or null.
function pidNow(pkg) {
  try { return adb('shell', 'pidof', pkg).split(/\s+/)[0] || null; } catch { return null; }
}

// Start the app (its launcher activity), waiting for the launch.
export function launch(pkg) {
  adb('shell', 'am', 'start', '-W', '-n', `${pkg}/app.loops.MainActivity`);
}

// A DevTools endpoint for the app as it is now: its process (started if
// none runs, and again if it dies before its inspector opens), that
// process's socket, forwarded to a port here.
async function appEndpoint(pkg, ms, log) {
  let noneSince = null;
  let launched = false;
  return until('the app\'s WebView to open its inspector', () => {
    const pid = pidNow(pkg);
    if (!pid) {
      noneSince = noneSince || Date.now();
      // Not running (never started, or restarted and not yet back):
      // start it, and again if it stays gone.
      if (!launched || Date.now() - noneSince > 8000) {
        log(`starting ${pkg}`);
        try { launch(pkg); } catch (e) { log(`  am start: ${e.message.split('\n')[0]}`); }
        launched = true;
        noneSince = Date.now();
      }
      return null;
    }
    noneSince = null;
    const socket = `webview_devtools_remote_${pid}`;
    if (!new RegExp(`@${socket}(\\s|$)`, 'm').test(adb('shell', 'cat', '/proc/net/unix'))) return null;
    const port = adb('forward', 'tcp:0', `localabstract:${socket}`);
    return { base: `http://127.0.0.1:${port}`, pid };
  }, ms);
}

// One DevTools session on one page.
class Session {
  constructor(ws, onEvent) {
    this.ws = ws;
    this.next = 1;
    this.waiting = new Map();
    ws.addEventListener('close', () => {
      for (const { fail } of this.waiting.values()) fail(transport('the page went away'));
      this.waiting.clear();
    });
    ws.addEventListener('message', (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.waiting.has(msg.id)) {
        const { ok, fail } = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        if (msg.error) fail(new Error(msg.error.message));
        else ok(msg.result);
      } else if (msg.method) onEvent(msg);
    });
  }

  send(method, params = {}, ms = 15000) {
    const id = this.next++;
    if (this.ws.readyState !== 1) return Promise.reject(transport('the page went away'));
    this.ws.send(JSON.stringify({ id, method, params }));
    // A page that is navigating or gone never answers: fail, don't wait.
    return new Promise((ok, fail) => {
      const t = setTimeout(() => { this.waiting.delete(id); fail(transport(`no answer to ${method} in ${ms / 1000} s`)); }, ms);
      this.waiting.set(id, { ok: (v) => { clearTimeout(t); ok(v); }, fail: (e) => { clearTimeout(t); fail(e); } });
    });
  }

  close() {
    try { this.ws.close(); } catch { /* gone */ }
  }
}

// Keys as `keyboard.press` names them: what the page's own handlers read.
const KEYS = {
  Space: { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
  Enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
};
const MODS = { Alt: 1, Control: 2, Meta: 4, Shift: 8 };
function keyOf(k) {
  if (KEYS[k]) return KEYS[k];
  if (k.includes('+')) {
    const names = k.split('+');
    const code = names.pop();
    const ch = (/^(?:Key|Digit)(.)$/.exec(code) || [])[1];
    return { key: ch || code, code, keyCode: ch ? ch.charCodeAt(0) : { ArrowLeft: 37, ArrowRight: 39 }[code] || 0, modifiers: names.reduce((m, n) => m | MODS[n], 0) };
  }
  if (/^[0-9]$/.test(k)) return { key: k, code: `Digit${k}`, keyCode: 48 + Number(k), text: k };
  if (/^[a-z]$/i.test(k)) return { key: k, code: `Key${k.toUpperCase()}`, keyCode: k.toUpperCase().charCodeAt(0), text: k };
  return { key: k, code: k, keyCode: 0 };
}

// The app's page. `open` finds it; every call reaches the page as it is.
export class AppPage {
  // `cdp`: an endpoint already up (a desktop Chromium on the same files),
  // else the app `pkg` on the one device adb sees. `ms`: how long each wait
  // may take.
  static async open({ cdp = '', pkg = appId(), ms = 90000, log = console.log } = {}) {
    const p = new AppPage(cdp, pkg, ms, log);
    await p.connect();
    return p;
  }

  constructor(cdp, pkg, ms, log) {
    this.cdp = cdp;
    this.pkg = pkg;
    this.ms = ms;
    this.log = log;
    this.session = null;
    this.target = null;
    this.pid = null;
    this.problems = [];
    this.scripts = [];
    this.handlers = { pageerror: [] };
    this.keyboard = { press: (k) => this.press(k) };
  }

  on(event, fn) {
    (this.handlers[event] || (this.handlers[event] = [])).push(fn);
  }

  _event(msg) {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      const text = (d.exception && d.exception.description) || d.text;
      this.problems.push(`uncaught: ${text}`);
      for (const fn of this.handlers.pageerror) fn({ message: text });
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      this.problems.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      this.problems.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
    }
  }

  // Find the page as it is now and wait for it to stand still: the same
  // process and the same page for two seconds, loaded, before it is used.
  async connect() {
    if (this.session) this.session.close();
    this.session = null;
    const settled = await until('the app\'s page to load and stand still', async () => {
      const { base, pid } = this.cdp ? { base: this.cdp, pid: null } : await appEndpoint(this.pkg, this.ms, this.log);
      const newest = async () => {
        const list = await (await fetch(`${base}/json/list`)).json();
        // The newest page of the app's own origin (a relaunch leaves the old one a moment).
        return list.filter((t) => t.type === 'page' && APP_ORIGIN.test(t.url)).pop() || null;
      };
      const first = await until('the app\'s page', newest, 30000);
      await sleep(2000);
      const again = await newest();
      if (!again || again.id !== first.id) return null;
      if (pid && pidNow(this.pkg) !== pid) return null;
      const ws = new WebSocket(again.webSocketDebuggerUrl);
      await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(transport('the DevTools socket would not open')); });
      const s = new Session(ws, (m) => this._event(m));
      // Enabling these replays what the page logged before the socket opened.
      await s.send('Runtime.enable');
      await s.send('Log.enable');
      await s.send('Page.enable');
      const r = await s.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
      if (r.result.value !== 'complete') {
        s.close();
        return null;
      }
      return { s, target: again, pid };
    }, this.ms * 2, 1000);
    this.session = settled.s;
    this.target = settled.target;
    this.pid = settled.pid;
    this.log(`page: ${this.target.url}${this.pid ? ` (process ${this.pid})` : ''}`);
    for (const source of this.scripts) await this.session.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  // Every call goes through here: if the page went away, find it again.
  async _call(method, params, ms) {
    for (let tries = 0; ; tries++) {
      try {
        return await this.session.send(method, params, ms);
      } catch (e) {
        if (!e.transport || tries >= 4) throw e;
        this.log(`reconnecting (${e.message})`);
        await sleep(1500);
        await this.connect();
      }
    }
  }

  // A function (with `arg`) or an expression, in the page; its value.
  // `gesture`: it counts as a tap, which is what lets a page start audio.
  async evaluate(fn, arg, { gesture = false, ms = 60000 } = {}) {
    const expression = typeof fn === 'function' ? `(${fn})(${arg === undefined ? '' : JSON.stringify(arg)})` : fn;
    const r = await this._call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: gesture }, ms);
    if (r.exceptionDetails) throw new Error(`in the page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  }

  // A script that runs before the page's own, from the next load on.
  async addInitScript(source) {
    const text = typeof source === 'function' ? `(${source})()` : source;
    this.scripts.push(text);
    await this._call('Page.addScriptToEvaluateOnNewDocument', { source: text });
  }

  // Load the page again, and wait for the new one to stand still.
  async reload() {
    try { await this.session.send('Page.reload', { ignoreCache: true }); } catch { /* it went away reloading */ }
    await sleep(1500);
    await this.connect();
  }

  async click(selector) {
    return this.evaluate((s) => document.querySelector(s).click(), selector, { gesture: true });
  }

  async press(k) {
    const d = keyOf(k);
    const base = { key: d.key, code: d.code, modifiers: d.modifiers || 0, windowsVirtualKeyCode: d.keyCode, nativeVirtualKeyCode: d.keyCode };
    await this._call('Input.dispatchKeyEvent', { type: d.text ? 'keyDown' : 'rawKeyDown', ...base, text: d.text });
    await this._call('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }

  async screenshot(file) {
    const r = await this._call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  }

  close() {
    if (this.session) this.session.close();
  }
}
