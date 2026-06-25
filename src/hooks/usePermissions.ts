'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProject } from '@/components/providers/ProjectProvider';
import { useProjectMembers } from '@/hooks/useData';
import { getMyProfile } from '@/lib/actions/profiles';
import {
  canPerformWithProjectEdit,
  getAllowedActionsWithProjectEdit,
  type Action,
} from '@/lib/permissions';
import type { Profile, ProjectMember } from '@/lib/types';

interface UsePermissionsResult {
  can: (action: Action) => boolean;
  role: ProjectMember['project_role'] | null;
  membership: ProjectMember | null;
  allowedActions: Action[];
}

export function usePermissions(projectId: string): UsePermissionsResult {
  const { currentUserId, isDemo } = useProject();
  const { data: members } = useProjectMembers(projectId);
  const [orgRole, setOrgRole] = useState<Profile['role'] | null>(null);

  useEffect(() => {
    if (isDemo || !currentUserId) {
      setOrgRole(null);
      return;
    }

    let cancelled = false;
    getMyProfile().then((result) => {
      if (!cancelled) setOrgRole(result.data?.role ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, isDemo]);

  const membership = useMemo(
    () => members.find((m) => m.profile_id === currentUserId) ?? null,
    [members, currentUserId]
  );

  const role = orgRole === 'admin'
    ? 'manager'
    : membership?.project_role ?? null;

  const canEdit = membership?.can_edit ?? false;

  const allowedActions = useMemo(
    () => getAllowedActionsWithProjectEdit(role, canEdit),
    [role, canEdit]
  );

  const can = useMemo(
    () => (action: Action) => canPerformWithProjectEdit(role, canEdit, action),
    [role, canEdit]
  );

  return { can, role, membership, allowedActions };
}
