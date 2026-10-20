import type { MobileBootstrap } from '@railcommand/domain';

// Project selection cannot relabel the previous project's records or metrics.
export function bootstrapForProject(value: MobileBootstrap, userId: string, projectId = value.activeProjectId): MobileBootstrap {
  if (value.userId !== userId) throw new Error('Project data belongs to a different account.');
  if (projectId !== null && !value.projects.some((project) => project.id === projectId)) {
    throw new Error('Project membership could not be verified.');
  }
  return {
    ...value,
    activeProjectId: projectId,
    dailyLogs: value.dailyLogs.filter((row) => row.projectId === projectId),
    team: (value.team ?? []).filter((row) => row.projectId === projectId),
    submittals: value.submittals?.filter((row) => row.projectId === projectId),
    rfis: value.rfis?.filter((row) => row.projectId === projectId),
    earthCamEmbeds: value.earthCamEmbeds?.filter((row) => row.projectId === projectId),
    dashboard: value.activeProjectId === projectId ? value.dashboard : undefined,
  };
}
