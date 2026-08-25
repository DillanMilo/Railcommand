export interface ErrorContext {
  area: 'auth' | 'bootstrap' | 'device' | 'offline' | 'sync';
  operation?: string;
}

export interface MobileErrorReporter {
  capture(error: unknown, context: ErrorContext): void;
}

// Phase 2 privacy selection: no external crash or error upload. This adapter is
// intentionally local-only until the documented privacy inventory is approved.
export const errorReporter: MobileErrorReporter = {
  capture(error, context) {
    if (!import.meta.env.DEV) return;
    const safeMessage = error instanceof Error ? error.message : 'Unknown mobile error';
    console.error(`[${context.area}] ${context.operation ?? 'operation'}`, safeMessage);
  },
};
