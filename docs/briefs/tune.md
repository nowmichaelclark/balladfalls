# Tune-by-ear session: Mikey's notes into changes

Mikey does not tune numbers himself. He listens to an album and says what
he hears. This session turns his words into data and defaults.

## Read first

Read `AGENTS.md`, the queue's status, and Mikey's notes (the brain names
them, or `docs/notes/for-mikey.md` holds his answers). Read
`docs/VIBES.md` and `docs/MOODS.md` if a note is about a vibe or a mood.

## Steps

1. Write each note as one change: which loop (its code and time), what
   Mikey heard, and which value or data line causes it.
2. Measure before you change: `tools/measure.mjs`, `tools/stats.mjs` or
   the tool that fits (`tools/README.md`).
3. Change the data or the default in the smallest step. Measure again.
4. Say in the PR what moved, by how much, and which loops to hear again.
5. If a note is a bug, add it to "Known issues" for a Fix session.
6. If a note asks for a new thing, write it in `docs/inbox.md`.

## Do not

- Do not change what Mikey did not name. Ask him a taste question if a
  note can be read two ways.
