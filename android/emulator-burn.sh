#!/bin/sh
# The "lighter on processor" rule on the native core, measured on a headless
# emulator (step 6): android/burn.mjs's sweep of a slower phone
# (`?burn=`). What CI's `burn` job runs, by hand only (only=burn). The
# emulator plays into the host's sound server (CI's is a null sink).
#
#   android/emulator-burn.sh path/to/app-debug.apk [SUMMARY.md] [burn.mjs's flags...]

set -eu

apk=${1:?usage: android/emulator-burn.sh APK [SUMMARY] [FLAGS...]}
summary=${2:-}
shift
[ $# -gt 0 ] && shift
here=$(cd "$(dirname "$0")" && pwd)
. "$here/emulator-lib.sh"
boot_emulator

adb install -r "$apk"
if [ -n "$summary" ]; then
  node "$here/burn.mjs" --summary "$summary" "$@"
else
  node "$here/burn.mjs" "$@"
fi
