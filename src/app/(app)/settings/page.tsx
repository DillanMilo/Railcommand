'use client';

import { useState, useCallback, useEffect } from 'react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePWA } from '@/components/providers/ServiceWorkerProvider';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/actions/notification-preferences';
import type { NotificationPreferences } from '@/lib/notifications';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  useTheme,
  type ThemeMode,
} from '@/components/providers/ThemeProvider';
import {
  Sun,
  Moon,
  Clock,
  Eye,
  EyeOff,
  Monitor,
  CheckCircle,
  AlertTriangle,
  Download,
  Smartphone,
  Chrome,
  RefreshCw,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Inline Toggle component                                           */
/* ------------------------------------------------------------------ */
function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-orange/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        checked ? 'bg-rc-orange' : 'bg-muted'
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Theme option card                                                 */
/* ------------------------------------------------------------------ */
const themeOptions: {
  value: ThemeMode;
  label: string;
  subtitle?: string;
  icon: typeof Sun;
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'Auto', subtitle: '7pm \u2013 6am', icon: Clock },
];

/* ------------------------------------------------------------------ */
/*  Notification config                                               */
/* ------------------------------------------------------------------ */
interface NotificationSetting {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  defaultOn: boolean;
}

const notificationSettings: NotificationSetting[] = [
  {
    key: 'submittal_status_changed',
    label: 'Submittal updates',
    description: 'When submittals change status (approved, rejected, etc.)',
    defaultOn: true,
  },
  {
    key: 'rfi_assigned',
    label: 'RFI assignments',
    description: "When you're assigned to an RFI",
    defaultOn: true,
  },
  {
    key: 'rfi_response_received',
    label: 'RFI responses',
    description: 'When someone responds to your RFI',
    defaultOn: true,
  },
  {
    key: 'punch_list_assigned',
    label: 'Punch list assignments',
    description: 'When a punch list item is assigned to you',
    defaultOn: true,
  },
  {
    key: 'punch_list_status_changed',
    label: 'Punch list status changes',
    description: 'When punch list items are resolved or verified',
    defaultOn: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Install App card                                                  */
/* ------------------------------------------------------------------ */
function InstallAppCard() {
  const pwa = usePWA();
  const isInstalled = pwa?.isInstalled ?? false;
  const isInstallable = pwa?.isInstallable ?? false;
  const isUpdateAvailable = pwa?.isUpdateAvailable ?? false;
  const triggerInstall = pwa?.triggerInstall;
  const triggerUpdate = pwa?.triggerUpdate;

  const platformInstructions: {
    title: string;
    icon: typeof Smartphone;
    steps: string[];
  }[] = [
    {
      title: 'iOS (Safari)',
      icon: Smartphone,
      steps: [
        'Open RailCommand in Safari',
        'Tap the Share button (box with arrow)',
        'Scroll down and tap "Add to Home Screen"',
        'Tap "Add" to confirm',
      ],
    },
    {
      title: 'Android (Chrome)',
      icon: Chrome,
      steps: [
        'Open RailCommand in Chrome',
        'Tap the three-dot menu (top right)',
        'Tap "Install app" or "Add to Home Screen"',
        'Tap "Install" to confirm',
      ],
    },
    {
      title: 'Desktop (Chrome/Edge)',
      icon: Monitor,
      steps: [
        'Open RailCommand in Chrome or Edge',
        'Click the install icon in the address bar',
        'Click "Install" to confirm',
        'Or use the "Install Now" button above',
      ],
    },
  ];

  return (
    <Card className="bg-rc-card border-rc-border">
      <CardHeader>
        <CardTitle className="font-heading">Install App</CardTitle>
        <CardDescription>
          Get the full native app experience on any device
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Update available banner */}
        {isUpdateAvailable && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-rc-orange/30 bg-rc-orange/5 p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="size-5 text-rc-orange shrink-0" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  A new version of RailCommand is available
                </div>
                <div className="text-xs text-rc-steel">
                  Update now to get the latest features and fixes.
                </div>
              </div>
            </div>
            <Button
              className="bg-rc-orange hover:bg-rc-orange-dark text-white shrink-0"
              size="sm"
              onClick={() => triggerUpdate?.()}
            >
              Update Now
            </Button>
          </div>
        )}

        {/* Installed state */}
        {isInstalled ? (
          <div className="flex items-center gap-3 rounded-lg border border-rc-emerald/30 bg-rc-emerald/5 p-4">
            <CheckCircle className="size-5 text-rc-emerald shrink-0" />
            <div>
              <div className="text-sm font-medium text-foreground">
                RailCommand is installed
              </div>
              <div className="text-xs text-rc-steel">
                You&apos;re running the app in standalone mode for the best
                experience.
              </div>
            </div>
          </div>
        ) : isInstallable ? (
          /* Installable state — browser supports prompt */
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-rc-border p-4">
            <div className="flex items-center gap-3">
              <Download className="size-5 text-rc-orange shrink-0" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  Install RailCommand
                </div>
                <div className="text-xs text-rc-steel">
                  Install for a native app experience with offline access and
                  quick launch.
                </div>
              </div>
            </div>
            <Button
              className="bg-rc-orange hover:bg-rc-orange-dark text-white shrink-0"
              size="sm"
              onClick={() => triggerInstall?.()}
            >
              <Download className="size-4 mr-1.5" />
              Install Now
            </Button>
          </div>
        ) : null}

        {/* Platform-specific instructions */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Installation Instructions
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {platformInstructions.map((platform) => {
              const Icon = platform.icon;
              return (
                <div
                  key={platform.title}
                  className="rounded-lg border border-rc-border p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rc-orange/10">
                      <Icon className="size-4 text-rc-orange" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {platform.title}
                    </span>
                  </div>
                  <ol className="space-y-1.5 pl-1">
                    {platform.steps.map((step, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-rc-steel"
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-rc-orange/10 text-[10px] font-semibold text-rc-orange mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings Page                                                     */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { isDemo } = useProject();

  // Notification toggles -- persisted to Supabase (or localStorage for demo)
  const [notifications, setNotifications] = useState<Record<string, boolean>>(
    () => Object.fromEntries(notificationSettings.map((n) => [n.key, n.defaultOn]))
  );

  // Load preferences from backend on mount (non-demo only)
  useEffect(() => {
    if (isDemo) {
      try {
        const stored = localStorage.getItem('rc-notification-prefs');
        if (stored) setNotifications(JSON.parse(stored));
      } catch { /* noop */ }
      return;
    }
    getNotificationPreferences().then((result) => {
      if (result.data) setNotifications({ ...result.data });
    });
  }, [isDemo]);

  const toggleNotification = useCallback((key: string) => {
    setNotifications((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (isDemo) {
        try { localStorage.setItem('rc-notification-prefs', JSON.stringify(next)); } catch { /* noop */ }
      } else {
        updateNotificationPreferences({ [key]: next[key] }).catch(() => { /* noop */ });
      }
      return next;
    });
  }, [isDemo]);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handlePasswordSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError('');
      setPasswordSuccess(false);

      if (!currentPassword) {
        setPasswordError('Current password is required.');
        return;
      }
      if (newPassword.length < 8) {
        setPasswordError('New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match.');
        return;
      }

      // Simulate success
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 4000);
    },
    [currentPassword, newPassword, confirmPassword]
  );

  // Danger zone
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Settings' }]} />

      {/* ---- Page Header ---- */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-rc-steel">
          Manage your preferences and account settings
        </p>
      </div>

      {/* ---- Appearance ---- */}
      <Card className="bg-rc-card border-rc-border">
        <CardHeader>
          <CardTitle className="font-heading">Appearance</CardTitle>
          <CardDescription>Customize how RailCommand looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const isActive = mode === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  aria-pressed={isActive}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-5 transition-all ${
                    isActive
                      ? 'border-rc-orange bg-rc-orange/5'
                      : 'border-rc-border hover:border-rc-orange/30'
                  }`}
                >
                  <Icon
                    className={`size-6 ${
                      isActive ? 'text-rc-orange' : 'text-rc-steel'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isActive ? 'text-rc-orange' : 'text-foreground'
                    }`}
                  >
                    {option.label}
                  </span>
                  {option.subtitle && (
                    <span className="text-xs text-rc-steel">
                      {option.subtitle}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ---- Install App ---- */}
      <InstallAppCard />

      {/* ---- Notifications ---- */}
      <Card className="bg-rc-card border-rc-border">
        <CardHeader>
          <CardTitle className="font-heading">Notifications</CardTitle>
          <CardDescription>
            Choose what updates you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {notificationSettings.map((setting, index) => (
              <div key={setting.key}>
                {index > 0 && <Separator className="my-4" />}
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor={`toggle-${setting.key}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="text-sm font-medium text-foreground">
                      {setting.label}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {setting.description}
                    </div>
                  </label>
                  <Toggle
                    id={`toggle-${setting.key}`}
                    checked={notifications[setting.key]}
                    onChange={() => toggleNotification(setting.key)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ---- Security ---- */}
      <Card className="bg-rc-card border-rc-border">
        <CardHeader>
          <CardTitle className="font-heading">Security</CardTitle>
          <CardDescription>
            Manage your password and authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Change Password */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            <h3 className="text-sm font-semibold text-foreground">
              Change Password
            </h3>
            <p className="text-xs text-muted-foreground">Password management will be available when authentication is connected.</p>

            {/* Current password */}
            <div className="space-y-1.5">
              <label
                htmlFor="current-password"
                className="text-sm font-medium text-foreground"
              >
                Current password
              </label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-rc-steel hover:text-foreground transition-colors p-1"
                  aria-label={
                    showCurrentPassword
                      ? 'Hide current password'
                      : 'Show current password'
                  }
                >
                  {showCurrentPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="text-sm font-medium text-foreground"
              >
                New password
              </label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-rc-steel hover:text-foreground transition-colors p-1"
                  aria-label={
                    showNewPassword
                      ? 'Hide new password'
                      : 'Show new password'
                  }
                >
                  {showNewPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm new password */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirm-password"
                className="text-sm font-medium text-foreground"
              >
                Confirm new password
              </label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-rc-steel hover:text-foreground transition-colors p-1"
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Validation error */}
            {passwordError && (
              <div className="flex items-center gap-2 text-sm text-rc-red">
                <AlertTriangle className="size-4 shrink-0" />
                {passwordError}
              </div>
            )}

            {/* Success message */}
            {passwordSuccess && (
              <div className="flex items-center gap-2 text-sm text-rc-emerald">
                <CheckCircle className="size-4 shrink-0" />
                Password updated successfully.
              </div>
            )}

            <Button
              type="submit"
              className="bg-rc-orange hover:bg-rc-orange-dark text-white"
            >
              Update Password
            </Button>
          </form>

          <Separator />

          {/* Active Sessions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Active Sessions
            </h3>
            <div className="flex items-center gap-4 rounded-lg border border-rc-border p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rc-blue/10">
                <Monitor className="size-5 text-rc-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  Chrome on macOS
                </div>
                <div className="flex items-center gap-1.5 text-xs text-rc-steel">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-rc-emerald opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-rc-emerald" />
                  </span>
                  Denver, CO &mdash; Active now
                </div>
              </div>
              <span className="text-xs font-medium text-rc-emerald">
                Current session
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Danger Zone ---- */}
      <Card className="bg-rc-card border-rc-red/20">
        <CardHeader>
          <CardTitle className="font-heading text-rc-red">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sign out all devices */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">
                Sign out of all devices
              </div>
              <div className="text-sm text-muted-foreground">
                This will end all active sessions except your current one.
              </div>
            </div>
            <Button
              variant="outline"
              className="border-rc-red text-rc-red hover:bg-rc-red/5 shrink-0"
              disabled
              title="Available when authentication is connected"
            >
              Sign Out All Devices
            </Button>
          </div>

          <Separator />

          {/* Delete account */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">
                Delete account
              </div>
              <div className="text-sm text-muted-foreground">
                This action cannot be undone. All your data will be permanently
                removed.
              </div>
            </div>
            <Button
              className="bg-rc-red hover:bg-rc-red/90 text-white shrink-0"
              onClick={() => setShowDeleteWarning(true)}
            >
              Delete Account
            </Button>
          </div>

          {/* Inline delete warning */}
          {showDeleteWarning && (
            <div className="rounded-lg border border-rc-red/20 bg-rc-red/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-rc-red shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    Account deletion is restricted
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Contact your administrator to delete your account. This
                    ensures all project data and records are properly handled.
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteWarning(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
