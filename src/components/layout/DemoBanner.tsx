'use client';

import { useState } from 'react';
import { X, FlaskConical } from 'lucide-react';

/**
 * Subtle banner shown only for the internal team demo session.
 */
export default function DemoBanner({ demoSlug }: { demoSlug: string | null }) {
  const [dismissed, setDismissed] = useState(false);

  if (demoSlug !== 'team' || dismissed) return null;

  return (
    <div className="bg-rc-orange/10 border-b border-rc-orange/20 px-4 py-1.5 flex items-center justify-center gap-2 text-sm">
      <FlaskConical className="size-3.5 text-rc-orange shrink-0" />
      <span className="text-rc-orange font-medium">Demo Mode</span>
      <span className="text-muted-foreground hidden sm:inline">
        — This is a sandbox environment with sample data
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
