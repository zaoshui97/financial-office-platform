/**
 * 年度战略规划研讨会 · 全流程内容
 *
 * 三个页面（MeetingRehearsal / MeetingRoom / PostMeetingReport）共享同一份内容，
 * 保证「会前彩排 → 会中转写 → 会后报告」三处数据完全一致。
 *
 * 议程：
 *   T1 议题 1：外部环境扫描    10:00 – 12:00
 *   T2 议题 2：公司现状与对标  13:30 – 15:30
 *   T3 议题 3：2024 战略主轴   15:45 – 17:00
 *   T4 收尾    ：李总主持收束  17:00 – 17:30
 */

export type Stance = 'opportunity' | 'risk' | 'customer' | 'finance';

export interface PersonProfile {
  id: string;
  name: string;       // 真实姓名
  role: string;       // 岗位
  avatarColor: string;// 头像色
  stance: Stance;     // 立场（决定话术倾向）
  stanceLabel: string;// 立场中文标签
}

export const STRATEGY_MEETING = {
  title: '年度战略规划研讨会',
  subtitle: '2024 年度战略共识会 · 全员参与',
  startTime: '2024-02-05 10:00',
  endTime: '2024-02-05 17:30',
  location: '总部 18 楼会议室 + 全球 12 个分会场视频连线',
  host: '张总（CEO）',
  agenda: [
    { id: 'T1', title: '外部环境扫描', time: '10:00 – 12:00', leader: '战略部 李总' },
    { id: 'T2', title: '公司现状与对标', time: '13:30 – 15:30', leader: 'CEO 张总' },
    { id: 'T3', title: '2024 战略主轴', time: '15:45 – 17:00', leader: 'CEO 张总' },
    { id: 'T4', title: '会议收束与纪要确认', time: '17:00 – 17:30', leader: '战略部 李总' },
  ],
} as const;

// ============================================================
// 4 位主持人 / 参会人
// ============================================================
export const PARTICIPANTS: PersonProfile[] = [
  {
    id: 'p-zhang',
    name: '张总',
    role: 'CEO',
    avatarColor: '#0F2B5B',
    stance: 'opportunity',
    stanceLabel: '机会派',
  },
  {
    id: 'p-wang',
    name: '王总',
    role: 'CIO',
    avatarColor: '#1890ff',
    stance: 'risk',
    stanceLabel: '风险派',
  },
  {
    id: 'p-zhao',
    name: '赵总',
    role: 'CFO',
    avatarColor: '#fa8c16',
    stance: 'finance',
    stanceLabel: '财务派',
  },
  {
    id: 'p-li',
    name: '李总',
    role: '战略部',
    avatarColor: '#52c41a',
    stance: 'customer',
    stanceLabel: '客户派',
  },
];

// ============================================================
// 会前 4 主持人排练（彩排页直接展示）
//   顺序：张总（CEO 议程总览）→ 王总（引导讨论）→ 赵总（控场预算）→ 李总（收束引导）
//   每个 agent 的「思考中…」时长不同，模拟真实差异化输出
// ============================================================
export interface RehearsalScript {
  agentRole: 'moderator' | 'notetaker' | 'decision' | 'action';
  agentName: string;
  agentTitle: string;
  /** 思考时长（ms）—— 不同角色耗时不同，模拟真实差异化 */
  thinkingMs: number;
  /** 单条预演流式输出（拆成多段按时间显示） */
  stream: string[];
  /** 黑板产出 */
  blackboard: {
    topics: string[];
    decisions: string[];
    actions: string[];
    risks: string[];
  };
}

export const REHEARSAL_SCRIPTS: RehearsalScript[] = [
  // ============ 张总 · 议程总览（moderator 角色，最长 8 秒） ============
  {
    agentRole: 'moderator',
    agentName: '张总（CEO）',
    agentTitle: '议程总览 · 主持人开场',
    thinkingMs: 8000,
    stream: [
      '各位同事、各位总监，大家早上好。今天是 2024 年度的战略规划研讨会，是我们一年里最重要的一次集中。',
      '我先用十分钟把今天的议程讲清楚。',
      '第一阶段：外部环境扫描（10:00 – 12:00）。战略部牵头把 2023 年金融行业趋势做一个复盘：监管、客户、竞品、AI 技术。',
      '第二阶段：公司现状与对标（13:30 – 15:30）。把 2023 年的真实数据摊在桌上 —— 收入、利润、毛利率、NPS、员工流失率。然后和恒生电子、宇信科技、金证股份三家标杆横向对比。',
      '第三阶段：2024 战略主轴（15:45 – 17:00）。要达成三个共识：2024 做不做扩张？AI 应用投入的边界？客户分层策略？',
      '我特别强调：今天不是决策会，是共识会。决策会在 2 月 12 号的董事会上。今天要交付的是一份经过充分碰撞的共识文件。',
    ],
    blackboard: {
      topics: [
        '外部环境扫描（10:00–12:00）',
        '公司现状与对标（13:30–15:30）',
        '2024 战略主轴设计（15:45–17:00）',
        '会议收束与纪要确认（17:00–17:30）',
      ],
      decisions: [
        '共识会而非决策会：今天产出共识，2/12 董事会决策',
        '排序原则：客户 > 风险 > 机会',
        '异议机制：所有分歧上桌，台面记录',
      ],
      actions: [
        '战略部准备行业趋势报告（10:00 前）',
        '财务部准备预算框架（13:00 前）',
      ],
      risks: [
        '议程冲突：技术深度 vs 业务广度',
        '决策权边界：今天结论的可执行性',
      ],
    },
  },

  // ============ 王总 · 引导讨论（decision 角色，6 秒） ============
  {
    agentRole: 'decision',
    agentName: '王总（CIO）',
    agentTitle: '讨论引导 · 避免跑题',
    thinkingMs: 6000,
    stream: [
      '各位，2024 我以为起手式会不一样，但实际上起手式必须一样。',
      '今天我要提醒在座三个讨论纪律。',
      '第一，不要把"过去"当"未来"。2023 年我们靠项目交付吃到 14% 增长，但 2024 年项目交付红利已经结束，客户要的是订阅、持续服务、AI 增值。',
      '第二，不要把"行业"当"公司"。行业增速在放缓不假，但行业结构在调整也是事实。我们公司 2023 年 12.8 亿收入里，金融科技占 48%，证券经纪占 32%，其他 20%。',
      '第三，不要把"AI"当"答案"。AI 是工具不是答案，能解决效率问题解决不了战略问题。',
      '今天我们要讨论的是"AI 帮我们做什么业务"，而不是"我们业务里哪些地方 AI"。',
    ],
    blackboard: {
      topics: [
        '2023 项目交付红利已结束',
        '2024 客户要订阅 / 持续服务 / AI 增值',
        'AI 是工具不是答案',
      ],
      decisions: [
        '讨论聚焦"业务"，避免技术自嗨',
        '对标恒生：看差距不看优势',
      ],
      actions: [
        '王总准备标杆对标数据（13:30 前）',
      ],
      risks: [
        '技术跑在业务前面（王总警示）',
        '行业 vs 公司错位讨论',
      ],
    },
  },

  // ============ 赵总 · 控场预算（action 角色，5 秒） ============
  {
    agentRole: 'action',
    agentName: '赵总（CFO）',
    agentTitle: '冲突控场 · 预算约束',
    thinkingMs: 5000,
    stream: [
      '各位，这里我必须提一下，因为等一下讨论到一半，这个冲突一定会出现。',
      '我在 CFO 这个位置上今年看了三遍预算表。2024 年的预算压力比 2023 年大 30%，不是收入预期低，是成本不做不下去。',
      '等一下王总会讲"60% 的新增 IT 预算投入 AI 应用层"，这个数字我是支持的，但我要把代价讲清楚。',
      '2024 年如果拿出 1.2 亿投到 AI 应用层，意味着：传统项目交付团队压缩 15%（约 45 人）、物理机房设备更新延后 6 个月、客户回访/续费相关销售费用降 20%。',
      '所以我提前表态：当 CIO 讲"要投 AI"的时候，我不反对但我要追问"不投什么"。',
      '今天会议最重要的产出，不是"我们要做哪些事"，是"我们不做什么"。',
    ],
    blackboard: {
      topics: [
        '2024 预算压力 +30%（vs 2023）',
        '1.2 亿投 AI 的具体代价清单',
        '"不投什么"和"投什么"同等重要',
      ],
      decisions: [
        '长尾客户重启需附：客户名单 + 客单价 + 成本结构',
        '预算压力前置讨论：今天共识 = 明天 KPI',
      ],
      actions: [
        '赵总准备 2024 预算框架表（13:00 前）',
        'HR 准备 N+1 补偿预案（03-15 前）',
      ],
      risks: [
        '团队压缩 15% 约 45 人',
        '物理机房更新延后 6 个月',
        '销售费用 -20% 影响续费',
      ],
    },
  },

  // ============ 李总 · 收束引导（notetaker 角色，4 秒） ============
  {
    agentRole: 'notetaker',
    agentName: '李总（战略部）',
    agentTitle: '收束引导 · 共识收敛',
    thinkingMs: 4000,
    stream: [
      '各位，今天的会议进行到 17 点 30 分之前，我会做一次总结收束。',
      '我的收束会按照三个清单展开。',
      '第一个清单：共识清单。哪些议题达成了明确共识？是可执行、有条件、还是仅原则同意？这是明天 9 点战略部例会的议程起点。',
      '第二个清单：争议清单。哪些议题存在明确分歧？双方是谁？核心是什么？直接带到 2 月 12 号董事会上。',
      '第三个清单：新增议题清单。哪些议题被临时提出但今天没结论？进入 3 月份月度战略例会议程。',
      '我请各位在离开会议室之前，在会议纪要确认表上完成三件事：检查发言记录、明确表态内容、异议栏说明理由。',
      '纪要会在 24 小时内同步到公司知识库、任务系统、董事会工作群。',
    ],
    blackboard: {
      topics: [
        '三大清单：共识 / 争议 / 新增议题',
        '纪要 24 小时内同步知识库',
        '异议栏强制填写不接受空白',
      ],
      decisions: [
        '会议纪要 24h 内入库（不接受空白异议）',
        '争议项直接进 2/12 董事会',
      ],
      actions: [
        '李总准备纪要模板（17:30 前）',
        '纪要归档 + 知识库入库（02-06 完成）',
      ],
      risks: [
        '纪要确认表空白异议',
        '争议项遗漏导致董事会决断无依据',
      ],
    },
  },
];

// ============================================================
// 会中实时转写：4 人会议 × 3 议题 × 多轮发言
//   time 用「10:00:01」这样的格式，体现真实会议时间戳
//   不同发言间隔不等，模拟人类说话节奏
// ============================================================
export interface TranscriptLine {
  id: number;
  topicId: 'T1' | 'T2' | 'T3' | 'T4';
  speaker: string;
  speakerId: string;
  content: string;
  time: string;
  /** 上一条发言到此条的间隔（秒）—— 用于控制弹出的延迟 */
  delaySec: number;
  type: 'speech' | 'ai-note' | 'summary';
  /** 立场标签，用于发言气泡颜色 */
  stance?: Stance;
}

// 30 条发言，覆盖 3 个议题 + 收尾
// delaySec 1.5–3.5 秒不等，模拟真实节奏
export const TRANSCRIPT_LINES: TranscriptLine[] = [
  // ============ 议题 1：外部环境扫描（10:00 – 12:00） ============
  { id: 1, topicId: 'T1', speaker: '张总', speakerId: 'p-zhang', time: '10:00:08', delaySec: 1.5, type: 'speech', stance: 'opportunity',
    content: '各位同事好，今天的会议主题是「2024 年度战略规划研讨」，我们用 7 小时完成三个核心议题：外部环境扫描、公司现状与对标、2024 战略主轴设计。今天的目标是共识而不是决策，重在讨论质量。' },
  { id: 2, topicId: 'T1', speaker: '张总', speakerId: 'p-zhang', time: '10:00:42', delaySec: 2.8, type: 'speech', stance: 'opportunity',
    content: '2023 整体大环境是"承压调整"，金融业整体增速从 8.2% 降到 5.7%。但我们看到三个结构性的机会：监管层明确支持金融科技、客户数字化需求加速、AI 大模型进入工业可用阶段。我的判断：2024 不是收缩年，是结构升级年。' },
  { id: 3, topicId: 'T1', speaker: '王总', speakerId: 'p-wang', time: '10:01:38', delaySec: 2.6, type: 'speech', stance: 'risk',
    content: '行业趋势我补充两个数据：国内 AI 大模型备案数量截至 2023 年底突破 200 款；证券业 IT 投入占比从 3.8% 提升至 5.5%。但数据合规风险同步上升 —— 监管对大模型应用客户实数据访问、模型训练数据来源、AI 输出用于交易指令的要求会越来越严。我建议 2024 把"合规 AI"作为差异化定位。' },
  { id: 4, topicId: 'T1', speaker: '李总', speakerId: 'p-li', time: '10:02:31', delaySec: 3.1, type: 'speech', stance: 'customer',
    content: '我从客户视角看：中小金融机构"既要降本又要合规"是两难。我们的服务机会不是给他们卖软件，而是用我们的 AI + 知识库帮他们用更少的人做更合规的事。这意味着我们的产品要从工具升级成业务助理。' },
  { id: 5, topicId: 'T1', speaker: '李总', speakerId: 'p-li', time: '10:03:18', delaySec: 2.0, type: 'ai-note',
    content: '【AI 实时标记】三派立场：机会派（张总）扩张优先；风险派（王总）合规优先；客户派（李总）业务助理化。三者不冲突，但有先后顺序。' },

  // ============ 议题 2：公司现状与对标（13:30 – 15:30） ============
  { id: 6, topicId: 'T2', speaker: '张总', speakerId: 'p-zhang', time: '13:30:05', delaySec: 2.2, type: 'speech', stance: 'opportunity',
    content: '2023 我们的收入 12.8 亿，同比 +14%；净利润 1.6 亿，同比 +9%。三大业务板块：金融科技占 48%、证券经纪 32%、其他 20%。问题点：金融科技板块毛利率从 41% 降到 35%。机会点：证券经纪板块客户线上化率高于行业平均 17 个百分点。' },
  { id: 7, topicId: 'T2', speaker: '王总', speakerId: 'p-wang', time: '13:31:14', delaySec: 3.0, type: 'speech', stance: 'risk',
    content: '标杆对标：和恒生电子对比 —— IT 投入占比我们 4.2% vs 恒生 6.8%；AI 能力覆盖率我们 28% vs 恒生 51%；RAG 知识问答准确率我们 71% vs 恒生 82%。差距核心在 AI 应用层深度，不是设备数量。建议 2024 把 60% 的新增 IT 预算投入 AI 应用层。' },
  { id: 8, topicId: 'T2', speaker: '李总', speakerId: 'p-li', time: '13:32:48', delaySec: 3.4, type: 'speech', stance: 'customer',
    content: '我从客户满意度数据补充：2023 NPS 从 47 降到 39，首次跌破 40。客户投诉前三：交付延期 38%、需求理解偏差 27%、响应慢 21%。这三项全部和"AI 应用层"相关 —— 交付延期是项目协同、需求理解偏差是知识管理、响应慢是客服智能化。这不是战略问题，是执行力问题。' },
  { id: 9, topicId: 'T2', speaker: '李总', speakerId: 'p-li', time: '13:34:22', delaySec: 2.5, type: 'ai-note',
    content: '【AI 实时标记】2023 瓶颈图谱：战略层（方向不清晰 → 2024 已明确）→ 执行层（AI 应用落地速度不够 → 2024 解决）→ 组织层（项目协同 / 知识管理 / 客服智能化 → 具体抓手）。' },

  // ============ 议题 3：2024 战略主轴（15:45 – 17:00） ============
  { id: 10, topicId: 'T3', speaker: '张总', speakerId: 'p-zhang', time: '15:45:08', delaySec: 2.0, type: 'speech', stance: 'opportunity',
    content: '我提三个战略主轴：1. 业务助理化 —— 从工具型产品升级为业务助理；2. 合规前置 —— 所有 AI 输出经过合规校验；3. 客户分层运营 —— KA 客户深度服务 + 长尾客户自助化。' },
  { id: 11, topicId: 'T3', speaker: '王总', speakerId: 'p-wang', time: '15:46:01', delaySec: 2.4, type: 'speech', stance: 'risk',
    content: '我支持主轴 1 和 2，主轴 3 我建议聚焦 KA 客户，长尾客户 2024 不作为战略投入方向。理由：长尾客单价低（8 万/年）、服务成本高（人均 12 家）、AI 化后毛利率改善有限。ROI 显著低于 KA。' },
  { id: 12, topicId: 'T3', speaker: '李总', speakerId: 'p-li', time: '15:47:08', delaySec: 3.2, type: 'speech', stance: 'customer',
    content: '王总的数据我同意，但我从客户视角反对：长尾客户是 2024 最大的潜在增量。2023 新增客户 73% 来自长尾，长尾续费率显著高于 KA，AI 客服 + 知识库复用可以让边际成本接近零。建议保留主轴 3，但要先做样板客户，再批量复制。' },
  { id: 13, topicId: 'T3', speaker: '李总', speakerId: 'p-li', time: '15:48:25', delaySec: 2.1, type: 'ai-note',
    content: '【AI 实时标记】主轴 1、2 共识达成。主轴 3 分歧：王总（不投长尾）vs 李总（保留先做样板）vs 张总（待决）。' },
  { id: 14, topicId: 'T3', speaker: '张总', speakerId: 'p-zhang', time: '15:48:55', delaySec: 2.7, type: 'speech', stance: 'opportunity',
    content: '保留主轴 3。执行原则：2024 上半年先聚焦 KA 客户做样板，下半年根据样板复盘再决定是否扩展长尾。这是平衡决策 —— 既不放弃长尾机会，也不盲目扩张。' },

  // ============ 议题 4：会议收束（17:00 – 17:30） ============
  { id: 15, topicId: 'T4', speaker: '李总', speakerId: 'p-li', time: '17:05:12', delaySec: 2.3, type: 'speech',
    content: '三个清单我汇总一下：3 项共识（待办到战略部）、2 项争议（待办到董事会）、4 项新增议题（待办到下次月度会）。请各位在会议纪要确认表上签字 / 留言确认。' },
  { id: 16, topicId: 'T4', speaker: '李总', speakerId: 'p-li', time: '17:06:08', delaySec: 1.8, type: 'summary',
    content: '【会议总结】3 大共识：2024 是结构升级年；战略主轴业务助理化 + 合规前置 + 客户分层；AI 应用落地速度是 2024 关键瓶颈。2 大争议：长尾客户 2024 战略地位（CEO 决定：上半年 KA 样板，下半年复盘）；IT 预算分配比例（待董事会决议）。' },
];

// ============================================================
// 会后报告：5 大板块 + 风险预警 + 行动项
// ============================================================
export const POST_MEETING = {
  summary: {
    oneLine: '2024 是"结构升级年"，不是"收缩年"。会议达成 3 大共识（结构升级年 / 三大战略主轴 / AI 落地是瓶颈）、2 大争议（长尾客户地位 / IT 预算分配），明确"客户 > 风险 > 机会"排序原则。',
    keyPoints: [
      '2024 整体定位：结构升级年，关键词是"升"不是"扩"',
      '三大战略主轴：业务助理化 + 合规前置 + 客户分层运营',
      '客户 > 风险 > 机会 —— 排序明确，资源按此倾斜',
      'AI 应用落地速度是 2024 关键瓶颈，60% 新增 IT 预算投 AI 应用层',
      '长尾客户保留但延后：2024 上半年聚焦 KA 样板，下半年复盘',
    ],
    healthScore: 88,
  },

  decisions: [
    { id: 'D-001', topic: '2024 年度定位', content: '2024 是"结构升级年"，不是"收缩年"', proposer: '张总（CEO）', confidence: 0.96, impact: '公司级' },
    { id: 'D-002', topic: '资源排序原则', content: '客户 > 风险 > 机会', proposer: '张总（CEO）', confidence: 0.98, impact: '资源配置底层逻辑' },
    { id: 'D-003', topic: '战略主轴 1', content: '业务助理化：从"工具型产品"升级为"业务助理"', proposer: '张总（CEO）', confidence: 0.93, impact: '产品定位' },
    { id: 'D-004', topic: '战略主轴 2', content: '合规前置：所有 AI 输出经过合规校验', proposer: '王总（CIO）', confidence: 0.95, impact: 'AI 应用边界' },
    { id: 'D-005', topic: '战略主轴 3', content: '客户分层运营：上半年 KA 深度服务，下半年复盘是否扩展长尾', proposer: 'CEO 拍板（王总 vs 李总分歧）', confidence: 0.85, impact: '客户战略' },
  ],

  actions: [
    { id: 'A-001', content: '2024 战略主轴方案', owner: '张总', deadline: '02-12', priority: '高', status: 'in_progress', relatedTopic: 'T3' },
    { id: 'A-002', content: 'IT 预算分配方案（含 60% AI 应用层）', owner: '王总', deadline: '02-09', priority: '高', status: 'in_progress', relatedTopic: 'T3' },
    { id: 'A-003', content: 'KA 样板客户名单（5 家以上签约）', owner: '李总', deadline: '02-26', priority: '高', status: 'todo', relatedTopic: 'T3' },
    { id: 'A-004', content: 'AI 应用路线图（3 个月内 3 个试点）', owner: '王总', deadline: '03-15', priority: '高', status: 'todo', relatedTopic: 'T2' },
    { id: 'A-005', content: '合规校验中间件（所有 AI 输出经校验）', owner: '风控总监', deadline: '03-31', priority: '高', status: 'todo', relatedTopic: 'T3' },
    { id: 'A-006', content: 'NPS 提升专项（NPS ≥ 45）', owner: '李总', deadline: '06-30', priority: '中', status: 'todo', relatedTopic: 'T2' },
    { id: 'A-007', content: '长尾样板复盘（决定是否扩展长尾）', owner: '李总', deadline: '08-31', priority: '中', status: 'todo', relatedTopic: 'T3' },
    { id: 'A-008', content: '纪要归档 + 知识库入库', owner: 'AI 助理', deadline: '02-06', priority: '高', status: 'done', relatedTopic: 'T4' },
  ],

  risks: [
    { id: 'R-001', level: '高', type: '财务风险', content: '传统项目交付团队压缩 15%（约 45 人）', owner: '赵总（CFO）', mitigation: 'HR 提前沟通，N+1 补偿预案' },
    { id: 'R-002', level: '高', type: '合规风险', content: 'AI 输出用于交易指令的监管红线', owner: '王总（CIO）', mitigation: '风控合规前置校验中间件' },
    { id: 'R-003', level: '中', type: '执行风险', content: 'AI 应用层 3 个月内 3 个试点是否能落地', owner: '王总（CIO）', mitigation: '周例会跟踪 + 迭代复盘' },
    { id: 'R-004', level: '中', type: '客户风险', content: 'NPS 跌破 40，KA 客户流失风险', owner: '李总（战略部）', mitigation: '客户成功团队介入 + VIP 回访' },
    { id: 'R-005', level: '中', type: '组织风险', content: '60% 预算投入 AI，组织文化抵触', owner: 'CEO 张总', mitigation: 'CEO 主导宣贯，月度 OKR 挂钩' },
  ],

  topics: [
    { id: 'T-001', title: '外部环境扫描', duration: '120 分钟', summary: '复盘 2023 金融业整体趋势：监管利好、数字化需求加速、AI 红利窗口', keyConclusion: '2024 是结构升级年，关键词是"升"不是"扩"' },
    { id: 'T-002', title: '公司现状与对标', duration: '120 分钟', summary: '收入 12.8 亿 +14%，与恒生差距 23pp AI 覆盖、11pp RAG 准确率', keyConclusion: '瓶颈在 AI 应用落地速度，不在战略方向' },
    { id: 'T-003', title: '2024 战略主轴', duration: '75 分钟', summary: '业务助理化 + 合规前置 + 客户分层，长尾保留但延后', keyConclusion: '主轴 1/2 共识，主轴 3 上半年 KA 样板下半年复盘' },
    { id: 'T-004', title: '会议收束', duration: '30 分钟', summary: '3 共识 + 2 争议 + 4 新增议题，纪要 24h 同步知识库', keyConclusion: '所有异议上桌，24h 纪要入库' },
  ],

  keyData: {
    revenue: { value: '12.8 亿', delta: '+14%' },
    profit: { value: '1.6 亿', delta: '+9%' },
    nps: { value: '39', delta: '-8' },
    aiCoverage: { value: '28% vs 51%', delta: '-23pp（vs 恒生）' },
    itSpend: { value: '4.2% vs 6.8%', delta: '-2.6pp（vs 恒生）' },
    digitalRate: { value: '61%', delta: '+29pp' },
  },

  leaderRemarks: [
    { speaker: '张总（CEO）', points: ['2024 是结构升级年，不是收缩年', '排序：客户 > 风险 > 机会', '共识质量优于共识速度', '保留异议机制，鼓励台面分歧'] },
    { speaker: '王总（CIO）', points: ['战略定位：合规金融科技', '60% 新增 IT 预算投入 AI 应用层', '反对意见：长尾客户不投', '警示：技术跑在业务前面的风险'] },
    { speaker: '赵总（CFO）', points: ['预算压力 +30%（vs 2023）', '"不投什么"和"投什么"同等重要', '反对意见：传统团队压缩 15%', '警示：今天共识明天变 KPI 约束'] },
    { speaker: '李总（战略部）', points: ['主张业务助理化，不是工具化', '主张长尾客户保留，先做样板', '警示：执行问题不是战略问题', '数据：NPS 跌破 40 是危险信号'] },
  ],
};

// ============================================================
// Mermaid 思维导图（Markdown 源码）
// ============================================================
export const MERMAID_MINDMAP = `mindmap
  root((2024 年度战略<br/>规划研讨会))
    外部环境扫描
      行业趋势
        增速放缓 8.2%→5.7%
        监管利好 央行金融科技要点
        AI 红利窗口
        备案模型突破 200+
        IT 投入占比 3.8%→5.5%
      客户需求
        数字化 32%→61%
        降本+合规两难
        业务助理化机会
      三派立场
        机会派 张总 扩张优先
        风险派 王总 合规优先
        客户派 李总 业务助理优先
        排序结果 客户>风险>机会
    公司现状对标
      经营数据
        收入 12.8 亿 +14%
        净利 1.6 亿 +9%
        金融科技毛利 41%→35%
        证券经纪毛利 68% +3pp
      标杆差距
        IT 投入 4.2% vs 6.8%
        AI 覆盖 28% vs 51%
        RAG 准确率 71% vs 82%
        NPS 39 低于平均 19
      执行瓶颈
        交付延期 38%
        需求理解偏差 27%
        响应慢 21%
        三系统分离问题
    2024 战略主轴
      业务助理化
        工具→助理升级
        共识达成
      合规前置
        AI 输出合规校验
        共识达成
      客户分层
        KA 深度服务
        长尾 2024 先样板
        上半年聚焦 KA
        下半年复盘长尾
      资源配置
        60% IT 投 AI 应用层
        待董事会决议
        代价 传统团队 -15%
    行动项
      战略主轴方案 张总 02-12
      IT 预算分配 王总 02-09
      KA 样板客户 李总 02-26
      AI 试点 3 个 王总 03-15
      合规中间件 风控 03-31
      NPS 提升专项 李总 06-30
      长尾复盘 李总 08-31
      纪要归档入库 AI助理 02-06
    风险预警
      财务风险
        团队压缩 15%
      合规风险
        AI 输出红线
      执行风险
        3 个月 3 试点
      客户风险
        NPS 跌破 40
      组织风险
        AI 投入文化抵触`;
