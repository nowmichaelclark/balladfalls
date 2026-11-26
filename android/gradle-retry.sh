#!/bin/sh
# Gradle, as CI runs it: the download retried longer, and the whole build run
# again up to twice. Maven Central and Google's repository now and then refuse
# a plugin to a busy runner (the Kotlin Gradle plugin, four times in a day on
# 2026-11-22: "plugin not found" after 20 s); a real failure fails three times,
# the same way. Run it from android/, with Gradle's own arguments:
#
#   sh gradle-retry.sh assembleDebug -Pdriftloom.versionCode=7
#
# GRADLE_RETRY_WAIT is the pause between attempts in seconds (default 30).
for attempt in 1 2 3; do
  ./gradlew --no-daemon --console=plain \
    -Dorg.gradle.internal.repository.max.retries=8 -Dorg.gradle.internal.repository.initial.backoff=2000 \
    "$@" && exit 0
  [ "$attempt" = 3 ] && exit 1
  echo "attempt $attempt failed; again in ${GRADLE_RETRY_WAIT:-30} s"
  sleep "${GRADLE_RETRY_WAIT:-30}"
done
