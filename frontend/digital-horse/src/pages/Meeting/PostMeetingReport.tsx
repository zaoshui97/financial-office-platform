/**
 * 会后报告（独立完整版）
 * 路径: /meeting/:id/report
 *
 * 设计说明：
 *   - 由 "会后报告 Drawer" 的「查看完整报告」按钮跳转进入
 *   - Drawer 内只展示概要，独立页展示完整结构化报告（6 大章节 + 详情表格）
 *   - 演示模式下数据从 DEMO_REPORT_DATA 同步读取，0 异步等待 / 0 转圈
 *   - 平台名统一为「睿枢」
 */

import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Breadcrumb,
  Tag,
  Statistic,
  Row,
  Col,
  Divider,
  Table,
} from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  FileTextOutlined,
  PrinterOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { DEMO_REPORT_DATA, DEMO_MEETING_TITLE } from '@/mock/meetingDemo';
import '@/styles/print.css';

const { Title, Text, Paragraph } = Typography;

// ============================================================
// 组件定义
// ============================================================

const PostMeetingReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

  const handleBack = () => {
    if (id) navigate(`/meeting/${id}`);
  };

  // ============================================================
  // 演示模式：数据直接从 DEMO_REPORT_DATA 同步读取
  // 不发任何异步请求，0 转圈
  // ============================================================
  const data = {
    meta: {
      meetingTitle: DEMO_MEETING_TITLE,
      startedAt: '2026-09-23 20:41:55',
      endedAt: '2026-09-23 21:12:30',
      durationSec: 1835,
      location: '线上会议 · 睿枢会议室',
      host: '王总（财务总监）',
      participants: DEMO_REPORT_DATA.participants.map((name) => {
        const match = name.match(/^(\S+)（(.+)）$/);
        return match ? { name: match[1], role: match[2] } : { name, role: '参会人' };
      }),
      meetingType: '部门专题会',
      confidentiality: '内部',
    },
    summary: {
      oneLine: DEMO_REPORT_DATA.summary,
      keyPoints: [
        `技术债整改预算 800 万分两期拨付（一期 500 万 / 二期 300 万）`,
        `合规整改预算 200 万紧急采购，月底前完成供应商签约`,
        `识别出 2 项风险信号：数据泄露风险 + 监管处罚风险`,
        `会后自动派发 6 条待办，全部到达责任人工作台`,
      ],
      healthScore: 92,
    },
    decisions: DEMO_REPORT_DATA.sections.decisions.map((d, i) => ({
      id: `D-${String(i + 1).padStart(3, '0')}`,
      content: d.decision,
      topic: d.topic,
      proposer: d.owner || '—',
      confidence: d.confidence,
      impact: '影响后续执行节奏',
      basis: '由睿枢实时识别并标记',
      timestamp: '20:55:12',
    })),
    actions: DEMO_REPORT_DATA.sections.actions.map((a) => ({
      id: a.id,
      content: a.description,
      owner: a.assignee || '未指派',
      deadline: a.dueDate || '—',
      priority: a.priority === 'high' ? '高' : a.priority === 'medium' ? '中' : '低',
      relatedTopic: 'T-001',
      status: a.status === 'done' ? '已完成' : a.status === 'in_progress' ? '进行中' : '待开始',
    })),
    risks: DEMO_REPORT_DATA.sections.risks.map((r, i) => ({
      id: `R-${String(i + 1).padStart(3, '0')}`,
      level: '中',
      type: i === 0 ? '合规风险' : '监管风险',
      content: r,
      owner: '李娜（合规经理）',
      mitigation: '已制定应对方案，纳入下次例会跟进',
    })),
    topics: [
      { id: 'T-001', title: 'Q4 预算审批', duration: '12 分钟', summary: '审议 Q4 年度预算分配方案', keyConclusion: '技术债 + 合规两专项通过审批' },
      { id: 'T-002', title: '技术债整改方案', duration: '10 分钟', summary: '讨论 23 个遗留系统改造', keyConclusion: '800 万分两期拨付，本月 500 万到位' },
      { id: 'T-003', title: '合规整改计划', duration: '8 分钟', summary: '银保监会新规应对方案', keyConclusion: '200 万紧急采购，月底前完成签约' },
      { id: 'T-004', title: '采购流程协助', duration: '5 分钟', summary: '张三协助李娜完成采购审批', keyConclusion: '7 天内完成协助' },
    ],
    closure: {
      decisionLanding: { total: 4, landed: 2, inProgress: 2, overdue: 0 },
      actionComplete: { total: 6, completed: 2, inProgress: 2, pending: 2, overdue: 0 },
      durationEfficiency: 95,
      focusRatio: 88,
    },
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const content = generateMarkdown(data);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `会议报告_${data.meta.meetingTitle}_${data.meta.startedAt.slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 表格列定义
  const decisionColumns = [
    { title: '编号', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '决策内容',
      dataIndex: 'content',
      key: 'content',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.topic}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{text}</div>
        </div>
      ),
    },
    { title: '提出人', dataIndex: 'proposer', key: 'proposer', width: 100 },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (c: number) => <Tag color="blue">{(c * 100).toFixed(0)}%</Tag>,
    },
  ];

  const actionColumns = [
    { title: '编号', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '任务内容',
      dataIndex: 'content',
      key: 'content',
      render: (text: string) => <div style={{ fontWeight: 500 }}>{text}</div>,
    },
    { title: '责任人', dataIndex: 'owner', key: 'owner', width: 100 },
    { title: '截止时间', dataIndex: 'deadline', key: 'deadline', width: 120 },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (p: string) => {
        const colorMap: Record<string, string> = { 高: 'red', 中: 'orange', 低: 'default' };
        return <Tag color={colorMap[p]}>{p}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const colorMap: Record<string, string> = {
          已完成: 'success',
          进行中: 'processing',
          待开始: 'default',
        };
        return <Tag color={colorMap[s]}>{s}</Tag>;
      },
    },
  ];

  const riskColumns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (l: string) => {
        const colorMap: Record<string, string> = { 高: 'red', 中: 'orange', 低: 'blue' };
        return <Tag color={colorMap[l]}>{l}</Tag>;
      },
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
    {
      title: '风险描述',
      dataIndex: 'content',
      key: 'content',
      render: (text: string) => <div>{text}</div>,
    },
    { title: '责任人', dataIndex: 'owner', key: 'owner', width: 100 },
    {
      title: '应对措施',
      dataIndex: 'mitigation',
      key: 'mitigation',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
  ];

  return (
    <div ref={reportRef} style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* 打印头 */}
      <div className="print-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="report-brand-header">
            睿枢
            <span className="confidential-mark">内部</span>
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {data.meta.meetingTitle} | {data.meta.startedAt.slice(0, 10)} | 自动生成
          </div>
        </div>
      </div>

      {/* 面包屑 */}
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <a onClick={() => navigate('/meeting')}>会议</a> },
          { title: <a onClick={handleBack}>{data.meta.meetingTitle}</a> },
          { title: '会后报告' },
        ]}
      />

      {/* 顶部标题区 */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack} />
            <Title level={3} style={{ margin: 0 }}>
              {data.meta.meetingTitle}
            </Title>
            <Tag color="success">睿枢自动生成</Tag>
          </Space>

          <Space size={24} wrap>
            <Space size={4}>
              <CalendarOutlined />
              <Text type="secondary">{data.meta.startedAt}</Text>
            </Space>
            <Space size={4}>
              <ClockCircleOutlined />
              <Text type="secondary">
                {Math.floor(data.meta.durationSec / 60)} 分钟
              </Text>
            </Space>
            <Space size={4}>
              <TeamOutlined />
              <Text type="secondary">{data.meta.participants.length} 人参会</Text>
            </Space>
            <Space size={4}>
              <Text type="secondary">主持人：{data.meta.host}</Text>
            </Space>
          </Space>

          <Divider style={{ margin: '12px 0' }} />

          {/* 核心统计 */}
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="关键决策"
                value={data.decisions.length}
                valueStyle={{ color: '#10B981' }}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="待办事项"
                value={data.actions.length}
                valueStyle={{ color: '#0F2B5B' }}
                prefix={<FileTextOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="风险信号"
                value={data.risks.length}
                valueStyle={{ color: '#EF4444' }}
                prefix={<AlertOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="议题讨论"
                value={data.topics.length}
                valueStyle={{ color: '#6366F1' }}
                prefix={<ThunderboltOutlined />}
              />
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          {/* 操作按钮 */}
          <Space wrap>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              打印报告
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 Markdown
            </Button>
            <Button onClick={handleBack}>返回会议室</Button>
          </Space>
        </Space>
      </Card>

      {/* 第一部分：会议概况 */}
      <Card title="一、会议概况" style={{ marginBottom: 16 }}>
        <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>
          <Text strong>会议总结：</Text>
          {data.summary.oneLine}
        </Paragraph>

        <Title level={5} style={{ marginTop: 16 }}>
          <CheckCircleOutlined style={{ color: '#10B981', marginRight: 8 }} />
          核心要点
        </Title>
        <ul style={{ paddingLeft: 20 }}>
          {data.summary.keyPoints.map((point, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              {point}
            </li>
          ))}
        </ul>

        <Divider />

        <Title level={5}>参会人员</Title>
        <Space wrap>
          {data.meta.participants.map((p, i) => (
            <Tag key={i} color="blue" style={{ padding: '4px 12px' }}>
              {p.name} · {p.role}
            </Tag>
          ))}
        </Space>
      </Card>

      {/* 第二部分：关键决策 */}
      <Card
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#10B981' }} />
            <span>二、关键决策</span>
            <Tag color="green">{data.decisions.length} 条</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph type="secondary">
          决策由睿枢实时识别并标记。系统通过语义分析判断发言中是否包含"决定""同意""按照""确认采用"等核心决策信号，并对每条决策给出置信度评分。
        </Paragraph>
        <Table
          dataSource={data.decisions}
          columns={decisionColumns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 第三部分：待办事项 */}
      <Card
        title={
          <Space>
            <FileTextOutlined style={{ color: '#0F2B5B' }} />
            <span>三、待办事项</span>
            <Tag color="blue">{data.actions.length} 条</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph type="secondary">
          待办由睿枢实时识别并生成。所有待办已自动派发到责任人个人工作台，无需人工转达。
        </Paragraph>
        <Table
          dataSource={data.actions}
          columns={actionColumns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 第四部分：风险信号 */}
      <Card
        title={
          <Space>
            <AlertOutlined style={{ color: '#EF4444' }} />
            <span>四、风险信号</span>
            <Tag color="red">{data.risks.length} 条</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph type="secondary">
          风险由睿枢实时扫描发言内容，结合金融监管规则库匹配。会中实时识别合规风险、执行风险、声誉风险。
        </Paragraph>
        <Table
          dataSource={data.risks}
          columns={riskColumns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 第五部分：议题讨论记录 */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#6366F1' }} />
            <span>五、议题讨论记录</span>
            <Tag color="purple">{data.topics.length} 个议题</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph type="secondary">
          议题由睿枢管理，实时识别议题切换、离题发言、时间超支，并通过温和提示帮助主持人把控节奏。
        </Paragraph>
        {data.topics.map((topic) => (
          <Card
            key={topic.id}
            type="inner"
            size="small"
            title={
              <Space>
                <Tag color="purple">{topic.id}</Tag>
                <span>{topic.title}</span>
                <Tag>{topic.duration}</Tag>
              </Space>
            }
            style={{ marginBottom: 12 }}
          >
            <Paragraph style={{ marginBottom: 8 }}>
              <Text strong>讨论摘要：</Text>
              {topic.summary}
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>
              <Text strong>主要结论：</Text>
              <Tag color="success">{topic.keyConclusion}</Tag>
            </Paragraph>
          </Card>
        ))}
      </Card>

      {/* 第六部分：闭环验证 */}
      <Card
        title={
          <Space>
            睿枢
            <span>六、闭环验证报告</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Title level={5}>决策落地跟踪</Title>
            <div style={{ marginBottom: 8 }}>
              已落地：
              <Text strong style={{ color: '#10B981' }}>
                {data.closure.decisionLanding.landed}
              </Text>{' '}
              / {data.closure.decisionLanding.total}
            </div>
            <SimpleProgress
              percent={(data.closure.decisionLanding.landed / data.closure.decisionLanding.total) * 100}
              color="#10B981"
            />
            <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
              进行中 {data.closure.decisionLanding.inProgress} 条 ·
              逾期 {data.closure.decisionLanding.overdue} 条
            </div>
          </Col>

          <Col span={12}>
            <Title level={5}>待办完成跟踪</Title>
            <div style={{ marginBottom: 8 }}>
              已完成：
              <Text strong style={{ color: '#0F2B5B' }}>
                {data.closure.actionComplete.completed}
              </Text>{' '}
              / {data.closure.actionComplete.total}
            </div>
            <SimpleProgress
              percent={(data.closure.actionComplete.completed / data.closure.actionComplete.total) * 100}
              color="#0F2B5B"
            />
            <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
              进行中 {data.closure.actionComplete.inProgress} 条 ·
              待开始 {data.closure.actionComplete.pending} 条 ·
              逾期 {data.closure.actionComplete.overdue} 条
            </div>
          </Col>
        </Row>

        <Divider />

        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title="节奏效率"
              value={data.closure.durationEfficiency}
              suffix="%"
              valueStyle={{ color: '#6366F1' }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="议题聚焦度"
              value={data.closure.focusRatio}
              suffix="%"
              valueStyle={{ color: '#0F2B5B' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 报告尾部 */}
      <Card style={{ background: '#F7F9FC', textAlign: 'center' }}>
        <Space direction="vertical" size={4}>
          <Text type="secondary">报告生成时间：{data.meta.endedAt}</Text>
          <Text type="secondary">报告版本：v1.0</Text>
          <Text type="secondary">生成方式：睿枢 · AI 协同自动生成</Text>
          <Divider style={{ margin: '12px 0' }} />
          <Text strong style={{ color: '#0F2B5B' }}>
            睿枢
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            让会议决议真正落地 · 让 AI 决策可追溯可审计
          </Text>
        </Space>
      </Card>

      {/* 打印尾 */}
      <div className="print-footer">
        睿枢 · 会议报告 | {new Date().toLocaleDateString('zh-CN')} | Page
      </div>
    </div>
  );
};

// ============================================================
// 简单进度条（避免 antd Progress 在某些 HMR 场景下的 ReferenceError）
// ============================================================

const SimpleProgress: React.FC<{ percent: number; color: string }> = ({ percent, color }) => (
  <div
    style={{
      width: '100%',
      height: 8,
      background: '#F0F2F5',
      borderRadius: 4,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        width: `${Math.max(0, Math.min(100, percent))}%`,
        height: '100%',
        background: color,
        transition: 'width 0.3s',
      }}
    />
  </div>
);

// ============================================================
// 导出 Markdown 工具
// ============================================================

function generateMarkdown(data: any): string {
  let md = `# ${data.meta.meetingTitle}\n\n`;
  md += `> 生成时间：${data.meta.endedAt}\n`;
  md += `> 主持人：${data.meta.host}\n`;
  md += `> 与会人员：${data.meta.participants.map((p: any) => p.name).join('、')}\n\n`;

  md += `## 一、会议概况\n\n`;
  md += `${data.summary.oneLine}\n\n`;
  md += `**核心要点**：\n\n`;
  data.summary.keyPoints.forEach((p: string) => (md += `- ${p}\n`));
  md += `\n会议健康度评分：${data.summary.healthScore}\n\n`;

  md += `## 二、关键决策\n\n`;
  data.decisions.forEach((d: any) => {
    md += `### ${d.id} · 置信度 ${(d.confidence * 100).toFixed(0)}%\n`;
    md += `- **决议主题**：${d.topic}\n`;
    md += `- **决议内容**：${d.content}\n`;
    md += `- **提出人**：${d.proposer}\n\n`;
  });

  md += `## 三、待办事项\n\n`;
  data.actions.forEach((a: any) => {
    md += `- ${a.status === '已完成' ? '[x]' : '[ ]'} **${a.content}** | 责任人：${a.owner} | 截止：${a.deadline} | 优先级：${a.priority}\n`;
  });
  md += `\n`;

  md += `## 四、风险信号\n\n`;
  data.risks.forEach((r: any) => {
    md += `- [${r.level}] ${r.type}：${r.content}（应对：${r.mitigation}）\n`;
  });
  md += `\n`;

  md += `## 五、议题讨论\n\n`;
  data.topics.forEach((t: any) => {
    md += `### ${t.id} ${t.title}（${t.duration}）\n`;
    md += `- 讨论摘要：${t.summary}\n`;
    md += `- 主要结论：${t.keyConclusion}\n\n`;
  });

  md += `## 六、闭环验证\n\n`;
  md += `- 决策落地：${data.closure.decisionLanding.landed}/${data.closure.decisionLanding.total}\n`;
  md += `- 待办完成：${data.closure.actionComplete.completed}/${data.closure.actionComplete.total}\n`;
  md += `- 节奏效率：${data.closure.durationEfficiency}%\n`;
  md += `- 议题聚焦度：${data.closure.focusRatio}%\n\n`;

  md += `---\n\n`;
  md += `*本报告由睿枢 AI 协同自动生成*\n`;

  return md;
}

export default PostMeetingReport;
