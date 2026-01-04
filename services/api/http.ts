import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

import { ApiError } from '@/services/api/errors';

type TokenProvider = () => Promise<string | undefined> | string | undefined;
let tokenProvider: TokenProvider | undefined;

export function setApiTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export type RequestOptions = {
  auth?: boolean;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

type InternalRequestConfig = AxiosRequestConfig & {
  auth?: boolean;
  timeoutMs?: number;
};

const instances: Map<string, AxiosInstance> = new Map();

function getInstance(baseURL: string): AxiosInstance {
  const existing = instances.get(baseURL);
  if (existing) return existing;

  const ins = axios.create({
    baseURL,
    timeout: 15_000,
  });

  ins.interceptors.request.use(async (config) => {
    const cfg = config as InternalRequestConfig;
    // 如果显式设置 auth: false，则不添加 token
    if (cfg.auth === false) return config;
    
    // 默认自动添加 token（如果存在）
    if (!tokenProvider) return config;

    const token = await tokenProvider();
    if (!token) return config;

    config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });

  ins.interceptors.response.use(
    (res) => res,
    (err: AxiosError) => {
      const url = (err.config?.baseURL ?? '') + (err.config?.url ?? '');
      const requestId =
        (err.response?.headers?.['x-request-id'] as string | undefined) ??
        (err.response?.headers?.['x-correlation-id'] as string | undefined);

      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '');
      if (isTimeout) {
        throw new ApiError({
          kind: 'TIMEOUT',
          status: 0,
          url,
          requestId,
          data: undefined,
          message: '请求超时',
          cause: err,
        });
      }

      if (err.response) {
        throw new ApiError({
          kind: 'HTTP_ERROR',
          status: err.response.status,
          url,
          requestId,
          data: err.response.data,
          message: `HTTP ${err.response.status} ${err.response.statusText || ''}`.trim(),
          cause: err,
        });
      }

      throw new ApiError({
        kind: 'NETWORK_ERROR',
        status: 0,
        url,
        requestId,
        data: undefined,
        message: '网络请求失败（请检查网络/域名/证书/代理）',
        cause: err,
      });
    },
  );

  instances.set(baseURL, ins);
  return ins;
}

async function request<T = unknown>(
  baseURL: string,
  config: AxiosRequestConfig,
  options?: RequestOptions,
): Promise<T> {
  const ins = getInstance(baseURL);

  const timeout = options?.timeoutMs ?? 15_000;
  // auth 选项：true 表示需要 token，false 表示不需要 token，undefined 表示默认（自动添加如果有）
  const auth = options?.auth;

  const res = await ins.request<T>({
    ...config,
    timeout,
    headers: {
      ...(config.headers ?? {}),
      ...(options?.headers ?? {}),
    },
    // 传给 interceptor（传递 auth 选项，即使是 undefined 也传递，让 interceptor 知道使用默认行为）
    auth: auth,
  } as any);

  return res.data;
}

/**
 * API 客户端类，绑定到特定的域名
 */
export class ApiClient {
  constructor(private baseURL: string) {}

  /**
   * GET 请求
   * @param url 请求路径
   * @param params 查询参数
   * @param options 请求选项
   */
  async get<T = unknown>(
    url: string,
    params?: Record<string, any>,
    options?: RequestOptions,
  ): Promise<T> {
    return request<T>(
      this.baseURL,
      {
        method: 'GET',
        url,
        params,
      },
      options,
    );
  }

  /**
   * POST 请求
   * @param url 请求路径
   * @param data 请求体数据
   * @param options 请求选项
   */
  async post<T = unknown>(
    url: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return request<T>(
      this.baseURL,
      {
        method: 'POST',
        url,
        data,
      },
      options,
    );
  }

  /**
   * PUT 请求
   * @param url 请求路径
   * @param data 请求体数据
   * @param options 请求选项
   */
  async put<T = unknown>(
    url: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return request<T>(
      this.baseURL,
      {
        method: 'PUT',
        url,
        data,
      },
      options,
    );
  }

  /**
   * DELETE 请求
   * @param url 请求路径
   * @param options 请求选项
   */
  async del<T = unknown>(
    url: string,
    options?: RequestOptions,
  ): Promise<T> {
    return request<T>(
      this.baseURL,
      {
        method: 'DELETE',
        url,
      },
      options,
    );
  }
}

/**
 * 创建指定域名的 API 客户端实例
 * @param baseURL API 基础域名
 */
export function createApiClient(baseURL: string): ApiClient {
  return new ApiClient(baseURL);
}

// 导出常用服务实例
export const defaultApi = createApiClient('http://192.168.31.20:3000');
// export const outletsApi = createApiClient('https://www.outletsrwa.com');


