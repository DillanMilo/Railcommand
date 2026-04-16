'use client';

import { useState, useEffect } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProject } from '@/components/providers/ProjectProvider';
import { getRecentMembers } from '@/lib/actions/team';
import { cn } from '@/lib/utils';
import type { ProjectMember } from '@/lib/types';

const DISMISS_STORAGE_KEY = 'rc-new-members-dismissed';

export default function NewMembersAlert() {
  const { currentProjectId, isDemo } = useProject();
  const [newMembers, setNewMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load dismissed IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (stored) {
        setDismissedIds(new Set(JSON.parse(stored)));
      }
    } catch { /* noop */ }
  }, []);

  // Fetch recent members for the current project
  useEffect(() => {
    let cancelled = false;

    async function fetchRecent() {
      if (!currentProjectId) {
        setLoading(false);
        return;
      }

      // Skip in demo mode — this is for real Supabase collaboration
      if (isDemo) {
        setLoading(false);
        return;
      }

      // Use "last 7 days" window
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = await getRecentMembers(currentProjectId, since);

      if (!cancelled) {
        setNewMembers(result.data ?? []);
        setLoading(false);
      }
    }

    fetchRecent();
    return () => { cancelled = true; };
  }, [currentProjectId, isDemo]);

  function dismissMember(memberId: string) {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(memberId);
      try {
        localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch { /* noop */ }
      return next;
    });
  }

  function dismissAll() {
    const allIds = newMembers.map((m) => m.id);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      try {
        localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch { /* noop */ }
      return next;
    });
  }

  const visibleMembers = newMembers.filter((m) => !dismissedIds.has(m.id));

  if (loading || visibleMembers.length === 0) return null;

  return (
    <div className="rounded-lg border border-rc-emerald/30 bg-rc-emerald/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rc-emerald/10">
            <UserPlus className="size-4 text-rc-emerald" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">
              {visibleMembers.length === 1
                ? 'New team member!'
                : `${visibleMembers.length} new team members joined`}
            </h3>
            <div className="mt-2 space-y-1.5">
              {visibleMembers.slice(0, 5).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="font-medium">{member.profile?.full_name ?? 'Someone'}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {member.project_role}
                  </Badge>
                  <button
                    onClick={() => dismissMember(member.id)}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    title="Dismiss"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {visibleMembers.length > 5 && (
                <p className="text-xs text-muted-foreground pt-1">
                  + {visibleMembers.length - 5} more
                </p>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismissAll}
          className={cn('shrink-0 text-muted-foreground hover:text-foreground text-xs')}
        >
          Dismiss all
        </Button>
      </div>
    </div>
  );
}
