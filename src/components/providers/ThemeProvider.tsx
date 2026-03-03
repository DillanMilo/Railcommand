'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  resolvedTheme: 'light',
  setMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = 'rc-theme-mode';
const AUTO_DARK_START = 19; // 7 PM
const AUTO_DARK_END = 6;   // 6 AM

function isDarkByTime(): boolean {
  const hour = new Date().getHours();
  return hour >= AUTO_DARK_START || hour < AUTO_DARK_END;
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') return isDarkByTime() ? 'dark' : 'light';
  return mode;
}

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ['light', 'dark', 'auto'].includes(stored)) return stored;
  } catch { /* noop */ }
  return 'light';
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(getInitialMode()));

  // Apply theme to DOM on mount
  useEffect(() => {
    applyTheme(resolveTheme(mode));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check auto mode every minute
  useEffect(() => {
    if (mode !== 'auto') return;

    const check = () => {
      const resolved = resolveTheme('auto');
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
    const resolved = resolveTheme(newMode);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
