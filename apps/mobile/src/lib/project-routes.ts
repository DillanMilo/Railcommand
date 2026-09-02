const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const nativeProjectSections: Record<string, string> = {
  submittals: '/(tabs)/submittals',
  rfis: '/(tabs)/rfis',
  'daily-logs': '/(tabs)/logs',
  cameras: '/(tabs)/cameras',
  team: '/team',
};

export type ProjectRoute =
  | { kind: 'native'; projectId: string; destination: string }
  | { kind: 'unimplemented'; projectId: string; path: string }
  | { kind: 'invalid' };

// Never collapse a /new, record ID, or /edit suffix into the module list.
// An unsupported route remains explicit until its real native screen exists.
export function resolveProjectRoute(projectId: string | undefined, module: string | string[] | undefined): ProjectRoute {
  const segments = Array.isArray(module) ? module : module?.split('/') ?? [];
  if (!projectId || !uuid.test(projectId) || segments.length === 0
    || segments.some((segment) => !/^[a-z0-9-]+$/i.test(segment))) return { kind: 'invalid' };
  const [section, record] = segments;
  if (segments.length === 1 && Object.hasOwn(nativeProjectSections, section)) {
    return { kind: 'native', projectId, destination: nativeProjectSections[section] };
  }
  if (section === 'daily-logs' && segments.length === 2 && (record === 'new' || uuid.test(record))) {
    return { kind: 'native', projectId, destination: `/daily-log/${record}` };
  }
  if ((section === 'rfis' || section === 'submittals') && segments.length === 2 && (record === 'new' || uuid.test(record))) {
    return { kind: 'native', projectId, destination: `/record/${section}/${record}?projectId=${projectId}` };
  }
  return { kind: 'unimplemented', projectId, path: `/projects/${projectId}/${segments.join('/')}` };
}

export function recordsForProject<T extends { projectId: string }>(records: readonly T[] | undefined, projectId: string | null): T[] {
  return projectId ? (records ?? []).filter((record) => record.projectId === projectId) : [];
}
