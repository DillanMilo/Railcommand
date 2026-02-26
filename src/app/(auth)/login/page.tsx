'use client';

import { useRouter } from 'next/navigation';
import { Train } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-rc-bg p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex items-center justify-center size-12 rounded-xl bg-rc-orange mb-2">
            <Train className="size-7 text-white" />
          </div>
          <CardTitle className="font-heading text-2xl">RailCommand</CardTitle>
          <CardDescription>
            Construction &amp; Rail Project Management
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="mark.sullivan@example.com"
                defaultValue="mark.sullivan@example.com"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                defaultValue="password123"
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
            <p className="text-xs text-amber-800 font-medium">
              Demo Mode -- No real authentication.
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Click Sign In to continue.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
