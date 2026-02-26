'use client';

import { cn } from '@/lib/utils';

interface BudgetTrackerProps {
  planned: number;
  actual: number;
  label?: string;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

export default function BudgetTracker({ planned, actual, label }: BudgetTrackerProps) {
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 120) : 0;
  const ratio = planned > 0 ? actual / planned : 0;

  // green if at or under, amber within 10% over, red if more than 10% over
  const barColor =
    ratio <= 1 ? 'bg-emerald-500' : ratio <= 1.1 ? 'bg-amber-500' : 'bg-red-500';

  const textColor =
    ratio <= 1 ? 'text-emerald-700' : ratio <= 1.1 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="space-y-1">
      {label && (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-semibold', textColor)}>
          {formatCurrency(actual)}
        </span>
        <span className="text-muted-foreground">/ {formatCurrency(planned)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
