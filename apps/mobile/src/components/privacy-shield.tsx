import { useEffect, useState } from 'react';
import { AppState, Image, Platform, StyleSheet, Text, View } from 'react-native';
import railCommandMark from '../../assets/images/icon.png';
import { colors, fonts } from '@/theme';

export function PrivacyShield() {
  const [concealed, setConcealed] = useState(
    Platform.OS !== 'web' && AppState.currentState !== 'active',
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      setConcealed(state !== 'active');
    });
    return () => subscription.remove();
  }, []);

  if (!concealed) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.shield}
    >
      <Image
        alt=""
        accessibilityIgnoresInvertColors
        accessible={false}
        source={railCommandMark}
        style={styles.mark}
      />
      <Text allowFontScaling={false} style={styles.name}>RailCommand</Text>
      <Text allowFontScaling={false} style={styles.detail}>Field work protected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shield: {
    position: 'absolute',
    inset: 0,
    zIndex: 10_000,
    elevation: 10_000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.ink,
  },
  mark: { width: 76, height: 76 },
  name: { color: colors.white, fontFamily: fonts.headingHeavy, fontSize: 24, lineHeight: 30 },
  detail: { color: '#CBD5E1', fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1.2 },
});
