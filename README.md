# Ballad Falls

Ballad Falls is a procedural loop machine. It makes relaxing, joyful and
nostalgic loops, and it plays them for as long as you like. Each loop has
five layers: drums, bass, keys, melody and air (soft textures). You can
re-roll one layer at a time until the loop is yours.

Nothing is a recording, and nothing is downloaded. The app writes every note
and makes every sound on your device, from a seed. A seed is one number that
the app uses to make all its random choices, so the same seed always gives
the same loop.

- **On the web:** open <https://balladfalls.com/>, press Play, and press
  Next for another loop. After the first visit, it also works offline.
- **On Android:** get the APK from the
  [latest release](https://github.com/nowmichaelclark/balladfalls/releases/latest)
  (Ballad Falls 1.0, 2026-11-25). The app comes to F-Droid when its review
  there is done.

## How it works

The app has three parts:

1. **The core** (`core/`) is the music engine, written in Rust. It decides
   every note and makes every sound. It is compiled to WebAssembly, a
   format that browsers run, as `js/dlplayer.wasm`.
2. **The page** (`index.html`, `js/`, `css/`) is plain files with no build
   step and no dependencies. It runs the core in an AudioWorklet, which is
   code that the browser runs on its audio thread (`js/worklet.js`). The page
   sends the core commands and draws what the core reports
   (`js/player.js`). If a browser cannot run WebAssembly and AudioWorklet,
   the page says so in one line.
3. **The Android app** (`android/`) shows the same page in a WebView, and
   plays it on the same core, built natively for Android.

The music comes from profiles. A profile is a set of rules that move
together: a tempo range, scales, instruments, how busy the parts are, the
meter and the form. Each loop mixes several profiles with weights, so most
loops sound like one thing with a little of others. About 78% of loops mix
two to four profiles. The profiles are in `data/characters.txt`.

| Profile | What it sounds like |
|---|---|
| **Dust** | Worn tape. The first voice of the app, and still the most common. |
| **Glade** | Modal folk: harp, ocarina and flute, often in 6/8. |
| **Thaw** | Cold and open: sparse piano, long silences, octave leaps. |
| **Haven** | Still and home-like: Rhodes and a soft pad, no drums, very slow. |
| **Bloom** | Bright and mechanical: one lead that slides through a filter. |
| **Vapor** | Drifting: layer cycles of different lengths that never line up again. |
| **Halcyon** | Warm analog: thick pads, a soft breakbeat, long dub delays. |
| **Clockwork** | Prepared piano: muted, a little out of tune, the mechanism audible. |
| **Shatter** | Fast and broken: chopped breaks, stutters, chromatic turns. |
| **Grove** | Wooden mallets: kalimba and marimba. |
| **Hollow** | Voices: synthetic vowels and humming, with no words. |
| **Shrine** | Struck metal that rings: bowls and bells, long decays, much space. |
| **Undertow** | A hypnotic pulse: a steady four, short fragments, the mix breathing with the kick. |
| **Tide** | Sea and island folk: fiddle, whistle, pan flute, harp, accordion and nylon guitar, in 3/4 or 6/8. |
| **Cinder** | Island and volcano: a fast 6/8 with hand drums and a Spanish guitar cadence. |
| **Wayfare** | Travel music: a steady walking 4/4, and in half the loops a chug like wheels on rails. |

### Codes

A loop is a seed and a request, so it fits in a short code. Copy a code in
the app (Save, then Share) and paste it on another device: you hear the same
loop, with its name. A share link is the site's address with the code after
`#c=`. An album is a code too.

Codes stay the same forever, from 1.0 on. A code names each thing by a
fixed id (`data/codes.txt`). If a new voice, profile or vibe comes later, it
joins at a new code version, so an old code never draws it.

## Use the app

The screen is one page that does not scroll. The card at the top shows what
plays. The view is in the middle. The keys at the bottom are previous, play,
next, Library, Save and Share, and Now playing.

- **Now playing** shows the time, the bar, and what Next does. Drag the bar
  to move the playhead. **Vibe**, at the top, sets what the next loops lean
  toward: moods, tempo, key, style, voices, the bars and the track length.
- **Layers** shows each layer as it sounds, with a speaker (on or off) and a
  die. The die re-rolls only that layer. If you re-roll the keys, the
  harmony changes, and the bass and melody follow it.
- **Sound** has the tempo, warmth, space and wobble of the loop, the volume,
  and **Drift** ("let the loop wander"). Drift varies the loop as it
  repeats, and always comes back to the loop that you saved.
- **Save** keeps the loop in an album. **Share** copies a code or a link,
  and exports audio: FLAC (lossless), Opus (small) or MIDI.
- **Library** holds the albums and every loop. Under More, it has backups,
  **Lite** (lighter on the processor, for older phones) and Diagnostics.

On a computer, Space or K plays, and the arrows go to the next or previous
loop. Press ? in the app to see all the keys.

## The folders

| Folder | What is in it |
|---|---|
| `core/` | The Rust music engine. `core/README.md` explains it. |
| `js/` | The page's code. `js/main.js` starts the app. |
| `css/`, `fonts/`, `icons/` | The look of the page. |
| `data/` | The tables that the core reads: profiles, voices, moods, vibes, choices, codes. |
| `audio/` | One near-silent file that keeps the phone's media session open. |
| `android/` | The Android app. `android/README.md` explains how to build it. |
| `fastlane/` | The store text and pictures for F-Droid. |
| `test/` | The tests. Each one runs as `node test/<name>.test.mjs`. |
| `tools/` | The tools that build, check and measure. `tools/README.md` lists them. |
| `docs/` | The plans, decisions and work queue. `docs/README.md` is the map. |
| `design/` | The design notes, and Playwright scripts that take pictures of the screens. |
| `old-address/` | A small worker that sends the old Driftloom address on to the new one. |

Two more pages are not linked from the app. `speed.html` is a speed test for
phones. `rank.html` is a listening test: you hear a loop and put mood words
in order, from most like it to least.

## Run it on your computer

The page uses ES modules, and browsers do not load them from `file://`. So
serve the folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. On a phone, open the live site in Chrome
and use "Add to home screen".

## Work on it

1. Read `AGENTS.md` first. It has the rules and every build and test
   command. Claude sessions read it too.
2. If you change the core, rebuild `js/dlplayer.wasm` with
   `tools/build-core.sh`. Then read `core/AGENTS.md`.
3. If you change the page, bump `BUILD` in `js/main.js` and `CACHE` in
   `sw.js` to the same next version.
4. Run `tools/gate.sh`. It runs the checks that CI holds a merge to.

A push to `main` deploys the site to Cloudflare Workers as static files
(`wrangler.jsonc`). The service worker (`sw.js`) asks the network first and
uses its cache only offline. So a deploy shows on the next cold start: close
the app and open it again. Diagnostics shows `build`, so you can see which
version runs.

## The documents

- `AGENTS.md`: the guide for anyone who works on the code.
- `docs/README.md`: the map of the docs, and who reads each one.
- `docs/QUEUE.md`: the work that is next, and its rules.
- `docs/DECISIONS.md`: what Mikey decided, and why.
- `ROADMAP.md`: what is ahead, and what was decided against.
- `CHANGELOG.md`: what changed for listeners.
- The [Workshop Wiki](https://nowmichaelclark.github.io/wiki/), folder
  Ballad Falls: how the sound works inside, the measurements, and the
  reasons behind them.

## History

The app was called Driftloom until 1.0. The
[driftloom](https://github.com/nowmichaelclark/driftloom) repository is the
archive of everything before 1.0, with its pull requests. Its old address
sends every link on to the new one. `docs/archived.txt` lists the files that
left this repository after 1.0, and where you can still read them.

## License

MIT. Do what you like with it.
