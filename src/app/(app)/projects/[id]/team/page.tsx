'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Mail, Phone, X, UserPlus, Users } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  getProfiles,
  getOrganizations,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  addProfile,
  addOrganization,
} from '@/lib/store';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';

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
const ORG_TYPES = ['contractor', 'engineer', 'owner', 'inspector'] as const;

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
  const { can } = usePermissions(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [, forceUpdate] = useState(0);

  // New member form state
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [newProjectRole, setNewProjectRole] = useState('');
  const [creatingNewOrg, setCreatingNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState('');

  const projectMembers = getProjectMembers(projectId);

  const members = useMemo(() => {
    return projectMembers.map((pm, idx) => {
      const profile = getProfiles().find((p) => p.id === pm.profile_id);
      const org = profile
        ? getOrganizations().find((o) => o.id === profile.organization_id)
        : undefined;
      return { member: pm, profile, org, colorIdx: idx };
    });
  }, [projectMembers]);

  const availableProfiles = getProfiles().filter(
    (p) => !projectMembers.some((pm) => pm.profile_id === p.id)
  );

  function resetDialogState() {
    setSelectedProfile('');
    setSelectedRole('');
    setNewFullName('');
    setNewEmail('');
    setNewPhone('');
    setNewOrgId('');
    setNewProjectRole('');
    setCreatingNewOrg(false);
    setNewOrgName('');
    setNewOrgType('');
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) resetDialogState();
  }

  function handleAddExistingMember() {
    if (!selectedProfile || !selectedRole) return;
    addProjectMember(projectId, selectedProfile, selectedRole);
    resetDialogState();
    setDialogOpen(false);
    forceUpdate((n) => n + 1);
  }

  function handleAddNewMember() {
    if (!newFullName.trim() || !newEmail.trim() || !newProjectRole) return;

    let organizationId = newOrgId;

    // If creating a new org, do that first
    if (creatingNewOrg) {
      if (!newOrgName.trim() || !newOrgType) return;
      const org = addOrganization({
        name: newOrgName.trim(),
        type: newOrgType as typeof ORG_TYPES[number],
      });
      organizationId = org.id;
    }

    if (!organizationId) return;

    // Create the profile
    const profile = addProfile({
      full_name: newFullName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim() || '(000) 000-0000',
      role: 'member',
      organization_id: organizationId,
    });

    // Add to project
    addProjectMember(projectId, profile.id, newProjectRole);

    resetDialogState();
    setDialogOpen(false);
    forceUpdate((n) => n + 1);
  }

  function handleRemoveMember(memberId: string) {
    removeProjectMember(memberId);
    forceUpdate((n) => n + 1);
  }

  function handleOrgSelectChange(value: string) {
    if (value === '__new__') {
      setCreatingNewOrg(true);
      setNewOrgId('');
    } else {
      setCreatingNewOrg(false);
      setNewOrgId(value);
    }
  }

  const canSubmitNew =
    newFullName.trim() &&
    newEmail.trim() &&
    newProjectRole &&
    (creatingNewOrg ? newOrgName.trim() && newOrgType : newOrgId);

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
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          {can(ACTIONS.TEAM_MANAGE) && (
            <DialogTrigger asChild>
              <Button className="bg-rc-orange hover:bg-rc-orange-dark text-white">
                <Plus className="size-4" /> Add Team Member
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="existing" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="existing" className="flex-1 gap-1.5">
                  <Users className="size-3.5" />
                  Existing Member
                </TabsTrigger>
                <TabsTrigger value="new" className="flex-1 gap-1.5">
                  <UserPlus className="size-3.5" />
                  New Member
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Existing Member */}
              <TabsContent value="existing">
                <div className="space-y-4 mt-3">
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
                    onClick={handleAddExistingMember}
                    disabled={!selectedProfile || !selectedRole}
                    className="w-full bg-rc-orange hover:bg-rc-orange-dark text-white"
                  >
                    Add Member
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: New Member */}
              <TabsContent value="new">
                <div className="space-y-4 mt-3">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="John Smith"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>

                  {/* Organization */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Organization <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={creatingNewOrg ? '__new__' : newOrgId}
                      onValueChange={handleOrgSelectChange}
                    >
                      <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                      <SelectContent>
                        {getOrganizations().map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                        <SelectItem value="__new__">+ Create New Organization</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Inline new org fields */}
                    {creatingNewOrg && (
                      <div className="space-y-3 rounded-md border p-3 mt-2 bg-muted/30">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">
                            Organization Name <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="text"
                            placeholder="Acme Construction"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">
                            Organization Type <span className="text-red-500">*</span>
                          </label>
                          <Select value={newOrgType} onValueChange={setNewOrgType}>
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                              {ORG_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{formatRole(t)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Project Role */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Project Role <span className="text-red-500">*</span>
                    </label>
                    <Select value={newProjectRole} onValueChange={setNewProjectRole}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {PROJECT_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{formatRole(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleAddNewMember}
                    disabled={!canSubmitNew}
                    className="w-full bg-rc-orange hover:bg-rc-orange-dark text-white"
                  >
                    Create & Add Member
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
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
              {can(ACTIONS.TEAM_MANAGE) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-9 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                  onClick={() => handleRemoveMember(member.id)}
                >
                  <X className="size-3.5" />
                </Button>
              )}
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
