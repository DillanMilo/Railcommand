export type BotMessage = { role: 'user' | 'assistant'; content: string };
export type BotProposal = { id: string; name: string; arguments: Record<string, unknown> };
export type BotDraft = { version: 1; projectId: string; input: string; conversationId: string | null; messages: BotMessage[]; proposal: BotProposal | null; audioUri: string | null; uncertain: boolean; aiConsent?: boolean };
export const botPrompts = ["What's new?", 'Summarize my notifications', 'Show me the project summary', 'Show me overdue items', 'Summarize project status', 'How many open RFIs?', 'What milestones are coming up?', "Summarize this week's work"];
export function newBotDraft(projectId: string): BotDraft { return { version: 1, projectId, input: '', conversationId: null, messages: [], proposal: null, audioUri: null, uncertain: false }; }
export function parseBotDraft(raw: string, projectId: string): BotDraft {
  const value = JSON.parse(raw) as BotDraft;
  if (value.version !== 1 || value.projectId !== projectId || typeof value.input !== 'string' || !Array.isArray(value.messages) || value.messages.some(m => !['user','assistant'].includes(m.role) || typeof m.content !== 'string')) throw new Error('Saved RailBot draft could not be read. It has not been deleted.');
  return value;
}
// Native streams may split JSON and UTF-8 anywhere. Do not treat truncated streams as success.
export function createBotStreamParser(accept: (chunk: Record<string, any>) => void) {
  let buffer = '';
  return (text: string) => {
    buffer += text;
    if (buffer.length > 1024 * 1024) throw new Error('RailBot response is too large.');
    const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
    for (const line of lines) if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data !== '[DONE]') accept(JSON.parse(data));
    }
  };
}
export function serializeBotDraft(value: BotDraft): string {
  const raw = JSON.stringify(value);
  if (new TextEncoder().encode(raw).length > 512 * 1024) throw new Error('RailBot device storage limit reached. Keep your input and start a new chat when online.');
  return raw;
}
