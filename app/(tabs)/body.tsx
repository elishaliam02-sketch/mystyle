import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { BODY_PARTS, MAX_CM, MIN_CM, measureChange, type BodyPart } from "@/body";
import { fill, useI18n } from "@/i18n";
import { useStore } from "@/store";
import { useTheme } from "@/theme";

export default function BodyScreen() {
  const { t } = useI18n();
  const { space } = useTheme();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.body.heading} subtitle={t.body.body}>
        <View style={{ gap: space.lg }}>
          {BODY_PARTS.map((part) => (
            <PartCard key={part} part={part} />
          ))}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const { colors, radius } = useTheme();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 44 }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 8 + ((v - min) / range) * 34,
            borderRadius: radius.sm,
            backgroundColor: i === values.length - 1 ? colors.accent : colors.accentWash,
          }}
        />
      ))}
    </View>
  );
}

function PartCard({ part }: { part: BodyPart }) {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const { addMeasurement, measurementSeries } = useStore();

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const series = measurementSeries(part);
  const change = measureChange(series);
  const label = t.body.parts[part];

  function save() {
    const cm = Number(draft.replace(",", "."));
    if (!Number.isFinite(cm) || cm < MIN_CM || cm > MAX_CM) {
      setError(fill(t.body.rangeError, { min: MIN_CM, max: MAX_CM }));
      return;
    }
    addMeasurement(part, cm);
    setDraft("");
    setError(null);
  }

  const down = change.delta < 0;
  const up = change.delta > 0;

  return (
    <Card label={label}>
      {change.latest !== null ? (
        <View style={{ flexDirection: "row", gap: space.xl, alignItems: "flex-end" }}>
          <View>
            <Text style={[type.label, { color: colors.inkFaint }]}>{t.body.latest}</Text>
            <Text style={[type.figure, { color: colors.ink }]}>
              {change.latest}
              <Text style={[type.small, { color: colors.inkFaint }]}> {t.body.cm}</Text>
            </Text>
          </View>
          {change.count > 1 ? (
            <View>
              <Text style={[type.label, { color: colors.inkFaint }]}>{t.body.change}</Text>
              <Text
                style={[
                  type.title,
                  { color: down ? colors.accent : up ? colors.amber : colors.inkSoft },
                ]}
              >
                {up ? "+" : ""}
                {change.delta} {t.body.cm}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Sparkline values={series.map((r) => r.cm)} />
          </View>
        </View>
      ) : (
        <Text style={[type.small, { color: colors.inkFaint }]}>{t.body.empty}</Text>
      )}

      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start", marginTop: space.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              if (error) setError(null);
            }}
            placeholder={t.body.cmPlaceholder}
            keyboardType="numeric"
            onSubmitEditing={save}
          />
        </View>
        <View style={{ width: 120 }}>
          <Button icon="add" label={t.body.add} onPress={save} disabled={!draft.trim()} />
        </View>
      </View>
      {error ? (
        <Text style={[type.small, { color: colors.alert, marginTop: space.xs }]}>{error}</Text>
      ) : null}
      {change.count > 0 ? (
        <Text style={[type.small, { color: colors.inkFaint, marginTop: space.xs }]}>
          {fill(t.body.readings, { count: change.count })}
        </Text>
      ) : null}
    </Card>
  );
}
