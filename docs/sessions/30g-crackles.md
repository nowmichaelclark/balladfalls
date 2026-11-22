# Session 30g: no crackles in the Android app (115)

Written by brain B-parallel 3 on 2026-11-22, after Mikey heard crackles in
v195's Android app and made them a 1.0 blocker ("Yes, blocker").

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 30f (all four of its PRs). Nothing runs alongside
  it, and session 30 waits for it.
- **Queue item:** item 115.

Paste everything in the block as the session's first message.

````text
Hands session 30g on the road to Driftloom's 1.0 (Opus 5.5, high): no crackles in the Android app (item 115), a 1.0 blocker.

Read first: AGENTS.md; core/AGENTS.md; android/README.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, Known issues, item 115); docs/CORE.md (promises 1 and 2); docs/notes/115-crackles.md (the evidence: what is known and what is only suspected); docs/notes/for-mikey.md (item 115's three checks, and any answer to them); android/native/src/ (engine.rs, aaudio.rs, bridge.rs); js/quality.js, js/native.js, js/output.js, js/main.js (buildAudio, autoQuality, Diagnostics); docs/ALBUMS.md (the Batch 6 album in the app).

Check your place: in docs/sessions/README.md every row in session 30g's After column should be ticked, and no other hands session running. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-22, on the moto g stylus 5G (2022)): "I did hear a few crackles, at some point it turned to lite processing and then I switched it back. The crackles were a bit concerning this close to 1.0". Asked whether to make them a 1.0 blocker: "Yes, blocker". Their second test that day, on loop E9T-ZxDxj: in the app it crackles only with the screen off, on full and on Lite alike; screen on is clean. The site in Chrome was clean too (they didn't say whether with the screen off: see for-mikey.md for the answer). Every counter read 0 through it.

Find the cause before choosing the fix. The suspects in the note are suspects. Small PRs, one per kind of thing. The screen-off finding puts step 5 (the stream) first, with step 2's counters in the same build so one test on the phone says both whether it is gone and why; step 1 is then a short check on E9T-ZxDxj, not a search:

1. In the samples or in playback? Render the Batch 6 album natively (the same engine offline, the callback sizes a phone asks for, through its track changes, at full and lite, and across a quality switch) and look for discontinuities, non-finite values and clipping, against wasm's render. If it is in the samples, that is the bug: fix it, and what is generated or sounds doesn't otherwise move.
2. What the phone can say: in Diagnostics, the callbacks over their deadline (how many, the worst few with when, their frames and what they did: an init, a load, a track change), the longest gap between callbacks, a glitch count that doesn't rest on AAudio's xrun count alone, why and when the app last moved to Lite (kept after the listener switches back), and the time played with the screen off. "reset counters" resets them. Nothing allocated, locked or logged in the callback.
3. No spike: no work on the audio thread that isn't a block's rendering past what promise 1 allows. Measure Command::Init's core.quality first, and every other command, natively. What is heavy is made off the thread or spread across blocks.
4. No click at a switch: Lite by hand and by itself each go over without a discontinuity, at any point in a loop.
5. The stream, measured and argued: whether a music player should use the low-latency path with a 1536-frame buffer, or a larger buffer or another performance mode (the layers stay in time by the measured latency; Play, Pause and Next still feel immediate). Take the smallest change the evidence supports and say what was rejected.
6. The Lite rule in the app: measured for the native buffer and thread, so a phone with room to spare isn't moved to Lite, and one without still is. The browser's rule and a listener's own choice don't change.
7. The lock screen's Play after a long pause: paused with the screen off for over a minute, the page is frozen. Make the screen-off job press Play after two minutes paused, and fix it if nothing plays.

Yardsticks: the album's native renders free of discontinuities at full and lite and across switches, by a test that fails on the bug if there was one; a test that times every command in the callback, and the worst against promise 1; a switch by hand and by the app with no step in the samples; the native tests (fill_allocates_nothing among them); the Android workflow green, the screen-off job with zero underruns and no glitch by the new count; tools/autolite.mjs unchanged for browsers; goldens and the core baseline unchanged unless a bug in the samples was the cause (then say exactly what moved); the gate; the nightly started by hand on main after the last merge, and read. An emulator can't prove a phone is free of crackles: never write that it did.

Only Mikey's ears close the blocker. In for-mikey.md: the APK to install (a direct link to the run, saying it needs a GitHub sign-in) and a short test: E9T-ZxDxj and the Batch 6 album, ten minutes with the screen off, one switch to Lite and back, then Diagnostics copied. If the fix depends on what only their phone can measure, merge the diagnostics, ask for that one test, and leave a "Left" list at the top of this file; don't guess at a fix.

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current (item 115 stays "waiting on Mikey's ears" until they say it is clean), tick session 30g's row in docs/sessions/README.md once the fix has merged, and end with a plain summary for Mikey: what the cause was or that it is not yet known, what merged (PR numbers), and the test to run. Do this session's work and stop: the next session has its own prompt.
````
