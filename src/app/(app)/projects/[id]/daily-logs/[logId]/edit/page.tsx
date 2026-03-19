'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import PhotoUpload, { type PhotoFile } from '@/components/shared/PhotoUpload';
import GeoTagInput from '@/components/shared/GeoTagInput';
import { updateDailyLog as storeUpdateDailyLog } from '@/lib/store';
import { updateDailyLog as serverUpdateDailyLog } from '@/lib/actions/daily-logs';
import { uploadPhotosAfterCreate } from '@/lib/uploadPhotosAfterCreate';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useDailyLogDetail } from '@/hooks/useData';
import { ACTIONS } from '@/lib/permissions';
import type { GeoTag } from '@/lib/types';

const CONDITIONS = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Snow', 'Snow', 'Rain', 'Foggy'] as const;
const UNITS = ['LF', 'CY', 'each', 'SF', 'tons', 'hours'] as const;
const ROLES = ['Foreman', 'Track Laborer', 'Operator', 'Signal Tech', 'Inspector', 'Grading Foreman', 'Laborer'] as const;

type PersonnelRow = { role: string; headcount: number; company: string };
type EquipmentRow = { type: string; count: number; notes: string };
type WorkItemRow = { description: string; quantity: number; unit: string; location: string };

export default function EditDailyLogPage({ params, searchParams }: { params: Promise<{ id: string; logId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, logId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const { data: log, loading } = useDailyLogDetail(projectId, logId);

  const [initialized, setInitialized] = useState(false);
  const [date, setDate] = useState('');
  const [temp, setTemp] = useState<number | ''>('');
  const [conditions, setConditions] = useState('');
  const [wind, setWind] = useState('');
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([{ role: '', headcount: 0, company: '' }]);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([{ type: '', count: 0, notes: '' }]);
  const [workItems, setWorkItems] = useState<WorkItemRow[]>([{ description: '', quantity: 0, unit: '', location: '' }]);
  const [workSummary, setWorkSummary] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [geoTag, setGeoTag] = useState<GeoTag | null>(null);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Populate form when log data loads
  useEffect(() => {
    if (log && !initialized) {
      setDate(log.log_date);
      setTemp(log.weather_temp);
      setConditions(log.weather_conditions);
      setWind(log.weather_wind);
      setWorkSummary(log.work_summary);
      setSafetyNotes(log.safety_notes);
      setGeoTag(log.geo_tag ?? null);

      if (log.personnel && log.personnel.length > 0) {
        setPersonnel(log.personnel.map((p) => ({ role: p.role, headcount: p.headcount, company: p.company })));
      }
      if (log.equipment && log.equipment.length > 0) {
        setEquipment(log.equipment.map((e) => ({ type: e.equipment_type, count: e.count, notes: e.notes })));
      }
      if (log.work_items && log.work_items.length > 0) {
        setWorkItems(log.work_items.map((w) => ({ description: w.description, quantity: w.quantity, unit: w.unit, location: w.location })));
      }

      setInitialized(true);
    }
  }, [log, initialized]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` }, { label: '…' }]} />
        <p className="text-muted-foreground">Loading daily log…</p>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` }, { label: 'Not Found' }]} />
        <p className="text-muted-foreground">Daily log not found.</p>
      </div>
    );
  }

  if (!can(ACTIONS.DAILY_LOG_UPDATE)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` },
          { label: 'Edit Log' },
        ]} />
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">You do not have permission to edit daily logs.</p>
        </div>
      </div>
    );
  }

  const updateRow = <T,>(arr: T[], i: number, patch: Partial<T>, setter: (v: T[]) => void) => {
    const next = [...arr];
    next[i] = { ...next[i], ...patch };
    setter(next);
  };

  const removeRow = <T,>(arr: T[], i: number, setter: (v: T[]) => void) => {
    setter(arr.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` },
        { label: 'Edit Log' },
      ]} />

      <h1 className="font-heading text-2xl font-bold">Edit Daily Log</h1>

      {/* Date */}
      <Card>
        <CardHeader><CardTitle>Date</CardTitle></CardHeader>
        <CardContent><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" /></CardContent>
      </Card>

      {/* Weather */}
      <Card>
        <CardHeader><CardTitle>Weather</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Temperature (°F)</label>
            <Input type="number" placeholder="e.g. 42" value={temp} onChange={(e) => setTemp(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Conditions</label>
            <Select value={conditions} onValueChange={setConditions}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Wind</label>
            <Input placeholder="e.g. NW 8 mph" value={wind} onChange={(e) => setWind(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Personnel */}
      <Card>
        <CardHeader><CardTitle>Personnel</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {personnel.map((p, i) => (
            <div key={i} className="grid gap-2 grid-cols-[1fr_80px] sm:grid-cols-[1fr_80px_1fr_44px] items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <Select value={p.role} onValueChange={(v) => updateRow(personnel, i, { role: v }, setPersonnel)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Count</label>
                <Input type="number" min={0} value={p.headcount || ''} onChange={(e) => updateRow(personnel, i, { headcount: Number(e.target.value) }, setPersonnel)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Company</label>
                <Input placeholder="Company" value={p.company} onChange={(e) => updateRow(personnel, i, { company: e.target.value }, setPersonnel)} />
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={() => removeRow(personnel, i, setPersonnel)} disabled={personnel.length === 1}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPersonnel([...personnel, { role: '', headcount: 0, company: '' }])}>
            <Plus className="mr-1 size-4" />Add Personnel
          </Button>
        </CardContent>
      </Card>

      {/* Equipment */}
      <Card>
        <CardHeader><CardTitle>Equipment</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {equipment.map((e, i) => (
            <div key={i} className="grid gap-2 grid-cols-[1fr_80px] sm:grid-cols-[1fr_80px_1fr_44px] items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Equipment Type</label>
                <Input placeholder="e.g. Excavator" value={e.type} onChange={(ev) => updateRow(equipment, i, { type: ev.target.value }, setEquipment)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Count</label>
                <Input type="number" min={0} value={e.count || ''} onChange={(ev) => updateRow(equipment, i, { count: Number(ev.target.value) }, setEquipment)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Input placeholder="Notes" value={e.notes} onChange={(ev) => updateRow(equipment, i, { notes: ev.target.value }, setEquipment)} />
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={() => removeRow(equipment, i, setEquipment)} disabled={equipment.length === 1}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setEquipment([...equipment, { type: '', count: 0, notes: '' }])}>
            <Plus className="mr-1 size-4" />Add Equipment
          </Button>
        </CardContent>
      </Card>

      {/* Work Items */}
      <Card>
        <CardHeader><CardTitle>Work Items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {workItems.map((w, i) => (
            <div key={i} className="grid gap-2 grid-cols-2 sm:grid-cols-[1fr_80px_100px_1fr_44px] items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Input placeholder="Work description" value={w.description} onChange={(e) => updateRow(workItems, i, { description: e.target.value }, setWorkItems)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Qty</label>
                <Input type="number" min={0} value={w.quantity || ''} onChange={(e) => updateRow(workItems, i, { quantity: Number(e.target.value) }, setWorkItems)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Unit</label>
                <Select value={w.unit} onValueChange={(v) => updateRow(workItems, i, { unit: v }, setWorkItems)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <Input placeholder="Location" value={w.location} onChange={(e) => updateRow(workItems, i, { location: e.target.value }, setWorkItems)} />
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={() => removeRow(workItems, i, setWorkItems)} disabled={workItems.length === 1}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setWorkItems([...workItems, { description: '', quantity: 0, unit: '', location: '' }])}>
            <Plus className="mr-1 size-4" />Add Work Item
          </Button>
        </CardContent>
      </Card>

      {/* Work Summary & Safety Notes */}
      <Card>
        <CardHeader><CardTitle>Work Summary</CardTitle></CardHeader>
        <CardContent><Textarea rows={4} placeholder="Describe overall work completed today..." value={workSummary} onChange={(e) => setWorkSummary(e.target.value)} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Safety Notes</CardTitle></CardHeader>
        <CardContent><Textarea rows={3} placeholder="Any safety observations, incidents, or notes..." value={safetyNotes} onChange={(e) => setSafetyNotes(e.target.value)} /></CardContent>
      </Card>

      {/* GPS Location */}
      <Card>
        <CardHeader><CardTitle>Location</CardTitle></CardHeader>
        <CardContent>
          <GeoTagInput value={geoTag} onChange={setGeoTag} label="Job Site GPS Location" />
        </CardContent>
      </Card>

      {/* Photo Upload */}
      <PhotoUpload
        photos={photos}
        onPhotosChange={setPhotos}
        entityType="daily_log"
        entityId={logId}
        projectId={projectId}
      />

      {errorMsg && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTitle className="text-red-800">Error</AlertTitle>
          <AlertDescription className="text-red-700">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-emerald-300 bg-emerald-50">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">Daily log updated</AlertTitle>
          <AlertDescription className="text-emerald-700">Redirecting to daily log…</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pb-8">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.push(`/projects/${projectId}/daily-logs/${logId}`)}>Cancel</Button>
        <Button
          className="bg-rc-orange hover:bg-rc-orange-dark text-white"
          disabled={success || submitting}
          onClick={async () => {
            setErrorMsg(null);
            setSubmitting(true);

            if (isDemo) {
              storeUpdateDailyLog(logId, {
                log_date: date,
                weather_temp: typeof temp === 'number' ? temp : 0,
                weather_conditions: conditions,
                weather_wind: wind,
                work_summary: workSummary,
                safety_notes: safetyNotes,
                geo_tag: geoTag,
                personnel,
                equipment: equipment.map((e) => ({ type: e.type, count: e.count, notes: e.notes })),
                work_items: workItems,
              });

              setSuccess(true);
              setTimeout(() => router.push(`/projects/${projectId}/daily-logs/${logId}`), 1500);
            } else {
              const result = await serverUpdateDailyLog(projectId, logId, {
                log_date: date,
                weather_temp: typeof temp === 'number' ? temp : 0,
                weather_conditions: conditions,
                weather_wind: wind,
                work_summary: workSummary,
                safety_notes: safetyNotes,
                geo_tag: geoTag,
                personnel,
                equipment: equipment.map((e) => ({ equipment_type: e.type, count: e.count, notes: e.notes })),
                work_items: workItems,
              });

              if (result.error) {
                setErrorMsg(result.error);
                setSubmitting(false);
                return;
              }

              // Upload any new photos
              if (photos.length > 0) {
                setUploadProgress(`Uploading ${photos.length} photo${photos.length !== 1 ? 's' : ''}…`);
                const uploadResult = await uploadPhotosAfterCreate(photos, 'daily_log', logId, projectId);
                setUploadProgress(null);
                if (uploadResult.failed > 0) {
                  setErrorMsg(`${uploadResult.succeeded} of ${uploadResult.total} photos uploaded. ${uploadResult.failed} failed.`);
                  setSubmitting(false);
                  return;
                }
              }

              setSuccess(true);
              setTimeout(() => router.push(`/projects/${projectId}/daily-logs/${logId}`), 1500);
            }
          }}
        >
          {uploadProgress ?? (submitting && !success ? 'Saving…' : 'Save Changes')}
        </Button>
      </div>
    </div>
  );
}
