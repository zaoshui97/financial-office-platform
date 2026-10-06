import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';

const createRequest = () => {
  const instance: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const { data } = response;

      if (data.code && data.code !== 200) {
        message.error(data.message || '请求失败');
        return Promise.reject(new Error(data.message || '请求失败'));
      }

      return response;
    },
    (error) => {
      if (error.response) {
        const { status, data } = error.response;

        switch (status) {
          case 401:
            message.error('登录已过期，请重新登录');
            localStorage.removeItem('token');
            window.location.href = '/login';
            break;
          case 403:
            message.error('没有访问权限');
            break;
          case 404:
            message.error('资源不存在');
            break;
          case 500:
            message.error('服务器错误');
            break;
          default:
            message.error(data?.message || '网络错误');
        }
      } else if (error.request) {
        message.error('网络连接失败');
      } else {
        message.error(error.message || '请求已取消');
      }

      return Promise.reject(error);
    }
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

export default request;
