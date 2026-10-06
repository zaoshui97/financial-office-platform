/**
 * A21 金融智能办公平台 - API 契约
 *
 * 本文件是前后端共同遵守的契约，任何修改需双方同步确认。
 * 最后更新：2024-01-24
 * 版本：v1.0
 */

import { AxiosRequestConfig } from 'axios';

// ============================================================
// 通用类型定义
// ============================================================

/** 通用响应格式 */
export interface ApiResponse<T = any> {
  code: number;
  data: T;
  msg: string;
}

/** 分页参数 */
export interface PageParams {
  page: number;
  pageSize: number;
}

/** 分页响应 */
export interface PageResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================
// 模块一：会议管理 (Meeting)
// ============================================================

/** 待办事项 */
export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  assigneeName?: string;
  dueDate: string;
  status: 'todo' | 'in_progress' | 'done';
}

/** 会议状态 */
export type MeetingStatus = 'pending' | 'ongoing' | 'ended';

/** 会议详情 */
export interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  participants: string[];
  status: MeetingStatus;
  transcript?: string;
  summary?: string;
  actionItems?: ActionItem[];
  createdAt: string;
  updatedAt: string;
}

/** 会议列表查询参数 */
export interface MeetingListParams {
  status?: MeetingStatus;
  keyword?: string;
  page: number;
  pageSize: number;
}

/** 会议列表响应 */
export interface MeetingListResponse extends PageResponse<Meeting> {}

/** 创建会议请求 */
export interface CreateMeetingRequest {
  title: string;
  startTime: string;
  endTime: string;
  participants: string[];
}

/** 更新会议请求 */
export interface UpdateMeetingRequest extends Partial<CreateMeetingRequest> {
  status?: MeetingStatus;
  transcript?: string;
  summary?: string;
}

/** 会议管理 API */
export namespace MeetingAPI {
  /** 获取会议列表 */
  export const list = {
    url: '/api/meetings',
    method: 'GET',
    params: {} as MeetingListParams,
    response: {} as ApiResponse<MeetingListResponse>,
  };

  /** 创建会议 */
  export const create = {
    url: '/api/meetings',
    method: 'POST',
    data: {} as CreateMeetingRequest,
    response: {} as ApiResponse<Meeting>,
  };

  /** 获取会议详情 */
  export const detail = {
    url: '/api/meetings/{id}',
    method: 'GET',
    params: { id: '' },
    response: {} as ApiResponse<Meeting>,
  };

  /** 更新会议 */
  export const update = {
    url: '/api/meetings/{id}',
    method: 'PUT',
    params: { id: '' },
    data: {} as UpdateMeetingRequest,
    response: {} as ApiResponse<Meeting>,
  };

  /** 删除会议 */
  export const remove = {
    url: '/api/meetings/{id}',
    method: 'DELETE',
    params: { id: '' },
    response: {} as ApiResponse<null>,
  };

  /** 上传会议录音 */
  export const uploadAudio = {
    url: '/api/meetings/{id}/audio',
    method: 'POST',
    params: { id: '' },
    data: {} as { file: File },
    response: {} as ApiResponse<{ audioUrl: string }>,
  };

  /** 生成会议纪要 */
  export const generateSummary = {
    url: '/api/meetings/{id}/generate',
    method: 'POST',
    params: { id: '' },
    response: {} as ApiResponse<{ summary: string; actionItems: ActionItem[] }>,
  };

  /** 更新待办状态 */
  export const updateActionItem = {
    url: '/api/meetings/{id}/action-items/{actionId}',
    method: 'PUT',
    params: { id: '', actionId: '' },
    data: { status: '' as ActionItem['status'] },
    response: {} as ApiResponse<ActionItem>,
  };

  /** 推送待办到第三方 */
  export const pushWebhook = {
    url: '/api/meetings/{id}/push-webhook',
    method: 'POST',
    params: { id: '' },
    data: { platform: '' as 'dingtalk' | 'wecom' | 'feishu' },
    response: {} as ApiResponse<{ pushedCount: number }>,
  };
}

// ============================================================
// 模块二：智能问答 (QA)
// ============================================================

/** 参考来源 */
export interface Reference {
  id: string;
  title: string;
  category: string;
  snippet: string;
  url?: string;
}

/** 问答消息 */
export interface QAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  references?: Reference[];
}

/** 会话信息 */
export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** 发起问答请求 */
export interface AskRequest {
  question: string;
  sessionId?: string;
}

/** 问答响应 */
export interface AskResponse {
  answer: string;
  sessionId: string;
  references?: Reference[];
}

/** 智能问答 API */
export namespace QAAPI {
  /** 发起问答 */
  export const ask = {
    url: '/api/qa/ask',
    method: 'POST',
    data: {} as AskRequest,
    response: {} as ApiResponse<AskResponse>,
  };

  /** 获取会话历史列表 */
  export const getSessions = {
    url: '/api/qa/sessions',
    method: 'GET',
    response: {} as ApiResponse<Session[]>,
  };

  /** 删除会话 */
  export const deleteSession = {
    url: '/api/qa/sessions/{id}',
    method: 'DELETE',
    params: { id: '' },
    response: {} as ApiResponse<null>,
  };

  /** 重命名会话 */
  export const renameSession = {
    url: '/api/qa/sessions/{id}',
    method: 'PUT',
    params: { id: '' },
    data: { title: '' },
    response: {} as ApiResponse<Session>,
  };

  /** 获取会话的所有消息 */
  export const getMessages = {
    url: '/api/qa/sessions/{id}/messages',
    method: 'GET',
    params: { id: '' },
    response: {} as ApiResponse<QAMessage[]>,
  };
}

// ============================================================
// 模块三：知识库 (Knowledge)
// ============================================================

/** 知识库文档分类 */
export type KnowledgeCategory = 'policy' | 'project' | 'faq' | 'template' | 'report' | 'minutes';

/** 文档状态 */
export type DocumentStatus = 'indexed' | 'indexing' | 'failed';

/** 知识库文档 */
export interface KnowledgeDocument {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content?: string;
  fileSize: number;
  fileType: string;
  status: DocumentStatus;
  uploadedAt: string;
  updatedAt: string;
  uploader?: string;
}

/** 知识库分类 */
export interface KnowledgeCategoryTree {
  id: string;
  name: string;
  parentId?: string;
  count: number;
  children?: KnowledgeCategoryTree[];
}

/** 知识库查询参数 */
export interface KnowledgeListParams extends PageParams {
  category?: KnowledgeCategory;
  keyword?: string;
  status?: DocumentStatus;
}

/** 语义搜索请求 */
export interface KnowledgeSearchRequest {
  query: string;
  category?: KnowledgeCategory;
  limit?: number;
}

/** 语义搜索响应 */
export interface KnowledgeSearchResponse {
  results: Array<{
    document: KnowledgeDocument;
    score: number;
    highlight: string;
  }>;
}

/** 知识库 API */
export namespace KnowledgeAPI {
  /** 上传文档 */
  export const upload = {
    url: '/api/knowledge/upload',
    method: 'POST',
    data: {} as { file: File; category: KnowledgeCategory; title?: string },
    response: {} as ApiResponse<KnowledgeDocument>,
  };

  /** 获取文档列表 */
  export const list = {
    url: '/api/knowledge/documents',
    method: 'GET',
    params: {} as KnowledgeListParams,
    response: {} as ApiResponse<PageResponse<KnowledgeDocument>>,
  };

  /** 获取文档详情 */
  export const detail = {
    url: '/api/knowledge/documents/{id}',
    method: 'GET',
    params: { id: '' },
    response: {} as ApiResponse<KnowledgeDocument>,
  };

  /** 删除文档 */
  export const remove = {
    url: '/api/knowledge/documents/{id}',
    method: 'DELETE',
    params: { id: '' },
    response: {} as ApiResponse<null>,
  };

  /** 获取分类树 */
  export const getCategories = {
    url: '/api/knowledge/categories',
    method: 'GET',
    response: {} as ApiResponse<KnowledgeCategoryTree[]>,
  };

  /** 语义搜索 */
  export const search = {
    url: '/api/knowledge/search',
    method: 'POST',
    data: {} as KnowledgeSearchRequest,
    response: {} as ApiResponse<KnowledgeSearchResponse>,
  };
}

// ============================================================
// 模块四：文档生成 (Document)
// ============================================================

/** 文档类型 */
export type DocumentType = 'notice' | 'email' | 'minutes' | 'report';

/** 生成文档请求 */
export interface GenerateDocumentRequest {
  type: DocumentType;
  params: Record<string, any>;
}

/** 生成文档响应 */
export interface GenerateDocumentResponse {
  title: string;
  content: string;
  createdAt: string;
}

/** 历史文档记录 */
export interface DocumentHistoryItem {
  id: string;
  type: DocumentType;
  title: string;
  params: Record<string, any>;
  createdAt: string;
}

/** 文档生成 API */
export namespace DocumentAPI {
  /** 生成文档 */
  export const generate = {
    url: '/api/documents/generate',
    method: 'POST',
    data: {} as GenerateDocumentRequest,
    response: {} as ApiResponse<GenerateDocumentResponse>,
  };

  /** 获取生成历史 */
  export const getHistory = {
    url: '/api/documents/history',
    method: 'GET',
    params: {} as PageParams,
    response: {} as ApiResponse<PageResponse<DocumentHistoryItem>>,
  };

  /** 获取历史文档详情 */
  export const getHistoryDetail = {
    url: '/api/documents/history/{id}',
    method: 'GET',
    params: { id: '' },
    response: {} as ApiResponse<GenerateDocumentResponse & { params: Record<string, any> }>,
  };
}

// ============================================================
// 模块五：行业洞察 (Insights)
// ============================================================

/** 新闻条目 */
export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishTime: string;
  summary: string;
  content?: string;
  url?: string;
  isStarred: boolean;
  category?: string;
}

/** 法规条目 */
export interface RegulationItem {
  id: string;
  name: string;
  publisher: string;
  publishTime: string;
  status: 'effective' | 'draft' | 'pending';
}

/** 行业洞察查询参数 */
export interface InsightsQueryParams extends PageParams {
  category?: string;
  keyword?: string;
  starred?: boolean;
}

/** 行业洞察 API */
export namespace InsightsAPI {
  /** 获取行业洞察数据 */
  export const list = {
    url: '/api/insights',
    method: 'GET',
    params: {} as InsightsQueryParams,
    response: {} as ApiResponse<PageResponse<NewsItem>>,
  };

  /** 收藏/取消收藏新闻 */
  export const toggleStar = {
    url: '/api/insights/news/{id}/star',
    method: 'POST',
    params: { id: '' },
    response: {} as ApiResponse<{ isStarred: boolean }>,
  };

  /** 搜索新闻 */
  export const search = {
    url: '/api/insights/search',
    method: 'POST',
    data: { keyword: '', category: '', page: 1, pageSize: 20 },
    response: {} as ApiResponse<PageResponse<NewsItem>>,
  };
}

// ============================================================
// 模块六：用户与认证 (Auth)
// ============================================================

/** 用户角色 */
export type UserRole = 'admin' | 'manager' | 'employee';

/** 用户信息 */
export interface User {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  role: UserRole;
  department?: string;
  position?: string;
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  token: string;
  user: User;
  expiresAt: string;
}

/** 更新个人资料请求 */
export interface UpdateProfileRequest {
  name?: string;
  avatar?: string;
  email?: string;
}

/** 认证 API */
export namespace AuthAPI {
  /** 登录 */
  export const login = {
    url: '/api/auth/login',
    method: 'POST',
    data: {} as LoginRequest,
    response: {} as ApiResponse<LoginResponse>,
  };

  /** 获取当前用户信息 */
  export const me = {
    url: '/api/auth/me',
    method: 'GET',
    response: {} as ApiResponse<User>,
  };

  /** 登出 */
  export const logout = {
    url: '/api/auth/logout',
    method: 'POST',
    response: {} as ApiResponse<null>,
  };

  /** 更新个人资料 */
  export const updateProfile = {
    url: '/api/auth/profile',
    method: 'PUT',
    data: {} as UpdateProfileRequest,
    response: {} as ApiResponse<User>,
  };

  /** 刷新 Token */
  export const refreshToken = {
    url: '/api/auth/refresh',
    method: 'POST',
    response: {} as ApiResponse<{ token: string; expiresAt: string }>,
  };
}

// ============================================================
// Mock 数据模板
// ============================================================

export const __MOCK_DATA__ = {
  // 会议数据
  meetings: [
    {
      id: 'meeting-001',
      title: '产品迭代评审会 - Q1 sprint',
      startTime: '2024-01-20T14:00:00+08:00',
      endTime: '2024-01-20T15:30:00+08:00',
      participants: ['user-001', 'user-002', 'user-003', 'user-004'],
      status: 'ended',
      transcript: `会议开始，主持人介绍本次评审议程...
张三分享了本季度产品数据，用户增长达15%...
李四汇报技术方案，包括微服务改造计划...
王五提出了性能优化的建议...
讨论环节，大家对缓存策略进行了深入交流...
会议总结：确定了Q2优先事项...`,
      summary: '本季度产品数据表现良好，用户增长15%。技术方案通过评审，计划3月开始微服务改造。Q2优先事项：性能优化、缓存重构、新功能开发。',
      actionItems: [
        { id: 'action-001', description: '完成缓存方案详细设计', assignee: 'user-002', assigneeName: '李四', dueDate: '2024-01-25', status: 'todo' },
        { id: 'action-002', description: '编写微服务迁移文档', assignee: 'user-003', assigneeName: '王五', dueDate: '2024-01-28', status: 'todo' },
        { id: 'action-003', description: '组织技术分享会', assignee: 'user-001', assigneeName: '张三', dueDate: '2024-02-01', status: 'in_progress' },
      ],
      createdAt: '2024-01-18T10:00:00+08:00',
      updatedAt: '2024-01-20T16:00:00+08:00',
    },
    {
      id: 'meeting-002',
      title: '年度预算规划会议',
      startTime: '2024-01-22T09:00:00+08:00',
      endTime: '2024-01-22T12:00:00+08:00',
      participants: ['user-001', 'user-005', 'user-006', 'user-007'],
      status: 'ended',
      transcript: '财务部汇报上年度预算执行情况...',
      summary: '上年度预算执行率92%，节余资金将用于技术升级。',
      actionItems: [
        { id: 'action-004', description: '提交Q1详细预算申请', assignee: 'user-005', assigneeName: '赵总', dueDate: '2024-01-30', status: 'done' },
      ],
      createdAt: '2024-01-15T08:00:00+08:00',
      updatedAt: '2024-01-22T12:30:00+08:00',
    },
    {
      id: 'meeting-003',
      title: '新人入职培训 - 2月批次',
      startTime: '2024-02-05T10:00:00+08:00',
      endTime: '2024-02-05T17:00:00+08:00',
      participants: ['user-001', 'user-008', 'user-009', 'user-010'],
      status: 'pending',
      createdAt: '2024-01-20T14:00:00+08:00',
      updatedAt: '2024-01-20T14:00:00+08:00',
    },
    {
      id: 'meeting-004',
      title: '周例会 - 技术团队',
      startTime: '2024-01-24T15:00:00+08:00',
      endTime: '2024-01-24T16:00:00+08:00',
      participants: ['user-002', 'user-003', 'user-011'],
      status: 'ongoing',
      createdAt: '2024-01-23T09:00:00+08:00',
      updatedAt: '2024-01-24T15:00:00+08:00',
    },
    {
      id: 'meeting-005',
      title: '客户需求沟通 - XX金融',
      startTime: '2024-01-26T14:00:00+08:00',
      endTime: '2024-01-26T15:30:00+08:00',
      participants: ['user-001', 'user-012', 'user-013'],
      status: 'pending',
      createdAt: '2024-01-24T11:00:00+08:00',
      updatedAt: '2024-01-24T11:00:00+08:00',
    },
  ],

  // 问答消息
  qaMessages: [
    { id: 'msg-001', role: 'user', content: '如何申请开通新的系统权限？', timestamp: '2024-01-20T10:30:00+08:00', references: [] },
    { id: 'msg-002', role: 'assistant', content: '申请系统权限请按以下步骤操作：\n\n1. 登录 OA 系统\n2. 进入「我的工作台」-「权限申请」\n3. 选择需要申请的系统和模块\n4. 填写申请原因\n5. 提交后等待部门负责人审批\n\n如需紧急开通，可联系 IT 部门加急处理。', timestamp: '2024-01-20T10:30:15+08:00', references: [{ id: 'ref-001', title: '权限申请流程', category: '流程文档', snippet: '权限申请需要部门负责人审批...' }] },
    { id: 'msg-003', role: 'user', content: '公司年假是怎么计算的？', timestamp: '2024-01-21T09:15:00+08:00', references: [] },
    { id: 'msg-004', role: 'assistant', content: '根据公司制度，年假计算方式如下：\n\n• 工作满1年不满10年：年休假5天\n• 工作满10年不满20年：年休假10天\n• 工作满20年：年休假15天\n\n年假有效期至次年3月31日，请及时使用。', timestamp: '2024-01-21T09:15:30+08:00', references: [{ id: 'ref-002', title: '员工手册 - 假期管理', category: '制度', snippet: '年假天数根据司龄计算...' }] },
    { id: 'msg-005', role: 'user', content: '帮我分析一下这份合同的风险点', timestamp: '2024-01-22T14:00:00+08:00', references: [] },
    { id: 'msg-006', role: 'assistant', content: '请上传您需要分析的合同文档，我可以帮您识别以下风险点：\n\n1. 合同主体资格\n2. 关键条款审查\n3. 潜在法律风险\n4. 合规性检查\n\n请问您的合同是什么类型的？（采购合同、服务合同、劳动合同等）', timestamp: '2024-01-22T14:00:10+08:00', references: [] },
    { id: 'msg-007', role: 'user', content: '项目结项报告怎么写？', timestamp: '2024-01-23T11:20:00+08:00', references: [] },
    { id: 'msg-008', role: 'assistant', content: '项目结项报告通常包含以下章节：\n\n1. 项目概述\n2. 目标达成情况\n3. 实施过程回顾\n4. 成果展示\n5. 经验总结\n6. 后续建议\n\n建议使用公司统一的结项报告模板，可从知识库「模板」分类中下载。', timestamp: '2024-01-23T11:20:25+08:00', references: [{ id: 'ref-003', title: '项目结项报告模板', category: '模板', snippet: '点击下载项目结项报告标准模板...' }] },
    { id: 'msg-009', role: 'user', content: '最新的行业政策有哪些变化？', timestamp: '2024-01-24T08:45:00+08:00', references: [] },
    { id: 'msg-010', role: 'assistant', content: '近期金融行业主要政策动态：\n\n• 《金融科技发展规划》发布，强调数字化转型\n• 证券期货行业数据安全管理办法征求意见\n• 银行保险机构信息科技外包风险监管办法更新\n\n您可以在「行业洞察」模块查看详细分析和原文链接。', timestamp: '2024-01-24T08:45:20+08:00', references: [] },
  ],

  // 知识库文档
  knowledgeDocuments: [
    { id: 'doc-001', title: '员工手册 2024版', category: 'policy', content: '本文档包含公司全部制度规定...', fileSize: 2048000, fileType: 'pdf', status: 'indexed', uploadedAt: '2024-01-01T00:00:00+08:00', updatedAt: '2024-01-01T00:00:00+08:00', uploader: 'HR-Admin' },
    { id: 'doc-002', title: 'React 技术选型方案', category: 'project', content: '本次技术调研针对前端框架进行对比分析...', fileSize: 1024000, fileType: 'docx', status: 'indexed', uploadedAt: '2024-01-10T14:30:00+08:00', updatedAt: '2024-01-10T14:30:00+08:00', uploader: 'user-002' },
    { id: 'doc-003', title: '常见问题 FAQ 汇总', category: 'faq', content: 'Q: 如何重置密码？A: 通过登录页「忘记密码」功能...', fileSize: 512000, fileType: 'md', status: 'indexed', uploadedAt: '2024-01-05T09:00:00+08:00', updatedAt: '2024-01-15T11:00:00+08:00', uploader: 'user-001' },
    { id: 'doc-004', title: '项目结项报告模板', category: 'template', content: '# 项目结项报告\n\n## 一、项目概述\n\n## 二、目标达成\n\n## 三、实施过程\n\n## 四、成果展示\n\n## 五、经验总结', fileSize: 256000, fileType: 'docx', status: 'indexed', uploadedAt: '2024-01-08T10:00:00+08:00', updatedAt: '2024-01-08T10:00:00+08:00', uploader: 'PM-Office' },
    { id: 'doc-005', title: '2024年1月第1周周会纪要', category: 'minutes', content: '时间：2024-01-08 10:00\n参与人：张三、李四、王五\n议题：Q1 Sprint 计划评审...', fileSize: 128000, fileType: 'doc', status: 'indexed', uploadedAt: '2024-01-08T12:00:00+08:00', updatedAt: '2024-01-08T12:00:00+08:00', uploader: 'user-001' },
    { id: 'doc-006', title: '微服务架构设计方案', category: 'project', content: '本文档描述系统的微服务拆分方案...', fileSize: 3072000, fileType: 'pdf', status: 'indexed', uploadedAt: '2024-01-12T16:00:00+08:00', updatedAt: '2024-01-12T16:00:00+08:00', uploader: 'user-002' },
    { id: 'doc-007', title: '数据安全管理制度', category: 'policy', content: '第一章 总则\n第二章 数据分类\n第三章 数据保护要求...', fileSize: 768000, fileType: 'pdf', status: 'indexed', uploadedAt: '2024-01-03T08:00:00+08:00', updatedAt: '2024-01-03T08:00:00+08:00', uploader: 'Security-Team' },
    { id: 'doc-008', title: 'OKR 填写指南', category: 'template', content: 'Objective（目标）+ Key Results（关键结果）\n\nO的写法：\n- 有挑战性但可达成\n- 有明确的时间范围\n- 描述最终状态而非过程', fileSize: 384000, fileType: 'pptx', status: 'indexed', uploadedAt: '2024-01-06T14:00:00+08:00', updatedAt: '2024-01-06T14:00:00+08:00', uploader: 'HR-Admin' },
    { id: 'doc-009', title: '系统接口文档 v2.0', category: 'project', content: 'API 接口规范\nBase URL: /api/v2\n认证方式: Bearer Token...', fileSize: 1536000, fileType: 'html', status: 'indexing', uploadedAt: '2024-01-20T10:00:00+08:00', updatedAt: '2024-01-20T10:00:00+08:00', uploader: 'user-002' },
    { id: 'doc-010', title: '商务接待流程', category: 'faq', content: 'Q: 如何申请商务接待？\nA: 需提前3个工作日提交申请，包含来访人员信息、接待规格等...', fileSize: 256000, fileType: 'md', status: 'indexed', uploadedAt: '2024-01-11T09:30:00+08:00', updatedAt: '2024-01-11T09:30:00+08:00', uploader: 'Admin-Office' },
  ],

  // 行业新闻
  news: [
    { id: 'news-001', title: '央行发布《金融科技发展规划（2024-2025年）》', source: '中国人民银行', publishTime: '2024-01-15T10:00:00+08:00', summary: '规划提出到2025年，金融科技整体水平显著提升，数字化转型取得明显成效...', url: 'https://example.com/news/001', isStarred: true, category: '政策' },
    { id: 'news-002', title: '证券期货行业数据安全管理办法正式落地', source: '证监会', publishTime: '2024-01-12T14:30:00+08:00', summary: '办法对证券期货行业的数据分类分级、安全保护、责任边界等作出明确规定...', url: 'https://example.com/news/002', isStarred: false, category: '监管' },
    { id: 'news-003', title: '银行保险机构信息科技外包风险监管办法发布', source: '银保监会', publishTime: '2024-01-10T09:00:00+08:00', summary: '办法要求银行保险机构加强信息科技外包风险管理...', url: 'https://example.com/news/003', isStarred: false, category: '监管' },
    { id: 'news-004', title: '多家券商宣布接入 DeepSeek 大模型', source: '证券时报', publishTime: '2024-01-18T16:00:00+08:00', summary: '据报道，已有超过10家券商宣布接入国产大模型，推动智能投顾、风险控制等场景应用...', url: 'https://example.com/news/004', isStarred: true, category: '行业' },
    { id: 'news-005', title: '2023年金融科技投融资报告发布', source: '艾瑞咨询', publishTime: '2024-01-08T11:00:00+08:00', summary: '报告显示2023年金融科技领域融资总额超500亿元，AI和安全成为投资热点...', url: 'https://example.com/news/005', isStarred: false, category: '报告' },
    { id: 'news-006', title: '数字人民币试点范围进一步扩大', source: '央行数字货币研究所', publishTime: '2024-01-05T08:00:00+08:00', summary: '数字人民币试点城市已覆盖全国26个省市，应用场景不断丰富...', url: 'https://example.com/news/006', isStarred: false, category: '数字货币' },
    { id: 'news-007', title: '保险公司数字化转型白皮书发布', source: '保险行业协会', publishTime: '2024-01-03T10:00:00+08:00', summary: '白皮书指出保险业数字化转型进入深水区，核心系统云原生化成趋势...', url: 'https://example.com/news/007', isStarred: false, category: '报告' },
    { id: 'news-008', title: '金融业网络安全形势分析报告', source: '国家计算机网络应急技术处理协调中心', publishTime: '2024-01-02T09:00:00+08:00', summary: '报告指出金融业面临的网络安全威胁持续增加，供应链攻击成新挑战...', url: 'https://example.com/news/008', isStarred: true, category: '安全' },
    { id: 'news-009', title: '区块链在供应链金融中的应用加速', source: '金融科技周刊', publishTime: '2024-01-20T14:00:00+08:00', summary: '多家金融机构推出基于区块链的供应链金融平台，提升中小企业融资效率...', url: 'https://example.com/news/009', isStarred: false, category: '技术' },
    { id: 'news-010', title: '金融行业 AI 大模型应用规范正在制定', source: '中国互联网金融协会', publishTime: '2024-01-19T11:30:00+08:00', summary: '规范将对金融领域 AI 大模型的数据合规、模型可解释性、风险控制等提出要求...', url: 'https://example.com/news/010', isStarred: false, category: '政策' },
  ],

  // 当前用户
  currentUser: {
    id: 'user-001',
    name: '张三',
    avatar: '',
    email: 'zhangsan@hundsun.com',
    role: 'employee',
    department: '产品部',
    position: '产品经理',
  },
};
