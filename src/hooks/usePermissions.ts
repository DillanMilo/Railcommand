'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProject } from '@/components/providers/ProjectProvider';
import { useProjectMembers } from '@/hooks/useData';
import { getMyProfile } from '@/lib/actions/profiles';
import { canPerform, getAllowedActions, type Action } from '@/lib/permissions';
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
