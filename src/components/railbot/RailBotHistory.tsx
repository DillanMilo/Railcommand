'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/components/providers/ProjectProvider';
import type { Conversation } from '@/lib/railbot/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RailBotHistoryProps {
  onSelectConversation: (conversationId: string, messages: Message[]) => void;
  onBack: () => void;
}

interface ConversationWithCount extends Conversation {
  message_count?: number;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function RailBotHistory({ onSelectConversation, onBack }: RailBotHistoryProps) {
  const { currentProjectId } = useProject();
  const [conversations, setConversations] = useState<ConversationWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations?projectId=${currentProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // Silently fail — empty state will show
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelect = async (conversationId: string) => {
    setLoadingId(conversationId);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        const messages: Message[] = (data.messages ?? [])
          .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
          .map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));
        onSelectConversation(conversationId, messages);
      }
    } catch {
      // Failed to load conversation
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setDeletingId(conversationId);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      }
    } catch {
      // Failed to delete
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          title="Back to chat"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Chat History
        </h2>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              No previous conversations
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Start a new chat to see it here
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {conversations.map((convo) => (
              <li key={convo.id} className="group">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !loadingId && handleSelect(convo.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!loadingId) handleSelect(convo.id);
                    }
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer',
                    loadingId === convo.id && 'opacity-60',
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rc-orange/10 text-rc-orange">
                    {loadingId === convo.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {convo.title || 'Untitled conversation'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>{formatRelativeTime(convo.updated_at)}</span>
                      {convo.message_count != null && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">&middot;</span>
                          <span>
                            {convo.message_count} message{convo.message_count !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, convo.id)}
                    disabled={deletingId === convo.id}
                    className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-gray-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title="Delete conversation"
                  >
                    {deletingId === convo.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
