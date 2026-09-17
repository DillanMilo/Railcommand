import type {
  MobileBootstrap,
  MobileAccountDeletionRequest,
  MobileAccountDeletionResult,
  MobileDailyLogPhotoFinalizeResult,
  MobileDailyLogPhotoPrepareResult,
  MobileDailyLogPhotoSyncOperation,
  MobileDailyLogSyncOperation,
  MobileDailyLogSyncResult,
  MobileEarthCamEmbed,
  MobileEarthCamEmbedDeleteInput,
  MobileEarthCamEmbedDeleteResult,
  MobileEarthCamEmbedInput,
  MobilePushRegistration,
  MobileInvitation,
  MobilePdfReport,
  MobilePdfReportRequest,
  MobileRecordScope,
  MobileRecordDetail,
  MobileRecordAttachmentLink,
  MobileRecordDraft,
  MobileRecordCreateResult,
  MobileRecordFormOptions,
  MobileRecordKind,
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
  refreshAccessToken?: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
  onRequestMetric?: (metric: MobileRequestMetric) => void;
}

export interface MobileRequestMetric {
  operation: 'bootstrap' | 'record-detail' | 'record-attachment' | 'mobile-api';
  status: number;
  approximateTransferredBytes: number;
}

export interface MobilePageRequest {
  offset?: number;
  limit?: number;
}

export class MobileApiClient {
  private readonly baseUrl: URL;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly refreshAccessToken?: () => Promise<string | null>;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly onRequestMetric?: (metric: MobileRequestMetric) => void;
  private readonly inFlightGets = new Map<string, Promise<unknown>>();

  getRecordFormOptions(kind: MobileRecordKind, projectId: string): Promise<MobileRecordFormOptions> {
    return this.request(`/api/mobile/v1/records/options?${new URLSearchParams({ kind, projectId })}`);
  }

  createRecord(draft: MobileRecordDraft): Promise<MobileRecordCreateResult> {
    return this.request('/api/mobile/v1/records/create', {
      method: 'POST', headers: { 'Idempotency-Key': draft.clientId }, body: JSON.stringify(draft),
    });
  }

  constructor(options: MobileApiClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    if (this.baseUrl.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(this.baseUrl.hostname)) {
      throw new Error('The mobile API must use HTTPS');
    }
    this.getAccessToken = options.getAccessToken;
    this.refreshAccessToken = options.refreshAccessToken;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.onRequestMetric = options.onRequestMetric;
  }

  private operation(path: string): MobileRequestMetric['operation'] {
    if (path.startsWith('/api/mobile/v1/bootstrap')) return 'bootstrap';
    if (path.startsWith('/api/mobile/v1/records/detail')) return 'record-detail';
    if (path.startsWith('/api/mobile/v1/records/attachment')) return 'record-attachment';
    return 'mobile-api';
  }

  private request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase();
    const dedupeKey = method === 'GET' ? path : null;
    const existing = dedupeKey ? this.inFlightGets.get(dedupeKey) : null;
    if (existing) return existing as Promise<T>;
    const pending = this.executeRequest<T>(path, init);
    if (dedupeKey) {
      this.inFlightGets.set(dedupeKey, pending);
      void pending.then(
        () => { if (this.inFlightGets.get(dedupeKey) === pending) this.inFlightGets.delete(dedupeKey); },
        () => { if (this.inFlightGets.get(dedupeKey) === pending) this.inFlightGets.delete(dedupeKey); },
      );
    }
    return pending;
  }

  private async executeRequest<T>(path: string, init: RequestInit): Promise<T> {
    let accessToken = await this.getAccessToken();
    if (!accessToken) throw new MobileApiError('Not authenticated', 401, false);
    const requestBytes = typeof init.body === 'string' ? new TextEncoder().encode(init.body).length : 0;
    const execute = async (token: string) => {
      const response = await this.fetcher(new URL(path, this.baseUrl), {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
      const rawBody = await response.text();
      this.onRequestMetric?.({
        operation: this.operation(path),
        status: response.status,
        approximateTransferredBytes: requestBytes + new TextEncoder().encode(rawBody).length,
      });
      return { response, rawBody };
    };
    let attempt = await execute(accessToken);
    let { response, rawBody } = attempt;
    if (response.status === 401 && this.refreshAccessToken) {
      const refreshedToken = await this.refreshAccessToken();
      if (refreshedToken) {
        accessToken = refreshedToken;
        attempt = await execute(accessToken);
        response = attempt.response;
        rawBody = attempt.rawBody;
      }
    }
    let parsed: unknown = {};
    try { parsed = rawBody ? JSON.parse(rawBody) : {}; } catch { /* Preserve the existing safe empty-body behavior. */ }
    const body = parsed as { error?: string } & T;
    if (!response.ok) {
      throw new MobileApiError(
        body.error ?? `Mobile API request failed (${response.status})`,
        response.status,
        response.status >= 500 || response.status === 408 || response.status === 429,
      );
    }
    return body;
  }

  createWorkspaceSession(path: string): Promise<{ ticket: string; userId: string }> {
    return this.request('/api/mobile/v1/web-session', { method: 'POST', body: JSON.stringify({ path }) });
  }

  getBootstrap(projectId?: string, page: MobilePageRequest = {}): Promise<MobileBootstrap> {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (page.offset !== undefined) params.set('offset', String(page.offset));
    if (page.limit !== undefined) params.set('limit', String(page.limit));
    const query = params.size ? `?${params}` : '';
    return this.request<MobileBootstrap>(`/api/mobile/v1/bootstrap${query}`);
  }

  exportPdfReport(input: MobilePdfReportRequest): Promise<MobilePdfReport> {
    return this.request('/api/mobile/v1/reports/pdf', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getRecordDetail(scope: MobileRecordScope): Promise<MobileRecordDetail> {
    const query = new URLSearchParams({ ...scope });
    return this.request(`/api/mobile/v1/records/detail?${query}`);
  }

  getRecordAttachment(scope: MobileRecordScope, attachmentId: string): Promise<MobileRecordAttachmentLink> {
    const query = new URLSearchParams({ ...scope, attachmentId });
    return this.request(`/api/mobile/v1/records/attachment?${query}`);
  }

  saveEarthCamEmbed(input: MobileEarthCamEmbedInput): Promise<MobileEarthCamEmbed> {
    return this.request<MobileEarthCamEmbed>('/api/mobile/v1/earthcam/embeds', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  deleteEarthCamEmbed(input: MobileEarthCamEmbedDeleteInput): Promise<MobileEarthCamEmbedDeleteResult> {
    return this.request<MobileEarthCamEmbedDeleteResult>('/api/mobile/v1/earthcam/embeds/delete', {
      method: 'POST',
      body: JSON.stringify(input),
    });
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

  registerPushDevice(registration: MobilePushRegistration): Promise<{ registered: true }> {
    return this.request('/api/mobile/v1/devices/push-token', {
      method: 'POST',
      body: JSON.stringify(registration),
    });
  }

  requestAccountDeletion(request: MobileAccountDeletionRequest): Promise<MobileAccountDeletionResult> {
    return this.request('/api/mobile/v1/account/deletion-request', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  getAccountDeletionRequest(): Promise<MobileAccountDeletionResult | null> {
    return this.request('/api/mobile/v1/account/deletion-request');
  }

  cancelAccountDeletion(requestId: string): Promise<MobileAccountDeletionResult> {
    return this.request('/api/mobile/v1/account/deletion-request/cancel', {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    });
  }

  getInvitation(token: string): Promise<MobileInvitation> {
    return this.request(`/api/mobile/v1/invitations/${encodeURIComponent(token)}`);
  }

  acceptInvitation(token: string): Promise<{ projectId: string }> {
    return this.request(`/api/mobile/v1/invitations/${encodeURIComponent(token)}`, { method: 'POST' });
  }
}
