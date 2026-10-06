/**
 * PostMeetingDrawer — 会后报告 Drawer 总容器
 * 叠在 MeetingRoom 上，会后弹出，包含完整报告 + 派单 + 导出
 *
 * 布局原则：
 *   - 标题栏只放：关闭按钮 + 主标题 + 状态标签（演示模式tag）
 *   - 演示模式 banner / 导出操作下沉到内容区顶部
 *   - 指标条只在有数据时显示，0 时显示空状态而不是 0
 *   - tabs 空白时用合理空状态引导用户
 */
import React, { useEffect, useState } from 'react';
import { Drawer, Tabs, Space, Button, Card, Row, Col, Result, Spin, Typography, Tag, Alert, Dropdown } from 'antd';
import {
  CloseOutlined,
  ArrowRightOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  ExportOutlined,
  RocketOutlined,
  ExperimentOutlined,
  BulbOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FilePdfOutlined,
  FileMarkdownOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionDispatchPanel } from './ActionDispatchPanel';
import { ExportToolbar } from './ExportToolbar';
import { generateReport, closeMeeting } from '@/services/postMeetingService';
import { useBlackboard } from '@/services/useMultiAgent';
import { agentBus } from '@/services/multiAgentBus';
import type { DispatchActionResponse } from '@/services/meetingApiContract';

const { Text } = Typography;

export interface PostMeetingDrawerProps {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle?: string;
}

type GenerationStep = 'idle' | 'transcribing' | 'analyzing' | 'dispatching' | 'done' | 'no-actions';

export const PostMeetingDrawer: React.FC<PostMeetingDrawerProps> = ({
  open,
  onClose,
  meetingId,
  meetingTitle,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const bb = useBlackboard();
  const [report, setReport] = useState<GetReportResponse['data'] | null>(null);
  const [dispatch, setDispatch] = useState<DispatchActionResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [genStep, setGenStep] = useState<GenerationStep>('idle');

  // 监听多 Agent 派单完成事件
  useEffect(() => {
    if (!open) return;
    const unsub = agentBus.subscribe('meeting:state', (evt) => {
      if (evt.meetingId === meetingId && (evt.payload as any)?.dispatchBatchId) {
        const p = evt.payload as any;
        setDispatch({
          dispatchBatchId: p.dispatchBatchId,
          workItems: [],
          allSuccess: p.allDispatched,
        });
      }
    });
    return unsub;
  }, [open, meetingId]);

  // 打开 Drawer 时自动生成报告
  // 演示模式：所有 meetingId 都返回完整演示报告（写死数据）
  useEffect(() => {
    if (!open) return;
    if (report) return;

    setLoading(true);
    setGenStep('transcribing');
    setTimeout(() => {
      setGenStep('analyzing');
      setTimeout(() => {
        setGenStep('dispatching');
        setTimeout(() => {
          setGenStep('done');
          generateReport(meetingId).then((r) => {
            setReport(r);
            setLoading(false);
          });
        }, 600);
      }, 800);
    }, 500);
  }, [open, meetingId, report]);

  const handleGoToReport = () => {
    onClose();
    navigate(`/meeting/${meetingId}/report`);
  };

  const handleManualDispatch = async () => {
    if (!bb || bb.actions.length === 0) return;
    setLoading(true);
    try {
      const result = await closeMeeting(meetingId, bb);
      setDispatch(result.dispatch);
    } finally {
      setLoading(false);
    }
  };

  // 导出菜单
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: t('postMeeting.exportPDF') || '导出 PDF',
      onClick: () => {
        const content = `# ${report?.meetingTitle}\n\n${report?.summary || ''}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${report?.meetingTitle || '会议报告'}.txt`; a.click();
        URL.revokeObjectURL(url);
      },
    },
    {
      key: 'md',
      icon: <FileMarkdownOutlined />,
      label: t('postMeeting.exportMarkdown') || '导出 Markdown',
      onClick: () => {
        const content = `# ${report?.meetingTitle}\n\n## 摘要\n\n${report?.summary || ''}\n\n## 决策\n\n${(report?.sections.decisions || []).map((d, i) => `${i + 1}. **${d.topic}**：${d.decision}`).join('\n')}\n\n## 行动项\n\n${(report?.sections.actions || []).map((a, i) => `${i + 1}. ${a.description}`).join('\n')}`;
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${report?.meetingTitle || '会议报告'}.md`; a.click();
        URL.revokeObjectURL(url);
      },
    },
  ];

  // 生成步骤
  const stepLabels: Record<GenerationStep, string> = {
    idle: '就绪',
    transcribing: '转写识别',
    analyzing: '结构化分析',
    dispatching: '智能派单',
    done: '报告已就绪',
    'no-actions': '报告已就绪',
  };

  // 计算指标
  const decisionCount = report?.sections.decisions.length ?? 0;
  const actionCount = report?.sections.actions.length ?? 0;
  const riskCount = report?.sections.risks.length ?? 0;
  const hasAnyData = decisionCount > 0 || actionCount > 0 || riskCount > 0;

  return (
    <Drawer
      title={
        <Space>
          <RocketOutlined style={{ color: '#0F2B5B' }} />
          <span>{t('postMeeting.drawerTitle')}</span>
          {meetingTitle && <Tag color="default">{meetingTitle}</Tag>}
        </Space>
      }
      placement="right"
      open={open}
      onClose={onClose}
      closeIcon={<CloseOutlined />}
      styles={{ wrapper: { width: 680, maxWidth: 'calc(100vw - 32px)' } }}
      extra={
        report ? (
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={handleGoToReport} size="small">
            {t('postMeeting.openFullReport')}
          </Button>
        ) : null
      }
    >
      <Spin spinning={loading} tip={genStep !== 'idle' ? stepLabels[genStep] + '…' : undefined}>
        {!report ? (
          /* 加载中：简洁进度提示 */
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <Result
              icon={<FileTextOutlined style={{ color: '#0F2B5B', fontSize: 48 }} spin />}
              title={'AI 正在生成会议报告…'}
              subTitle={stepLabels[genStep] + '…'}
            />
          </div>
        ) : (
          <>
            {/* ===== 内容区顶部：演示模式 banner + 导出操作 ===== */}
            <Alert
              message={
                <Space>
                  <ExperimentOutlined />
                  <span>演示模式已开启：点击右上角「查看完整报告」体验完整闭环</span>
                </Space>
              }
              type="info"
              showIcon={false}
              style={{ marginBottom: 12, background: '#EFF6FF', border: '1px solid #BFDBFE' }}
            />

            {/* 导出快捷操作（代替原来标题栏的一排按钮） */}
            {hasAnyData && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
                  <Button icon={<ExportOutlined />} size="small">
                    导出报告
                  </Button>
                </Dropdown>
              </div>
            )}

            {/* ===== 空数据时：隐藏指标条，替换为友好提示 ===== */}
            {!hasAnyData && genStep === 'no-actions' && (
              <Alert
                type="warning"
                showIcon
                icon={<BulbOutlined />}
                message={'未识别到待办任务'}
                description={'本次会议中没有发现明确的待办事项。'}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* ===== 指标条：有数据时显示，无数据时隐藏 ===== */}
            {hasAnyData && (
              <div
                style={{
                  background: '#0F2B5B',
                  color: '#fff',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  gap: 24,
                  flexWrap: 'wrap',
                }}
              >
                {decisionCount > 0 && (
                  <Space size={4}>
                    <CheckCircleOutlined style={{ color: '#10B981' }} />
                    <Text style={{ color: '#fff', opacity: 0.9, fontSize: 13 }}>
                      <strong>{decisionCount}</strong> 项决策
                    </Text>
                  </Space>
                )}
                {actionCount > 0 && (
                  <Space size={4}>
                    <RocketOutlined style={{ color: '#3B82F6' }} />
                    <Text style={{ color: '#fff', opacity: 0.9, fontSize: 13 }}>
                      <strong>{actionCount}</strong> 项待办
                    </Text>
                  </Space>
                )}
                {riskCount > 0 && (
                  <Space size={4}>
                    <ExclamationCircleOutlined style={{ color: '#EF4444' }} />
                    <Text style={{ color: '#fff', opacity: 0.9, fontSize: 13 }}>
                      <strong>{riskCount}</strong> 项风险
                    </Text>
                  </Space>
                )}
                <Text style={{ color: '#fff', opacity: 0.65, fontSize: 12, marginLeft: 'auto' }}>
                  {Math.floor((report.durationSec || 0) / 60)} 分钟
                </Text>
              </div>
            )}

            {/* ===== Tabs ===== */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'summary',
                  label: (
                    <Space>
                      <FileTextOutlined />
                      {t('postMeeting.tabSummary')}
                    </Space>
                  ),
                  // 抽屉只展示概要 + 跳独立页按钮
                  children: <SummaryBrief report={report} onGoFull={handleGoToReport} />,
                },
                {
                  key: 'dispatch',
                  label: (
                    <Space>
                      <AppstoreOutlined />
                      {t('postMeeting.tabDispatch')}
                      {dispatch && dispatch.workItems.length > 0 && (
                        <Tag color="blue">{dispatch.workItems.length}</Tag>
                      )}
                    </Space>
                  ),
                  children: (
                    <div style={{ padding: '16px 0' }}>
                      <ActionDispatchPanel
                        meetingId={meetingId}
                        initialDispatch={dispatch || undefined}
                        onRefresh={() => {}}
                      />
                    </div>
                  ),
                },
                {
                  key: 'export',
                  label: (
                    <Space>
                      <ExportOutlined />
                      {t('postMeeting.tabExport')}
                    </Space>
                  ),
                  children: (
                    <div style={{ padding: '24px 0' }}>
                      <ExportToolbar report={report} />
                    </div>
                  ),
                },
              ]}
            />

            {/* ===== 底部操作栏（仅报告页签且有待办时显示） ===== */}
            {activeTab === 'summary' && actionCount > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: '10px 16px',
                  background: '#fafafa',
                  borderRadius: 6,
                  border: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  共 {actionCount} 项行动项待派发
                </Text>
                <Space>
                  {!dispatch && (
                    <Button size="small" icon={<RocketOutlined />} onClick={handleManualDispatch}>
                      {t('postMeeting.manualDispatch')}
                    </Button>
                  )}
                </Space>
              </div>
            )}
          </>
        )}
      </Spin>
    </Drawer>
  );
};

// ============================================================
// SummaryBrief — 抽屉内概要视图
// 只展示：会议摘要 + 几个计数 + 一个跳转独立报告页的大按钮
// 详细内容（决策详情 / 待办详情 / 风险详情 / 议题详情）都在独立报告页
// ============================================================

const SummaryBrief: React.FC<{
  report: any;
  onGoFull: () => void;
}> = ({ report, onGoFull }) => {
  const decisionCount = report?.sections.decisions.length ?? 0;
  const actionCount = report?.sections.actions.length ?? 0;
  const riskCount = report?.sections.risks.length ?? 0;

  return (
    <div style={{ padding: '8px 0 16px' }}>
      {/* 会议摘要 */}
      <Card
        size="small"
        title={
          <Space>
            <FileTextOutlined style={{ color: '#0F2B5B' }} />
            <span style={{ fontWeight: 600 }}>会议摘要</span>
          </Space>
        }
        style={{ marginBottom: 12 }}
      >
        <pre style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          margin: 0,
          fontSize: 13,
          color: '#374151',
          lineHeight: 1.7,
        }}>
          {report?.summary || '暂无摘要'}
        </pre>
      </Card>

      {/* 三项关键指标（一行小卡片） */}
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center', background: '#ECFDF5' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#10B981' }}>{decisionCount}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>关键决策</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center', background: '#EFF6FF' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#3B82F6' }}>{actionCount}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>待办事项</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center', background: '#FEF2F2' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#EF4444' }}>{riskCount}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>风险信号</div>
          </Card>
        </Col>
      </Row>

      {/* 跳转完整报告按钮 */}
      <Button
        type="primary"
        block
        size="large"
        icon={<ArrowRightOutlined />}
        onClick={onGoFull}
      >
        查看完整报告
      </Button>

      <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
        完整报告包含决策详情、待办详情、风险详情、议题讨论、闭环验证
      </div>
    </div>
  );
};

export default PostMeetingDrawer;
