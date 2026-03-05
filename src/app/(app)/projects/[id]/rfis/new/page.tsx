'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { getProfiles, addRFI as storeAddRFI } from '@/lib/store';
import { useProjectMembers, useMilestones } from '@/hooks/useData';
import { useProject } from '@/components/providers/ProjectProvider';
import { createRFI as serverCreateRFI } from '@/lib/actions/rfis';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import type { Priority } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

const nativeSelectClasses =
  'border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm';

export default function NewRFIPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { can } = usePermissions(projectId);
  const { isDemo } = useProject();
  const basePath = `/projects/${projectId}/rfis`;

  const { data: members, loading: membersLoading } = useProjectMembers(projectId);
  const { data: milestones, loading: milestonesLoading } = useMilestones(projectId);

  // Build assignable profiles: prefer members with embedded profile, fall back to store
  const assignableProfiles = (() => {
    const fromMembers = members.map((m) => (m as any).profile).filter(Boolean);
    return fromMembers.length > 0 ? fromMembers : getProfiles();
  })();

  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignTo, setAssignTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [success, setSuccess] = useState(false);

  if (membersLoading || milestonesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!can(ACTIONS.RFI_CREATE)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'RFIs', href: basePath },
          { label: 'New RFI' },
        ]} />
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">You do not have permission to perform this action.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !question.trim()) return;
    const data = {
      subject,
      question,
      priority,
      assigned_to: assignTo,
      due_date: dueDate,
      milestone_id: milestoneId || null,
    };
    if (isDemo) {
      storeAddRFI(projectId, data);
    } else {
      const result = await serverCreateRFI(projectId, data);
      if (result.error) return;
    }
    setSuccess(true);
    setTimeout(() => router.push(basePath), 1500);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <p className="text-lg font-semibold">RFI Created Successfully</p>
        <p className="text-sm text-muted-foreground">Redirecting to RFIs list...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'RFIs', href: basePath },
        { label: 'New RFI' },
      ]} />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={basePath}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="font-heading text-2xl font-bold">New RFI</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader><CardTitle>RFI Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject <span className="text-red-500">*</span></label>
              <Input placeholder="Brief description of the issue" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>

            {/* Question */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Question <span className="text-red-500">*</span></label>
              <Textarea placeholder="Describe the question or information needed in detail..." value={question} onChange={(e) => setQuestion(e.target.value)} rows={5} required />
            </div>

            {/* Priority & Assign To */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Assign To</label>
                <select
                  name="assignTo"
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className={nativeSelectClasses}
                >
                  <option value="">Select team member</option>
                  {assignableProfiles.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date & Milestone */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Linked Milestone</label>
                <select
                  name="milestoneId"
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  className={nativeSelectClasses}
                >
                  <option value="">Select milestone</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">Create RFI</Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
                <Link href={basePath}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
