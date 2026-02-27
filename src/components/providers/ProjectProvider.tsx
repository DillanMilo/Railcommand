'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getProjects, getProjectById, getCurrentUserId, setCurrentUserId as setStoreUserId } from '@/lib/store';
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

export default function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentProjectId, setCurrentProjectIdState] = useState<string>('proj-001');
  const [projects, setProjects] = useState<Project[]>(() => getProjects());
  const [currentUserId, setCurrentUserIdState] = useState<string>(() => getCurrentUserId());

  const setCurrentUser = useCallback((profileId: string) => {
    setStoreUserId(profileId);
    setCurrentUserIdState(profileId);
  }, []);

  const params = useParams();
  const urlProjectId = params?.id as string | undefined;

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && getProjectById(stored)) {
        setCurrentProjectIdState(stored);
      }
    } catch {
      // localStorage may not be available
    }
  }, []);

  // Sync URL project ID to context (URL takes priority)
  useEffect(() => {
    if (urlProjectId && getProjectById(urlProjectId)) {
      setCurrentProjectIdState(urlProjectId);
      try {
        localStorage.setItem(STORAGE_KEY, urlProjectId);
      } catch {
        // localStorage may not be available
      }
    }
  }, [urlProjectId]);

  const setCurrentProjectId = useCallback((id: string) => {
    setCurrentProjectIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage may not be available
    }
  }, []);

  const refreshProjects = useCallback(() => {
    const updatedProjects = getProjects();
    setProjects(updatedProjects);

    // If current project was deleted, switch to first remaining project
    if (!updatedProjects.find((p) => p.id === currentProjectId) && updatedProjects.length > 0) {
      const firstProject = updatedProjects[0];
      setCurrentProjectIdState(firstProject.id);
      try {
        localStorage.setItem(STORAGE_KEY, firstProject.id);
      } catch {
        // localStorage may not be available
      }
    }
  }, [currentProjectId]);

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
