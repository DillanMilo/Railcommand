export function selectModel(messages: { role: string; content: string }[]): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() ?? '';

  const complexKeywords = [
    'summarize',
    'summary',
    'analyze',
    'compare',
    'explain why',
    'what should',
    'recommend',
    'trend',
    'pattern',
    'blocking',
    'impact',
  ];
  const isComplex =
    complexKeywords.some((k) => lastMessage.includes(k)) || messages.length > 6;

  return isComplex ? 'gpt-4.1' : 'gpt-4.1-mini';
}
