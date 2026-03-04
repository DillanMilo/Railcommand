'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Train, Building2, ArrowRight } from 'lucide-react';
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

/* ------------------------------------------------------------------ */
/*  Inner form (needs useSearchParams, so wrapped in Suspense)         */
/* ------------------------------------------------------------------ */

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [type, setType] = useState<Organization['type'] | ''>('');
  const [role, setRole] = useState<Profile['role'] | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !type || !role) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await setupBusiness(name.trim(), type as Organization['type'], role as Profile['role']);

        if (result.error) {
          setError(result.error);
          setIsLoading(false);
          return;
        }

        // Mark onboarding as complete
        document.cookie =
          'rc-onboarded=true; path=/; max-age=2592000; SameSite=Lax';

        // Redirect to next page or dashboard
        const next = searchParams.get('next') || '/dashboard';
        router.push(next);
      } catch {
        setError('Something went wrong. Please try again.');
        setIsLoading(false);
      }
    },
    [name, type, role, searchParams, router],
  );

  return (
    <div className="w-full max-w-[420px]">
      {/* Branding */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="flex items-center justify-center size-10 rounded-xl bg-rc-orange shadow-lg shadow-rc-orange/20">
          <Train className="size-5 text-white" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground tracking-tight">
            RailCommand
          </h1>
          <p className="text-[10px] text-muted-foreground/60 tracking-wide uppercase">
            by A5 Rail
          </p>
        </div>
      </div>

      {/* Heading */}
      <div className="mb-6 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Set up your business
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us about your company to get started.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
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

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading || !name.trim() || !type || !role}
          className="w-full h-12 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold text-sm gap-2"
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
      <OnboardingForm />
    </Suspense>
  );
}
