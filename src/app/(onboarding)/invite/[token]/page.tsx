'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Users, Check, X, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  acceptInvitation,
  declineInvitation,
  getPendingInvitationsForUser,
} from '@/lib/actions/invitations';
import type { ProjectInvitation } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Role badge color mapping                                           */
/* ------------------------------------------------------------------ */

const ROLE_COLORS: Record<string, string> = {
  engineer: 'bg-rc-blue/10 text-rc-blue border-rc-blue/20',
  contractor: 'bg-rc-orange/10 text-rc-orange border-rc-orange/20',
  owner: 'bg-rc-emerald/10 text-rc-emerald border-rc-emerald/20',
  inspector: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  manager: 'bg-rc-navy/10 text-rc-navy border-rc-navy/20',
  superintendent: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  foreman: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
};

function getRoleBadgeClasses(role: string): string {
  return ROLE_COLORS[role] ?? 'bg-muted text-muted-foreground border-border';
}

/* ------------------------------------------------------------------ */
/*  Invite Page                                                        */
/* ------------------------------------------------------------------ */

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [invitation, setInvitation] = useState<ProjectInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);

  /* ---- Fetch invitation details on mount ---- */
  useEffect(() => {
    async function fetchInvitation() {
      try {
        const result = await getPendingInvitationsForUser();

        if (result.error || !result.data) {
          setInvalidToken(true);
          setLoading(false);
          return;
        }

        const match = result.data.find(
          (inv: ProjectInvitation) => inv.token === token,
        );

        if (!match) {
          setInvalidToken(true);
          setLoading(false);
          return;
        }

        setInvitation(match);
      } catch {
        setInvalidToken(true);
      } finally {
        setLoading(false);
      }
    }

    fetchInvitation();
  }, [token]);

  /* ---- Accept handler ---- */
  async function handleAccept() {
    setActionLoading('accept');
    setError(null);

    try {
      const result = await acceptInvitation(token);

      if (result.error) {
        setError(result.error);
        setActionLoading(null);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Failed to accept invitation. Please try again.');
      setActionLoading(null);
    }
  }

  /* ---- Decline handler ---- */
  async function handleDecline() {
    setActionLoading('decline');
    setError(null);

    try {
      const result = await declineInvitation(token);

      if (result.error) {
        setError(result.error);
        setActionLoading(null);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Failed to decline invitation. Please try again.');
      setActionLoading(null);
    }
  }

  /* ---- Branding header ---- */
  const branding = (
    <div className="flex flex-col items-center mb-8">
      <Image
        src="/IMG_0938.jpg"
        alt="RailCommand"
        width={200}
        height={48}
        className="object-contain hidden sm:block"
      />
      <Image
        src="/IMG_0936.jpg"
        alt="RailCommand"
        width={48}
        height={48}
        className="rounded-xl sm:hidden"
      />
      <p className="text-[10px] text-muted-foreground/60 tracking-wide uppercase mt-1">
        by A5 Rail
      </p>
    </div>
  );

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="w-full max-w-[460px]">
        {branding}
        <Card className="border-rc-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground mt-4">
              Loading invitation...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---- Invalid / expired token ---- */
  if (invalidToken || !invitation) {
    return (
      <div className="w-full max-w-[460px]">
        {branding}
        <Card className="border-rc-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-destructive/10 mb-4">
              <AlertCircle className="size-7 text-destructive" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground">
              Invalid Invitation
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              This invitation has expired or is invalid. It may have already been
              used or the link is incorrect.
            </p>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="ghost"
              className="mt-6 text-rc-orange hover:text-rc-orange-dark"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---- Invitation card ---- */
  const projectName = invitation.project?.name ?? 'Unknown Project';
  const invitedByName =
    invitation.invited_by_profile?.full_name ?? 'A team member';
  const role = invitation.project_role;

  return (
    <div className="w-full max-w-[460px]">
      {branding}

      <Card className="border-rc-border">
        <CardContent className="pt-2">
          {/* Icon header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-rc-orange/10 dark:bg-rc-orange/20 mb-4">
              <Users className="size-7 text-rc-orange" />
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              You&apos;re Invited
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              You&apos;ve been invited to join a project on RailCommand.
            </p>
          </div>

          {/* Project details */}
          <div className="rounded-xl bg-muted/50 dark:bg-muted/20 border border-rc-border p-5 mb-6 space-y-4">
            {/* Project name */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                Project
              </p>
              <p className="text-lg font-bold text-foreground">{projectName}</p>
            </div>

            {/* Role */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">
                Your Role
              </p>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border capitalize ${getRoleBadgeClasses(role)}`}
              >
                {role}
              </span>
            </div>

            {/* Invited by */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              <span>
                Invited by{' '}
                <span className="font-medium text-foreground">
                  {invitedByName}
                </span>
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleDecline}
              variant="outline"
              disabled={actionLoading !== null}
              className="flex-1 h-12 font-semibold text-sm gap-2"
            >
              {actionLoading === 'decline' ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  Declining...
                </span>
              ) : (
                <>
                  <X className="size-4" />
                  Decline
                </>
              )}
            </Button>

            <Button
              onClick={handleAccept}
              disabled={actionLoading !== null}
              className="flex-1 h-12 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold text-sm gap-2"
            >
              {actionLoading === 'accept' ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Accepting...
                </span>
              ) : (
                <>
                  <Check className="size-4" />
                  Accept
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
