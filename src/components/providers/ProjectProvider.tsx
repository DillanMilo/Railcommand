'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { getProjects as getStoreProjects, getProjectById as getStoreProjectById, getCurrentUserId, setCurrentUserId as setStoreUserId, initDemoData, initFreshData } from '@/lib/store';
import { getProjects as fetchProjects } from '@/lib/actions/projects';
import type { Project } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface ProjectContextValue {
  currentProject: Project | null;
  currentProjectId: string;
  projects: Project[];
  setCurrentProjectId: (id: string) => void;
  refreshProjects: () => void;
  currentUserId: string;
  setCurrentUser: (profileId: string) => void;
  isDemo: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  currentProject: null,
  currentProjectId: '',
  projects: [],
  setCurrentProjectId: () => {},
  refreshProjects: () => {},
  currentUserId: 'prof-001',
  setCurrentUser: () => {},
  isDemo: true,
});

export const useProject = () => useContext(ProjectContext);

const STORAGE_KEY = 'rc-current-project';
const MODE_KEY = 'rc-mode';

/** Rehydrate the store from localStorage mode flag on page reload.
 *  Only runs for explicit demo/fresh modes — real auth users skip this entirely. */
function rehydrateMode(): void {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === 'fresh') {
      const storedName = localStorage.getItem('rc-user-name') ?? 'User';
      const storedEmail = localStorage.getItem('rc-user-email') ?? '';
      initFreshData(storedName, storedEmail);
    } else if (mode === 'demo') {
      initDemoData();
    }
    // mode is null → real auth user, don't touch the in-memory store
  } catch { /* noop */ }
}

function getStoredProjectId(isDemoMode: boolean): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isDemoMode) {
      const mode = localStorage.getItem(MODE_KEY);
      if (mode === 'fresh') {
        return stored && getStoreProjectById(stored) ? stored : '';
      }
      return stored && getStoreProjectById(stored) ? stored : 'proj-001';
    }
    // Real auth — return stored ID; will be validated after projects fetch
    return stored ?? '';
  } catch { /* noop */ }
  return isDemoMode ? 'proj-001' : '';
}

let modeRehydrated = false;

export default function ProjectProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const urlProjectId = pathname.match(/\/projects\/([^/]+)/)?.[1];

  // Rehydrate store from localStorage mode on first mount (only for demo/fresh)
  if (!modeRehydrated && typeof window !== 'undefined') {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === 'demo' || mode === 'fresh') {
      rehydrateMode();
    }
    modeRehydrated = true;
  }

  const [isDemo, setIsDemo] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const mode = localStorage.getItem(MODE_KEY);
    return mode === 'demo' || mode === 'fresh';
  });
  const [storedProjectId, setStoredProjectId] = useState<string>(() => getStoredProjectId(isDemo));
  const [projects, setProjects] = useState<Project[]>(() => (isDemo ? getStoreProjects() : []));
  const [currentUserId, setCurrentUserIdState] = useState<string>(() => getCurrentUserId());

  // URL takes priority over stored project ID
  const validUrlProject = urlProjectId && projects.find((p) => p.id === urlProjectId) ? urlProjectId : null;
  const currentProjectId = validUrlProject ?? storedProjectId;

  // Persist URL project ID to localStorage as a side effect
  useEffect(() => {
    if (validUrlProject) {
      try { localStorage.setItem(STORAGE_KEY, validUrlProject); } catch { /* noop */ }
    }
  }, [validUrlProject]);

  // Check Supabase session and load projects for real auth users
  useEffect(() => {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === 'demo' || mode === 'fresh') {
      setIsDemo(true);
      return;
    }

    // No demo mode flag — check for real Supabase session
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsDemo(false);
        // Fetch projects from the database
        fetchProjects().then((result) => {
          if (result.data) {
            setProjects(result.data);
            // If no stored project, select the first one
            const stored = localStorage.getItem(STORAGE_KEY);
            if ((!stored || !result.data.find((p) => p.id === stored)) && result.data.length > 0) {
              setStoredProjectId(result.data[0].id);
              try { localStorage.setItem(STORAGE_KEY, result.data[0].id); } catch { /* noop */ }
            }
          }
        });
      } else {
        // No session and no demo mode — redirect to login
        router.push('/login');
      }
    });
  }, [router]);

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

  const refreshProjects = useCallback(async () => {
    let updatedProjects: Project[];
    if (isDemo) {
      updatedProjects = getStoreProjects();
    } else {
      const result = await fetchProjects();
      updatedProjects = result.data ?? projects;
    }
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
  }, [isDemo, currentProjectId, projects]);

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;

  return (
    <ProjectContext.Provider value={{
      currentProject,
      currentProjectId,
      projects,
      setCurrentProjectId,
      refreshProjects,
      currentUserId,
      setCurrentUser,
      isDemo,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}
