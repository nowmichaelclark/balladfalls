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

**His fourth answer, the same evening, settles both open questions:**
"E9T-ZxDxj stays clean when on the home screen or even when in other apps.
I tried chrome with the screen on and off with both lite and no lite- no
crackles".

| | screen on, in front | screen on, behind Home or another app | screen off |
|---|---|---|---|
| the app | clean (full and Lite) | clean | crackles (full and Lite) |
| the site in Chrome | clean (full and Lite) | not tried | clean (full and Lite) |

Asked which browser that was: "chrome for the crackle-free test" (their
DuckDuckGo screenshot was the Painter's test). Not yet known: headphones.

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
- Not being in front isn't enough by itself: Home and other apps are clean.
  The lit lock screen's faint ones, if real, go with the screen locking.
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
  samples are very unlikely to be at fault: the same loop is clean with the
  screen on, and in Chrome with it off.
- The long tasks are the blocking boxes (`prompt`: paste code, Name) waiting
  for him, not work.

## What the diagnostics can't say

- Playing with the screen off: the app keeps its page visible while it plays
  (`AppWebView`), so the "while hidden" lines are paused time only.
- A full ten minutes with the screen off: 395 s of sound in all, so that
  test is still to do.

## Session 30g's build (v201): the stream on a music player's path

The cause is not proven. What was found in the sources:

- Chrome opens `playback` as AAudio's power-saving mode with 1,024-frame
  callbacks at 48 kHz (`aaudio_stream_wrapper.cc`, `aaudio_output.cc`,
  `audio_latency.cc`, `renderer_webaudiodevice_impl.cc`; the last link, from
  the hint to the playback tag, is read from their names, not followed).
- That mode is Android's deep buffer, "a mixer that wakes up less often than
  the FAST mixer", and never MMAP (`AudioStreamTrack.cpp`,
  `AudioStreamBuilder.cpp`; the same on 8.1 and 13).
- The old stream's 1536 of 1536 frames is eight bursts of 192, what AAudio's
  legacy fast track asks for: so it went through the fast mixer (inferred
  from the numbers). A glitch after the track, in that mixer or below it,
  needn't reach the track's underrun count, which fits the zeros.

The change is that same mode and callback size, AAudio's own buffer kept.
Rejected:

- a larger buffer on low latency: it was already at its capacity, and the
  same fast mixer stays;
- the mode None: "a normal mixer in front of the FAST mixer", so still it;
- Chrome's shrink to two bursts: less margin, for latency a music player
  doesn't need;
- a lock or a stronger wake lock: the partial one is held, and the counters
  saw no missed callback.

What it costs, for Mikey's ears and phone: Pause, Next and Play are heard
later by the new latency (Diagnostics says it); the speaker's own processing
may differ (the fast path can skip effects the music path has); the callback
thread loses real-time priority, so its measured busy share may rise and the
Lite rule (step 6) is still to be measured.

The new counts in Diagnostics: playback behind the phone's clock (over
10 ms, held for a second), callbacks over their deadline, the worst four and
the longest gap between two. Zeros don't prove a clean sound: a glitch that
doesn't stop the device's position isn't seen. (A count of gaps longer than
AAudio's buffer was dropped after Mikey's listen: it read 123 on playback
they heard as clean, because the mixer and the device hold more than that
buffer on this path.)

CI's emulator on it (run 45038681309, f6c3ce0, every job green) **did not
get this path**: asked for power saving, it gave the mode None (burst 2180,
buffer 4360, 152 to 165 ms measured, the thread normal). So its zero
underruns in five minutes, and in ten with the screen off, say nothing of a
deep buffer; nor that a phone is free of crackles. Its worst callback with
the screen off took 41.4 ms (194% of its deadline) and the 91 ms buffer took
it with no underrun. The phone's `stream:` line has to say "power saving"
for the listen to test this change.

## Mikey's listen on v201 (f6c3ce0's APK, 2026-11-23): no crackles

The listen that closes item 115 once #458 merges. Mikey, on the moto g
stylus 5G (2022), headphones, after hearing the crackles on v195 with the
same headphones first:

> I didn't do the test for as long as you asked, but I did it long enough to
> satisfy my own thoughts: There are no more crackles. This time I used
> headphones, but I also used headphones on v195 first to ensure I could
> hear the crackling there and I could. Now, I don't hear any crackles at
> all in the app no matter which style of playing, lite on or off, or
> anything else.

Shorter than the ten minutes asked, by their choice. Their Diagnostics,
copied while playing, about eleven minutes in:

- `stream:` 48 kHz stereo, burst 1924, callbacks of 1024, buffer 3848 of
  3848, **power saving**, shared, thread normal/0, reopens 0, latency 222 ms
  (measured), busiest callback 67.2% of its deadline, mean 15.10%, sound
  634.5 s. So the phone gave the new path.
- `glitches:` 0 underruns, 0 times playback fell behind (and 123 gaps past
  the buffer, the dropped count above).
- `callbacks:` 0 over their deadline, longest gap 87 ms; the worst four 67%
  (14.3 ms, 1024 frames, nothing but playing), 64%, 60%, 59%.
- `busiest:` 22% over 20 s and over 60 s, full ("lite: false, yours"), under
  the 50% line that moves it to Lite; render stereo 13.6% of real time; late,
  missed and dropped 0.

Asked afterward whether Pause and Next felt slow in v201 (about 0.2 s later
than before): "Didn't notice". The 222 ms is accepted; no follow-up.
