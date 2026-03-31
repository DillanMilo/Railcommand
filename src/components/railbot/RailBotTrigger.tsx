'use client';

import { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import RailBotPanel from './RailBotPanel';

export default function RailBotTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Trigger the pulse animation once after mount
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-rc-orange text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95',
          // Position: above mobile nav on small screens
          'bottom-20 right-4 md:bottom-6 md:right-6',
          // Hide when panel is open
          isOpen && 'pointer-events-none scale-0 opacity-0',
        )}
        aria-label="Open RailBot chat"
      >
        <Bot className="h-6 w-6" />

        {/* Pulse ring - only shows before first interaction */}
        {!hasAnimated && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rc-orange opacity-30" />
        )}
      </button>

      {/* Chat panel */}
      <RailBotPanel open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
