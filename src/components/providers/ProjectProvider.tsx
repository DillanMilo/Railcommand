'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getProjects, getProjectById, getCurrentUserId, setCurrentUserId as setStoreUserId, initDemoData, initFreshData } from '@/lib/store';
import type { Project } from '@/lib/types';

interface ProjectContextValue {
  currentProject: Project | null;
  currentProjectId: string;
  projects: Project[];
  setCurrentProjectId: (id: string) => void;
  refreshProjects: () => void;
  currentUserId: string;
  setCurrentUser: (profileId: string) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  currentProject: null,
  currentProjectId: '',
  projects: [],
  setCurrentProjectId: () => {},
  refreshProjects: () => {},
  currentUserId: 'prof-001',
  setCurrentUser: () => {},
});

export const useProject = () => useContext(ProjectContext);

const STORAGE_KEY = 'rc-current-project';
const MODE_KEY = 'rc-mode';

/** Rehydrate the store from localStorage mode flag on page reload */
function rehydrateMode(): void {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === 'fresh') {
      // Restore fresh state — we don't have the user's name/email on reload,
      // but initFreshData was already called during sign-up. On a full page
      // reload the module re-initialises with seed data, so we need to clear it.
      const storedName = localStorage.getItem('rc-user-name') ?? 'User';
      const storedEmail = localStorage.getItem('rc-user-email') ?? '';
      initFreshData(storedName, storedEmail);
    } else {
      // demo or missing → seed data is already loaded at module level
      initDemoData();
    }
  } catch { /* noop */ }
}

function getStoredProjectId(): string {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === 'fresh') {
      // Fresh users have no projects — return empty
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && getProjectById(stored)) return stored;
      return '';
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && getProjectById(stored)) return stored;
  } catch { /* noop */ }
  return 'proj-001';
}

let modeRehydrated = false;

export default function ProjectProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const urlProjectId = pathname.match(/\/projects\/([^/]+)/)?.[1];

  // Rehydrate store from localStorage mode on first mount (runs once per session)
  if (!modeRehydrated && typeof window !== 'undefined') {
    rehydrateMode();
    modeRehydrated = true;
  }

  const [storedProjectId, setStoredProjectId] = useState<string>(getStoredProjectId);
  const [projects, setProjects] = useState<Project[]>(() => getProjects());
  const [currentUserId, setCurrentUserIdState] = useState<string>(() => getCurrentUserId());

  // URL takes priority over stored project ID
  const validUrlProject = urlProjectId && getProjectById(urlProjectId) ? urlProjectId : null;
  const currentProjectId = validUrlProject ?? storedProjectId;

  // Persist URL project ID to localStorage as a side effect
  useEffect(() => {
    if (validUrlProject) {
      try { localStorage.setItem(STORAGE_KEY, validUrlProject); } catch { /* noop */ }
    }
  }, [validUrlProject]);

  function setCurrentUser(profileId: string) {
    setStoreUserId(profileId);
    setCurrentUserIdState(profileId);
  }

  function setCurrentProjectId(id: string) {
    setStoredProjectId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage may not be available
    }
  }

  function refreshProjects() {
    const updatedProjects = getProjects();
    setProjects(updatedProjects);

    // If current project was deleted, switch to first remaining project
    if (!updatedProjects.find((p) => p.id === currentProjectId) && updatedProjects.length > 0) {
      const firstProject = updatedProjects[0];
      setStoredProjectId(firstProject.id);
      try {
        localStorage.setItem(STORAGE_KEY, firstProject.id);
      } catch {
        // localStorage may not be available
      }
    }
  }

  const currentProject = getProjectById(currentProjectId) ?? null;

  return (
    <ProjectContext.Provider value={{
      currentProject,
      currentProjectId,
      projects,
      setCurrentProjectId,
      refreshProjects,
      currentUserId,
      setCurrentUser,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}
