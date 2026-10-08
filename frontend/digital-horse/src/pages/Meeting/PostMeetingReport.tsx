/**
 * 会后报告（年度战略规划研讨会专项版）
 * 路径: /meeting?tab=report&id=xxx
 *
 * 5 大板块：
 *   1. 会议概况（关键数据 + 一句话总结 + 核心要点）
 *   2. 关键决策（5 条，含置信度）
 *   3. 待办事项（8 条，含优先级 / 截止 / 状态）
 *   4. 风险预警（5 条，含级别 / 应对）
 *   5. 议题讨论 + 领导讲话
 * + 思维导图（Mermaid 渲染）
 * + 闭环验证
 */

import React, { useEffect, useRef, useState } from 'react';
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
  Alert,
  message,
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
  BulbOutlined,
  CrownOutlined,
  SafetyOutlined,
  DollarOutlined,
  CompassOutlined,
  PartitionOutlined,
} from '@ant-design/icons';
import {
  POST_MEETING,
  STRATEGY_MEETING,
  MERMAID_MINDMAP,
  PARTICIPANTS,
} from './strategyMeetingData';
import '@/styles/print.css';
import { exportMeetingPDF } from '@/services/pdfExportService';
import { FilePdfOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ============================================================
// Mermaid 思维导图组件
//   通过 CDN 注入 mermaid.min.js，渲染到 div
//   失败时降级为代码块展示
// ============================================================
const MermaidMindmap: React.FC<{ code: string; id: string }> = ({ code, id }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      // 动态注入 mermaid CDN
      if (!(window as any).mermaid) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('mermaid CDN failed'));
          document.head.appendChild(script);
        }).catch(() => {
          if (!cancelled) setStatus('error');
        });
      }

      if (cancelled) return;
      const m = (window as any).mermaid;
      if (!m) {
        setStatus('error');
        return;
      }

      try {
        m.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'inherit' });
        const { svg } = await m.render(`${id}-svg`, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setStatus('ready');
        }
      } catch (e) {
        console.error('[Mermaid]', e);
        if (!cancelled) setStatus('error');
      }
    };

    render();
    return () => { cancelled = true; };
  }, [code, id]);

  return (
    <div>
      {status === 'loading' && (
        <Alert
          type="info"
          showIcon
          message={'思维导图渲染中…'}
          description={'首次加载需要从 CDN 拉取 Mermaid 库（约 500KB），请稍候。'}
        />
      )}
      {status === 'error' && (
        <Alert
          type="warning"
          showIcon
          message={'思维导图渲染失败（可能无网络）'}
          description={'已为你保留 Mermaid 源码，可复制到 Mermaid Live Editor 查看。'}
        />
      )}
      <div
        ref={ref}
        style={{
          textAlign: 'center',
          padding: 16,
          background: '#fff',
          borderRadius: 8,
          minHeight: 200,
        }}
      />
      {status === 'error' && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: '#f5f5f5',
            borderRadius: 6,
            fontSize: 12,
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {code}
        </pre>
      )}
    </div>
  );
};

// 立场图标映射
const STANCE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  opportunity: { icon: <CrownOutlined />,    color: '#0F2B5B', label: '机会派' },
  risk:        { icon: <SafetyOutlined />,   color: '#1890ff', label: '风险派' },
  customer:    { icon: <CompassOutlined />,  color: '#52c41a', label: '客户派' },
  finance:     { icon: <DollarOutlined />,   color: '#fa8c16', label: '财务派' },
};

// ============================================================
// 组件定义
// ============================================================

const PostMeetingReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

  const handleBack = () => {
    if (id) navigate(`/meeting?tab=room&id=${id}`);
    else navigate('/meeting');
  };

  // 从 POST_MEETING 直接构造报告数据（同步读取，0 转圈）
  const data = {
    meta: {
      meetingTitle: STRATEGY_MEETING.title,
      meetingSubtitle: STRATEGY_MEETING.subtitle,
      startedAt: STRATEGY_MEETING.startTime,
      endedAt: STRATEGY_MEETING.endTime,
      durationMin: 7.5 * 60, // 10:00 – 17:30 = 7.5 小时 = 450 分钟
      location: STRATEGY_MEETING.location,
      host: STRATEGY_MEETING.host,
      participants: PARTICIPANTS.map((p) => ({
        name: p.name,
        role: `${p.role} · ${p.stanceLabel}`,
        avatarColor: p.avatarColor,
      })),
      meetingType: '公司级战略研讨会',
      confidentiality: '内部 · 决策前',
    },
    summary: POST_MEETING.summary,
    decisions: POST_MEETING.decisions,
    actions: POST_MEETING.actions,
    risks: POST_MEETING.risks,
    topics: POST_MEETING.topics,
    keyData: POST_MEETING.keyData,
    leaderRemarks: POST_MEETING.leaderRemarks,
    closure: {
      decisionLanding: { total: POST_MEETING.decisions.length, landed: 2, inProgress: 2, overdue: 0 },
      actionComplete: { total: POST_MEETING.actions.length, completed: 1, inProgress: 2, pending: 5, overdue: 0 },
      durationEfficiency: 92,
      focusRatio: 90,
    },
  };

  const handlePrint = () => window.print();

  const handleExport = () => {
    const content = generateMarkdown(data);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `会议报告_${data.meta.meetingTitle}_${data.meta.startedAt.replace(/[ :]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('已导出 Markdown 文件');
  };

  /**
   * 导出 PDF（html2canvas 截图方案，WPS 100% 可读）。
   * 复用 pdfExportService.exportMeetingPDF —— 把 POST_MEETING 的结构化数据映射成富报告形状。
   */
  const [pdfExporting, setPdfExporting] = useState(false);
  const handleExportPDF = async () => {
    setPdfExporting(true);
    message.loading({ content: '正在生成 PDF（首次需加载组件，约 1 秒）…', key: 'pmr-pdf', duration: 0 });
    try {
      // decisions: POST_MEETING.decisions {id, topic, content, proposer, confidence, impact}
      const decisions = POST_MEETING.decisions.map((d) => ({
        id: d.id,
        topic: d.topic,
        content: d.content,
        proposer: d.proposer,
        confidence: d.confidence,
        impact: d.impact,
      }));

      // actions: POST_MEETING.actions {id, content, owner, deadline, priority, status, relatedTopic}
      const priorityMap: Record<string, string> = { '高': 'high', '中': 'medium', '低': 'low' };
      const statusMap: Record<string, string> = { 'done': 'done', 'in_progress': 'in_progress', 'todo': 'pending' };
      const actions = POST_MEETING.actions.map((a) => ({
        id: a.id,
        content: a.content,
        owner: a.owner,
        deadline: a.deadline,
        priority: priorityMap[a.priority] || 'medium',
        status: statusMap[a.status] || 'pending',
        relatedTopic: a.relatedTopic,
      }));

      // risks: 完整结构对象数组（pdfExportService 会渲染 level/type/mitigation/owner）
      const risks = POST_MEETING.risks.map((r) => ({
        level: r.level,
        type: r.type,
        content: r.content,
        owner: r.owner,
        mitigation: r.mitigation,
      }));

      // topics: 完整结构对象数组（pdfExportService 会渲染 id/title/duration/summary/keyConclusion）
      const topics = POST_MEETING.topics.map((t) => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        summary: t.summary,
        keyConclusion: t.keyConclusion,
      }));

      // keyData: POST_MEETING.keyData {revenue: {value, delta}, ...} → KeyDataItem[]
      const keyData = [
        { label: '2023 收入', value: POST_MEETING.keyData.revenue.value, delta: POST_MEETING.keyData.revenue.delta },
        { label: '2023 净利', value: POST_MEETING.keyData.profit.value, delta: POST_MEETING.keyData.profit.delta },
        { label: 'NPS', value: POST_MEETING.keyData.nps.value, delta: POST_MEETING.keyData.nps.delta },
        { label: 'AI 覆盖 vs 恒生', value: POST_MEETING.keyData.aiCoverage.value, delta: POST_MEETING.keyData.aiCoverage.delta },
        { label: 'IT 投入 vs 恒生', value: POST_MEETING.keyData.itSpend.value, delta: POST_MEETING.keyData.itSpend.delta },
        { label: '客户线上化率', value: POST_MEETING.keyData.digitalRate.value, delta: POST_MEETING.keyData.digitalRate.delta },
      ];

      // leaderRemarks: 直接透传
      const leaderRemarks = POST_MEETING.leaderRemarks.map((lr) => ({
        speaker: lr.speaker,
        points: lr.points,
      }));

      // closure: 直接透传（用 data.closure 保证页面上是什么 PDF 就是什么）
      const closure = data.closure;

      await exportMeetingPDF({
        meetingId: id || 'demo',
        meetingTitle: data.meta.meetingTitle,
        startedAt: data.meta.startedAt,
        endedAt: data.meta.endedAt,
        durationSec: data.meta.durationMin * 60,
        participants: data.meta.participants.map((p, idx) => ({
          userId: String(idx),
          name: p.name,
          role: p.role,
        })),
        summary: {
          oneLine: POST_MEETING.summary.oneLine,
          keyPoints: POST_MEETING.summary.keyPoints,
          healthScore: POST_MEETING.summary.healthScore,
        },
        sections: { decisions, actions, risks, topics },
        keyData,
        leaderRemarks,
        closure,
        meta: {
          host: data.meta.host,
          meetingType: data.meta.meetingType,
          confidentiality: data.meta.confidentiality,
          subtitle: data.meta.meetingSubtitle,
        },
      });
      message.destroy('pmr-pdf');
      message.success('PDF 已下载');
    } catch (e: any) {
      message.destroy('pmr-pdf');
      message.error(`PDF 导出失败：${e?.message || '未知错误'}`);
      console.error(e);
    } finally {
      setPdfExporting(false);
    }
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
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{text}</div>
        </div>
      ),
    },
    { title: '提出人', dataIndex: 'proposer', key: 'proposer', width: 130 },
    {
      title: '影响范围',
      dataIndex: 'impact',
      key: 'impact',
      width: 140,
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (c: number) => {
        const color = c >= 0.9 ? 'green' : c >= 0.8 ? 'blue' : 'orange';
        return <Tag color={color}>{(c * 100).toFixed(0)}%</Tag>;
      },
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
    { title: '截止', dataIndex: 'deadline', key: 'deadline', width: 90 },
    { title: '议题', dataIndex: 'relatedTopic', key: 'relatedTopic', width: 70 },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p: string) => {
        const colorMap: Record<string, string> = { 高: 'red', 中: 'orange', 低: 'default' };
        return <Tag color={colorMap[p]}>{p}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => {
        const colorMap: Record<string, string> = {
          done: 'success',
          in_progress: 'processing',
          todo: 'default',
        };
        const textMap: Record<string, string> = {
          done: '已完成',
          in_progress: '进行中',
          todo: '待开始',
        };
        return <Tag color={colorMap[s]}>{textMap[s]}</Tag>;
      },
    },
  ];

  const riskColumns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 70,
      render: (l: string) => {
        const colorMap: Record<string, string> = { 高: 'red', 中: 'orange', 低: 'blue' };
        return <Tag color={colorMap[l]}>{l}</Tag>;
      },
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 110 },
    {
      title: '风险描述',
      dataIndex: 'content',
      key: 'content',
      render: (text: string) => <div>{text}</div>,
    },
    { title: '责任人', dataIndex: 'owner', key: 'owner', width: 110 },
    {
      title: '应对措施',
      dataIndex: 'mitigation',
      key: 'mitigation',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
  ];

  return (
    <div ref={reportRef} style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      {/* 打印头 */}
      <div className="print-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="report-brand-header">
            年度战略
            <span className="confidential-mark">内部 · 决策前</span>
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {data.meta.meetingTitle} | {data.meta.startedAt} | 自动生成
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
            <Tag color="success">自动生成</Tag>
            <Tag color="gold">战略研讨专项</Tag>
          </Space>

          <Space size={24} wrap>
            <Space size={4}>
              <CalendarOutlined />
              <Text type="secondary">{data.meta.startedAt} – {data.meta.endedAt}</Text>
            </Space>
            <Space size={4}>
              <ClockCircleOutlined />
              <Text type="secondary">{Math.floor(data.meta.durationMin / 60)} 小时 {data.meta.durationMin % 60} 分钟</Text>
            </Space>
            <Space size={4}>
              <TeamOutlined />
              <Text type="secondary">{data.meta.participants.length} 人参会</Text>
            </Space>
            <Space size={4}>
              <Text type="secondary">主持人：{data.meta.host}</Text>
            </Space>
            <Space size={4}>
              <Text type="secondary">{data.meta.location}</Text>
            </Space>
          </Space>

          <Divider style={{ margin: '12px 0' }} />

          {/* 关键数据 6 个 */}
          <Row gutter={16}>
            <Col span={4}>
              <Statistic
                title="2023 收入"
                value={data.keyData.revenue.value}
                valueStyle={{ color: '#0F2B5B', fontSize: 20 }}
                suffix={<Tag color="green" style={{ marginLeft: 4 }}>{data.keyData.revenue.delta}</Tag>}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="2023 净利"
                value={data.keyData.profit.value}
                valueStyle={{ color: '#10B981', fontSize: 20 }}
                suffix={<Tag color="green" style={{ marginLeft: 4 }}>{data.keyData.profit.delta}</Tag>}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="客户 NPS"
                value={data.keyData.nps.value}
                valueStyle={{ color: '#EF4444', fontSize: 20 }}
                suffix={<Tag color="red" style={{ marginLeft: 4 }}>{data.keyData.nps.delta}</Tag>}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="AI 覆盖 vs 恒生"
                value={data.keyData.aiCoverage.value}
                valueStyle={{ color: '#fa8c16', fontSize: 16 }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="IT 投入 vs 恒生"
                value={data.keyData.itSpend.value}
                valueStyle={{ color: '#fa8c16', fontSize: 16 }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="客户线上化率"
                value={data.keyData.digitalRate.value}
                valueStyle={{ color: '#10B981', fontSize: 20 }}
                suffix={<Tag color="green" style={{ marginLeft: 4 }}>{data.keyData.digitalRate.delta}</Tag>}
              />
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          {/* 核心统计 4 个 */}
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
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              loading={pdfExporting}
              onClick={handleExportPDF}
            >
              导出 PDF
            </Button>
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

      {/* 思维导图板块 */}
      <Card
        title={
          <Space>
            <PartitionOutlined style={{ color: '#0F2B5B' }} />
            <span>会议思维导图</span>
            <Tag color="blue">Mermaid</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          以下是本次会议的全景思维导图：议题 → 决策 → 行动项 → 风险预警。
          4 位主持人的立场、3 大共识、2 大争议、8 条行动项、5 项风险一目了然。
        </Paragraph>
        <MermaidMindmap code={MERMAID_MINDMAP} id={`mindmap-${id ?? 'default'}`} />
      </Card>

      {/* 第一部分：会议概况 */}
      <Card
        title={
          <Space>
            <BulbOutlined style={{ color: '#0F2B5B' }} />
            <span>一、会议概况</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={<Text strong>会议总结（一句话）</Text>}
          description={<Text style={{ fontSize: 14 }}>{data.summary.oneLine}</Text>}
        />

        <Title level={5}>
          <CheckCircleOutlined style={{ color: '#10B981', marginRight: 8 }} />
          核心要点
        </Title>
        <ul style={{ paddingLeft: 20 }}>
          {data.summary.keyPoints.map((point, i) => (
            <li key={i} style={{ marginBottom: 8 }}>{point}</li>
          ))}
        </ul>

        <Divider />

        <Title level={5}>
          <TeamOutlined style={{ marginRight: 8 }} />
          参会人员（含立场）
        </Title>
        <Space wrap>
          {data.meta.participants.map((p, i) => (
            <Tag key={i} color="blue" style={{ padding: '4px 12px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: p.avatarColor,
                  marginRight: 6,
                }}
              />
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
          决策由会议实时识别并标记。每条决策附置信度评分，反映发言中的"决定 / 同意 / 确认"等核心信号的强度。
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
          所有待办已自动派发到责任人工作台。议题编号对应上文议题讨论记录。
        </Paragraph>
        <Table
          dataSource={data.actions}
          columns={actionColumns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 第四部分：风险预警 */}
      <Card
        title={
          <Space>
            <AlertOutlined style={{ color: '#EF4444' }} />
            <span>四、风险预警</span>
            <Tag color="red">{data.risks.length} 条</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph type="secondary">
          风险由会议实时扫描发言内容识别。包含财务 / 合规 / 执行 / 客户 / 组织五类。
        </Paragraph>
        <Table
          dataSource={data.risks}
          columns={riskColumns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 第五部分：议题讨论 + 领导讲话 */}
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
          议题按时间顺序展开，每个议题给出讨论摘要 + 主要结论。
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

        <Divider />

        <Title level={5}>
          <CrownOutlined style={{ color: '#0F2B5B', marginRight: 8 }} />
          领导讲话纪要
        </Title>
        <Row gutter={[16, 16]}>
          {data.leaderRemarks.map((lr, i) => {
            const meta = STANCE_META[
              PARTICIPANTS.find((p) => lr.speaker.startsWith(p.name))?.stance ?? 'opportunity'
            ];
            return (
              <Col span={12} key={i}>
                <Card
                  size="small"
                  style={{ background: meta.color + '08', borderColor: meta.color + '40' }}
                >
                  <Space>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: meta.color,
                        color: '#fff',
                      }}
                    >
                      {meta.icon}
                    </span>
                    <Text strong>{lr.speaker}</Text>
                    <Tag color="default">{meta.label}</Tag>
                  </Space>
                  <ul style={{ marginTop: 8, paddingLeft: 18, marginBottom: 0 }}>
                    {lr.points.map((p, j) => (
                      <li key={j} style={{ fontSize: 13, marginBottom: 4 }}>{p}</li>
                    ))}
                  </ul>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* 第六部分：闭环验证 */}
      <Card
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#0F2B5B' }} />
            <span>六、闭环验证</span>
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
          <Text type="secondary">生成方式：会议 AI 协同 · 自动生成</Text>
          <Divider style={{ margin: '12px 0' }} />
          <Text strong style={{ color: '#0F2B5B' }}>
            年度战略规划研讨会 · 报告
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            共识质量优于共识速度 · 让战略决策可追溯可审计
          </Text>
        </Space>
      </Card>

      {/* 打印尾 */}
      <div className="print-footer">
        年度战略 · 会议报告 | {new Date().toLocaleDateString('zh-CN')} | Page
      </div>
    </div>
  );
};

// ============================================================
// 简单进度条
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
  md += `> 副标题：${data.meta.meetingSubtitle}\n`;
  md += `> 时间：${data.meta.startedAt} – ${data.meta.endedAt}\n`;
  md += `> 主持人：${data.meta.host}\n`;
  md += `> 与会人员：${data.meta.participants.map((p: any) => `${p.name} (${p.role})`).join('、')}\n\n`;

  md += `## 一、会议概况\n\n`;
  md += `${data.summary.oneLine}\n\n`;
  md += `**核心要点**：\n\n`;
  data.summary.keyPoints.forEach((p: string) => (md += `- ${p}\n`));
  md += `\n会议健康度评分：${data.summary.healthScore}\n\n`;

  md += `**关键数据**：\n\n`;
  md += `| 维度 | 数值 | 同比 |\n|---|---|---|\n`;
  md += `| 2023 收入 | ${data.keyData.revenue.value} | ${data.keyData.revenue.delta} |\n`;
  md += `| 2023 净利 | ${data.keyData.profit.value} | ${data.keyData.profit.delta} |\n`;
  md += `| NPS | ${data.keyData.nps.value} | ${data.keyData.nps.delta} |\n`;
  md += `| AI 覆盖 vs 恒生 | ${data.keyData.aiCoverage.value} | ${data.keyData.aiCoverage.delta} |\n`;
  md += `| IT 投入 vs 恒生 | ${data.keyData.itSpend.value} | ${data.keyData.itSpend.delta} |\n`;
  md += `| 客户线上化率 | ${data.keyData.digitalRate.value} | ${data.keyData.digitalRate.delta} |\n\n`;

  md += `## 二、关键决策\n\n`;
  data.decisions.forEach((d: any) => {
    md += `### ${d.id} · 置信度 ${(d.confidence * 100).toFixed(0)}%\n`;
    md += `- **决议主题**：${d.topic}\n`;
    md += `- **决议内容**：${d.content}\n`;
    md += `- **提出人**：${d.proposer}\n`;
    md += `- **影响范围**：${d.impact}\n\n`;
  });

  md += `## 三、待办事项\n\n`;
  data.actions.forEach((a: any) => {
    md += `- [${a.status === 'done' ? 'x' : ' '}] **${a.content}** | 责任人：${a.owner} | 截止：${a.deadline} | 优先级：${a.priority} | 议题：${a.relatedTopic}\n`;
  });
  md += `\n`;

  md += `## 四、风险预警\n\n`;
  data.risks.forEach((r: any) => {
    md += `- [${r.level}] ${r.type}：${r.content}（应对：${r.mitigation}，责任人：${r.owner}）\n`;
  });
  md += `\n`;

  md += `## 五、议题讨论 + 领导讲话\n\n`;
  data.topics.forEach((t: any) => {
    md += `### ${t.id} ${t.title}（${t.duration}）\n`;
    md += `- 讨论摘要：${t.summary}\n`;
    md += `- 主要结论：${t.keyConclusion}\n\n`;
  });

  md += `### 领导讲话\n\n`;
  data.leaderRemarks.forEach((lr: any) => {
    md += `**${lr.speaker}**：\n`;
    lr.points.forEach((p: string) => (md += `- ${p}\n`));
    md += `\n`;
  });

  md += `## 六、闭环验证\n\n`;
  md += `- 决策落地：${data.closure.decisionLanding.landed}/${data.closure.decisionLanding.total}\n`;
  md += `- 待办完成：${data.closure.actionComplete.completed}/${data.closure.actionComplete.total}\n`;
  md += `- 节奏效率：${data.closure.durationEfficiency}%\n`;
  md += `- 议题聚焦度：${data.closure.focusRatio}%\n\n`;

  md += `---\n\n`;
  md += `*本报告由会议 AI 协同自动生成*\n`;

  return md;
}

export default PostMeetingReport;
