import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MAX_CONTENT } from "@/components/Screen";
import { PillButton } from "@/components/PillButton";
import { useI18n } from "@/i18n";
import { HELP_STARTERS, answerHelp, topicById, type HelpTopic } from "@/help";
import { useTheme } from "@/theme";

type Turn =
  | { id: string; from: "you"; text: string }
  | { id: string; from: "guide"; text: string; title?: string; route?: string; options?: HelpTopic[] };

/**
 * The app guide: ask how to do anything in APEX and get the answer with a
 * button that takes you there.
 *
 * Our own assistant, on the device (src/help): instant, offline, free, and
 * never counted against a plan — nobody should hit a paywall asking where the
 * water tab is.
 */
export default function HelpScreen() {
  const { t, locale } = useI18n();
  const { colors, space, radius, type, font } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lang = locale === "he" ? "he" : "en";

  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const scroller = useRef<ScrollView>(null);

  function reply(topic: HelpTopic, also: HelpTopic[] = []): Turn {
    return {
      id: `${Date.now()}-a-${topic.id}`,
      from: "guide",
      title: topic[lang].title,
      text: topic[lang].answer,
      route: topic.route,
      options: also.length ? also : undefined,
    };
  }

  function push(...next: Turn[]) {
    setTurns((prev) => [...prev, ...next]);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  }

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setDraft("");
    const mine: Turn = { id: `${Date.now()}-q`, from: "you", text: q };
    const found = answerHelp(q);
    if (found.kind === "answer") {
      push(mine, reply(found.topic));
    } else if (found.kind === "choose") {
      push(mine, { id: `${Date.now()}-a`, from: "guide", text: t.help.choose, options: found.options });
    } else {
      push(mine, {
        id: `${Date.now()}-a`,
        from: "guide",
        text: t.help.none,
        options: HELP_STARTERS.map(topicById).filter((x): x is HelpTopic => !!x),
      });
    }
  }

  function pick(topic: HelpTopic) {
    push({ id: `${Date.now()}-q`, from: "you", text: topic[lang].title }, reply(topic));
  }

  const centered = { width: "100%" as const, maxWidth: MAX_CONTENT, alignSelf: "center" as const };
  const sendDisabled = !draft.trim();
  const starters = HELP_STARTERS.map(topicById).filter((x): x is HelpTopic => !!x);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={[colors.bandTop, colors.bandBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + space.xxl,
          paddingBottom: space.xxl,
          paddingHorizontal: space.lg,
          borderBottomStartRadius: radius.xl,
          borderBottomEndRadius: radius.xl,
        }}
      >
        <View style={[centered, { flexDirection: "row", alignItems: "center", gap: space.lg }]}>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={[type.hero, { color: colors.bandInk }]}>{t.help.heading}</Text>
            <Text style={[type.smallStrong, { color: colors.bandInkSoft }]}>{t.help.body}</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={colors.bandInkSoft} />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={[centered, { padding: space.lg, gap: space.sm }]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            alignSelf: "flex-start",
            maxWidth: "88%",
            paddingVertical: 10,
            paddingHorizontal: space.md,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Text style={[type.body, { color: colors.ink }]}>{t.help.greeting}</Text>
        </View>

        {turns.map((turn) => {
          const mine = turn.from === "you";
          return (
            <View
              key={turn.id}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "88%",
                paddingVertical: 10,
                paddingHorizontal: space.md,
                borderRadius: radius.lg,
                backgroundColor: mine ? colors.accent : colors.surfaceAlt,
                gap: space.sm,
              }}
            >
              {turn.from === "guide" && turn.title ? (
                <Text style={[type.bodyStrong, { color: colors.ink }]}>{turn.title}</Text>
              ) : null}
              <Text style={[type.body, { color: mine ? colors.onAccent : colors.ink }]}>{turn.text}</Text>
              {turn.from === "guide" && turn.route ? (
                <Pressable
                  onPress={() => router.push(turn.route as Href)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    backgroundColor: pressed ? colors.accentWash : colors.accent,
                  })}
                >
                  <Ionicons name="open-outline" size={16} color={colors.onAccent} />
                  <Text style={[type.smallStrong, { color: colors.onAccent }]}>{t.help.open}</Text>
                </Pressable>
              ) : null}
              {turn.from === "guide" && turn.options ? (
                <View style={{ gap: 6 }}>
                  {turn.route ? (
                    <Text style={[type.small, { color: colors.inkFaint }]}>{t.help.also}</Text>
                  ) : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                    {turn.options.map((o) => (
                      <PillButton key={o.id} tone="soft" label={o[lang].title} onPress={() => pick(o)} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[
          centered,
          { paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.md, gap: space.sm },
        ]}
      >
        {turns.length === 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {starters.map((s) => (
              <PillButton key={s.id} tone="soft" label={s[lang].title} onPress={() => pick(s)} />
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t.help.placeholder}
            placeholderTextColor={colors.inkFaint}
            onSubmitEditing={() => ask(draft)}
            returnKeyType="send"
            accessibilityLabel={t.help.placeholder}
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: 12,
              paddingHorizontal: space.md,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceAlt,
              color: colors.ink,
              fontFamily: font.bodyMedium,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={() => ask(draft)}
            disabled={sendDisabled}
            accessibilityRole="button"
            accessibilityLabel={t.help.send}
            accessibilityState={{ disabled: sendDisabled }}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radius.pill,
              backgroundColor: sendDisabled ? colors.surfaceAlt : colors.accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="send" size={20} color={sendDisabled ? colors.inkFaint : colors.onAccent} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
