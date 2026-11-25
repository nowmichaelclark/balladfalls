# For Mikey

What the long hands run toward 1.0 left for Mikey: his phone, his computer,
his eyes and ears, his accounts. One line each: what, which PR, what to look
for. The hands add lines as they go and never wait on them; an answered line
is removed (or moved to `docs/DECISIONS.md` by the brain). Empty or answered
at 1.0 (queue item 108). Cleaned by session 30 (2026-11-24): what you had
answered or replaced is gone, the rest shorter; the words table of item 113 is
in `docs/archive/notes/113-words-table.md`.

**Nothing here holds 1.0 now (session 31, 2026-11-25).** 1.0 is merged:
the icon (#1), the new name (#2) and 1.0 itself. What is yours from here is
"Launch day, in order", the last section; everything else is a check that
closes with your phone or your ears, and a revert follows if you find trouble.

## Accounts

- **The new name** (session 31a's #2, merged by session 31 with the icon's #1
  at 1.0). The new repository and its Worker `balladfalls`, with
  balladfalls.com attached, are made (2026-11-25); the steps left are in
  "Launch day, in order", at the end.
- **Your release key** is made (2026-11-25; SHA-256 in `docs/DECISIONS.md`).
  Keep `release.jks` and its password safe for good: lose either and the app
  can never be updated.
  - **GitHub signs each release** (you, 2026-11-25: "I don't want to have to
    sign releases via my linux machine"). The key is in this repository's
    secrets, and the release workflow signs the APK with apksigner 34, checks
    that the certificate's SHA-256 is the release key's, and attaches
    `balladfalls-<version>.apk` to the tag's release, the file F-Droid
    compares its own build with. Adding the secrets, once, on your Linux
    machine and GitHub's website (no Android tools needed):
    1. In a terminal: `base64 -w0 ~/release.jks > ~/release-b64.txt`, then
       `xdg-open ~/release-b64.txt`; in the editor that opens, Ctrl+A, Ctrl+C.
    2. Signed in to GitHub as the repository's owner, open
       <https://github.com/nowmichaelclark/balladfalls/settings/secrets/actions>
       and press **New repository secret**: name `RELEASE_KEYSTORE_BASE64`,
       paste into Secret, **Add secret**.
    3. Again: `RELEASE_KEYSTORE_PASSWORD`, the keystore's password.
    4. Again: `RELEASE_KEY_ALIAS`, the word `release`.
    5. Only if keytool asked you for a separate key password and you gave a
       different one: `RELEASE_KEY_PASSWORD`, that one.
    6. `rm ~/release-b64.txt`. Keep `release.jks` and its backup as they are.
    Then a release signs itself; to sign one again (as v1.0, tagged before
    this), Actions, android-release, **Run workflow** on `main` with its tag.
  - Rendering the recipe (below) takes `--signed-by <that SHA-256>`.
- **Submit to F-Droid after 31** (the merge request is public and carries the
  new name):
  1. A free GitLab account; fork <https://gitlab.com/fdroid/fdroiddata>.
  2. In a checkout of the `v1.0` tag: `node android/fdroid/render.mjs
     --repo-url https://github.com/nowmichaelclark/balladfalls --signed-by
     <SHA-256> > /tmp/recipe.yml` (the id, name, version and tag's commit
     filled in).
  3. In your fork, create `metadata/com.balladfalls.app.yml` with that text;
     open a merge request to `fdroid/fdroiddata` titled "New app: Ballad Falls" with its
     "New app" template. Its CI runs F-Droid's build and lint, as
     `.github/workflows/fdroid.yml` does here.
  4. Reviewers answer in the merge request, usually within a few weeks. Likely
     questions: the NDK (r28c), why the app deletes the committed wasm and
     rebuilds it, and the WebView (no network permission); the recipe's
     comments hold the reasons.
  5. Once merged, the listing appears in a few days. Then set `APP_LINK` in
     `js/main.js` to `https://f-droid.org/packages/com.balladfalls.app/`, bump
     `BUILD` and `CACHE`, and merge.

  The other way in, a "Request for Packaging" issue at
  <https://gitlab.com/fdroid/rfp/-/issues>, is slower and F-Droid writes the
  recipe its own way.
- **Google's developer verification** (read before submitting): since
  2026-09-30 certified phones in Thailand, Brazil, Indonesia and Singapore need
  apps from seven big stores to come from a verified developer. F-Droid is not
  one, and a hand-installed APK isn't checked yet, so nothing changes for 1.0.
  Google plans to cover every install in 2027 (an unregistered app then needs a
  one-time "advanced" setting on the phone). Nothing to do now.

## On your Moto, in order

Each is a few minutes. Say a step's number if something is wrong.

1. **The latest APK, ten minutes with the screen off: after 1.0** (you,
   2026-11-25; promise 1 on a phone; #473 to #475, and v218; download the
   `driftloom-debug-apk` artifact of
   <https://github.com/nowmichaelclark/driftloom/actions/runs/45550549271>,
   built from commit 4ddf186, the same code as main's v218; it needs a GitHub
   sign-in). Play E9T-ZxDxj, then the Batch 6 album (Library, `docs/ALBUMS.md`):
   screen off for ten minutes, then a few minutes behind the home screen. No
   gap, no crackle, the loops changing on their time. Then Diagnostics,
   refresh, copy, send it with the phone's name (it now has "screen off: N s"
   and "lite by itself").
2. **Lite by hand:** switch Lite on and off once. No click at the switch (the
   old sound fades out quickly now).
3. **Pause and the lock screen:** pause, wait two minutes with the screen off,
   press Play on the lock screen: it plays.
4. **The controls** (107d, #431): Pause, Play, Next, Previous from the lock
   screen and the notification; a headset's buttons; pull the headphones while
   it plays (it pauses); a call, or a video in another app (it pauses and
   returns); a message tone only lowers it for a moment. The notification and
   lock screen show each loop's own cover and its name (seen right on the Moto,
   2026-11-22; the tablet is left). Say no to the notification question once:
   the music and the lock screen's controls should work all the same.
5. **An export with the screen off:** a long piece (a Journey, a few minutes)
   playing, then Share, export, a 30-minute length, flac, and the screen off.
   It finishes: "Saved" and the file's name, and the file plays. Then opus, a
   MIDI file and a backup (the same picker), and Restore (it opens Android's
   file picker).
6. **An album exported whole** (item 121, #467): play an album (or open one in
   the Library), Share, export, press album. With zip, press flac: Android's
   picker asks where the zip goes. Then files and opus: Android's folder picker
   asks for a folder, and each track lands there as "01 name.opus", "02 ...".
   A track that plays on asks its length once. Cancel one partway: no zip is
   left. In a music player (the Moto's own, or VLC): the album under its name,
   the cover art per track, the tracks numbered 1 of N, the artist the app's
   name, today's date, the loop's code as the comment. Opus covers are the one
   thing players differ on most.
7. **The timeline** (item 116, #461), on a short loop and a long piece:
   playing, tap the bar under the time halfway and drag: the music goes on from
   there. Pause, tap a quarter along: the bar and the time move, nothing plays;
   Play starts there. With a Track length set (say 3:00), a tap near the end
   leaves that much to go. Then 256 bars, pause, tap the line: the head and
   "bar N/256" move. Say if a tap misses the bar or lands elsewhere.
8. **Chrome's address bar** (item 119, #468), in a Chrome tab, not installed:
   drag up from anywhere (the card, Play, a layer's row, a Sound slider's line
   or knob, the tempo picker's slider) and the address bar goes; drag down and
   it comes back. A straight drag up or down never moves a slider; one across
   does. The line under the time and a long piece's line keep their drags. Say
   if a place still doesn't scroll.
9. **The voices view upright** (item 118, #463): the bottom row (on, off, ‹ ›,
   any) fits with nothing cut; a tempo range ("70-85") typed from the number
   keyboard, if it has a dash.
10. **Previous in an album** (item 109, #442): press Previous from the screen,
    the headset and the notification: from the first track it goes round to the
    last, from any other to the track before, and the track plays its own length
    again. (A few seconds into a track it still goes to the track before, not
    back to the start of the one playing: say if you want "restart first".)
11. **The layers with a long piece** (item 110, #440), in the browser and the
    app: open <https://balladfalls.com/#c=ELAAAAAF_DHAbt>
    (a 128-bar arc), play, switch to Layers. In the first 15 seconds the kit and
    bass come in and the texture rises: their dots come up dimmer and brighten
    as they are heard; a note you hear has its dot when the playhead reaches it.
    Leave Playhead trim (Sounds) at 0 and say if the playhead runs ahead of or
    behind the notes with headphones; in the app, send Diagnostics' stream line
    (the output latency) and the phone's name.
12. **Sideways** (item 114, #457, not seen on a phone yet): in DuckDuckGo
    first, then Chrome, open the site and turn the phone: the panel at the left,
    card and keys at the right, the same gap at both ends (a screenshot if not:
    it says which insets that browser gave); a small swipe up on the panel puts
    the address bar away and the boxes grow, a swipe down brings it back;
    sliders and lists don't move the page.
13. **TalkBack** (item 114, five minutes): Settings, Accessibility, TalkBack,
    on; open the app. Swipe right from the top: the name, the details, the
    panel, the seven keys, each said with what it is, nothing just "button".
    Double-tap Play, then Next: "Pause", and the new loop's name once. The vibe
    key, then any bars: you land on cancel; cancel lands you back on any bars.
    Sound: each slider says a value ("92 bpm", "60%") and the volume keys move
    it; Layers: a switch says on or off. Share, export, flac: the end said once,
    not every percent. Font size at the largest: nothing cut or overlapping. If
    anything is silent, said twice, or lands somewhere odd, say which step. In
    Dawn the system's bars are Dawn's color with dark icons, and a box to type
    in lines up with its title.
14. **A Small export:** Share, export, opus, a few minutes of a loop you know,
    played in your player and in VLC beside the flac of the same loop (item
    104c, #424): meant to sound the same (Opus, 96 kbit/s stereo). Say where
    you hear a difference (a soft top end, a shimmer in the reverb) and the rate
    goes up. The opus key shows only where the browser can encode Opus: say
    whether it shows on the Moto, the tablet and an iPhone (where not, flac is
    the only one, by design).

## On your tablet and in your browsers

- **The tablet**, the same screen-off and lock-screen steps as the Moto's 1
  and 4 (the cover is the one left), and ten minutes of play on Lite: the card
  stays and Diagnostics reads `slow: no` (item 100). If "Browser too slow." ever
  shows, send the `slow:` line.
- **A friend's Pixel 9 on GrapheneOS** (item 100): with JIT off for the site
  the line should show within about a minute; send its `slow:` and `busiest:`
  lines either way (`docs/notes/98-testers.md` has the pastes).
- **A pasted code between devices** (item 105b): rename a loop in Thai with an
  emoji on the phone, copy its code (Save, Share, copy code) and paste it on the
  tablet: the same loop with the name. Old codes (DL1-, DLA1-) say "Code too
  old" and don't open; your Library is untouched.
- **The link's preview** (item 105c): paste the site's address into Discord: the
  title, the description and the app icon (512 px) show as a small card (Discord
  caches one for a while).
- **No hiss** (v176, #403): a quiet loop on headphones: no hiss behind it (the
  keepalive is a 20 Hz tone now), and the lock-screen and Bluetooth controls
  still come up. If the controls are gone, say so: the old file is one revert
  away.
- **Audio export in a browser** (item 104b, #416), Moto and tablet: play a loop,
  Share, export, flac, 30:00, let the music play on, the screen off for a few
  minutes. It finishes with the music never stuttering and downloads a `.flac`.
  Send how long it took, whether anything stuttered, and Diagnostics' `engine:`
  line (`late: 0  missed: 0  dropped: 0`); then once with Lite off.

## On a computer, in DuckDuckGo or Chrome

- **The keyboard** (item 122, #472), five minutes: Space plays; → and ← next and
  previous; Shift with them a bar on and back; ↑ ↓ the volume, M mute; 1 to 5
  roll a layer, Shift with them a layer on or off, R rolls all five; L Layers, S
  Sound, N back to Now playing; Esc closes whatever is open; ? shows every key.
  Say any key that does something you didn't expect, or nothing. Advanced >
  Keyboard > Letter keys turns the single keys off. If your Windows has Thai and
  English: none of the new keys use Alt, so none switches your keyboard's
  language.
- **Approve the letters,** or name others: N now playing, S sound, L layers, V
  vibe, D moods, B bars, T track length, P tempo, E key, Y style, O voices, I
  library, H share, X export, A advanced (K play, M mute, R roll). Where a first
  letter was taken, the next free one of the word.

## For your eyes (any device)

- **The look** (item 119, #468): the card with its art on the right; the Sound
  view's knobs, solid (on the dark themes the knob is the popup's dark color:
  say if you wanted it brighter); the Layers' die and its speakers (crossed out
  when off). Before and after, at 360x640, 320x568, on its side and a tablet,
  light and dark: the branch
  [`s30k-shots`](https://github.com/nowmichaelclark/driftloom/tree/s30k-shots/before-after).
- **The card** (item 112, #446): with a loop of three styles and three feelings,
  a long piece, Endless, an album open and playing, and a long name (Thai,
  emoji), on the phone upright and sideways, and at the largest text size: every
  line whole, never cut or squeezed. What doesn't fit is left off whole, least
  important first (the pass count, the third feeling, the third style, the shape
  word, the second feeling and style, the first feeling, the album playing, the
  first style, the meter, then the bars, the tempo and the key last), a dot column at the
  card's right says there is more, and a tap on the details shows the rest. Say
  if the order feels wrong.
- **Track length** (item 111, #448): Vibe, then the pace line's third key
  (the infinity sign, or the time set): the time to the second (type 1:23:45, or
  12345 as a timer's keys go), −1 min, −1 s, +1 s, +1 min, a coarse slider to a
  whole day, ∞, fade in, fade out, cancel, done. On a short phone (360x640,
  320x568) the time takes the title's place. Say if anything is in an odd place.
  An album link made before v193 (v189 to v192, passes or bars set, like the one
  you shared to check it) still opens but plays each track for only a few
  seconds: open the album, set each track's time, share it again.
- **The pickers** (item 118, #463): the vibe key, then tempo, key, style or
  voices: pick, pick another (a set), turn the pages (‹ ›), press any, cancel or
  done, then Next: the new loop leans on what you picked. Screenshots: the
  branch [`s30j-shots`](https://github.com/nowmichaelclark/driftloom/tree/s30j-shots).
  Choices to confirm: the three states as lit keys everywhere (one lit pinned,
  several a set, none left to chance; tempo's range two sliders, each pushing the
  other); long lists paged, not scrolled (4 to 5 pages on a short phone); the key
  view's tabs "note" and "scale"; the voices view's layers as Layers names them
  with "on" (always plays) and "off"; "clear" at the left of the Vibe panel's head
  clearing the moods too (the Track length stays); a layer turned off forgetting
  its picked voices when you press done.
- **The seed album** (item 121, #466): Share, seed album, save: name it and it
  is in the Library; play it there. Say if the name box should be skipped (it
  then lands as Untitled, as a pasted album does).
- **Fewer words** (item 113, #449), on the phone in this order: Save, the Share
  tab (five keys, nothing under them); export (flac, opus, midi, a key starts its
  export; on a loop that plays on it opens Track length first, then goes on);
  seed album; Vibe, then Track length; Layers (the dice); Save's Save tab (ticks,
  no line); Library, an album open; More, Advanced to its end. Every line changed
  is in `docs/archive/notes/113-words-table.md`: say a row to put it back.

## For your ears, when you like (nothing waits on it)

- **"Any bars" is sometimes a long piece** (item 117, #462), corpus seed
  20261009, nothing picked, paste the code: soath-wa `EKky18BHD` (#27), an arc of
  128 bars, about 9:40 a round: theme B comes in a fifth up at 3:01 and the peak
  is at 6:02; woth-rul `E3CZtsAI4` (#14), a wander of 128 bars, about 6:10: its one
  move (a layer) at 2:19, the close at 5:59. The Vibe panel still says any bars.
  About 1 new loop in 10 is one now (64 to 512 bars, weighted to the short end;
  a round 1 to 39 minutes, typically 4): two numbers in `data/longform.txt`,
  `[longform unasked]`, if you want more or fewer, longer or shorter.
- **The three albums in the app** (brain B4, `docs/ALBUMS.md`): batch 6, the
  nearer chords and the long pieces, as links the app plays, on your own devices.
  One word a track only if something sounds wrong. The long pieces' later fixes
  (item 102f and 102g's clips, no join a hole, on the branch `long-clips`) and
  "no join a hole on soath-wa" (corpus piece #27 as a 1,024-bar arc, at about
  38:50 and 45:35, and as an Endless arc at about 9:20) are there too.
- **twang** (v179, #414): every loop that plays twang plays the soft one;
  he-rosk (corpus #33, was bright) and tom-wen (#172, was slow) are the two that
  changed: the same picks, a beat apart. Say if either still sounds off.
- **Phase 3 Control** (`docs/ALBUMS.md`, v155): six loops, one album code, the
  old app and today's, each about 45 s, one word a loop. tui-doask (track 1, from
  about 0:31) and soath-wa (track 4, from about 0:27) used to come back narrow in
  stereo for about ten seconds after a long rest; Now may sound the same as Before
  or wider there.
- **The FLAC writer** (item 104a): 16 or 24 bits with no dither (the conservative
  pick). If a very quiet fade-out ever sounds grainy on headphones, say so and a
  seeded dither is a small change.

## Small calls (nothing waits on them)

- **Text stops at 1.5x in the views that don't scroll** (the card, the keys, the
  pickers), as since Painter 5, so they fit; browser zoom still takes them to
  200%, and the lists and Advanced go all the way (the Android app now does the
  same, where before it overflowed).
- **Two names only a screen reader hears** now hold the words on their key, as
  the standard asks (2.5.3): "Moods: any mood", "Bars: any bars". No word on
  screen changed.
- **A single loop's code carries no length** (it sounds the same however long it
  plays; when your app moves on is yours); an album's code carries each track's
  time and both fades. Say if a single loop's code should carry it too.
- **The words of item 113** are yours to approve; the rule you gave is in
  `docs/DECISIONS.md`.

## Launch day, in order

1. **The site:** open <https://balladfalls.com/>: it plays, its title Ballad
   Falls, and Advanced ends with "Ballad Falls 1.0" (Diagnostics' first line is
   `version: 1.0`). Workers Builds deploys `main` there by itself; this cloud
   session couldn't reach the address to look (its proxy refuses it).
2. **The tag:** done (2026-11-25, on the Releases page: `v1.0` on d723b80;
   its run built the unsigned APKs).
3. **The signed APK:** add the secrets once ("Your release key", above).
   Then the release workflow, run on `main` with the tag `v1.0`, signs the APK
   and attaches `balladfalls-1.0.apk` to the v1.0 release; a later tag does it
   by itself.
4. **The old address and driftloom:**
   - **The old address's Worker:** in Cloudflare, Workers & Pages, `driftloom`,
     Settings, Build: disconnect the driftloom repository and connect
     `nowmichaelclark/balladfalls`, branch `main`, root directory
     `old-address`, deploy command `npx wrangler deploy`, no build command
     (build watch paths: `old-address/*`, so only its own changes rebuild it);
     then Retry the latest build, or push. Or by hand on your computer, in a
     checkout of this repository: `cd old-address && npx wrangler login &&
     npx wrangler deploy`. Either way the Worker keeps its name and address.
   - **Check the old address:** open
     <https://driftloom.nowmichaelclark.workers.dev/#c=ELAAAAAF_DHAbt>: it
     lands on balladfalls.com with that loop. `curl -sI
     https://driftloom.nowmichaelclark.workers.dev/any/path?x=1` says `301`
     and `location: https://balladfalls.com/any/path?x=1`. Then open the app
     you installed from the old address on your phone: it says "Driftloom is
     Ballad Falls now" and offers your Library; Bring it, and your loops and
     albums are at balladfalls.com (install the app again from there, then
     remove the old one). If a tester ever wants the offer again,
     <https://driftloom.nowmichaelclark.workers.dev/library> makes it.
   - **Archive driftloom on GitHub:** its Settings, General, Danger Zone,
     Archive this repository. It stays online, read-only, with its PRs.
5. **F-Droid:** "Submit to F-Droid after 31", under Accounts, with this
   repository's address and the `v1.0` tag. Testers with a test APK (the
   working id) keep it apart: Ballad Falls from F-Droid is a new app; a backup
   moves their Library.
6. **Once the listing is up:** `APP_LINK` in `js/main.js` (step 5 of the
   F-Droid steps).
