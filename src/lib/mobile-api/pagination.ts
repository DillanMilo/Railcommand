export const mobilePageDefault = 90;
export const mobilePageMaximum = 100;

export function parseMobilePage(url: URL): { offset: number; limit: number } {
  const parsedOffset = Number(url.searchParams.get('offset') ?? 0);
  const parsedLimit = Number(url.searchParams.get('limit') ?? mobilePageDefault);
  return {
    offset: Number.isSafeInteger(parsedOffset) && parsedOffset >= 0 ? Math.min(parsedOffset, 10_000) : 0,
    limit: Number.isSafeInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, mobilePageMaximum)
      : mobilePageDefault,
  };
}

export function mobilePage<T>(rows: T[] | null, limit: number): { items: T[]; hasMore: boolean } {
  const safeRows = rows ?? [];
  return { items: safeRows.slice(0, limit), hasMore: safeRows.length > limit };
}
