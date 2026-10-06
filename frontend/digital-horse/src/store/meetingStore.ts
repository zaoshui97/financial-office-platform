/**
 * 会议状态管理（Phase 3）
 *
 * 状态：
 *   - 会议列表 / 当前会议详情
 *   - 4 个 Agent 的最新 state（按 agent_role 索引）
 *   - 触发中状态（防重复触发）
 *
 * 注意：
 *   - 黑板 version 单调递增；前端用 version 覆盖即可，不需要复杂合并
 *   - event_type 字段保留，用于阶段判断（如 moderator_updated）
 */

import { create } from 'zustand';
import {
  AgentRole,
  AgentTriggerResponse,
  BlackboardSnapshot,
  MeetingCreate,
  MeetingRead,
  meetingApi,
} from '@/api/meeting';

type BlackBoard = Partial<Record<AgentRole, BlackboardSnapshot>>;

interface MeetingState {
  /** 会议列表 */
  meetings: MeetingRead[];
  /** 当前打开的会议 */
  currentMeeting: MeetingRead | null;
  /** 当前会议的 4 个 Agent 状态 */
  blackboard: BlackBoard;
  /** 正在触发的 Agent（防重复） */
  triggering: Partial<Record<AgentRole, boolean>>;

  // ---------- actions ----------
  loadList: (status?: MeetingRead['status']) => Promise<void>;
  loadMeeting: (id: number) => Promise<MeetingRead>;
  createMeeting: (payload: MeetingCreate) => Promise<MeetingRead>;
  closeMeeting: (id: number) => Promise<MeetingRead>;
  loadBlackboard: (id: number) => Promise<void>;
  triggerAgent: (id: number, role: AgentRole) => Promise<AgentTriggerResponse>;

  /** WS 推送来的单条更新 */
  applyUpdate: (
    role: AgentRole,
    state: Record<string, unknown>,
    version: number,
  ) => void;
  /** WS 初始 snapshot 全量覆盖 */
  applySnapshot: (
    states: Record<AgentRole, Record<string, unknown>>,
  ) => void;
  reset: () => void;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  meetings: [],
  currentMeeting: null,
  blackboard: {},
  triggering: {},

  loadList: async (status) => {
    const resp = await meetingApi.list({ status });
    set({ meetings: resp.items });
  },

  loadMeeting: async (id) => {
    const m = await meetingApi.get(id);
    set({ currentMeeting: m });
    return m;
  },

  createMeeting: async (payload) => {
    const m = await meetingApi.create(payload);
    set({ meetings: [m, ...get().meetings] });
    return m;
  },

  closeMeeting: async (id) => {
    const m = await meetingApi.close(id);
    set({
      currentMeeting: m,
      meetings: get().meetings.map((x) => (x.id === id ? m : x)),
    });
    return m;
  },

  loadBlackboard: async (id) => {
    const resp = await meetingApi.readBlackboard(id);
    const board: BlackBoard = {};
    for (const snap of resp.states) {
      board[snap.agent_role] = snap;
    }
    set({ blackboard: board });
  },

  triggerAgent: async (id, role) => {
    if (get().triggering[role]) {
      throw new Error(`${role} 正在执行中，请稍后再试`);
    }
    set({ triggering: { ...get().triggering, [role]: true } });
    try {
      const resp = await meetingApi.triggerAgent(id, role, {
        context: {},
        wait: true,
      });
      // 触发链可能让其他 agent 也跑完，apply 自身的更新即可
      // （其他 agent 的 update 会通过 WS push 过来）
      set({
        blackboard: {
          ...get().blackboard,
          [role]: {
            agent_role: role,
            version: resp.new_version,
            state: resp.state,
          },
        },
      });
      // 刷新会议详情以拿 current_phase
      try {
        const m = await meetingApi.get(id);
        set({ currentMeeting: m });
      } catch {
        // 静默忽略
      }
      return resp;
    } finally {
      set({ triggering: { ...get().triggering, [role]: false } });
    }
  },

  applyUpdate: (role, state, version) => {
    const prev = get().blackboard[role];
    // version 必须 >= 旧 version；防止乱序回退
    if (prev && prev.version > version) return;
    set({
      blackboard: {
        ...get().blackboard,
        [role]: { agent_role: role, version, state },
      },
    });
  },

  applySnapshot: (states) => {
    const board: BlackBoard = {};
    for (const role of Object.keys(states) as AgentRole[]) {
      const s = states[role];
      const v = (s.version as number) ?? 0;
      board[role] = { agent_role: role, version: v, state: s };
    }
    set({ blackboard: board });
  },

  reset: () =>
    set({
      meetings: [],
      currentMeeting: null,
      blackboard: {},
      triggering: {},
    }),
}));