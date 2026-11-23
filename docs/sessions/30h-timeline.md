# Session 30h: the timeline moves the playhead, paused or playing; the album's way back goes (116)

Written by brain B-parallel 4 (2026-11-23) from Mikey's list that day
(his items 1, 3 and 4).

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 30g's #458 (in). It may run alongside 30i, 30j,
  30l and 30m; never beside 30k (it restyles the card and Now Playing) or
  30n (the keys come last), nor 30g's Left list (the Android bridge).
- **Queue item:** item 116. **Holds 1.0** (session 30 waits for it).

Paste everything in the block as the session's first message.

````text
Hands session 30h on the road to Driftloom's 1.0 (Opus 5.5, high): the timeline moves the playhead on any loop, paused or playing, and the album's way back goes once a new track is made (item 116).

Read first: AGENTS.md; core/AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, item 116); docs/PAINTER.md (the rules any design keeps, and section 2, long pieces); docs/DECISIONS.md (2026-11-03 the bars picker; 2026-11-22 and 2026-11-23); js/piece.js (the long piece's line and its jump); index.html's Now Playing view (nowRail, nowFill, nowPiece, nowAction); js/main.js (the rail's drawing, the jump's api, the album's way back on Now Playing, Play and Pause); js/player.js, js/worklet.js, js/native.js (the jump's command and what a paused engine does with it); core/src/player/ (the jump, Player::place; track.rs, the track's time and fades); tools/rows.mjs.

Check your place: in docs/sessions/README.md every row in session 30h's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-23): "I want to be able to click on the timeline where it shows the track playing and be able to skip around on the track. I can only skip around on long bar lengths like 256 for example." "On longer bar length songs, when the song is paused, I can't move the playhead, only when the song is playing can I move it." "If I leave an album it will show a button with an arrow that suggests returning to that album. That button never goes away. It should go away after generating a new track."

The work, one PR (and a core PR first if the core's part is cleaner alone):

1. Paused, a long piece's line moves the playhead: press or drag while paused, the head and "bar N/M" go there, and Play starts from it. Find why it is refused today (the page, the worklet or the core's jump) and fix it there; on Android's native core too, through the same commands.
2. A short loop's rail (nowRail, a loop of up to 32 bars) becomes a line you press or drag to move the playhead, playing or paused, as the long piece's is: a pointer, a finger and the keyboard (it is a slider to a screen reader, like pieceLine). What the rail spans is what it shows today: find it (the track's time where a Track length is set, the loop's round where it plays on) and say it in the PR; a move goes to that point of it, the track's clock and its fades moving with it, so a track set to 3:00 still ends at 3:00 on its own clock. Where the core can't yet start a short loop at a point (the jump is within a piece; a loop's pass is a piece's section, core/src/generator/piece.rs), make it able to, the same way, and test it in the core. A move lands on the step it asks, and what was sounding there is heard from that step on, as a long piece's jump is.
3. The album's way back (the arrow key on Now Playing after leaving an album) goes once a new track is made, by Next or by the core's own next loop, and doesn't come back until another album is left. Find every way a track is made and say them in the PR.

Yardsticks: a row in tools/rows.mjs for each (a long piece moved paused, then Play starts there; a short loop moved playing and paused, with and without a Track length; the way back gone after Next and after the core's next loop), ten passes in a row in CI (the export workflow with repeat=10); a test in the core where it changed, at full and lite; a move heard at the asked step within the jump's 0.06 s (test/jump.test.mjs's measure, on a short loop too); tools/views.mjs on Now Playing; screenshots at 360 px and a tablet's width, light and dark; the gate. In for-mikey.md: a short check on the Moto (paused and playing, a short loop and a long piece; the way back gone).

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current, tick session 30h's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to check, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
