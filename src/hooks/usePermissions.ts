'use client';

import { useMemo } from 'react';
import { useProject } from '@/components/providers/ProjectProvider';
import { getProjectMembers } from '@/lib/store';
import { canPerform, getAllowedActions, type Action } from '@/lib/permissions';
import type { ProjectMember } from '@/lib/types';

interface UsePermissionsResult {
  can: (action: Action) => boolean;
  role: ProjectMember['project_role'] | null;
  membership: ProjectMember | null;
  allowedActions: Action[];
}

export function usePermissions(projectId: string): UsePermissionsResult {
  const { currentUserId } = useProject();
  const members = getProjectMembers(projectId);

  const membership = useMemo(
    () => members.find((m) => m.profile_id === currentUserId) ?? null,
    [members, currentUserId]
  );

  const role = membership?.project_role ?? null;

  const allowedActions = useMemo(
    () => getAllowedActions(role),
    [role]
  );

  const can = useMemo(
    () => (action: Action) => canPerform(role, action),
    [role]
  );

  return { can, role, membership, allowedActions };
}
