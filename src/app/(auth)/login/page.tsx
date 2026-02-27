'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Train,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  ChevronRight,
  Smartphone,
  Monitor,
  Share,
  Plus,
  SquarePlus,
  Chrome,
  MoreVertical,
  Check,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignInData = z.infer<typeof signInSchema>;
type SignUpData = z.infer<typeof signUpSchema>;

/* ------------------------------------------------------------------ */
/*  Password strength helper                                           */
/* ------------------------------------------------------------------ */

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-rc-blue' };
  return { score, label: 'Strong', color: 'bg-rc-emerald' };
}

/* ------------------------------------------------------------------ */
/*  Google icon SVG                                                    */
/* ------------------------------------------------------------------ */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Install / PWA Guide                                                */
/* ------------------------------------------------------------------ */

function InstallGuide({ onDismiss }: { onDismiss: () => void }) {
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>('ios');

  const tabs = [
    { id: 'ios' as const, label: 'iPhone / iPad', icon: Smartphone },
    { id: 'android' as const, label: 'Android', icon: Smartphone },
    { id: 'desktop' as const, label: 'Desktop', icon: Monitor },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-rc-orange/10 dark:bg-rc-orange/20 mb-3">
          <Smartphone className="size-7 text-rc-orange" />
        </div>
        <h3 className="font-heading text-xl font-bold text-foreground">
          Take RailCommand Anywhere
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Add RailCommand to your device for instant access — no app store needed.
        </p>
      </div>

      {/* Device tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/60 dark:bg-muted/30 mb-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-rc-card dark:bg-white/10 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'ios' ? 'iOS' : tab.id === 'android' ? 'Android' : 'Desktop'}</span>
            </button>
          );
        })}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {activeTab === 'ios' && (
          <>
            <Step number={1} icon={<Share className="size-4" />} text={'Tap the Share button in Safari\'s toolbar'} />
            <Step number={2} icon={<SquarePlus className="size-4" />} text={'Scroll down and tap "Add to Home Screen"'} />
            <Step number={3} icon={<Check className="size-4" />} text={'Tap "Add" — RailCommand is now on your home screen'} />
          </>
        )}
        {activeTab === 'android' && (
          <>
            <Step number={1} icon={<MoreVertical className="size-4" />} text={'Tap the three-dot menu in Chrome'} />
            <Step number={2} icon={<Plus className="size-4" />} text={'Select "Add to Home screen" or "Install app"'} />
            <Step number={3} icon={<Check className="size-4" />} text={'Confirm — find RailCommand in your app drawer'} />
          </>
        )}
        {activeTab === 'desktop' && (
          <>
            <Step number={1} icon={<Chrome className="size-4" />} text={'Open RailCommand in Chrome or Edge'} />
            <Step number={2} icon={<Plus className="size-4" />} text={'Click the install icon in the address bar'} />
            <Step number={3} icon={<Check className="size-4" />} text={'Click "Install" — opens like a native app'} />
          </>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onDismiss}
          className="flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          I&apos;ll do this later
        </button>
        <Button
          onClick={onDismiss}
          className="flex-1 h-11 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold gap-2"
        >
          Go to Dashboard
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Step({ number, icon, text }: { number: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 dark:bg-white/5">
      <div className="flex items-center justify-center size-8 rounded-lg bg-rc-orange/10 dark:bg-rc-orange/20 text-rc-orange shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Step {number}</p>
        <p className="text-sm text-foreground mt-0.5">{text}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const signInForm = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const watchPassword = signUpForm.watch('password');
  const strength = getPasswordStrength(watchPassword || '');

  const handleSignIn = useCallback(
    async (_data: SignInData) => {
      setIsLoading(true);
      // Simulate network delay — replace with Supabase auth
      await new Promise((r) => setTimeout(r, 600));
      setIsLoading(false);
      router.push('/dashboard');
    },
    [router]
  );

  const handleSignUp = useCallback(
    async (_data: SignUpData) => {
      setIsLoading(true);
      // Simulate network delay — replace with Supabase auth
      await new Promise((r) => setTimeout(r, 800));
      setIsLoading(false);
      setShowInstall(true);
    },
    []
  );

  const handleGoogleSignIn = useCallback(async () => {
    setIsLoading(true);
    // Replace with Supabase OAuth
    await new Promise((r) => setTimeout(r, 600));
    setIsLoading(false);
    router.push('/dashboard');
  }, [router]);

  const handleForgotPassword = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsLoading(false);
    setResetSent(true);
  }, []);

  const switchMode = useCallback((newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setForgotMode(false);
    setResetSent(false);
    signInForm.reset();
    signUpForm.reset();
  }, [signInForm, signUpForm]);

  return (
    <div className="flex min-h-screen bg-rc-bg dark:bg-rc-bg">
      {/* ============================================================ */}
      {/*  LEFT PANEL — Brand / Hero (hidden on mobile)                */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative overflow-hidden bg-rc-navy">
        {/* Blueprint grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249,115,22,0.6) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249,115,22,0.6) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Diagonal accent line */}
        <div
          className="absolute -top-20 -right-20 w-[600px] h-[600px] opacity-[0.03]"
          style={{
            background: 'conic-gradient(from 135deg, transparent 0%, #F97316 25%, transparent 50%)',
          }}
        />
        {/* Orange glow */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-rc-orange/5 blur-[120px]" />

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-11 rounded-xl bg-rc-orange shadow-lg shadow-rc-orange/20">
              <Train className="size-6 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-white tracking-tight">
                RailCommand
              </h1>
              <p className="text-[11px] text-white/40 tracking-wide uppercase">
                by A5 Rail
              </p>
            </div>
          </div>

          {/* Hero content */}
          <div className="max-w-lg">
            <h2 className="font-heading text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
              Command your
              <br />
              <span className="text-rc-orange">rail projects</span>
              <br />
              with precision.
            </h2>
            <p className="mt-6 text-base text-white/50 leading-relaxed max-w-md">
              Track submittals, RFIs, daily logs, punch lists, and schedules — all in one powerful platform built for construction teams.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-8">
              {['Submittals', 'RFIs', 'Daily Logs', 'Punch Lists', 'Schedules'].map(
                (item) => (
                  <span
                    key={item}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 font-medium"
                  >
                    {item}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="flex gap-8">
            {[
              { value: '99.9%', label: 'Uptime' },
              { value: '256-bit', label: 'Encryption' },
              { value: 'US', label: 'Data Only' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-heading text-lg font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL — Auth Forms                                     */}
      {/* ============================================================ */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="flex items-center justify-center size-10 rounded-xl bg-rc-orange">
              <Train className="size-5 text-white" />
            </div>
            <h1 className="font-heading text-xl font-bold text-foreground tracking-tight">
              RailCommand
            </h1>
          </div>

          {showInstall ? (
            /* ====== PWA Install Guide ====== */
            <InstallGuide onDismiss={() => router.push('/dashboard')} />
          ) : forgotMode ? (
            /* ====== Forgot Password ====== */
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                onClick={() => { setForgotMode(false); setResetSent(false); }}
                className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1 transition-colors"
              >
                <ChevronRight className="size-3.5 rotate-180" />
                Back to sign in
              </button>

              {resetSent ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-rc-emerald/10 dark:bg-rc-emerald/20 mb-4">
                    <Mail className="size-7 text-rc-emerald" />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    Check your email
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                    We sent a password reset link. It may take a moment to arrive.
                  </p>
                  <Button
                    onClick={() => { setForgotMode(false); setResetSent(false); }}
                    variant="ghost"
                    className="mt-6 text-rc-orange hover:text-rc-orange-dark"
                  >
                    Return to sign in
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="font-heading text-2xl font-bold text-foreground">
                    Reset password
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 mb-6">
                    Enter your email and we&apos;ll send a reset link.
                  </p>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="reset-email" className="text-sm font-medium text-foreground">
                        Email address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="you@company.com"
                          className="h-12 pl-10"
                          required
                          aria-label="Email for password reset"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-12 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold text-sm"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        'Send reset link'
                      )}
                    </Button>
                  </form>
                </>
              )}
            </div>
          ) : (
            /* ====== Sign In / Sign Up Forms ====== */
            <div className="animate-in fade-in duration-300">
              {/* Header */}
              <div className="mb-6">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === 'signin'
                    ? 'Sign in to continue to your projects'
                    : 'Get started with RailCommand for free'}
                </p>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1 p-1 rounded-xl bg-muted/60 dark:bg-muted/30 mb-6">
                <button
                  onClick={() => switchMode('signin')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    mode === 'signin'
                      ? 'bg-rc-card dark:bg-white/10 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    mode === 'signup'
                      ? 'bg-rc-card dark:bg-white/10 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Google Sign In */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full h-12 gap-3 text-sm font-medium mb-4"
                aria-label="Continue with Google"
              >
                <GoogleIcon className="size-5" />
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-rc-border dark:border-rc-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-rc-bg dark:bg-rc-bg px-3 text-muted-foreground">
                    or continue with email
                  </span>
                </div>
              </div>

              {mode === 'signin' ? (
                /* ---------- Sign In Form ---------- */
                <form
                  onSubmit={signInForm.handleSubmit(handleSignIn)}
                  className="space-y-4"
                  noValidate
                >
                  <div className="space-y-2">
                    <label htmlFor="signin-email" className="text-sm font-medium text-foreground">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@company.com"
                        className={`h-12 pl-10 ${signInForm.formState.errors.email ? 'border-destructive' : ''}`}
                        aria-invalid={!!signInForm.formState.errors.email}
                        {...signInForm.register('email')}
                      />
                    </div>
                    {signInForm.formState.errors.email && (
                      <p className="text-xs text-destructive" role="alert">
                        {signInForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="signin-password" className="text-sm font-medium text-foreground">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setForgotMode(true)}
                        className="text-xs text-rc-orange hover:text-rc-orange-dark font-medium transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className={`h-12 pl-10 pr-11 ${signInForm.formState.errors.password ? 'border-destructive' : ''}`}
                        aria-invalid={!!signInForm.formState.errors.password}
                        {...signInForm.register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {signInForm.formState.errors.password && (
                      <p className="text-xs text-destructive" role="alert">
                        {signInForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold text-sm gap-2"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                /* ---------- Sign Up Form ---------- */
                <form
                  onSubmit={signUpForm.handleSubmit(handleSignUp)}
                  className="space-y-4"
                  noValidate
                >
                  <div className="space-y-2">
                    <label htmlFor="signup-name" className="text-sm font-medium text-foreground">
                      Full name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Jane Doe"
                        className={`h-12 pl-10 ${signUpForm.formState.errors.fullName ? 'border-destructive' : ''}`}
                        aria-invalid={!!signUpForm.formState.errors.fullName}
                        {...signUpForm.register('fullName')}
                      />
                    </div>
                    {signUpForm.formState.errors.fullName && (
                      <p className="text-xs text-destructive" role="alert">
                        {signUpForm.formState.errors.fullName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="signup-email" className="text-sm font-medium text-foreground">
                      Work email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@company.com"
                        className={`h-12 pl-10 ${signUpForm.formState.errors.email ? 'border-destructive' : ''}`}
                        aria-invalid={!!signUpForm.formState.errors.email}
                        {...signUpForm.register('email')}
                      />
                    </div>
                    {signUpForm.formState.errors.email && (
                      <p className="text-xs text-destructive" role="alert">
                        {signUpForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="signup-password" className="text-sm font-medium text-foreground">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        className={`h-12 pl-10 pr-11 ${signUpForm.formState.errors.password ? 'border-destructive' : ''}`}
                        aria-invalid={!!signUpForm.formState.errors.password}
                        {...signUpForm.register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {/* Password strength meter */}
                    {watchPassword && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex-1 flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i <= strength.score ? strength.color : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {strength.label}
                        </span>
                      </div>
                    )}
                    {signUpForm.formState.errors.password && (
                      <p className="text-xs text-destructive" role="alert">
                        {signUpForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="signup-confirm" className="text-sm font-medium text-foreground">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        className={`h-12 pl-10 pr-11 ${signUpForm.formState.errors.confirmPassword ? 'border-destructive' : ''}`}
                        aria-invalid={!!signUpForm.formState.errors.confirmPassword}
                        {...signUpForm.register('confirmPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {signUpForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive" role="alert">
                        {signUpForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold text-sm gap-2"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating account...
                      </span>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    By signing up you agree to our{' '}
                    <button type="button" className="text-rc-orange hover:underline">Terms of Service</button>{' '}
                    and{' '}
                    <button type="button" className="text-rc-orange hover:underline">Privacy Policy</button>
                  </p>
                </form>
              )}
            </div>
          )}

          {/* Footer */}
          {!showInstall && !forgotMode && (
            <p className="text-center text-xs text-muted-foreground mt-8">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-rc-orange hover:text-rc-orange-dark font-medium transition-colors"
              >
                {mode === 'signin' ? 'Sign up for free' : 'Sign in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
