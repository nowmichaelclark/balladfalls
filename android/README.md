# Driftloom for Android

Queue item 107. This folder is the Android app: one activity, one WebView,
the page's own files inside the APK, served to it from a local origin, and the
core built natively for Android's own audio. Session 25 (107a) made the shell
and its CI build; session 26 (107b) the core native on AAudio, with a debug
screen and tests but no page yet; the page talking to it is session 27, the
background service and exports 28, F-Droid's metadata 29 (`docs/sessions/`).

## What is here

- `app/src/main/kotlin/app/loops/MainActivity.kt`: the WebView. No network
  (`blockNetworkLoads`, no permission in the manifest), no Safe Browsing, no
  metrics; a link out of the app opens in the listener's browser.
- `.../BundledSite.kt`: the `WebViewAssetLoader` handler, with each file's
  type spelled out (a module must be `text/javascript`, a `.wasm`
  `application/wasm`). The origin is `https://appassets.androidplatform.net/`;
  the page's saved loops live under it, so it never changes.
- `app/build.gradle.kts`: the `bundleApp` task copies the app's files into the
  APK from the repo root, taking the list from `sw.js`'s `FILES` (the one list;
  nothing is committed twice). A file the page needs goes into `sw.js` as ever.
  `speed.html` and `rank.html` are not on it, so they are not in the app.
- `native/`: the core for Android (session 26), a small crate of its own over
  `core/` (a path dependency: the core stays `no_std` with no dependencies):
  `src/engine.rs` (the core and its player, the lock-free queue the commands
  come by, and `fill`, the audio thread's one call), `src/aaudio.rs` (the
  stream), `src/jni.rs` (five JVM calls, by hand), `src/lib.rs` (the bridge).
  `build.sh` builds `libdriftloom.so` for each ABI; `abi-check.c` holds the
  numbers written by hand there to the NDK's own headers at every build.
- `app/src/main/kotlin/app/loops/NativeCore.kt`: the bridge's Kotlin side
  (start and stop the stream, load a seed with a request, play, pause, next,
  volume, the counts, an offline render).
- `app/src/debug/`: the **Native audio test**, a second launcher icon in debug
  builds only (`NativeTestActivity.kt`): "Play the test" plays the golden loop
  natively and shows underruns, the busiest callback against its deadline, and
  late notes; "Check the samples" renders it offline and says whether its hash
  is the web's.
- `app/src/androidTest/`: the instrumented tests (`NativeCoreTest.kt`): the
  samples against the golden line and js/dlplayer.wasm's, a device change, and
  five minutes of play with no underrun and nothing late.
- `smoke.mjs`, `emulator-smoke.sh`: the smoke test. `emulator-native.sh`: the
  instrumented tests on an emulator with audio. `emulator-lib.sh`: the boot
  both share. `check-tree.sh`: no
  binary in the tree but the Gradle wrapper's jar, which is checked against
  Gradle's published checksum. `test-signing/`: the test builds' key.

## Build

```bash
cd android && ./gradlew assembleDebug   # app/build/outputs/apk/debug/driftloom-*-debug.apk
```

One APK for each ABI (arm64-v8a for phones, armeabi-v7a for older 32-bit
ones, x86_64 for the emulator) and `driftloom-universal-debug.apk` with all
three. `-Pdriftloom.abis=x86_64` builds one ABI, quicker.

Needs JDK 17 or newer and the Android SDK (`ANDROID_HOME`, or `sdk.dir` in
`android/local.properties`): platform 36, build-tools 36.0.0 and the NDK that
`driftloom.ndkVersion` names (28.2.13676358, r28c); and Rust through rustup
(`android/native/rust-toolchain.toml` pins the core's 1.99.0 with Android's
three targets, which rustup fetches). The `buildNative` task runs
`native/build.sh`, so a clean checkout builds everything from source. The Gradle
wrapper pins Gradle 8.14.3 by checksum. Android Gradle Plugin 8.13.2, Kotlin
2.3.21, and one library, `androidx.webkit` (Apache-2.0, Google's Maven), which
is `WebViewAssetLoader`. No Google services, no other repository.

`cd android/native && cargo test` runs the native crate's own tests on a
computer (the queue, the engine's path against the golden hashes, nothing
allocated in `fill`); `DL_WASM_LINE` adds a line from `tools/player-wasm.mjs`.

`node android/smoke.mjs --cdp URL` runs the smoke test against any DevTools
endpoint (how it was tried on desktop Chromium); `android/emulator-smoke.sh
APK` boots an AOSP emulator (needs KVM) and runs it on that.

## The rename (session 31a): one line each

1. The id: `driftloom.applicationId` in `gradle.properties`.
2. The name: `driftloom.appName` in `gradle.properties` (the APK's file name).
3. The launcher label: `app_name` in `app/src/main/res/values/strings.xml`.

The Kotlin package (`app.loops`, the `namespace`) is not the id and stays.

## Choices

- **Min SDK 27** (Android 8.1). AAudio, the native audio path (26), arrived in
  API 26 but is only dependable from 27, which is where Oboe itself starts
  using it; and a WebView current enough for the page's modules, worklet and
  WebAssembly runs on 8.1 and up. Target and compile SDK 36.
- **Test builds are debug builds with a shared throwaway key**
  (`test-signing/README.md`), so each installs over the last (CI numbers them
  by run) and the app can be inspected over USB. The release gets another key.
- **AAudio directly, not Oboe** (session 26). Oboe is C++ over AAudio (and
  OpenSL ES below 8.1): CMake, the NDK's C++ library, and its source vendored
  as a submodule or Google's prebuilt package, which F-Droid would not take.
  AAudio is part of the system from 8.0, the NDK carries its header and stub,
  and the app uses a couple of dozen of its calls; Oboe's fallback below 8.1
  the app's floor doesn't need, and its reopening on a device change is a few
  lines in `native/src/aaudio.rs`. So the native side is Rust and the NDK's
  linker, nothing else.
- **The stream:** float, stereo, the device's own rate, the low-latency mode
  (the fast path, its callback thread at real-time priority where the system
  grants it: the debug screen shows what it got), shared with other apps
  (exclusive is lower latency and more often trouble; the conservative
  choice), AAudio's own buffer size. A device change (headphones in or out)
  closes the stream and opens another at the same rate; the loop plays on.
- **Nothing allocated or locked in the callback** (`docs/CORE.md`, promise 2):
  the commands come by a lock-free queue of fixed slots, the counts go back
  in atomics and the name by a sequence lock; `fill_allocates_nothing` counts
  allocations inside it over half a minute of callbacks with a load, a Next, a
  pause and a play.
- **One engine a process**, made at the first start at the device's rate and
  kept: the stream stops and starts around it. The page drives it from
  session 27.
- **For now the page plays as in a browser** (its own worklet in the WebView).
  Its `sw.js` is not in the app, so Diagnostics says `sw: failed` there: noise
  to be silenced when the page next changes (session 27).
- **Not yet:** the screen off and a notification (28), saving an export and the
  restore file picker (28), the system bars' color following the page's theme
  (a Painter's choice), the launcher icon (a placeholder in plain vectors).
