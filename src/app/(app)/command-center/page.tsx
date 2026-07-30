import Link from 'next/link';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Command,
  FileText,
  FolderKanban,
  LineChart,
  MessageSquareText,
  Mic,
  PieChart,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  Zap,
} from 'lucide-react';

const flowCards = [
  {
    name: 'Invoice Flow',
    label: 'Finance',
    href: '/command-preview/invoice',
    icon: ReceiptText,
    accent: 'bg-emerald-500',
    tint: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    value: '$18.4K',
    metric: 'open invoices',
    detail: '3 overdue, 7 awaiting payment',
    actions: ['Create invoice', 'Log expense', 'Export tax CSV'],
  },
  {
    name: 'Lead Flow',
    label: 'Pipeline',
    href: '/command-preview/lead',
    icon: Target,
    accent: 'bg-blue-500',
    tint: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    value: '42',
    metric: 'active leads',
    detail: '11 hot, 8 due for follow-up',
    actions: ['Run audit', 'Enrich leads', 'Draft outreach'],
  },
  {
    name: 'Asset Flow',
    label: 'Portfolio',
    href: '/command-preview/asset',
    icon: WalletCards,
    accent: 'bg-violet-500',
    tint: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    value: '$126.8K',
    metric: 'portfolio value',
    detail: 'BTC, ETH, stocks, metals, journal',
    actions: ['Sync prices', 'Review risk', 'Open journal'],
  },
  {
    name: 'Vibe Flow',
    label: 'Workspace',
    href: '/command-preview/vibe',
    icon: FolderKanban,
    accent: 'bg-amber-500',
    tint: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    value: '18',
    metric: 'work items',
    detail: '6 in progress, 4 due this week',
    actions: ['Add card', 'Plan day', 'Sync calendar'],
  },
];

const commandQueue = [
  {
    title: 'Follow up on hot leads before noon',
    source: 'Lead Flow',
    priority: 'High',
    icon: Target,
    color: 'text-blue-600',
  },
  {
    title: 'Send overdue invoice reminders',
    source: 'Invoice Flow',
    priority: 'High',
    icon: ReceiptText,
    color: 'text-emerald-600',
  },
  {
    title: 'Review asset exposure after market open',
    source: 'Asset Flow',
    priority: 'Medium',
    icon: LineChart,
    color: 'text-violet-600',
  },
  {
    title: 'Move completed campaign tasks',
    source: 'Vibe Flow',
    priority: 'Low',
    icon: FolderKanban,
    color: 'text-amber-600',
  },
];

const timeline = [
  { time: '8:30 AM', title: 'Lead audit completed', meta: '12 websites scored' },
  { time: '9:10 AM', title: 'Invoice draft generated', meta: 'Retainer client matched' },
  { time: '10:20 AM', title: 'Market pulse updated', meta: '2 watchlist alerts' },
  { time: '11:00 AM', title: 'Vibe board planned', meta: '4 cards scheduled' },
];

const insights = [
  'A lead marked Hot has an unpaid invoice under the same company name.',
  'Asset volatility is elevated; delay new trade ideas until confirmation.',
  'Two Vibe tasks mention invoice copy. Link them to Invoice Flow before sending.',
];

const flowRows = [
  {
    id: 'invoice-flow',
    icon: ReceiptText,
    title: 'Invoice Flow',
    summary: 'Clients, invoices, expenses, income, fixed costs, PDFs, tax exports.',
    stats: [
      ['Open', '12'],
      ['Overdue', '3'],
      ['MTD Income', '$24.1K'],
      ['Expenses', '$5.7K'],
    ],
    preview: ['Acme Retainer due today', 'PDF export ready', 'OpenAI transcription available'],
  },
  {
    id: 'lead-flow',
    icon: Target,
    title: 'Lead Flow',
    summary: 'Scraping, enrichment, audits, scoring, contacts, outreach, follow-ups.',
    stats: [
      ['Hot', '11'],
      ['Follow-ups', '8'],
      ['Audits', '19'],
      ['Saved', '31'],
    ],
    preview: ['Google Places enrichment', 'Gemini lead generation', 'Email and social scraping'],
  },
  {
    id: 'asset-flow',
    icon: WalletCards,
    title: 'Asset Flow',
    summary: 'Holdings, transactions, trading funds, wallets, journal, AI market briefings.',
    stats: [
      ['Holdings', '23'],
      ['Trades', '9'],
      ['Wallets', '4'],
      ['Alerts', '2'],
    ],
    preview: ['xAI market pulse', 'CoinGecko and Finnhub prices', 'Trading journal insights'],
  },
  {
    id: 'vibe-flow',
    icon: FolderKanban,
    title: 'Vibe Flow',
    summary: 'Projects, kanban cards, todos, calendar events, categories, activity.',
    stats: [
      ['Projects', '5'],
      ['Cards', '18'],
      ['Todos', '27'],
      ['Events', '6'],
    ],
    preview: ['Today board', 'Calendar sync', 'AI task planning'],
  },
];

function PriorityBadge({ priority }: { priority: string }) {
  const className =
    priority === 'High'
      ? 'bg-red-500/10 text-red-700 dark:text-red-300'
      : priority === 'Medium'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'bg-slate-500/10 text-slate-600 dark:text-slate-300';

  return <Badge className={cn('border-0', className)}>{priority}</Badge>;
}

export default function CommandCenterPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Command Center' }]} />

      <section className="flex flex-col gap-4 rounded-lg border border-rc-border bg-rc-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-rc-orange/10 text-rc-orange">
              <Command className="size-3" />
              Central Command
            </Badge>
            <Badge variant="outline" className="bg-background">
              <ShieldCheck className="size-3" />
              Server-side keys
            </Badge>
            <Badge variant="outline" className="bg-background">
              <Bot className="size-3" />
              AI tool routing
            </Badge>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-normal text-foreground md:text-3xl">
            One cockpit for finance, leads, assets, and work.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The first screen should answer what needs attention, which flow owns it, and what the AI can safely do next.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-rc-orange text-white hover:bg-rc-orange-dark">
            <Sparkles className="size-4" />
            Ask Command
          </Button>
          <Button variant="outline">
            <Search className="size-4" />
            Global Search
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {flowCards.map((flow) => (
          <Link
            key={flow.name}
            href={flow.href}
            className="group rounded-lg border border-rc-border bg-rc-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-rc-orange/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className={cn('rounded-md p-2', flow.tint)}>
                <flow.icon className="size-5" />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge variant="outline" className="bg-background">
                  {flow.label}
                </Badge>
                <Badge className="border-0 bg-rc-orange/10 text-rc-orange">
                  Coming soon
                </Badge>
              </div>
            </div>
            <div className="mt-5">
              <p className="text-sm font-medium text-muted-foreground">{flow.name}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-3xl font-bold">{flow.value}</span>
                <span className="text-sm text-muted-foreground">{flow.metric}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{flow.detail}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {flow.actions.map((action) => (
                <span key={action} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {action}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-rc-orange">
              Open workspace
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="rounded-lg border border-rc-border bg-rc-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rc-border pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold">Command Queue</h2>
              <p className="text-sm text-muted-foreground">Cross-flow tasks ranked by urgency and business impact.</p>
            </div>
            <Button variant="outline" size="sm">
              <CalendarClock className="size-4" />
              Today
            </Button>
          </div>

          <div className="divide-y divide-rc-border">
            {commandQueue.map((item) => (
              <div key={item.title} className="flex items-center gap-3 py-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <item.icon className={cn('size-5', item.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.source}</p>
                </div>
                <PriorityBadge priority={item.priority} />
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-rc-border bg-rc-card p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-rc-border pb-4">
            <div className="flex size-9 items-center justify-center rounded-md bg-rc-orange/10 text-rc-orange">
              <Bot className="size-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold">AI Command Rail</h2>
              <p className="text-sm text-muted-foreground">One assistant, flow-aware tools.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {[
              ['Summarize today', MessageSquareText],
              ['Draft outreach', Mic],
              ['Create invoice', FileText],
              ['Analyze portfolio', PieChart],
            ].map(([label, Icon]) => (
              <button
                key={label as string}
                className="flex min-h-11 w-full items-center justify-between rounded-md border border-rc-border px-3 text-left text-sm font-medium transition hover:border-rc-orange/40 hover:bg-rc-orange/5"
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4 text-rc-steel" />
                  {label as string}
                </span>
                <Zap className="size-4 text-rc-orange" />
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-md bg-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested prompt</p>
            <p className="mt-2 text-sm leading-6">
              Show me the highest-value lead I should contact today, then draft the email and check whether they have unpaid invoices.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {flowRows.map((flow) => (
            <article
              id={flow.id}
              key={flow.id}
              className="rounded-lg border border-rc-border bg-rc-card p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <flow.icon className="size-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold">{flow.title}</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{flow.summary}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Open
                  <ArrowRight className="size-4" />
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {flow.stats.map(([label, value]) => (
                  <div key={label} className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-heading text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {flow.preview.map((item) => (
                  <Badge key={item} variant="outline" className="bg-background">
                    <CheckCircle2 className="size-3 text-rc-emerald" />
                    {item}
                  </Badge>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="rounded-lg border border-rc-border bg-rc-card p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
          <div className="flex items-center justify-between border-b border-rc-border pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold">Live Activity</h2>
              <p className="text-sm text-muted-foreground">A shared event stream across all flows.</p>
            </div>
            <TrendingUp className="size-5 text-rc-emerald" />
          </div>
          <div className="mt-4 space-y-4">
            {timeline.map((event) => (
              <div key={`${event.time}-${event.title}`} className="grid grid-cols-[72px_1fr] gap-3">
                <span className="text-xs font-medium text-muted-foreground">{event.time}</span>
                <div>
                  <p className="text-sm font-semibold">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.meta}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-rc-border pt-4">
            <h3 className="text-sm font-semibold">Cross-flow insights</h3>
            <div className="mt-3 space-y-3">
              {insights.map((insight) => (
                <div key={insight} className="rounded-md bg-muted p-3 text-sm leading-6">
                  {insight}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
