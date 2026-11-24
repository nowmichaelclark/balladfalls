# Session 30m: an album exported whole and tagged; a seed album saved (121)

**Left** (2026-11-24, stopped by brain B-parallel 4 at Mikey's word, his
usage low; the next session with this prompt starts here):

- #466 (the seed album saved, v206) is merged: its ten rows were run
  45307309847, 10 of 10.
- #467 (the album exported whole and tagged, v207), head 0fd6bc9, is all
  pushed. Its ten rows are done: run 45307313599 (jobs=all, repeat=10,
  album=4 long) succeeded on 7117922. Every commit after that is test-only
  (`android/background.mjs`, `tools/export.mjs`): read the long job's memory
  line in that run.
- On 0fd6bc9 three checks are still to be seen green:
  - `flac`: a fresh run. The album's Opus checks were fixed for CI's ffmpeg
    "EOI missing" cover warning, and they pass locally.
  - The `--app` rows: re-run 45322028243, for the known blocked-page flake.
  - `background`: the folder picker's driver, fixed in 2d10773.
- Then:
  - Merge main in. #467 keeps v207 if it is still next.
  - Fill in the PR body's RESULT lines as read back from GitHub.
  - Add the Done lines for #466 and #467.
  - Update the queue's status and tick 30m's row.
  - Write a plain summary for Mikey. Its for-mikey section is already in
    #467.

Written by brain B-parallel 4 (2026-11-23) from Mikey's list that day (his
items 7 and 11) and his answers: "let the user choose" (one zip or a file a
track), and "Add 'save'" to the seed album.

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 30g's #458 (in). It may run alongside 30h, 30i,
  30j, 30k and 30l; never beside 30g's Left list (both change the Android
  app's Kotlin), and 30n waits for it.
- **Queue item:** item 121. **Holds 1.0.**

Paste everything in the block as the session's first message.

````text
Hands session 30m on the road to Driftloom's 1.0 (Opus 5.5, high): an album exported whole, every file tagged, as one zip or a file a track; and a seed album saved to the Library (item 121).

Read first: AGENTS.md; core/AGENTS.md; android/README.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, items 104, 105 and 121); docs/PAINTER.md (section 3, exporting audio: safety first; what the final pass settled); docs/DECISIONS.md (2026-11-17 the export's ending and words; 2026-11-22 and 2026-11-23); js/export.js, js/export-render.js, js/export-worker.js, js/export-opus.js, js/ogg.js, js/midi.js; the core's FLAC writer (session 19) and what it writes beside the samples; js/library.js (albums), js/share.js (album codes), js/storage.js; js/main.js (Share, Export, the seed album's sheet); index.html (viewSave, viewExport, viewSeed); the Android app's save through its picker (session 28: AppBridge, MainActivity); tools/export.mjs, tools/rows.mjs, tools/export-long.mjs.

Check your place: in docs/sessions/README.md every row in session 30m's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-23): "On the share screen, there should be a way to export an album and that album and it's songs should be properly tagged with things like track number, etc." Asked whether the tracks arrive as one zip or a file a track: "let the user choose". And of the seed album, which can only be copied as a code or shared as a link: "Why is there no way for the user to say create a seed album and save it to their own library?"; asked, "Add 'save'".

The work, two PRs (the seed album's save first, it is small; then the album's export):

1. The seed album's sheet gets a save key beside copy code and share link: the album, its tracks drawn from the seed and the picks now set, lands in the Library as an album of its own (named as an album's name is made today), and plays as the code does.
2. Every exported file is tagged, a single loop's too: FLAC's Vorbis comments, Opus's OpusTags, MIDI's track name. TITLE (the loop's name), ALBUM (the album's, for an album), TRACKNUMBER and TRACKTOTAL (an album's), ARTIST and the like from the app's one name constant (never written into new text: the rename is 31a's), DATE, a COMMENT with the loop's code, and the loop's cover as the picture (FLAC's PICTURE block, Opus's METADATA_BLOCK_PICTURE), from the same cover the Library draws. Tags in plain UTF-8; the samples unchanged (the export's null against a straight render holds).
3. Share, when an album is playing or chosen: an export of the whole album, in the chosen format (flac, opus), as one zip (stored, not compressed: the audio is) or a file a track, the listener choosing on the Export view. Each track as long as its track length; a track that plays on (or Endless) opens the Track length view first, for the album's tracks at once, as a single export does. Files named "NN name.ext". Safety first, as item 104: the space checked for the whole album before anything starts, one calm progress for the album with Cancel, closing the app stops it, a failed track a kind line and the rest kept. The browser saves one zip as one download; a file a track saves each as it is made (say how the browser asks). On Android, one zip through its picker, or a file a track into a folder the listener picks (Android's own folder picker), each saved as it is made.

Yardsticks: tools/export.mjs extended: an album of 4 tracks exported both ways and in both formats, every file decoding (ffmpeg), its tags read back (ffprobe: title, album, track N/4, the code, the picture), the zip opened by a standard unzip, each track null against its straight render; a single loop's tags; the seed album saved and played from the Library (its tracks the code's); tools/rows.mjs rows for each (save, export the album each way, Cancel midway, a full disk), ten passes in a row in CI (the export workflow with repeat=10); memory flat on an album export (tools/export-long.mjs's watch); the Android build and its save rows in CI; the gate. In for-mikey.md: an album to export on the Moto both ways, and its tags to see in a music player.

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current, tick session 30m's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to check, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
