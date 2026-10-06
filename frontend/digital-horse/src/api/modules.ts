import { http } from './request';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PageParams {
  page: number;
  pageSize: number;
  [key: string]: any;
}

export interface PageResult<T = any> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// User API
export const userApi = {
  getUserInfo: () => http.get<ApiResponse>('/user/info'),
  updateUserInfo: (data: any) => http.put<ApiResponse>('/user/info', data),
  login: (data: { username: string; password: string }) =>
    http.post<ApiResponse>('/user/login', data),
  logout: () => http.post<ApiResponse>('/user/logout'),
};

// Knowledge base API
export const knowledgeApi = {
  getList: (params?: PageParams) => http.get<ApiResponse<PageResult>>('/knowledge/list', { params }),
  getDetail: (id: string) => http.get<ApiResponse>(`/knowledge/${id}`),
  create: (data: any) => http.post<ApiResponse>('/knowledge', data),
  update: (id: string, data: any) => http.put<ApiResponse>(`/knowledge/${id}`, data),
  delete: (id: string) => http.delete<ApiResponse>(`/knowledge/${id}`),
};

// Meeting API
export const meetingApi = {
  getList: (params?: PageParams) => http.get<ApiResponse<PageResult>>('/meeting/list', { params }),
  getDetail: (id: string) => http.get<ApiResponse>(`/meeting/${id}`),
  create: (data: any) => http.post<ApiResponse>('/meeting', data),
  update: (id: string, data: any) => http.put<ApiResponse>(`/meeting/${id}`, data),
  cancel: (id: string) => http.post<ApiResponse>(`/meeting/${id}/cancel`),
};

// Document API
export const documentApi = {
  getList: (params?: PageParams) => http.get<ApiResponse<PageResult>>('/document/list', { params }),
  getDetail: (id: string) => http.get<ApiResponse>(`/document/${id}`),
  upload: (data: FormData) => http.post<ApiResponse>('/document/upload', data),
  delete: (id: string) => http.delete<ApiResponse>(`/document/${id}`),
};

// Industry insights API
export const insightApi = {
  getList: (params?: PageParams) => http.get<ApiResponse<PageResult>>('/insight/list', { params }),
  getDetail: (id: string) => http.get<ApiResponse>(`/insight/${id}`),
};
