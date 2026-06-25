'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Train, Lock, Users, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TeamLogin {
  display_name: string;
  email: string;
  project_role: string;
}

interface DemoData {
  slug: string;
  company_name: string;
  is_team_demo: boolean;
  project_id: string;
  demo_user_email: string;
  team_logins: TeamLogin[];
}

const DEMO_DISPLAY_NAMES: Record<string, string> = {
  'mark.allen@a5rail.com': 'Mark Allen',
  'caleb@lenaserv.com': 'Caleb Douglas',
  'dillan@creativecurrents.io': 'Dillan Milosevich',
  'kayleigh-demo@railcommand.io': 'Union Pacific',
};

function getDemoDisplayName(email: string, fallback: string) {
  return DEMO_DISPLAY_NAMES[email.toLowerCase()] ?? fallback;
}

export default function DemoEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [demoData, setDemoData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDemo() {
      try {
        const res = await fetch(`/api/admin/demo/lookup?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) {
          setError('Demo not found or has expired.');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setDemoData(data);
      } catch {
        setError('Failed to load demo.');
      }
      setLoading(false);
    }
    loadDemo();
  }, [slug]);

  const handleLogin = useCallback(async (email: string) => {
    setAuthLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/demo/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email }),
      });

      if (!res.ok) {
        setError('Login failed. Please try again.');
        setAuthLoading(false);
        return;
      }

      // Clear any old client-side demo mode
      localStorage.removeItem('rc-mode');

      // Track access
      await fetch(`/api/admin/demo/track?slug=${encodeURIComponent(slug)}`, { method: 'POST' });

      // Redirect to main dashboard (project context is set by ProjectProvider)
      router.push('/dashboard');
    } catch {
      setError('Authentication failed. Please try again.');
      setAuthLoading(false);
    }
  }, [router, slug]);

  useEffect(() => {
    if (demoData && !demoData.is_team_demo && !authLoading) {
      handleLogin(demoData.demo_user_email);
    }
  }, [authLoading, demoData, handleLogin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-rc-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="size-8 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading demo...</p>
        </div>
      </div>
    );
  }

  if (error && !demoData) {
    return (
      <div className="min-h-screen bg-rc-bg flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="size-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-bold">Demo Not Found</h1>
            <p className="text-muted-foreground">
              This demo link is invalid or has expired. Contact your RailCommand representative for a new link.
            </p>
            <Button asChild variant="outline">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!demoData) return null;

  // Single-user demo: auto-login immediately
  if (!demoData.is_team_demo) {
    return (
      <div className="min-h-screen bg-rc-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Train className="size-10 text-rc-orange animate-pulse" />
          <p className="text-lg font-medium">Entering {demoData.company_name} Demo...</p>
          <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  // Team demo: show role picker
  const allLogins = [
    {
      display_name: getDemoDisplayName(
        demoData.demo_user_email,
        demoData.demo_user_email.split('@')[0].replace('-demo', '').replace(/^\w/, (c: string) => c.toUpperCase())
      ),
      email: demoData.demo_user_email,
      project_role: 'manager',
    },
    ...demoData.team_logins.map((login) => ({
      ...login,
      display_name: getDemoDisplayName(login.email, login.display_name),
    })),
  ];

  return (
    <div className="min-h-screen bg-rc-bg flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Train className="size-8 text-rc-orange" />
            <h1 className="text-3xl font-heading font-bold">RailCommand</h1>
          </div>
          <p className="text-muted-foreground">
            {demoData.company_name} — Team Demo
          </p>
          <Badge variant="outline" className="text-rc-orange border-rc-orange">
            <Lock className="size-3 mr-1" /> Demo Environment
          </Badge>
        </div>

        {/* Role picker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Choose Your Role
            </CardTitle>
            <CardDescription>
              Each role has different permissions — pick one to explore the app from that perspective.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {allLogins.map((login) => (
              <button
                key={login.email}
                onClick={() => handleLogin(login.email)}
                disabled={authLoading}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-rc-border hover:border-rc-orange hover:bg-rc-orange/5 transition-colors text-left disabled:opacity-50"
              >
                <div>
                  <p className="font-medium">{login.display_name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{login.project_role.replace('_', ' ')}</p>
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 text-sm text-center">
            {error}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          This is a demo environment with sample data. All changes are isolated to this demo.
        </p>
      </div>
    </div>
  );
}
