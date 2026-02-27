import Link from 'next/link';
import { HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROJECT_NAME } from '@/lib/constants';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-rc-bg px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rc-border/50 mb-6">
          <HardHat className="h-8 w-8 text-rc-steel" />
        </div>

        <p className="text-sm font-semibold text-rc-orange mb-1 tracking-wide uppercase">
          {PROJECT_NAME}
        </p>

        <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
          404
        </h1>

        <p className="text-lg text-foreground font-medium mb-1">
          Page not found
        </p>

        <p className="text-sm text-rc-steel mb-8">
          The page you are looking for does not exist or has been moved.
        </p>

        <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
