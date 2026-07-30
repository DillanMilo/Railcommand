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
  orange: 'text-rc-orange',
  emerald: 'text-rc-emerald',
  amber: 'text-rc-amber',
  red: 'text-rc-red',
  blue: 'text-rc-blue',
  navy: 'text-foreground',
  steel: 'text-rc-steel',
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
        'min-h-[148px] gap-0 py-0',
        isInteractive &&
          'cursor-pointer transition-all duration-150 [@media(hover:hover)]:hover:border-rc-orange [@media(hover:hover)]:hover:shadow-[3px_3px_0_var(--rc-orange)] active:translate-x-px active:translate-y-px active:bg-rc-orange/5'
      )}
    >
      <CardContent className="flex h-full flex-1 flex-col px-3 py-3.5 sm:px-4 sm:py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-[9px]">
            {title}
          </p>
          <Icon className={cn('size-4 shrink-0 sm:size-[18px]', iconClasses)} />
        </div>

        <div className="mt-4 min-w-0 flex-1">
          <p className="font-heading text-2xl font-semibold leading-none tracking-[-0.05em] sm:text-[28px]">{value}</p>
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

        {subtitle && (
          <p className="mt-3 truncate text-[10px] text-rc-steel sm:text-xs">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? `View ${title}`}
        className="block min-h-[44px] rounded-sm [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-orange focus-visible:ring-offset-2"
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
        className="block min-h-[44px] w-full rounded-sm text-left [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-orange focus-visible:ring-offset-2"
      >
        {cardElement}
      </button>
    );
  }

  return cardElement;
}
