'use client';

import { useState, useEffect } from 'react';
import { X, FlaskConical } from 'lucide-react';

/**
 * Subtle banner shown when the user is in an enterprise demo session.
 * Reads the rc-demo-slug cookie to determine if active.
 */
export default function DemoBanner() {
  const [slug, setSlug] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(/rc-demo-slug=([^;]+)/);
    if (match) {
      setSlug(match[1]);
    }
  }, []);

  if (!slug || dismissed) return null;

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
