'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { format, differenceInCalendarDays } from 'date-fns';
import { AlertTriangle, CheckCircle2, Lock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { getRFIs, getProfiles, getOrganizations, getMilestones, updateRFIStatus, addRFIResponse } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';

function getProfile(id: string) {
  return getProfiles().find((p) => p.id === id);
}
function getOrg(orgId: string) {
  return getOrganizations().find((o) => o.id === orgId);
}
function getMilestoneById(id: string | null, projectId: string) {
  return id ? getMilestones(projectId).find((m) => m.id === id) : null;
}

export default function RFIDetailPage() {
  const { id: projectId, rfiId } = useParams<{ id: string; rfiId: string }>();
  const { can } = usePermissions(projectId);
  const [newResponse, setNewResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const rfi = getRFIs(projectId).find((r) => r.id === rfiId);
  const [status, setStatus] = useState(rfi?.status ?? 'open');

  if (!rfi) return <p className="p-8 text-muted-foreground">RFI not found.</p>;

  const submitter = getProfile(rfi.submitted_by);
  const assignee = getProfile(rfi.assigned_to);
  const milestone = getMilestoneById(rfi.milestone_id, projectId);
  const isOverdue = status === 'overdue';
  const canRespond = status === 'open' || status === 'overdue';
  const overdueDays = isOverdue ? differenceInCalendarDays(new Date(), new Date(rfi.due_date)) : 0;
  const basePath = `/projects/${projectId}/rfis`;

  const handleSubmitResponse = () => {
    if (!newResponse.trim()) return;
    addRFIResponse(rfiId, newResponse);
    setSubmitted(true);
    setNewResponse('');
  };

  const handleStatusChange = (newStatus: 'answered' | 'closed') => {
    updateRFIStatus(rfiId, newStatus);
    setStatus(newStatus);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'RFIs', href: basePath },
        { label: rfi.number },
      ]} />

      {/* Overdue banner */}
      {isOverdue && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="text-sm font-medium">This RFI is {overdueDays} days overdue. Response was due {format(new Date(rfi.due_date), 'MMM d, yyyy')}.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-bold sm:text-2xl">{rfi.number}</h1>
            <StatusBadge status={status} type="rfi" />
            <PriorityBadge priority={rfi.priority} />
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">{rfi.subject}</p>
        </div>
        {canRespond && can(ACTIONS.RFI_CLOSE) && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('answered')}>
              <CheckCircle2 className="mr-1.5 size-4" />Answered
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('closed')}>
              <Lock className="mr-1.5 size-4" />Close
            </Button>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Submitted By', value: submitter?.full_name ?? '—' },
          { label: 'Assigned To', value: assignee?.full_name ?? '—' },
          { label: 'Submit Date', value: format(new Date(rfi.submit_date), 'MMM d, yyyy') },
          { label: 'Due Date', value: format(new Date(rfi.due_date), 'MMM d, yyyy') },
          { label: 'Priority', value: rfi.priority },
          { label: 'Milestone', value: milestone?.name ?? 'None' },
        ].map((item) => (
          <div key={item.label} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
            <p className="text-sm font-medium truncate">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Question */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Question</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{rfi.question}</p>
        </CardContent>
      </Card>

      {/* Responses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4" />Responses ({rfi.responses?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(!rfi.responses || rfi.responses.length === 0) && (
            <p className="text-sm text-muted-foreground py-4 text-center">No responses yet.</p>
          )}
          {rfi.responses?.map((resp) => {
            const author = getProfile(resp.author_id);
            const org = author ? getOrg(author.organization_id) : null;
            return (
              <div
                key={resp.id}
                className={`rounded-lg border p-4 space-y-2 ${
                  resp.is_official_response
                    ? 'border-rc-emerald/40 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-rc-border bg-rc-card'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{author?.full_name ?? 'Unknown'}</span>
                  {org && <span className="text-xs text-muted-foreground">{org.name}</span>}
                  <span className="text-xs text-muted-foreground">{format(new Date(resp.created_at), 'MMM d, yyyy')}</span>
                  {resp.is_official_response && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Official Response</Badge>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{resp.content}</p>
              </div>
            );
          })}

          {/* Add response */}
          {canRespond && !submitted && can(ACTIONS.RFI_RESPOND) && (
            <div className="pt-4 border-t border-rc-border space-y-3">
              <Textarea
                placeholder="Write a response..."
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                rows={3}
              />
              <Button onClick={handleSubmitResponse} className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">
                Submit Response
              </Button>
            </div>
          )}
          {submitted && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 text-sm dark:bg-emerald-950/30 dark:text-emerald-300">
              Response submitted successfully.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
