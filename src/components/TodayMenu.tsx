import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fill, useI18n } from "@/i18n";
import { FOODS, readPantryFull, timesLabel, type Food, type MealSlot } from "@/kitchen";
import { adaptations, alternativesFor, OWN_PLATE, slotNow, upgradesFor, type MenuSlot } from "@/kitchen/menu";
import { recipeOf } from "@/kitchen/recipes";
import { useStore } from "@/store";
import { metricInk, useTheme } from "@/theme";
import { MealPhoto } from "./MealPhoto";
import { Pop } from "./motion";

/**
 * Today's menu: breakfast, lunch, dinner and a snack, made from what the
 * person has at home and sized to today's calorie target (kitchen/menu.ts).
 * Each meal can be eaten (logged as planned), swapped for another recipe the
 * kitchen can make, upgraded with something already in it, or opened as a
 * recipe. `compact` shows only the next meal, for the Today screen.
 */
export function TodayMenu({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, todayMenu, shuffleMeals } = useStore();
  const menu = todayMenu();
  const hasList = useMemo(() => readPantryFull(state.pantry ?? "").known.length > 0, [state.pantry]);
  const now = slotNow(new Date().getHours());

  if (menu.slots.length === 0) return null;

  if (compact) {
    // The next meal still to eat: the one for now, or the first open one after.
    const order: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
    const from = order.indexOf(now);
    const next =
      menu.slots.find((s) => !s.eaten && !s.missed && order.indexOf(s.slot) >= from) ??
      menu.slots.find((s) => !s.eaten && !s.missed);
    if (!next) return null;
    return (
      <View
        style={{
          padding: space.lg,
          borderRadius: radius.xl,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.rule,
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[type.label, { color: colors.inkSoft, textTransform: "uppercase" }]}>{t.menu.nextTitle}</Text>
          <Pressable onPress={() => router.push("/kitchen")} accessibilityRole="button" hitSlop={8}>
            <Text style={[type.smallStrong, { color: colors.accent }]}>{t.menu.title} ›</Text>
          </Pressable>
        </View>
        <MenuRow s={next} now={now} hasList={hasList} />
      </View>
    );
  }

  return (
    <View
      style={{
        padding: space.lg,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.rule,
        gap: space.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.title, { color: colors.ink }]}>{t.menu.title}</Text>
          <Text style={[type.smallStrong, { color: metricInk(colors, "calories") }]}>
            {fill(t.menu.sub, {
              total: menu.totalKcal.toLocaleString(),
              target: menu.target.toLocaleString(),
              protein: menu.proteinTotal,
            })}
          </Text>
          <Text style={[type.small, { color: colors.inkSoft }]}>
            {!hasList ? t.menu.noList : menu.slots.some((x) => x.missing.length && !x.eaten) ? t.menu.fromKitchenMost : t.menu.fromKitchen}
          </Text>
        </View>
        <Pressable
          onPress={shuffleMeals}
          accessibilityRole="button"
          accessibilityLabel={t.menu.another}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: radius.pill,
            backgroundColor: pressed ? colors.accentWash : colors.surfaceAlt,
          })}
        >
          <Ionicons name="shuffle" size={15} color={colors.accent} />
          <Text style={[type.smallStrong, { color: colors.accent }]}>{t.menu.another}</Text>
        </Pressable>
      </View>

      {menu.slots.map((s) => (
        <MenuRow key={s.slot} s={s} now={now} hasList={hasList} />
      ))}

      <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
        <Ionicons name="sync" size={14} color={colors.inkFaint} style={{ marginTop: 2 }} />
        <Text style={[type.small, { color: colors.inkFaint, flex: 1 }]}>{t.menu.howItWorks}</Text>
      </View>
    </View>
  );
}

function MenuRow({ s, now, hasList }: { s: MenuSlot; now: MealSlot; hasList: boolean }) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const { state, goal, menuChoose, menuToggleExtra, menuEat, todayMenu, todayIntake, calorieTarget, setPantry } = useStore();
  const [open, setOpen] = useState<null | "swap" | "upgrade">(null);
  const [toast, setToast] = useState<string | null>(null);

  const slotLabel: Record<MealSlot, string> = {
    breakfast: t.kitchen.slotBreakfast,
    lunch: t.kitchen.slotLunch,
    dinner: t.kitchen.slotDinner,
    snack: t.kitchen.slotSnack,
  };
  const name = (f: Food) => (locale === "he" ? f.he : f.en);
  const isPlate = !recipeOf(s.meal.id);
  const title = isPlate ? t.menu.ownPlate : locale === "he" ? s.meal.he.title : s.meal.en.title;
  const foods = s.meal.uses.map((id) => FOODS.find((f) => f.id === id)).filter((f): f is Food => !!f);

  const full = readPantryFull(state.pantry ?? "");
  const have = hasList ? new Set(full.known.map((f) => f.id)) : null;
  const input = {
    goal: goal(),
    have,
    diet: state.dietFilter ?? "all",
    seed: `${state.salt ?? ""}|${state.mealShuffle ?? 0}`,
  };
  const adapt = adaptations(s.meal, have);
  const adaptParts = [
    ...adapt.swaps.map((x) => fill(t.menu.instead, { to: name(x.to), from: name(x.from) })),
    ...(adapt.skipped.length ? [fill(t.menu.without, { list: adapt.skipped.map(name).join(", ") })] : []),
  ];
  const times = timesLabel(s.servings);
  const chosenExtras = new Set(s.extras.map((u) => u.food.id));

  /** Puts what the dish is missing on the kitchen list, and keeps the dish on
   * today's menu — otherwise the new list reshuffles the rotation under it. */
  function addMissing() {
    const current = (state.pantry ?? "").trim();
    const names = s.missing.map(name).join(", ");
    setPantry(current ? `${current.replace(/[,\s]+$/, "")}, ${names}` : names);
    menuChoose(s.slot, s.meal.id);
    setToast(fill(t.menu.addedToList, { list: names }));
    setTimeout(() => setToast(null), 4000);
  }

  function eat() {
    const extras = s.extras.map((u) => name(u.food)).join(", ");
    menuEat(s.slot, `${title}${times ? ` ${times}` : ""}${extras ? ` + ${extras}` : ""}`);
    setOpen(null);
    setToast(fill(t.menu.loggedToast, { kcal: (todayIntake().kcal + s.kcal).toLocaleString(), goal: calorieTarget().kcal.toLocaleString() }));
    setTimeout(() => setToast(null), 5000);
  }

  const chip = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, on = false) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} · ${slotLabel[s.slot]}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderRadius: radius.pill,
        backgroundColor: on ? colors.accent : pressed ? colors.accentWash : colors.surfaceAlt,
      })}
    >
      <Ionicons name={icon} size={14} color={on ? colors.onAccent : colors.accent} />
      <Text style={[type.smallStrong, { color: on ? colors.onAccent : colors.accent }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View
      style={{
        gap: space.sm,
        padding: space.sm,
        borderRadius: radius.lg,
        backgroundColor: s.slot === now && !s.eaten ? colors.accentWash : "transparent",
        opacity: s.eaten ? 0.72 : s.missed ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <Pressable
          onPress={() => (isPlate ? null : router.push({ pathname: "/recipe/[id]", params: { id: s.meal.id } }))}
          accessibilityRole={isPlate ? undefined : "button"}
          accessibilityLabel={isPlate ? undefined : `${t.menu.recipe} · ${title}`}
          style={{ borderRadius: radius.md, overflow: "hidden" }}
        >
          <MealPhoto meal={s.meal} foods={foods} haveIds={have ?? new Set()} width={76} height={76} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[type.label, { color: colors.inkFaint, textTransform: "uppercase" }]}>{slotLabel[s.slot]}</Text>
            {s.slot === now && !s.eaten ? (
              <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.accent }}>
                <Text style={[type.small, { color: colors.onAccent, fontWeight: "700" }]}>{t.menu.now}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={2}>
            {title}
            {times && !s.eaten ? <Text style={{ color: colors.accent }}>{`  ${times}`}</Text> : null}
          </Text>
          <Pop trigger={s.kcal}>
            <Text style={[type.small, { color: s.eaten ? colors.limeInk : colors.inkSoft, fontWeight: s.eaten ? "700" : "400" }]}>
              {s.eaten
                ? fill(t.menu.eaten, { kcal: s.kcal })
                : s.missed
                  ? t.menu.missed
                  : fill(t.menu.line, { kcal: s.kcal, protein: s.protein })}
              {s.extras.length && !s.eaten && !s.missed ? ` · + ${s.extras.map((u) => name(u.food)).join(", ")}` : ""}
            </Text>
          </Pop>
          {s.missing.length && !s.eaten && !s.missed ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Ionicons name="cart-outline" size={14} color={colors.orangeInk} />
              <Text style={[type.small, { color: colors.orangeInk, fontWeight: "700" }]}>
                {fill(t.menu.needs, { list: s.missing.map(name).join(", ") })}
              </Text>
              <Pressable onPress={addMissing} accessibilityRole="button" hitSlop={8}>
                <Text style={[type.smallStrong, { color: colors.accent }]}>{t.menu.addToList}</Text>
              </Pressable>
            </View>
          ) : null}
          {adaptParts.length && !s.eaten && !s.missed ? (
            <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={2}>
              {fill(t.menu.adapted, { list: adaptParts.join(" · ") })}
            </Text>
          ) : null}
        </View>
      </View>

      {!s.eaten ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Pressable
            onPress={eat}
            accessibilityRole="button"
            accessibilityLabel={`${t.menu.ate} · ${slotLabel[s.slot]}`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingVertical: 7,
              paddingHorizontal: 13,
              borderRadius: radius.pill,
              backgroundColor: pressed ? colors.accentWash : colors.accent,
            })}
          >
            <Ionicons name="checkmark" size={15} color={colors.onAccent} />
            <Text style={[type.smallStrong, { color: colors.onAccent }]}>{t.menu.ate}</Text>
          </Pressable>
          {s.missed ? null : chip("swap-horizontal", t.menu.swap, () => setOpen(open === "swap" ? null : "swap"), open === "swap")}
          {s.missed ? null : chip("sparkles", t.menu.upgrade, () => setOpen(open === "upgrade" ? null : "upgrade"), open === "upgrade")}
          {!isPlate
            ? chip("book-outline", t.menu.recipe, () => router.push({ pathname: "/recipe/[id]", params: { id: s.meal.id } }))
            : null}
        </View>
      ) : null}

      {toast ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={[type.smallStrong, { color: colors.accent, flex: 1 }]}>{toast}</Text>
        </View>
      ) : null}

      {open === "swap" ? (
        <SwapList
          slot={s.slot}
          current={s.meal.id}
          input={input}
          onPick={(id) => {
            menuChoose(s.slot, id);
            setOpen(null);
          }}
          hasList={hasList}
          plate={() => {
            menuChoose(s.slot, OWN_PLATE);
            setOpen(null);
          }}
        />
      ) : null}

      {open === "upgrade" ? (
        <View style={{ gap: 6 }}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.menu.upgradeTitle}</Text>
          {(() => {
            const ups = upgradesFor(s.meal, input);
            const shown = [...ups, ...s.extras.filter((u) => !ups.some((x) => x.food.id === u.food.id))];
            if (shown.length === 0) return <Text style={[type.small, { color: colors.inkFaint }]}>{t.menu.upgradeNone}</Text>;
            return (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {shown.map((u) => {
                  const on = chosenExtras.has(u.food.id);
                  const why =
                    u.why === "protein"
                      ? fill(t.menu.whyProtein, { n: u.protein })
                      : u.why === "energy"
                        ? fill(t.menu.whyEnergy, { n: u.kcal })
                        : t.menu.whyVolume;
                  return (
                    <Pressable
                      key={u.food.id}
                      onPress={() => menuToggleExtra(s.slot, u.food.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={({ pressed }) => ({
                        paddingVertical: 7,
                        paddingHorizontal: 11,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: on ? colors.accent : colors.rule,
                        backgroundColor: on ? colors.accentWash : pressed ? colors.surfaceAlt : colors.surface,
                      })}
                    >
                      <Text style={[type.smallStrong, { color: colors.ink }]}>
                        {on ? "✓ " : "+ "}
                        {name(u.food)}
                      </Text>
                      <Text style={[type.small, { color: colors.inkSoft }]}>
                        {why}
                        {!u.have ? ` · ${t.menu.ifYouHave}` : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })()}
        </View>
      ) : null}
    </View>
  );
}

function SwapList({
  slot,
  current,
  input,
  onPick,
  hasList,
  plate,
}: {
  slot: MealSlot;
  current: string;
  input: Parameters<typeof alternativesFor>[2];
  onPick: (id: string) => void;
  hasList: boolean;
  plate: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const alts = alternativesFor(slot, current, input, 8);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.small, { color: colors.inkSoft }]}>{alts.length ? t.menu.swapTitle : t.menu.swapNone}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {alts.map((m) => {
          const foods = m.uses.map((id) => FOODS.find((f) => f.id === id)).filter((f): f is Food => !!f);
          return (
            <Pressable
              key={m.id}
              onPress={() => onPick(m.id)}
              accessibilityRole="button"
              accessibilityLabel={locale === "he" ? m.he.title : m.en.title}
              style={({ pressed }) => ({ width: 128, gap: 4, opacity: pressed ? 0.75 : 1 })}
            >
              <View style={{ borderRadius: radius.md, overflow: "hidden" }}>
                <MealPhoto meal={m} foods={foods} haveIds={new Set()} width={128} height={84} />
              </View>
              <Text style={[type.smallStrong, { color: colors.ink }]} numberOfLines={2}>
                {locale === "he" ? m.he.title : m.en.title}
              </Text>
              <Text style={[type.small, { color: colors.inkFaint }]}>
                {m.kcal} {t.kitchen.kcal} · {m.protein}
                {t.kitchen.grams}
              </Text>
            </Pressable>
          );
        })}
        {hasList ? (
          <Pressable
            onPress={plate}
            accessibilityRole="button"
            style={({ pressed }) => ({
              width: 128,
              height: 84,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              backgroundColor: pressed ? colors.accentWash : colors.surfaceAlt,
            })}
          >
            <Ionicons name="restaurant" size={22} color={colors.accent} />
            <Text style={[type.smallStrong, { color: colors.accent, textAlign: "center" }]}>{t.menu.ownPlate}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
