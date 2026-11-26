#!/bin/sh
# The core, native, on a headless emulator:
# installs the app and its instrumented tests and runs them
# (app/src/androidTest/kotlin/app/loops/NativeCoreTest.kt): the golden loop's
# samples (and the web's line, if given) rendered through the JNI, a device
# change, and five minutes of a seed on an AAudio stream with no underrun and
# nothing late. What CI's `native` job runs.
#
#   android/emulator-native.sh APP.apk TEST.apk [SUMMARY.md]
#
# WASM_LINE, if set, is a line tools/player-wasm.mjs printed (the web's
# module), held to the native render too. SECONDS_PLAYED (300) is how long
# the play test plays. SUMMARY, if given, gets the figures as Markdown.
#
# The emulator plays into the host's sound server: run one first (CI starts
# PulseAudio with a null sink, which takes the samples at the real rate).

set -eu

apk=${1:?usage: android/emulator-native.sh APP.apk TEST.apk [SUMMARY.md]}
test_apk=${2:?usage: android/emulator-native.sh APP.apk TEST.apk [SUMMARY.md]}
summary=${3:-}
here=$(cd "$(dirname "$0")" && pwd)
. "$here/emulator-lib.sh"
boot_emulator

id=$(sed -n 's/^driftloom\.applicationId=//p' "$here/gradle.properties")
adb install -r "$apk"
adb install -r "$test_apk"
echo "audio: $(adb shell dumpsys media.audio_flinger 2>/dev/null | grep -m3 -iE 'output thread|sample rate|hal frame' | tr -d '\r' | tr '\n' ';')"

out=$(mktemp)
wasm=$(printf '%s' "${WASM_LINE:-}" | tr ' ' '_')
set -- -e seconds "${SECONDS_PLAYED:-300}"
[ -n "$wasm" ] && set -- "$@" -e wasm "$wasm"
adb shell am instrument -w -r "$@" "$id.test/androidx.test.runner.AndroidJUnitRunner" | tr -d '\r' | tee "$out"

# The figures the tests reported (INSTRUMENTATION_STATUS: key=value).
figure() { sed -n "s/^INSTRUMENTATION_STATUS: $1=//p" "$out" | tail -1; }
if [ -n "$summary" ]; then
  {
    echo "### The core, native, on the emulator"
    echo
    echo "- golden line: \`$(figure line0)\`"
    [ -n "$wasm" ] && echo "- the web's line, rendered natively: \`$(figure line1)\`"
    echo "- a device change: \`$(figure reopen)\`"
    echo "- five minutes: underruns $(figure underruns), busiest callback $(figure busiest) of its deadline, mean $(figure mean) (an emulator's: it says nothing about a phone)"
    echo "- all of it: \`$(figure played)\`"
  } >>"$summary"
fi
grep -q '^OK (' "$out" || { echo "the native tests failed" >&2; exit 1; }
