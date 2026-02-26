'use client';

import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, XCircle, AlertTriangle, Send, FileEdit } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Submittal, Profile } from '@/lib/types';

interface SubmittalTimelineProps {
  submittal: Submittal;
  profiles: Profile[];
}

interface TimelineStep {
  label: string;
  date: string | null;
  person: string | null;
  status: 'complete' | 'current' | 'upcoming';
  icon: React.ReactNode;
}

function getProfileName(id: string | null, profiles: Profile[]): string | null {
  if (!id) return null;
  return profiles.find((p) => p.id === id)?.full_name ?? null;
}

export default function SubmittalTimeline({ submittal, profiles }: SubmittalTimelineProps) {
  const statusOrder = ['draft', 'submitted', 'under_review', 'approved', 'conditional', 'rejected'] as const;
  const currentIdx = statusOrder.indexOf(submittal.status);
  const isFinalReview = ['approved', 'conditional', 'rejected'].includes(submittal.status);

  const steps: TimelineStep[] = [
    {
      label: 'Created',
      date: submittal.created_at,
      person: getProfileName(submittal.submitted_by, profiles),
      status: 'complete',
      icon: <FileEdit className="size-4" />,
    },
    {
      label: 'Submitted',
      date: submittal.status !== 'draft' ? submittal.submit_date : null,
      person: getProfileName(submittal.submitted_by, profiles),
      status: submittal.status === 'draft' ? 'upcoming' : 'complete',
      icon: <Send className="size-4" />,
    },
    {
      label: 'Under Review',
      date: submittal.status === 'under_review' ? null : isFinalReview ? submittal.submit_date : null,
      person: getProfileName(submittal.reviewed_by, profiles),
      status: submittal.status === 'under_review' ? 'current' : currentIdx > 2 ? 'complete' : 'upcoming',
      icon: <Clock className="size-4" />,
    },
    {
      label: submittal.status === 'rejected' ? 'Rejected' : submittal.status === 'conditional' ? 'Approved with Conditions' : 'Approved',
      date: submittal.review_date,
      person: getProfileName(submittal.reviewed_by, profiles),
      status: isFinalReview ? 'current' : 'upcoming',
      icon: submittal.status === 'rejected' ? <XCircle className="size-4" /> : submittal.status === 'conditional' ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />,
    },
  ];

  return (
    <div className="relative space-y-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-full border-2',
                step.status === 'complete' && 'border-emerald-500 bg-emerald-50 text-emerald-600',
                step.status === 'current' && 'border-rc-orange bg-orange-50 text-rc-orange',
                step.status === 'upcoming' && 'border-muted-foreground/30 bg-muted text-muted-foreground/50'
              )}
            >
              {step.status === 'complete' ? <CheckCircle2 className="size-4" /> : step.icon}
            </div>
            {i < steps.length - 1 && (
              <div className={cn('w-0.5 flex-1 min-h-8', step.status !== 'upcoming' ? 'bg-emerald-300' : 'bg-muted-foreground/20')} />
            )}
          </div>
          <div className="pb-6">
            <p className={cn('font-medium text-sm', step.status === 'upcoming' && 'text-muted-foreground/60')}>
              {step.label}
            </p>
            {step.date && (
              <p className="text-xs text-muted-foreground">{format(new Date(step.date), 'MMM d, yyyy')}</p>
            )}
            {step.person && step.status !== 'upcoming' && (
              <p className="text-xs text-muted-foreground">by {step.person}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
