'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  HelpCircle,
  CheckSquare,
  Calendar,
  Milestone as MilestoneIcon,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  SearchX,
  Clock,
  X,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProject } from '@/components/providers/ProjectProvider';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { globalSearch } from '@/lib/actions/search';
import type { SearchResultItem, GlobalSearchResult } from '@/lib/actions/search';
import * as store from '@/lib/store';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

type ModuleKey = SearchResultItem['module'];

const MODULE_META: Record<
  ModuleKey,
  { label: string; icon: React.ReactNode; color: string }
> = {
  submittal: {
    label: 'Submittals',
    icon: <FileText className="size-4 text-blue-500" />,
    color: 'text-blue-500',
  },
  rfi: {
    label: 'RFIs',
    icon: <HelpCircle className="size-4 text-amber-500" />,
    color: 'text-amber-500',
  },
  punch_list: {
    label: 'Punch List',
    icon: <CheckSquare className="size-4 text-red-500" />,
    color: 'text-red-500',
  },
  daily_log: {
    label: 'Daily Logs',
    icon: <Calendar className="size-4 text-green-500" />,
    color: 'text-green-500',
  },
  milestone: {
    label: 'Milestones',
    icon: <MilestoneIcon className="size-4 text-purple-500" />,
    color: 'text-purple-500',
  },
};

const FILTER_OPTIONS: Array<{ key: ModuleKey | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'submittal', label: 'Submittals' },
  { key: 'rfi', label: 'RFIs' },
  { key: 'punch_list', label: 'Punch List' },
  { key: 'daily_log', label: 'Daily Logs' },
  { key: 'milestone', label: 'Milestones' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  conditional: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  answered: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  on_track: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  behind: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  not_started: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/*  Demo search                                                               */
/* -------------------------------------------------------------------------- */

function demoSearch(query: string): GlobalSearchResult {
  const q = query.toLowerCase();
  const projects = store.getProjects();
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const profiles = store.getProfiles();
  const profileNameMap = new Map(profiles.map((p) => [p.id, p.full_name]));

  const submittals: SearchResultItem[] = store
    .getSubmittals()
    .filter((s) => {
      const name = profileNameMap.get(s.submitted_by) ?? '';
      return (
        s.title.toLowerCase().includes(q) ||
        s.spec_section.toLowerCase().includes(q) ||
        s.number.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    })
    .slice(0, 20)
    .map((s) => {
      const name = profileNameMap.get(s.submitted_by) ?? '';
      return {
        id: s.id,
        module: 'submittal' as const,
        title: `${s.number}: ${s.title}`,
        subtitle: s.spec_section,
        status: s.status,
        projectId: s.project_id,
        projectName: projectMap.get(s.project_id) ?? '',
        href: `/projects/${s.project_id}/submittals/${s.id}`,
        assignee: name || undefined,
        matchField: name.toLowerCase().includes(q) ? 'assignee' : undefined,
      };
    });

  const rfis: SearchResultItem[] = store
    .getRFIs()
    .filter((r) => {
      const name = profileNameMap.get(r.assigned_to) ?? '';
      return (
        r.subject.toLowerCase().includes(q) ||
        r.number.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    })
    .slice(0, 20)
    .map((r) => {
      const name = profileNameMap.get(r.assigned_to) ?? '';
      return {
        id: r.id,
        module: 'rfi' as const,
        title: `${r.number}: ${r.subject}`,
        subtitle: '',
        status: r.status,
        projectId: r.project_id,
        projectName: projectMap.get(r.project_id) ?? '',
        href: `/projects/${r.project_id}/rfis/${r.id}`,
        assignee: name || undefined,
        matchField: name.toLowerCase().includes(q) ? 'assignee' : undefined,
      };
    });

  const punchList: SearchResultItem[] = store
    .getPunchListItems()
    .filter((p) => {
      const name = profileNameMap.get(p.assigned_to) ?? '';
      return (
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.number.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    })
    .slice(0, 20)
    .map((p) => {
      const name = profileNameMap.get(p.assigned_to) ?? '';
      return {
        id: p.id,
        module: 'punch_list' as const,
        title: `${p.number}: ${p.title}`,
        subtitle: p.location,
        status: p.status,
        projectId: p.project_id,
        projectName: projectMap.get(p.project_id) ?? '',
        href: `/projects/${p.project_id}/punch-list/${p.id}`,
        assignee: name || undefined,
        matchField: name.toLowerCase().includes(q) ? 'assignee' : undefined,
      };
    });

  const dailyLogs: SearchResultItem[] = store
    .getDailyLogs()
    .filter((d) => {
      const name = profileNameMap.get(d.created_by) ?? '';
      return (
        d.work_summary.toLowerCase().includes(q) ||
        d.log_date.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    })
    .slice(0, 20)
    .map((d) => {
      const name = profileNameMap.get(d.created_by) ?? '';
      return {
        id: d.id,
        module: 'daily_log' as const,
        title: `Log: ${d.log_date}`,
        subtitle: d.work_summary.slice(0, 80),
        status: '',
        projectId: d.project_id,
        projectName: projectMap.get(d.project_id) ?? '',
        href: `/projects/${d.project_id}/daily-logs/${d.id}`,
        assignee: name || undefined,
        matchField: name.toLowerCase().includes(q) ? 'assignee' : undefined,
      };
    });

  const milestones: SearchResultItem[] = store
    .getMilestones()
    .filter((m) => m.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map((m) => ({
      id: m.id,
      module: 'milestone' as const,
      title: m.name,
      subtitle: '',
      status: m.status,
      projectId: m.project_id,
      projectName: projectMap.get(m.project_id) ?? '',
      href: `/projects/${m.project_id}/schedule`,
    }));

  return { submittals, rfis, punchList, dailyLogs, milestones };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function flattenResults(data: GlobalSearchResult): SearchResultItem[] {
  return [
    ...data.submittals,
    ...data.rfis,
    ...data.punchList,
    ...data.dailyLogs,
    ...data.milestones,
  ];
}

function groupByModule(
  items: SearchResultItem[]
): Record<ModuleKey, SearchResultItem[]> {
  const groups: Record<ModuleKey, SearchResultItem[]> = {
    submittal: [],
    rfi: [],
    punch_list: [],
    daily_log: [],
    milestone: [],
  };
  for (const item of items) {
    groups[item.module].push(item);
  }
  return groups;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDemo } = useProject();

  const initialQuery = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(!!initialQuery);
  const [activeFilter, setActiveFilter] = useState<ModuleKey | 'all'>('all');
  const [collapsedModules, setCollapsedModules] = useState<Set<ModuleKey>>(
    new Set()
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCounterRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches();

  const doSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim().slice(0, 200);
      if (!trimmed) {
        setResults(null);
        setLoading(false);
        return;
      }

      if (isDemo) {
        setResults(demoSearch(trimmed));
        setLoading(false);
        return;
      }

      setLoading(true);
      const requestId = ++searchCounterRef.current;
      try {
        const res = await globalSearch(trimmed);
        // Discard stale results if a newer search was initiated
        if (requestId !== searchCounterRef.current) return;
        if (res.data) {
          setResults(res.data);
        }
      } finally {
        if (requestId === searchCounterRef.current) {
          setLoading(false);
        }
      }
    },
    [isDemo]
  );

  // Initial search on mount
  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = inputValue.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      setActiveQuery('');
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      router.replace(url.pathname + url.search, { scroll: false });
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      setActiveQuery(trimmed);
      addSearch(trimmed);
      const url = new URL(window.location.href);
      url.searchParams.set('q', trimmed);
      router.replace(url.pathname + url.search, { scroll: false });
      doSearch(trimmed);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, doSearch, router]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isInputFocused = document.activeElement === inputRef.current;

      // "/" — focus search input (when not already focused)
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Escape — clear search input and blur it
      if (e.key === 'Escape' && isInputFocused) {
        e.preventDefault();
        setInputValue('');
        inputRef.current?.blur();
      }

      // Cmd+K / Ctrl+K — navigate back (on full search page, go back to previous page)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        router.back();
      }

      // Number keys 1-6 — quick-switch module filter tabs (only when input is NOT focused)
      if (!isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const filterMap: Record<string, typeof activeFilter> = {
          '1': 'all',
          '2': 'submittal',
          '3': 'rfi',
          '4': 'punch_list',
          '5': 'daily_log',
          '6': 'milestone',
        };
        const filterKey = filterMap[e.key];
        if (filterKey) {
          e.preventDefault();
          setActiveFilter(filterKey);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, setActiveFilter]);

  const allItems = useMemo(
    () => (results ? flattenResults(results) : []),
    [results]
  );

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return allItems;
    return allItems.filter((item) => item.module === activeFilter);
  }, [allItems, activeFilter]);

  const grouped = useMemo(() => groupByModule(filteredItems), [filteredItems]);

  const totalCount = allItems.length;

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allItems.length };
    for (const item of allItems) {
      counts[item.module] = (counts[item.module] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);

  function toggleCollapse(module: ModuleKey) {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  const hasQuery = inputValue.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Search
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Find anything across your projects
          </p>
        </div>
        <kbd className="hidden items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground sm:inline-flex">
          <span className="text-[10px]">&#8984;</span>K
        </kbd>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search all modules..."
          className="h-12 pl-10 pr-16 text-base sm:text-sm"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.slice(0, 200))}
          maxLength={200}
          autoFocus
        />
        {inputValue && (
          <button
            onClick={() => setInputValue('')}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center h-9 px-2 text-xs text-muted-foreground hover:text-foreground active:text-foreground"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter pills — horizontal scroll on mobile, wrap on desktop */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {FILTER_OPTIONS.map((opt) => {
          const count = moduleCounts[opt.key] ?? 0;
          const isActive = activeFilter === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setActiveFilter(opt.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors active:scale-95 ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {opt.label}
              {hasQuery && !loading && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Result count summary */}
      {hasQuery && !loading && results && (
        <p className="mb-4 text-sm text-muted-foreground">
          {totalCount === 0
            ? 'No results'
            : `${filteredItems.length} result${filteredItems.length === 1 ? '' : 's'}${
                activeFilter !== 'all'
                  ? ` in ${MODULE_META[activeFilter].label}`
                  : ' across all modules'
              }`}
          {activeQuery && (
            <span>
              {' '}
              for <span className="font-medium text-foreground">&ldquo;{activeQuery}&rdquo;</span>
            </span>
          )}
        </p>
      )}

      {/* Loading skeletons */}
      {loading && <SearchSkeletons />}

      {/* Empty state: no query */}
      {!loading && !hasQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mb-1 text-base font-medium text-foreground">
            Search across all modules
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Start typing to search submittals, RFIs, punch list items, daily
            logs, and milestones across all your projects.
          </p>
          <div className="mt-4 hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              /
            </kbd>
            <span>to focus search</span>
          </div>

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="mt-8 w-full max-w-md text-left">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Recent Searches
                </h3>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Trash2 className="size-3" />
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((recent) => (
                  <button
                    key={recent}
                    onClick={() => setInputValue(recent)}
                    className="group/chip inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
                  >
                    <Clock className="size-3 shrink-0" />
                    <span className="truncate max-w-[200px]">{recent}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSearch(recent);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          e.preventDefault();
                          removeSearch(recent);
                        }
                      }}
                      className="shrink-0 ml-0.5 p-0.5 rounded-full opacity-0 group-hover/chip:opacity-100 hover:bg-muted-foreground/20 transition-opacity"
                      aria-label={`Remove "${recent}"`}
                    >
                      <X className="size-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state: no results */}
      {!loading && hasQuery && totalCount === 0 && results && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <SearchX className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mb-1 text-base font-medium text-foreground">
            No results found
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            No items matched &ldquo;{activeQuery}&rdquo;. Try adjusting your
            search terms or checking a different module filter.
          </p>
        </div>
      )}

      {/* Grouped results */}
      {!loading && results && filteredItems.length > 0 && (
        <div className="space-y-4">
          {(Object.keys(MODULE_META) as ModuleKey[]).map((moduleKey) => {
            const items = grouped[moduleKey];
            if (items.length === 0) return null;

            const meta = MODULE_META[moduleKey];
            const isCollapsed = collapsedModules.has(moduleKey);

            return (
              <section key={moduleKey}>
                <button
                  onClick={() => toggleCollapse(moduleKey)}
                  className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-accent active:bg-accent min-h-[44px]"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                  <span className="shrink-0">{meta.icon}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {meta.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px] tabular-nums"
                  >
                    {items.length}
                  </Badge>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2 pl-2">
                    {items.map((item) => (
                      <ResultCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Footer hint — hidden on mobile (keyboard shortcuts irrelevant on touch) */}
      <div className="mt-8 hidden items-center justify-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground sm:flex flex-wrap">
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            /
          </kbd>
          Focus
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ESC
          </kbd>
          Clear &amp; blur
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            1-6
          </kbd>
          Switch filter
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            <span className="text-[10px]">&#8984;</span>K
          </kbd>
          Back
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Result card                                                               */
/* -------------------------------------------------------------------------- */

function ResultCard({ item }: { item: SearchResultItem }) {
  const router = useRouter();
  const meta = MODULE_META[item.module];

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => router.push(item.href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(item.href);
        }
      }}
      className="group cursor-pointer border border-border bg-background p-3 transition-all hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm active:bg-accent/50 active:scale-[0.99] sm:p-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{meta.icon}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug text-foreground group-hover:text-primary">
              {item.title}
            </p>
            {item.status && (
              <Badge
                variant="secondary"
                className={`shrink-0 text-[10px] px-1.5 py-0 ${
                  STATUS_COLORS[item.status] ?? ''
                }`}
              >
                {formatStatus(item.status)}
              </Badge>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {item.projectName && (
              <span className="font-medium">{item.projectName}</span>
            )}
            {item.subtitle && item.projectName && (
              <span className="text-border">|</span>
            )}
            {item.subtitle && (
              <span className="truncate">{item.subtitle}</span>
            )}
          </div>

          {/* Assignee */}
          {item.assignee && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary/10 text-[9px] font-semibold text-primary shrink-0">
                {item.assignee
                  .split(' ')
                  .filter(Boolean)
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <span className="truncate">{item.assignee}</span>
              {item.matchField === 'assignee' && (
                <span className="text-[10px] text-muted-foreground/60">
                  (matched)
                </span>
              )}
            </div>
          )}

          <div className="mt-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium ${meta.color}`}
            >
              {meta.label}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Loading skeletons                                                         */
/* -------------------------------------------------------------------------- */

function SearchSkeletons() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((group) => (
        <div key={group}>
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="ml-auto h-5 w-8 rounded-full" />
          </div>
          <div className="space-y-2 pl-2">
            {[0, 1].map((card) => (
              <Card key={card} className="border border-border p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Skeleton className="h-4 w-3/5 rounded" />
                      <Skeleton className="h-4 w-16 shrink-0 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-2/5 rounded" />
                    <Skeleton className="h-4 w-20 rounded-sm" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
