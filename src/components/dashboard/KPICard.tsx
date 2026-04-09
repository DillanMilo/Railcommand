import Link from 'next/link';
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
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
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
  href,
  onClick,
  ariaLabel,
}: KPICardProps) {
  const iconClasses = colorMap[color] ?? colorMap.navy;
  const isInteractive = Boolean(href || onClick);

  const cardElement = (
    <Card
      className={cn(
        'gap-0 py-3 sm:py-4',
        isInteractive &&
          'cursor-pointer transition-all duration-150 [@media(hover:hover)]:hover:border-rc-orange/50 [@media(hover:hover)]:hover:shadow-md [@media(hover:hover)]:hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm active:bg-rc-orange/5'
      )}
    >
      <CardContent className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4">
        <div className={cn('flex shrink-0 items-center justify-center rounded-lg p-2 sm:p-2.5', iconClasses)}>
          <Icon className="size-4 sm:size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg sm:text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
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
        <div className="px-3 sm:px-4 pt-1">
          <p className="text-xs text-rc-steel truncate">{subtitle}</p>
        </div>
      )}
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? `View ${title}`}
        className="block min-h-[44px] rounded-xl [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-orange focus-visible:ring-offset-2"
      >
        {cardElement}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? `View ${title}`}
        className="block w-full min-h-[44px] text-left rounded-xl [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-orange focus-visible:ring-offset-2"
      >
        {cardElement}
      </button>
    );
  }

  return cardElement;
}
