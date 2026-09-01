import type { DailyLog, Project, ProjectMember } from '@/lib/types';
import {
  deleteDiscardedOfflineRecords,
  getOfflineRecordKey,
  readOfflineMetadata,
  readOfflineRecord,
  requestPersistentOfflineStorage,
  writeOfflineMetadata,
  writeOfflineRecord,
  writeOfflineRecords,
  type OfflineEntityType,
  type OfflineRecord,
  type OfflineRecordResult,
} from './storage';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const RECENT_DAILY_LOG_LIMIT = 90;

export const OFFLINE_CACHE_POLICIES: Record<
  OfflineEntityType,
  { refreshAfterMs: number; discardAfterMs: number }
> = {
  project: { refreshAfterMs: 24 * HOUR_MS, discardAfterMs: 30 * DAY_MS },
  project_members: { refreshAfterMs: HOUR_MS, discardAfterMs: 7 * DAY_MS },
  daily_logs: { refreshAfterMs: 15 * MINUTE_MS, discardAfterMs: 30 * DAY_MS },
};

export interface OfflineProjectSnapshot {
  project: Project;
  members: ProjectMember[];
  dailyLogs: DailyLog[];
  synchronizedAt: string;
}

export interface CachedProjectSnapshot {
  project: OfflineRecordResult<Project> | null;
  members: OfflineRecordResult<ProjectMember[]> | null;
  dailyLogs: OfflineRecordResult<DailyLog[]> | null;
}

export function limitRecentDailyLogs(logs: DailyLog[]): DailyLog[] {
  return [...logs]
    .sort((a, b) => b.log_date.localeCompare(a.log_date))
    .slice(0, RECENT_DAILY_LOG_LIMIT);
}

export function createOfflineRecord<T>(
  entityType: OfflineEntityType,
  projectId: string,
  value: T,
  cachedAt = new Date()
): OfflineRecord<T> {
  const policy = OFFLINE_CACHE_POLICIES[entityType];
  const timestamp = cachedAt.getTime();
  return {
    key: getOfflineRecordKey(entityType, projectId),
    entityType,
    projectId,
    value,
    cachedAt: cachedAt.toISOString(),
    refreshAfter: new Date(timestamp + policy.refreshAfterMs).toISOString(),
    discardAfter: new Date(timestamp + policy.discardAfterMs).toISOString(),
  };
}

export async function cacheOfflineProjectSnapshot(
  userId: string,
  snapshot: OfflineProjectSnapshot
): Promise<void> {
  const cachedAt = new Date(snapshot.synchronizedAt);
  await writeOfflineRecords(userId, [
    createOfflineRecord('project', snapshot.project.id, snapshot.project, cachedAt),
    createOfflineRecord('project_members', snapshot.project.id, snapshot.members, cachedAt),
    createOfflineRecord(
      'daily_logs',
      snapshot.project.id,
      limitRecentDailyLogs(snapshot.dailyLogs),
      cachedAt
    ),
  ]);
  await writeOfflineMetadata(userId, 'active_project_id', snapshot.project.id);
  await Promise.allSettled([
    deleteDiscardedOfflineRecords(userId),
    requestPersistentOfflineStorage(),
  ]);
}

export async function cacheActiveProject(
  userId: string,
  project: Project,
  cachedAt = new Date()
): Promise<void> {
  await Promise.all([
    writeOfflineRecord(
      userId,
      createOfflineRecord('project', project.id, project, cachedAt)
    ),
    writeOfflineMetadata(userId, 'active_project_id', project.id),
  ]);
}

export async function cacheProjectMembers(
  userId: string,
  projectId: string,
  members: ProjectMember[],
  cachedAt = new Date()
): Promise<void> {
  await writeOfflineRecord(
    userId,
    createOfflineRecord('project_members', projectId, members, cachedAt)
  );
}

export async function cacheDailyLogs(
  userId: string,
  projectId: string,
  dailyLogs: DailyLog[],
  cachedAt = new Date()
): Promise<void> {
  await writeOfflineRecord(
    userId,
    createOfflineRecord(
      'daily_logs',
      projectId,
      limitRecentDailyLogs(dailyLogs),
      cachedAt
    )
  );
}

export async function readCachedProject(
  userId: string,
  projectId: string,
  now = Date.now()
): Promise<OfflineRecordResult<Project> | null> {
  return readOfflineRecord<Project>(userId, 'project', projectId, now);
}

export async function readCachedProjectMembers(
  userId: string,
  projectId: string,
  now = Date.now()
): Promise<OfflineRecordResult<ProjectMember[]> | null> {
  return readOfflineRecord<ProjectMember[]>(userId, 'project_members', projectId, now);
}

export async function readCachedDailyLogs(
  userId: string,
  projectId: string,
  now = Date.now()
): Promise<OfflineRecordResult<DailyLog[]> | null> {
  return readOfflineRecord<DailyLog[]>(userId, 'daily_logs', projectId, now);
}

export async function readCachedProjectSnapshot(
  userId: string,
  projectId: string,
  now = Date.now()
): Promise<CachedProjectSnapshot> {
  const [project, members, dailyLogs] = await Promise.all([
    readCachedProject(userId, projectId, now),
    readCachedProjectMembers(userId, projectId, now),
    readCachedDailyLogs(userId, projectId, now),
  ]);
  return { project, members, dailyLogs };
}

export async function readCachedActiveProject(
  userId: string,
  now = Date.now()
): Promise<OfflineRecordResult<Project> | null> {
  const projectId = await readOfflineMetadata<string>(userId, 'active_project_id');
  if (!projectId) return null;
  return readCachedProject(userId, projectId, now);
}

export function snapshotNeedsRefresh(snapshot: CachedProjectSnapshot): boolean {
  return (
    !snapshot.project ||
    !snapshot.members ||
    !snapshot.dailyLogs ||
    snapshot.project.isStale ||
    snapshot.members.isStale ||
    snapshot.dailyLogs.isStale
  );
}
