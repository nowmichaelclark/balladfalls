// The Android app's smoke test (queue item 107a; since session 27, 107c, on
// the native core): the installed app starts, its page loads, Play is
// pressed, and the page's Diagnostics shows the core's player playing
// natively, with no error; the page's main thread is then blocked for five
// seconds and the music plays on through it (docs/CORE.md, promise 1). It
// drives the app's own WebView through the Chrome DevTools protocol
// (android/cdp.mjs), which waits for the page as it is: a fresh install can
// restart the app under the test, with a new process and a new page. No test
// library, no accessibility tree: the page is read as the listener's page is.
//
//   node android/smoke.mjs                  the app on the one device or
//                                           emulator adb sees (installed)
//   node android/smoke.mjs --cdp http://127.0.0.1:9222
//                                           no adb: a DevTools endpoint that
//                                           is already up (a desktop Chromium
//                                           on the same files: how the
//                                           script itself is tried; it plays
//                                           the page's worklet there)
//   --package ID    the app's id (default: android/gradle.properties's)
//   --shot FILE     a screenshot of the page after the check (a PNG)
//   --timeout S     seconds to wait for each step (default 90)
//
// Needs Node 22 (its WebSocket) and, for the device, adb on the path.

import { execFileSync } from 'node:child_process';
import { AppPage, appId, until } from './cdp.mjs';
import { LOOPS } from '../tools/stalls.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const STEP_MS = Number(opt('--timeout', '90')) * 1000;
const CDP = opt('--cdp', '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const page = await AppPage.open({ cdp: CDP, pkg: opt('--package', appId()), ms: STEP_MS, log });
const ev = (expression, gesture = false) => page.evaluate(expression, undefined, { gesture });
const diag = () => ev("document.getElementById('diagRefresh').click(); document.getElementById('diagOut').textContent");
const line = (t, key) => (t.split('\n').find((l) => l.startsWith(`${key}:`)) || '').trim();
const field = (t, re) => Number((re.exec(t) || [])[1]);
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push(ok);
  log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
};
let text = '';
try {
  await until('the page to be built', () => ev("document.readyState === 'complete' && !!document.getElementById('playBtn') && !!document.getElementById('diagOut')"), STEP_MS);
  text = await until('the core to load', async () => {
    const t = await diag();
    return /^core: loaded/m.test(t) || /^core: not loaded/m.test(t) ? t : '';
  }, STEP_MS);
  check('the core loaded', /^core: loaded/m.test(text), line(text, 'core'));
  check('no plain line in the card\'s place', await ev("document.getElementById('plainLine').hidden"));
  const native = await ev("typeof window.DriftloomNative === 'object' && !!window.DriftloomNative");
  if (!CDP) check('the app\'s bridge to the native core is in the page', native);

  // A fixed busy loop, pasted (a paste plays): the opening loop is drawn at
  // random, and a quiet one gave the blocked-page check less sound than the
  // time it waited (2 of 106 loops on main's own core, session 30).
  const code = LOOPS.shatter.code;
  await ev(`(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => ${JSON.stringify(code)}, writeText: async () => {} } });
    document.getElementById('pasteCode').click();
    return true;
  })()`, true);
  text = await until('the player to play', async () => {
    const t = await diag();
    const m = /player: playing, step (\d+)/.exec(line(t, 'engine'));
    return m && Number(m[1]) > 0 ? t : '';
  }, STEP_MS);
  const first = field(line(text, 'engine'), /player: playing, step (\d+)/);
  await sleep(4000);
  text = await diag();
  const second = field(line(text, 'engine'), /player: playing, step (\d+)/);
  const engine = line(text, 'engine');
  if (native) {
    check('Diagnostics shows the core\'s player, native', /^engine: native \(the core's player\)\s+late: 0\s+missed: 0\s+dropped: 0/.test(engine), engine);
    check('Diagnostics shows the stream running', /^stream: running/m.test(text), line(text, 'stream'));
    check('the WebView plays no audio of its own (no keepalive element)', await ev("document.querySelectorAll('audio').length === 0"));
  } else {
    check('Diagnostics shows the core\'s player', /^engine: rust \(the core's player\)/.test(engine), engine);
  }
  check('no error in the engine line', !/none \(|error|fail/i.test(engine));
  check('the player plays on (its step moves)', second !== first, `step ${first}, then ${second}`);
  const named = await ev("document.getElementById('loopName').textContent.trim()");
  // The page shows a loop's name without its style ("glein-fei" for shatter-glein-fei).
  const shown = LOOPS.shatter.name.replace(/^[a-z]+-/, '');
  check('the pasted busy loop is the one playing', named === shown, `${named} for ${shown}`);
  if (!CDP && native) {
    // Android's font size is the page's root size (session 30f), changed under the running app.
    const scale = (v) => execFileSync('adb', ['shell', 'settings', 'put', 'system', 'font_scale', String(v)]);
    scale(1.5);
    let root = '';
    try {
      root = await until('the font size to reach the page', async () => {
        const px = await ev('getComputedStyle(document.documentElement).fontSize');
        return px === '24px' ? px : '';
      }, STEP_MS);
    } finally {
      scale(1);
    }
    check('Android\'s font size is the page\'s text size (1.5x: 24 px)', root === '24px', root);
  }

  if (native) {
    // Promise 1: the page's main thread blocked for five seconds, and the
    // music plays on, nothing late, no underrun (the native thread needs
    // nothing from the page).
    const before = await diag();
    const t0 = Date.now();
    await ev('(() => { const t = Date.now(); while (Date.now() - t < 5000) { /* busy */ } return 1; })()');
    const blocked = Date.now() - t0;
    await sleep(3000);
    const after = await diag();
    const took = (Date.now() - t0) / 1000;
    const sound = (t) => field(line(t, 'stream'), /sound ([\d.]+) s/);
    const under = (t) => field(line(t, 'engine'), /underruns: (\d+)/);
    const heard = sound(after) - sound(before);
    check('the page blocked for 5 s: the music played on through it', blocked >= 4900 && heard >= took - 1.5, `blocked ${blocked} ms; ${heard.toFixed(1)} s of sound in ${took.toFixed(1)} s`);
    check('  ...with no underrun and nothing late', under(after) === under(before) && /late: 0\s+missed: 0\s+dropped: 0/.test(line(after, 'engine')), `underruns ${under(before)} -> ${under(after)}; ${line(after, 'engine')}`);
    text = after;
  }
} catch (e) {
  check('the check ran to its end', false, e.message);
  try { text = text || (await diag()); } catch { /* the page may be gone */ }
}

log('\n---- Diagnostics ----');
log(text);
log('---------------------');
if (page.problems.length) log(`the page logged ${page.problems.length} problem(s):\n  ${page.problems.join('\n  ')}`);
const shot = opt('--shot', '');
if (shot) {
  try {
    await page.screenshot(shot);
    log(`screenshot: ${shot}`);
  } catch (e) { log(`no screenshot: ${e.message}`); }
}
const uncaught = page.problems.filter((p) => p.startsWith('uncaught'));
check('no uncaught error in the page', !uncaught.length, uncaught.join('; '));
page.close();
const failed = checks.filter((c) => !c).length;
log(failed ? `\n${failed} check(s) failed` : '\nthe app\'s page plays');
process.exit(failed ? 1 : 0);
