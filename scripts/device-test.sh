#!/usr/bin/env bash
# Runs inside the Android emulator job (.github/workflows/device-test.yml):
# installs the built APK, seeds a signed-up person, puts a food photo in the
# gallery and drives the app with Maestro the way a person would.
set -uo pipefail
PKG=com.mystyle.app
OUT=device-test
mkdir -p "$OUT"
export PATH="$HOME/.maestro/bin:$PATH"

# What is on the screen, as text: the log is readable where screenshots are not.
ui() {
  echo "── screen: $1"
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  adb shell cat /sdcard/ui.xml 2>/dev/null | grep -oE '(text|content-desc)="[^"]+"' | sed -E 's/^[a-z-]+="(.*)"$/  \1/' | awk '!seen[$0]++' | head -60
}

adb wait-for-device
# The APK carries arm64 code only (what phones run); the emulator is x86_64
# with ARM translation, so the app is installed as an ARM app explicitly.
adb install -r --abi arm64-v8a apex.apk || exit 1
# A slow emulator boot can leave a "launcher isn't responding" dialog up.
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null 2>&1 || true
adb logcat -c

# First launch creates the app's storage; then it is closed and seeded.
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 40
adb exec-out screencap -p > "$OUT/00-first-launch.png"
ui "first launch"
echo "app running: $(adb shell pidof "$PKG" | tr -d '\r')"
adb shell am force-stop "$PKG"

adb root > /dev/null; sleep 3; adb wait-for-device
DB="/data/data/$PKG/databases/RKStorage"
node scripts/device-seed.mjs > seed.sql
adb push seed.sql /data/local/tmp/seed.sql > /dev/null
echo "root: $(adb shell whoami | tr -d '\r')"
adb shell ls -la "/data/data/$PKG" "/data/data/$PKG/databases" 2>&1 | head -30
adb shell mkdir -p "/data/data/$PKG/databases"
adb shell "sqlite3 $DB < /data/local/tmp/seed.sql" || exit 1
OWNER=$(adb shell stat -c %u:%g "/data/data/$PKG" | tr -d '\r')
adb shell chown -R "$OWNER" "/data/data/$PKG/databases"
adb shell restorecon -R "/data/data/$PKG/databases"
echo "seeded: $(adb shell "sqlite3 $DB 'select key from catalystLocalStorage'" | tr '\r\n' '  ')"

# A food photo in the gallery, as if the person had taken it — camera-sized
# (12 MP), because a small picture never shows what a real photo costs.
[ -f shakshuka.jpg ] || cp assets/meals/shakshuka.jpg shakshuka.jpg
ls -la shakshuka.jpg
adb push shakshuka.jpg /sdcard/Pictures/shakshuka.jpg > /dev/null
adb shell pm grant "$PKG" android.permission.CAMERA > /dev/null 2>&1 || true
adb shell content call --uri content://media --method scan_volume --arg external_primary > /dev/null 2>&1 || true
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/shakshuka.jpg > /dev/null 2>&1 || true
sleep 3

status=0
maestro test --format junit --output "$OUT/report.xml" --debug-output "$OUT/maestro" e2e/device/scan.yaml || status=1
adb exec-out screencap -p > "$OUT/scan-end.png"
ui "after the scan flow"
adb logcat -d | grep -E "ReactNativeJS" | tail -20
maestro test --debug-output "$OUT/maestro-book" e2e/device/book.yaml || status=1
adb exec-out screencap -p > "$OUT/book-end.png"
sleep 8
adb exec-out screencap -p > "$OUT/book-end-later.png"
ui "after the book flow"

# Over-the-air: give the app a minute with the network, then look at what it
# runs. The log says what expo-updates did; the profile screen says whether
# the running code came from the APK or from an update.
sleep 60
maestro test --debug-output "$OUT/maestro-update" e2e/device/update.yaml || status=1
ui "version and updates"
echo "── expo-updates log"
adb logcat -d | grep -E "dev\.expo\.updates" | grep -vE "embeddedAssetFileMap" | tail -40

# Older installs have no native image resizer: the same scan, read the way
# those phones read it — the JPEG at 1/8 size in JavaScript, no crash.
adb shell am force-stop "$PKG"
adb shell "sqlite3 $DB \"INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('mystyle.debug.legacyScan', '1');\""
adb shell chown -R "$OWNER" "/data/data/$PKG/databases"
adb shell restorecon -R "/data/data/$PKG/databases"
maestro test --debug-output "$OUT/maestro-legacy" e2e/device/scan-legacy.yaml || status=1
adb exec-out screencap -p > "$OUT/legacy-end.png"
ui "after the older-install scan"
adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime|FATAL|lowmemorykiller" | tail -20

# Photos that are not food: a 48 MP landscape, then a PNG screenshot. Neither
# may close the app; both must say "not sure this is food".
adb shell am force-stop "$PKG"
adb shell "sqlite3 $DB \"DELETE FROM catalystLocalStorage WHERE key = 'mystyle.debug.legacyScan';\""
adb shell chown -R "$OWNER" "/data/data/$PKG/databases"
adb shell restorecon -R "/data/data/$PKG/databases"
if [ -f nonfood.jpg ]; then
  adb push nonfood.jpg /sdcard/Pictures/zz-landscape.jpg > /dev/null
  adb shell content call --uri content://media --method scan_volume --arg external_primary > /dev/null 2>&1 || true
  sleep 3
  maestro test -e SHOT=13-nonfood-48mp --debug-output "$OUT/maestro-nonfood" e2e/device/scan-odd.yaml || status=1
  ui "after the 48 MP non-food photo"
fi
adb exec-out screencap -p > screenshot.png
adb push screenshot.png /sdcard/Pictures/zz-screenshot.png > /dev/null
adb shell content call --uri content://media --method scan_volume --arg external_primary > /dev/null 2>&1 || true
sleep 3
maestro test -e SHOT=14-png-screenshot --debug-output "$OUT/maestro-png" e2e/device/scan-odd.yaml || status=1
ui "after the PNG screenshot"
echo "app still running: $(adb shell pidof "$PKG" | tr -d '\r')"

# The camera, with Android closing the app behind it (low memory): the app
# must come back to the scanner with the photo, not restart on Today.
adb shell am force-stop "$PKG"
adb shell "sqlite3 $DB \"DELETE FROM catalystLocalStorage WHERE key = 'mystyle.debug.legacyScan';\""
maestro test --debug-output "$OUT/maestro-camera" e2e/device/camera-open.yaml || status=1
echo "app before the kill: $(adb shell pidof "$PKG" | tr -d '\r')"
adb shell am kill "$PKG"
sleep 2
if [ -n "$(adb shell pidof "$PKG" | tr -d '\r')" ]; then adb shell "kill -9 \$(pidof $PKG)"; sleep 2; fi
echo "app after the kill: '$(adb shell pidof "$PKG" | tr -d '\r')' (empty = killed)"
maestro test --debug-output "$OUT/maestro-camera2" e2e/device/camera-take.yaml || status=1
adb exec-out screencap -p > "$OUT/camera-end.png"
ui "after the camera was interrupted"

# Maestro saves takeScreenshot paths next to the flow files.
find e2e/device "$OUT" "$HOME/.maestro" -name '[0-9][0-9]-*.png' -not -path "$OUT/[0-9][0-9]-*" -exec cp {} "$OUT/" \; 2>/dev/null || true
ls "$OUT"
adb logcat -d > "$OUT/logcat.txt"
grep -E "ReactNativeJS|AndroidRuntime" "$OUT/logcat.txt" | tail -40
if grep -E "FATAL EXCEPTION|ReactNativeJS.*(Error|TypeError)" "$OUT/logcat.txt" | grep -i "$PKG\|ReactNativeJS" > "$OUT/errors.txt"; then
  echo "::warning::errors in logcat:"; head -40 "$OUT/errors.txt"
fi
grep -iE "tflite|litert|tensorflow" "$OUT/logcat.txt" | head -20
exit $status
