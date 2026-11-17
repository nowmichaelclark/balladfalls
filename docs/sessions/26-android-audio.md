# Session 26: the Android app: the core native, on Android's own audio (107b)

**Left (the first session 26, 2026-11-17, stopped at its usage limit):** the
work is written and pushed on `claude/s26-android-audio-1a3c98`, draft PR
#411 (android/native: the engine, the lock-free queue, AAudio, JNI; the
Kotlin bridge, the debug screen "Native audio test", the instrumented tests;
the workflow's Rust, NDK r28c and `native` emulator job). Host tests pass
(golden hashes through the engine's path, the web's stereo 48 kHz line,
nothing allocated in `fill`); clippy pedantic clean for aarch64-linux-android
and the host. Not yet seen: CI's `android` run on #411 (the first ever build
with the NDK and the emulator with audio). Still to do:
1. Read #411's `android` run; fix what fails (likely spots: AGP's
   `androidComponents.sdkComponents.ndkDirectory`, the emulator's audio with
   PulseAudio's null sink, underruns on the emulator's stream).
2. Take the yardsticks from the run's summary (underruns over five minutes,
   late notes, the busiest and mean callback share, the APK and library size
   per ABI) into the PR body; merge the latest `main` in, CI green, merge.
3. DONE.md's line, the queue's status line, this row ticked in
   `docs/sessions/README.md`, and `docs/notes/for-mikey.md`'s line: the
   universal APK from #411's artifacts on the Moto and the tablet, open
   "Native audio test", press "Play the test", five minutes, send back
   Underruns and Busiest block (and "Check the samples" if it says DIFFERS).
Then delete this list.

**Changed by brain B-parallel (2026-11-17):** the chains (`README.md`, "From 17 on"): "Start after" unchanged after 25; 22 is no longer named (Android doesn't read the codes), and what may run beside it is new.

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 25. It may run alongside 17, 18, 20, 21, 22, 23 and 24: it changes `android/` and its workflow.
- **Queue item:** item 107.

Paste everything in the block as the session's first message.

````text
Hands session 26 on the road to Driftloom's 1.0 (Opus 5.5, high): the Android app: the core native, on Android's own audio (107b).

Read first: AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, item 107); docs/CORE.md ("the platforms"; promises 1, 2 and 4); docs/DECISIONS.md ("Platforms and games"); docs/PAINTER.md ("Platforms"); core/AGENTS.md; core/README.md (how a host drives the core; the C API); core/include/dlcore.h; core/examples/c/seed.c; session 25's PR.

Check your place: in docs/sessions/README.md every row above session 26 should be ticked, apart from rows the table says may run meanwhile. If one is not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

The work, one PR: the core plays natively on Android, with no page involved yet. The page's side is session 27's.

- The core built for Android's ABIs (arm64-v8a, armeabi-v7a, x86_64 for the emulator) from the same source, in CI, by cargo with the NDK (cargo-ndk or plain cargo with the NDK's linkers; pinned versions; nothing prebuilt in the repo). The core stays no_std with no dependencies; a small separate crate (android/native/, its own Cargo.toml) holds what Android needs.
- Audio out through AAudio (directly through the NDK's C API from that crate, or Oboe: choose by what F-Droid can build from source reproducibly, and say why), a low-latency stream at the device's rate with a real-time callback at high priority that calls the player's render, nothing allocated or locked in the callback (promise 2), the stream reopened when the device changes (headphones in and out).
- A thin JNI layer: start and stop the stream, load a seed with a request, play, pause, next, volume, and read the player's counts (late, missed, dropped) and the stream's underruns. Commands reach the audio thread without locks (a small lock-free queue, as a worklet's messages do).
- A debug screen or instrumented test that plays a seed natively.

Yardsticks: on the CI emulator, a seed plays for five minutes natively with zero underruns reported by AAudio and zero late notes; the samples the native player makes for a golden seed hash to the same value as the wasm's (a test that renders offline through the same JNI path); the callback's time per block as a share of its deadline (measured on the emulator, said to be only that); the APK's size per ABI. In for-mikey.md: the APK from this PR to install on the Moto and the tablet, the debug screen to open, and the two numbers to send back (underruns, the busiest block).

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current, tick session 26's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to listen for or check, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
