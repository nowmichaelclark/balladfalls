# 105e: what the freeze still needs from the page (session 24c, 2026-11-22)

Found while making the core ready; not done there (24c changes the core and
`data/`). Neither changes anything heard today: there is one version, and
the one removal is handled.

1. **The page drops a code's version.** The core reads it and draws at it,
   but `js/share.js`'s `split` drops `version=`, a loop's record has no
   field for it, and the player's commands (`dl_play_*`, `js/worklet.js`,
   Android's bridge) have none. So from the first addition (version 3) the
   app would play a version 2 code at version 3, and share it again as one:
   additions would move old codes in the app, against Mikey's line of
   2026-11-10. It needs a `dl_play_version` in the core's hosts (wasm, the C
   header, Android), the version kept in the record and in the Library, and
   sent with every load, export and re-share. **When (Mikey, 2026-11-22):
   "Before first new sound".** It doesn't hold 1.0, and it lands before any
   member joins `data/codes.txt`. While version 2 is the only one, every
   code, and every loop saved without a version, is a version 2 one, so the
   fix can label them all as it lands, as long as that is before the first
   addition.
2. **The page's saved records know removed members by a hand copy.** A
   record keeps names, not ids. 24c gave `twang.kind` its stand-ins in
   `js/pins.js` (`gone`), held to the code's by `test/library.test.mjs`. A
   removed vibe is already left out of a record; a removed style, mode,
   voice, journey, choice or setting would be refused ("no such style"), as
   would a number past a narrowed range. The general answer is the page
   reading records through `data/codes.txt`'s rows, as the core reads codes.
