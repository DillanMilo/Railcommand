'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import {
  Camera,
  CheckCircle2,
  LogOut,
  Trash2,
  Building2,
  Shield,
  Users,
  ExternalLink,
  Loader2,
  AlertTriangle,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { Profile, Organization } from '@/lib/types';
import { getProfileWithOrg, updateProfile } from '@/lib/store';
import { getMyProfile, updateMyProfile } from '@/lib/actions/profiles';
import { uploadMyAvatar } from '@/lib/actions/avatar';
import { createClient } from '@/lib/supabase/client';
import { useProject } from '@/components/providers/ProjectProvider';
import { useProjectMembers } from '@/hooks/useData';

const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const AVATAR_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ORG_TYPE_LABELS: Record<string, string> = {
  owner: 'Owner / Client',
  contractor: 'General Contractor',
  engineer: 'Engineering Firm',
  inspector: 'Inspection Agency',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  member: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400',
};

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .refine(
      (val) => val === '' || /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(val),
      { message: 'Enter a valid phone number, e.g. (303) 555-0101' }
    ),
});

type ProfileFormData = z.infer<typeof profileSchema>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatProjectRole(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const router = useRouter();
  const { currentProject, currentProjectId, currentUserId, isDemo } = useProject();
  const [authProfile, setAuthProfile] = useState<(Profile & { organization?: Organization }) | null>(null);
  const [profileLoading, setProfileLoading] = useState(!isDemo);
  const { data: projectMembers } = useProjectMembers(currentProjectId);
  const membership = projectMembers.find((pm) => pm.profile_id === currentUserId);

  // For real auth, fetch profile from Supabase
  useEffect(() => {
    if (isDemo) return;
    setProfileLoading(true);
    getMyProfile().then((result) => {
      if (result.data) setAuthProfile(result.data);
      setProfileLoading(false);
    });
  }, [isDemo]);

  const profile = isDemo ? getProfileWithOrg(currentUserId) : authProfile;

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Avatar upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Password reset state
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
    },
  });

  // Reset form defaults when profile loads
  useEffect(() => {
    if (profile) {
      reset({ fullName: profile.full_name ?? '', phone: profile.phone ?? '' });
      setAvatarUrl(profile.avatar_url ?? '');
    }
  }, [profile, reset]);

  // Revoke any object URL when preview changes/unmounts
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <div className="py-20 text-center text-muted-foreground">Profile not found.</div>;
  }

  async function onSubmit(data: ProfileFormData) {
    setIsSaving(true);
    if (isDemo) {
      await new Promise((r) => setTimeout(r, 600));
      updateProfile(currentUserId, {
        full_name: data.fullName,
        phone: data.phone,
      });
    } else {
      const result = await updateMyProfile({
        full_name: data.fullName,
        phone: data.phone,
      });
      if (result.data) setAuthProfile(result.data);
    }
    setIsSaving(false);
    setSuccessMessage('Profile updated successfully');
    router.refresh();
  }

  async function handleAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear input value so selecting the same file twice still fires change
    if (e.target) e.target.value = '';
    if (!file) return;

    setAvatarError('');

    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      setAvatarError('Please choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (file.size > AVATAR_MAX_SIZE) {
      setAvatarError('Image is too large. Maximum size is 5MB.');
      return;
    }

    // Local preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    if (isDemo) {
      // Demo mode: just show the preview locally, persist to local store
      setAvatarUrl(previewUrl);
      updateProfile(currentUserId, { avatar_url: previewUrl });
      setSuccessMessage('Avatar updated');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadMyAvatar(formData);
      if (result.error || !result.data) {
        setAvatarError(result.error ?? 'Upload failed');
        setAvatarPreview('');
        URL.revokeObjectURL(previewUrl);
      } else {
        setAvatarUrl(result.data.url);
        setAvatarPreview('');
        URL.revokeObjectURL(previewUrl);
        setAuthProfile((prev) => (prev ? { ...prev, avatar_url: result.data!.url } : prev));
        setSuccessMessage('Avatar updated');
        router.refresh();
      }
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed');
      setAvatarPreview('');
      URL.revokeObjectURL(previewUrl);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handlePasswordReset() {
    if (!profile?.email) return;
    setResetError('');
    setIsSendingReset(true);

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 400));
      setIsSendingReset(false);
      setResetSent(true);
      setSuccessMessage('Password reset email sent (demo)');
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings/profile`,
      });
      if (error) {
        setResetError(error.message);
      } else {
        setResetSent(true);
        setSuccessMessage('Password reset email sent');
      }
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsSendingReset(false);
    }
  }

  function handleSignOut() {
    try {
      document.cookie = 'rc-remember=; path=/; max-age=0';
    } catch { /* noop */ }
    router.push('/login');
  }

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Success Banner                                               */}
      {/* ============================================================ */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-rc-emerald/30 bg-rc-emerald/10 px-4 py-3 text-sm font-medium text-rc-emerald animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="size-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Profile Header                                               */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Avatar */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            aria-label="Change avatar"
            className="relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-rc-orange focus-visible:ring-offset-2 disabled:cursor-wait"
          >
            <Avatar className="size-20 bg-rc-navy text-white font-heading text-2xl font-bold">
              {(avatarPreview || avatarUrl) && (
                <AvatarImage
                  src={avatarPreview || avatarUrl}
                  alt={`${profile.full_name} avatar`}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-rc-navy text-white font-heading text-2xl font-bold">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/45 transition-opacity ${
                avatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
              }`}
              aria-hidden="true"
            >
              {avatarUploading ? (
                <Loader2 className="size-5 text-white animate-spin" />
              ) : (
                <Camera className="size-5 text-white" />
              )}
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarSelected}
            aria-label="Upload new avatar image"
          />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold">{profile.full_name}</h1>
            <Badge
              variant="secondary"
              className={ROLE_COLORS[profile.role]}
            >
              {ROLE_LABELS[profile.role]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.organization?.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {profile.email}
          </p>
        </div>

        {/* Change Avatar button (mobile-friendly alternate) */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarUploading}
          className="shrink-0 gap-1.5 text-xs min-h-[44px] sm:min-h-0"
          aria-label="Change avatar"
        >
          {avatarUploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Camera className="size-3.5" />
          )}
          {avatarUploading ? 'Uploading...' : 'Change Avatar'}
        </Button>
      </div>

      {avatarError && (
        <div
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{avatarError}</span>
        </div>
      )}

      <Separator />

      {/* ============================================================ */}
      {/*  Personal Information Card                                    */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Personal Information</CardTitle>
          <CardDescription>Update your name and contact details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Full Name */}
            <div className="space-y-2">
              <label htmlFor="profile-name" className="text-sm font-medium">
                Full Name
              </label>
              <Input
                id="profile-name"
                type="text"
                placeholder="Your full name"
                aria-invalid={!!errors.fullName}
                className={errors.fullName ? 'border-destructive' : ''}
                {...register('fullName')}
              />
              {errors.fullName && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <label htmlFor="profile-email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="profile-email"
                type="email"
                value={profile.email}
                readOnly
                disabled
                className="opacity-60 cursor-not-allowed"
                aria-label="Email address (read-only)"
              />
              <p className="text-xs text-muted-foreground">
                Email is managed by your sign-in provider. Contact support@railcommand.com to change it.
              </p>
            </div>

            {/* Role (read-only) */}
            <div className="space-y-2">
              <label htmlFor="profile-role" className="text-sm font-medium">
                Organization Role
              </label>
              <Input
                id="profile-role"
                type="text"
                value={ROLE_LABELS[profile.role] ?? profile.role}
                readOnly
                disabled
                className="opacity-60 cursor-not-allowed"
                aria-label="Organization role (read-only)"
              />
              <p className="text-xs text-muted-foreground">
                Your role is managed at the organization level. Contact an admin to change it.
              </p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label htmlFor="profile-phone" className="text-sm font-medium">
                Phone Number
              </label>
              <Input
                id="profile-phone"
                type="tel"
                placeholder="(303) 555-0101"
                aria-invalid={!!errors.phone}
                className={errors.phone ? 'border-destructive' : ''}
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSaving || !isDirty}
                className="bg-rc-orange hover:bg-rc-orange-dark text-white min-w-[140px] w-full sm:w-auto"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Organization Details Card                                    */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-muted-foreground" />
            <CardTitle className="font-heading text-lg">Organization</CardTitle>
          </div>
          <CardDescription>Your organization membership details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Organization
              </p>
              <p className="text-sm font-semibold">{profile.organization?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Type
              </p>
              <p className="text-sm font-semibold">
                {ORG_TYPE_LABELS[profile.organization?.type ?? ''] ?? profile.organization?.type}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Member Since
              </p>
              <p className="text-sm font-semibold">
                {format(parseISO(profile.created_at), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Project Membership Card                                      */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-muted-foreground" />
            <CardTitle className="font-heading text-lg">Project Membership</CardTitle>
          </div>
          <CardDescription>Your current project assignment and access level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-rc-border bg-muted/30 dark:bg-muted/10 p-4 space-y-4">
            {/* Project name */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Current Project
              </p>
              <p className="text-sm font-semibold">{currentProject?.name ?? 'No project selected'}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Project role */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Project Role
                </p>
                <p className="text-sm font-semibold">
                  {membership ? formatProjectRole(membership.project_role) : 'N/A'}
                </p>
              </div>

              {/* Access level */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Access Level
                </p>
                <p className="text-sm font-semibold">
                  {profile.role === 'admin'
                    ? 'Full Access (Admin)'
                    : membership?.can_edit
                      ? 'Edit Access'
                      : 'View Only'}
                </p>
              </div>
            </div>

            {/* Link to team page */}
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-1.5 text-xs"
              >
                <Link href={`/projects/${currentProjectId}/team`}>
                  <Users className="size-3.5" />
                  View Project Team
                  <ExternalLink className="size-3" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Security                                                     */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-muted-foreground" />
            <CardTitle className="font-heading text-lg">Security</CardTitle>
          </div>
          <CardDescription>
            Reset your password. We&apos;ll email a secure link to {profile.email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePasswordReset}
                disabled={isSendingReset || resetSent}
                className="gap-2 min-h-[44px] sm:min-h-0"
                aria-label="Send password reset email"
              >
                {isSendingReset ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : resetSent ? (
                  <>
                    <CheckCircle2 className="size-4 text-rc-emerald" />
                    Email sent
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    Send Password Reset Email
                  </>
                )}
              </Button>
              {resetSent && (
                <p className="text-xs text-muted-foreground">
                  Check your inbox for the reset link. It expires in 1 hour.
                </p>
              )}
            </div>
            {resetError && (
              <p className="text-xs text-destructive" role="alert">
                {resetError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Account Actions                                              */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Account Actions</CardTitle>
          <CardDescription>Sign out or manage your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="destructive"
              onClick={handleSignOut}
              className="gap-2 min-h-[44px] sm:min-h-0"
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/40 min-h-[44px] sm:min-h-0"
            >
              <Trash2 className="size-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Delete Account Confirmation Dialog                           */}
      {/* ============================================================ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              Account deletion requires manual processing for data safety.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-rc-border bg-muted/40 dark:bg-muted/15 p-4 text-sm text-muted-foreground leading-relaxed">
            To delete your account and all associated data, please contact support
            at{' '}
            <span className="font-medium text-foreground">support@railcommand.com</span>{' '}
            or reach out to your organization administrator. This ensures all project
            data is properly transferred or archived before removal.
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
