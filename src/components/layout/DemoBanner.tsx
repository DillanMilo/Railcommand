'use client';

import { useEffect, useState } from 'react';
import { X, FlaskConical } from 'lucide-react';
import { PUBLIC_DEMO_ACCESS_DAYS } from '@/lib/demo/constants';

/**
 * Identifies public browser demos and invite-only Supabase demo sessions.
 */
export default function DemoBanner({ demoSlug }: { demoSlug: string | null }) {
  const [dismissed, setDismissed] = useState(false);
  const [isPublicDemo, setIsPublicDemo] = useState(false);

  useEffect(() => {
    try {
      setIsPublicDemo(demoSlug === null && localStorage.getItem('rc-mode') === 'demo');
    } catch {
      setIsPublicDemo(false);
    }
  }, [demoSlug]);

  if ((!demoSlug && !isPublicDemo) || dismissed) return null;

  const label = isPublicDemo ? 'Public Demo' : 'Invite Demo';
  const description = isPublicDemo
    ? `Private browser sandbox — resets on refresh and expires after ${PUBLIC_DEMO_ACCESS_DAYS} days`
    : 'Isolated client sandbox with sample data';

  return (
    <div className="bg-rc-orange/10 border-b border-rc-orange/20 px-4 py-1.5 flex items-center justify-center gap-2 text-sm">
      <FlaskConical className="size-3.5 text-rc-orange shrink-0" />
      <span className="text-rc-orange font-medium">{label}</span>
      <span className="text-muted-foreground hidden sm:inline">
        — {description}
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
