#!/bin/sh
# Installs an APK on a headless emulator and runs tools/rows.mjs against the
# app: every row of the controls table that makes
# sense there, the page driving the native core, and the app's own rows
# (`tools/rows.mjs --app`). What CI's `rows` job runs.
#
#   android/emulator-rows.sh path/to/app-debug.apk [rows.mjs's flags...]
#
# The emulator plays into the host's sound server (CI's is a null sink).

set -eu

apk=${1:?usage: android/emulator-rows.sh APK [FLAGS...]}
shift
here=$(cd "$(dirname "$0")" && pwd)
. "$here/emulator-lib.sh"
boot_emulator

adb install -r "$apk"
node "$here/../tools/rows.mjs" --app "$@"
