# Session 30b: the layers show what is heard (110)

Written 2026-11-18 at Mikey's request (his list of seven for 1.0, item 5:
the layers' playheads should match what is heard).

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 27 (done; it changed `js/worklet.js`,
  `js/player.js` and the bridge this one changes). It may run alongside 21,
  23, 24, 29 and 30a; never beside 28 (both change what the Android bridge
  relays), 30c (both change the core's player and `js/worklet.js`) or 30d
  (both change the playheads' look in `js/ui.js` and `css/style.css`).
- **Queue item:** item 110.

Paste everything in the block as the session's first message.

````text
Hands session 30b on the road to Driftloom's 1.0 (Opus 5.5, high): the layers show what is heard (item 110).

Read first: AGENTS.md; core/AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt; mind "The tablet's margin"); docs/QUEUE.md (status, standing rules, merge policy, item 110); docs/LONGFORM.md (what a section hears: core/src/generator/heard.rs); core/src/player/ (about.rs's grid, events.rs, the sequencer); core/src/wasm.rs and core/include/dlcore.h; js/worklet.js, js/player.js (the grid and cursor queues, heardTime, visualStep), js/ui.js (buildLayers, stepsForBar, moveCursor), js/main.js (the layers' drawing), js/native.js and android/native (the same events on Android); tools/rows.mjs, tools/views.mjs.

Check your place: in docs/sessions/README.md every row in session 30b's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-18): "The playheads in the layers viewport don't seem to be working properly. Sometimes when a note plays, nothing is drawn and sometimes there is something drawn and we don't hear a note play. It needs to better and more precisely match what is being heard. It needs to take into account that sometimes a sound is faded out for instance or will fade in later, etc. I don't know the exact fix for this, but ultimately the visuals need to line up correctly with the sound."

What we know, to check rather than trust: the layers draw the grid the core reports for each pass (core/src/player/about.rs, "the layers' grid of the pass being decided"), a note's velocity as composed, timed by the pass's start. What is heard can differ: a long piece's sections play their layers at levels of their own (heard.rs: an arc's lift, a tune alone, a floor out, a breath, the landing), voices fade in and out, lite leaves notes out (the refusals), the track's close fades, a jump lands mid-pass, a held note sounds across bars with no new dot, and the cursor's timing rests on the measured output latency (heardTime; Diagnostics' "Playhead trim"), which may be off on a phone or on Android's native audio.

The work, one PR (core and app; BUILD and CACHE; js/dlplayer.wasm rebuilt), or two if the core's part is cleaner alone:

1. Measure the mismatch first, with a tool that plays loops on the player in Node (as tools/measure.mjs does) and compares what the layers would draw with what each layer's channel actually sounds, note by note: onsets drawn and not heard, heard and not drawn, and the loudness drawn against the loudness heard. Plain loops at full and lite, long pieces in their quiet and fading sections, a jump, the track's close. Put the before figures in the PR.
2. The core reports what each layer sounds, as heard: each note's onset with its loudness after the section's level, the fades and the refusals, in the events the page already reads (a grid of what is heard, or note events; your call, measured: the events' cost on the audio thread within the tablet's margin, nothing late). The same events reach the page on Android through the native core.
3. The page draws a note when it is heard and as loud as it is heard: a faded note dimmer, a note left out not drawn, a layer fading in coming up with its sound. Keep the layers' look (dots, accents, the halo); the look of the playhead is session 30d's.
4. The cursor's timing against what is heard: check the latency measure on the web and on Android's native audio (where the core knows its own output latency, use it), so "Playhead trim" can stay at zero.

Nothing heard moves: the core baseline passes unchanged (node tools/baseline.mjs), the generation goldens hold, the render hashes are unchanged; this is what is drawn, not what plays. If a fix seems to need a sound change, stop and leave a note.

Yardsticks: the tool's after figures in the PR (drawn but not heard, and heard but not drawn, near zero on every case; the drawn loudness following the heard); the baseline unchanged; the audio thread's cost within 5% of the baseline's (tools/perf.mjs), nothing late; tools/rows.mjs gains a row (a long piece's quiet section drawn quiet) and passes ten times; tools/views.mjs on the Layers view: no long task over 100 ms from the drawing; the gate. In for-mikey.md: watch the Layers view on his phone and in the Android app with a long piece (a code and a time where a layer fades in), and say whether the dots now match.

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current, tick session 30b's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to check, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
