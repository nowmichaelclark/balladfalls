# Roadmap

This page lists the open work, in order. Each item has a size, and a test
that proves it is done. At the bottom are the ideas that were decided
against, so that nobody opens them again, and the rules for contributions.

The items keep their old numbers, so "roadmap 17" still means item 17. The
items that shipped before 1.0 are in `docs/archive/roadmap-shipped.md` (read
it at the commit that `docs/archived.txt` names).

Sizes: **S** is under an hour, **M** is a session, and **L** is more than a
session.

---

## 5. Calibrate the voice budget on real hardware — **S**

The voice budget limits how many voices sound at once. Its totals (260 at
full, 170 for the accompaniment, 140 on Lite; `core/src/player/budget.rs`)
are reasoned, not measured. Diagnostics reports the late notes.

**Check the weights first, then the totals.** A bug once refused the melody
in 28.6% of loops, partly because one weight was wrong: `keys` was priced at
25, the same as a piano, but it is half of a piano (one FM voice against
two). If one weight was that far out, others may be too. Measure tone with
`node tools/measure.mjs --voice`, and cost with the marginal render time.

**Done when** a twenty-minute run on the target phone, on the densest profile
mix, reports zero late notes. If it does not, lower the totals until it does,
and write the number that worked here.

## 6. A floor for the cover art — **M**

The covers are "occasionally amateurish", which is not testable. The real
fault is in the sparse compositions (`drift`, `orb`, `aperture`): the
gradient ground fills most of the frame, so the cover looks like a
background, not a picture.

**Done when** no cover in a contact sheet of 100 covers has more than 70% of
its pixels within one palette stop of the ground color.

## 7. Three small interface tickets — **S each**

- **7a.** Reorder the tracks in an album.
- **7b.** Duplicate a loop before you edit it, so that a saved version stays.
- **7c.** Search or filter the saved list when it has more than about 30
  entries.

**Done when** each one works from the album or the saved list without a page
reload.

## 9. Articulation v3: a breath before a phrase — **M** — *not started*

A wind player breathes in before a phrase. The sound of that breath, before
the first note, is a large part of why a recording sounds like a person in a
room. The voices already have breath noise *under* the note. This item adds
a separate, louder, unpitched event *before* an entry.

The generator already finds the entries: a phrase entry is a melody note
with no note before it (`annotate_prev` in `core/src/generator/render.rs`,
the same test that the slide uses). The hard part is where to put the
breath. It must sound *before* the note, so either the player starts it
early (the note's start minus the breath's length, which can fall before the
loop's start), or the generator leaves room for it.

**Done when** an audible breath comes before 40-70% of the phrase entries of
wind notes, the breath never delays or clips its note, and no breath starts
at a negative time. The last check is the one that will be hard.

## 15. Ringing bells in fast blends take the melody's room — **S** — *low priority*

A fast loop (about 136-146 bpm) that blends in enough `shrine` to draw its
temple bell rings bells for about 1.4 s, at a cost of 12 each. A dense line of
them fills the voice budget. One `cinder` loop in 183 lost 48.7% of its
melody at full quality. `shatter` and `undertow` blends have the same case,
so it is rare.

Mikey: worth a fix, but not soon. Options: shorten the bell's ring (and so
its reservation) at fast tempos, keep room in the budget for the melody (as
the soft cap does for the accompaniment), or keep the long bells out of fast
blends.

**A related fix, at the same priority.** Every bass voice except `fifths`
reserves budget for 0.8 s after its note, but stops sounding at 0.4 s. So the
bass holds room that it does not use, in every loop. `wayfare`'s chug already
reserves only while it sounds. The same for all bass notes would free room
for the melody everywhere, on Lite most of all. It changes how loops sound
(fewer refusals), so measure refusals on full and Lite before and after.

Also measured: on Lite, `tide` and `cinder` loops lose more melody notes than
the average (2.9% and 3.5%, against 1.5%). The fixes above are the likely
cure. Measure both profiles again when this item is done.

**Done when** no loop in a corpus of 200 loses more than 5% of its melody at
full quality to this case, with refusals measured again on full and Lite.

## 18. Music that follows a game — **vision**

Mikey asked if the engine could go into a game, where "the player's stats and
which room they're in and what is going on or significant events could change
what kind of music is generated". He means calm games (a life sim, a
point-and-click adventure, something turn-based), not action games. The music
follows the time of day, the weather, the place, the season or the turn.

The core is ready for most of it: the request (pins, ranges, vibes, layers),
changes at a musical moment, events, and the C header (`core/docs/player.md`).
The game that will prove it is Broken Friends (`docs/CORE.md`, promise 10).

## 19. Words that steer the music — **L** — *the vibes shipped; tuning by ear*

From Mikey's mood vocabulary (`docs/MOODS.md`, 178 words). Agreed on
2026-09-27:

- **A label has one to five words,** usually two or three of different kinds
  (heart, light, texture and taste, motion, sound, strangeness). Each word is
  true of what the loop does. Some loops have **one word, fully embraced**:
  everything about the loop leans into that word.
- **Words steer, not only describe.** Each word has a recipe in musical terms:
  which dials it moves (lift, energy, warmth, tempo, swing, density, register,
  brightness, space, harmony color, instrument families, rhythm feel), and by
  how much.
- **Words bend a profile, but do not replace it.** The profile is the base,
  and a word pushes it within its character. Mikey and the sessions define
  how each word meets each profile, by ear.

The vibes are these recipes, as data (`data/vibes.txt`, `docs/VIBES.md`).
What is still open is the listening: albums for each word across profiles,
"does this track fit the word?" and, blind, "which word fits this track?",
then tuning and more words.

## 20. `tools/listen.mjs`: an album in one command — **S**

The brain makes each listening album by hand: it filters a corpus, shuffles,
encodes, round-trips and works out the key. A tool could do it, by voice,
profile, kit, meter, length, development or mood, blind or labeled, with the
key made for it. It would make albums quick for any brain session and stop
mistyped codes.

## 21. Composition depth — **M** — *two passes shipped; tuning by ear*

Two passes of development shipped before 1.0. Still open:

- Three in four 32-bar loops are micro-loops that never develop. Making them
  develop would be a new kind of form. Mikey decides.
- Mikey tunes how often loops develop, as he listens.

---

## Closed since 1.0

- **8. Album code length.** Codes version 2 answered it: eight plain loops as
  an album take 61 characters, not about 1,300 (`core/docs/codes.md`).
- **16. A compiled audio engine.** The core is the only engine. What is ahead
  is the charter's phases (`docs/CORE.md`).
- **17. Export a loop as audio.** The app exports FLAC, Opus and MIDI, for a
  loop, a track or an album.

## Decided against

**More of the FM bell family.** There were already five FM bell voices (bell,
chime, musicbox, celeste, harp) that differ mainly in ratio and decay. A
sixth would be a sixth setting of the same instrument. This rule does not
cover temple and church bells, which are a different object: struck metal is
inharmonic, and a bowl's character is the *beating* between partials a few
cents apart, which one FM voice cannot make. `templebell` and `tubular` are in
the `shrine` profile.

**Sung words, as in Vocaloid.** Words would make a loop be *about* something,
which works against what the app is for. A wordless voice never sounds dated
or foreign; a synthesized word always does.

**Speech-synthesis dependencies** (Klattsch, Pink Trombone, Qlatt). They aim
for clear speech, which is the opposite of the goal, and each brings a build
step or a worklet.

---

## Rules for contributions

These rules are not obvious from the code. `AGENTS.md` and `core/AGENTS.md`
have the full rules for each change.

1. **A new voice in a pool changes the loops that draw from that pool,**
   because one new entry moves that draw and every draw after it. From 1.0
   on, a new voice, profile or vibe joins at a new code version
   (`data/codes.txt`), so a code made before it never draws it. Run the
   balance lock (`node tools/stats.mjs --check`), and say in the PR what
   moved.
2. **Ids in `data/codes.txt` never change.** Add a new member with the next
   free id. To take a member out, keep its row and mark it `gone`
   (`core/docs/codes.md`).
3. **Generation is quantized to a grid of 1/255** (`q8` in
   `core/src/generator/character.rs`), so that share codes are lossless. The
   weights feed weighted random picks, and a rounding difference of 0.004
   can pick a different scale.
4. **A cost that is declared but not passed is worse than no cost.** A voice
   cost (`data/voices.txt`) applies only where the player passes it. Check
   that a new cost is used, not only declared.
5. **A new voice arrives measured, not guessed.** Measure its cost and its
   loudness next to the voices that it will sit with when you add it. `keys`
   was once priced at 25, like the piano's two voices, and it took the
   melody's room on real phones until it was measured.
