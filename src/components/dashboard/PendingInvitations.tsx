'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/components/providers/ProjectProvider';
import { getPendingInvitationsForUser, declineInvitation } from '@/lib/actions/invitations';
import { getUserInvitations } from '@/lib/store';
import type { ProjectInvitation } from '@/lib/types';

export default function PendingInvitations() {
  const router = useRouter();
  const { isDemo } = useProject();
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchInvitations() {
      if (isDemo) {
        // In demo mode, use the store with a placeholder email
        const demoInvitations = getUserInvitations('demo@railcommand.app');
        if (!cancelled) {
          setInvitations(demoInvitations);
          setLoading(false);
        }
        return;
      }

      // Real auth mode - fetch from server
      const result = await getPendingInvitationsForUser();
      if (!cancelled) {
        setInvitations(result.data ?? []);
        setLoading(false);
      }
    }

    fetchInvitations();
    return () => { cancelled = true; };
  }, [isDemo]);

  async function handleDecline(token: string, id: string) {
    setDismissing((prev) => new Set(prev).add(id));

    if (!isDemo) {
      await declineInvitation(token);
    }

    setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    setDismissing((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  if (loading || invitations.length === 0) return null;

  return (
    <div className="space-y-2">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-col gap-3 rounded-lg border border-rc-orange/20 bg-rc-orange/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rc-orange/10">
              <Mail className="size-4 text-rc-orange" />
            </div>
            <div className="text-sm">
              <span className="text-foreground">
                You&apos;ve been invited to{' '}
                <span className="font-semibold">{invitation.project?.name ?? 'a project'}</span>
                {' '}as{' '}
                <Badge variant="outline" className="ml-0.5 border-rc-orange/30 text-rc-orange">
                  {invitation.project_role}
                </Badge>
              </span>
              {invitation.invited_by_profile?.full_name && (
                <span className="text-muted-foreground">
                  {' '}by {invitation.invited_by_profile.full_name}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={dismissing.has(invitation.id)}
              onClick={() => handleDecline(invitation.token, invitation.id)}
            >
              <X className="mr-1 size-3.5" />
              Decline
            </Button>
            <Button
              size="sm"
              className="bg-rc-orange text-white hover:bg-rc-orange/90"
              onClick={() => router.push(`/invite/${invitation.token}`)}
            >
              View Invitation
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
