import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, type ColorValue } from 'react-native';
import { colors, fonts } from '@/theme';

const tabSymbols = {
  index: { ios: 'square.grid.2x2.fill', android: 'dashboard', web: 'dashboard' },
  logs: { ios: 'doc.text.fill', android: 'description', web: 'description' },
  sync: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  account: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
} as const;

function TabIcon({ name, color }: { name: keyof typeof tabSymbols; color: ColorValue }) {
  return <SymbolView accessible={false} name={tabSymbols[name]} tintColor={color} size={21} style={styles.symbol} />;
}

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.orangeText, tabBarInactiveTintColor: colors.muted,
    tabBarHideOnKeyboard: true,
    tabBarLabelStyle: styles.label,
    tabBarItemStyle: styles.item,
    tabBarStyle: styles.bar }}>
    <Tabs.Screen name="index" options={{ title: 'Overview', tabBarAccessibilityLabel: 'Overview', tabBarIcon: ({ color }) => <TabIcon name="index" color={color} /> }} />
    <Tabs.Screen name="logs" options={{ title: 'Logs', tabBarAccessibilityLabel: 'Daily logs', tabBarIcon: ({ color }) => <TabIcon name="logs" color={color} /> }} />
    <Tabs.Screen name="sync" options={{ title: 'Sync', tabBarAccessibilityLabel: 'Sync Center', tabBarIcon: ({ color }) => <TabIcon name="sync" color={color} /> }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarAccessibilityLabel: 'Account', tabBarIcon: ({ color }) => <TabIcon name="account" color={color} /> }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  bar: { minHeight: 68, paddingTop: 7, paddingBottom: 7, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 0, shadowOffset: { width: 0, height: -2 }, elevation: 5 },
  item: { minHeight: 54 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 15 },
  symbol: { width: 22, height: 22 },
});
