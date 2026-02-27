'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Mail, Phone, X } from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  seedProfiles,
  seedOrganizations,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
} from '@/lib/store';
import { cn } from '@/lib/utils';

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-purple-100 text-purple-700',
  engineer: 'bg-blue-100 text-blue-700',
  contractor: 'bg-orange-100 text-orange-700',
  inspector: 'bg-emerald-100 text-emerald-700',
  foreman: 'bg-amber-100 text-amber-700',
  superintendent: 'bg-slate-100 text-slate-700',
  owner: 'bg-gray-100 text-gray-700',
};

const AVATAR_COLORS = [
  'bg-rc-navy text-white',
  'bg-rc-orange text-white',
  'bg-rc-emerald text-white',
  'bg-rc-blue text-white',
  'bg-rc-amber text-white',
  'bg-purple-600 text-white',
  'bg-rc-red text-white',
  'bg-teal-600 text-white',
];

const PROJECT_ROLES = ['manager', 'engineer', 'contractor', 'inspector', 'foreman', 'superintendent'];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRole(role: string) {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TeamPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [, forceUpdate] = useState(0);

  const projectMembers = getProjectMembers();

  const members = useMemo(() => {
    return projectMembers.map((pm, idx) => {
      const profile = seedProfiles.find((p) => p.id === pm.profile_id);
      const org = profile
        ? seedOrganizations.find((o) => o.id === profile.organization_id)
        : undefined;
      return { member: pm, profile, org, colorIdx: idx };
    });
  }, [projectMembers]);

  const availableProfiles = seedProfiles.filter(
    (p) => !projectMembers.some((pm) => pm.profile_id === p.id)
  );

  function handleAddMember() {
    if (!selectedProfile || !selectedRole) return;
    addProjectMember(selectedProfile, selectedRole);
    setSelectedProfile('');
    setSelectedRole('');
    setDialogOpen(false);
    forceUpdate((n) => n + 1);
  }

  function handleRemoveMember(memberId: string) {
    removeProjectMember(memberId);
    forceUpdate((n) => n + 1);
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Team' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold">Project Team</h1>
          <Badge variant="secondary" className="text-xs">
            {members.length} members
          </Badge>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              <Plus className="size-4" /> Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Team Member</label>
                <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                  <SelectTrigger><SelectValue placeholder="Select a person" /></SelectTrigger>
                  <SelectContent>
                    {availableProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                    {availableProfiles.length === 0 && (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">All team members already added</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{formatRole(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddMember}
                disabled={!selectedProfile || !selectedRole}
                className="w-full bg-rc-orange hover:bg-rc-orange-dark text-white"
              >
                Add Member
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {members.map(({ member, profile, org, colorIdx }) => {
          if (!profile) return null;
          const avatarColor = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];

          return (
            <Card key={member.id} className="gap-0 py-4 hover:border-rc-orange/40 transition-colors relative group">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                onClick={() => handleRemoveMember(member.id)}
              >
                <X className="size-3.5" />
              </Button>
              <CardContent className="px-4 space-y-3">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex shrink-0 items-center justify-center rounded-full size-11 text-sm font-bold',
                      avatarColor
                    )}
                  >
                    {getInitials(profile.full_name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{profile.full_name}</p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'border-0 text-[10px] mt-0.5',
                        ROLE_COLORS[member.project_role] ?? ROLE_COLORS.owner
                      )}
                    >
                      {formatRole(member.project_role)}
                    </Badge>
                  </div>
                </div>

                {org && (
                  <p className="text-xs text-muted-foreground truncate">{org.name}</p>
                )}

                <div className="space-y-1">
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-center gap-1.5 text-xs text-rc-blue hover:underline truncate"
                  >
                    <Mail className="size-3 shrink-0" />
                    {profile.email}
                  </a>
                  <a
                    href={`tel:${profile.phone}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="size-3 shrink-0" />
                    {profile.phone}
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
