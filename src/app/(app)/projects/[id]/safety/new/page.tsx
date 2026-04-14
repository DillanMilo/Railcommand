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
import { createSafetyIncident } from '@/lib/actions/safety';
import { INCIDENT_TYPE_LABELS } from '@/lib/constants';
import type { IncidentType, IncidentSeverity } from '@/lib/types';

const INCIDENT_TYPES: { label: string; value: IncidentType }[] = [
  { label: 'Near Miss', value: 'near_miss' },
  { label: 'First Aid', value: 'first_aid' },
  { label: 'Recordable', value: 'recordable' },
  { label: 'Lost Time', value: 'lost_time' },
  { label: 'Observation', value: 'observation' },
  { label: 'Hazard', value: 'hazard' },
];

const SEVERITIES: { label: string; value: IncidentSeverity }[] = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

export default function NewSafetyIncidentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const router = useRouter();
  useProject();
  const basePath = `/projects/${projectId}/safety`;

  const [title, setTitle] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType>('observation');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [personnelInvolved, setPersonnelInvolved] = useState('');
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const result = await createSafetyIncident(projectId, {
      title,
      incident_type: incidentType,
      severity,
      incident_date: incidentDate,
      location,
      description,
      personnel_involved: personnelInvolved,
    });

    if (result.error) {
      setErrorMsg(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    // Redirect to the new incident detail page
    if (result.data) {
      setTimeout(() => router.push(`${basePath}/${result.data!.id}`), 1200);
    } else {
      setTimeout(() => router.push(basePath), 1200);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CheckCircle2 className="size-12 text-rc-emerald" />
        <p className="text-lg font-medium">Safety incident reported!</p>
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Safety', href: basePath },
        { label: 'New Incident' },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Safety
      </Link>

      <h1 className="font-heading text-2xl font-bold">Report Safety Incident</h1>

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          {errorMsg}
        </div>
      )}

      <Card className="max-w-3xl">
        <CardHeader><CardTitle className="text-base">Incident Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the incident" required className="mt-1" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Incident Type <span className="text-red-500">*</span></label>
                <Select value={incidentType} onValueChange={(v) => setIncidentType(v as IncidentType)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Severity <span className="text-red-500">*</span></label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Track 3, STA 12+50" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? Provide details about the incident..." rows={4} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Personnel Involved</label>
              <Textarea value={personnelInvolved} onChange={(e) => setPersonnelInvolved(e.target.value)} placeholder="Names and roles of personnel involved" rows={2} className="mt-1" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" disabled={submitting || success} className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">
                {submitting ? 'Submitting...' : 'Report Incident'}
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" asChild><Link href={basePath}>Cancel</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
