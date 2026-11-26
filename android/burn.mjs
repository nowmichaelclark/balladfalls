// The "lighter on processor" rule on the Android app's native core
// (step 6), measured on an emulator: a slower phone made with `?burn=`
// (microseconds of work added to every 128 frames the core renders, on the
// audio thread, android/native/src/engine.rs's `burn`), swept from none to
// more than the audio's own time. At each burn it reads, with "lighter on
// processor" pinned to full by the listener's own choice, the busiest
// quarter-second the page's rule sees (js/quality.js) and the glitches the
// native core counts (underruns, the speaker's playhead behind the clock,
// callbacks over their deadline), with the screen on and then off; and,
// with no choice of the listener's, whether the app moved to lite by itself.
// What CI's `burn` job runs (only=burn, by hand: android/emulator-burn.sh).
//
//   node android/burn.mjs [--burns 0,800,1400,1800,2100,2300,2500,2700] [--seconds 40] [--summary FILE]
//
// The emulator's figures are the emulator's: they place the line where the
// native buffer and thread start to glitch on this machine, not on a phone.

import fs from 'node:fs';
import { AppPage, appId, adb, until } from './cdp.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BURNS = opt('--burns', '0,800,1400,1800,2100,2300,2500,2700').split(',').map(Number);
const SECONDS = Number(opt('--seconds', '40'));
const SUMMARY = opt('--summary', '');
const CODE = 'E9T-ZxDxj';
const pkg = appId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const sh = (...a) => adb('shell', ...a);
const asleep = () => /mWakefulness=Asleep/.test(sh('dumpsys', 'power'));
const screenOff = async () => {
  sh('input', 'keyevent', 'KEYCODE_SLEEP');
  await until('the screen to go off', () => asleep(), 20000, 500);
};
const screenOn = async () => {
  sh('input', 'keyevent', 'KEYCODE_WAKEUP');
  await until('the screen to come on', () => !asleep(), 20000, 500);
  try { sh('wm', 'dismiss-keyguard'); } catch { /* none */ }
};

sh('pm', 'grant', pkg, 'android.permission.POST_NOTIFICATIONS');
sh('settings', 'put', 'system', 'screen_off_timeout', '1800000');
const page = await AppPage.open({ pkg, ms: 120000, log });
const ev = (fn, arg, gesture = false, ms = 20000) => page.evaluate(fn, arg, { gesture, ms });
const diag = () => ev("document.getElementById('diagRefresh').click(); document.getElementById('diagOut').textContent");
const num = (re, t) => {
  const m = re.exec(t);
  return m ? Number(m[1]) : null;
};
// What Diagnostics says of the busy share and the glitches.
const read = (t) => ({
  b20: num(/^busiest: (\d+)% over 20 s/m, t),
  under: num(/^glitches: (\d+) underruns/m, t),
  behind: num(/underruns, (\d+) times playback fell behind/m, t),
  over: num(/^callbacks: (\d+) over their deadline/m, t),
  worst: num(/busiest callback ([\d.]+)% of its deadline/, t),
  mean: num(/mean ([\d.]+)%/, t),
  lite: /^cores: .* lite: true/m.test(t),
  source: (/^cores: .* lite: \w+, (.*)$/m.exec(t) || [])[1] || '',
  stream: (/^stream: (.*)$/m.exec(t) || [])[1] || '',
});

let opened = 0;
// The page again at `burn`, the loop ready by its link, "lighter on
// processor" the listener's (`yours`: false for full) or nobody's (null).
async function open(burn, yours) {
  await ev((y) => {
    const key = 'driftloom.prefs.v1';
    const p = JSON.parse(localStorage.getItem(key) || '{}');
    delete p.liteAuto;
    if (y === null) delete p.lite;
    else p.lite = y;
    localStorage.setItem(key, JSON.stringify(p));
  }, yours);
  // A new query each time: the same address with only a new hash would not
  // load the page again.
  opened++;
  try {
    await ev(`location.href = location.origin + location.pathname + '?burn=${burn}&n=${opened}#c=${CODE}'; true`);
  } catch { /* it went away loading */ }
  await sleep(2500);
  await page.connect();
  await until('the page to be built', () => ev("document.readyState === 'complete' && !!document.getElementById('playBtn')"), 90000);
  await sleep(1500);
  await ev("document.getElementById('playBtn').click()", undefined, true);
  await until('the music to play', () => ev(() => document.getElementById('playBtn').getAttribute('aria-label') === 'Pause'), 60000);
}

const rows = [];
try {
  for (const burn of BURNS) {
    log(`\n-- burn ${burn} us a 128 frames --`);
    // Pinned to full by the listener: the busy share and the glitches.
    await open(burn, false);
    await sleep(6000);
    await ev("document.getElementById('diagReset').click()");
    await sleep(SECONDS * 1000);
    const on = read(await diag());
    log(`screen on:  ${JSON.stringify(on)}`);
    await ev("document.getElementById('diagReset').click()");
    sh('input', 'keyevent', 'KEYCODE_HOME');
    await sleep(1000);
    await screenOff();
    await sleep(SECONDS * 1000);
    await screenOn();
    sh('am', 'start', '-n', `${pkg}/app.loops.MainActivity`);
    await sleep(2500);
    const off = read(await diag());
    log(`screen off: ${JSON.stringify(off)}`);
    // Nobody's choice: does the app move to lite by itself?
    await open(burn, null);
    await sleep((SECONDS + 10) * 1000);
    const free = read(await diag());
    log(`by itself:  lite ${free.lite} (${free.source}), busiest ${free.b20}%`);
    rows.push({ burn, on, off, free });
  }
} catch (e) {
  log(`the run stopped: ${e.message}`);
}
const stream = rows.length ? rows[0].on.stream : '';
try { page.close(); } catch { /* gone */ }

const cell = (r) => `${r.b20 ?? '?'}% | ${r.worst ?? '?'}% | ${r.under ?? '?'} / ${r.behind ?? '?'} / ${r.over ?? '?'}`;
const text = [
  `### The lite rule on the native core (emulator, ${CODE}, ${SECONDS} s a reading)`,
  '',
  `The stream: ${stream}`,
  '',
  'Busiest is the busiest quarter-second over 20 s (the page\'s rule); worst the busiest callback; glitches are underruns / times the playhead fell behind / callbacks over their deadline, since "reset counters".',
  '',
  '| burn (us a 128 frames) | screen on: busiest | worst | glitches | screen off: busiest | worst | glitches | by itself |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.burn} | ${cell(r.on)} | ${cell(r.off)} | ${r.free.lite ? `lite (${r.free.source})` : 'full'} |`),
  '',
  'Said only of the emulator: where its native buffer and thread start to glitch, not a phone\'s.',
  '',
].join('\n');
log(`\n${text}`);
if (SUMMARY) fs.appendFileSync(SUMMARY, text);
process.exit(rows.length === BURNS.length ? 0 : 1);
