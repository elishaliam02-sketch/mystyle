import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { HeroCard } from "@/components/HeroCard";
import { PillButton } from "@/components/PillButton";
import { Screen } from "@/components/Screen";
import { SelectTile } from "@/components/SelectTile";
import { supabase } from "@/cloud/client";
import { useI18n } from "@/i18n";
import { ON_HERO, ON_HERO_SOFT, useTheme } from "@/theme";
import {
  entitlement,
  formatPrice,
  FREE_LIMITS,
  isPlanId,
  PLANS,
  PLAN_IDS,
  PRO_UNLOCKS,
  TRIAL_DAYS,
  yearlyPerMonth,
  yearlySavingPercent,
  type EntitlementState,
  type PlanId,
  type ProUnlock,
} from "@/billing/plans";

/**
 * The pricing screen.
 *
 * Everything it claims — the prices, the saving on the yearly plan, the length
 * of the trial, what the free tier still allows — is read out of
 * `src/billing/plans.ts`. Nothing is typed twice, so a price change moves this
 * screen with it and the badge can never advertise a discount that no longer
 * exists.
 *
 * The copy is local. The i18n dictionaries belong to the rest of the app and
 * are edited elsewhere, so the words this one screen needs live in COPY below
 * and are picked by `locale`. The only shared key it borrows is the close
 * label, which every stack screen outside the tabs already uses.
 *
 * IT HAS TO WORK SIGNED OUT. That is the common case: somebody who has never
 * paid, has no account, and whose device holds no subscription record at all.
 * So the entitlement it renders starts as null — which `entitlement()` reads as
 * "free" — and the server is asked for a status only as a bonus, inside a
 * try/catch that leaves the screen exactly as it was if anything goes wrong.
 */

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  trialHead: string;
  trialBody: string;
  proHead: string;
  proBody: string;
  chooseLabel: string;
  monthly: string;
  yearly: string;
  perMonth: string;
  perYear: string;
  equivalent: (price: string) => string;
  save: (percent: number) => string;
  billedYearly: string;
  monthlyNote: string;
  unlocksLabel: string;
  unlocks: Record<ProUnlock, string>;
  freeLabel: string;
  freeTitle: string;
  freeBody: string;
  cta: string;
  ctaPro: string;
  afterTrial: (price: string, period: string) => string;
  renews: string;
  cancel: string;
  vat: string;
  terms: string;
  privacy: string;
  needAccount: string;
  failed: string;
  manage: string;
};

const COPY: Record<"he" | "en", Copy> = {
  he: {
    eyebrow: "APEX PRO",
    title: "כל האפליקציה, בלי גבולות",
    subtitle: `שבוע ראשון על חשבוננו. מבטלים מתי שרוצים, בלי לדבר עם אף אחד.`,
    trialHead: `${TRIAL_DAYS} ימים חינם`,
    trialBody:
      "מתחילים היום בלי לשלם. החיוב הראשון רק בתום השבוע — ואם ביטלת לפני כן, לא חויבת בכלל.",
    proHead: "המנוי שלך פעיל",
    proBody: "הכול פתוח. תודה שאתה מחזיק את האפליקציה באוויר.",
    chooseLabel: "בחירת תוכנית",
    monthly: "חודשי",
    yearly: "שנתי",
    perMonth: "לחודש",
    perYear: "לשנה",
    equivalent: (price) => `יוצא ${price} לחודש`,
    save: (percent) => `חוסך ${percent}%`,
    billedYearly: "חיוב אחד בשנה",
    monthlyNote: "חיוב כל חודש, מבטלים מתי שרוצים",
    unlocksLabel: "מה נפתח",
    unlocks: {
      habits: `הרגלים בלי הגבלה — בחינם עד ${FREE_LIMITS.habits}`,
      coach: `מאמן חכם בלי תקרה יומית — בחינם ${FREE_LIMITS.coachRepliesPerDay} תשובות ביום`,
      mealPhoto: `ספירת קלוריות מתמונה, כמה שצריך — בחינם פעם ביום`,
      history: `כל ההיסטוריה והגרפים — בחינם ${FREE_LIMITS.historyDays} הימים האחרונים`,
      cloud: "גיבוי בענן וסנכרון בין מכשירים",
      support: "תמיכה במייל, ותכונות חדשות ראשונים",
    },
    freeLabel: "בלי תשלום",
    freeTitle: "מה שחינם נשאר חינם",
    freeBody:
      "מעקב הרגלים, תוכנית האימונים, המים והצעדים ממשיכים לעבוד גם בלי מנוי. התשלום מסיר את המגבלות — הוא לא נועל את האפליקציה.",
    cta: `התחלה של ${TRIAL_DAYS} ימים חינם`,
    ctaPro: "ניהול המנוי",
    afterTrial: (price, period) => `בתום הניסיון: ${price} ${period}. אפשר לבטל לפני, בלי חיוב.`,
    renews: "המנוי מתחדש אוטומטית בסוף כל תקופה באותו אמצעי תשלום, עד שמבטלים אותו.",
    cancel:
      "לביטול: פרופיל ← מנוי, או דרך קישור הניהול שנשלח אליך במייל מ‑Stripe. הביטול עוצר את החידוש הבא, והמנוי נשאר פתוח עד סוף התקופה ששילמת עליה.",
    vat: "המחירים בשקלים חדשים וכוללים מע״מ.",
    terms: "תנאי שימוש",
    privacy: "מדיניות פרטיות",
    needAccount: "כדי שהמנוי יתחבר אליך צריך חשבון. פרופיל ← חשבון, ואז חוזרים לכאן.",
    failed: "לא הצלחנו לפתוח את דף התשלום. בדוק את החיבור לאינטרנט ונסה שוב.",
    manage: "ניהול המנוי נפתח בדפדפן, בעמוד המאובטח של Stripe.",
  },
  en: {
    eyebrow: "APEX PRO",
    title: "The whole app, no limits",
    subtitle: "The first week is on us. Cancel any time, without talking to anyone.",
    trialHead: `${TRIAL_DAYS} days free`,
    trialBody:
      "Start today without paying. The first charge lands at the end of the week — cancel before then and there is no charge at all.",
    proHead: "Your subscription is active",
    proBody: "Everything is unlocked. Thank you for keeping the app running.",
    chooseLabel: "Choose a plan",
    monthly: "Monthly",
    yearly: "Yearly",
    perMonth: "per month",
    perYear: "per year",
    equivalent: (price) => `Works out at ${price} a month`,
    save: (percent) => `Save ${percent}%`,
    billedYearly: "One charge a year",
    monthlyNote: "Charged every month, cancel any time",
    unlocksLabel: "What you unlock",
    unlocks: {
      habits: `Unlimited habits — ${FREE_LIMITS.habits} on the free tier`,
      coach: `The coach with no daily ceiling — ${FREE_LIMITS.coachRepliesPerDay} replies a day free`,
      mealPhoto: "Calories from a photo, as often as you like — once a day free",
      history: `Your full history and charts — last ${FREE_LIMITS.historyDays} days free`,
      cloud: "Cloud backup and sync across devices",
      support: "Email support, and new features first",
    },
    freeLabel: "No payment",
    freeTitle: "What is free stays free",
    freeBody:
      "Habit tracking, your training plan, water and steps keep working with no subscription. Paying lifts the limits — it does not lock the app.",
    cta: `Start ${TRIAL_DAYS} days free`,
    ctaPro: "Manage subscription",
    afterTrial: (price, period) => `After the trial: ${price} ${period}. Cancel before it ends and you pay nothing.`,
    renews: "The subscription renews automatically at the end of every period, on the same payment method, until you cancel.",
    cancel:
      "To cancel: Profile → Subscription, or through the management link Stripe emails you. Cancelling stops the next renewal; the subscription stays open until the end of the period you have already paid for.",
    vat: "Prices are in Israeli shekels and include VAT.",
    terms: "Terms of use",
    privacy: "Privacy policy",
    needAccount: "A subscription needs an account to attach to. Profile → Account, then come back here.",
    failed: "We could not open the payment page. Check your connection and try again.",
    manage: "Subscription management opens in the browser, on Stripe's secure page.",
  },
};

export default function PaywallScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();

  const c = COPY[locale === "he" ? "he" : "en"];
  const [chosen, setChosen] = useState<PlanId>("yearly");
  const [sub, setSub] = useState<EntitlementState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Best effort only. Signed out, offline, or with no billing function
  // deployed, this never resolves into anything and the screen stays exactly
  // as it renders on first paint: the offer, for a free user.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const db = supabase();
        if (!db) return;
        const { data: session } = await db.auth.getSession();
        if (!session.session) return;
        const { data, error } = await db.functions.invoke("billing", { body: { action: "status" } });
        if (!alive || error || !data || typeof data !== "object") return;
        const row = data as { status?: unknown; currentPeriodEnd?: unknown; trialEndsAt?: unknown };
        setSub({
          nowIso: new Date().toISOString(),
          status: typeof row.status === "string" ? (row.status as EntitlementState["status"]) : "none",
          currentPeriodEnd: typeof row.currentPeriodEnd === "string" ? row.currentPeriodEnd : null,
          trialEndsAt: typeof row.trialEndsAt === "string" ? row.trialEndsAt : null,
        });
      } catch {
        // A pricing screen that crashes because a status call failed would be
        // worse than one that simply shows the price.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const level = entitlement(sub);
  const paying = level === "pro";
  const savingPercent = yearlySavingPercent();
  const plan = PLANS[chosen];

  async function openCheckout(action: "checkout" | "portal") {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const db = supabase();
      if (!db) {
        setNote(c.needAccount);
        return;
      }
      const { data: session } = await db.auth.getSession();
      if (!session.session) {
        setNote(c.needAccount);
        return;
      }
      const { data, error } = await db.functions.invoke("billing", {
        // The plan id travels, never a price: the server looks the amount up
        // itself, so a tampered request cannot buy a year for one agora.
        body: action === "checkout" ? { action, planId: chosen } : { action },
      });
      const url =
        data && typeof data === "object" && typeof (data as { url?: unknown }).url === "string"
          ? (data as { url: string }).url
          : null;
      if (error || !url) {
        setNote(c.failed);
        return;
      }
      await Linking.openURL(url);
    } catch {
      setNote(c.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow={c.eyebrow}
      title={c.title}
      subtitle={c.subtitle}
      aside={
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: colors.bandRule,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={20} color={colors.bandInk} />
        </Pressable>
      }
    >
      <HeroCard>
        <Text style={[type.label, { color: ON_HERO_SOFT }]}>
          {paying ? c.eyebrow : c.chooseLabel}
        </Text>
        <Text style={[type.hero, { color: ON_HERO }]}>{paying ? c.proHead : c.trialHead}</Text>
        <Text style={[type.small, { color: ON_HERO_SOFT }]}>
          {paying ? c.proBody : c.trialBody}
        </Text>
        {!paying ? (
          <Text style={[type.smallStrong, { color: ON_HERO }]}>
            {c.afterTrial(
              formatPrice(plan.price, plan.currency, locale === "he" ? "he" : "en"),
              chosen === "yearly" ? c.perYear : c.perMonth,
            )}
          </Text>
        ) : null}
      </HeroCard>

      {!paying ? (
        <Card label={c.chooseLabel}>
          <View style={{ gap: space.md }}>
            {PLAN_IDS.map((id) => (
              <PlanTile
                key={id}
                id={id}
                copy={c}
                selected={chosen === id}
                savingPercent={savingPercent}
                onPress={() => setChosen(isPlanId(id) ? id : "monthly")}
              />
            ))}
          </View>
          <Text style={[type.label, { color: colors.inkFaint, letterSpacing: 0 }]}>{c.vat}</Text>
        </Card>
      ) : null}

      <Card label={c.unlocksLabel} title={c.title}>
        <View style={{ gap: space.sm }}>
          {PRO_UNLOCKS.map((key) => (
            <View key={key} style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
              <Ionicons
                name="checkmark-circle"
                size={19}
                color={colors.accent}
                style={{ marginTop: 3 }}
              />
              <Text style={[type.small, { color: colors.ink, flex: 1 }]}>{c.unlocks[key]}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card label={c.freeLabel} title={c.freeTitle} tone="accent">
        <Text style={[type.small, { color: colors.inkSoft }]}>{c.freeBody}</Text>
      </Card>

      <View style={{ gap: space.sm }}>
        <Button
          label={paying ? c.ctaPro : c.cta}
          icon={paying ? "settings-outline" : "sparkles"}
          onPress={() => openCheckout(paying ? "portal" : "checkout")}
          disabled={busy}
        />
        {busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[type.small, { color: colors.inkSoft }]}>{t.common.loading}</Text>
          </View>
        ) : null}
        {note ? (
          <Text style={[type.small, { color: colors.orangeInk, textAlign: "center" }]}>{note}</Text>
        ) : null}
      </View>

      {/* The lines a subscription screen is required to carry: that it renews
          by itself, how to stop it, and where the documents are. */}
      <Card>
        <Text style={[type.small, { color: colors.inkSoft }]}>{c.renews}</Text>
        <Text style={[type.small, { color: colors.inkSoft }]}>{c.cancel}</Text>
        <Text style={[type.small, { color: colors.inkFaint }]}>{c.manage}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs }}>
          <PillButton
            label={c.terms}
            tone="soft"
            icon="document-text-outline"
            onPress={() => router.push("/legal/terms")}
          />
          <PillButton
            label={c.privacy}
            tone="soft"
            icon="lock-closed-outline"
            onPress={() => router.push("/legal/privacy")}
          />
        </View>
      </Card>
    </Screen>
  );
}

/**
 * One row of the chooser. The whole row is the tap target — on a 393pt phone
 * two side-by-side cards would squeeze the Hebrew price line onto three lines
 * each, so the plans stack instead and every figure gets the full width.
 */
function PlanTile({
  id,
  copy,
  selected,
  savingPercent,
  onPress,
}: {
  id: PlanId;
  copy: Copy;
  selected: boolean;
  savingPercent: number;
  onPress: () => void;
}) {
  const { locale } = useI18n();
  const { colors, space, radius, type } = useTheme();
  const plan = PLANS[id];
  const lang = locale === "he" ? "he" : "en";

  // On a picked tile the accent gradient is the surface, so the type has to be
  // the ink that reads on accent rather than the page ink.
  const ink = selected ? colors.onAccent : colors.ink;
  const inkSoft = selected ? colors.onAccent : colors.inkFaint;
  const name = id === "yearly" ? copy.yearly : copy.monthly;
  const period = id === "yearly" ? copy.perYear : copy.perMonth;

  return (
    <SelectTile
      selected={selected}
      onPress={onPress}
      accessibilityLabel={`${name} — ${formatPrice(plan.price, plan.currency, lang)} ${period}`}
      style={{ borderRadius: radius.md, borderWidth: 1, borderColor: selected ? colors.accent : colors.rule }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.lg,
          paddingHorizontal: space.lg,
        }}
      >
        <Ionicons
          name={selected ? "radio-button-on" : "radio-button-off"}
          size={22}
          color={selected ? colors.onAccent : colors.inkFaint}
        />

        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
            <Text style={[type.title, { color: ink }]}>{name}</Text>
            {id === "yearly" && savingPercent > 0 ? (
              <View
                style={{
                  borderRadius: radius.pill,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  backgroundColor: selected ? colors.onAccent : colors.limeWash,
                }}
              >
                <Text
                  style={[
                    type.label,
                    { color: selected ? colors.accent : colors.limeInk, letterSpacing: 0 },
                  ]}
                >
                  {copy.save(savingPercent)}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[type.bodyStrong, { color: ink }]}>
            {formatPrice(plan.price, plan.currency, lang)}{" "}
            <Text style={[type.small, { color: inkSoft }]}>{period}</Text>
          </Text>

          <Text style={[type.small, { color: inkSoft }]}>
            {id === "yearly"
              ? `${copy.equivalent(yearlyPerMonth(lang))} · ${copy.billedYearly}`
              : copy.monthlyNote}
          </Text>
        </View>
      </View>
    </SelectTile>
  );
}
