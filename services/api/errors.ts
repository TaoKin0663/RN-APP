export type ApiErrorKind = 'HTTP_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT' | 'ABORTED' | 'PARSE_ERROR';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  url: string;
  requestId?: string;
  data?: unknown;
  cause?: unknown;

  constructor(params: {
    message: string;
    kind: ApiErrorKind;
    status: number;
    url: string;
    requestId?: string;
    data?: unknown;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.kind = params.kind;
    this.status = params.status;
    this.url = params.url;
    this.requestId = params.requestId;
    this.data = params.data;
    this.cause = params.cause;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError || (typeof e === 'object' && e !== null && (e as any).name === 'ApiError');
}


