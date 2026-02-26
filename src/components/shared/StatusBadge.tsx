import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/constants';

interface StatusBadgeProps {
  status: string;
  type?: 'submittal' | 'rfi' | 'punch_list' | 'milestone';
}

const COLOR_MAP_KEY: Record<string, keyof typeof STATUS_COLORS> = {
  submittal: 'submittal',
  rfi: 'rfi',
  punch_list: 'punchList',
  milestone: 'milestone',
};

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, type = 'submittal' }: StatusBadgeProps) {
  const colorMapKey = COLOR_MAP_KEY[type] ?? 'submittal';
  const colorMap = STATUS_COLORS[colorMapKey];
  const colorClasses = colorMap[status] ?? 'bg-gray-100 text-gray-700';

  return (
    <Badge
      variant="secondary"
      className={cn('border-0 font-medium', colorClasses)}
    >
      {formatStatus(status)}
    </Badge>
  );
}
