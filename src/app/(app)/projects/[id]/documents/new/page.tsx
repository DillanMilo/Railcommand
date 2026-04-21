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
import FileUpload from '@/components/shared/FileUpload';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useMilestones } from '@/hooks/useData';
import { ACTIONS } from '@/lib/permissions';
import { addProjectDocument as storeAddDocument, addAttachment as storeAddAttachment } from '@/lib/store';
import { createProjectDocument } from '@/lib/actions/documents';
import { uploadFilesAfterCreate } from '@/lib/uploadPhotosAfterCreate';
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
  const [files, setFiles] = useState<File[]>([]);
  const [linkedMilestoneId, setLinkedMilestoneId] = useState<string>('none');
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const primaryFile = files[0];
    const payload = {
      title,
      category,
      revision,
      revision_date: revisionDate,
      description,
      file_name: primaryFile?.name ?? '',
      file_size: primaryFile?.size ?? 0,
      linked_milestone_id: linkedMilestoneId === 'none' ? null : linkedMilestoneId,
    };

    if (isDemo) {
      const doc = storeAddDocument(projectId, payload);
      for (const file of files) {
        storeAddAttachment({
          entity_type: 'project_document',
          entity_id: doc.id,
          project_id: projectId,
          file_name: file.name,
          file_url: URL.createObjectURL(file),
          file_type: file.type,
          file_size: file.size,
        });
      }
      setSuccess(true);
      setTimeout(() => router.push(`${basePath}/${doc.id}`), 1200);
      return;
    }

    const result = await createProjectDocument(projectId, payload);

    if (result.error || !result.data) {
      setErrorMsg(result.error ?? 'Failed to create document');
      setSubmitting(false);
      return;
    }

    const createdDoc = result.data;

    if (files.length > 0) {
      setUploadProgress(`Uploading ${files.length} file${files.length !== 1 ? 's' : ''}…`);
      const uploadResult = await uploadFilesAfterCreate(files, 'project_document', createdDoc.id, projectId);
      setUploadProgress(null);

      if (uploadResult.failed > 0) {
        setErrorMsg(`${uploadResult.succeeded} of ${uploadResult.total} files uploaded. ${uploadResult.failed} failed.`);
        setSubmitting(false);
        return;
      }
    }

    setSuccess(true);
    setTimeout(() => router.push(`${basePath}/${createdDoc.id}`), 1200);
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
        Add document metadata and upload one or more files from your phone or computer.
      </p>

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle className="text-base">Document Details</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
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
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this document..." rows={3} className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <FileUpload
          pendingFiles={files}
          onPendingFilesChange={setFiles}
          accept=".pdf,.dwg,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.webp,.heic"
          title="Attachments"
        />

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button type="submit" disabled={submitting || success} className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">
            {uploadProgress ?? (submitting ? 'Creating…' : 'Create Document')}
          </Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto" asChild><Link href={basePath}>Cancel</Link></Button>
        </div>
      </form>
    </div>
  );
}
