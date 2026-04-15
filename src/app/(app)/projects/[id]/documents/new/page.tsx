'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useMilestones } from '@/hooks/useData';
import { ACTIONS } from '@/lib/permissions';
import { DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';
import { addProjectDocument as storeAddDocument } from '@/lib/store';
import { createProjectDocument } from '@/lib/actions/documents';
import type { DocumentCategory } from '@/lib/types';

const CATEGORIES: { label: string; value: DocumentCategory }[] = [
  { label: 'Drawing', value: 'drawing' },
  { label: 'Specification', value: 'specification' },
  { label: 'Submittal', value: 'submittal' },
  { label: 'Report', value: 'report' },
  { label: 'Contract', value: 'contract' },
  { label: 'Correspondence', value: 'correspondence' },
  { label: 'Photo Log', value: 'photo_log' },
  { label: 'Other', value: 'other' },
];

export default function NewDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const basePath = `/projects/${projectId}/documents`;

  const { data: milestones } = useMilestones(projectId);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('drawing');
  const [revision, setRevision] = useState('Rev 0');
  const [revisionDate, setRevisionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [linkedMilestoneId, setLinkedMilestoneId] = useState<string>('none');
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const payload = {
      title,
      category,
      revision,
      revision_date: revisionDate,
      description,
      file_name: fileName,
      linked_milestone_id: linkedMilestoneId === 'none' ? null : linkedMilestoneId,
    };

    if (isDemo) {
      const doc = storeAddDocument(projectId, payload);
      setSuccess(true);
      setTimeout(() => router.push(`${basePath}/${doc.id}`), 1200);
      return;
    }

    const result = await createProjectDocument(projectId, payload);

    if (result.error) {
      setErrorMsg(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    if (result.data) {
      setTimeout(() => router.push(`${basePath}/${result.data!.id}`), 1200);
    } else {
      setTimeout(() => router.push(basePath), 1200);
    }
  }

  if (!can(ACTIONS.DOCUMENT_MANAGE)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Documents', href: basePath }, { label: 'Upload' }]} />
        <p className="py-20 text-center text-muted-foreground">You do not have permission to manage documents.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CheckCircle2 className="size-12 text-rc-emerald" />
        <p className="text-lg font-medium">Document created!</p>
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Documents', href: basePath },
        { label: 'Upload Document' },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Documents
      </Link>

      <h1 className="font-heading text-2xl font-bold">Upload Document</h1>

      <p className="text-sm text-muted-foreground">
        Track document metadata here. Actual file upload/storage will be available in a future update.
      </p>

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          {errorMsg}
        </div>
      )}

      <Card className="max-w-3xl">
        <CardHeader><CardTitle className="text-base">Document Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" required className="mt-1" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Category <span className="text-red-500">*</span></label>
                <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Revision</label>
                <Input value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="Rev 0" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Revision Date</label>
                <Input type="date" value={revisionDate} onChange={(e) => setRevisionDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">File Name</label>
                <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="e.g. track-layout-siding1.pdf" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this document..." rows={3} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Linked Milestone (optional)</label>
              <Select value={linkedMilestoneId} onValueChange={setLinkedMilestoneId}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {milestones.map((ms) => (
                    <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" disabled={submitting || success} className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">
                {submitting ? 'Creating...' : 'Create Document'}
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" asChild><Link href={basePath}>Cancel</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
