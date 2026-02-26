import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const PRIORITY_CONFIG: Record<
  PriorityBadgeProps['priority'],
  { label: string; dot: string; badge: string }
> = {
  critical: {
    label: 'Critical',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
  },
  high: {
    label: 'High',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700',
  },
  medium: {
    label: 'Medium',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  low: {
    label: 'Low',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
};

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <Badge
      variant="secondary"
      className={cn('border-0 gap-1.5 font-medium', config.badge)}
    >
      <span className={cn('size-2 rounded-full shrink-0', config.dot)} />
      {config.label}
    </Badge>
  );
}
