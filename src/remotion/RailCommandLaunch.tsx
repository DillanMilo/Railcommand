import React from 'react';
import { Audio } from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

type ModuleItem = {
  label: string;
  value: string;
  tone: string;
};

const COLORS = {
  navy: '#0f172a',
  slate: '#1e293b',
  steel: '#64748b',
  orange: '#f97316',
  amber: '#f59e0b',
  emerald: '#10b981',
  blue: '#3b82f6',
  red: '#ef4444',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#dbe3ee',
  ink: '#101828',
};

const easing = Easing.bezier(0.16, 1, 0.3, 1);

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const useLocalFrame = () => useCurrentFrame();

const fade = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], { ...clamp, easing });

const revealStyle = (frame: number, delay = 0, distance = 28): React.CSSProperties => {
  const progress = fade(frame, delay, delay + 24);
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const SceneShell = ({
  children,
  tone = 'light',
}: {
  children: React.ReactNode;
  tone?: 'light' | 'dark';
}) => {
  return (
    <AbsoluteFill
      style={{
        background:
          tone === 'dark'
            ? `linear-gradient(135deg, ${COLORS.navy} 0%, #152033 48%, #263344 100%)`
            : `linear-gradient(135deg, ${COLORS.bg} 0%, #eef4f7 50%, #fff7ed 100%)`,
        color: tone === 'dark' ? '#fff' : COLORS.ink,
        fontFamily:
          'Inter, Plus Jakarta Sans, DM Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            tone === 'dark'
              ? 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)'
              : 'linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.15))',
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

const Brand = ({ light = false }: { light?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    <div
      style={{
        width: 54,
        height: 54,
        borderRadius: 14,
        background: COLORS.orange,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: 900,
        fontSize: 28,
        boxShadow: '0 18px 40px rgba(249,115,22,0.32)',
      }}
    >
      R
    </div>
    <div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: 0,
          color: light ? '#fff' : COLORS.navy,
          lineHeight: 1,
        }}
      >
        RailCommand
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          textTransform: 'uppercase',
          color: light ? 'rgba(255,255,255,0.66)' : COLORS.steel,
          marginTop: 6,
          letterSpacing: 1.8,
        }}
      >
        Field to office control
      </div>
    </div>
  </div>
);

const FragmentCard = ({
  label,
  x,
  y,
  rotate,
  delay,
}: {
  label: string;
  x: number;
  y: number;
  rotate: number;
  delay: number;
}) => {
  const frame = useLocalFrame();
  const p = fade(frame, delay, delay + 22);
  const drift = interpolate(frame, [100, 138], [0, -260], { ...clamp, easing: Easing.in(Easing.cubic) });
  const opacity = p * interpolate(frame, [105, 134], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: x + drift,
        top: y + drift * 0.18,
        width: 260,
        padding: '22px 24px',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.18)',
        color: '#fff',
        fontSize: 26,
        fontWeight: 800,
        transform: `rotate(${rotate}deg) scale(${interpolate(p, [0, 1], [0.92, 1])})`,
        opacity,
        boxShadow: '0 26px 80px rgba(0,0,0,0.22)',
      }}
    >
      {label}
    </div>
  );
};

const HeroScene = () => {
  const frame = useLocalFrame();
  const appP = fade(frame, 114, 156);
  return (
    <SceneShell tone="dark">
      <div style={{ position: 'absolute', left: 120, top: 86 }}>
        <Brand light />
      </div>
      <FragmentCard label="Spreadsheets" x={1230} y={170} rotate={-7} delay={8} />
      <FragmentCard label="Email threads" x={1380} y={354} rotate={5} delay={20} />
      <FragmentCard label="Paper logs" x={1160} y={560} rotate={8} delay={32} />
      <FragmentCard label="Missed follow-ups" x={1420} y={720} rotate={-4} delay={44} />

      <div style={{ position: 'absolute', left: 132, top: 260, width: 940 }}>
        <div style={{ ...revealStyle(frame, 8), color: COLORS.orange, fontSize: 30, fontWeight: 900 }}>
          Built for rail construction teams
        </div>
        <div
          style={{
            ...revealStyle(frame, 20, 40),
            fontSize: 104,
            lineHeight: 0.95,
            fontWeight: 950,
            letterSpacing: 0,
            marginTop: 22,
          }}
        >
          One command center for every jobsite decision.
        </div>
        <div
          style={{
            ...revealStyle(frame, 48),
            fontSize: 34,
            lineHeight: 1.35,
            color: 'rgba(255,255,255,0.72)',
            width: 790,
            marginTop: 34,
          }}
        >
          RFIs, submittals, daily logs, photos, safety, QC, punch lists, schedule, and AI assistance in one role-aware PWA.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 116,
          top: 224,
          width: 560,
          height: 620,
          opacity: appP,
          transform: `translateX(${interpolate(appP, [0, 1], [70, 0])}px) scale(${interpolate(appP, [0, 1], [0.94, 1])})`,
        }}
      >
        <MiniDashboard dark compact />
      </div>
    </SceneShell>
  );
};

const MiniDashboard = ({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) => {
  const modules: ModuleItem[] = [
    { label: 'Budget', value: '$4.2M', tone: COLORS.navy },
    { label: 'Schedule', value: '82%', tone: COLORS.emerald },
    { label: 'Submittals', value: '18', tone: COLORS.blue },
    { label: 'Open RFIs', value: '6', tone: COLORS.orange },
    { label: 'Punch', value: '14', tone: COLORS.red },
    { label: 'Daily Logs', value: '127', tone: COLORS.amber },
  ];
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 26,
        background: dark ? 'rgba(255,255,255,0.96)' : COLORS.card,
        color: COLORS.ink,
        boxShadow: dark ? '0 40px 120px rgba(0,0,0,0.36)' : '0 40px 120px rgba(15,23,42,0.16)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.58)',
      }}
    >
      <div style={{ height: 74, background: COLORS.navy, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: COLORS.orange }} />
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>Dashboard</div>
        <div style={{ marginLeft: 'auto', width: 112, height: 28, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
      </div>
      <div style={{ padding: compact ? 24 : 34 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: compact ? 26 : 34, fontWeight: 950 }}>Active Rail Project</div>
          <div style={{ borderRadius: 999, background: 'rgba(16,185,129,0.12)', color: COLORS.emerald, padding: '7px 12px', fontWeight: 900, fontSize: 13 }}>Active</div>
        </div>
        <div style={{ color: COLORS.steel, fontWeight: 700, marginTop: 8, fontSize: compact ? 14 : 17 }}>
          Multi-stakeholder delivery
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: compact ? 12 : 16,
            marginTop: compact ? 24 : 34,
          }}
        >
          {modules.map((module) => (
            <div
              key={module.label}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: compact ? 14 : 18,
                minHeight: compact ? 104 : 122,
                background: '#fff',
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${module.tone}18`, border: `2px solid ${module.tone}28` }} />
              <div style={{ fontSize: compact ? 26 : 34, fontWeight: 950, marginTop: 12 }}>{module.value}</div>
              <div style={{ fontSize: compact ? 12 : 14, color: COLORS.steel, fontWeight: 800 }}>{module.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
          <Panel title="Recent activity" rows={['RFI-024 answered', 'Daily log filed', 'Punch item verified']} />
          <Panel title="Milestones" rows={['Signal testing', 'Turnover date', 'Substantial completion']} />
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, rows }: { title: string; rows: string[] }) => (
  <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16, background: '#fff' }}>
    <div style={{ fontWeight: 950, fontSize: 15, color: COLORS.navy, marginBottom: 12 }}>{title}</div>
    {rows.map((row, index) => (
      <div key={row} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: index ? 12 : 0 }}>
        <div style={{ width: 9, height: 9, borderRadius: 99, background: index === 0 ? COLORS.orange : COLORS.emerald }} />
        <div style={{ color: COLORS.steel, fontWeight: 750, fontSize: 13 }}>{row}</div>
      </div>
    ))}
  </div>
);

const DashboardScene = () => {
  const frame = useLocalFrame();
  const calloutP = fade(frame, 82, 116);
  return (
    <SceneShell>
      <div style={{ position: 'absolute', left: 96, top: 74 }}>
        <Brand />
      </div>
      <div style={{ position: 'absolute', left: 94, top: 178, width: 1030, height: 780, ...revealStyle(frame, 4, 38) }}>
        <MiniDashboard />
      </div>
      <div style={{ position: 'absolute', right: 96, top: 210, width: 580 }}>
        <div style={{ ...revealStyle(frame, 10), color: COLORS.orange, fontSize: 24, fontWeight: 950 }}>
          Know what needs attention now
        </div>
        <div style={{ ...revealStyle(frame, 22), fontSize: 76, lineHeight: 0.96, fontWeight: 950, letterSpacing: 0, marginTop: 18 }}>
          Project health at a glance.
        </div>
        <div style={{ ...revealStyle(frame, 44), color: COLORS.steel, fontSize: 29, lineHeight: 1.36, marginTop: 26, fontWeight: 650 }}>
          KPI cards open straight into the right work queue, already filtered for the problem.
        </div>
        <div
          style={{
            ...revealStyle(frame, 70),
            marginTop: 42,
            display: 'grid',
            gap: 16,
          }}
        >
          {['CPI and SPI trends', 'Overdue RFI visibility', 'Role-based quick actions'].map((text, index) => (
            <div
              key={text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: '#fff',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: '18px 20px',
                boxShadow: '0 20px 60px rgba(15,23,42,0.08)',
                opacity: fade(frame, 72 + index * 9, 94 + index * 9),
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 99, background: COLORS.emerald, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 950 }}>OK</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{text}</div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 574,
          top: 354,
          width: 206,
          height: 154,
          borderRadius: 18,
          border: `5px solid ${COLORS.orange}`,
          opacity: calloutP,
          boxShadow: '0 0 0 12px rgba(249,115,22,0.12)',
        }}
      />
    </SceneShell>
  );
};

const Phone = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 430,
      height: 820,
      borderRadius: 58,
      background: COLORS.navy,
      padding: 18,
      boxShadow: '0 45px 140px rgba(15,23,42,0.34)',
    }}
  >
    <div style={{ width: '100%', height: '100%', borderRadius: 42, overflow: 'hidden', background: '#fff', position: 'relative' }}>
      <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 92, height: 8, borderRadius: 99, background: '#111827' }} />
      </div>
      {children}
    </div>
  </div>
);

const FieldCaptureScene = () => {
  const frame = useLocalFrame();
  const scan = interpolate(frame, [84, 144], [76, 616], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <SceneShell tone="dark">
      <div style={{ position: 'absolute', left: 110, top: 86 }}>
        <Brand light />
      </div>
      <div style={{ position: 'absolute', left: 118, top: 248, width: 690 }}>
        <div style={{ ...revealStyle(frame, 6), color: COLORS.orange, fontSize: 25, fontWeight: 950 }}>For the field</div>
        <div style={{ ...revealStyle(frame, 18), fontSize: 82, lineHeight: 0.98, fontWeight: 950, letterSpacing: 0, marginTop: 16 }}>
          Capture the day before details disappear.
        </div>
        <div style={{ ...revealStyle(frame, 42), fontSize: 30, lineHeight: 1.35, color: 'rgba(255,255,255,0.74)', marginTop: 28 }}>
          Daily logs, crews, equipment, weather, photos, GPS metadata, and safety notes are structured from the start.
        </div>
      </div>
      <div style={{ position: 'absolute', right: 305, top: 132, ...revealStyle(frame, 14, 60) }}>
        <Phone>
          <div style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: COLORS.steel, fontSize: 13, fontWeight: 900 }}>Daily Log</div>
                <div style={{ fontSize: 28, fontWeight: 950, color: COLORS.navy }}>Today</div>
              </div>
              <div style={{ width: 46, height: 46, borderRadius: 16, background: COLORS.orange, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 24 }}>+</div>
            </div>
            <div style={{ marginTop: 24, height: 186, borderRadius: 24, overflow: 'hidden', background: `linear-gradient(135deg, ${COLORS.steel}, ${COLORS.navy})`, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 24, bottom: 22, color: '#fff', fontWeight: 950, fontSize: 24 }}>Track install - Siding 2</div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.42))' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: scan, height: 4, background: COLORS.emerald, boxShadow: '0 0 24px rgba(16,185,129,0.8)' }} />
            </div>
            {[
              ['Weather', '62F clear, 8 mph wind'],
              ['Personnel', '24 workers across 4 crews'],
              ['Equipment', 'Tampers, ballast regulator'],
              ['Photos', 'Auto-tagged by date and location'],
              ['Safety', 'Observation filed, no incident'],
            ].map((row, index) => (
              <div
                key={row[0]}
                style={{
                  marginTop: 13,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 16,
                  padding: '15px 16px',
                  opacity: fade(frame, 44 + index * 9, 64 + index * 9),
                }}
              >
                <div style={{ fontSize: 14, color: COLORS.steel, fontWeight: 900 }}>{row[0]}</div>
                <div style={{ fontSize: 17, color: COLORS.navy, fontWeight: 850, marginTop: 4 }}>{row[1]}</div>
              </div>
            ))}
          </div>
        </Phone>
      </div>
      <div style={{ position: 'absolute', left: 118, top: 744, width: 690, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {['Installable PWA', 'Thumb-friendly mobile nav', 'Offline fallback', 'PDF-ready reports'].map((text, index) => (
          <div
            key={text}
            style={{
              ...revealStyle(frame, 72 + index * 8, 24),
              padding: '16px 18px',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#fff',
              fontSize: 19,
              fontWeight: 900,
            }}
          >
            {text}
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

const WorkflowScene = () => {
  const frame = useLocalFrame();
  const line = interpolate(frame, [62, 142], [0, 1], { ...clamp, easing });
  const cards = [
    { title: 'RFI-024', body: 'Utility conflict at STA 24+50', meta: 'Assigned to engineer', color: COLORS.blue },
    { title: 'SUB-018', body: 'As-built drawing package', meta: 'Under review', color: COLORS.orange },
    { title: 'CO-007', body: 'Approved change order', meta: 'Budget updated', color: COLORS.emerald },
  ];
  return (
    <SceneShell>
      <div style={{ position: 'absolute', left: 96, top: 74 }}>
        <Brand />
      </div>
      <div style={{ position: 'absolute', left: 110, top: 228, width: 650 }}>
        <div style={{ ...revealStyle(frame, 6), color: COLORS.orange, fontSize: 25, fontWeight: 950 }}>For project managers</div>
        <div style={{ ...revealStyle(frame, 18), fontSize: 78, lineHeight: 0.97, fontWeight: 950, letterSpacing: 0, marginTop: 16 }}>
          Every workflow has an owner, a status, and a trail.
        </div>
        <div style={{ ...revealStyle(frame, 44), fontSize: 29, lineHeight: 1.35, color: COLORS.steel, fontWeight: 650, marginTop: 28 }}>
          Stop chasing answers across inboxes. RailCommand keeps reviews, responses, attachments, and approvals tied to the project record.
        </div>
      </div>
      <div style={{ position: 'absolute', right: 120, top: 170, width: 870, height: 710 }}>
        <div style={{ position: 'absolute', left: 118, top: 354, width: 620 * line, height: 6, borderRadius: 99, background: COLORS.orange }} />
        {cards.map((card, index) => (
          <div
            key={card.title}
            style={{
              position: 'absolute',
              left: 20 + index * 278,
              top: index === 1 ? 196 : 292,
              width: 250,
              borderRadius: 24,
              padding: 24,
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              boxShadow: '0 34px 100px rgba(15,23,42,0.13)',
              ...revealStyle(frame, 34 + index * 18, 52),
            }}
          >
            <div style={{ width: 54, height: 54, borderRadius: 16, background: `${card.color}18`, border: `2px solid ${card.color}30` }} />
            <div style={{ fontSize: 30, fontWeight: 950, color: COLORS.navy, marginTop: 22 }}>{card.title}</div>
            <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 850, marginTop: 10 }}>{card.body}</div>
            <div style={{ marginTop: 24, borderRadius: 999, background: `${card.color}14`, color: card.color, display: 'inline-block', padding: '9px 13px', fontSize: 14, fontWeight: 950 }}>
              {card.meta}
            </div>
          </div>
        ))}
        <div
          style={{
            position: 'absolute',
            left: 214,
            bottom: 34,
            width: 470,
            borderRadius: 22,
            padding: 24,
            background: COLORS.navy,
            color: '#fff',
            boxShadow: '0 34px 110px rgba(15,23,42,0.26)',
            ...revealStyle(frame, 112),
          }}
        >
          <div style={{ color: COLORS.orange, fontWeight: 950, fontSize: 18 }}>Audit trail</div>
          <div style={{ fontWeight: 950, fontSize: 31, marginTop: 8 }}>Clear accountability, fewer dropped handoffs.</div>
        </div>
      </div>
    </SceneShell>
  );
};

const RailBotScene = () => {
  const frame = useLocalFrame();
  const messages = [
    ['user', 'Summarize project status.'],
    ['bot', 'Schedule is 82% complete. Six RFIs need attention, two are overdue. Signal testing is the next milestone.'],
    ['user', 'Create an RFI from Bobby: signal conduit conflicts with water main at STA 24+50.'],
    ['bot', 'Draft ready. I will ask you to confirm before creating it.'],
  ];
  return (
    <SceneShell tone="dark">
      <div style={{ position: 'absolute', left: 110, top: 86 }}>
        <Brand light />
      </div>
      <div style={{ position: 'absolute', left: 120, top: 262, width: 650 }}>
        <div style={{ ...revealStyle(frame, 6), color: COLORS.orange, fontSize: 25, fontWeight: 950 }}>RailBot</div>
        <div style={{ ...revealStyle(frame, 18), fontSize: 84, lineHeight: 0.95, fontWeight: 950, letterSpacing: 0, marginTop: 16 }}>
          Ask the project. Act with guardrails.
        </div>
        <div style={{ ...revealStyle(frame, 42), fontSize: 30, lineHeight: 1.35, color: 'rgba(255,255,255,0.74)', marginTop: 30 }}>
          RailBot searches scoped project data, summarizes what matters, and turns field language into structured work only after confirmation.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 142,
          top: 126,
          width: 790,
          height: 818,
          borderRadius: 34,
          background: '#fff',
          color: COLORS.ink,
          overflow: 'hidden',
          boxShadow: '0 46px 150px rgba(0,0,0,0.36)',
          ...revealStyle(frame, 18, 64),
        }}
      >
        <div style={{ height: 84, background: COLORS.navy, color: '#fff', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 15 }}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: COLORS.orange, display: 'grid', placeItems: 'center', fontWeight: 950 }}>AI</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 950 }}>RailBot</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', fontWeight: 850 }}>RBAC-scoped assistant</div>
          </div>
        </div>
        <div style={{ padding: 30, display: 'grid', gap: 18 }}>
          {messages.map(([role, text], index) => (
            <div
              key={`${role}-${index}`}
              style={{
                justifySelf: role === 'user' ? 'end' : 'start',
                maxWidth: role === 'user' ? 450 : 610,
                borderRadius: 22,
                padding: '18px 21px',
                fontSize: 22,
                lineHeight: 1.28,
                fontWeight: 760,
                color: role === 'user' ? '#fff' : COLORS.navy,
                background: role === 'user' ? COLORS.orange : '#eef4f7',
                opacity: fade(frame, 36 + index * 30, 56 + index * 30),
                transform: `translateY(${interpolate(fade(frame, 36 + index * 30, 56 + index * 30), [0, 1], [18, 0])}px)`,
              }}
            >
              {text}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 30, right: 30, bottom: 28, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 58, borderRadius: 18, background: '#f1f5f9', border: `1px solid ${COLORS.border}` }} />
          <div style={{ width: 58, height: 58, borderRadius: 18, background: COLORS.orange }} />
        </div>
      </div>
    </SceneShell>
  );
};

const CloseoutScene = () => {
  const frame = useLocalFrame();
  const tiles = [
    ['QC/QA', 'Nonconformance tracked to closeout', COLORS.blue],
    ['Punch List', 'Resolved, then independently verified', COLORS.emerald],
    ['Safety', 'Incidents and observations logged', COLORS.red],
    ['Documents', 'Revision history and PDF exports', COLORS.amber],
  ];
  return (
    <SceneShell>
      <div style={{ position: 'absolute', left: 96, top: 74 }}>
        <Brand />
      </div>
      <div style={{ position: 'absolute', left: 118, top: 214, width: 680 }}>
        <div style={{ ...revealStyle(frame, 6), color: COLORS.orange, fontSize: 25, fontWeight: 950 }}>Close the loop</div>
        <div style={{ ...revealStyle(frame, 18), fontSize: 80, lineHeight: 0.97, fontWeight: 950, letterSpacing: 0, marginTop: 16 }}>
          Quality, safety, and turnover stay connected.
        </div>
        <div style={{ ...revealStyle(frame, 44), fontSize: 29, lineHeight: 1.35, color: COLORS.steel, fontWeight: 650, marginTop: 28 }}>
          From the first photo to the final PDF, every record stays searchable, permissioned, and ready for review.
        </div>
      </div>
      <div style={{ position: 'absolute', right: 110, top: 176, width: 910, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {tiles.map(([title, body, color], index) => (
          <div
            key={title}
            style={{
              height: 260,
              borderRadius: 26,
              padding: 28,
              background: '#fff',
              border: `1px solid ${COLORS.border}`,
              boxShadow: '0 30px 90px rgba(15,23,42,0.1)',
              ...revealStyle(frame, 30 + index * 12, 44),
            }}
          >
            <div style={{ width: 58, height: 58, borderRadius: 18, background: `${color}18`, border: `2px solid ${color}30` }} />
            <div style={{ fontSize: 34, fontWeight: 950, color: COLORS.navy, marginTop: 28 }}>{title}</div>
            <div style={{ fontSize: 22, lineHeight: 1.25, color: COLORS.steel, fontWeight: 750, marginTop: 12 }}>{body}</div>
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

const FinalScene = () => {
  const frame = useLocalFrame();
  return (
    <SceneShell tone="dark">
      <div style={{ position: 'absolute', left: 120, top: 86 }}>
        <Brand light />
      </div>
      <div style={{ position: 'absolute', left: 132, top: 250, width: 1050 }}>
        <div style={{ ...revealStyle(frame, 8), color: COLORS.orange, fontSize: 28, fontWeight: 950 }}>
          Purpose-built for modern rail construction
        </div>
        <div
          style={{
            ...revealStyle(frame, 22, 50),
            fontSize: 104,
            lineHeight: 0.95,
            fontWeight: 950,
            letterSpacing: 0,
            marginTop: 22,
          }}
        >
          Less chasing. More building.
        </div>
        <div style={{ ...revealStyle(frame, 52), color: 'rgba(255,255,255,0.74)', fontSize: 34, lineHeight: 1.35, width: 880, marginTop: 34 }}>
          RailCommand gives every stakeholder the same source of truth, wherever the work is happening.
        </div>
      </div>
      <div style={{ position: 'absolute', right: 110, bottom: 128, width: 620, ...revealStyle(frame, 58, 36) }}>
        <div style={{ borderRadius: 30, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', padding: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {['Install on any device', 'Find anything fast', 'Create from the field', 'Export clean reports'].map((text) => (
              <div key={text} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.1)', padding: 18, color: '#fff', fontSize: 22, fontWeight: 900 }}>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 132, bottom: 116, display: 'flex', gap: 18, ...revealStyle(frame, 86, 26) }}>
        <div style={{ borderRadius: 999, background: COLORS.orange, color: '#fff', padding: '22px 34px', fontSize: 24, fontWeight: 950 }}>
          Launch RailCommand
        </div>
        <div style={{ borderRadius: 999, border: '1px solid rgba(255,255,255,0.24)', color: '#fff', padding: '22px 34px', fontSize: 24, fontWeight: 900 }}>
          Built for professionals
        </div>
      </div>
    </SceneShell>
  );
};

const Soundtrack = () => {
  return (
    <Audio
      src={staticFile('railcommand-launch-bed.wav')}
      volume={(frame) =>
        interpolate(
          frame,
          [0, 60, 1080, 1170],
          [0, 0.34, 0.34, 0],
          clamp,
        )
      }
    />
  );
};

export const RailCommandLaunch = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Soundtrack />
      <Sequence from={0} durationInFrames={120}>
        <HeroScene />
      </Sequence>
      <Sequence from={120} durationInFrames={180}>
        <DashboardScene />
      </Sequence>
      <Sequence from={300} durationInFrames={180}>
        <FieldCaptureScene />
      </Sequence>
      <Sequence from={480} durationInFrames={180}>
        <WorkflowScene />
      </Sequence>
      <Sequence from={660} durationInFrames={210}>
        <RailBotScene />
      </Sequence>
      <Sequence from={870} durationInFrames={150}>
        <CloseoutScene />
      </Sequence>
      <Sequence from={1020} durationInFrames={150}>
        <FinalScene />
      </Sequence>
    </AbsoluteFill>
  );
};
