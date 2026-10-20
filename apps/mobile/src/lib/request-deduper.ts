export function createRequestDeduper() {
  const inFlight = new Map<string, Promise<void>>();
  return {
    run(key: string, operation: () => Promise<void>, force = false): Promise<void> {
      const existing = inFlight.get(key);
      if (existing && !force) return existing;
      const pending = operation();
      inFlight.set(key, pending);
      void pending.then(
        () => { if (inFlight.get(key) === pending) inFlight.delete(key); },
        () => { if (inFlight.get(key) === pending) inFlight.delete(key); },
      );
      return pending;
    },
  };
}
