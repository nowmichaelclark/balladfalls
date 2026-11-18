# Session 30a: Previous works in an album (109)

Written 2026-11-18 at Mikey's request (his list of seven for 1.0, item 2:
"Previous Button doesn't work when playing an album").

- **Model:** Sonnet 5.5. **Effort:** high.
- **Start after:** session 24 (23 and 24 both change the albums in
  `js/main.js`). It may run alongside 21, 28, 29, 30b, 30c and 30d.
- **Queue item:** item 109.

Paste everything in the block as the session's first message.

````text
Hands session 30a on the road to Driftloom's 1.0 (Sonnet 5.5, high): Previous works in an album (item 109).

Read first: AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, item 109); js/main.js (the skip buttons: goBack, goForward, updateHistoryButtons, advancePlaylist, playAlbum, leaveAlbum, onTrackEnd), js/media.js (the headset and lock-screen buttons), js/native.js and android/ (the Android app's notification buttons, session 28); tools/rows.mjs.

Check your place: in docs/sessions/README.md every row in session 30a's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-18): "Previous Button doesn't work when playing an album." Find the cause first, by reproducing it, before changing anything. A likely cause, not checked: updateHistoryButtons disables Previous whenever the history is at its start (state.historyIndex <= 0), and an album's tracks load without adding to the history, so in an album Previous can stay disabled though goBack would go to the track before. There may be more (a deleted track, an album opened from a code, an album started from the Library's second track, the track's end handing over).

The work, one PR, app only (BUILD and CACHE): in an album, Previous goes to the track before, from the first track to the last (as Next wraps from the last to the first), from the on-screen key, the keyboard, a headset, the lock screen and Android's notification alike. Outside an album it stays as it is. Leaving an album leaves Previous as the history says. The conservative choice where one is open (for example, whether Previous a few seconds into a track starts it again): keep today's plain behavior, write it in the PR and mark it "for Mikey's ears".

Yardsticks: tools/rows.mjs gains rows for Previous in an album (from the first track, a middle track, after the track's end handed over, an album of one, after a track was deleted, after leaving the album), and passes ten times in a row; the gate. In for-mikey.md: one line, Previous in an album on his phone and in the Android app.

When you finish: add the merged PR's line to docs/DONE.md, keep the queue's status line current, tick session 30a's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR number), what to check, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
