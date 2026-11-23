# Session 30n: the keyboard, as music players have it (122)

Written by brain B-parallel 4 (2026-11-23) from Mikey's list that day (his
item 15) and his answer: letter keys, with a switch to turn them off.

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** sessions 30h, 30j, 30k and 30m (every view and key it
  maps is in). It may run alongside 30i, 30l and 30g's Left list.
- **Queue item:** item 122. **Holds 1.0.**

Paste everything in the block as the session's first message.

````text
Hands session 30n on the road to Driftloom's 1.0 (Opus 5.5, high): the keyboard redone, as music players have it, with letter keys and a switch to turn them off (item 122).

Read first: AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, item 122); docs/PAINTER.md (the rules, what the final pass settled: its "Keys" line is superseded by this item, and the three settings, which this makes four); docs/DECISIONS.md (2026-11-22 the keyboard, superseded; 2026-11-23 the letter keys); js/shortcuts.js and its test; js/main.js (Space and the media keys, every view's open and close, the focus rules); js/viewport.js; index.html (every view and key; Advanced's switches); js/storage.js (where a setting is kept); tools/a11y.mjs, tools/names.mjs, tools/rows.mjs.

Check your place: in docs/sessions/README.md every row in session 30n's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-23): "The keyboard controls only half work, so those need a second look or need to be redone. I should be able to press the right arrow key for instance and it goes to the next track. Just do industry standards for this. Is that not how it normally works for most music player style sites? Anyways, look across all of the menus and all of the buttons. Take a better approach to doing the keyboard keys. I don't know what the solution is (e.g. pressing 'l' shows the layers viewport would make sense to me. But I don't know how to bring up the layers viewport with a keyboard, so doing a redesign that is more intuitive would make sense). When needing to choose accessibility or what is more design intuitive, go with intuitive, but of course, make things accessible when possible." Asked about single letters and WCAG 2.1.4: letter keys, with a switch in Advanced that turns them off (a fourth setting, his exception to the Painter's three).

The work, one PR (BUILD and CACHE):

1. Find first what "only half work" is: try every shortcut #457 made, and every key and view by Tab, Enter, Space and Esc, and list in the PR what fails today and why.
2. A map, written at js/shortcuts.js's top, from what music players and the web's players do (YouTube, Spotify, SoundCloud, Apple Music: say which each key follows): Space (and K) play and pause; Right and Left the next and previous track (Shift with them, or J and L if L isn't taken, to move the playhead by a step of the line 30h made); Up and Down the volume if the app has one, or nothing; M mute or Mono's own key if one fits; a letter for each view that a listener opens (L Layers, S Sound, V Vibe, B Bars, T Track length, the new pickers', Share, Library, Advanced: yours to choose, each the view's first letter where it can be); R roll (the dice), 1 to 5 a layer's roll or mute; Esc back or close; ? the list of keys, on screen, in a popup that says them whole. Keep Ctrl+S save. Where a key's place and its character differ (Dvorak, Thai, a Mac's Option), match as js/shortcuts.js does today and say how.
3. Never while typing: no key acts while a text field, a picker's typed number, or a slider has the focus where the key is the control's own (the arrows on a slider move the slider; Space on a key presses it). Say the rule in the file.
4. Advanced gets a "letter keys" switch (on by default), plain like Lite's and Mono's: off, no letter or number does anything alone (WCAG 2.1.4); the arrows, Space and Esc work either way. Kept like the other settings, in the backup too.
5. Every view's keys reached by Tab in its reading order, the focus rules of the final pass kept.

Yardsticks: the map in the PR; a test of shortcutOf over every key, with and without the switch, on QWERTY, Dvorak and a non-Latin layout, and on a Mac; tools/rows.mjs rows driving the app by the keyboard alone (play, next, previous, each view opened and closed by its letter, the list of keys, the switch off and a letter then doing nothing, typing in the Bars view's number doing nothing else), ten passes in a row in CI (the export workflow with repeat=10); tools/a11y.mjs and tools/names.mjs green; the gate. In for-mikey.md: the keys to try on a computer, and the list to approve.

When you finish: add the merged PR's line to docs/DONE.md, keep the queue's status line current, tick session 30n's row in docs/sessions/README.md, record in docs/PAINTER.md the settings now four and the keys' new line, and end with a plain summary for Mikey: what merged (PR numbers), what to try, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
