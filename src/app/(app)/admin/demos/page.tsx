'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, RefreshCw, Trash2, Power, PowerOff, ExternalLink, Copy, Check, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { DEMO_PRESETS } from '@/lib/demo/types';
import type { DemoAccount } from '@/lib/demo/types';

export default function AdminDemosPage() {
  const [demos, setDemos] = useState<DemoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('team');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDemos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/demo/list');
      if (res.ok) {
        const data = await res.json();
        setDemos(data);
      } else {
        const err = await res.json();
        setError(err.error ?? 'Failed to load demos');
      }
    } catch {
      setError('Failed to fetch demo list');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadDemos(); }, [loadDemos]);

  async function handleCreate() {
    setActionLoading('create');
    setError(null);
    try {
      const res = await fetch('/api/admin/demo/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: selectedPreset }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setShowCreate(false);
        await loadDemos();
      }
    } catch {
      setError('Failed to create demo');
    }
    setActionLoading(null);
  }

  async function handleAction(slug: string, action: 'reset' | 'delete' | 'deactivate' | 'reactivate') {
    if (action === 'delete' && !confirm(`Permanently delete the "${slug}" demo? This cannot be undone.`)) return;
    if (action === 'reset' && !confirm(`Reset "${slug}" demo? All current data will be wiped and re-seeded.`)) return;

    setActionLoading(`${slug}-${action}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/demo/reset/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
      } else {
        await loadDemos();
      }
    } catch {
      setError(`Failed to ${action} demo`);
    }
    setActionLoading(null);
  }

  function copyDemoLink(slug: string) {
    const url = `${window.location.origin}/demo/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  const presetKeys = Object.keys(DEMO_PRESETS);
  const existingSlugs = demos.map(d => d.slug);
  const availablePresets = presetKeys.filter(k => !existingSlugs.includes(k));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Admin' }, { label: 'Demo Accounts' }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="size-6 text-rc-orange" />
            <h1 className="font-heading text-2xl font-bold">Demo Accounts</h1>
            <Badge variant="secondary" className="text-xs">{demos.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage enterprise demo environments for prospects and internal testing
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          disabled={availablePresets.length === 0}
          className="bg-rc-orange hover:bg-rc-orange-dark text-white"
        >
          <Plus className="mr-2 size-4" />
          Create Demo
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Demo accounts table */}
      {demos.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FlaskConical className="size-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-lg font-medium">No demo accounts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first demo from a preset template.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-rc-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-rc-card">
                <TableHead>Slug</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Access Count</TableHead>
                <TableHead>Last Accessed</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demos.map((demo) => (
                <TableRow key={demo.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">{demo.slug}</code>
                      <button
                        onClick={() => copyDemoLink(demo.slug)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy demo link"
                      >
                        {copiedSlug === demo.slug ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{demo.company_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {demo.is_team_demo ? 'Team' : 'Prospect'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={demo.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                    >
                      {demo.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{demo.access_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {demo.last_accessed_at ? format(parseISO(demo.last_accessed_at), 'MMM d, h:mm a') : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(demo.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/demo/${demo.slug}`, '_blank')}
                        title="Open demo"
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(demo.slug, 'reset')}
                        disabled={actionLoading === `${demo.slug}-reset`}
                        title="Reset demo data"
                      >
                        <RefreshCw className={`size-4 ${actionLoading === `${demo.slug}-reset` ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(demo.slug, demo.is_active ? 'deactivate' : 'reactivate')}
                        disabled={!!actionLoading}
                        title={demo.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {demo.is_active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(demo.slug, 'delete')}
                        disabled={!!actionLoading}
                        title="Delete demo"
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Quick Reference Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demo Links</CardTitle>
          <CardDescription>Share these links with prospects — no sign-up required</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {demos.filter(d => d.is_active).map(demo => (
            <div key={demo.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
              <div>
                <span className="font-medium text-sm">{demo.company_name}</span>
                <code className="ml-2 text-xs text-muted-foreground">/demo/{demo.slug}</code>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyDemoLink(demo.slug)}
              >
                {copiedSlug === demo.slug ? <><Check className="size-3 mr-1" /> Copied</> : <><Copy className="size-3 mr-1" /> Copy Link</>}
              </Button>
            </div>
          ))}
          {demos.filter(d => d.is_active).length === 0 && (
            <p className="text-sm text-muted-foreground">No active demos. Create one above.</p>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Demo Account</DialogTitle>
            <DialogDescription>
              Select a preset template. This will create auth users, an organization, a project, and seed all 12 modules with realistic data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Preset Template</label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availablePresets.map(key => {
                    const p = DEMO_PRESETS[key];
                    return (
                      <SelectItem key={key} value={key}>
                        {p.companyName} ({p.isTeamDemo ? 'Team' : 'Prospect'})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedPreset && DEMO_PRESETS[selectedPreset] && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <p><strong>Project:</strong> {DEMO_PRESETS[selectedPreset].project.name}</p>
                <p><strong>Location:</strong> {DEMO_PRESETS[selectedPreset].project.location}</p>
                <p><strong>Budget:</strong> ${DEMO_PRESETS[selectedPreset].project.budgetTotal.toLocaleString()}</p>
                <p><strong>Primary Login:</strong> {DEMO_PRESETS[selectedPreset].primaryUser.email}</p>
                {DEMO_PRESETS[selectedPreset].teamUsers && (
                  <p><strong>Team Logins:</strong> {DEMO_PRESETS[selectedPreset].teamUsers!.map(u => u.fullName).join(', ')}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={actionLoading === 'create' || !selectedPreset}
              className="bg-rc-orange hover:bg-rc-orange-dark text-white"
            >
              {actionLoading === 'create' ? 'Creating...' : 'Create Demo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
