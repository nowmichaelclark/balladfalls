# Vibes

A **vibe** is the app's word for a mood word (`docs/MOODS.md`). A listener
picks vibes on the Now Playing screen, and every new loop leans toward
them. There are 88. Each vibe is a recipe in `data/vibes.txt`: what the
vibe leans on. This page says how a recipe works and how to edit one.

The core's generator reads `data/vibes.txt`, compiled in (`core/build.rs`).
The page reads the same file for the names and their order: the picker, a
request and a share code (`js/vibes.js`). The story of how the recipes were
drafted and measured is in the wiki, "Ballad Falls/Mood words and
vibes/How the vibes were tuned".

## How a recipe works

A recipe names only what the vibe cares about. Every field is optional.

- **Targets** (0 to 1) pull the draw toward a value, but never jump to it:
  - `feel` (`lift`, `energy`, `warmth`): the generator's three feeling
    dials. The moods' points in `data/moods.txt` use the same scale.
  - `tempo`: the place in the loop's tempo band (0 its slow end, 1 its
    fast end).
  - `tone` (`warmth`, `space`, `wobble`): the Sound panel's three dials.
  - `swing`: the place in the loop's swing band.
- **Leans** multiply the generator's own weights. 1 is no change, 2 is
  twice as likely, and 0.3 is a third as likely.
  - Tables: `profiles`, `modes`, `melody`, `chords`, `bass` (bass voices),
    `bassStyle` and `texture`.
  - Single numbers: `six8` (6/8 against 4/4), `long` (8 bars and up
    against 2-4), `drums` (the chance of a kit), `hats` (hat density),
    `rests` (bars of rest in the tune) and `bigChords` (four notes and up
    against three).

For each new loop, the generator takes up to five of the picked vibes.
Their weights share 100% (each at least 5%), and the loop draws a strength
between 0.5 and 0.9.

- **A target** moves the draw part of the way: by the strength times the
  summed weights of the vibes that set it (at most 1), toward their
  weighted mean.
- **A lean** multiplies by `value ^ (strength x weight)`. So a vibe at 5%
  barely moves it, and a lone vibe at full strength moves it all the way.
  This is why a lean must be large: a strength of 0.5 shrinks a lean of 2
  to about 1.4.

## The rules of a lean

- **A lean multiplies only what a pool already holds.** A `harp` lean on a
  loop whose profiles draw no harp does nothing. A vibe never brings in a
  voice, a mode or a texture that the profile lacks. Use the `profiles`
  lean to reach another profile's voices.
- **`drums` leans the odds of a kit** (yes against no). It can never make
  a kit more than certain. Because it is raised to the strength, a calm
  vibe needs 0.01 or lower to keep kits under 15% of its loops.
- **`hats` and `rests`** multiply the profile's hat density and `restBar`.
  The generator scales and clamps both.
- **`six8` leans every 12-step meter,** 6/8 and the waltz (3/4) alike.
- **A `tone` target clamps** to the blend's own range for that dial. A
  vibe cannot take a profile's sound outside what it allows. `feel`
  targets pull before the clamp to the profiles' feel ranges.
- **A request can give weights.** A game or a developer can give each vibe
  the share of the loop that it steers, in place of the drawn shares
  (`core/docs/player.md`, "The request"). The strength is still drawn.
- **Glacial plays its own arc** even when the draw does not pick it, with
  a chance of `glacialChance` (0.6, `data/choices.txt`) times glacial's
  weight.

## How to edit a vibe

The recipes are `data/vibes.txt`, plain text with comments. The format is
at the top of `js/data.js`. For a vibe, this is all of it:

```
# a comment, to the end of the line
[vibe airy]                              # one block a vibe, named by its id
feel = energy 0.25                       # a target: names and numbers
tempo = 0.25                             # one number
profiles = thaw 15.6, vapor 8, glade 2.2 # a lean: a name and a number, each
melody = flute 9.9, sine 2.8,            # a long line goes on the next,
    panflute 2.8                         # indented
```

1. Change a number or a name in place. Use only the keys that "How a
   recipe works" lists.
2. Write numbers as plain numbers: `0.05`, `9.9`, `2`. A ratio such as
   `1/3` also works, but a vibe seldom needs one.
3. Run `node test/data.test.mjs`. If a key, a name (a profile, a mode, a
   voice) or a number is wrong, it fails and names the file, the block
   and the key.
4. Bump `BUILD` in `js/main.js` and `CACHE` in `sw.js` to the next
   version. A vibe is an app change.
5. Run `tools/build-core.sh` and commit the rebuilt `js/dlplayer.wasm`.
   The module compiles the vibes in, so CI's `build-core.sh --check` fails
   without it.
6. Run `node tools/gen-golden.mjs` and commit
   `core/golden/generation.hashes`. Every case that uses the vibe moves.
   Say in the PR which cases moved (`--check` names them).

**To add a vibe:** since 1.0, a new vibe joins at a new code version
(`data/codes.txt`, `core/docs/codes.md`), so that an old code never draws
it. Add a `[vibe name]` block. Add the name at the **end** of `ids` in the
`[order vibes]` block. Never reorder or remove a name there, because share
codes write a vibe by its place in that list.

**To measure a vibe:** `node tools/stats.mjs --vibes a,b,c` compares one
selection with none, and `--vibe-each` gives a line for each vibe alone.
`node tools/measure.mjs --vibe-mix` draws a corpus with 1, 3, 5 or 10
random vibes, for the loudness and refusal checks.

## Open, for Mikey's ears

- Every recipe is a draft that Mikey tunes as he listens.
- **Mild vibes:** reflective, peaceful, sour, tart and mysterious move a
  loop only a little, because they have no strong profile of their own.
- **Five vibes at once** average out, as built.
- **Waiting on the records:** groovy, pulsing, cruising, cosmic, rainy and
  jazzy lean on what the catalog has now. Grooves, arpeggios, a rain
  texture and extended chords would make them better.
