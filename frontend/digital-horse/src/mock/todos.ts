/**
 * 待办任务 Mock 数据
 *
 * 真实接口接入前先用本地数据驱动：
 * - id           稳定 id（用 'a' 前缀避免和通知 id 冲突）
 * - assignee     登录用户 username（demo 默认 user-001 张伟）
 * - status       todo / in_progress / done
 * - dueDate      ISO date
 */
import type { ActionItem } from '@/types/api';

export const MOCK_TODOS: ActionItem[] = [
  {
    id: 'a1',
    description: '完成《合规检测周报》第三章修订',
    assignee: 'user-001',
    assigneeName: '张伟',
    dueDate: '2026-09-12',
    status: 'todo',
  },
  {
    id: 'a2',
    description: '复审产品上线合规评估表（v2.3）',
    assignee: 'user-001',
    assigneeName: '张伟',
    dueDate: '2026-09-13',
    status: 'in_progress',
  },
  {
    id: 'a3',
    description: '与法务部对接 Q4 合规新规培训',
    assignee: 'user-001',
    assigneeName: '张伟',
    dueDate: '2026-09-11',
    status: 'todo',
  },
  {
    id: 'a4',
    description: '更新会议纪要模板与归档流程',
    assignee: 'user-001',
    assigneeName: '张伟',
    dueDate: '2026-09-14',
    status: 'done',
  },
  {
    id: 'a5',
    description: '审核本周 AI 风险扫描报告',
    assignee: 'user-001',
    assigneeName: '张伟',
    dueDate: '2026-09-15',
    status: 'in_progress',
  },
  {
    id: 'a6',
    description: '整理部门 OKR 月度复盘材料',
    assignee: 'user-001',
    assigneeName: '张伟',
    dueDate: '2026-09-18',
    status: 'todo',
  },
];
