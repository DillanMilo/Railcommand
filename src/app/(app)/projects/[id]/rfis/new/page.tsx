'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { seedProfiles, seedMilestones } from '@/lib/seed-data';
import type { Priority } from '@/lib/types';

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

export default function NewRFIPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const basePath = `/projects/${projectId}/rfis`;

  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignTo, setAssignTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !question.trim()) return;
    setSuccess(true);
    setTimeout(() => router.push(basePath), 1500);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <span className="text-emerald-600 text-xl font-bold">!</span>
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
                <Select value={assignTo} onValueChange={setAssignTo}>
                  <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                  <SelectContent>
                    {seedProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select value={milestoneId} onValueChange={setMilestoneId}>
                  <SelectTrigger><SelectValue placeholder="Select milestone" /></SelectTrigger>
                  <SelectContent>
                    {seedMilestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-rc-orange hover:bg-rc-orange-dark text-white">Create RFI</Button>
              <Button type="button" variant="outline" asChild>
                <Link href={basePath}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
