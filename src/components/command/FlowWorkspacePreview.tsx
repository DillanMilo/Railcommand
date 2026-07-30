import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Mail,
  Mic,
  PieChart,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

const flowConfig = {
  invoice: {
    title: 'Invoice Flow',
    subtitle: 'Clients, invoices, income, expenses, fixed costs, profile, PDFs, exports, and AI finance assistant.',
    shell: 'bg-[#070b16] text-white',
    panel: 'border-white/10 bg-[#101827]/90 shadow-[0_18px_70px_rgba(0,0,0,0.35)]',
    accent: 'text-violet-300',
    button: 'bg-violet-500 text-white hover:bg-violet-400',
    nav: ['Dashboard', 'Clients', 'Invoices', 'Income', 'Expenses', 'Fixed Expenses', 'Profile', 'Backup'],
  },
  lead: {
    title: 'Lead Flow',
    subtitle: 'AI lead scraping, ICP, saved leads, follow-ups, touched leads, outreach history, and website audits.',
    shell: 'bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-white',
    panel: 'border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
    accent: 'text-blue-600 dark:text-blue-300',
    button: 'bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200',
    nav: ['Dashboard', 'Scraper', 'Leads', 'Saved', 'Follow Ups', 'Touched Leads', 'Outreach History', 'ICP Profile'],
  },
  asset: {
    title: 'Asset Flow',
    subtitle: 'Portfolio holdings, live prices, markets, news, wallets, trading journal, AI market pulse, and privacy mode.',
    shell: 'bg-[#080d18] text-[#e8e6e3]',
    panel: 'border-white/[0.06] bg-[#0f1626] shadow-[0_20px_80px_rgba(0,0,0,0.45)]',
    accent: 'text-[#c9a87c]',
    button: 'bg-[#c9a87c] text-[#080d18] hover:bg-[#d9b98d]',
    nav: ['Dashboard', 'Portfolio', 'Trading', 'Markets', 'News', 'Journal', 'AI Assistant', 'Settings'],
  },
  vibe: {
    title: 'Vibe Flow',
    subtitle: 'Warm-noir workspace for projects, today view, kanban, todos, notes, calendar, categories, and activity.',
    shell: 'bg-[#0c0a09] text-[#f5f0eb]',
    panel: 'border-[#3d3229] bg-[#18140f] shadow-[0_18px_70px_rgba(0,0,0,0.5)]',
    accent: 'text-[#e5a54b]',
    button: 'bg-[#e5a54b] text-[#0c0a09] hover:bg-[#d4922e]',
    nav: ['Today', 'Board', 'Tasks', 'Calendar', 'Notes', 'Projects', 'Activity', 'Settings'],
  },
} as const;

type FlowKey = keyof typeof flowConfig;
type FlowStat = readonly [label: string, value: string, Icon: LucideIcon];

const invoiceStats: readonly FlowStat[] = [
  ['MTD Income', '$24,100', TrendingUp],
  ['Expenses', '$5,700', TrendingDown],
  ['Open Invoices', '12', ReceiptText],
  ['Tax Reserve', '$4,600', PieChart],
];

const leadStats: readonly FlowStat[] = [
  ['Total Leads', '42', Users],
  ['Hot Leads', '11', Target],
  ['Follow Ups', '8', Clock],
  ['Avg SEO', '74%', BarChart3],
];

const assetStats: readonly FlowStat[] = [
  ['Portfolio', '$126.8K', Wallet],
  ['Open Trades', '9', LineChart],
  ['Win Rate', '64%', TrendingUp],
  ['Alerts', '2', Bot],
];

const vibeColumns = [
  ['Todo', ['Build invoice import', 'Lead audit copy', 'Asset API wrapper']],
  ['In Progress', ['Central dashboard', 'AI tool router']],
  ['Complete', ['Repo inventory', 'Command concept']],
];

function getFlowStats(flow: FlowKey): readonly FlowStat[] {
  if (flow === 'invoice') return invoiceStats;
  if (flow === 'lead') return leadStats;
  if (flow === 'asset') return assetStats;
  return [
    ['Projects', '5', LayoutDashboard],
    ['Cards', '18', ListChecks],
    ['Today', '6', CalendarDays],
    ['Done', '9', CheckCircle2],
  ];
}

function SidebarNav({ flow }: { flow: FlowKey }) {
  const config = flowConfig[flow];
  return (
    <aside className="hidden w-64 shrink-0 border-r border-current/10 p-5 lg:block">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-current/10 bg-current/5">
          <Sparkles className={`size-5 ${config.accent}`} />
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">{config.title}</p>
          <p className="text-xs opacity-55">inside Central Command</p>
        </div>
      </div>
      <nav className="space-y-1.5">
        {config.nav.map((item, index) => (
          <button
            key={item}
            className={`flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition ${
              index === 0 ? 'bg-current/10 font-semibold' : 'opacity-70 hover:bg-current/5 hover:opacity-100'
            }`}
          >
            {index === 0 ? <LayoutDashboard className="size-4" /> : <span className="size-4 rounded bg-current/15" />}
            {item}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function StatsGrid({ flow }: { flow: FlowKey }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {getFlowStats(flow).map(([label, value, Icon]) => (
        <div key={label} className="rounded-2xl border border-current/10 bg-current/[0.035] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium opacity-55">{label}</p>
            <Icon className="size-4 opacity-65" />
          </div>
          <p className="text-2xl font-black tracking-normal">{value}</p>
        </div>
      ))}
    </div>
  );
}

function InvoiceBody() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Financial overview</h2>
            <p className="text-sm text-white/55">Month view with income, expenses, invoices, and tax reserve.</p>
          </div>
          <Button className="bg-violet-500 text-white hover:bg-violet-400">
            <Plus className="size-4" />
            New Invoice
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {['Acme Retainer', 'Brand Package', 'Monthly Support'].map((invoice, index) => (
            <div key={invoice} className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
              <p className="text-sm font-semibold">{invoice}</p>
              <p className="mt-2 text-2xl font-black">${[4200, 6800, 2400][index].toLocaleString()}</p>
              <Badge className="mt-3 border-0 bg-violet-500/15 text-violet-200">
                {index === 0 ? 'Due today' : index === 1 ? 'Draft' : 'Paid'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <h3 className="font-bold">AI finance tools</h3>
        <div className="mt-4 space-y-2">
          {['Draft invoice email', 'Transcribe expense note', 'Export tax CSV', 'Summarize overdue invoices'].map((item) => (
            <button key={item} className="flex h-11 w-full items-center gap-2 rounded-lg border border-white/10 px-3 text-sm hover:bg-white/5">
              <Mic className="size-4 text-violet-300" />
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeadBody() {
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-xl font-black">Scraper</h2>
        <p className="mt-1 text-sm text-zinc-500">Search by niche, area, count, and ICP profile.</p>
        <div className="mt-5 space-y-3">
          {['Niche: med spas', 'Area: Austin, TX', 'Count: 25', 'ICP: premium local services'].map((item) => (
            <div key={item} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              {item}
            </div>
          ))}
        </div>
        <Button className="mt-5 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950">
          <Search className="size-4" />
          Run Scraper
        </Button>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">Lead pipeline</h2>
          <Badge className="border-0 bg-blue-500/10 text-blue-700 dark:text-blue-300">Google Places enriched</Badge>
        </div>
        <div className="space-y-3">
          {['Luxe Wellness Studio', 'Northside Dental Co.', 'Peak Roofing Group'].map((lead, index) => (
            <div key={lead} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100 font-bold dark:bg-zinc-800">
                {lead[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{lead}</p>
                <p className="text-xs text-zinc-500">SEO {[62, 81, 74][index]} · Performance {[58, 77, 69][index]} · follow-up due</p>
              </div>
              <Button variant="outline" size="sm">
                <Mail className="size-4" />
                Draft
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssetBody() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#e8e6e3]">Portfolio command</h2>
            <p className="text-sm text-[#6b7394]">Holdings, wallets, live prices, trading funds, and journal performance.</p>
          </div>
          <Badge className="border-0 bg-[#c9a87c]/10 text-[#c9a87c]">Privacy mode ready</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {['BTC', 'NVDA', 'GOLD'].map((symbol, index) => (
            <div key={symbol} className="rounded-2xl border border-white/[0.06] bg-[#0a1020] p-4">
              <div className="flex items-center justify-between">
                <p className="font-black">{symbol}</p>
                <span className={index === 1 ? 'text-[#f87171]' : 'text-[#34d399]'}>
                  {index === 1 ? '-1.4%' : '+2.8%'}
                </span>
              </div>
              <p className="mt-3 text-2xl font-black text-[#c9a87c]">{['$96,420', '$918', '$2,410'][index]}</p>
              <div className="mt-4 h-14 rounded-lg bg-gradient-to-r from-[#c9a87c]/10 via-[#7c8bb5]/20 to-[#34d399]/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
        <h3 className="font-bold text-[#e8e6e3]">Cipher AI</h3>
        <p className="mt-1 text-sm text-[#6b7394]">Market pulse, portfolio analysis, risk notes, and news briefing.</p>
        <div className="mt-4 space-y-2">
          {['Analyze exposure', 'Generate news briefing', 'Review open trades', 'Summarize journal lessons'].map((item) => (
            <button key={item} className="flex h-11 w-full items-center gap-2 rounded-lg border border-white/[0.06] px-3 text-sm hover:bg-white/[0.03]">
              <Bot className="size-4 text-[#c9a87c]" />
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VibeBody() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="rounded-2xl border border-[#3d3229] bg-[#1c1714] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl italic text-[#f5f0eb]">Today board</h2>
            <p className="text-sm text-[#8a7d70]">Warm-noir kanban, todos, notes, calendar, and project colors.</p>
          </div>
          <Button className="bg-[#e5a54b] text-[#0c0a09] hover:bg-[#d4922e]">
            <Plus className="size-4" />
            Add Card
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {vibeColumns.map(([column, cards]) => (
            <div key={column as string} className="rounded-2xl border border-[#3d3229] bg-[#0c0a09]/55 p-3">
              <p className="mb-3 text-sm font-bold text-[#c4b8ab]">{column as string}</p>
              <div className="space-y-2">
                {(cards as string[]).map((card) => (
                  <div key={card} className="rounded-xl border border-[#3d3229] bg-[#18140f] p-3 text-sm text-[#f5f0eb]">
                    {card}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-[#3d3229] bg-[#1c1714] p-5">
        <h3 className="font-serif text-xl italic">Calendar + notes</h3>
        <div className="mt-4 space-y-3">
          {['10:00 AI planning block', '1:30 Client asset review', '4:00 Invoice copy cleanup'].map((item) => (
            <div key={item} className="rounded-xl border border-[#3d3229] bg-[#0c0a09]/50 p-3 text-sm text-[#c4b8ab]">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FlowWorkspacePreview({ flow }: { flow: FlowKey }) {
  const config = flowConfig[flow];

  return (
    <div className={`min-h-screen ${config.shell}`}>
      <div className="flex min-h-screen">
        <SidebarNav flow={flow} />
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="outline" className="border-current/15 bg-transparent hover:bg-current/5">
              <Link href="/command-preview">
                <ArrowLeft className="size-4" />
                Central Command
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-0 bg-current/10">Native workspace preview</Badge>
              <Badge className="border-0 bg-current/10">Feature parity target</Badge>
            </div>
          </div>

          <section className={`rounded-3xl border p-4 md:p-6 ${config.panel}`}>
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-bold uppercase tracking-[0.2em] ${config.accent}`}>
                    Central Command workspace
                  </p>
                  <Badge className="border-0 bg-current/10">Coming soon</Badge>
                </div>
                <h1 className="text-3xl font-black tracking-normal md:text-5xl">{config.title}</h1>
                <p className="mt-3 text-sm leading-6 opacity-65 md:text-base">{config.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className={config.button}>
                  <Plus className="size-4" />
                  Create
                </Button>
                <Button variant="outline" className="border-current/15 bg-transparent hover:bg-current/5">
                  <Settings className="size-4" />
                  Settings
                </Button>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-current/10 bg-current/[0.04] p-4 text-sm leading-6 opacity-85">
              This workspace is a preview of the full {config.title} experience. The original styling and feature set are being migrated into Central Command.
            </div>

            <StatsGrid flow={flow} />

            <div className="mt-4">
              {flow === 'invoice' && <InvoiceBody />}
              {flow === 'lead' && <LeadBody />}
              {flow === 'asset' && <AssetBody />}
              {flow === 'vibe' && <VibeBody />}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export function isFlowKey(value: string): value is FlowKey {
  return value in flowConfig;
}
