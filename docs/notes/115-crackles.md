# 115: crackles in the Android app (brain B-parallel 3, 2026-11-22)

**A 1.0 blocker** (Mikey, 2026-11-22: "Yes, blocker"). Session 30g's brief is
`docs/sessions/30g-crackles.md`; this is what was seen and measured.

## What Mikey reported

v195's debug APK (run 44999015260, ec33bdb) on a moto g stylus 5G (2022),
Android 13, WebView 157, playing the Batch 6 album: "I did hear a few
crackles, at some point it turned to lite processing and then I switched it
back. The crackles were a bit concerning this close to 1.0". The rest was
"mostly right". Not yet known: which tracks, the same spot or random, at a
track change or not, screen on or off, speaker or wired, on Lite, in Chrome.

## His Diagnostics, two copies a few minutes apart

| | first | second |
|---|---|---|
| late, missed, dropped | 0, 0, 0 | 0, 0, 0 |
| underruns | 0 | 0 |
| busiest quarter-second, over 20 s | 57% | 38% |
| the same, over 60 s | 57% | not yet |
| busiest callback, of its deadline | 227.2% | 227.2% |
| mean callback | 22.68% | 23.95% |
| render, stereo, of real time | 26.6% over 97 s | 27.2% over 207 s |
| sound since the engine started | 291.7 s | 395.0 s |
| latency, measured | 53 ms | 52 ms |
| longest task on the page | 4,636 ms (Save) | 6,173 ms (Library) |

Both: full, "lite: false, yours"; 48 kHz stereo, burst 192, buffer 1536 of
1536, low latency, shared, thread policy 1073741825/2 (SCHED_FIFO with
reset-on-fork), reopens 0.

## What is known

- The busiest callback is a maximum since the engine started, so both copies
  show one event at some time in the first 291.7 s. Its frames are counted
  (`busiest_frames`) but Diagnostics doesn't show them. At a burst or less it
  is about 9 ms, inside the 32 ms buffer.
- `docs/CORE.md`, promise 1 proposes no block over 25% of its deadline on the
  slowest tester phone (30% at full on the Moto G Power (2022), another phone).
- `Command::Init` (`android/native/src/engine.rs`) runs `core.quality` inside
  the callback, at launch and at each quality switch; its comment says about
  a millisecond.
- Measured here, in WebAssembly under Node on the desktop, 40 times:
  `dl_quality` median 1.99 ms, worst 2.82; `dl_clear`, `dl_layout` and
  `dl_play_attach` medians under 0.01 ms. Eight loops (speed.js's four and
  four others, not the album's; 50 s each, best of three runs a block): the
  worst block 1.2 to 2.0 times the mean, the busiest quarter-second at most
  1.6 times. The phone's 227% is about ten times its mean.

## What is suspected, not shown

- The init is the 227% callback.
- A switch by hand clicks: `buildAudio` (js/main.js) disposes of the old
  output at once, and `Dispose` clears the core with no fade, where the
  app's own switch fades first (`handOff`, js/quality.js).
- The rule that moved it to Lite (`OVER`, 50% of a quarter-second) is the
  browser's, never measured for the app's 32 ms buffer and real-time thread.
  His choice since ("yours") hides the reason it moved.
- `AAudioStream_getXRunCount` misses glitches on this phone's path, or the
  crackle is in the samples. Nothing here tells the two apart yet.
- The long tasks are the blocking boxes (`prompt`: paste code, Name) waiting
  for him, not work.

## What the diagnostics can't say

- Playing with the screen off: the app keeps its page visible while it plays
  (`AppWebView`), so the "while hidden" lines are paused time only.
- A full ten minutes with the screen off: 395 s of sound in all, so that
  test is still to do.
