import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { fill, useI18n } from "@/i18n";
import { useStore, type DayTarget } from "@/store";
import { metricFill, metricInk, ON_HERO, ON_HERO_SOFT, useTheme } from "@/theme";
import { GrowBar, Pop, useCountUp } from "./motion";

/**
 * The day's calories, the same everywhere: the Today screen, the kitchen and
 * the calculator all show this card, so a meal logged anywhere visibly lands
 * in one total. The figure counts up as food is added, the bar grows, and a
 * plate still being built shows as a lighter stretch of the bar ("+ 350 on
 * the plate"). Under it, what the weekly target learning did.
 */
export function DayCalories({
  plate = 0,
  onHero = false,
  link = true,
}: {
  /** Calories on a plate not yet logged, shown as a preview. */
  plate?: number;
  /** Drawn on the hero gradient (the calculator) instead of a card. */
  onHero?: boolean;
  /** Tapping opens the calculator. */
  link?: boolean;
}) {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { todayIntake, calorieTarget } = useStore();
  const eaten = todayIntake();
  const target = calorieTarget();

  const kcal = useCountUp(eaten.kcal, 800, true);
  const left = target.kcal - eaten.kcal;
  const pct = (eaten.kcal / target.kcal) * 100;
  const platePct = (plate / target.kcal) * 100;
  const proPct = (eaten.protein / target.protein) * 100;
  const hit = eaten.kcal >= target.kcal * 0.9 && eaten.kcal <= target.kcal * 1.1;

  const ink = onHero ? ON_HERO : colors.ink;
  const soft = onHero ? ON_HERO_SOFT : colors.inkSoft;
  const kcalInk = onHero ? ON_HERO : metricInk(colors, "calories");
  const track = onHero ? "rgba(255,255,255,0.22)" : colors.surfaceAlt;
  const barColor = onHero ? ON_HERO : left < 0 ? colors.alert : metricFill(colors, "calories");

  const body = (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[type.label, { color: soft, textTransform: "uppercase" }]}>{t.day.title}</Text>
        {hit ? (
          <Text style={[type.smallStrong, { color: onHero ? ON_HERO : colors.limeInk }]}>{t.day.onTarget}</Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
        <Pop trigger={eaten.kcal}>
          <Text style={[type.figure, { color: kcalInk, fontSize: 48, lineHeight: 52 }]}>{kcal.toLocaleString()}</Text>
        </Pop>
        <Text style={[type.small, { color: soft, paddingBottom: 9 }]}>
          {fill(t.day.ofTarget, { target: target.kcal.toLocaleString() })}
        </Text>
      </View>

      <GrowBar pct={pct} ghostPct={platePct} color={barColor} ghostColor={barColor} track={track} />

      <Text style={[type.smallStrong, { color: left < 0 ? (onHero ? ON_HERO : colors.orangeInk) : ink }]}>
        {plate > 0
          ? fill(t.day.plate, { plate, after: Math.max(0, left - plate).toLocaleString() })
          : left >= 0
            ? fill(t.day.left, { n: left.toLocaleString() })
            : fill(t.day.over, { n: (-left).toLocaleString() })}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Text style={[type.small, { color: soft, minWidth: 92 }]}>
          {fill(t.day.protein, { n: eaten.protein, of: target.protein })}
        </Text>
        <GrowBar
          pct={proPct}
          color={onHero ? ON_HERO : metricFill(colors, "protein")}
          track={track}
          height={6}
          style={{ flex: 1 }}
        />
      </View>

      {target.activity.total > 0 ? (
        <Text style={[type.smallStrong, { color: onHero ? ON_HERO : colors.limeInk }]}>
          {fill(t.day.activity, {
            n: target.activity.total,
            parts: [
              target.activity.workout > 0 ? fill(t.day.fromWorkout, { n: target.activity.workout }) : null,
              target.activity.steps > 0 ? fill(t.day.fromSteps, { n: target.activity.steps }) : null,
            ]
              .filter(Boolean)
              .join(" · "),
          })}
        </Text>
      ) : null}

      <WeeklyNote target={target} onHero={onHero} />
    </View>
  );

  if (onHero) return body;
  return (
    <Pressable
      onPress={link ? () => router.push("/calc") : undefined}
      disabled={!link}
      accessibilityRole={link ? "button" : undefined}
      accessibilityLabel={`${t.day.title}: ${eaten.kcal} / ${target.kcal}`}
      style={({ pressed }) => ({
        padding: space.lg,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.rule,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {body}
      {link ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.md }}>
          <Ionicons name="add-circle" size={18} color={colors.accent} />
          <Text style={[type.smallStrong, { color: colors.accent }]}>{t.day.add}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function WeeklyNote({ target, onHero }: { target: DayTarget; onHero: boolean }) {
  const { t } = useI18n();
  const { colors, type } = useTheme();
  const color = onHero ? ON_HERO_SOFT : colors.inkFaint;
  const kg = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
  let text: string;
  if (target.status === "learning") {
    text = fill(t.day.learning, { days: target.daysToGo });
  } else {
    const last = target.last!;
    const pace = fill(t.day.pace, { rate: kg(last.rateKg), goal: kg(last.goalRateKg) });
    text =
      target.status === "onTrack"
        ? `${pace} ${t.day.onTrack}`
        : target.status === "lowered"
          ? `${pace} ${fill(t.day.lowered, { n: -last.step })}`
          : `${pace} ${fill(t.day.raised, { n: last.step })}`;
  }
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
      <Ionicons name="sync" size={14} color={color} style={{ marginTop: 2 }} />
      <Text style={[type.small, { color, flex: 1 }]}>{text}</Text>
    </View>
  );
}
