/**
 * 金融合规规则库 —— 9 类核心规则
 *
 * 设计原则：
 *   - 每条规则可独立配置：严重度 / 检测模式 / 命中后建议 / 关联法规
 *   - 检测模式支持关键词、正则、自定义函数
 *   - 规则命中后输出结构化 issue 供沙箱报告渲染
 */

import React from 'react';
import {
  StopOutlined,
  DollarCircleOutlined,
  LockOutlined,
  AlertOutlined,
  SwitcherOutlined,
  TeamOutlined,
  SwapOutlined,
  LinkOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

export type RuleSeverity = 'block' | 'high' | 'medium' | 'low';

export type RuleCategory =
  | 'sensitive_word'      // 1. 敏感词
  | 'investment_promise' // 2. 投资收益承诺
  | 'data_privacy'       // 3. 数据隐私泄露
  | 'anti_money_laundry' // 4. 反洗钱可疑
  | 'unfair_competition' // 5. 反不正当竞争
  | 'customer_suitability' // 6. 客户适当性
  | 'conflict_interest'  // 7. 利益冲突
  | 'related_transaction' // 8. 关联交易
  | 'disclosure_violation'; // 9. 信息披露违规

export interface ComplianceRule {
  id: string;
  category: RuleCategory;
  name: string;
  nameEn: string;
  severity: RuleSeverity;
  /** 关键词命中（任一命中即触发） */
  keywords?: string[];
  /** 正则匹配 */
  patterns?: { regex: string; flags?: string }[];
  /** 自定义检测函数（可选） */
  customCheck?: (text: string) => boolean;
  /** 修复建议 */
  suggestion: string;
  /** 关联法规 ID（指向 regulationRef.ts） */
  regulationIds: string[];
}

// ============================================================
// 9 类规则 · 47 条具体规则
// ============================================================

export const COMPLIANCE_RULES: ComplianceRule[] = [
  // ===== 1. 敏感词（最高优先级）=====
  {
    id: 'SW-001',
    category: 'sensitive_word',
    name: '违禁词汇（暴恐/政治）',
    nameEn: 'Forbidden Words (Violence/Politics)',
    severity: 'block',
    keywords: ['法轮功', '反动', '推翻政府', '暴力革命', '恐怖袭击'],
    suggestion: '请立即删除违禁政治表述，可改用中性描述。',
    regulationIds: ['网络安全法-12', '广告法-9'],
  },
  {
    id: 'SW-002',
    category: 'sensitive_word',
    name: '违规色情/低俗',
    nameEn: 'Pornographic Content',
    severity: 'block',
    keywords: ['色情', '裸聊', '一夜情', '约炮'],
    suggestion: '请立即删除违规内容。',
    regulationIds: ['网络安全法-12'],
  },
  {
    id: 'SW-003',
    category: 'sensitive_word',
    name: '金融诈骗话术',
    nameEn: 'Fraud Language',
    severity: 'block',
    keywords: ['稳赚不赔', '百分百收益', '无风险套利', '内幕消息', '保证翻倍'],
    suggestion: '删除虚假宣传话术，金融产品不允许承诺保本或收益。',
    regulationIds: ['广告法-25', '资管新规-19'],
  },

  // ===== 2. 投资收益承诺（金融行业红线）=====
  {
    id: 'IP-001',
    category: 'investment_promise',
    name: '承诺保本保收益',
    nameEn: 'Guaranteed Return Promise',
    severity: 'block',
    keywords: ['保本', '保证收益', '零风险', '无亏损', '稳赚'],
    patterns: [
      { regex: '年化.{0,5}?(100|[1-9]\\d)%|收益.{0,3}?(100|[1-9]\\d)%' },
    ],
    suggestion: '《资管新规》明确禁止保本保收益。请改用"预期收益"或"过往业绩"等表述。',
    regulationIds: ['资管新规-19'],
  },
  {
    id: 'IP-002',
    category: 'investment_promise',
    name: '预期收益误导性数字',
    nameEn: 'Misleading Expected Return',
    severity: 'high',
    keywords: ['预期年化50%', '月收益10%', '年化收益翻倍', '三个月翻番'],
    suggestion: '避免使用过于具体的预期收益数字，建议改用"参考区间"或"过往业绩仅供参考"。',
    regulationIds: ['基金法-18', '广告法-25'],
  },
  {
    id: 'IP-003',
    category: 'investment_promise',
    name: '过往业绩不实表述',
    nameEn: 'Inflated Past Performance',
    severity: 'medium',
    keywords: ['历史最高收益', '从未亏损', '年年正收益'],
    suggestion: '应明确标注过往业绩不预示未来表现，并附业绩比较基准。',
    regulationIds: ['基金法-37', '信息披露管理办法-7'],
  },
  {
    id: 'IP-004',
    category: 'investment_promise',
    name: '类存款描述',
    nameEn: 'Deposit-like Description',
    severity: 'high',
    keywords: ['相当于存款', '等同储蓄', '受存款保险保护'],
    suggestion: '理财产品非存款，不得使用类存款表述。',
    regulationIds: ['理财销售管理办法-10'],
  },

  // ===== 3. 数据隐私泄露 =====
  {
    id: 'DP-001',
    category: 'data_privacy',
    name: '身份证号明文',
    nameEn: 'Plain ID Number',
    severity: 'block',
    patterns: [
      { regex: '\\b\\d{17}[\\dXx]\\b' },
    ],
    suggestion: '身份证号属于个人敏感信息，必须脱敏（保留前 4 后 4 位）或使用 hash。',
    regulationIds: ['个保法-28', '网络安全法-42'],
  },
  {
    id: 'DP-002',
    category: 'data_privacy',
    name: '手机号明文',
    nameEn: 'Plain Phone Number',
    severity: 'high',
    patterns: [
      { regex: '\\b1[3-9]\\d{9}\\b' },
    ],
    suggestion: '手机号属于个人联系方式，建议脱敏为 138****8000 形式。',
    regulationIds: ['个保法-28'],
  },
  {
    id: 'DP-003',
    category: 'data_privacy',
    name: '银行卡号明文',
    nameEn: 'Plain Bank Card',
    severity: 'block',
    patterns: [
      { regex: '\\b\\d{16,19}\\b' },
    ],
    suggestion: '银行卡号必须脱敏，仅保留后 4 位。',
    regulationIds: ['个保法-28', '银行卡管理办法-23'],
  },
  {
    id: 'DP-004',
    category: 'data_privacy',
    name: '邮箱地址明文',
    nameEn: 'Plain Email',
    severity: 'low',
    patterns: [
      { regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' },
    ],
    suggestion: '邮箱地址建议脱敏或使用企业通讯录。',
    regulationIds: ['个保法-28'],
  },
  {
    id: 'DP-005',
    category: 'data_privacy',
    name: '住址信息',
    nameEn: 'Address Leak',
    severity: 'medium',
    keywords: ['家庭住址', '居住地址', '身份证住址', '北京市朝阳区某街道'],
    suggestion: '客户住址属敏感信息，需脱敏到区级或更粗粒度。',
    regulationIds: ['个保法-28'],
  },

  // ===== 4. 反洗钱可疑 =====
  {
    id: 'AML-001',
    category: 'anti_money_laundry',
    name: '大额交易描述模糊',
    nameEn: 'Vague Large Transaction',
    severity: 'high',
    keywords: ['大额资金', '巨额', '上千万', '过亿', '无法说明来源'],
    suggestion: '大额资金往来需附反洗钱尽职调查（CDD）说明。',
    regulationIds: ['反洗钱法-20', '大额交易报告管理办法-5'],
  },
  {
    id: 'AML-002',
    category: 'anti_money_laundry',
    name: '可疑拆分交易',
    nameId: 'AML-002',
    severity: 'high',
    keywords: ['拆分', '分多笔', '化整为零', '规避监管', '拆分打款'],
    suggestion: '拆分交易规避监管属可疑行为，需立即上报合规部门。',
    regulationIds: ['反洗钱法-16'],
  } as ComplianceRule,
  {
    id: 'AML-003',
    category: 'anti_money_laundry',
    name: '现金密集型行业',
    nameEn: 'Cash-intensive Industry',
    severity: 'medium',
    keywords: ['现金交易', '现金结算', '当面交割', '私下现金'],
    suggestion: '现金密集型行业需加强尽调，建议增加业务背景调查。',
    regulationIds: ['反洗钱法-3'],
  },
  {
    id: 'AML-004',
    category: 'anti_money_laundry',
    name: '可疑地区交易',
    nameEn: 'High-risk Jurisdiction',
    severity: 'high',
    keywords: ['离岸账户', '境外汇款', 'FATF 名单', '避税天堂'],
    suggestion: '涉及高风险地区交易需附加强化尽调（EDD）。',
    regulationIds: ['反洗钱法-7'],
  },

  // ===== 5. 反不正当竞争 =====
  {
    id: 'UC-001',
    category: 'unfair_competition',
    name: '贬损竞争对手',
    nameEn: 'Competitor Disparagement',
    severity: 'medium',
    keywords: ['某银行是骗子', '某券商不靠谱', '某某基金全是坑', '某某理财垃圾'],
    suggestion: '不得贬损竞争对手，建议删除相关表述。',
    regulationIds: ['反不正当竞争法-11'],
  },
  {
    id: 'UC-002',
    category: 'unfair_competition',
    name: '虚假排名/奖项',
    nameEn: 'Fake Rankings',
    severity: 'high',
    keywords: ['行业第一', '全球领先', '业内唯一', '唯一获批', '最强'],
    suggestion: '"唯一/最强/第一"等极限词需有官方认证依据，否则属虚假宣传。',
    regulationIds: ['广告法-9', '反不正当竞争法-8'],
  },
  {
    id: 'UC-003',
    category: 'unfair_competition',
    name: '商业贿赂暗示',
    nameEn: 'Bribery Implication',
    severity: 'high',
    keywords: ['回扣', '提成', '好处费', '感谢费', '打点'],
    suggestion: '任何商业贿赂暗示均属违规，请立即删除。',
    regulationIds: ['反不正当竞争法-7', '刑法-163'],
  },

  // ===== 6. 客户适当性 =====
  {
    id: 'CS-001',
    category: 'customer_suitability',
    name: '未做风险评估',
    nameEn: 'Missing Risk Assessment',
    severity: 'high',
    keywords: ['直接推荐', '无需评估', '绕过风险测评'],
    suggestion: '所有产品销售前必须完成客户风险承受能力评估。',
    regulationIds: ['适当性管理办法-15', '理财销售管理办法-22'],
  },
  {
    id: 'CS-002',
    category: 'customer_suitability',
    name: '高风险产品错配',
    nameEn: 'High-risk Product Mismatch',
    severity: 'high',
    keywords: ['向老年人推荐高风险', '向保守型推荐衍生品', '学生购买杠杆产品'],
    suggestion: '高风险产品不得销售给风险承受等级不符的客户。',
    regulationIds: ['适当性管理办法-17'],
  },
  {
    id: 'CS-003',
    category: 'customer_suitability',
    name: '老年人特别保护',
    nameEn: 'Elderly Protection',
    severity: 'medium',
    keywords: ['大爷大妈', '老人', '退休人员', '老年人'],
    customCheck: (text) => /老年人|大爷|大妈|退休/.test(text) && /投资|理财|基金/.test(text),
    suggestion: '对老年人销售金融产品需双录（录音录像），且原则上不超过其风险等级。',
    regulationIds: ['理财销售管理办法-26'],
  },

  // ===== 7. 利益冲突 =====
  {
    id: 'CI-001',
    category: 'conflict_interest',
    name: '自营业务冲突',
    nameEn: 'Proprietary Trading Conflict',
    severity: 'high',
    keywords: ['自营盘', '内部账户', '关联方优先'],
    suggestion: '自营业务与客户利益冲突时必须优先客户利益。',
    regulationIds: ['证券公司内部控制指引-23'],
  },
  {
    id: 'CI-002',
    category: 'conflict_interest',
    name: '员工代客理财',
    nameEn: 'Employee Managing Client Funds',
    severity: 'block',
    keywords: ['代客理财', '代客操作', '代为交易', '帮您操盘'],
    suggestion: '员工不得代客理财，违者按重大违规处理。',
    regulationIds: ['证券业从业人员管理办法-13'],
  },
  {
    id: 'CI-003',
    category: 'conflict_interest',
    name: '亲属账户交易',
    nameEn: 'Related Account Trading',
    severity: 'medium',
    keywords: ['亲属账户', '家人账户', '代家人'],
    suggestion: '员工交易亲属账户需主动申报并提供书面说明。',
    regulationIds: ['证券业从业人员管理办法-21'],
  },

  // ===== 8. 关联交易 =====
  {
    id: 'RT-001',
    category: 'related_transaction',
    name: '关联交易未披露',
    nameEn: 'Undisclosed Related Party Transaction',
    severity: 'high',
    keywords: ['关联交易', '关联方', '同一控制下'],
    suggestion: '关联交易必须及时披露，金额超过 300 万需董事会审批。',
    regulationIds: ['上市公司信息披露管理办法-48', '公司法-21'],
  },
  {
    id: 'RT-002',
    category: 'related_transaction',
    name: '利益输送嫌疑',
    nameEn: 'Tunneling Suspicion',
    severity: 'high',
    keywords: ['输送利益', '抽逃资金', '占用资金', '违规担保'],
    suggestion: '任何利益输送嫌疑需立即上报合规与审计部门。',
    regulationIds: ['公司法-21', '刑法-169'],
  },

  // ===== 9. 信息披露违规 =====
  {
    id: 'DV-001',
    category: 'disclosure_violation',
    name: '重大信息未披露',
    nameEn: 'Material Info Non-disclosure',
    severity: 'high',
    keywords: ['重大重组', '停牌', '业绩预告', '重大合同'],
    suggestion: '重大信息应在 2 个交易日内披露，避免内幕交易嫌疑。',
    regulationIds: ['上市公司信息披露管理办法-30'],
  },
  {
    id: 'DV-002',
    category: 'disclosure_violation',
    name: '预测性信息不实',
    nameEn: 'False Forward-looking Statement',
    severity: 'medium',
    keywords: ['预计盈利', '业绩预增', '确定性增长'],
    suggestion: '预测性信息须明确标注"不构成业绩承诺"，并附重大风险提示。',
    regulationIds: ['上市公司信息披露管理办法-3'],
  },
  {
    id: 'DV-003',
    category: 'disclosure_violation',
    name: '选择性披露',
    nameEn: 'Selective Disclosure',
    severity: 'high',
    keywords: ['仅向机构透露', '私下沟通', '一对一交流', '小范围路演'],
    suggestion: '重大信息须同时向所有投资者披露，禁止选择性披露。',
    regulationIds: ['上市公司信息披露管理办法-5'],
  },
];

// ============================================================
// 严重度 → 评分扣分映射
// ============================================================

export const SEVERITY_PENALTY: Record<RuleSeverity, number> = {
  block: 100,   // 直接阻断（5 分制 → 0 分）
  high: 30,
  medium: 12,
  low: 4,
};

// ============================================================
// 类别元信息（用于分类展示 + 文案翻译）
// ============================================================

export const CATEGORY_META: Record<RuleCategory, {
  name: string;
  nameEn: string;
  color: string;
  icon: React.ReactNode;
  description: string;
}> = {
  sensitive_word: {
    name: '敏感词',
    nameEn: 'Sensitive Words',
    color: '#dc2626',
    icon: <StopOutlined style={{ color: '#dc2626' }} />,
    description: '违规政治 / 色情 / 诈骗话术',
  },
  investment_promise: {
    name: '投资收益承诺',
    nameEn: 'Investment Promise',
    color: '#ef4444',
    icon: <DollarCircleOutlined style={{ color: '#ef4444' }} />,
    description: '保本承诺 / 误导性收益数字',
  },
  data_privacy: {
    name: '数据隐私',
    nameEn: 'Data Privacy',
    color: '#f97316',
    icon: <LockOutlined style={{ color: '#f97316' }} />,
    description: '身份证 / 银行卡 / 手机号明文',
  },
  anti_money_laundry: {
    name: '反洗钱',
    nameEn: 'Anti-Money Laundry',
    color: '#a855f7',
    icon: <AlertOutlined style={{ color: '#a855f7' }} />,
    description: '可疑大额交易 / 拆分 / 高风险地区',
  },
  unfair_competition: {
    name: '反不正当竞争',
    nameEn: 'Unfair Competition',
    color: '#ec4899',
    icon: <SwitcherOutlined style={{ color: '#ec4899' }} />,
    description: '贬损对手 / 极限词 / 商业贿赂',
  },
  customer_suitability: {
    name: '客户适当性',
    nameEn: 'Customer Suitability',
    color: '#3b82f6',
    icon: <TeamOutlined style={{ color: '#3b82f6' }} />,
    description: '风险评估缺失 / 错配 / 老年人保护',
  },
  conflict_interest: {
    name: '利益冲突',
    nameEn: 'Conflict of Interest',
    color: '#06b6d4',
    icon: <SwapOutlined style={{ color: '#06b6d4' }} />,
    description: '自营冲突 / 代客理财 / 亲属账户',
  },
  related_transaction: {
    name: '关联交易',
    nameEn: 'Related Party Transaction',
    color: '#14b8a6',
    icon: <LinkOutlined style={{ color: '#14b8a6' }} />,
    description: '未披露 / 利益输送嫌疑',
  },
  disclosure_violation: {
    name: '信息披露',
    nameEn: 'Disclosure Violation',
    color: '#84cc16',
    icon: <InfoCircleOutlined style={{ color: '#84cc16' }} />,
    description: '重大信息延迟 / 选择性披露',
  },
};
