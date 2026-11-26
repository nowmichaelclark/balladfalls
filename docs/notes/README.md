# Notes from Claude Code

A note is what the hands leave when an item stops at a yardstick, needs a
decision, or finishes with something the brain must read. It says what was
built and where it differs from the brief, what was measured, what is left,
and what needs a decision. Say in the PR that there is a note.

- **Name** a note `<item>-<short-name>.md` (for example `76-cold-start.md`),
  so that notes sort with their items.
- **When the note is answered,** the brain writes the answer in the queue
  or in `docs/DECISIONS.md`, and deletes the note. Git keeps its text. If a
  doc or a comment still points to it, add its path to `docs/archived.txt`.
- **`for-mikey.md`** is the one live list of what needs Mikey's phone, ears
  or accounts.

The notes here now:

- `105e-page.md`: what the code freeze still needs from the page (open).
- `107-reproducible.md`: how the Android build is made reproducible (the
  record that the `fdroid` workflow and `android/native/build.sh` point to).
- `113-fewer-words.md`: Mikey's choices for the app's words, and how the
  toasts and the screen-reader lines fit together.
- `115-crackles.md`: the Android crackles with the screen off, and the
  measurements behind the native engine's fix.
