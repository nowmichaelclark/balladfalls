# 113, fewer words: what Mikey decided while it was built

Session 30e, PR #449. For the brain (these are for `docs/DECISIONS.md`,
which is at its size limit) and for any session that quotes the app's
words: 30f, 30, B5. The before and after of every line is in
`docs/notes/for-mikey.md`, under Decisions.

## Mikey, 2026-11-22, to session 30e directly

- "Usually I'm going to lean towards removing words and explainer text when
  just one word or a symbol will do. Even some cases where there is an
  unnecessary "the" can be removed. But please ask if you're not sure or
  want to push back"
- "any and all popup text that may come up in the app is worth your review
  as well"
- His answers to four questions the session put to him:
  - symbols: a die for "roll", the infinity sign for "on and on", + for new
    album and add loops, arrows for Next and back to;
  - a long piece on Now Playing: "bar 812/3,072 · peak", and the time left
    with a minus for "left" (replaces the words approved 2026-11-18);
  - "Lighter on processor" is named "Lite";
  - the export keys are flac, opus and midi (replaces "export flac" and
    "export midi", his names of 2026-11-18).

## The session's own calls, his to undo

- Share link and seed album stay on Share, after his three keys: otherwise
  both would be lost.
- The export's sizes stay under its keys, as numbers.
- A line for something going wrong keeps its reason; deleting an album
  keeps its count.
- "plays on" in the Vibe panel is the infinity sign too; "Turned on by
  itself" is "auto".
- No popup for what the screen already shows (a loop's name, left album, a
  roll in Layers).
- Not changed, his own sentences, and both open questions to him in
  `for-mikey.md`: "Please refresh." and the app's description (the install
  box, a link's preview).

## How it holds together, for the next session

- What left the screen and explained a control is that control's
  description (`aria-describedby`); `tools/names.mjs` fails without it.
- `#toast` is only seen. `#announce` is the status, and says the whole
  sentence. A new popup passes both: `ui.toast(shown, said)`; one that the
  screen makes needless is `ui.announce(said)`.
- The page compares the core's refusal 'needs a newer version' exactly;
  that comparison is untouched.
- Android: `MainActivity`'s `onJsPrompt` draws the boxes to type in. It was
  built in CI only; it needs one look on a device.

## Left to others

- Bars on short phones (at 360 x 640: endless, arc, wander and any can't be
  reached), and a phone on its side (about 60 px of panel at 844 x 390: too
  little for Bars, Track length, Export and Seed album): older than 113,
  session 30f's. Track length's short phones are 30c's fix in #448.
