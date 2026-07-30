import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  HardHat,
  LockKeyhole,
  MessageSquareMore,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import styles from './home.module.css';

export const metadata: Metadata = {
  title: 'RailCommand | Rail Project Control',
  description:
    'Bring rail construction schedules, submittals, RFIs, field logs, safety, quality, photos, and project intelligence into one secure command center.',
};

const workflows = [
  {
    number: '01',
    icon: Gauge,
    title: 'Command the project',
    copy: 'See schedule, budget, approvals, open risk, and field activity without stitching together five different systems.',
    items: ['Executive dashboard', 'Schedule and milestones', 'Budget visibility'],
  },
  {
    number: '02',
    icon: HardHat,
    title: 'Connect field and office',
    copy: 'Give project teams one dependable place for daily documentation, coordination, verification, and closeout.',
    items: ['Daily logs and photos', 'Safety and QC/QA', 'Punch and documents'],
  },
  {
    number: '03',
    icon: Sparkles,
    title: 'Act on the signal',
    copy: 'Find what matters quickly with global search, focused reporting, notifications, and RailBot project assistance.',
    items: ['Cross-project search', 'Project reporting', 'AI-assisted insight'],
  },
];

const operationalModules = [
  { icon: FileCheck2, label: 'Submittals' },
  { icon: MessageSquareMore, label: 'RFIs' },
  { icon: CalendarDays, label: 'Daily Logs' },
  { icon: ClipboardCheck, label: 'Punch Lists' },
  { icon: ShieldCheck, label: 'Safety' },
  { icon: CheckCircle2, label: 'QC / QA' },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="RailCommand home">
          <Image
            src="/IMG_0938.jpg"
            alt="RailCommand"
            width={190}
            height={46}
            priority
            className={styles.logo}
          />
          <span>BY A5 RAIL</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#workflows">Workflows</a>
          <a href="#security">Security</a>
        </nav>

        <div className={styles.headerActions}>
          <Link href="/login" className={styles.textLink}>
            Sign in
          </Link>
          <Link href="/login?mode=signup" className={styles.headerCta}>
            See pricing
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>RAIL CONSTRUCTION / ONE COMMAND VIEW</p>
          <h1>
            Every rail project.
            <br />
            <em>One command.</em>
          </h1>
          <p className={styles.heroIntro}>
            RailCommand brings project controls, field documentation, approvals,
            safety, quality, and team intelligence into one secure workspace
            built for the way rail projects actually move.
          </p>

          <div className={styles.heroActions}>
            <Link href="/login?mode=signup" className={styles.primaryCta}>
              Get started
              <ArrowRight size={17} />
            </Link>
            <a href="#platform" className={styles.secondaryCta}>
              Explore the platform
            </a>
          </div>

          <div className={styles.heroSignal}>
            <span className={styles.liveDot} />
            <strong>FIELD TO OFFICE</strong>
            <span>Live project visibility without the spreadsheet chase.</span>
          </div>
        </div>

        <div className={styles.productStage} aria-label="RailCommand product preview">
          <div className={styles.previewWindow}>
            <aside className={styles.previewRail}>
              <div className={styles.previewMark}>RC</div>
              <div className={styles.previewNav}>
                <span className={styles.previewActive}><Gauge size={15} /> Overview</span>
                <span><FileCheck2 size={15} /> Submittals</span>
                <span><MessageSquareMore size={15} /> RFIs</span>
                <span><CalendarDays size={15} /> Daily logs</span>
                <span><ShieldCheck size={15} /> Safety</span>
              </div>
              <div className={styles.previewSecure}>
                <LockKeyhole size={14} />
                US DATA ONLY
              </div>
            </aside>

            <div className={styles.previewMain}>
              <div className={styles.previewTopbar}>
                <span><Search size={14} /> Search project</span>
                <span className={styles.previewUser}>MS</span>
              </div>
              <div className={styles.previewContent}>
                <p className={styles.previewEyebrow}>PROJECT CONTROL / LIVE</p>
                <div className={styles.previewTitle}>
                  <div>
                    <h2>Englewood Yard Expansion</h2>
                    <p>Colorado &amp; Western Railroad</p>
                  </div>
                  <span>ACTIVE</span>
                </div>
                <div className={styles.metrics}>
                  <article>
                    <span>BUDGET</span>
                    <Gauge size={15} />
                    <strong>$4.3M</strong>
                    <small>$2.5M committed</small>
                  </article>
                  <article>
                    <span>SCHEDULE</span>
                    <CalendarDays size={15} />
                    <strong>78%</strong>
                    <small>Commissioning next</small>
                  </article>
                  <article>
                    <span>OPEN RFIs</span>
                    <MessageSquareMore size={15} />
                    <strong>05</strong>
                    <small>2 need direction</small>
                  </article>
                  <article>
                    <span>FIELD LOGS</span>
                    <ClipboardCheck size={15} />
                    <strong>33</strong>
                    <small>Current through today</small>
                  </article>
                </div>
                <div className={styles.previewLower}>
                  <article className={styles.activityPanel}>
                    <div><span>RECENT SIGNALS</span><Activity size={15} /></div>
                    <p><i className={styles.greenDot} /> Daily log submitted for Track 3</p>
                    <p><i className={styles.orangeDot} /> RFI-018 needs design direction</p>
                    <p><i className={styles.greenDot} /> Signal foundation QA verified</p>
                  </article>
                  <article className={styles.agentPanel}>
                    <Bot size={18} />
                    <span>RAILBOT / PROJECT AGENT</span>
                    <strong>Four items need attention.</strong>
                    <p>Start with the crossing package and today&apos;s open RFI.</p>
                  </article>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.stageNote}>
            <span>01</span>
            <p>One operating picture for owners, contractors, engineers, and field teams.</p>
          </div>
        </div>
      </section>

      <section className={styles.audienceStrip} aria-label="Built for project teams">
        <span>BUILT FOR</span>
        <strong>Owners</strong>
        <i />
        <strong>Contractors</strong>
        <i />
        <strong>Engineers</strong>
        <i />
        <strong>Field Teams</strong>
      </section>

      <section id="platform" className={styles.platform}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>THE OPERATING SYSTEM FOR THE WORK</p>
          <h2>
            Less chasing.
            <br />
            <em>More commanding.</em>
          </h2>
          <p>
            RailCommand replaces scattered updates and disconnected records with
            a living project system your whole team can understand.
          </p>
        </div>

        <div className={styles.moduleGrid}>
          {operationalModules.map(({ icon: Icon, label }) => (
            <div key={label}>
              <Icon size={20} />
              <span>{label}</span>
              <ArrowRight size={14} />
            </div>
          ))}
        </div>
      </section>

      <section id="workflows" className={styles.workflows}>
        <div className={styles.sectionLabel}>
          <span>HOW RAILCOMMAND WORKS</span>
          <p>From first notice to final closeout.</p>
        </div>
        <div className={styles.workflowGrid}>
          {workflows.map(({ number, icon: Icon, title, copy, items }) => (
            <article key={number}>
              <div className={styles.workflowTop}>
                <span>{number}</span>
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <ul>
                {items.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={14} />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className={styles.security}>
        <div className={styles.securityIcon}>
          <ShieldCheck size={30} />
        </div>
        <div>
          <p className={styles.eyebrow}>CONTROLLED ACCESS / US-ONLY</p>
          <h2>Project information stays inside a guarded workspace.</h2>
        </div>
        <div className={styles.securityCopy}>
          <p>
            Role-based permissions, protected project membership, private file
            access, and US network controls help keep the right information with
            the right people.
          </p>
          <div>
            <span><LockKeyhole size={14} /> Role-based access</span>
            <span><Users size={14} /> Project-level membership</span>
            <span><ShieldCheck size={14} /> US-only controls</span>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <p className={styles.eyebrow}>READY FOR A CLEARER PROJECT?</p>
        <h2>
          Put your next rail project
          <br />
          <em>under one command.</em>
        </h2>
        <div>
          <Link href="/login?mode=signup" className={styles.primaryCta}>
            See pricing
            <ArrowRight size={17} />
          </Link>
          <Link href="/login" className={styles.finalSignIn}>
            Already have access? Sign in
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <Image
            src="/IMG_0938.jpg"
            alt="RailCommand"
            width={160}
            height={39}
            className={styles.footerLogo}
          />
          <span>BY A5 RAIL</span>
        </div>
        <p>Rail construction project control, from field signal to executive view.</p>
        <nav aria-label="Legal links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </footer>
    </main>
  );
}
