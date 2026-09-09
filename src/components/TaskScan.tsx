import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";
import { fill, useI18n } from "@/i18n";
import type { Dict } from "@/i18n/dict";
import { scanTask, type Difficulty, type Reason, type Scan } from "@/tasks/difficulty";
import { useTheme, type Colors } from "@/theme";

/**
 * What the app made of a task somebody wrote for themselves.
 *
 * Two shapes of the same reading: a badge small enough to sit on a row in the
 * day's list, and a panel that shows the whole scan while the task is being
 * typed. The panel matters more than it looks — a difficulty a person cannot
 * see the reasoning for feels arbitrary, and an arbitrary score is one nobody
 * trusts or plays along with. So it says what it noticed, in their own words'
 * terms, and it re-reads on every keystroke.
 */

/**
 * Difficulty rides the palette like everything else: lime for the easy ones
 * (the count family — small things, ticked often), blue for the middle, orange
 * for the ones that cost you something.
 */
export function difficultyColor(colors: Colors, level: Difficulty): string {
  return level === "hard" ? colors.orangeInk : level === "moderate" ? colors.accent : colors.limeInk;
}

export function difficultyWash(colors: Colors, level: Difficulty): string {
  return level === "hard" ? colors.orangeWash : level === "moderate" ? colors.accentWash : colors.limeWash;
}

export function difficultyLabel(t: Dict, level: Difficulty): string {
  return level === "hard" ? t.tasks.levelHard : level === "moderate" ? t.tasks.levelModerate : t.tasks.levelEasy;
}

function reasonLabel(t: Dict, reason: Reason): string {
  const map: Record<Reason, string> = {
    quantity: t.tasks.reasonQuantity,
    duration: t.tasks.reasonDuration,
    intensity: t.tasks.reasonIntensity,
    effort: t.tasks.reasonEffort,
    abstain: t.tasks.reasonAbstain,
    schedule: t.tasks.reasonSchedule,
    scope: t.tasks.reasonScope,
    small: t.tasks.reasonSmall,
  };
  return map[reason];
}

/** The one-line reading: difficulty, and what a tick of it pays. */
export function DifficultyBadge({ scan, showPoints = true }: { scan: Scan; showPoints?: boolean }) {
  const { t } = useI18n();
  const { colors, radius, type } = useTheme();
  const tone = difficultyColor(colors, scan.level);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "flex-start",
        backgroundColor: difficultyWash(colors, scan.level),
        borderRadius: radius.pill,
        paddingVertical: 3,
        paddingHorizontal: 9,
      }}
      accessibilityLabel={`${difficultyLabel(t, scan.level)} · ${scan.points} ${t.tasks.pointsUnit}`}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
      <Text style={[type.label, { color: tone }]}>{difficultyLabel(t, scan.level)}</Text>
      {showPoints ? (
        <Text style={[type.label, { color: tone }]}>
          {fill(t.tasks.points, { points: scan.points })} {t.tasks.pointsUnit}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The full reading, for the form where a task is written or edited. Draws the
 * 0–100 score as a meter so the difference between "run 2 km" and "run 10 km"
 * is visible while the words are still being typed.
 */
export function TaskScanPanel({ title }: { title: string }) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const text = title.trim();
  const scan = scanTask(text);
  const tone = difficultyColor(colors, scan.level);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: text ? tone : colors.rule,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name="scan" size={16} color={text ? tone : colors.inkFaint} />
        <Text style={[type.label, { color: colors.inkFaint, flex: 1 }]}>{t.tasks.scanTitle}</Text>
        {text ? <DifficultyBadge scan={scan} /> : null}
      </View>

      {!text ? (
        <Text style={[type.small, { color: colors.inkFaint }]}>{t.tasks.scanEmpty}</Text>
      ) : (
        <>
          {/* the meter: where this task sits between "made the bed" and
              "ran 15 km before work" */}
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.surfaceAlt,
              overflow: "hidden",
            }}
          >
            <View
              style={{ width: `${Math.max(4, scan.score)}%`, height: "100%", backgroundColor: tone }}
            />
          </View>

          <Text style={[type.smallStrong, { color: colors.ink }]}>
            {fill(t.tasks.worth, { points: scan.points })}
          </Text>

          {scan.reasons.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {scan.reasons.map((reason) => (
                <View
                  key={reason}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: radius.pill,
                    paddingVertical: 3,
                    paddingHorizontal: 9,
                  }}
                >
                  <Text style={[type.label, { color: colors.inkSoft }]}>{reasonLabel(t, reason)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[type.small, { color: colors.inkFaint }]}>{t.tasks.scanHint}</Text>
        </>
      )}
    </View>
  );
}
