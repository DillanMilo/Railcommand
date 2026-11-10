import type { MobileRequestMetric } from '@railcommand/api-client';

const totals = new Map<MobileRequestMetric['operation'], { requests: number; bytes: number }>();

/** Development-only, payload-free request accounting for egress investigation. */
export function recordMobileRequestMetric(metric: MobileRequestMetric): void {
  if (!__DEV__) return;
  const current = totals.get(metric.operation) ?? { requests: 0, bytes: 0 };
  const next = {
    requests: current.requests + 1,
    bytes: current.bytes + Math.max(0, Math.round(metric.approximateTransferredBytes)),
  };
  totals.set(metric.operation, next);
  console.info(`[RailCommand network] ${metric.operation}: ${next.requests} request(s), ~${next.bytes} bytes`);
}
