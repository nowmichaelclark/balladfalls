# Session 30e: fewer words: keys, icons and switches, the share screen as keys (113)

Written 2026-11-18 at Mikey's request (his list of seven for 1.0, item 1:
"Go over Claude AI word salad in the app").

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** sessions 21, 24, 28, 30a, 30b, 30c and 30d: every screen
  and word it goes over is in. It may run alongside 29 only (F-Droid's
  listing, not the app's words).
- **Queue item:** item 113.

Paste everything in the block as the session's first message.

````text
Hands session 30e on the road to Driftloom's 1.0 (Opus 5.5, high): fewer words: keys, icons and switches, the share screen as keys (item 113).

Read first: AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt; mind "The app's name from one place"); docs/QUEUE.md (status, standing rules, merge policy, item 113); docs/PAINTER.md (the rules any design keeps: only three settings, scrolling in two places, plain characters); docs/DECISIONS.md (the wordings Mikey approved: 2026-11-17, the export sheet, "Closing the app stops it", the file's name; session 01's shorter plain lines; the codes' plain lines); index.html; every js/*.js that shows words (js/export.js's WORDS, js/main.js's toasts and Now Playing, js/picks.js, js/piece.js, js/library.js, js/share.js's lines, js/quality.js's line, js/ui.js); tools/rows.mjs and tools/views.mjs.

Check your place: in docs/sessions/README.md every row in session 30e's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-18): "Go over Claude AI word salad in the app: Too many cases of words explaining things when an icon or a switch would be good enough. Too many long sentences where a two or three word phrase would be good enough. For instance: The share screen could just be a few buttons with zero explainer: copy code, paste code, export audio (should open an export viewport for selecting buttons like 'export flac', 'export midi', etc)."

The rules for every visible word, in this order:

- An icon, a switch or a key where words explain what it does. A key whose name says what it does needs no line under it.
- Two or three words where there is a sentence. A line stays only where something can go wrong or can't be undone (an export that stops if the app closes; a restore that replaces the Library; a code that can't be opened), and then as short as it can be.
- Mikey's approved wordings keep their meaning, made shorter where they can be; the file names and the app's name from one place stay as they are.
- What a screen reader hears stays complete: aria labels and descriptions name every control fully. Fewer words on screen is never fewer for a listener who can't see it.
- No new settings, nothing new to scroll, plain characters only.

The work, one PR (or two: the share screen and the export view first, then every other word), app only (BUILD and CACHE):

1. The share screen: just keys, no explainer: copy code, paste code, export audio. Export audio opens an export view: a key a format ("export flac", "export midi", and the small format from session 21 named by its format the same way, "for Mikey's ears"), then the export's progress, cancel and done as today, in fewer words. MIDI export moves from the share screen into it. The track length is session 30c's view, not this one's.
2. Every other screen, line by line: Now Playing, the Vibe panel and its pickers, Bars, Track length, the Library and its albums, Save, Advanced (Mono, Lighter on processor, Files, Diagnostics, Keyboard), the plain lines (a slow browser, a code from a newer or older version), the toasts, the Android app's own screens and notification.
3. A table in the PR and in for-mikey.md: every line changed or removed, before and after, so Mikey approves the words in one look.

Yardsticks: the before and after table; screenshots of every screen at 360 px and a tablet's width, light and dark; tools/rows.mjs updated for the moved keys and passing ten times in a row; every control still named for a screen reader (a check in tools/ that every button, switch, slider and tab has an accessible name); tools/views.mjs on every view; the gate. In for-mikey.md: the table, and the screens to look at on his phone.

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current, tick session 30e's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to check, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
