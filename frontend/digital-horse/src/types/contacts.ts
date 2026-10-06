/**
 * 通讯录 / 即时聊天相关类型定义
 */

import type { Role } from './permission';

/** 组织层级分类：顶层 / 管理层 / 业务部门 / 职能部门 */
export type OrgLevel = 'TOP' | 'MANAGEMENT' | 'BUSINESS' | 'SUPPORT';

/** 部门分组（业务部门内部再按团队划分） */
export interface ContactTeam {
  id: string;
  name: string;
}

export interface ContactEmployee {
  id: string;
  username: string;
  name: string;
  /** 头像颜色 fallback（无图片头像时使用） */
  avatar?: string;
  role: Role;
  /** 所属部门（一级，如"风险管理部"） */
  department: string;
  /** 所属团队（二级，如"市场风险组"，可空） */
  team?: string;
  /** 组织层级（顶层/管理层/业务/职能） */
  orgLevel: OrgLevel;
  /** 职位（如"总经理"、"市场风险分析师"） */
  position: string;
  /** 汇报对象（上级员工 id，用于画汇报线） */
  reportsTo?: string;
  email: string;
  phone?: string;
  online?: boolean;
}

export interface ChatMessage {
  id: string;
  /** 发送者 employee id */
  fromId: string;
  /** 接收者 employee id */
  toId: string;
  /** 文本内容 */
  content: string;
  /** ISO 时间字符串 */
  timestamp: string;
  type: 'text';
}
