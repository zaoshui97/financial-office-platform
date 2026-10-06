/**
 * 钉钉集成 —— 仿真 OAuth 登录 + 工作通知 + 通讯录同步
 *
 * 真实对接时：把每个函数的 mock 实现替换为 axios 调用对应钉钉开放平台接口。
 *
 * 仿真行为：
 *   - loginWithQrCode()：弹窗扫码 UI，2 秒后回调，返回 mock unionId / userid / 部门
 *   - sendWorkNotice()：模拟 200~600ms 推送，90% 成功，失败自动重试 1 次
 *   - fetchDingtalkContacts()：返回 50 名 mock 员工 + 5 个部门
 *
 * 注意：本仿真不依赖任何真实钉钉 SDK，纯前端演示。
 */

import { eventBus } from '../eventBus';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ============================================================
// 类型定义（与钉钉开放平台字段对齐）
// ============================================================

export interface DingtalkUserInfo {
  /** 钉钉 unionId（跨应用唯一） */
  unionId: string;
  /** 钉钉 userid（应用内唯一） */
  userid: string;
  /** 钉钉 openId */
  openId: string;
  /** 姓名 */
  name: string;
  /** 手机号（脱敏：138****8000） */
  mobile: string;
  /** 工号 */
  jobNumber?: string;
  /** 部门 ID 列表 */
  deptIdList: number[];
  /** 主部门名称 */
  mainDepartment: string;
  /** 职位 */
  title?: string;
  /** 头像 URL */
  avatarUrl?: string;
}

export interface DingtalkDept {
  id: number;
  name: string;
  parentId: number;
  memberCount: number;
}

export interface DingtalkContactEmployee {
  userid: string;
  unionId: string;
  name: string;
  mobile: string;
  jobNumber: string;
  dept: string;
  title: string;
  email: string;
  avatar: string;
  status: 'active' | 'leave' | 'disabled';
}

export interface DingtalkWorkNoticeResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  sentAt: string;
  channel: 'dingtalk';
  retryCount: number;
}

// ============================================================
// 仿真配置
// ============================================================

const SIM_LATENCY_MIN = 200;
const SIM_LATENCY_MAX = 600;
const SIM_SUCCESS_RATE = 0.9;
const SIM_MAX_RETRY = 1;

function randLatency(): number {
  return SIM_LATENCY_MIN + Math.random() * (SIM_LATENCY_MAX - SIM_LATENCY_MIN);
}

function randId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// 1. OAuth 扫码登录
// ============================================================

/**
 * 仿真钉钉扫码登录：返回一个 Promise，调用方应展示二维码 UI 并等待该 Promise resolve。
 *
 * @param options.timeoutMs 超时时间（默认 60 秒）
 * @param options.simulateScan 是否模拟"已扫码"（默认 true；false 时永远不会 resolve，模拟用户未扫码）
 */
export function loginWithQrCode(options: {
  timeoutMs?: number;
  simulateScan?: boolean;
} = {}): Promise<DingtalkUserInfo> {
  const { timeoutMs = 60_000, simulateScan = true } = options;

  return new Promise((resolve, reject) => {
    if (!simulateScan) {
      // 不模拟扫码：等待用户主动触发（外部组件需要暴露 "我已扫码" 按钮）
      const handler = (window as unknown as { __dingtalkResolveLogin?: (u: DingtalkUserInfo) => void });
      handler.__dingtalkResolveLogin = (u) => {
        clearTimeout(timer);
        resolve(u);
      };
    }

    const timer = setTimeout(() => {
      if (!simulateScan) {
        reject(new Error('钉钉扫码登录超时'));
        return;
      }
      // 模拟成功登录
      const user: DingtalkUserInfo = {
        unionId: `sim-union-${Math.random().toString(36).slice(2, 10)}`,
        userid: `ding_${Math.floor(Math.random() * 100000)}`,
        openId: `sim-open-${Math.random().toString(36).slice(2, 10)}`,
        name: pickRandomName(),
        mobile: `138****${Math.floor(1000 + Math.random() * 9000)}`,
        jobNumber: `E${Math.floor(10000 + Math.random() * 90000)}`,
        deptIdList: [1, 2, 5],
        mainDepartment: pickRandomDept(),
        title: pickRandomTitle(),
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).slice(2, 10)}`,
      };
      eventBus.emit('dingtalk.connected', { corpId: 'sim_corp_apexis', appName: '睿枢 Apexis' });
      resolve(user);
    }, simulateScan ? 2000 : timeoutMs);

    // 真实场景下：reject 由超时控制（cleanup 通过 resolve 路径省略）
    void timer;
  });
}

/** 主动触发"用户已扫码"回调（仅当 simulateScan=false 时有效） */
export function confirmQrCodeScan(user?: Partial<DingtalkUserInfo>): void {
  const handler = (window as unknown as { __dingtalkResolveLogin?: (u: DingtalkUserInfo) => void });
  if (handler.__dingtalkResolveLogin) {
    handler.__dingtalkResolveLogin({
      unionId: user?.unionId || `sim-union-${Math.random().toString(36).slice(2, 10)}`,
      userid: user?.userid || `ding_${Math.floor(Math.random() * 100000)}`,
      openId: user?.openId || `sim-open-${Math.random().toString(36).slice(2, 10)}`,
      name: user?.name || pickRandomName(),
      mobile: user?.mobile || `138****${Math.floor(1000 + Math.random() * 9000)}`,
      jobNumber: user?.jobNumber,
      deptIdList: user?.deptIdList || [1, 2, 5],
      mainDepartment: user?.mainDepartment || pickRandomDept(),
      title: user?.title,
      avatarUrl: user?.avatarUrl,
    });
    handler.__dingtalkResolveLogin = undefined;
  }
}

// ============================================================
// 2. 工作通知推送
// ============================================================

export interface WorkNoticePayload {
  /** 接收人 userid 列表 */
  userIds: string[];
  /** 消息标题 */
  title: string;
  /** 消息内容（markdown 格式） */
  content: string;
  /** 跳转链接（pcUrl / appUrl 二选一） */
  link?: { pcUrl?: string; appUrl?: string };
  /** 优先级 */
  priority?: 'normal' | 'high' | 'urgent';
}

/**
 * 仿真钉钉工作通知发送（带自动重试）
 */
export async function sendWorkNotice(
  payload: WorkNoticePayload
): Promise<DingtalkWorkNoticeResult> {
  let attempt = 0;

  while (attempt <= SIM_MAX_RETRY) {
    await delay(randLatency());
    attempt += 1;

    const ok = Math.random() < SIM_SUCCESS_RATE;
    if (ok) {
      const result: DingtalkWorkNoticeResult = {
        ok: true,
        messageId: randId('dtmsg'),
        sentAt: new Date().toISOString(),
        channel: 'dingtalk',
        retryCount: attempt - 1,
      };
      eventBus.emit('notification.pushed', {
        id: result.messageId!,
        channel: 'dingtalk',
        eventType: 'dingtalk.work_notice',
        success: true,
      });
      return result;
    }

    if (attempt > SIM_MAX_RETRY) {
      const result: DingtalkWorkNoticeResult = {
        ok: false,
        error: `钉钉工作通知推送失败（已重试 ${SIM_MAX_RETRY} 次）：网络抖动`,
        sentAt: new Date().toISOString(),
        channel: 'dingtalk',
        retryCount: attempt - 1,
      };
      eventBus.emit('notification.pushed', {
        id: randId('dtfail'),
        channel: 'dingtalk',
        eventType: 'dingtalk.work_notice',
        success: false,
      });
      return result;
    }
  }

  // 不可达
  return {
    ok: false,
    error: '钉钉推送未知异常',
    sentAt: new Date().toISOString(),
    channel: 'dingtalk',
    retryCount: SIM_MAX_RETRY,
  };
}

// ============================================================
// 3. 钉钉通讯录拉取
// ============================================================

const MOCK_DEPT_NAMES = [
  '董事会办公室',
  '信息技术部',
  '风险管理部',
  '合规法务部',
  '财务部',
  '人力资源部',
  '市场部',
  '客户运营部',
  '产品研发部',
];

const MOCK_NAME_FIRST = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡'];
const MOCK_NAME_LAST = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平'];

function pickRandomName(): string {
  const f = MOCK_NAME_FIRST[Math.floor(Math.random() * MOCK_NAME_FIRST.length)];
  const l = MOCK_NAME_LAST[Math.floor(Math.random() * MOCK_NAME_LAST.length)];
  return `${f}${l}`;
}

function pickRandomDept(): string {
  return MOCK_DEPT_NAMES[Math.floor(Math.random() * MOCK_DEPT_NAMES.length)];
}

function pickRandomTitle(): string {
  const titles = ['高级经理', '部门总监', '产品经理', '风控专家', '合规专员', '数据分析师', '研发工程师', '运营专员', 'HRBP'];
  return titles[Math.floor(Math.random() * titles.length)];
}

const MOCK_DEPARTMENTS: DingtalkDept[] = MOCK_DEPT_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  parentId: i === 0 ? 0 : Math.max(1, Math.floor(i / 2)),
  memberCount: 0,
}));

let _cachedContacts: DingtalkContactEmployee[] | null = null;

/**
 * 仿真：拉取钉钉通讯录（全公司员工）
 * - 首次调用生成 50 名员工并缓存
 * - 后续调用直接返回缓存（带 latency 模拟）
 */
export async function fetchDingtalkContacts(force = false): Promise<{
  departments: DingtalkDept[];
  employees: DingtalkContactEmployee[];
  totalCount: number;
}> {
  await delay(randLatency());

  if (!_cachedContacts || force) {
    _cachedContacts = Array.from({ length: 50 }, (_, i) => {
      const name = pickRandomName();
      const dept = MOCK_DEPARTMENTS[i % MOCK_DEPARTMENTS.length];
      return {
        userid: `ding_${1000 + i}`,
        unionId: `union_${Math.random().toString(36).slice(2, 10)}`,
        name,
        mobile: `138****${String(1000 + i).slice(-4)}`,
        jobNumber: `E${10000 + i}`,
        dept: dept.name,
        title: pickRandomTitle(),
        email: `${name.toLowerCase()}@apexis.com`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`,
        status: (Math.random() > 0.95 ? 'leave' : 'active') as 'active' | 'leave' | 'disabled',
      };
    });
    MOCK_DEPARTMENTS.forEach((d, i) => {
      d.memberCount = _cachedContacts!.filter((e) => e.dept === d.name).length || 7 + i;
    });
  }

  eventBus.emit('contacts.dingtalkSynced', {
    added: force ? 0 : _cachedContacts.length,
    updated: force ? _cachedContacts.length : 0,
    removed: 0,
  });

  return {
    departments: MOCK_DEPARTMENTS,
    employees: _cachedContacts,
    totalCount: _cachedContacts.length,
  };
}

// ============================================================
// 4. 通用：断开钉钉连接
// ============================================================

export function disconnectDingtalk(): void {
  eventBus.emit('dingtalk.disconnected', undefined);
}

// ============================================================
// 5. 配置：当前是否连接（从 localStorage 读取）
// ============================================================

const DT_STORAGE_KEY = 'apexis:dingtalk:connection';

export interface DingtalkConnection {
  connected: boolean;
  corpId?: string;
  appName?: string;
  userid?: string;
  unionId?: string;
  connectedAt?: string;
}

export function getDingtalkConnection(): DingtalkConnection {
  try {
    const raw = localStorage.getItem(DT_STORAGE_KEY);
    if (!raw) return { connected: false };
    return JSON.parse(raw) as DingtalkConnection;
  } catch {
    return { connected: false };
  }
}

export function saveDingtalkConnection(conn: DingtalkConnection): void {
  try {
    localStorage.setItem(DT_STORAGE_KEY, JSON.stringify(conn));
  } catch {
    /* noop */
  }
}
