import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Screen } from "@/components/Screen";
import { StubNote } from "@/components/StubNote";
import { TextField } from "@/components/TextField";
import { useI18n } from "@/i18n";
import { today, useStore, type CheckIn } from "@/store";
import { useTheme } from "@/theme";

const MOODS: CheckIn["mood"][] = ["good", "ok", "hard"];

export default function CheckinScreen() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const { state, addCheckIn } = useStore();

  const existing = state.checkIns.find((c) => c.date === today());
  const [editing, setEditing] = useState(false);
  const [mood, setMood] = useState<CheckIn["mood"]>(existing?.mood ?? "ok");
  const [note, setNote] = useState(existing?.note ?? "");

  const showForm = !existing || editing;

  const moodLabel: Record<CheckIn["mood"], string> = {
    good: t.checkin.moodGood,
    ok: t.checkin.moodOk,
    hard: t.checkin.moodHard,
  };

  function save() {
    addCheckIn({ mood, note: note.trim() });
    setEditing(false);
  }

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

            <Button label={t.checkin.save} onPress={save} style={{ marginTop: space.lg }} />
          </Card>
        ) : (
          <Card label={t.checkin.todayDone} tone="accent">
            <Text style={[type.title, { color: colors.ink }]}>{moodLabel[existing.mood]}</Text>
            {existing.note ? (
              <Text style={[type.body, { color: colors.inkSoft }]}>{existing.note}</Text>
            ) : null}
            <Text style={[type.small, { color: colors.inkSoft, marginTop: space.xs }]}>
              {t.checkin.saved}
            </Text>
            <Button
              label={t.checkin.edit}
              tone="quiet"
              onPress={() => setEditing(true)}
              style={{ marginTop: space.md }}
            />
          </Card>
        )}

        <StubNote>{t.checkin.aiNote}</StubNote>
      </Screen>
    </KeyboardAvoidingView>
  );
}
