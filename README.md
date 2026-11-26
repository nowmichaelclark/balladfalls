# Ballad Falls

A procedural loop machine. It makes relaxing, meditative and joyful
nostalgic loops, plays them for as long as you like, and lets you re-roll one
layer at a time until it's yours. Nothing is a recording and nothing is
downloaded: every loop, a tune, chords, a bass, drums and soft textures, is
written and played in your browser (or in the Android app) from a seed.

Live at <https://balladfalls.com/>. Open it, press Play, and press Next for
another.

On Android, the app is on the
[latest release](https://github.com/nowmichaelclark/balladfalls/releases/latest)
as an APK (Ballad Falls 1.0, 2026-11-25), and on F-Droid once its review there
is done.

It was called Driftloom until 1.0. Its history up to then is in this
repository too; the old repository,
<https://github.com/nowmichaelclark/driftloom>, is the archive with its pull
requests, and the old address sends every link on to the new one.

The music engine is a small Rust core, compiled to WebAssembly, that decides
every note and renders every sound; the same core runs natively in the Android
app. The page sends it commands and draws what it reports. The built module,
`js/dlplayer.wasm`, is committed, so the page has **no build step and no
dependencies**: it is plain files. A browser that can't run WebAssembly and
AudioWorklet is told so in one plain line.

## Running it

The page uses ES modules, which browsers refuse to load over `file://`, so
serve the folder:

```sh
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>. On a phone, open the live site in Chrome and
use "Add to home screen": there is a manifest and a service worker, so after
the first visit it works with no signal at all.

It deploys to Cloudflare Workers as static assets (`wrangler.jsonc` is
assets-only: no build step, no `main`; pushing to `main` deploys). The service
worker is **network first**, with the cache as the offline fallback, so a deploy
shows up on the next cold start: close the app from the recents switcher and
reopen it. Diagnostics (Library, More, Advanced) shows `build`, the way to
confirm what you are running; bump `BUILD` in `js/main.js` and `CACHE` in
`sw.js` together on every change.

The Android app is in `android/` (`android/README.md`: how to build it, and how
it gets to F-Droid). To work on the core, `core/README.md` and
`tools/build-core.sh`; `AGENTS.md` has the build and test commands.

## The app

The screen is one page that never scrolls (lists aside): the **card** at the
top shows what is playing (tap its name to rename it; tap the details for the
rest), the **view** in the middle, and a row of keys at the bottom: previous,
play and next (Next past the newest loop makes a new one), Library, Save and
Share, and Now playing, with a key that switches between Layers and Sound.

- **Now playing** is the calm view: the time (counting down, or up for a loop
  that plays on), the bar and the way through a long piece (drag it to move
  the playhead), the album's place, and what Next will do. **Vibe**, at its
  top, opens what the next loops lean toward: moods (cozy, joyful, misty...),
  tempo, key and scale, style, voices, the bars (a loop up to 32,768 bars, or
  Endless) and the track length to the second; each is one choice, a range, a
  set, or any. The loop playing, albums and saved loops are left as they are.
- **Layers** shows the drums, bass, keys, melody and air as they sound, each
  with a speaker (on or off) and a die: **re-roll** replaces one layer and
  leaves the rest. Re-rolling the keys changes the harmony, so the bass and
  melody follow it while keeping their own rhythms.
- **Sound** has the tempo, warmth, space and wobble of the loop playing, the
  volume, and how far it wanders. **Drift** ("let the loop wander") makes it
  vary as it repeats (a hat drops out, a note steps to its neighbor, a layer
  takes a bar off) and always returns to the loop you saved: the variations are
  made fresh each pass and never written back.
- **Save** keeps the loop in an album (Favorite Loops, or any), and its Share
  tab is keys: copy and paste a code, export audio (flac, opus or MIDI), a
  share link, and a seed album. **Library** holds the albums, every loop,
  and under More: backups, **Lite** (lighter on processor, for older phones;
  the app may switch itself and you can always switch it back) and Diagnostics.

**Keys on a computer:** Space or K plays; the arrows go next and previous
(Shift: a bar on or back); Up and Down the volume; M mutes; 1 to 5 re-roll a
layer and R all five; a letter opens a view (? lists them all); Ctrl+S (Cmd+S)
saves. Advanced has a switch for the single letters.

**Export audio** saves a loop or a track as a flac (lossless) or an opus
(small) file, as long as the track plays and in the background while the music
goes on; an album exports whole as a zip or a file a track, each tagged. **MIDI**
writes a four-repeat type-1 file with drums on GM channel 10, so the notes can
go to a DAW.

## Codes

A loop is a seed and a request, so it fits in a short code: no internet needed
at either end, and no server sees it. Copy a code (Save, Share), paste it in the
app (Library or Share), and you hear the very same loop, name and all. A link is
the site's address with the code after `#c=`; an album is a code too, and a
whole album can come from one seed. A code names things by stable ids with room
to grow, so what is added later does not change what a code played (from 1.0 on).
Codes made before version 2 say they are too old.

## Profiles

A profile is a set of constraints -- tempo band, scale pool, instruments,
density, meter, form -- that move together.

| | |
|---|---|
| **Dust** | worn tape; the original voice, still the commonest draw |
| **Glade** | modal folk. Modes sharing a lowered 7th so bVII-to-I is available; harp, ocarina, flute, often 6/8 |
| **Thaw** | cold and spacious. Sparse piano, long silence, octave leaps, quartal chords, dropped steps |
| **Haven** | still and domestic. Rhodes and a hushed pad, no percussion, very slow, deliberately dry |
| **Bloom** | bright and mechanical. Mono lead with portamento through a resonant filter |
| **Vapor** | drifting. Coprime layer cycles that never resynchronize |
| **Halcyon** | warm analog nostalgia. Fat detuned pads, soft breakbeat, long dub delays |
| **Clockwork** | prepared piano. Felt-damped, faintly out of tune, the mechanism audible |
| **Shatter** | fast and fractured. Chopped breaks, stutter rolls, chromatic turns |
| **Grove** | wooden mallets. Kalimba tines and marimba bars: dry pitched percussion, which nothing else here provides |
| **Hollow** | voices. Synthetic vowels and humming, wordless and unhurried |
| **Shrine** | struck metal left to ring. Temple bowls and church bells, long decays, a lot of space between strikes |
| **Undertow** | hypnotic pulse. Steady four, very short fragments, the mix breathing against the kick |
| **Tide** | sea and island folk. Fiddle, whistle and pan flute over harp, accordion and a strummed nylon guitar; gentle loops waltz in 3/4, lively ones jig in 6/8, and about a third sit on a drone. A frame drum and tambourine in place of the kit, and the slow swell of waves |
| **Cinder** | island and volcano: fast, rhythmic, Spanish-tinged. A driving 6/8 at 120-150 bpm, some 4/4, drums in nine loops in ten with the hand kit leading; a strummed nylon guitar on the Andalusian cadence, fiddle, whistle, marimba, accordion and pan flute on top |
| **Wayfare** | the traveling music: steady, bright, moving. A walking 4/4 at 104-138 bpm, some 6/8; pan flute, fiddle, whistle and ocarina over accordion, nylon guitar and harp, and in half its loops a chug -- eighth notes on the bass, and on the brushes when brushes play -- like wheels on rails. Its own light, steady drum grooves |

These are not sixteen boxes. Every loop draws a **weight across several of
them** -- an exponential draw per profile, normalized, which is a Dirichlet
and spreads weight far more naturally than picking fractions by hand. About
78% of loops blend two to four profiles, with lopsided mixes commoner than
even ones, so a loop still sounds like it is *about* something. Pools are
unioned rather than replaced, so a mostly-Dust loop with a little Glade in
it can still reach for an ocarina.

Adding a voice to a pool changes the loops that draw from it, because voices
are drawn at render time from the blended pool and one added entry shifts every
random decision after it. Before 1.0 that was allowed (the fiddle and accordion
went straight into Glade that way). From 1.0 on a new voice, profile or vibe
joins at a code version (`data/codes.txt`), so a code made before it never draws
it; the app must keep a code's version before the first addition (`docs/QUEUE.md`,
"Known issues"). The balance lock (`node tools/stats.mjs --check`, in
`docs/archive/engineering-notes.md`) guards the overall character when pools
change.

## Project documents

`docs/README.md` is the map: which doc is for what and who reads it.

- `AGENTS.md` -- the guide for Claude sessions: what Ballad Falls is, the roles,
  the rules that hold everywhere, build and test commands (`CLAUDE.md` imports
  it; `core/AGENTS.md` adds the core's rules).
- `ROADMAP.md` -- what is still ahead, what was decided against, and the
  contribution rules; what shipped is in `docs/archive/roadmap-shipped.md`.
- `docs/QUEUE.md` -- the work queue Claude Code works down, with its
  standing rules and merge policy; `docs/DONE.md` lists what shipped.
- The Workshop Wiki's Ballad Falls pages
  (<https://nowmichaelclark.github.io/wiki/>) -- how it works inside: the
  sound, the measurements, and why things are the way they are.
- `docs/BRAIN.md` -- the planning side's handoff: how the work is organized,
  listening results, methods, current state; `docs/DECISIONS.md` has what
  Mikey has decided.
- `docs/MOODS.md` -- the mood vocabulary and its draft recipes.
- `docs/ALBUMS.md` -- listening albums waiting for answers.
- `docs/EARS.md` -- what the ears sessions measured on Mikey's albums
  against Ballad Falls, and what they're for; their tools are in `tools/ears/`.
- `docs/ears/` -- everything the ears sessions write: reports, the plan,
  album cards, raw data (index in `docs/ears/README.md`). Ears outputs live
  in the repo, not only in the Project (Mikey, 2026-10-17).
- `CHANGELOG.md` -- what changed for listeners, in plain words.
- `core/` -- the Rust core's source; `js/dlplayer.wasm` is built from it.
- `docs/archived.txt` -- what left the repository after 1.0 and where it
  still reads (everything before 1.0 is in the archived
  [driftloom](https://github.com/nowmichaelclark/driftloom) repository).

## License

MIT. Do what you like with it.
