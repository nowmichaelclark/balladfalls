# Ballad Falls for Android

This folder is the Android app. It is one activity with one WebView. The
page's own files are inside the APK, and the app serves them to the WebView
from a local origin. The core is built natively and plays through Android's
own audio, so the WebView plays no audio of its own.

## How it works

1. `MainActivity` shows the page in a WebView, from the files in the APK.
2. The page talks to the native core through a bridge (`PageBridge`). It
   sends the same messages that it sends to the worklet in a browser.
3. The native core (`native/`) plays the music through AAudio, Android's
   native audio interface.
4. A foreground service (`PlaybackService`) keeps the music on with the
   screen off, and shows the notification and the lock screen controls.

## What is here

### The app (`app/src/main/kotlin/app/loops/`)

- `MainActivity.kt`: the WebView. It has no network (`blockNetworkLoads`,
  and no network permission in the manifest), no Safe Browsing and no
  metrics. A link out of the app opens in the listener's browser.
- `BundledSite.kt`: the `WebViewAssetLoader` handler. It names each file's
  type (a module must be `text/javascript`, and a `.wasm` file
  `application/wasm`). The origin is `https://appassets.androidplatform.net/`.
  The page's saved loops live under this origin, so it must never change.
- `NativeCore.kt`: the Kotlin side of the bridge. It starts and stops the
  stream, loads a seed with a request, plays, pauses, goes to the next loop,
  sets the volume, reads the counts and makes an offline render. It also has
  the page's `send`, `drain` and `pageGone`.
- `PageBridge.kt`: puts `DriftloomNative` in the page (a WebView message
  listener for the app's origin). It carries text both ways on a thread of
  its own: each message from the page goes to the core's bridge, and every
  25 ms the reports that are due come back. `js/native.js` is the page's end.
- `Playback.kt`: what the page told the app (what plays, the loop's name and
  cover, a file that is being saved). Its `StreamKeeper` keeps the native
  stream on only while something needs it: playing, the ring-out after a
  pause, or a message to the core.
- `PlaybackService.kt`: the foreground service, with:
  - its notification and the `MediaSession` (play, pause, next, previous; the
    loop's name and cover);
  - audio focus, and a pause when the headphones come out;
  - a partial wake lock, held only while the app plays or saves.

  A button's action goes to the page, which does what its own button does.
  If there is no page, the service stops.
- `AppBridge.kt` (the page's `DriftloomApp`; `js/app.js` is its end): the
  page's media state and cover, Android's file picker for a save
  (`SaveFile.kt`, which writes as the file is made, with free space from
  `fstatvfs`), the picker for a restore file, and the one notification
  question.
- `app/build.gradle.kts`: its `bundleApp` task copies the app's files into
  the APK from the repository root. It takes the list from `FILES` in
  `sw.js`, so there is only one list. If the page needs a new file, add it to
  `sw.js`. `speed.html` and `rank.html` are not on the list, so they are not
  in the app.

### The native core (`native/`)

A small crate over `core/` (a path dependency, so the core stays `no_std`
with no dependencies):

- `src/engine.rs`: the core and its player, the lock-free queue that the
  commands come through, the queue that the reports go back through, and
  `fill`, the audio thread's one call.
- `src/bridge.rs`: turns the page's messages into commands, and the reports
  into the worklet's messages. `src/json.rs` reads them.
- `src/aaudio.rs`: the audio stream.
- `src/jni.rs`: five JVM calls, written by hand.
- `src/watch.rs`: what a phone can report about a crackle, for Diagnostics.
- `src/lib.rs`: the bridge's functions.
- `build.sh`: builds `libdriftloom.so` for each ABI. `abi-check.c` checks the
  numbers written by hand there against the NDK's own headers at each build.

### Tests and tools

- `app/src/debug/`: the **Native audio test**, a second launcher icon in
  debug builds only (`NativeTestActivity.kt`). "Play the test" plays the
  golden loop natively, and shows underruns, the busiest callback against
  its deadline, and late notes. "Check the samples" renders it offline and
  says if its hash matches the web's.
- `app/src/androidTest/`: the instrumented tests (`NativeCoreTest.kt`): the
  samples against the golden line and `js/dlplayer.wasm`'s, a device change,
  and five minutes of play with no underrun and nothing late.
- `smoke.mjs`, `emulator-smoke.sh`: the smoke test. The page plays on the
  native core, and the music plays on while the page's main thread is
  blocked for 5 s.
- `emulator-rows.sh`: `tools/rows.mjs --app`, every row of the controls
  table that applies in the app.
- `background.mjs`, `emulator-background.sh`: the screen-off test (CI's
  `background` job). The debug build's `CallSimulator` stands in for a phone
  call. The test presses Play after two minutes paused with the screen off.
- `burn.mjs`, `emulator-burn.sh`: the Lite rule on the native core, on a
  slower phone made with `?burn=` (CI's `burn` job, run by hand only:
  `only=burn`).
- `cdp.mjs`: the WebView's DevTools client that the tests use. It finds the
  app's process and page again at each connect.
- `emulator-native.sh`: the instrumented tests on an emulator with audio.
  `emulator-lib.sh`: the boot that the emulator scripts share.
- `check-tree.sh`: checks that the tree holds no binary except the Gradle
  wrapper's jar, and checks that jar against Gradle's published checksum.
- `test-signing/`: the key for test builds.
- `fdroid/`: everything that F-Droid needs, and that CI's `fdroid` workflow
  runs (see "F-Droid" below). `emulator-release.sh` plays a release APK on an
  emulator. `screenshots.mjs` and `emulator-screenshots.sh` take the
  listing's screenshots. `../fastlane/` holds the listing itself.

## Build

```bash
cd android && ./gradlew assembleDebug   # app/build/outputs/apk/debug/balladfalls-*-debug.apk
```

This makes one APK for each ABI (arm64-v8a for phones, armeabi-v7a for older
32-bit phones, x86_64 for the emulator), and `balladfalls-universal-debug.apk`
with all three. To build one ABI, which is quicker, add
`-Pdriftloom.abis=x86_64`.

You need:

- JDK 17 or newer;
- the Android SDK (`ANDROID_HOME`, or `sdk.dir` in
  `android/local.properties`): platform 36, build-tools 36.0.0, and the NDK
  that `driftloom.ndkVersion` names (28.2.13676358, r28c);
- Rust through rustup. `android/native/rust-toolchain.toml` pins the core's
  1.99.0 with Android's three targets, and rustup gets them.

The `buildNative` task runs `native/build.sh`, so a clean checkout builds
everything from source. The Gradle wrapper pins Gradle 8.14.3 by checksum.
The build uses Android Gradle Plugin 8.13.2, Kotlin 2.3.21, and one library:
`androidx.webkit` (Apache-2.0, from Google's Maven), for
`WebViewAssetLoader`. There are no Google services and no other repository.

To test:

- `cd android/native && cargo test` runs the native crate's own tests on a
  computer: the queue, the engine against the golden hashes, and no
  allocation in `fill`. `DL_WASM_LINE` adds a line from
  `tools/player-wasm.mjs`.
- `node android/smoke.mjs --cdp URL` runs the smoke test against any
  DevTools endpoint, also on desktop Chromium.
- `android/emulator-smoke.sh APK` boots an AOSP emulator (it needs KVM) and
  runs the smoke test there. `android/emulator-rows.sh APK --long` does the
  same for the rows. Both need a sound server for the emulator (CI uses
  PulseAudio with a null sink).
- The workflow's `smoke_runs` input (run by hand) boots that many emulators
  for the smoke test at once.

## The ids and the name

1. **The test builds' id:** `driftloom.applicationId` in `gradle.properties`
   (`io.github.nowmichaelclark.driftloom`). Debug builds and CI's emulator
   tests use it.
2. **The release's id:** `driftloom.releaseApplicationId`
   (`com.balladfalls.app`). Only release builds use it (`app/build.gradle.kts`,
   `androidComponents`). F-Droid's recipe and `fdroid/check-apk.sh` read it.
   So a test build and the release can be installed side by side.
3. **The file name:** `driftloom.appName`, in lowercase with no spaces
   (`balladfalls-universal-release-unsigned.apk`).
4. **The launcher label** and the lock screen's album: `app_name` in
   `app/src/main/res/values/strings.xml`.

The Kotlin package (`app.loops`), the native library (`libdriftloom.so`) and
the `driftloom.*` property names are identifiers, not the app's name. They
stay as they are.

## Choices

- **Min SDK 27** (Android 8.1). AAudio came in API 26, but it is dependable
  only from 27, which is also where Oboe starts to use it. A WebView that is
  new enough for the page's modules, worklet and WebAssembly runs on 8.1 and
  up. The target and compile SDK are 36.
- **Test builds are debug builds with a shared throwaway key**
  (`test-signing/README.md`). So each test build installs over the last (CI
  numbers them by run), and you can inspect the app over USB. The release
  has another key.
- **AAudio directly, not Oboe.** Oboe is C++ over AAudio. It needs CMake,
  the NDK's C++ library, and its source as a submodule or Google's prebuilt
  package, which F-Droid does not accept. AAudio is part of the system from
  Android 8.0, the NDK has its header, and the app uses about two dozen of
  its calls. The app does not need Oboe's fallback below 8.1, and reopening
  the stream on a device change is a few lines in `native/src/aaudio.rs`. So
  the native side is only Rust and the NDK's linker.
- **The stream** is float, stereo, at the device's own rate, in the
  power-saving mode (Android's deep buffer, the path for music players), with
  callbacks of 1,024 frames. This is what Chrome opens for the site's
  `latencyHint: 'playback'`. The stream is shared with other apps, because
  exclusive mode has lower latency but more trouble. Diagnostics shows what
  the system gave, and AAudio's buffer size. The low-latency path (192 frames
  a callback on the moto g) crackled: `docs/notes/115-crackles.md`. A device
  change (headphones in or out) closes the stream and opens another at the
  same rate, and the loop plays on.
- **Nothing allocates or locks in the callback** (`docs/CORE.md`, promise 2).
  The commands come through a lock-free queue of fixed slots, the counts go
  back in atomics, and the name goes back through a sequence lock. The test
  `fill_allocates_nothing` counts allocations in the callback over half a
  minute, with a load, a Next, a pause and a play.
- **One engine for each process.** The app makes it at the first start, at
  the device's rate, and keeps it. The stream stops and starts around it.
- **The page on the native core: one path, two transports.** `CoreHost` in
  `js/core.js` posts the same messages that it posts to the worklet, starting
  with `init` (the quality and the layout). It gets the worklet's messages
  back, batched in the same way: events every 50 ms, or at once for an event
  that is not a step, and the cost every two seconds of audio.
  - The page's audio context is a stand-in on the core's clock
    (`js/native.js`).
  - The page still reads a loop's record and notes from its own module
    (`js/gen.js`), which plays no audio.
  - A new `init` lets every voice go and builds the mix again at its
    quality, on the same engine. So the switch to or from Lite works as in
    the browser: the old sound fades, and the new one takes the loop from
    its top.
  - The bridge reads its text on the app's bridge thread, never on the audio
    thread. Commands and reports cross as fixed slots, so `fill` still
    allocates nothing.
  - The "too slow" line cannot show in the app.
  - A WebView older than 2020's, without the message listener, plays the page
    as a browser does.
  - The app has no service worker. Diagnostics says
    `sw: none (the app holds its own files)`.
- **The screen off.** The page's `MediaBridge` (`js/media.js`) tells the app
  what plays, and the service does the rest.
  - When paused, the app holds nothing: no wake lock, no audio focus, and
    the stream closes after an eight-second ring-out. The notification stays,
    with Play, for fifteen minutes, then goes.
  - A short loss of focus (a call) pauses, and the music comes back with the
    focus. A lasting loss pauses for good. Another app's short sound lowers
    the music (the system does that).
  - The page holds a Web Lock while it plays, so that Chromium does not put
    it on its slow timer with the screen off.
  - With music playing, Back leaves the app as Home does. A swipe from the
    recents screen stops both the app and the music.
  - The permissions are the foreground service's (media playback, data
    sync), the notification (Android 13 and later: asked once, at the first
    Play with the app in front; if refused, the music and the lock screen
    controls still work), and the wake lock. There is no network permission.
- **Saving a file.** The export's bytes go from its Worker, through the page,
  to the app, one megabyte at a time (base64 in the bridge's text; one piece
  at a time, each acknowledged). They go straight into the file that the
  listener chose in Android's picker.
  - The app writes FLAC's header again at the end. So a place that can only
    stream (a cloud folder) is refused for Lossless with a plain line. Small
    (Opus) is written front to back and goes anywhere.
  - A MIDI file and the backup use the same picker (`ui.download`).
  - An album goes as one zip through the same picker (its headers written
    again in place, so it needs a place that can seek), or as one file for
    each track into a folder chosen in Android's folder picker (`save-folder`,
    then `save-in` for each track).
- **Workers.** `shouldInterceptRequest` never serves a Worker's own requests
  (its imports, a `fetch`). On the emulator (Chromium 124), a Worker's script
  loads, and a Blob module Worker loads, but a Worker that imports a file of
  the app fails. So `js/worker-blob.js` makes the export's Worker from Blob
  URLs that the page builds. The cover Worker (`js/covers.js`) fails in the
  same way, and falls back to drawing on the main thread. Giving it the same
  loader is a later task.
- **The page while the screen is off.** If the WebView's window is not shown,
  Chromium treats the page as hidden and stops its timers for minutes. (We
  measured a 50 ms interval that last ran 3 minutes before, and the lock
  screen's buttons never reached the page.) So `AppWebView` tells the WebView
  that it is shown while the app plays or saves. The page then runs as in
  front, and the emulator shows 0% CPU for the app with the screen off.
- **The icon** comes from the one source, `icons/icon.svg`, made by
  `node tools/icons.mjs` (with the web app's icons and the listing's). The
  Android icons are vector drawables, which are text: the adaptive icon's
  background, foreground and monochrome layers (the 108 dp layer, with the
  icon in its middle 72 dp), and the notification's small icon, the
  monochrome drawing at 24 dp (`drawable/ic_stat_driftloom.xml`). The script
  checks the safe zones, and that each drawable draws what the SVG draws.
- **Not yet:** the system bars' color does not follow the page's theme (a
  choice for the Painter).

## Versions and releases

**The scheme.** A release is `major.minor` or `major.minor.patch`. Its
version code is `major * 10000 + minor * 100 + patch`: 1.0 is 10000, 1.0.1 is
10001, 1.2 is 10200, and 1.2.3 is 10203.

- Both values are in `gradle.properties`, once (`driftloom.versionName`,
  `driftloom.versionCode`).
- The tag is `v<versionName>` (`v1.0`).
- The changelog for a code is
  `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`. F-Droid
  shows it as "what's new".
- A test build's name ends in `-test`, and CI numbers its code by run, so
  each test build installs over the last.
- `fdroid/check-metadata.mjs` checks all of this. CI runs it, and the release
  workflow runs it on the tag.
- There is room for per-ABI codes later (a factor of ten, F-Droid's
  `VercodeOperation`), if the universal APK ever gets too big.

**To make a release:**

1. Change the three values (name, code, changelog), and merge.
2. Tag the merge and push the tag:

   ```sh
   git tag v1.0 && git push origin v1.0
   ```

The `android-release` workflow then:

1. checks the tag against `gradle.properties`;
2. checks that `js/dlplayer.wasm` is what `core/` builds;
3. builds the unsigned release APKs (one for each ABI, and the universal one)
   and keeps them, with their checksums, as the run's artifact;
4. signs the universal APK with the release key from the repository's
   secrets (apksigner from build-tools 34), and checks that the
   certificate's SHA-256 is the release key's;
5. attaches it to the tag's release as `balladfalls-<version>.apk`, the file
   that F-Droid's recipe names.

If you run the workflow by hand with a tag, it signs and attaches that
release again.

**The secrets** are in the repository already. Add them again only if the
key or a password changes. You need a Linux machine and GitHub's website,
and no Android tools.

1. Run `base64 -w0 ~/release.jks > ~/release-b64.txt`, then `xdg-open
   ~/release-b64.txt`. In the editor that opens, press Ctrl+A, then Ctrl+C.
2. Sign in to GitHub as the repository's owner, and open
   <https://github.com/nowmichaelclark/balladfalls/settings/secrets/actions>.
   Click **New repository secret**, name it `RELEASE_KEYSTORE_BASE64`, paste,
   and click **Add secret**.
3. Add `RELEASE_KEYSTORE_PASSWORD`: the keystore's password.
4. Add `RELEASE_KEY_ALIAS`: the word `release`.
5. Only if the key has its own password, and it is different, add
   `RELEASE_KEY_PASSWORD`.
6. Run `rm ~/release-b64.txt`. Keep `release.jks` and its backup as they are.

## F-Droid

F-Droid builds the app itself from the tagged commit, with its own tools,
and signs it. (With a reproducible build, it can publish the APK that you
signed instead.)

**Status:** the first request,
[fdroid/fdroiddata!59136](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/59136),
was closed on 2026-11-26. F-Droid wants an app maintained for more than three
months first, so a new request goes in at about the end of February 2027.
F-Droid reads the listing from the commit that it builds. So point the new
recipe at a commit of the new history that has the listing's files. The old
recipe's commit, 8b9750c, is in the old history (`docs/archived.txt`).

- **The listing** is `fastlane/metadata/android/en-US/`: the title (the
  app's name; the listing holds it only here), the short and full
  descriptions, the changelogs, the icon, the feature graphic, and the phone
  screenshots. The `screenshots` job of `android.yml` takes the screenshots
  from the app: download its artifact into `images/phoneScreenshots/`.
- **The recipe** is `fdroid/recipe.yml.in`, filled by `fdroid/render.mjs`.
  Run `node android/fdroid/render.mjs --commit <the tag's commit> --repo-url
  <the public repository's address>` to print the text of fdroiddata's
  `metadata/<id>.yml`. The id, the name and the version come from
  `gradle.properties`. `--signed-by <sha256>` adds the lines for an APK that
  you signed with your own key.
- **What F-Droid does:**
  - It builds from `android/` with Gradle's `assembleRelease` (the universal
    APK).
  - It refuses anything prebuilt, so it deletes the committed
    `js/dlplayer.wasm` before its scan and builds it again
    (`tools/build-core.sh`; `--check` proves that the bytes are the same).
  - It deletes the research archives, and a `package.json` that has no lock
    file.
  - It installs the Rust compiler that the repository pins, with rustup's
    own script (the `rustup` source library at a pinned release). The NDK is
    the pinned r28c.
- **CI tests all of it** (`.github/workflows/fdroid.yml`):
  - `check-metadata.mjs`;
  - fdroidserver's `lint` and `rewritemeta` on the recipe, in both forms;
  - the update check, which must find a new tag;
  - **the build in F-Droid's own buildserver container**
    (`build-in-container.sh`, modelled on the `fdroid build` job of
    fdroiddata's CI: `fdroid build --on-server` from a clean clone, with its
    scanner);
  - that APK on an emulator, test-signed (`emulator-release.sh`): not
    debuggable, the page loads, Play plays, and nothing crashes in logcat,
    which is what R8's renaming could break;
  - two builds compared byte for byte (`docs/notes/107-reproducible.md`).
- **Release builds are minified by R8.** They carry no Google dependency
  blob and no VCS stamp (`app/build.gradle.kts`).

## Licenses

`LICENSES.md` lists everything in the APK, with its license. The repository
is MIT. `fdroid/check-apk.sh` (in CI) fails if:

- a library is in the release but not on the list, or on the list but not in
  the APK;
- the APK asks for a permission other than the five that the manifest names
  (none of them is the network);
- the APK holds the classes of a tracker or of Google Play Services.

None of F-Droid's anti-features apply (Ads, Tracking, NonFreeNet, NonFreeDep,
NonFreeAdd, NonFreeAssets, KnownVuln).
