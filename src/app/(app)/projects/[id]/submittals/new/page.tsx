'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { seedMilestones, addSubmittal } from '@/lib/store';

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

export default function NewSubmittalPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [title, setTitle] = useState('');
  const [specSection, setSpecSection] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [success, setSuccess] = useState(false);

  const canSubmit = title.trim() && specSection;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    addSubmittal({
      title,
      description,
      spec_section: specSection,
      milestone_id: milestoneId || null,
    });
    setSuccess(true);
    setTimeout(() => {
      router.push(`/projects/${projectId}/submittals`);
    }, 1500);
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

      <Card className="mt-6">
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
                  {seedMilestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Attachments */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Attachments</label>
              <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center cursor-pointer hover:border-rc-orange/50 transition-colors">
                <Upload className="size-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Drag and drop files here, or click to browse</p>
                <p className="text-xs text-muted-foreground/60 mt-1">PDF, DWG, images up to 50 MB</p>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.dwg,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />
              </label>
              {files.length > 0 && (
                <div className="space-y-1 mt-2">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0"
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <span className="text-xs text-muted-foreground">&times;</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={!canSubmit || success} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
                Create Submittal
              </Button>
              <Link href={`/projects/${projectId}/submittals`}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
