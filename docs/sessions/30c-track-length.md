# Session 30c: track length, its own view, to the second (111)

Written 2026-11-18 at Mikey's request (his list of seven for 1.0, item 6).

**Mikey's answers (2026-11-18), folded in below:** a fade in and fade out option in the view; with no length set, export opens this view first (confirmed).

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** sessions 21 and 28 (the export sheet and saving an export
  on Android, which this changes) and 24 (the codes' chain done). It may run
  alongside 29, 30a and 30d; never beside 30b (both change the core's player
  and `js/worklet.js`).
- **Queue item:** item 111.

Paste everything in the block as the session's first message.

````text
Hands session 30c on the road to Driftloom's 1.0 (Opus 5.5, high): track length, its own view, to the second (item 111).

Read first: AGENTS.md; core/AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, items 104 and 111); docs/PAINTER.md (the rules any design keeps); design/next-picks.md (how the pickers look and behave); docs/DECISIONS.md (2026-11-17: the export's ending kept; the export sheet's words); core/src/player/track.rs and what reads it (Heard::stop_at for a long piece's close), core/src/code.rs (what a code carries); index.html (the Sound view's Length slider, the Bars view as the model for the new one, the export sheet), js/main.js (TRACK_TIMES, trackLength, describeLength, syncToneInputs, the slider's handler), js/picks.js (the pace line: "any tempo · any bars"), js/export.js and js/export-render.js, js/storage.js, js/piece.js, js/native.js; tools/rows.mjs.

Check your place: in docs/sessions/README.md every row in session 30c's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-18): "Track length should get it's own viewport. The button for track length can live alongside where we have the buttons 'any tempo' and 'any bars'. This way, track length slider can be taken away from the sliders viewport and also it can be taken away from the options for exporting. Should be able to set track length to an exact second." Then: "we could include a fade in/fade out option for the track length viewport actually," and "Yes, exporting with no length set opens the track length viewport first."

The work, one PR (core and app; BUILD and CACHE; js/dlplayer.wasm rebuilt), or two if the core's part is cleaner alone:

1. The core: a track can be a time, to the second, beside today's whole passes and bars on a phrase line (track.rs's Track): counted in the output's samples from when it is set, so a tempo change doesn't move it. The music is done at the asked second. How it gets there is the view's fade out (step 2): with it on, the notes fade to land on that second, as the slider's close fades them today but aimed at the time (a long piece's close through Heard::stop_at); with it off, the track stops on the second with nothing faded, what is sounding left to ring as an export's ending does (kept on 2026-11-17). The fade in, with it on, brings the track up from silence at its start; off, it starts as today. The fades' lengths are yours to choose, conservative and measured (one each, not a setting of their own), written in the PR and marked "for Mikey's ears". The Android app's native core does the same, through the same commands.
2. A Track length view, built like the Bars view: the time typed to the second (h:mm:ss, or m:ss under an hour), keys a second and a minute either way, a coarse slider for the big moves (to a whole day, as today's stops reach), an "on and on" key (no end: today's slider at its start), a fade in key and a fade out key (each on or off, pressed like the Bars view's keys: Mikey's option, not a setting; the conservative defaults are fade out on, as today's close, and fade in off, as today's start), cancel and done. Plain, in the app's style; a Painter session restyles it later.
3. Its key on the Vibe panel's pace line, beside "any tempo" and "any bars", showing the length set (or that it plays on). Find what the Length slider does today for the loop playing and for loops after it (an album's tracks, Next, the core's own next loop) and keep that behavior; say in the PR what it is.
4. The Sound view's Length slider goes, and its code (TRACK_TIMES and the rest) with it.
5. The export sheet's "How much" goes: an export is as long as the track length; with none set, a finite piece exports whole, and for a loop that plays on and on or Endless the export key opens the Track length view first (Mikey confirmed, 2026-11-18); the export keeps the track's fades. Session 28's Android save still works.
6. A loop's saved length becomes the time, with its two fades: saved loops and backups convert on load (playFor and playBars to seconds, at the loop's tempo), with no shims kept after (Mikey, 2026-10-29). A version 2 code carries no track length today (core/src/code.rs's tags); if session 23 or 24 added one, it carries seconds instead, before the codes freeze at 1.0, and the golden codes move with it.

Yardsticks: a track set to 1:23:45 ends at 1:23:45 to the second, at full and lite, on a loop, a long piece and Endless, after a tempo change midway, with each fade on and off (a test in the core, and a row in tools/rows.mjs); a fade in rises from silence and a fade out reaches it on the second, measured on the render; an export of a track set to 2:00:07 is that long plus the kept ring-out; the core baseline unchanged where no track length is set; tools/rows.mjs's rows for the new view (open, type, the keys, the slider, on and on, the fades, cancel, done) and the export's lengths, ten passes in a row; tools/views.mjs on the new view; screenshots at 360 px and a tablet's width, light and dark; the gate. In for-mikey.md: the view to look at, how the fades sound (their lengths) and how a track without a fade out ends on its second.

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current, tick session 30c's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to listen for or check, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
