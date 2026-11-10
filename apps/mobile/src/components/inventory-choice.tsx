import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme";
export function InventoryChoice({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={{ gap: 8, marginVertical: 8 }}>
      <Text style={{ fontWeight: "600", color: colors.ink }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: option.value === value, disabled }}
            accessibilityLabel={`${label}: ${option.label}`}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 48,
              padding: 12,
              borderWidth: 1,
              borderColor:
                option.value === value ? colors.ink : colors.controlLine,
              borderRadius: 8,
              backgroundColor:
                option.value === value ? "#E8F8F1" : colors.paper,
            }}
          >
            <Text style={{ color: colors.ink }}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
