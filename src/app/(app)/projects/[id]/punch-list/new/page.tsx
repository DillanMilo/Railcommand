'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { getProfiles, addPunchListItem } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import type { Priority } from '@/lib/types';

const PRIORITIES: { label: string; value: Priority }[] = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

export default function NewPunchListItemPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = usePermissions(projectId);
  const basePath = `/projects/${projectId}/punch-list`;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [success, setSuccess] = useState(false);

  if (!can(ACTIONS.PUNCH_LIST_CREATE)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Punch List', href: basePath },
          { label: 'New Item' },
        ]} />
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">You do not have permission to perform this action.</p>
        </div>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addPunchListItem(projectId, {
      title,
      description,
      location,
      priority,
      assigned_to: assignedTo,
      due_date: dueDate,
    });
    setSuccess(true);
    setTimeout(() => router.push(basePath), 1500);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CheckCircle2 className="size-12 text-rc-emerald" />
        <p className="text-lg font-medium">Punch list item created!</p>
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Punch List', href: basePath },
        { label: 'New Item' },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Punch List
      </Link>

      <h1 className="font-heading text-2xl font-bold">New Punch List Item</h1>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle className="text-base">Item Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the issue" required className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description, measurements, spec references..." rows={4} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Location <span className="text-red-500">*</span></label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Siding 1, STA 9+25" required className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Assigned To</label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select team member" /></SelectTrigger>
                  <SelectContent>
                    {getProfiles().map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">Create Item</Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" asChild><Link href={basePath}>Cancel</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
