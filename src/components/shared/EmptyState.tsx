import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-16 px-4 text-center">
      <div className="flex items-center justify-center size-12 sm:size-16 rounded-full bg-rc-border/50 mb-4 sm:mb-6">
        <Icon className="size-6 sm:size-8 text-rc-steel" />
      </div>

      <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      <p className="text-sm text-rc-steel max-w-sm mb-4 sm:mb-6">
        {description}
      </p>

      {actionLabel && actionHref && (
        <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
