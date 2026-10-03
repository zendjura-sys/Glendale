#!/usr/bin/env bash
# Перевірка фонової музики на емуляторі: release-APK з GC_AUDIO_TEST_URL сам вмикає трек,
# далі згортаємо застосунок і дивимося, чи живий foreground-сервіс, медіасесія і сповіщення.
# Запускає .github/workflows/app-audio-check.yml; результати — в артефакті audio-check.
set -u
APK=mobile/build/app/outputs/flutter-apk/app-release.apk
PKG=online.gamecon.app
OUT=audio-check
mkdir -p "$OUT"

adb install -r "$APK"
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS || true
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
sleep 30

adb shell dumpsys activity services "$PKG" > "$OUT/services-open.txt"
adb shell dumpsys media_session > "$OUT/media-session-open.txt"
adb shell dumpsys notification --noredact > "$OUT/notifications-open.txt"

adb shell input keyevent KEYCODE_HOME
sleep 25

adb shell dumpsys activity services "$PKG" > "$OUT/services-background.txt"
adb shell dumpsys media_session > "$OUT/media-session-background.txt"
adb shell dumpsys notification --noredact > "$OUT/notifications-background.txt"
adb logcat -d > "$OUT/logcat.txt"

echo "── Журнал застосунку й плеєра ──"
grep -E "GC_AUDIO_TEST|AudioService|audioservice|ExoPlayer|AndroidRuntime|FATAL|ForegroundService|Медіасесія" "$OUT/logcat.txt" | tail -n 80

echo "── Сервіси після згортання ──"
grep -iE "ServiceRecord|isForeground|foregroundId|AudioService" "$OUT/services-background.txt" | head -n 20

echo "── Медіасесія після згортання ──"
grep -A12 "package=$PKG" "$OUT/media-session-background.txt" | head -n 30

fail=0
grep -q "isForeground=true" "$OUT/services-background.txt" || { echo "::error::Після згортання AudioService не працює як foreground-сервіс"; fail=1; }
grep -A12 "package=$PKG" "$OUT/media-session-background.txt" | grep -q "state=PlaybackState {state=3" || { echo "::error::Після згортання медіасесія не в стані PLAYING"; fail=1; }
grep -q "pkg=$PKG" "$OUT/notifications-open.txt" || { echo "::error::Немає сповіщення з плеєром"; fail=1; }
[ "$fail" = 0 ] && echo "✅ Музика грає у фоні, плеєр у шторці є."
exit "$fail"
