'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Paperclip, Calendar, User, Flag } from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import SubmittalTimeline from '@/components/submittals/SubmittalTimeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getProfiles, getMilestones, getProfileWithOrg, updateSubmittalStatus as storeUpdateSubmittalStatus } from '@/lib/store';
import { useSubmittalDetail } from '@/hooks/useData';
import { useProject } from '@/components/providers/ProjectProvider';
import { updateSubmittalStatus as serverUpdateSubmittalStatus } from '@/lib/actions/submittals';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import type { SubmittalStatus } from '@/lib/types';

export default function SubmittalDetailPage({ params, searchParams }: { params: Promise<{ id: string; submittalId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, submittalId } = use(params);
  use(searchParams);
  const { can } = usePermissions(projectId);
  const { isDemo } = useProject();
  const { data: original, loading, refetch } = useSubmittalDetail(projectId, submittalId);
  const [status, setStatus] = useState<SubmittalStatus | null>(null);

  // Sync local status when data loads or changes
  const effectiveStatus: SubmittalStatus = status ?? original?.status ?? 'draft';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rc-orange" />
      </div>
    );
  }

  if (!original) {
    return (
      <div className="py-20 text-center text-muted-foreground">Submittal not found.</div>
    );
  }

  const submittal = { ...original, status: effectiveStatus };
  const submitter = original.submitted_by_profile
    ? { ...original.submitted_by_profile, organization: { name: '' } as { name: string } }
    : getProfileWithOrg(submittal.submitted_by);
  const reviewer = submittal.reviewed_by
    ? (original.reviewed_by_profile
        ? { ...original.reviewed_by_profile, organization: { name: '' } as { name: string } }
        : getProfileWithOrg(submittal.reviewed_by))
    : null;
  const milestone = getMilestones(projectId).find((m) => m.id === submittal.milestone_id);

  async function handleStatusChange(newStatus: SubmittalStatus) {
    setStatus(newStatus);
    if (isDemo) {
      storeUpdateSubmittalStatus(submittalId, newStatus);
      refetch();
    } else {
      const result = await serverUpdateSubmittalStatus(projectId, submittalId, newStatus);
      if (result.error) {
        setStatus(original?.status ?? 'draft');
        return;
      }
      refetch();
    }
  }

  const infoItems = [
    { label: 'Submitted By', value: submitter?.full_name ?? '—', sub: submitter?.organization?.name, icon: <User className="size-4" /> },
    { label: 'Submit Date', value: format(new Date(submittal.submit_date), 'MMM d, yyyy'), icon: <Calendar className="size-4" /> },
    { label: 'Due Date', value: format(new Date(submittal.due_date), 'MMM d, yyyy'), icon: <Calendar className="size-4" /> },
    { label: 'Reviewed By', value: reviewer?.full_name ?? '—', sub: reviewer?.organization?.name, icon: <User className="size-4" /> },
    { label: 'Review Date', value: submittal.review_date ? format(new Date(submittal.review_date), 'MMM d, yyyy') : '—', icon: <Calendar className="size-4" /> },
    { label: 'Linked Milestone', value: milestone?.name ?? '—', icon: <Flag className="size-4" /> },
  ];

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Submittals', href: `/projects/${projectId}/submittals` },
          { label: submittal.number },
        ]}
      />

      {/* Header */}
      <div className="mt-4 flex flex-col gap-2">
        <Link href={`/projects/${projectId}/submittals`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 w-fit">
          <ArrowLeft className="size-3.5" /> Back to Submittals
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
          <h1 className="font-heading text-xl sm:text-2xl font-bold">{submittal.number}: {submittal.title}</h1>
          <StatusBadge status={effectiveStatus} type="submittal" />
        </div>
        <p className="text-sm text-muted-foreground">{submittal.spec_section}</p>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
        {infoItems.map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-lg border p-4">
            <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
              {item.icon}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium">{item.value}</p>
              {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Description */}
      {submittal.description && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{submittal.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Timeline & Review Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmittalTimeline submittal={submittal} profiles={getProfiles()} />
          </CardContent>
        </Card>

        {submittal.review_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{submittal.review_notes}</p>
              {reviewer && (
                <p className="text-xs text-muted-foreground mt-3">
                  — {reviewer.full_name}, {submittal.review_date ? format(new Date(submittal.review_date), 'MMM d, yyyy') : ''}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Attachments */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="size-4" /> Attachments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No attachments uploaded yet.</p>
        </CardContent>
      </Card>

      {/* Action buttons */}
      {can(ACTIONS.SUBMITTAL_REVIEW) && (
        <>
          <Separator className="my-6" />
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto" onClick={() => handleStatusChange('approved')}>
              Approve
            </Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto" onClick={() => handleStatusChange('conditional')}>
              Approve with Conditions
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto" onClick={() => handleStatusChange('rejected')}>
              Reject
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleStatusChange('submitted')}>
              Request Revision
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
