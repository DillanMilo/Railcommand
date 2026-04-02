'use client';

import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
}

/** Lightweight inline markdown renderer — handles bold, italic, code blocks, inline code, lists, and line breaks. */
function renderMarkdown(text: string) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <pre
          key={blocks.length}
          className="my-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-sm text-gray-100 dark:bg-gray-950"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Unordered list item
    if (/^\s*[-*]\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        listItems.push(
          <li key={listItems.length}>{inlineFormat(lines[i].replace(/^\s*[-*]\s/, ''))}</li>,
        );
        i++;
      }
      blocks.push(
        <ul key={blocks.length} className="my-1 ml-4 list-disc space-y-0.5">
          {listItems}
        </ul>,
      );
      continue;
    }

    // Ordered list item
    if (/^\s*\d+\.\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        listItems.push(
          <li key={listItems.length}>
            {inlineFormat(lines[i].replace(/^\s*\d+\.\s/, ''))}
          </li>,
        );
        i++;
      }
      blocks.push(
        <ol key={blocks.length} className="my-1 ml-4 list-decimal space-y-0.5">
          {listItems}
        </ol>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      blocks.push(<div key={blocks.length} className="h-2" />);
      i++;
      continue;
    }

    // Normal paragraph
    blocks.push(
      <p key={blocks.length} className="leading-relaxed">
        {inlineFormat(line)}
      </p>,
    );
    i++;
  }

  return blocks;
}

/** Handles inline formatting: **bold**, *italic*, `code` */
function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={parts.length}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={parts.length}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code
          key={parts.length}
          className="rounded bg-gray-200 px-1.5 py-0.5 text-sm dark:bg-gray-700"
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : parts;
}

export function ChatMessageBubble({ role, content, isStreaming, timestamp }: ChatMessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rc-navy text-white">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div className="max-w-[90%] sm:max-w-[85%]">
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'rounded-br-md bg-rc-orange text-white'
              : 'rounded-bl-md bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
          )}
        >
          {content === '' && isStreaming ? (
            <div className="flex items-center gap-1.5 py-1">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-gray-400">Thinking...</span>
            </div>
          ) : (
            <>
              <div className="space-y-1">{renderMarkdown(content)}</div>
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-current opacity-70" />
              )}
            </>
          )}
        </div>
        {timestamp && (
          <p className={cn(
            'mt-0.5 text-[10px]',
            isUser ? 'text-right text-gray-400 dark:text-gray-500' : 'text-gray-400 dark:text-gray-500 ml-9',
          )}>
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
