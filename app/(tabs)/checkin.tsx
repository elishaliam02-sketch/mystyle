import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { askRecapReply, type Adjustment } from "@/ai/prompts";
import { useAi } from "@/ai/useAi";
import { AiBadge } from "@/components/AiNote";
import { recapReply } from "@/insight";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { today, useStore, type CheckIn, type Habit } from "@/store";
import { useTheme } from "@/theme";

const MOODS: CheckIn["mood"][] = ["good", "ok", "hard"];
const SLOT_WORDS: Record<string, Habit["slot"]> = {
  morning: "morning",
  noon: "noon",
  evening: "evening",
};

export default function CheckinScreen() {
  const { t, locale } = useI18n();
  const { colors, space, type } = useTheme();
  const { state, addCheckIn, isDone, updateHabit } = useStore();

  const existing = state.checkIns.find((c) => c.date === today());
  const [editing, setEditing] = useState(false);
  // No mood is pre-selected for a fresh recap, so saving is an intentional
  // tap rather than an accidental "ok". Editing an existing recap prefills it.
  const [mood, setMood] = useState<CheckIn["mood"] | null>(existing?.mood ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [applied, setApplied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const showForm = !existing || editing;
  const moodLabel: Record<CheckIn["mood"], string> = {
    good: t.checkin.moodGood,
    ok: t.checkin.moodOk,
    hard: t.checkin.moodHard,
  };

  const habits = state.habits.filter((h) => !h.archived);
  const habitLines = habits.map((h) => ({
    title: h.title,
    slot: h.slot,
    doneToday: isDone(h.id),
  }));
  const recentNotes = state.checkIns
    .filter((c) => c.date !== today() && c.note)
    .slice(-5)
    .reverse()
    .map((c) => c.note);

  // Only ask Claude once the recap is saved, and re-ask when its content
  // changes — the key carries everything the answer depends on.
  const key = existing
    ? `${existing.date}|${existing.mood}|${existing.note}|${habitLines.map((h) => `${h.title}:${h.doneToday}`).join(",")}`
    : null;

  const { value: reply } = useAi(key, (signal) =>
    askRecapReply(
      {
        name: state.profile.name,
        mood: moodLabel[existing?.mood ?? "ok"],
        note: existing?.note ?? "",
        habits: habitLines,
        recentNotes,
      },
      locale,
      signal,
    ),
  );

  function save() {
    if (!mood) return;
    addCheckIn({ mood, note: note.trim() });
    setEditing(false);
    setApplied(false);
    setDismissed(false);
  }

  // Leaving edit mode has to be possible without saving, and the form goes back
  // to the recap as it stands rather than keeping the abandoned draft.
  function cancelEdit() {
    setMood(existing?.mood ?? null);
    setNote(existing?.note ?? "");
    setEditing(false);
  }

  function describe(adj: Adjustment): string | null {
    const habit = habits.find((h) => h.title === adj.habitTitle);
    if (!habit) return null;
    if (adj.kind === "smaller" && adj.newTitle) {
      return fill(t.recap.kindSmaller, { habit: habit.title, value: adj.newTitle });
    }
    if (adj.kind === "reschedule" && adj.slot && SLOT_WORDS[adj.slot]) {
      return fill(t.recap.kindReschedule, {
        habit: habit.title,
        value: t.slots[SLOT_WORDS[adj.slot] as "morning"],
      });
    }
    if (adj.kind === "anchor" && adj.anchor) {
      return fill(t.recap.kindAnchor, { habit: habit.title, value: adj.anchor });
    }
    return null;
  }

  function apply(adj: Adjustment) {
    const habit = habits.find((h) => h.title === adj.habitTitle);
    if (!habit) return;
    if (adj.kind === "smaller" && adj.newTitle) {
      updateHabit(habit.id, { title: adj.newTitle });
    } else if (adj.kind === "reschedule" && adj.slot && SLOT_WORDS[adj.slot]) {
      updateHabit(habit.id, { slot: SLOT_WORDS[adj.slot] });
    } else if (adj.kind === "anchor" && adj.anchor) {
      updateHabit(habit.id, { anchor: adj.anchor });
    } else {
      // Nothing was changed — an "applied" note here would confirm a change
      // that never happened.
      return;
    }
    setApplied(true);
  }

  const suggestion = reply && reply.adjustment.kind !== "none" ? describe(reply.adjustment) : null;

  // The evening reply the device writes itself, from mood and the day's ticks.
  // It shows the moment a recap is saved, with no server in the loop; Claude's
  // reply, which also remembers yesterday, replaces it when it arrives.
  const localReply = existing
    ? recapReply(
        {
          name: state.profile.name,
          mood: existing.mood,
          doneCount: habitLines.filter((h) => h.doneToday).length,
          total: habitLines.length,
        },
        t.insight,
      ).reply
    : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.checkin.heading} subtitle={t.checkin.body}>
        {showForm ? (
          <Card>
            <View style={{ gap: space.sm }}>
              <Text style={[type.label, { color: colors.inkFaint }]}>{t.checkin.moodQ}</Text>
              <View style={{ flexDirection: "row", gap: space.sm }}>
                {MOODS.map((m) => (
                  <Chip
                    key={m}
                    label={moodLabel[m]}
                    selected={mood === m}
                    onPress={() => setMood(m)}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <Text style={[type.label, { color: colors.inkFaint }]}>{t.checkin.noteQ}</Text>
              <TextField
                value={note}
                onChangeText={setNote}
                placeholder={t.checkin.notePlaceholder}
                multiline
              />
            </View>

            <View style={{ gap: space.sm, marginTop: space.lg }}>
              {/* Save is greyed until a mood is picked — say which tap is missing. */}
              {!mood ? (
                <Text style={[type.small, { color: colors.alert, textAlign: "center" }]}>
                  {t.checkin.needMood}
                </Text>
              ) : null}
              <Button icon="checkmark" label={t.checkin.save} onPress={save} disabled={!mood} />
              {editing ? (
                <Button label={t.common.cancel} tone="quiet" onPress={cancelEdit} />
              ) : null}
            </View>
          </Card>
        ) : (
          <>
            <Card label={t.checkin.todayDone} tone="accent">
              <Text style={[type.title, { color: colors.ink }]}>{moodLabel[existing.mood]}</Text>
              {existing.note ? (
                <Text style={[type.body, { color: colors.inkSoft }]}>{existing.note}</Text>
              ) : null}
              <Button
                label={t.checkin.edit}
                tone="quiet"
                onPress={() => {
                  // Pre-fill from the saved recap at the moment of editing, not
                  // from a render before the store had loaded — otherwise the
                  // form opened on the defaults and quietly overwrote the mood
                  // and note the person had actually saved.
                  if (existing) {
                    setMood(existing.mood);
                    setNote(existing.note);
                  }
                  setEditing(true);
                }}
                style={{ marginTop: space.md }}
              />
            </Card>

            <Card label={t.recap.replyTitle} tone="accent">
              <View style={{ gap: space.sm }}>
                {reply ? <AiBadge /> : null}
                <Text style={[type.body, { color: colors.ink }]}>
                  {reply ? reply.reply : localReply}
                </Text>
              </View>
            </Card>

            {reply && suggestion && !applied && !dismissed ? (
              <Card label={t.recap.adjustTitle} tone="accent">
                <Text style={[type.bodyStrong, { color: colors.ink }]}>{suggestion}</Text>
                {reply.adjustment.reason ? (
                  <Text style={[type.small, { color: colors.inkSoft }]}>
                    {reply.adjustment.reason}
                  </Text>
                ) : null}
                <View style={{ gap: space.sm, marginTop: space.md }}>
                  <Button icon="sparkles" label={t.recap.accept} onPress={() => apply(reply.adjustment)} />
                  <Button
                    label={t.recap.dismiss}
                    tone="quiet"
                    onPress={() => setDismissed(true)}
                  />
                </View>
              </Card>
            ) : null}

            {applied ? (
              <Card tone="accent">
                <Text style={[type.bodyStrong, { color: colors.ink }]}>{t.recap.applied}</Text>
              </Card>
            ) : null}

            {reply && !suggestion ? (
              <Text style={[type.small, { color: colors.inkFaint }]}>
                {t.recap.nothingToChange}
              </Text>
            ) : null}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
