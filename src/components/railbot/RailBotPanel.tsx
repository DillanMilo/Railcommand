'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Bot, Plus, Send, Loader2, History, Mic, Square, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/components/providers/ProjectProvider';
import { ChatMessageBubble } from './ChatMessageBubble';
import RailBotHistory from './RailBotHistory';
import SoundWaveAnimation from './SoundWaveAnimation';
import type { StreamChunk } from '@/lib/railbot/types';

interface RailBotPanelProps {
  open: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const MAX_INPUT_LENGTH = 2000;

const SUGGESTED_PROMPTS = [
  'What\'s new?',
  'Show me the project summary',
  'Show me overdue items',
  'Summarize project status',
  'How many open RFIs?',
  'What milestones are coming up?',
  'Summarize this week\'s work',
];

export default function RailBotPanel({ open, onClose }: RailBotPanelProps) {
  const { currentProjectId, isDemo, currentUserId } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > MAX_INPUT_LENGTH) return;
    setInput(value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const res = await fetch('/api/chat/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const { text } = await res.json();
            if (text?.trim()) {
              setInput(text.trim());
            }
          }
        } catch (err) {
          console.error('Transcription failed:', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = (text ?? input).trim();
      if (!messageText || isStreaming) return;

      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const userMessage: Message = { role: 'user', content: messageText, timestamp: new Date() };
      const updatedMessages = [...messages, userMessage];
      setMessages([...updatedMessages, { role: 'assistant', content: '', timestamp: new Date() }]);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const apiMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            projectId: currentProjectId,
            isDemo,
            demoUserId: isDemo ? currentUserId : undefined,
            conversationId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          if (response.status === 401) throw new Error('Please sign in to use RailBot');
          if (response.status === 403) throw new Error('You don\'t have access to this project');
          if (response.status === 429) throw new Error('Too many messages. Please wait a moment');
          if (response.status === 502) throw new Error('RailBot is temporarily unavailable');
          throw new Error(`Request failed (${response.status}). Please try again`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const chunk: StreamChunk = JSON.parse(data);
                if (chunk.type === 'conversation' && chunk.conversationId) {
                  setConversationId(chunk.conversationId);
                } else if (chunk.type === 'text' && chunk.content) {
                  assistantContent += chunk.content;
                  setMessages([
                    ...updatedMessages,
                    { role: 'assistant', content: assistantContent, timestamp: new Date() },
                  ]);
                } else if (chunk.type === 'error' && chunk.error) {
                  assistantContent += `\n\n**Error:** ${chunk.error}`;
                  setMessages([
                    ...updatedMessages,
                    { role: 'assistant', content: assistantContent, timestamp: new Date() },
                  ]);
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        }

        // Finalize
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: assistantContent || 'Sorry, I didn\'t get a response. Please try again.', timestamp: new Date() },
        ]);
        setLastFailedMessage(null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setLastFailedMessage(messageText);
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: `**Something went wrong.** ${errorMessage}.`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [input, isStreaming, messages, currentProjectId, isDemo, currentUserId, conversationId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setInput('');
    setIsStreaming(false);
    setConversationId(null);
    setShowHistory(false);
    setLastFailedMessage(null);
  };

  const handleSelectConversation = (id: string, msgs: { role: 'user' | 'assistant'; content: string }[]) => {
    setConversationId(id);
    setMessages(msgs.map(m => ({ ...m, timestamp: new Date() })));
    setShowHistory(false);
    setInput('');
    setIsStreaming(false);
    setLastFailedMessage(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-gray-900 sm:w-[420px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rc-navy text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                RailBot
              </h2>
              <p className="hidden text-xs text-gray-500 sm:block dark:text-gray-400">
                AI Project Assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              title="New chat"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </button>
            {!isDemo && (
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                  showHistory && 'bg-gray-100 text-rc-orange dark:bg-gray-800 dark:text-rc-orange',
                )}
                title="Chat history"
              >
                <History className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* History view */}
        {showHistory && !isDemo ? (
          <RailBotHistory
            onSelectConversation={handleSelectConversation}
            onBack={() => setShowHistory(false)}
          />
        ) : (
        <>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rc-orange/10 text-rc-orange">
                <Bot className="h-8 w-8" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                Hi, I&apos;m RailBot
              </h3>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                Your AI assistant for this project. Ask me anything about schedules, RFIs, submittals, and more.
              </p>
              <div className="flex w-full flex-col gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:border-rc-orange/40 hover:bg-rc-orange/5 dark:border-gray-700 dark:text-gray-300 dark:hover:border-rc-orange/40 dark:hover:bg-rc-orange/5"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <ChatMessageBubble
                  key={idx}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={
                    isStreaming &&
                    idx === messages.length - 1 &&
                    msg.role === 'assistant'
                  }
                  timestamp={msg.timestamp}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Retry button */}
        {lastFailedMessage && !isStreaming && (
          <div className="px-4 pb-2">
            <button
              onClick={() => {
                const retryText = lastFailedMessage;
                setLastFailedMessage(null);
                setMessages(prev => prev.slice(0, -1));
                sendMessage(retryText);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <RotateCcw className="h-3 w-3" />
              Retry last message
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-gray-200 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-gray-700">
          <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-rc-orange/50 focus-within:ring-2 focus-within:ring-rc-orange/20 dark:border-gray-700 dark:bg-gray-800">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)}
              placeholder="Ask RailBot..."
              rows={1}
              disabled={isStreaming}
              className="max-h-[120px] flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {/* Mic button */}
            {isRecording ? (
              <div className="flex items-center gap-1.5">
                <SoundWaveAnimation />
                <button
                  onClick={stopRecording}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
                  title="Stop recording"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              </div>
            ) : isTranscribing ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-rc-orange" />
              </div>
            ) : (
              <button
                onClick={startRecording}
                disabled={isStreaming}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                  isStreaming
                    ? 'text-gray-300 dark:text-gray-600'
                    : 'text-gray-400 hover:text-rc-orange hover:bg-rc-orange/10 dark:text-gray-500 dark:hover:text-rc-orange',
                )}
                title="Voice input"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            {/* Send button */}
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                input.trim() && !isStreaming
                  ? 'bg-rc-orange text-white hover:bg-rc-orange/90'
                  : 'text-gray-300 dark:text-gray-600',
              )}
              title="Send (Cmd+Enter)"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-gray-400 dark:text-gray-500">
            {input.length > MAX_INPUT_LENGTH - 200 && (
              <span className={cn('mr-2', input.length > MAX_INPUT_LENGTH - 50 ? 'text-red-400' : '')}>
                {input.length}/{MAX_INPUT_LENGTH}
              </span>
            )}
            Enter to send · Shift+Enter for new line
          </p>
        </div>
        </>
        )}
      </div>
    </>
  );
}
