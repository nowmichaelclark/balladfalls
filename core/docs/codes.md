# Share codes: the format

A share code is a loop or an album as a short run of the 64 characters that
are safe in a link. `src/code.rs` writes and reads it. Read `core/README.md`,
"Share codes", first.

- Natively: `src/code.rs`, and `dl_code_*` and `dl_album_*` in the C header.
- On the web: `dl_code_*` in `js/dlplayer.wasm`, which the app uses through
  `js/gen.js` and `js/share.js`. The tools' wasm has them too.
- From the command line: `node tools/codes.mjs`.

**The format is frozen from 1.0.** `golden/share-codes.txt` holds it to its
bytes, natively and on the web. `golden/frozen-codes.txt` holds what 1.0's
codes play: 561 loops and 11 albums made on 1.0's build. Each has what it
decodes to: its seed, mutes, salt, name and request, and a hash of
everything that the generator draws from it. `test/frozen-codes.test.mjs`
reads them back in the gate. Nobody writes that file again.

## The parts of a code

- **Characters.** `A`-`Z`, `a`-`z`, `0`-`9`, `-` and `_` are the values 0
  to 63. Each character is a *sextet* (six bits). Spaces around a code are
  ignored. Any other character outside the alphabet means that it is not a
  code. A code has at least 9 characters.
- **A number** is five bits in each character, the lowest bits first. Every
  character except the last has 32 added. A number uses as few characters as
  it needs, and a last character of 0 after another is refused. So 0 to 31
  takes one character, up to 1,023 two, and up to 32,767 three.
- **A seed** is a 32-bit number in exactly six characters, the lowest six
  bits first.
- **A decimal** is the shortest decimal that reads back to the same double
  exactly (Rust's `{:e}`). It is written as its digits, as a whole number
  with no trailing zero, zigzagged (`2m` for `m >= 0`, `-2m - 1` below), then
  its power of ten, zigzagged. Zero is `0 0`, and minus zero is `0 1`.
- **A set** of ids is how many (at least one), the first id, then each gap
  less one, in ascending order.

**A loop** is a *head* (a number, `2 * version`), a *seed*, its *fields*,
and a *check*.

**The check** is two characters: `h & 63`, then `h >> 6`. `h` starts at 0,
and for each character before the check it becomes
`(h * 64 + value + 1) mod 4093`. It catches any one changed character, and
any two characters next to each other that are swapped.

## Versions

Codes start at version 2, and **version 2 is 1.0's** (`released = newest = 2`
in `data/codes.txt`). There is one version for each release. What joins after
a release shares `released + 1`, so the head stays one character up to
version 15. A code made between two releases can change when another
addition joins.

A code at a version past the build's is refused with "needs a newer
version" (the host adds its app's name). A code's loop is drawn at its
version. Every pool, every word of a setting drawn for each loop, and every
such setting is first filtered to what had joined by then (`data::there`,
`data::joined_of`, `data::drawn_at`). So a member added later never moves
the picks of an older code. A deliberate change to a sound that exists still
moves them, and the release notes say so.

## What was taken out

Mikey decided that codes must not rot (2026-11-17). So when a member goes,
its row stays, marked `gone`, with a stand-in where one fits.

- An id with a row belongs to this build, gone or not. A gone id plays its
  stand-in, but never over what the code itself asks. A gone option with no
  stand-in plays its choice's default. Any other gone id with no stand-in is
  left out of the request.
- An id with no row means "needs a newer version" in a code of the version
  that is still open (past `released`). At a released version, it means
  "not a code", because all of that version's ids are here.
- A number that a field ever took (`[code numbers]`) plays the nearest value
  that it takes now. A number that no build wrote means "not a code".
- A code that is read in this way is written again with what is here now.

## The fields

Each field is a *tag* (a number) and what follows it, with the tags in
ascending order. A tag marked *keyed* can repeat, with its key (the number
after it) in ascending order. Every name is its *id* in `data/codes.txt`,
never its place in a list.

- A tag that this build never had means "needs a newer version".
- A tag that the build stopped writing is read and set aside.
- An id is read as "What was taken out" says.
- Anything else out of place means "not a code".

| Tag | Field | What follows |
|---|---|---|
| 0 | the track's own version (album tracks only, first) | number |
| 1 | a vibe, keyed | its id |
| 2 | a vibe with a weight, keyed | its id, decimal |
| 3 | the tempo pinned | bpm - 32 |
| 4 | a tempo range | low - 32, high - low - 1 |
| 5 | the length | bars - 1 (to 2^53 - 2) |
| 6 | Endless | nothing |
| 7 | the journey | its id |
| 8 | the keys | a set of notes, C 0 to B 11 |
| 9 | the modes | a set of ids |
| 10 | the styles | a set of profile ids |
| 11 | a layer's voices, keyed | layer id, a set of voice ids |
| 12, 13 | the layers asked on, off | a set of layer ids |
| 14 | the theme | seed |
| 15 | a choice pinned, keyed | choice id, option id |
| 16 | a setting pinned, keyed | setting id, word id or decimal |
| 17 | a layer's seed (an edit), keyed | `2 * layer id + re-rolled`, seed |
| 18 | a part of the tone (an edit), keyed | part id, decimal |
| 19 | the tempo the slider set (an edit) | decimal |
| 20 | the layers muted | a set of layer ids |
| 21 | the wander's salt | seed, not 0 |
| 22 | a track's pace (album tracks, and an album's own, only) | a number: 0 on and on, 1 on and on fading in, `2 + 4 (s - 1) + f` for a time of `s` seconds (1 to 86,400) with fades `f` (1 a fade in, 2 a fade out, 3 both) |
| 30 | a name of its own (a loop's, a track's, an album's) | how many bytes of UTF-8 (1 to 60), then the bytes, eight bits each packed six to a sextet, highest first, the last sextet's spare bits 0 (base64url, no padding) |

## Names

A renamed loop's name travels with its code (Mikey, 2026-11-17: "all
characters and emojis"). A loop's name is written only when the loop was
renamed, so a loop with no name costs nothing. An album track's name goes in
its body, and an album's name goes after its tracks or in its picks.

The core carries the name as the host gave it: UTF-8 in, UTF-8 out. This is
the listener's text, so it is not limited to ASCII, but the code itself stays
in the 64 characters. A name has at most **60 bytes** (`code::NAME_MOST`):
sixty English letters, twenty Thai letters, or fifteen emoji. In a code, an
English letter takes about 1.3 characters, and a Thai letter about 4.

`code::Name::new` refuses a name ("a name a code can't carry"), and a code
that holds such a name is not a code, if it has:

- bytes that are not UTF-8;
- a space at either end, or two spaces in a row;
- a control character, a format character (the direction overrides and
  isolates, and the zero-width and invisible characters), a separator other
  than the plain space, a private-use character, a noncharacter, or a
  default-ignorable character;
- a combining mark or variation selector that does not follow a visible
  character, or more than four in a row (Thai vowels and tone marks pass;
  piled-up marks do not);
- a ZWNJ or ZWJ that is not between two visible characters (emoji sequences
  and Persian words pass);
- tag letters outside a black flag's run that ends with its cancel tag (the
  flags of England and Scotland pass).

The character classes are in `src/code/classes.rs` (Unicode 17.0), written by
`node tools/name-table.mjs` and frozen with the format. A host's rename box
asks the same rule (`dl_code_name_ok`), so any name that a listener can type
is a name that a code can carry.

## A code's request as text

`code::request_text` (`dl_code_request` after `dl_code_read`) writes what a
loop's code asks for as the text that `Request::parse` reads: its asks, its
edits (`edit.seed.drums=…`, `edit.warmth=…`) and its version. The app's
Library keeps a loop as a record of its request, and reads a code back into
that record in this way.

## Albums

**An album** is a *head* (`2 * version + 1`), a number for its kind, and then
one of these:

- **Kind 0, a list of loops:** how many (1 to 1,024); then each track as the
  number of characters that it takes, followed by its *seed* and *fields* (a
  loop's code without head and check). Tag 0 comes first where the track's
  version is older than the album's (the album's version is that of its
  newest track). A track's own pace comes where it is not the album's, and
  its name comes last, if it has one. Then the album's pace field or nothing,
  its name field or nothing, and the *check*.
- **Kind 1, drawn from one seed:** the album's *seed*, how many tracks, the
  picks that they share (fields 1 to 16), the album's name field or nothing,
  and the *check*. Track `i` (from 0) is the loop of the `i + 1`th `seed32`
  of the generator's stream of the album's seed (`code::track_seed`), with
  the picks, at the album's version.

### A track's pace

An album's code carries how long each track plays before the next (Mikey,
2026-11-18: "an album's code should carry track lengths and all necessary
info"). The pace is what the album's maker set on the track length, which is
how the player takes it (`code::Pace`, `player::Track`): on and on (until the
listener moves on), or a time to the second, each with its fades.

- The pace that most tracks share (the smaller number on a tie) is written
  once, after the tracks. Each track with another pace writes its own (0 for
  a track that plays on next to paced ones).
- An album whose tracks all play on writes no pace. Twelve tracks of two
  minutes each, with a fade out, cost three characters.
- Anything else that says the same thing (an album's pace of 0, a track's
  own pace equal to the album's, an album pace that most tracks do not share)
  is not a code. So each album has exactly one code.
- A loop's own code carries no pace, because one loop sounds the same
  however long it plays. An album from one seed carries none either.

A host writes a track and its pace as text: `ENBAAAAEmBO_7:t5025` (1:23:45),
with `i` and `o` after the seconds for its fades (`:t120o`), `:i` for on and
on with a fade in, and the code alone for on and on (`code::paced`:
`dl_album_write`, `dl_code_album_write`, `node tools/codes.mjs album`). It
reads the pace back with `code::album_pace` (`dl_album_pace`,
`dl_code_pace`).

### Sizes

- A plain loop: 9 characters.
- With a few picks (two vibes, 64 bars, a tempo): 19.
- Eight plain loops as an album: 61.
- Twelve tracks of 3,072 bars drawn from one seed with two vibes: 19.
- A plain loop renamed "Rainy Sunday": 27; renamed "ฝนตกที่กรุงเทพ": 68.

## Add to the format

1. Give a new vibe, profile, voice, choice, option, setting or word the next
   free id of its list in `data/codes.txt`.
2. Set its `since` to the last release's version plus one, and set `newest`
   to that. A release sets `released = newest`.
3. If a pool is written in Rust (a fallback kit, a setting's kinds), filter
   it with `data::there` or `data::joined_of` where it draws.
4. If a new setting is drawn for each loop outside the list of choices, ask
   `data::drawn_at` first. Draw nothing below its version, and count it in
   `Render::settings_changes` only where it plays.
5. If you widen a number's range, widen its `[code numbers]` row.
6. Give a new field a new tag, and raise the version.

## Take from the format

1. Take the member out of the core and the data.
2. Keep its row. Write `gone` after it, then a stand-in that had joined by
   then, if one fits.
3. If you narrow a range, keep its row.
4. If a field is no longer written, keep its tag and its reading.

`data/codes.txt`'s header has the full rule. `tests/dummy.rs` (the `dummy`
feature, in the gate) adds a member of each kind at version 3 and takes one
of each out. It shows that every generation golden drawn at version 2 is bit
for bit as it was, and that every removed member still reads.
