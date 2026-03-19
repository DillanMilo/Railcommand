'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import FileUpload from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { addSubmittal, addAttachment } from '@/lib/store';
import { useMilestones } from '@/hooks/useData';
import { useProject } from '@/components/providers/ProjectProvider';
import { createSubmittal as serverCreateSubmittal } from '@/lib/actions/submittals';
import { uploadFilesAfterCreate } from '@/lib/uploadPhotosAfterCreate';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { getLocalDateStringOffset } from '@/lib/date-utils';

const SPEC_SECTIONS = [
  '34 11 13 - Track Construction',
  '34 11 16 - Turnouts and Crossings',
  '34 42 13 - Signal Systems',
  '34 42 16 - Grade Crossing Protection',
  '33 40 00 - Storm Drainage',
  '31 23 00 - Excavation and Fill',
  '03 30 00 - Cast-in-Place Concrete',
  '26 56 00 - Exterior Lighting',
];

export default function NewSubmittalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { can } = usePermissions(projectId);
  const { isDemo } = useProject();
  const { data: milestones, loading: milestonesLoading } = useMilestones(projectId);

  const [title, setTitle] = useState('');
  const [specSection, setSpecSection] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const canSubmit = title.trim() && specSection;

  if (milestonesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rc-orange" />
      </div>
    );
  }

  if (!can(ACTIONS.SUBMITTAL_CREATE)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Submittals', href: `/projects/${projectId}/submittals` },
            { label: 'New Submittal' },
          ]}
        />
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">You do not have permission to perform this action.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);

    if (isDemo) {
      const submittal = addSubmittal(projectId, {
        title,
        description,
        spec_section: specSection,
        milestone_id: milestoneId || null,
      });
      // Save file attachments
      for (const file of files) {
        addAttachment({
          entity_type: 'submittal',
          entity_id: submittal.id,
          file_name: file.name,
          file_url: URL.createObjectURL(file),
          file_type: file.type,
          file_size: file.size,
        });
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(`/projects/${projectId}/submittals`);
      }, 1500);
    } else {
      const result = await serverCreateSubmittal(projectId, {
        title,
        description,
        spec_section: specSection,
        due_date: getLocalDateStringOffset(14),
        milestone_id: milestoneId || null,
      });
      if (result.error) {
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }

      // Upload file attachments to Supabase storage
      if (files.length > 0 && result.data) {
        setUploadProgress(`Uploading ${files.length} file${files.length !== 1 ? 's' : ''}…`);
        const uploadResult = await uploadFilesAfterCreate(files, 'submittal', result.data.id, projectId);
        setUploadProgress(null);
        if (uploadResult.failed > 0) {
          setSubmitError(`${uploadResult.succeeded} of ${uploadResult.total} files uploaded. ${uploadResult.failed} failed.`);
          setSubmitting(false);
          return;
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/projects/${projectId}/submittals`);
      }, 1500);
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Submittals', href: `/projects/${projectId}/submittals` },
          { label: 'New Submittal' },
        ]}
      />

      <div className="mt-4">
        <Link href={`/projects/${projectId}/submittals`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 w-fit">
          <ArrowLeft className="size-3.5" /> Back to Submittals
        </Link>
        <h1 className="font-heading text-2xl font-bold mt-2">New Submittal</h1>
      </div>

      {success && (
        <Alert className="mt-6 border-emerald-300 bg-emerald-50">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">Submittal created</AlertTitle>
          <AlertDescription className="text-emerald-700">Redirecting to submittals list...</AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert className="mt-6 border-red-300 bg-red-50">
          <AlertTitle className="text-red-800">Error</AlertTitle>
          <AlertDescription className="text-red-700">{submitError}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-6 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Submittal Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input id="title" placeholder="e.g. 136RE Rail — 2,400 LF" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {/* Spec Section */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Spec Section <span className="text-red-500">*</span></label>
              <Select value={specSection} onValueChange={setSpecSection}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select spec section" />
                </SelectTrigger>
                <SelectContent>
                  {SPEC_SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="description" className="text-sm font-medium">Description</label>
              <Textarea id="description" placeholder="Describe the submittal materials, quantities, and relevant specs..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Milestone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Linked Milestone</label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select milestone (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Attachments */}
            <FileUpload
              pendingFiles={files}
              onPendingFilesChange={setFiles}
              accept=".pdf,.dwg,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              title="Attachments"
            />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Button type="submit" disabled={!canSubmit || success || submitting} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
                {uploadProgress ?? (submitting ? 'Creating…' : 'Create Submittal')}
              </Button>
              <Link href={`/projects/${projectId}/submittals`}>
                <Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
