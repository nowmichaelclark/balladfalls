#!/bin/sh
# Installs an APK on a headless emulator and runs the smoke test on it
# (android/smoke.mjs): the app starts, its page loads, Play is pressed, and
# Diagnostics shows the core's player playing natively; the page's main
# thread blocked for five seconds, and the music plays on. What CI's `smoke`
# job runs; it runs on any Linux machine with KVM, the Android SDK and Node 22.
#
#   android/emulator-smoke.sh path/to/app-debug.apk [screenshot.png]
#
# The emulator is emulator-lib.sh's, with its audio into the host's sound
# server (CI's is a null sink): since session 27 the page plays on the core's
# native stream, which needs a device to play to.

set -eu

apk=${1:?usage: android/emulator-smoke.sh APK [SCREENSHOT]}
shot=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
. "$here/emulator-lib.sh"
boot_emulator

adb install -r "$apk"
set -- node "$here/smoke.mjs"
[ -n "$shot" ] && set -- "$@" --shot "$shot"
"$@"
