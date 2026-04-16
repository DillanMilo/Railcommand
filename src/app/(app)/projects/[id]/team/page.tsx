'use client';

import { useState, useMemo, useEffect, useCallback, use } from 'react';
import { Plus, Mail, Phone, X, UserPlus, Users, Mail as MailIcon, Clock, Send, CheckCircle2, ShieldCheck, ChevronDown } from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  addProjectMember as storeAddProjectMember,
  removeProjectMember as storeRemoveProjectMember,
  updateMemberRole as storeUpdateMemberRole,
  addProfile,
  addOrganization,
  getProjectInvitations as storeGetProjectInvitations,
  addInvitation as storeAddInvitation,
  updateInvitationStatus,
  getProjectById,
} from '@/lib/store';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS, PERMISSION_MATRIX } from '@/lib/permissions';
import { useProjectMembers } from '@/hooks/useData';
import { useProject } from '@/components/providers/ProjectProvider';
import { addProjectMember as serverAddProjectMember, removeProjectMember as serverRemoveProjectMember, updateMemberRole as serverUpdateMemberRole, leaveProject as serverLeaveProject } from '@/lib/actions/team';
import { createInvitation, getProjectInvitations as serverGetProjectInvitations, cancelInvitation as serverCancelInvitation } from '@/lib/actions/invitations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TIER_LIMITS } from '@/lib/types';
import type { ProjectInvitation, Tier, ProjectMember } from '@/lib/types';

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

export default function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const { isDemo, currentUserId } = useProject();
  const { can } = usePermissions(projectId);
  const { data: projectMembers, loading, refetch } = useProjectMembers(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  // New member form state
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [newProjectRole, setNewProjectRole] = useState('');
  const [creatingNewOrg, setCreatingNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState('');

  // Invite by email state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [projectInvitations, setProjectInvitations] = useState<ProjectInvitation[]>([]);

  // Fetch invitations
  const fetchInvitations = useCallback(async () => {
    if (isDemo) {
      setProjectInvitations(storeGetProjectInvitations(projectId));
    } else {
      const result = await serverGetProjectInvitations(projectId);
      if (result.data) setProjectInvitations(result.data);
    }
  }, [isDemo, projectId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Tier info
  const tierInfo = useMemo(() => {
    if (isDemo) {
      const project = getProjectById(projectId);
      if (project) {
        const org = getOrganizations().find((o) => o.id === project.organization_id);
        const tier: Tier = org?.tier ?? 'free';
        const limit = TIER_LIMITS[tier];
        return { tier, limit };
      }
    }
    // Fallback: default to pro
    return { tier: 'pro' as Tier, limit: TIER_LIMITS.pro };
  }, [isDemo, projectId]);

  const pendingInvitations = useMemo(
    () => projectInvitations.filter((i) => i.status === 'pending'),
    [projectInvitations]
  );

  const members = useMemo(() => {
    return projectMembers.map((pm, idx) => {
      const profile = pm.profile ?? getProfiles().find((p) => p.id === pm.profile_id);
      const org = profile?.organization
        ?? (profile ? getOrganizations().find((o) => o.id === profile.organization_id) : undefined);
      return { member: pm, profile, org, colorIdx: idx };
    });
  }, [projectMembers]);

  const totalCount = members.length + pendingInvitations.length;
  const atLimit = totalCount >= tierInfo.limit;

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
    setInviteEmail('');
    setInviteRole('');
    setInviteSending(false);
    setInviteSuccess('');
    setInviteError('');
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) resetDialogState();
  }

  async function handleAddExistingMember() {
    if (!selectedProfile || !selectedRole) return;
    if (isDemo) {
      storeAddProjectMember(projectId, selectedProfile, selectedRole);
    } else {
      await serverAddProjectMember(projectId, selectedProfile, selectedRole as ProjectMember['project_role']);
    }
    resetDialogState();
    setDialogOpen(false);
    refetch();
    fetchInvitations();
  }

  async function handleAddNewMember() {
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
    if (isDemo) {
      storeAddProjectMember(projectId, profile.id, newProjectRole);
    } else {
      await serverAddProjectMember(projectId, profile.id, newProjectRole as ProjectMember['project_role']);
    }

    resetDialogState();
    setDialogOpen(false);
    refetch();
    fetchInvitations();
  }

  // Send email invitation handler
  async function handleSendInvitation() {
    if (!inviteEmail.trim() || !inviteRole) return;
    setInviteSending(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      if (isDemo) {
        // Check tier limit in demo mode
        if (atLimit) {
          setInviteError(`Your ${tierInfo.tier} plan allows up to ${tierInfo.limit} members per project. Upgrade to add more.`);
          setInviteSending(false);
          return;
        }
        storeAddInvitation({
          project_id: projectId,
          email: inviteEmail.trim(),
          project_role: inviteRole as ProjectMember['project_role'],
        });
        setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
        setInviteEmail('');
        setInviteRole('');
        fetchInvitations();
      } else {
        const result = await createInvitation(projectId, inviteEmail.trim(), inviteRole as ProjectMember['project_role']);
        if (result.error) {
          setInviteError(result.error);
        } else {
          setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
          setInviteEmail('');
          setInviteRole('');
          fetchInvitations();
        }
      }
    } catch {
      setInviteError('Failed to send invitation');
    } finally {
      setInviteSending(false);
    }
  }

  // Cancel invitation handler
  async function handleCancelInvitation(invitationId: string) {
    if (isDemo) {
      updateInvitationStatus(invitationId, 'expired');
    } else {
      await serverCancelInvitation(invitationId, projectId);
    }
    fetchInvitations();
  }

  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  function handleRemoveMember(memberId: string) {
    setPendingRemoveId(memberId);
  }

  async function confirmRemoveMember() {
    if (pendingRemoveId) {
      if (isDemo) {
        storeRemoveProjectMember(pendingRemoveId);
      } else {
        await serverRemoveProjectMember(projectId, pendingRemoveId);
      }
      setPendingRemoveId(null);
      refetch();
      fetchInvitations();
    }
  }

  async function confirmLeaveProject() {
    setLeaveError(null);
    setLeaveSubmitting(true);
    try {
      if (isDemo) {
        // In demo mode, find current user's membership and remove it
        const ownMembership = (projectMembers ?? []).find(
          (m) => m.profile_id === currentUserId
        );
        if (ownMembership) {
          storeRemoveProjectMember(ownMembership.id);
        }
        setLeaveDialogOpen(false);
        // Redirect to dashboard since user is no longer a member
        window.location.href = '/dashboard';
      } else {
        const result = await serverLeaveProject(projectId);
        if (result.error) {
          setLeaveError(result.error);
          setLeaveSubmitting(false);
          return;
        }
        setLeaveDialogOpen(false);
        // Redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Failed to leave project');
      setLeaveSubmitting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: ProjectMember['project_role']) {
    if (isDemo) {
      storeUpdateMemberRole(memberId, newRole);
    } else {
      await serverUpdateMemberRole(projectId, memberId, newRole);
    }
    refetch();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
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
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              atLimit ? 'border-red-300 text-red-600 bg-red-50' : 'text-muted-foreground'
            )}
          >
            {totalCount}/{tierInfo.limit === Infinity ? '\u221E' : tierInfo.limit} members ({tierInfo.tier.charAt(0).toUpperCase() + tierInfo.tier.slice(1)} plan)
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
                <TabsTrigger value="invite" className="flex-1 gap-1.5">
                  <Send className="size-3.5" />
                  Invite by Email
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

              {/* Tab 2: Invite by Email */}
              <TabsContent value="invite">
                <div className="space-y-4 mt-3">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); setInviteSuccess(''); }}
                    />
                  </div>

                  {/* Project Role */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Project Role <span className="text-red-500">*</span>
                    </label>
                    <Select value={inviteRole} onValueChange={(v) => { setInviteRole(v); setInviteError(''); }}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {PROJECT_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{formatRole(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Success message */}
                  {inviteSuccess && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      {inviteSuccess}
                    </div>
                  )}

                  {/* Error message */}
                  {inviteError && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                      {inviteError}
                    </div>
                  )}

                  <Button
                    onClick={handleSendInvitation}
                    disabled={!inviteEmail.trim() || !inviteRole || inviteSending}
                    className="w-full bg-rc-orange hover:bg-rc-orange-dark text-white"
                  >
                    {inviteSending ? 'Sending...' : 'Send Invitation'}
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
              {can(ACTIONS.TEAM_MANAGE) && member.profile_id !== currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-9 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                  onClick={() => handleRemoveMember(member.id)}
                  title="Remove from project"
                >
                  <X className="size-3.5" />
                </Button>
              )}
              {member.profile_id === currentUserId && (
                <Badge variant="outline" className="absolute top-2 right-2 text-[10px]">
                  You
                </Badge>
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
                    {can(ACTIONS.TEAM_MANAGE) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-0.5 mt-0.5 group/role">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'border-0 text-[10px] cursor-pointer transition-opacity group-hover/role:opacity-80',
                                ROLE_COLORS[member.project_role] ?? ROLE_COLORS.owner
                              )}
                            >
                              {formatRole(member.project_role)}
                              <ChevronDown className="size-2.5 ml-0.5" />
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[160px]">
                          {PROJECT_ROLES.map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => handleRoleChange(member.id, r as ProjectMember['project_role'])}
                              className={cn(
                                'text-xs',
                                r === member.project_role && 'font-semibold'
                              )}
                            >
                              <span className={cn(
                                'size-2 rounded-full shrink-0',
                                r === member.project_role ? 'bg-rc-orange' : 'bg-muted-foreground/30'
                              )} />
                              {formatRole(r)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'border-0 text-[10px] mt-0.5',
                          ROLE_COLORS[member.project_role] ?? ROLE_COLORS.owner
                        )}
                      >
                        {formatRole(member.project_role)}
                      </Badge>
                    )}
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

        {members.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-rc-border py-16 text-muted-foreground">
            <Users className="size-10 mb-3" />
            <p className="text-sm font-medium">No team members yet</p>
            <p className="text-xs mt-1">Add your first team member to get started</p>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-heading text-lg font-semibold">Pending Invitations</h2>
            <Badge variant="secondary" className="text-xs">
              {pendingInvitations.length}
            </Badge>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
              <span>Email</span>
              <span>Role</span>
              <span>Sent</span>
              <span />
            </div>
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 border-b last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MailIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate">{invitation.email}</span>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'border-0 text-[10px]',
                    ROLE_COLORS[invitation.project_role] ?? ROLE_COLORS.owner
                  )}
                >
                  {formatRole(invitation.project_role)}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <Clock className="size-3" />
                  {new Date(invitation.created_at).toLocaleDateString()}
                </div>
                {can(ACTIONS.TEAM_MANAGE) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-red-500 h-7 px-2"
                    onClick={() => handleCancelInvitation(invitation.id)}
                  >
                    <X className="size-3 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions Reference */}
      {can(ACTIONS.TEAM_MANAGE) && (
        <PermissionsReference />
      )}

      {/* Leave Project section (for current user) */}
      {members.some((m) => m.member.profile_id === currentUserId) && (
        <div className="mt-8 pt-6 border-t border-rc-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Leave this project</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                You&apos;ll lose access, but any work you&apos;ve contributed (RFIs, photos, daily logs, etc.) stays with the project.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLeaveDialogOpen(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
            >
              Leave Project
            </Button>
          </div>
        </div>
      )}

      {/* Leave project confirmation dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={(open) => { if (!open) { setLeaveDialogOpen(false); setLeaveError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Project</DialogTitle>
            <DialogDescription>
              You&apos;re about to leave this project. You will lose access immediately. Your contributions (RFIs, submittals, daily logs, photos, etc.) will remain with the project for the team to continue using.
            </DialogDescription>
          </DialogHeader>
          {leaveError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 text-sm">
              {leaveError}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)} disabled={leaveSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmLeaveProject} disabled={leaveSubmitting}>
              {leaveSubmitting ? 'Leaving...' : 'Leave Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation dialog */}
      <Dialog open={pendingRemoveId !== null} onOpenChange={(open) => { if (!open) setPendingRemoveId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member from the project? They will lose access to all project data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingRemoveId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveMember}>
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Permissions Reference (collapsible)                                */
/* ------------------------------------------------------------------ */

const ACTION_LABELS: Record<string, string> = {
  'submittal:create': 'Create Submittals',
  'submittal:review': 'Review Submittals',
  'rfi:create': 'Create RFIs',
  'rfi:respond': 'Respond to RFIs',
  'rfi:close': 'Close RFIs',
  'daily_log:create': 'Create Daily Logs',
  'daily_log:update': 'Update Daily Logs',
  'punch_list:create': 'Create Punch Items',
  'punch_list:resolve': 'Resolve Punch Items',
  'punch_list:verify': 'Verify Punch Items',
  'team:manage': 'Manage Team',
  'project:manage': 'Manage Project',
  'project:edit': 'Edit Project',
  'schedule:edit': 'Edit Schedule',
  'budget:view': 'View Budget',
  'change_order:manage': 'Manage Change Orders',
  'weekly_report:create': 'Create Weekly Reports',
  'qcqa:create': 'Create QC/QA Reports',
  'qcqa:close': 'Close QC/QA Reports',
  'document:manage': 'Manage Documents',
};

const ROLE_ORDER: ProjectMember['project_role'][] = [
  'manager', 'superintendent', 'engineer', 'foreman', 'contractor', 'inspector', 'owner',
];

function PermissionsReference() {
  const [expanded, setExpanded] = useState(false);
  const allActions = Object.values(ACTIONS);

  return (
    <div className="mt-10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ShieldCheck className="size-4" />
        Permissions by Role
        <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[160px]">
                  Permission
                </th>
                {ROLE_ORDER.map((role) => (
                  <th key={role} className="text-center px-2 py-2.5 font-medium whitespace-nowrap">
                    <Badge
                      variant="secondary"
                      className={cn('border-0 text-[10px]', ROLE_COLORS[role] ?? ROLE_COLORS.owner)}
                    >
                      {formatRole(role)}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allActions.map((action) => (
                <tr key={action} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground sticky left-0 bg-white dark:bg-background">
                    {ACTION_LABELS[action] ?? action}
                  </td>
                  {ROLE_ORDER.map((role) => {
                    const allowed = PERMISSION_MATRIX[role]?.includes(action);
                    return (
                      <td key={role} className="text-center px-2 py-2">
                        {allowed ? (
                          <span className="text-rc-emerald font-bold">&#10003;</span>
                        ) : (
                          <span className="text-muted-foreground/30">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
