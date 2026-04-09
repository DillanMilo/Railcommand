'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { updateProject as storeUpdateProject } from '@/lib/store';
import { useProject } from '@/components/providers/ProjectProvider';
import { updateProject as serverUpdateProject } from '@/lib/actions/projects';
import type { Project } from '@/lib/types';

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}

export default function EditProjectDialog({ open, onOpenChange, project }: EditProjectDialogProps) {
  const { refreshProjects, isDemo } = useProject();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [location, setLocation] = useState(project.location);
  const [client, setClient] = useState(project.client);
  const [startDate, setStartDate] = useState(project.start_date);
  const [targetEndDate, setTargetEndDate] = useState(project.target_end_date);
  const [budgetTotal, setBudgetTotal] = useState(String(project.budget_total));
  const [turnoverDate, setTurnoverDate] = useState(project.turnover_date ?? '');
  const [substantialCompletionDate, setSubstantialCompletionDate] = useState(project.substantial_completion_date ?? '');
  const [projectCompletionDate, setProjectCompletionDate] = useState(project.project_completion_date ?? '');
  const [saving, setSaving] = useState(false);

  // Sync form when project changes
  useEffect(() => {
    setName(project.name);
    setDescription(project.description);
    setLocation(project.location);
    setClient(project.client);
    setStartDate(project.start_date);
    setTargetEndDate(project.target_end_date);
    setBudgetTotal(String(project.budget_total));
    setTurnoverDate(project.turnover_date ?? '');
    setSubstantialCompletionDate(project.substantial_completion_date ?? '');
    setProjectCompletionDate(project.project_completion_date ?? '');
  }, [project]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !targetEndDate) return;

    setSaving(true);

    const data = {
      name: name.trim(),
      description: description.trim(),
      location: location.trim(),
      client: client.trim(),
      start_date: startDate,
      target_end_date: targetEndDate,
      budget_total: budgetTotal ? parseFloat(budgetTotal) : 0,
      turnover_date: turnoverDate || undefined,
      substantial_completion_date: substantialCompletionDate || undefined,
      project_completion_date: projectCompletionDate || undefined,
    };

    if (isDemo) {
      storeUpdateProject(project.id, data);
    } else {
      const result = await serverUpdateProject(project.id, {
        ...data,
        turnover_date: turnoverDate || null,
        substantial_completion_date: substantialCompletionDate || null,
        project_completion_date: projectCompletionDate || null,
      });
      if (result.error) {
        console.error('Failed to update project:', result.error);
        alert(`Failed to update project: ${result.error}`);
        setSaving(false);
        return;
      }
    }

    refreshProjects();
    onOpenChange(false);
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div className="space-y-2">
            <label htmlFor="ep-name" className="text-sm font-medium">Project Name *</label>
            <Input
              id="ep-name"
              placeholder="e.g. Denver Union Station Upgrade"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ep-description" className="text-sm font-medium">Description</label>
            <Textarea
              id="ep-description"
              placeholder="Brief project description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="ep-location" className="text-sm font-medium">Location</label>
              <Input
                id="ep-location"
                placeholder="e.g. Denver, CO"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ep-client" className="text-sm font-medium">Client</label>
              <Input
                id="ep-client"
                placeholder="e.g. Colorado Rail Authority"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="ep-start" className="text-sm font-medium">Start Date *</label>
              <Input
                id="ep-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ep-end" className="text-sm font-medium">Target End Date *</label>
              <Input
                id="ep-end"
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="ep-turnover" className="text-sm font-medium">Turnover Date</label>
              <Input
                id="ep-turnover"
                type="date"
                value={turnoverDate}
                onChange={(e) => setTurnoverDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ep-sc" className="text-sm font-medium">Substantial Completion</label>
              <Input
                id="ep-sc"
                type="date"
                value={substantialCompletionDate}
                onChange={(e) => setSubstantialCompletionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ep-pc" className="text-sm font-medium">Project Completion</label>
              <Input
                id="ep-pc"
                type="date"
                value={projectCompletionDate}
                onChange={(e) => setProjectCompletionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="ep-budget" className="text-sm font-medium">Total Budget ($)</label>
            <Input
              id="ep-budget"
              type="number"
              min="0"
              step="1000"
              placeholder="e.g. 5000000"
              value={budgetTotal}
              onChange={(e) => setBudgetTotal(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto"
              disabled={!name.trim() || !startDate || !targetEndDate || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
