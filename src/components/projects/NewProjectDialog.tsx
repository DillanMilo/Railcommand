'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { addProject } from '@/lib/store';
import { useProject } from '@/components/providers/ProjectProvider';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const router = useRouter();
  const { setCurrentProjectId, refreshProjects } = useProject();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [client, setClient] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [budgetTotal, setBudgetTotal] = useState('');

  function resetForm() {
    setName('');
    setDescription('');
    setLocation('');
    setClient('');
    setStartDate('');
    setTargetEndDate('');
    setBudgetTotal('');
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !targetEndDate) return;

    const project = addProject({
      name: name.trim(),
      description: description.trim(),
      location: location.trim(),
      client: client.trim(),
      start_date: startDate,
      target_end_date: targetEndDate,
      budget_total: budgetTotal ? parseFloat(budgetTotal) : 0,
    });

    refreshProjects();
    setCurrentProjectId(project.id);
    onOpenChange(false);
    resetForm();
    router.push(`/projects/${project.id}/submittals`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div className="space-y-2">
            <label htmlFor="np-name" className="text-sm font-medium">Project Name *</label>
            <Input
              id="np-name"
              placeholder="e.g. Denver Union Station Upgrade"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="np-description" className="text-sm font-medium">Description</label>
            <Textarea
              id="np-description"
              placeholder="Brief project description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="np-location" className="text-sm font-medium">Location</label>
              <Input
                id="np-location"
                placeholder="e.g. Denver, CO"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="np-client" className="text-sm font-medium">Client</label>
              <Input
                id="np-client"
                placeholder="e.g. Colorado Rail Authority"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="np-start" className="text-sm font-medium">Start Date *</label>
              <Input
                id="np-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="np-end" className="text-sm font-medium">Target End Date *</label>
              <Input
                id="np-end"
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="np-budget" className="text-sm font-medium">Total Budget ($)</label>
            <Input
              id="np-budget"
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
              disabled={!name.trim() || !startDate || !targetEndDate}
            >
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
