import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: string;
}

const colorMap: Record<string, string> = {
  orange: 'bg-rc-orange/10 text-rc-orange',
  emerald: 'bg-rc-emerald/10 text-rc-emerald',
  amber: 'bg-rc-amber/10 text-rc-amber',
  red: 'bg-rc-red/10 text-rc-red',
  blue: 'bg-rc-blue/10 text-rc-blue',
  navy: 'bg-primary/10 text-primary',
  steel: 'bg-rc-steel/10 text-rc-steel',
};

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'navy',
}: KPICardProps) {
  const iconClasses = colorMap[color] ?? colorMap.navy;

  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <div className={cn('flex shrink-0 items-center justify-center rounded-lg p-2.5', iconClasses)}>
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-heading text-2xl font-bold leading-tight">{value}</p>
          <p className="text-sm text-rc-steel truncate">{title}</p>
          {trend && trendValue && (
            <div
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium mt-0.5',
                trend === 'up' && 'text-rc-emerald',
                trend === 'down' && 'text-rc-red',
                trend === 'flat' && 'text-rc-steel'
              )}
            >
              {trend === 'up' && <TrendingUp className="size-3.5" />}
              {trend === 'down' && <TrendingDown className="size-3.5" />}
              {trend === 'flat' && <Minus className="size-3.5" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
      </CardContent>

      {subtitle && (
        <div className="px-4 pt-1">
          <p className="text-xs text-rc-steel">{subtitle}</p>
        </div>
      )}
    </Card>
  );
}
