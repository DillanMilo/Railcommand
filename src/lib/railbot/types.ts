import type { ProjectMember, Profile } from '@/lib/types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Conversation {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  created_at: string;
}

export interface RailBotContext {
  profile: Profile;
  membership: ProjectMember;
  permissions: string[];
  projectId: string;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'conversation';
  content?: string;
  conversationId?: string;
  toolCall?: { id: string; name: string; arguments: string };
  toolResult?: { id: string; result: string };
  error?: string;
}
