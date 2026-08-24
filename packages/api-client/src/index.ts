import type {
  MobileBootstrap,
  MobileDailyLogPhotoFinalizeResult,
  MobileDailyLogPhotoPrepareResult,
  MobileDailyLogPhotoSyncOperation,
  MobileDailyLogSyncOperation,
  MobileDailyLogSyncResult,
} from '@railcommand/domain';

export class MobileApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface MobileApiClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
}

export class MobileApiClient {
  private readonly baseUrl: URL;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: MobileApiClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    if (this.baseUrl.protocol !== 'https:' && this.baseUrl.hostname !== 'localhost') {
      throw new Error('The mobile API must use HTTPS');
    }
    this.getAccessToken = options.getAccessToken;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) throw new MobileApiError('Not authenticated', 401, false);
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const body = await response.json().catch(() => ({})) as { error?: string } & T;
    if (!response.ok) {
      throw new MobileApiError(
        body.error ?? `Mobile API request failed (${response.status})`,
        response.status,
        response.status >= 500 || response.status === 408 || response.status === 429,
      );
    }
    return body;
  }

  getBootstrap(projectId?: string): Promise<MobileBootstrap> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.request<MobileBootstrap>(`/api/mobile/v1/bootstrap${query}`);
  }

  syncDailyLog(operation: MobileDailyLogSyncOperation): Promise<MobileDailyLogSyncResult> {
    return this.request<MobileDailyLogSyncResult>('/api/mobile/v1/daily-logs/sync', {
      method: 'POST',
      body: JSON.stringify(operation),
    });
  }

  prepareDailyLogPhoto(
    operation: MobileDailyLogPhotoSyncOperation,
  ): Promise<MobileDailyLogPhotoPrepareResult> {
    return this.request<MobileDailyLogPhotoPrepareResult>('/api/mobile/v1/daily-logs/photos/prepare', {
      method: 'POST',
      body: JSON.stringify(operation),
    });
  }

  finalizeDailyLogPhoto(
    operation: MobileDailyLogPhotoSyncOperation,
    storage: Pick<MobileDailyLogPhotoPrepareResult, 'bucket' | 'path'>,
  ): Promise<MobileDailyLogPhotoFinalizeResult> {
    return this.request<MobileDailyLogPhotoFinalizeResult>('/api/mobile/v1/daily-logs/photos/finalize', {
      method: 'POST',
      body: JSON.stringify({ operation, storage }),
    });
  }
}
