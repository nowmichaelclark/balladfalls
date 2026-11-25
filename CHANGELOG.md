# Changelog

What changed for the people who listen, in plain words. Each line says what
you will hear or what you can do now; `docs/DONE.md` has every merge with its
numbers, for the people who build it. Begun by session 30 (2026-11-24) from
`docs/DONE.md`, from the testers' version (v153) on; session 31 dated the 1.0
entry.

## 1.0 (2026-11-25)

### A new name

- **Driftloom is Ballad Falls now,** at <https://balladfalls.com/>, with a new
  icon. The old address sends every link on, its loop or album with it. The
  first time you open the old address (or the app you installed from it), it
  offers to bring your Library across: your loops and albums, as they are.
  Say not now and they stay where they were; a backup file restores at the new
  address as it always did. Install the app again from the new address.
- **On Android,** Ballad Falls is a new app, from F-Droid. The test builds
  stay apart; move a Library across with a backup.

### New to hear

- **New sounds, all soft and all drawn into loops now and then.** Each shows up
  in roughly one loop in six or seven, and every loop without it plays as it
  did.
  - A low bell, struck or swelling, on each new chord root; sometimes it rings
    alone where the drums and bass have stepped out for a moment.
  - A tremolo guitar's twang, soft, on the chords.
  - A bass that ducks a little at each kick and comes back; pads whose filter
    opens and closes slowly over many seconds; a kit and a bass that wait a
    minute before they come in.
  - A whole loop tuned a touch flat or sharp of the usual pitch, the way an
    old tape or an untuned piano is; a slow, tape-like wobble on the chords.
  - Chords that are much wider in stereo (headphones; a phone's speaker hears
    what it did before); a drum kit that plays in threes, and a lilt against
    the bar; a soft color note held over some chords; sevenths that slide in
    steps.
- **The chords sit nearer the tune,** where they used to leap an octave away.
- **Long pieces are composed.** Past 32 bars a piece is no longer one loop
  wandering: it is either an arc (a theme that returns changed, a build and a
  release, a second theme, related keys, a close) or a slow wander (one thing
  moving at a time, long held states). Joins between its parts are written so
  nothing drops out, endings land, and Endless goes on without a seam. With
  nothing picked, about one new loop in ten is now a long piece, 1 to 39
  minutes, usually a few.
- **No hiss behind the music,** and none of the crackles the Android app had
  with the screen off: it plays on the phone's own music path now.
- **Layers show what is heard,** in time with it: each step's notes as each
  layer sounded them, dimmer where a long piece's quiet layers or a kit coming
  in hold them down.

### New to do

- **Save a loop as a sound file** (flac, lossless, or opus, small) as long as
  the track plays, safely in the background while the music goes on; or as a
  MIDI file. An album exports whole, as one zip or a file a track, every file
  tagged with its title, album, track number, code and cover.
- **Short codes and links.** A loop or an album is a short code; a link is the
  site's address with the code after `#c=`, and it works offline. A loop's own
  name travels with its code in any language. A whole album can come from one
  seed. Old long codes say they are too old.
- **Track length,** its own view, to the second, with a fade in and a fade out.
  A loop plays on until you move on, or for the time you set.
- **Pick what the next loop is like:** tempo, key and scale, style, voices, bars
  (up to 32,768, or Endless), and moods, each one value, a range or a set, or
  any.
- **Move around a long piece** (where you are, its line and jumps), and drag
  the timeline to move the playhead on any loop, playing or paused.
- **Albums:** Previous works in an album and goes round; a seed album can be
  saved to the Library; an album's code carries each track's time.
- **The Android app** (the same engine; on F-Droid after 1.0): plays on with the screen
  off, with controls on the lock screen and in the notification, which show the
  loop's own cover; a call pauses it and it comes back; exports save through
  Android's picker.
- **Keys:** Space or K plays; the arrows go next and previous (with Shift a bar
  on or back); Up and Down the volume; M mutes; R and 1 to 5 roll the dice; a
  letter opens a view; ? lists them all. A switch in Advanced turns the single
  letters off.
- **A look that fits every screen:** a short phone, a phone on its side, a
  tablet; the card with its art on the right, a round playhead light, solid
  slider knobs, a die that looks like one, speakers for the layers. Fewer
  words everywhere, and a screen reader says what the screen shows.
- **Works for everyone:** the app follows WCAG 2.2 AA (text sizes, focus,
  contrast, touch targets, screen readers), checked by `tools/a11y.mjs`.
- **Codes that last.** A code or link made on 1.0 plays the same loop on every
  version after it; new sounds join later codes only.
- **The version,** 1.0, at the end of Advanced and at the top of Diagnostics.

### Fixed

- A browser too slow to play even on Lite says so in one plain line, and after
  a long rest the stereo picture comes back at once instead of staying narrow
  for ten seconds.
- In the Android app, the lock screen's Play after a long pause works, and
  Lite's switch makes no click.
- Diagnostics' "reset counters" really resets (session 30).

## Before 1.0

The app's testing months (v1 to v152) are in `docs/archive/done.md` and
`docs/archive/roadmap-shipped.md`: loops from profiles and vibes, the Rust core
that makes and plays every sound, the offline app.
