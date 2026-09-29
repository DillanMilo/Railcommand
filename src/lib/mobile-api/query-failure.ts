// Status-only classification: never return database messages or private row data.
export type MobileQueryResult = { status: number; error: { code?: string } | null };

export function mobileQueryFailed(result: MobileQueryResult): boolean {
  return Boolean(result.error) || result.status < 200 || result.status >= 300;
}

export function mobileQueryFailureStatus(results: MobileQueryResult[]): 401 | 403 | 500 | null {
  const failures = results.filter(mobileQueryFailed);
  if (!failures.length) return null;
  if (failures.some((result) => result.status === 401 || /^PGRST30[1-3]$/.test(result.error?.code ?? ''))) return 401;
  if (failures.some((result) => result.status === 403 || result.error?.code === '42501')) return 403;
  return 500;
}
