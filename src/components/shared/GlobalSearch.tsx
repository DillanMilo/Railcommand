'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  HelpCircle,
  CheckSquare,
  Calendar,
  Milestone as MilestoneIcon,
  Loader2,
  Search,
  Clock,
  X,
  Trash2,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/components/providers/ProjectProvider';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import * as store from '@/lib/store';
import { globalSearch } from '@/lib/actions/search';
import type { SearchResultItem, GlobalSearchResult } from '@/lib/actions/search';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  submittal: <FileText className="size-4 text-blue-500" />,
  rfi: <HelpCircle className="size-4 text-amber-500" />,
  punch_list: <CheckSquare className="size-4 text-red-500" />,
  daily_log: <Calendar className="size-4 text-green-500" />,
  milestone: <MilestoneIcon className="size-4 text-purple-500" />,
};

const STATUS_COLORS: Record<string, string> = {
  // Submittals
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  conditional: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  // RFIs
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  answered: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  // Punch list
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  // Milestones
  on_track: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  behind: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  not_started: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Demo mode: search the in-memory store data across all modules.
 * Also searches by assignee profile name.
 */
function demoSearch(query: string): GlobalSearchResult {
  const q = query.toLowerCase();
  const projects = store.getProjects();
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  // Build profile name lookup map
  const profiles = store.getProfiles();
  const profileNameMap = new Map(profiles.map((p) => [p.id, p.full_name]));

  const submittals: SearchResultItem[] = store
    .getSubmittals()
    .filter((s) => {
      const submitterName = profileNameMap.get(s.submitted_by) ?? '';
      return (
        s.title.toLowerCase().includes(q) ||
        s.spec_section.toLowerCase().includes(q) ||
        s.number.toLowerCase().includes(q) ||
        submitterName.toLowerCase().includes(q)
      );
    })
    .slice(0, 10)
    .map((s) => {
      const submitterName = profileNameMap.get(s.submitted_by) ?? '';
      const matchedAssignee = submitterName.toLowerCase().includes(q);
      return {
        id: s.id,
        module: 'submittal' as const,
        title: `${s.number}: ${s.title}`,
        subtitle: s.spec_section,
        status: s.status,
        projectId: s.project_id,
        projectName: projectMap.get(s.project_id) ?? '',
        href: `/projects/${s.project_id}/submittals/${s.id}`,
        assignee: submitterName || undefined,
        matchField: matchedAssignee ? 'assignee' : undefined,
      };
    });

  const rfis: SearchResultItem[] = store
    .getRFIs()
    .filter((r) => {
      const assigneeName = profileNameMap.get(r.assigned_to) ?? '';
      return (
        r.subject.toLowerCase().includes(q) ||
        r.number.toLowerCase().includes(q) ||
        assigneeName.toLowerCase().includes(q)
      );
    })
    .slice(0, 10)
    .map((r) => {
      const assigneeName = profileNameMap.get(r.assigned_to) ?? '';
      const matchedAssignee = assigneeName.toLowerCase().includes(q);
      return {
        id: r.id,
        module: 'rfi' as const,
        title: `${r.number}: ${r.subject}`,
        subtitle: '',
        status: r.status,
        projectId: r.project_id,
        projectName: projectMap.get(r.project_id) ?? '',
        href: `/projects/${r.project_id}/rfis/${r.id}`,
        assignee: assigneeName || undefined,
        matchField: matchedAssignee ? 'assignee' : undefined,
      };
    });

  const punchList: SearchResultItem[] = store
    .getPunchListItems()
    .filter((p) => {
      const assigneeName = profileNameMap.get(p.assigned_to) ?? '';
      return (
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.number.toLowerCase().includes(q) ||
        assigneeName.toLowerCase().includes(q)
      );
    })
    .slice(0, 10)
    .map((p) => {
      const assigneeName = profileNameMap.get(p.assigned_to) ?? '';
      const matchedAssignee = assigneeName.toLowerCase().includes(q);
      return {
        id: p.id,
        module: 'punch_list' as const,
        title: `${p.number}: ${p.title}`,
        subtitle: p.location,
        status: p.status,
        projectId: p.project_id,
        projectName: projectMap.get(p.project_id) ?? '',
        href: `/projects/${p.project_id}/punch-list/${p.id}`,
        assignee: assigneeName || undefined,
        matchField: matchedAssignee ? 'assignee' : undefined,
      };
    });

  const dailyLogs: SearchResultItem[] = store
    .getDailyLogs()
    .filter((d) => {
      const creatorName = profileNameMap.get(d.created_by) ?? '';
      return (
        d.work_summary.toLowerCase().includes(q) ||
        d.log_date.toLowerCase().includes(q) ||
        creatorName.toLowerCase().includes(q)
      );
    })
    .slice(0, 10)
    .map((d) => {
      const creatorName = profileNameMap.get(d.created_by) ?? '';
      const matchedAssignee = creatorName.toLowerCase().includes(q);
      return {
        id: d.id,
        module: 'daily_log' as const,
        title: `Log: ${d.log_date}`,
        subtitle: d.work_summary.slice(0, 80),
        status: '',
        projectId: d.project_id,
        projectName: projectMap.get(d.project_id) ?? '',
        href: `/projects/${d.project_id}/daily-logs/${d.id}`,
        assignee: creatorName || undefined,
        matchField: matchedAssignee ? 'assignee' : undefined,
      };
    });

  const milestones: SearchResultItem[] = store
    .getMilestones()
    .filter((m) => m.name.toLowerCase().includes(q))
    .slice(0, 10)
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

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const { isDemo } = useProject();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCounterRef = useRef(0);
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
      const res = await globalSearch(trimmed);
      // Discard stale results if a newer search was initiated
      if (requestId !== searchCounterRef.current) return;
      if (res.data) {
        setResults(res.data);
      }
      setLoading(false);
    },
    [isDemo]
  );

  // Debounce input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      doSearch(query);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Reset on close — also bump counter to discard any in-flight requests
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(null);
      setLoading(false);
      searchCounterRef.current++;
    }
  }, [open]);

  // Keyboard shortcuts: Cmd+Backspace to clear input, Cmd+Enter to view all results
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        e.preventDefault();
        setQuery('');
        setResults(null);
        setLoading(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const trimmed = query.trim();
        if (trimmed) {
          addSearch(trimmed);
          router.push(`/search?q=${encodeURIComponent(trimmed)}`);
          onOpenChange(false);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, query, router, onOpenChange, addSearch]);

  function handleSelect(href: string) {
    if (query.trim()) addSearch(query.trim());
    router.push(href);
    onOpenChange(false);
  }

  function handleViewAllResults() {
    if (query.trim()) addSearch(query.trim());
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    onOpenChange(false);
  }

  function handleRecentSelect(recentQuery: string) {
    setQuery(recentQuery);
    addSearch(recentQuery);
    doSearch(recentQuery);
  }

  const totalResults =
    (results?.submittals.length ?? 0) +
    (results?.rfis.length ?? 0) +
    (results?.punchList.length ?? 0) +
    (results?.dailyLogs.length ?? 0) +
    (results?.milestones.length ?? 0);

  const hasQuery = query.trim().length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global Search"
      description="Search across all modules: submittals, RFIs, punch list, daily logs, and milestones"
    >
      <CommandInput
        placeholder="Search submittals, RFIs, punch list, daily logs, milestones..."
        value={query}
        onValueChange={(v) => setQuery(v.slice(0, 200))}
        maxLength={200}
      />
      <CommandList className="max-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Searching...
          </div>
        )}

        {!loading && hasQuery && totalResults === 0 && (
          <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
        )}

        {!loading && !hasQuery && recentSearches.length === 0 && (
          <CommandEmpty>Type to search across all modules...</CommandEmpty>
        )}

        {!loading && !hasQuery && recentSearches.length > 0 && (
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((recent) => (
              <CommandItem
                key={recent}
                value={`recent:${recent}`}
                onSelect={() => handleRecentSelect(recent)}
                className="flex items-center gap-3 cursor-pointer group/recent"
              >
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{recent}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    removeSearch(recent);
                  }}
                  className="shrink-0 opacity-0 group-hover/recent:opacity-100 p-1 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
                  aria-label={`Remove "${recent}" from recent searches`}
                >
                  <X className="size-3" />
                </button>
              </CommandItem>
            ))}
            <CommandItem
              onSelect={clearAll}
              className="flex items-center justify-center gap-2 cursor-pointer text-muted-foreground mt-1"
            >
              <Trash2 className="size-3.5" />
              <span className="text-xs">Clear recent searches</span>
            </CommandItem>
          </CommandGroup>
        )}

        {!loading && results && (
          <>
            {results.submittals.length > 0 && (
              <CommandGroup heading={`Submittals (${results.submittals.length})`}>
                {results.submittals.map((item) => (
                  <SearchItem key={item.id} item={item} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}

            {results.rfis.length > 0 && (
              <>
                {results.submittals.length > 0 && <CommandSeparator />}
                <CommandGroup heading={`RFIs (${results.rfis.length})`}>
                  {results.rfis.map((item) => (
                    <SearchItem key={item.id} item={item} onSelect={handleSelect} />
                  ))}
                </CommandGroup>
              </>
            )}

            {results.punchList.length > 0 && (
              <>
                {(results.submittals.length > 0 || results.rfis.length > 0) && (
                  <CommandSeparator />
                )}
                <CommandGroup heading={`Punch List (${results.punchList.length})`}>
                  {results.punchList.map((item) => (
                    <SearchItem key={item.id} item={item} onSelect={handleSelect} />
                  ))}
                </CommandGroup>
              </>
            )}

            {results.dailyLogs.length > 0 && (
              <>
                {(results.submittals.length > 0 ||
                  results.rfis.length > 0 ||
                  results.punchList.length > 0) && <CommandSeparator />}
                <CommandGroup heading={`Daily Logs (${results.dailyLogs.length})`}>
                  {results.dailyLogs.map((item) => (
                    <SearchItem key={item.id} item={item} onSelect={handleSelect} />
                  ))}
                </CommandGroup>
              </>
            )}

            {results.milestones.length > 0 && (
              <>
                {(results.submittals.length > 0 ||
                  results.rfis.length > 0 ||
                  results.punchList.length > 0 ||
                  results.dailyLogs.length > 0) && <CommandSeparator />}
                <CommandGroup heading={`Milestones (${results.milestones.length})`}>
                  {results.milestones.map((item) => (
                    <SearchItem key={item.id} item={item} onSelect={handleSelect} />
                  ))}
                </CommandGroup>
              </>
            )}

            {/* View all results link */}
            {totalResults > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleViewAllResults}
                    className="flex items-center justify-center gap-2 cursor-pointer text-muted-foreground"
                  >
                    <Search className="size-4" />
                    <span className="text-sm">
                      View all results for &quot;{query.trim()}&quot;
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>

      {/* Footer with keyboard navigation hints */}
      <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalResults > 0
            ? `${totalResults} result${totalResults === 1 ? '' : 's'} found`
            : hasQuery && !loading
            ? 'No results'
            : 'Search across all modules'}
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              &#8593;&#8595;
            </kbd>
            <span>navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              &#8629;
            </kbd>
            <span>select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-[10px]">&#8984;</span>&#8629;
            </kbd>
            <span>all results</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-[10px]">&#8984;</span>&#9003;
            </kbd>
            <span>clear</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
            <span>close</span>
          </span>
        </div>
      </div>
    </CommandDialog>
  );
}

function SearchItem({
  item,
  onSelect,
}: {
  item: SearchResultItem;
  onSelect: (href: string) => void;
}) {
  return (
    <CommandItem
      value={`${item.title} ${item.subtitle} ${item.projectName} ${item.assignee ?? ''}`}
      onSelect={() => onSelect(item.href)}
      className="flex items-center gap-3 cursor-pointer"
    >
      <span className="shrink-0">{MODULE_ICONS[item.module]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.projectName && <span className="truncate">{item.projectName}</span>}
          {item.subtitle && item.projectName && <span>-</span>}
          {item.subtitle && <span className="truncate">{item.subtitle}</span>}
        </div>
        {/* Assignee display */}
        {item.assignee && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary/10 text-[9px] font-semibold text-primary shrink-0">
              {getInitials(item.assignee)}
            </span>
            <span className="text-xs text-muted-foreground truncate">{item.assignee}</span>
          </div>
        )}
        {/* Match field indicator */}
        {item.matchField && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            Matched: {item.matchField}
          </p>
        )}
      </div>
      {item.status && (
        <Badge
          variant="secondary"
          className={`shrink-0 text-[10px] px-1.5 py-0 ${STATUS_COLORS[item.status] ?? ''}`}
        >
          {formatStatus(item.status)}
        </Badge>
      )}
    </CommandItem>
  );
}
