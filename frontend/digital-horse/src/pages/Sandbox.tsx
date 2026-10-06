/**
 * 合规沙箱独立页
 * 路径: /sandbox
 *
 * 评委演示入口：
 *   1. 顶部  一键演示（自动填充"高风险承诺营销材料"，立即跑出阻断结果）
 *   2. 左侧输入区：支持手动粘贴内容 / 4 个演示场景一键切换
 *   3. 右侧实时结果：评分圆环 / 风险列表 / 命中高亮 / 法规详情 / 改写建议
 *   4. 底部：运行历史（审计）+ 导出 CSV
 */

import React, { useState } from 'react';
import { ComplianceReceiptCard } from '@/components/Sandbox/ComplianceReceiptCard';
import { BatchComplianceScanPanel } from '@/components/Sandbox/BatchComplianceScanPanel';
import { RegulationPanel } from '@/components/Sandbox/RegulationPanel';
import { generateReceipt, type ComplianceReceipt } from '@/services/sandbox/complianceReceipt';
import { useMeetingWorkItemStore } from '@/store';
import { useLocation } from 'react-router-dom';
import { Card, Row, Col, Typography, Space, Tag, Button, Statistic, Divider, Alert } from 'antd';
import {
  SafetyCertificateOutlined,
  RocketOutlined,
  ExperimentOutlined,
  BookOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SandboxRunner } from '@/components/Sandbox/SandboxRunner';
import { SandboxHistory } from '@/components/Sandbox/SandboxHistory';
import { DEMO_SANDBOX_TEXTS } from '@/mock/sandboxDemo';
import { CATEGORY_META } from '@/services/sandbox/complianceRules';

const { Title, Text } = Typography;

const Sandbox: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  // 业务联动：研报违规跳转过来时，location.state 携带报告文本 + 上下文
  // 来源场景：Meeting/PostMeetingReport → ExportToolbar.handleGotoSandboxRewrite
  const locationState = (location.state ?? {}) as {
    initialText?: string;
    source?: string;
    approvalTitle?: string;
  };
  const rewriteFromReport = locationState.source === 'meeting_report' && !!locationState.initialText;

  // 批量回扫数据源（会议工单）
  const meetingWorkItems = useMeetingWorkItemStore((s) => s.items);

  // 阻断级违规跳过来的提示条
  const rewriteBanner = rewriteFromReport ? (
    <Alert
      type="warning"
      showIcon
      icon={<ArrowLeftOutlined />}
      message={
        <Space>
          <Text strong>{'报告改写模式'}</Text>
          {locationState.approvalTitle && (
            <Tag color="gold">{'来源报告：'}{locationState.approvalTitle}</Tag>
          )}
        </Space>
      }
      description={'下方文本框已自动填入被阻断的报告全文，请使用 AI 改写建议修改后重新检测。修改通过后可返回原页面继续导出。'}
      style={{ marginBottom: 16 }}
    />
  ) : null;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* 顶部标题区 */}
      <Card
        style={{
          marginBottom: 16,
          background: '#0F2B5B',
          border: 'none',
        }}
      >
        <Row gutter={24} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4}>
              <Space size={8}>
                <SafetyCertificateOutlined style={{ fontSize: 28, color: '#fff' }} />
                <Title level={3} style={{ margin: 0, color: '#fff' }}>
                  {'AI 合规沙箱'}
                </Title>
                <Tag color="gold" style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                  β Beta
                </Tag>
              </Space>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                {'9 大类合规规则 · 47 条检测规则 · 30+ 部关联法规 · AI 预审 + 人工复审'}
              </Text>
            </Space>
          </Col>
          <Col>
            <Space size={12}>
              <Statistic
                title={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{'已覆盖规则'}</Text>}
                value={47}
                valueStyle={{ color: '#fff', fontSize: 22 }}
                suffix={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>条</Text>}
              />
              <Statistic
                title={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{'关联法规'}</Text>}
                value={30}
                valueStyle={{ color: '#fff', fontSize: 22 }}
                suffix={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>部</Text>}
              />
              <Statistic
                title={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{'合规分类'}</Text>}
                value={9}
                valueStyle={{ color: '#fff', fontSize: 22 }}
                suffix={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>类</Text>}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* AI 预审 + 人工复审 流程提示 */}
      <Alert
        type="info"
        showIcon
        message={
          <Space size={8} wrap>
            <Text strong>{'合规审查流程：'}</Text>
            <Tag color="blue">① AI 智能预审</Tag>
            <Text type="secondary">→</Text>
            <Tag color="gold">② 整改 / 人工复核</Tag>
            <Text type="secondary">→</Text>
            <Tag color="green">③ 提交审批</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {'AI 预审后必须由对应岗位人工复核才能提交审批'}
            </Text>
          </Space>
        }
        style={{ marginBottom: 16 }}
      />

      {/* 规则分类概览 — 统一低饱和灰底 */}
      <Card
        size="small"
        title={
          <Space>
            <BookOutlined style={{ color: '#0F2B5B' }} />
            <span>{'合规规则分类'}</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <Tag
              key={key}
              style={{
                background: '#F3F4F6',
                borderColor: '#E5E7EB',
                color: '#374151',
                fontSize: 12,
                padding: '4px 10px',
              }}
            >
              {meta.icon} {meta.name}
            </Tag>
          ))}
        </div>
      </Card>

      {/* 快速演示场景 — 统一灰底，去掉彩色背景 */}
      <Card
        size="small"
        title={
          <Space>
            <RocketOutlined style={{ color: '#0F2B5B' }} />
            <span>{'快速演示场景（点击直接体验）'}</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[12, 12]}>
          {DEMO_SANDBOX_TEXTS.map((demo) => {
            // 用统一的灰底，靠右侧 Tag 颜色区分类型
            const typeLabel: Record<string, string> = {
              pass: '合规',
              warn: '高风险',
              privacy: '隐私',
              aml: '反洗钱',
            };
            const typeColor: Record<string, string> = {
              pass: '#22A775',
              warn: '#DC2626',
              privacy: '#F97316',
              aml: '#0F2B5B',
            };
            return (
              <Col xs={24} sm={12} key={demo.id}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 6,
                    border: '1px solid #E5E7EB',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: '#FAFAFA',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                  onClick={() => {
                    const runnerEl = document.querySelector('.sandbox-runner');
                    if (runnerEl) {
                      const textarea = runnerEl.querySelector('textarea');
                      if (textarea) {
                        const nativeInputValueSetter = (Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') as any).set;
                        nativeInputValueSetter.call(textarea, demo.text);
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        textarea.dispatchEvent(new Event('change', { bubbles: true }));
                        const demoBtns = runnerEl.querySelectorAll('button');
                        demoBtns.forEach((btn) => {
                          if (btn.textContent?.includes('启动') || btn.textContent?.includes('Run')) {
                            (btn as HTMLButtonElement).click();
                          }
                        });
                      }
                    }
                  }}
                >
                  {/* 标题行 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircleOutlined style={{ color: '#0F2B5B', fontSize: 14 }} />
                    <Text strong style={{ fontSize: 13, flex: 1 }}>{demo.title}</Text>
                    <Tag
                      size="small"
                      style={{
                        background: typeColor[demo.type],
                        color: '#fff',
                        border: 'none',
                        margin: 0,
                      }}
                    >
                      {typeLabel[demo.type]}
                    </Tag>
                  </div>
                  {/* 描述行 */}
                  <div style={{ fontSize: 11, color: '#6B7280', paddingLeft: 22 }}>
                    {demo.description}
                    <span style={{ marginLeft: 8 }}>
                      → 预期: {demo.expectedScore.toFixed(1)}/5 · {demo.expectedIssues} 项风险
                    </span>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>

      {rewriteBanner}

      {/* 主沙箱运行器 — 业务联动时携带报告文本进入 */}
      <SandboxRunner
        source={rewriteFromReport ? 'report' : 'sandbox_page'}
        initialText={locationState.initialText || ''}
        approvalTitle={rewriteFromReport ? locationState.approvalTitle : undefined}
      />

      {/* 底部：运行历史 */}
      <div style={{ marginTop: 24 }}>
        <SandboxHistory />
      </div>

      {/* 深化：批量回扫 + 合规回执 demo */}
      <div style={{ marginTop: 24 }}>
        <BatchComplianceScanPanel
          source={meetingWorkItems}
          title="批量合规回扫（基于会议工单文本）"
        />
      </div>
    </div>
  );
};

export default Sandbox;
