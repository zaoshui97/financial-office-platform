/**
 * Axios 请求封装
 *
 * 设计要点（Phase 1 接真实后端 /api/v1）：
 * 1) baseURL 默认 /api/v1，dev 走 Vite proxy 透传，prod 走 Nginx 反代。
 * 2) 拦截器只做：注入 Authorization、统一处理 FastAPI 的 HTTPException 错误。
 *    **不再** 解 {code, message, data} 的伪包装，因为真实后端直接返回业务对象。
 * 3) Token 由 zustand persist 统一管理（key=`auth-storage`），避免散落在多处。
 * 4) 401 跳 /login 时携带 from，方便登录成功后跳回。
 */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';

const AUTH_STORAGE_KEY = 'auth-storage';
const LEGACY_TOKEN_KEYS = ['token', 'mock_token', 'mock-token'];

const getAccessToken = (): string | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token?.access_token ?? null;
  } catch {
    return null;
  }
};

const cleanupLegacyToken = (): void => {
  for (const key of LEGACY_TOKEN_KEYS) {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
    }
  }
};

cleanupLegacyToken();

const createRequest = () => {
  const instance: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: 注入 Bearer Token
  instance.interceptors.request.use(
    (config) => {
      const token = getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor: 统一错误处理（FastAPI 用 HTTPException 抛错，detail 是字符串）
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError<{ detail?: string | { msg?: string }[] }>) => {
      if (error.response) {
        const { status, data, config } = error.response;
        const detailText =
          typeof data?.detail === 'string'
            ? data.detail
            : Array.isArray((data?.detail as any))
              ? (data?.detail as any[]).map((d) => d?.msg).filter(Boolean).join('；')
              : '';

        switch (status) {
          case 400:
            message.error(detailText || '请求参数错误');
            break;
          case 401:
            // 不要在这里清 token——留给业务层决定。避免别处刷新 token 时被覆盖。
            message.error(detailText || '登录已过期，请重新登录');
            if (typeof window !== 'undefined') {
              const here = window.location.pathname + window.location.search;
              if (!window.location.pathname.startsWith('/login')) {
                window.location.href = `/login?from=${encodeURIComponent(here)}`;
              }
            }
            break;
          case 403:
            message.error(detailText || '没有访问权限');
            break;
          case 404:
            message.error(detailText || '资源不存在');
            break;
          case 422:
            message.error(detailText || '请求参数校验失败');
            break;
          case 500:
            message.error(detailText || '服务器内部错误');
            break;
          case 503:
            message.error(detailText || '服务暂不可用');
            break;
          default:
            message.error(detailText || `请求失败 (${status})`);
        }

        // 在 error 上保留 config，便于业务层做更精细处理
        (error as any).config = config;
      } else if (error.request) {
        message.error('网络连接失败，请确认后端 /api/v1 可达');
      } else {
        message.error(error.message || '请求已取消');
      }

      return Promise.reject(error);
    },
  );

  return instance;
};

export const request = createRequest();

export const http = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    request.get<T>(url, config),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    request.post<T>(url, data, config),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    request.put<T>(url, data, config),

  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    request.delete<T>(url, config),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    request.patch<T>(url, data, config),
};

/** 兼容旧 import 路径 */
export const getAccessTokenFromStorage = getAccessToken;

export default request;