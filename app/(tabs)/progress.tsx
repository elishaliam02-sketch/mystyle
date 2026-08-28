import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, useI18n } from "@/i18n";
import { useStore, type WeighIn } from "@/store";
import { useTheme } from "@/theme";

function TrendChart({ values }: { values: WeighIn[] }) {
  const { colors, space, radius } = useTheme();
  const kgs = values.map((v) => v.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const range = max - min || 1;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: space.sm,
        height: 110,
        marginTop: space.sm,
      }}
      accessibilityRole="image"
      accessibilityLabel={`${values.length} readings from ${max} to ${min} kilograms`}
    >
      {values.map((v, index) => (
        <View
          key={v.date}
          style={{
            flex: 1,
            height: 20 + ((v.kg - min) / range) * 80,
            borderRadius: radius.sm,
            backgroundColor: index === values.length - 1 ? colors.accent : colors.accentWash,
          }}
        />
      ))}
    </View>
  );
}

export default function ProgressScreen() {
  const { t } = useI18n();
  const { colors, space, type } = useTheme();
  const { state, addWeighIn, weeklyConsistency } = useStore();

  const [kg, setKg] = useState("");

  const weighIns = state.weighIns;
  const latest = weighIns[weighIns.length - 1];
  const first = weighIns[0];
  const delta = latest && first ? latest.kg - first.kg : 0;
  const consistency = Math.round(weeklyConsistency() * 100);

  function save() {
    const value = Number(kg.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    addWeighIn(value);
    setKg("");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen title={t.progress.heading}>
        <Card label={t.progress.weighTitle}>
          <Text style={[type.small, { color: colors.inkSoft }]}>{t.progress.weighBody}</Text>

          {latest ? (
            <View style={{ flexDirection: "row", gap: space.xl, marginTop: space.md }}>
              <View>
                <Text style={[type.label, { color: colors.inkFaint }]}>{t.progress.latest}</Text>
                <Text style={[type.display, { color: colors.ink }]}>{latest.kg} kg</Text>
              </View>
              {weighIns.length > 1 ? (
                <View>
                  <Text style={[type.label, { color: colors.inkFaint }]}>{t.progress.change}</Text>
                  <Text
                    style={[
                      type.display,
                      { color: delta <= 0 ? colors.accent : colors.signal },
                    ]}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={[type.body, { color: colors.inkFaint, marginTop: space.sm }]}>
              {t.progress.weighEmpty}
            </Text>
          )}

          <View style={{ gap: space.sm, marginTop: space.lg }}>
            <TextField
              value={kg}
              onChangeText={setKg}
              placeholder={t.progress.weighPlaceholder}
              keyboardType="numeric"
              onSubmitEditing={save}
            />
            <Button label={t.progress.weighSave} onPress={save} disabled={!kg.trim()} />
          </View>
        </Card>

        <Card label={t.progress.trendTitle}>
          {weighIns.length >= 2 ? (
            <TrendChart values={weighIns} />
          ) : (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {t.progress.trendNeedMore}
            </Text>
          )}
        </Card>

        <Card label={t.progress.consistencyTitle}>
          {state.habits.filter((h) => !h.archived).length > 0 ? (
            <Text style={[type.display, { color: colors.ink }]}>
              {fill(t.progress.consistencyValue, { percent: consistency })}
            </Text>
          ) : (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {t.progress.consistencyEmpty}
            </Text>
          )}
        </Card>

        <Card label={t.progress.checkinsTitle}>
          <Text style={[type.title, { color: colors.ink }]}>
            {fill(t.progress.checkinsValue, { count: state.checkIns.length })}
          </Text>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
