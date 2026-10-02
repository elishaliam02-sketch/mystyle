import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Chevron } from "@/components/Chevron";
import { fill, useI18n } from "@/i18n";
import { nextSteps, type NextStep } from "@/insight/nextstep";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / DAY);

/** The local hour, refreshed every minute so the card moves with the day. */
function useHour(): number {
  const read = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };
  const [hour, setHour] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setHour(read()), 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

/**
 * "Right now": the one or three things worth doing at this moment, from the
 * clock and the day so far (`@/insight/nextstep`). The first is the headline,
 * with its action one tap away — a cup of water or a ticked habit happen right
 * here, without leaving the screen.
 */
export function NowCard() {
  const { t } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const hour = useHour();
  const {
    state, isDone, toggleCompletion, todayWater, waterGoal, cupMl, addWater,
    todayIntake, calorieTarget, todayKey, activeWorkout,
  } = useStore();

  const today = todayKey();
  const intake = todayIntake();
  const lastWeigh = state.weighIns[state.weighIns.length - 1]?.date;
  const log = state.training?.log ?? {};
  const doneThisWeek = Object.keys(log).filter((d) => {
    const ago = dayNum(today) - dayNum(d);
    return ago >= 0 && ago < 7 && (log[d]?.length ?? 0) > 0;
  }).length;

  const steps = nextSteps({
    hour,
    habits: state.habits.filter((h) => !h.archived).map((h) => ({ id: h.id, title: h.title, slot: h.slot, done: isDone(h.id) })),
    water: { ml: todayWater(), goalMl: waterGoal(), cupMl: cupMl() },
    meals: { count: intake.items.length, kcal: intake.kcal, targetKcal: calorieTarget().kcal },
    daysSinceWeighIn: lastWeigh ? Math.max(0, dayNum(today) - dayNum(lastWeigh)) : null,
    workout: {
      active: activeWorkout() !== null,
      planned: !!state.training,
      doneToday: (log[today]?.length ?? 0) > 0,
      doneThisWeek,
      perWeek: state.training?.days ?? 0,
    },
    recapDoneToday: state.checkIns.some((c) => c.date === today),
  });

  type View_ = { icon: keyof typeof Ionicons.glyphMap; text: string; cta?: string; act?: () => void; go?: string };
  const view = (s: NextStep): View_ => {
    switch (s.kind) {
      case "resumeWorkout":
        return { icon: "stopwatch", text: t.now.resumeWorkout, cta: t.now.resumeCta, go: "/workout" };
      case "habit":
        return { icon: "checkbox-outline", text: fill(t.now.habit, { title: s.title ?? "" }), cta: t.now.habitDo, act: () => s.habitId && toggleCompletion(s.habitId) };
      case "water":
        return { icon: "water", text: s.amount === 1 ? t.now.waterOne : fill(t.now.water, { n: s.amount ?? 1 }), cta: t.now.waterCta, act: () => addWater(1) };
      case "logMeal":
        return { icon: "restaurant", text: t.now.logMeal[s.meal ?? "lunch"], cta: t.now.logCta, go: "/kitchen" };
      case "eatMore":
        return { icon: "restaurant", text: fill(t.now.eatMore, { kcal: (s.amount ?? 0).toLocaleString() }), cta: t.now.menuCta, go: "/kitchen" };
      case "weighIn":
        return { icon: "scale-outline", text: s.amount == null ? t.now.weighFirst : fill(t.now.weighIn, { days: s.amount }), cta: t.now.weighCta, go: "/progress" };
      case "workout":
        return { icon: "barbell", text: s.amount === 1 ? t.now.workoutOne : fill(t.now.workout, { n: s.amount ?? 1 }), cta: t.now.workoutCta, go: "/workout" };
      case "recap":
        return { icon: "chatbubble-ellipses-outline", text: t.now.recap, cta: t.now.recapCta, go: "/checkin" };
      default:
        return { icon: "sparkles", text: t.now.allDone };
    }
  };

  const [first, ...rest] = steps.map((s) => ({ s, v: view(s) }));
  if (!first) return null;
  const press = (v: View_) => (v.act ? v.act() : v.go ? router.push(v.go as never) : undefined);

  return (
    <View
      style={{ padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, gap: space.md }}
      accessibilityLabel={t.now.title}
    >
      <Text style={[type.label, { color: colors.accent, textTransform: "uppercase" }]}>{t.now.title}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={first.v.icon} size={22} color={colors.accent} />
        </View>
        <Text style={[type.bodyStrong, { color: colors.ink, flex: 1 }]}>{first.v.text}</Text>
      </View>
      {first.v.cta ? (
        <Pressable
          onPress={() => press(first.v)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 9,
            paddingHorizontal: 16,
            borderRadius: radius.pill,
            backgroundColor: pressed ? colors.accentDeep : colors.accent,
          })}
        >
          <Text style={[type.smallStrong, { color: colors.onAccent }]}>{first.v.cta}</Text>
        </Pressable>
      ) : null}
      {rest.map(({ s, v }) => (
        <Pressable
          key={`${s.kind}-${s.habitId ?? ""}`}
          onPress={() => press(v)}
          accessibilityRole="button"
          accessibilityLabel={v.cta ? `${v.cta} · ${v.text}` : v.text}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            paddingTop: space.sm,
            borderTopWidth: 1,
            borderTopColor: colors.rule,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name={v.icon} size={18} color={colors.inkSoft} />
          <Text style={[type.small, { color: colors.ink, flex: 1 }]}>{v.text}</Text>
          {v.act && v.cta ? (
            <Text style={[type.smallStrong, { color: colors.accent }]}>{v.cta}</Text>
          ) : (
            <Chevron size={16} color={colors.inkFaint} />
          )}
        </Pressable>
      ))}
    </View>
  );
}
