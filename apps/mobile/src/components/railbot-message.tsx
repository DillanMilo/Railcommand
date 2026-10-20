import { Text, View, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';
function Inline({ text }: { text: string }) {
  return <Text selectable style={styles.text}>{text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, index) => part.startsWith('**') ? <Text key={index} style={styles.bold}>{part.slice(2, -2)}</Text> : part.startsWith('`') ? <Text key={index} style={styles.code}>{part.slice(1, -1)}</Text> : part.startsWith('*') && part.endsWith('*') ? <Text key={index} style={styles.italic}>{part.slice(1, -1)}</Text> : part)}</Text>;
}
export function RailBotMessage({ text }: { text: string }) {
  return <View>{text.split(/```[^\n]*\n([\s\S]*?)```/g).map((block, index) => index % 2 ? <Text key={index} selectable style={[styles.text, styles.codeBlock]}>{block}</Text> : <View key={index}>{block.split('\n').map((line, i) => <Inline key={i} text={line.replace(/^\s*[-*]\s/, '• ').replace(/^#{1,6}\s+/, '') || ' '} />)}</View>)}</View>;
}
const styles = StyleSheet.create({ text: { color: colors.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 }, bold: { fontFamily: fonts.bodyBold }, italic: { fontStyle: 'italic' }, code: { fontFamily: fonts.mono, backgroundColor: '#E2E8F0' }, codeBlock: { fontFamily: fonts.mono, backgroundColor: '#E2E8F0', padding: 10, marginVertical: 6 } });
