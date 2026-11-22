# 115: crackles in the Android app (brain B-parallel 3, 2026-11-22)

**A 1.0 blocker** (Mikey, 2026-11-22: "Yes, blocker"). Session 30g's brief is
`docs/sessions/30g-crackles.md`; this is what was seen and measured.

## What Mikey reported

v195's debug APK (run 44999015260, ec33bdb) on a moto g stylus 5G (2022),
Android 13, WebView 157, playing the Batch 6 album: "I did hear a few
crackles, at some point it turned to lite processing and then I switched it
back. The crackles were a bit concerning this close to 1.0". The rest was
"mostly right".

**His second test, the same day, narrows it to the screen being off.** Loop
`E9T-ZxDxj` ("I don't necessarily [think] it had to do with this particular
loop, it just seemed to be easy to reproduce the crackles with this loop"):

| | screen on | screen off |
|---|---|---|
| the app, full | clean | crackles |
| the app, Lite | clean | crackles |

The site in Chrome: "On the website, it's not making any crackles" (whether
the screen was off for that is not said).

**His third answer, the same evening:** it was the phone's speaker. Asked
whether the lock screen's Play starts after two minutes paused: "Yes playing
and pausing from the lock screen works fine". And, not sure of it: "I think I
do also sometimes hear some very brief crackles while the screen is locked
but it's not at the black lock screen and I can still see my phone
background. But those crackles are very brief so I'm not even sure if they
are there or I am hearing something that's not there."

Not yet known: Chrome with the screen off; the app behind another with the
screen on (Home); headphones.

Diagnostics after it (copied paused, the stream stopped): late, missed,
dropped and underruns all 0 again, so **the counters don't see these
crackles**; busiest callback 252.2%, mean 24.50%; sound 313.8 s; hidden and
paused 191.0 s, the page frozen by the system 60 s into that and resumed
only when shown.

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
- The two players ask Android for different paths: the site
  `latencyHint: 'playback'` (js/main.js), the app AAudio's low-latency path
  (`PERFORMANCE_MODE_LOW_LATENCY`, aaudio.rs: 4 ms callbacks at this burst).
  The app asks for no other mode and sets no buffer size.
- The emulator's ten minutes with the screen off passes: it has no phone's
  power saving, and it reads the same xrun count that read 0 here.

## What is suspected, not shown

- **The first suspect: the low-latency path with the screen off.** The CPU's
  clocks and cores drop, and 4 ms callbacks miss where a music player's
  larger, slower path would not. Oboe's glitch notes describe the clock
  lagging a load by about 100 ms and losing it at a core's change
  (<https://android.googlesource.com/platform/external/oboe/+/7d25f15f%5E/docs/notes/glitches.md>);
  a report of the same crackles on other phones eased with the mode None
  (<https://github.com/google/oboe/issues/564>). Neither is about the screen.
- **Or the app not being in front, the dark screen only making it worse**
  (if the faint crackles on the lit lock screen are real). Android moves an
  app that isn't on top to fewer or smaller cores, a foreground service's too,
  and a real-time thread stays within the cores it is given. Crackles after
  Home, the screen on, would show it.
- The speaker's own path (its protection and processing) adds to it:
  headphones would show that.
- A paused page is frozen after a minute with the screen off, and the lock
  screen's Play is only posted to the page (`Playback.toPage`), so Play may
  do nothing after a longer pause. `background.mjs` presses Play after 11 s.
  He says Play works fine on his phone, so this is for the test to hold.
- The init is the 227% callback.
- A switch by hand clicks: `buildAudio` (js/main.js) disposes of the old
  output at once, and `Dispose` clears the core with no fade, where the
  app's own switch fades first (`handOff`, js/quality.js).
- The rule that moved it to Lite (`OVER`, 50% of a quarter-second) is the
  browser's, never measured for the app's 32 ms buffer and real-time thread.
  His choice since ("yours") hides the reason it moved.
- `AAudioStream_getXRunCount` misses glitches on this phone's path. The
  samples themselves are unlikely to be at fault: the same loop is clean with
  the screen on.
- The long tasks are the blocking boxes (`prompt`: paste code, Name) waiting
  for him, not work.

## What the diagnostics can't say

- Playing with the screen off: the app keeps its page visible while it plays
  (`AppWebView`), so the "while hidden" lines are paused time only.
- A full ten minutes with the screen off: 395 s of sound in all, so that
  test is still to do.
