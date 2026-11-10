import { View } from 'react-native';

/** Platform-independent robot mark, matching the web assistant rather than an SF vacuum. */
export function RailBotIcon({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const unit = size / 24;
  return <View accessible={false} pointerEvents="none" style={{ width: size, height: size }}>
    <View style={{ position: 'absolute', left: 11 * unit, top: 2 * unit, width: 2 * unit, height: 5 * unit, backgroundColor: color }} />
    <View style={{ position: 'absolute', left: 9 * unit, top: unit, width: 4 * unit, height: 2 * unit, borderRadius: unit, backgroundColor: color }} />
    <View style={{ position: 'absolute', left: 4 * unit, top: 7 * unit, width: 16 * unit, height: 13 * unit, borderRadius: 3 * unit, borderWidth: 2 * unit, borderColor: color }} />
    {[8, 14].map(left => <View key={left} style={{ position: 'absolute', left: left * unit, top: 12 * unit, width: 2 * unit, height: 4 * unit, borderRadius: unit, backgroundColor: color }} />)}
    {[unit, 21 * unit].map(left => <View key={left} style={{ position: 'absolute', left, top: 11 * unit, width: 2 * unit, height: 5 * unit, borderRadius: unit, backgroundColor: color }} />)}
  </View>;
}
