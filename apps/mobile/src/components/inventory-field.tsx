import { Text, TextInput, View } from "react-native";
import { uiStyles } from "./ui";
import { colors } from "@/theme";
export function InventoryField({
  label,
  value,
  onChange,
  numeric,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 6, marginVertical: 6 }}>
      <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        editable={!disabled}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        style={uiStyles.input}
      />
    </View>
  );
}
