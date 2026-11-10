import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { SecondaryButton } from "./ui";
/** Keep mounted input intact when folding a section. */
export function InventoryDisclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <SecondaryButton
        title={`${open ? "Hide" : "Show"} ${title}`}
        expanded={open}
        onPress={() => setOpen((v) => !v)}
      />
      <View
        style={{ display: open ? "flex" : "none", gap: 10 }}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      >
        {children}
      </View>
    </View>
  );
}
