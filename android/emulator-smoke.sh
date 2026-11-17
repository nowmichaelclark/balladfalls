#!/bin/sh
# Installs an APK on a headless emulator and runs the smoke test on it
# (android/smoke.mjs): the app starts, its page loads, Play is pressed, and
# Diagnostics shows the core's player. What CI's `smoke` job runs; it runs on
# any Linux machine with KVM, the Android SDK and Node 22.
#
#   android/emulator-smoke.sh path/to/app-debug.apk [screenshot.png]
#
# The emulator is emulator-lib.sh's, with no audio (the page's worklet needs
# none to play).

set -eu

apk=${1:?usage: android/emulator-smoke.sh APK [SCREENSHOT]}
shot=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
. "$here/emulator-lib.sh"
boot_emulator -no-audio

adb install -r "$apk"
set -- node "$here/smoke.mjs"
[ -n "$shot" ] && set -- "$@" --shot "$shot"
"$@"
