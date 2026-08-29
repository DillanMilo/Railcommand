import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, type ColorValue } from 'react-native';
import { colors, fonts } from '@/theme';

const tabSymbols = {
  index: { ios: 'square.grid.2x2.fill', android: 'dashboard', web: 'dashboard' },
  submittals: { ios: 'doc.text.fill', android: 'description', web: 'description' },
  rfis: { ios: 'exclamationmark.bubble.fill', android: 'chat', web: 'chat' },
  logs: { ios: 'doc.text.fill', android: 'description', web: 'description' },
  sync: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  account: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  more: { ios: 'ellipsis.circle.fill', android: 'more_horiz', web: 'more_horiz' },
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
    <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarAccessibilityLabel: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon name="index" color={color} /> }} />
    <Tabs.Screen name="submittals" options={{ title: 'Submittals', tabBarAccessibilityLabel: 'Submittals', tabBarIcon: ({ color }) => <TabIcon name="submittals" color={color} /> }} />
    <Tabs.Screen name="rfis" options={{ title: 'RFIs', tabBarAccessibilityLabel: 'RFIs', tabBarIcon: ({ color }) => <TabIcon name="rfis" color={color} /> }} />
    <Tabs.Screen name="logs" options={{ title: 'Logs', tabBarAccessibilityLabel: 'Daily logs', tabBarIcon: ({ color }) => <TabIcon name="logs" color={color} /> }} />
    <Tabs.Screen name="more" options={{ title: 'More', tabBarAccessibilityLabel: 'More RailCommand modules', tabBarIcon: ({ color }) => <TabIcon name="more" color={color} /> }} />
    <Tabs.Screen name="sync" options={{ href: null }} />
    <Tabs.Screen name="account" options={{ href: null }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  bar: { minHeight: 68, paddingTop: 7, paddingBottom: 7, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 0, shadowOffset: { width: 0, height: -2 }, elevation: 5 },
  item: { minHeight: 54 },
  label: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 14 },
  symbol: { width: 22, height: 22 },
});
