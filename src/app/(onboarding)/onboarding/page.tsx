'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  ClipboardList,
  Bell,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setupBusiness } from '@/lib/actions/onboarding';
import { getMyProfile, updateMyProfile } from '@/lib/actions/profiles';
import type { Organization, Profile } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ORG_TYPES: Organization['type'][] = [
  'contractor',
  'engineer',
  'owner',
  'inspector',
];

const ORG_TYPE_LABELS: Record<Organization['type'], string> = {
  contractor: 'Contractor',
  engineer: 'Engineer',
  owner: 'Owner',
  inspector: 'Inspector',
};

const ROLES: Profile['role'][] = ['admin', 'manager', 'member'];

const ROLE_LABELS: Record<Profile['role'], string> = {
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
};

type Step = 'welcome' | 'profile' | 'business';

const STEP_ORDER: Step[] = ['welcome', 'profile', 'business'];
const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  profile: 'Profile',
  business: 'Business',
};

/* ------------------------------------------------------------------ */
/*  Stepper                                                            */
/* ------------------------------------------------------------------ */

function Stepper({ current }: { current: Step }) {
  const currentIdx = STEP_ORDER.indexOf(current);

  return (
    <div
      role="navigation"
      aria-label="Onboarding progress"
      className="mb-8 w-full"
    >
      <ol className="flex items-center justify-between gap-2">
        {STEP_ORDER.map((step, idx) => {
          const isComplete = idx < currentIdx;
          const isActive = idx === currentIdx;
          const isUpcoming = idx > currentIdx;

          return (
            <li
              key={step}
              className="flex flex-1 flex-col items-center gap-2"
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="flex w-full items-center gap-2">
                <div
                  className={[
                    'size-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors',
                    isActive
                      ? 'bg-rc-orange text-white ring-4 ring-rc-orange/15'
                      : isComplete
                        ? 'bg-rc-orange text-white'
                        : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {idx + 1}
                </div>
                {idx < STEP_ORDER.length - 1 && (
                  <div
                    className={[
                      'h-0.5 flex-1 rounded-full transition-colors',
                      isComplete ? 'bg-rc-orange' : 'bg-muted',
                    ].join(' ')}
                  />
                )}
              </div>
              <span
                className={[
                  'hidden sm:block text-[11px] font-medium tracking-wide uppercase',
                  isActive
                    ? 'text-foreground'
                    : isUpcoming
                      ? 'text-muted-foreground/60'
                      : 'text-muted-foreground',
                ].join(' ')}
              >
                {STEP_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Branding                                                           */
/* ------------------------------------------------------------------ */

function Branding() {
  return (
    <div className="flex flex-col items-center mb-6">
      <Image
        src="/IMG_0938.jpg"
        alt="RailCommand"
        width={200}
        height={48}
        className="object-contain hidden sm:block"
      />
      <Image
        src="/IMG_0936.jpg"
        alt="RailCommand"
        width={48}
        height={48}
        className="rounded-xl sm:hidden"
      />
      <p className="text-[10px] text-muted-foreground/60 tracking-wide uppercase mt-1">
        by A5 Rail
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Wizard                                                             */
/* ------------------------------------------------------------------ */

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('welcome');

  // Profile step state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Business step state
  const [name, setName] = useState('');
  const [type, setType] = useState<Organization['type'] | ''>('');
  const [role, setRole] = useState<Profile['role'] | ''>('');
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);

  // Pre-fill profile fields on mount
  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getMyProfile();
      if (!active) return;
      if (result.success && result.data) {
        setFullName(result.data.full_name ?? '');
        setPhone(result.data.phone ?? '');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /* ---------- Step 2: Profile submit ---------- */
  const handleProfileSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!fullName.trim()) return;

      setProfileLoading(true);
      setProfileError(null);

      try {
        const result = await updateMyProfile({
          full_name: fullName.trim(),
          phone: phone.trim(),
        });

        if (result.error) {
          setProfileError(result.error);
          setProfileLoading(false);
          return;
        }

        setProfileLoading(false);
        setStep('business');
      } catch {
        setProfileError('Something went wrong. Please try again.');
        setProfileLoading(false);
      }
    },
    [fullName, phone],
  );

  /* ---------- Step 3: Business submit ---------- */
  const handleBusinessSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !type || !role) return;

      setBusinessLoading(true);
      setBusinessError(null);

      try {
        const result = await setupBusiness(
          name.trim(),
          type as Organization['type'],
          role as Profile['role'],
        );

        if (result.error) {
          setBusinessError(result.error);
          setBusinessLoading(false);
          return;
        }

        // Mark onboarding as complete
        document.cookie =
          'rc-onboarded=true; path=/; max-age=2592000; SameSite=Lax';

        // Redirect to next page or dashboard
        const next = searchParams.get('next') || '/dashboard';
        router.push(next);
      } catch {
        setBusinessError('Something went wrong. Please try again.');
        setBusinessLoading(false);
      }
    },
    [name, type, role, searchParams, router],
  );

  /* ---------- Render ---------- */

  return (
    <div className="w-full max-w-[460px]">
      <Branding />
      <Stepper current={step} />

      <div
        key={step}
        className="transition-opacity duration-300 ease-out animate-in fade-in"
      >
        {step === 'welcome' && <WelcomeStep onNext={() => setStep('profile')} />}

        {step === 'profile' && (
          <ProfileStep
            fullName={fullName}
            setFullName={setFullName}
            phone={phone}
            setPhone={setPhone}
            onBack={() => setStep('welcome')}
            onSubmit={handleProfileSubmit}
            isLoading={profileLoading}
            error={profileError}
          />
        )}

        {step === 'business' && (
          <BusinessStep
            name={name}
            setName={setName}
            type={type}
            setType={setType}
            role={role}
            setRole={setRole}
            onBack={() => setStep('profile')}
            onSubmit={handleBusinessSubmit}
            isLoading={businessLoading}
            error={businessError}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1: Welcome                                                    */
/* ------------------------------------------------------------------ */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const bullets = [
    {
      icon: ClipboardList,
      text: 'Manage submittals, RFIs, daily logs, and punch lists in one place',
    },
    {
      icon: Bell,
      text: 'Real-time activity feed and notifications',
    },
    {
      icon: Smartphone,
      text: 'Mobile-first — works in the field on any device',
    },
    {
      icon: ShieldCheck,
      text: 'Role-based access to keep contractors, engineers, and inspectors aligned',
    },
  ];

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Welcome to RailCommand
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Let&apos;s get you set up in 3 quick steps.
        </p>
      </div>

      <ul className="mb-6 space-y-3">
        {bullets.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-3"
          >
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-rc-orange/10 text-rc-orange">
              <Icon className="size-4" />
            </div>
            <p className="text-sm text-foreground leading-snug">{text}</p>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        onClick={onNext}
        className="w-full h-12 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold text-sm gap-2"
      >
        Get Started
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2: Profile                                                    */
/* ------------------------------------------------------------------ */

function ProfileStep({
  fullName,
  setFullName,
  phone,
  setPhone,
  onBack,
  onSubmit,
  isLoading,
  error,
}: {
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const initials = getInitials(fullName);

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Tell us about yourself
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll use this to personalize your experience and help your team
          find you.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Full name */}
        <div className="space-y-2">
          <label
            htmlFor="full-name"
            className="text-sm font-medium text-foreground"
          >
            Full name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="full-name"
              type="text"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 pl-10"
              required
              disabled={isLoading}
              aria-label="Full name"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label
            htmlFor="phone"
            className="text-sm font-medium text-foreground"
          >
            Phone <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 pl-10"
              disabled={isLoading}
              aria-label="Phone number"
            />
          </div>
        </div>

        {/* Avatar preview */}
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-rc-orange text-white font-semibold text-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {fullName.trim() || 'Your name'}
            </p>
            <p className="text-xs text-muted-foreground">
              This is how you&apos;ll appear to teammates
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isLoading}
            className="h-12 min-w-[96px] gap-2"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !fullName.trim()}
            className="flex-1 h-12 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold text-sm gap-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3: Business                                                   */
/* ------------------------------------------------------------------ */

function BusinessStep({
  name,
  setName,
  type,
  setType,
  role,
  setRole,
  onBack,
  onSubmit,
  isLoading,
  error,
}: {
  name: string;
  setName: (v: string) => void;
  type: Organization['type'] | '';
  setType: (v: Organization['type'] | '') => void;
  role: Profile['role'] | '';
  setRole: (v: Profile['role'] | '') => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Set up your business
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Last step — tell us about your company.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Business Name */}
        <div className="space-y-2">
          <label
            htmlFor="business-name"
            className="text-sm font-medium text-foreground"
          >
            Business Name
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="business-name"
              type="text"
              placeholder="Acme Rail Construction"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 pl-10"
              required
              disabled={isLoading}
              aria-label="Business name"
            />
          </div>
        </div>

        {/* Business Type */}
        <div className="space-y-2">
          <label
            htmlFor="business-type"
            className="text-sm font-medium text-foreground"
          >
            Business Type
          </label>
          <Select
            value={type}
            onValueChange={(val) => setType(val as Organization['type'])}
            disabled={isLoading}
          >
            <SelectTrigger className="h-12 w-full" id="business-type">
              <SelectValue placeholder="Select your business type" />
            </SelectTrigger>
            <SelectContent>
              {ORG_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ORG_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Your Role */}
        <div className="space-y-2">
          <label
            htmlFor="role"
            className="text-sm font-medium text-foreground"
          >
            Your Role
          </label>
          <Select
            value={role}
            onValueChange={(val) => setRole(val as Profile['role'])}
            disabled={isLoading}
          >
            <SelectTrigger className="h-12 w-full" id="role">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isLoading}
            className="h-12 min-w-[96px] gap-2"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !name.trim() || !type || !role}
            className="flex-1 h-12 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold text-sm gap-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Setting up...
              </span>
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export (Suspense boundary for useSearchParams)                */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
        </div>
      }
    >
      <OnboardingWizard />
    </Suspense>
  );
}
