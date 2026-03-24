'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Hook that manages recent search history in localStorage.
 * Stores up to `maxItems` unique queries, most recent first.
 */
export function useRecentSearches(
  key = 'railcommand_recent_searches',
  maxItems = 10
) {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((s): s is string => typeof s === 'string').slice(0, maxItems));
        }
      }
    } catch {
      // Ignore corrupt data
    }
  }, [key, maxItems]);

  const persist = useCallback(
    (next: string[]) => {
      setRecentSearches(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // localStorage full or unavailable
      }
    },
    [key]
  );

  const addSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      setRecentSearches((prev) => {
        // Remove duplicate, then prepend
        const filtered = prev.filter((s) => s !== trimmed);
        const next = [trimmed, ...filtered].slice(0, maxItems);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // localStorage full or unavailable
        }
        return next;
      });
    },
    [key, maxItems]
  );

  const removeSearch = useCallback(
    (query: string) => {
      setRecentSearches((prev) => {
        const next = prev.filter((s) => s !== query);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // localStorage full or unavailable
        }
        return next;
      });
    },
    [key]
  );

  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  return { recentSearches, addSearch, removeSearch, clearAll };
}
