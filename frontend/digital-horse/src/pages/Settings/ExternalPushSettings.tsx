/**
 * 外部推送配置面板（Settings → 外部推送 Tab）
 *
 * 功能：
 *   - 5 种业务事件 × 3 个外部渠道（钉钉 / 企业微信 / 邮件）的开关配置
 *   - 每个事件独立配置接收人
 *   - 集成测试按钮：模拟推送一条测试消息
 */

import React, { useState } from 'react';
import {
  Card,
  Switch,
  Form,
  Typography,
  Space,
  Row,
  Col,
  Tag,
  Button,
  Input,
  Divider,
  Tooltip,
  App,
  Alert,
} from 'antd';
import {
  DingtalkOutlined,
  WechatWorkOutlined,
  MailOutlined,
  ApiOutlined,
  BellOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { usePushChannelConfigStore } from '@/store/pushChannelConfigStore';
import { dispatchNotification, type NotificationEventType, type PushChannel } from '@/services/notificationDispatchService';

const { Title, Text, Paragraph } = Typography;

const channelMeta: Record<PushChannel, { icon: React.ReactNode; label: string; color: string; bg: string; placeholder: string }> = {
  dingtalk: {
    icon: <DingtalkOutlined />,
    label: '钉钉',
    color: '#1677FF',
    bg: 'rgba(22, 119, 255, 0.08)',
    placeholder: '钉钉 userId，多个用逗号分隔',
  },
  wecom: {
    icon: <WechatWorkOutlined />,
    label: '企业微信',
    color: '#07C160',
    bg: 'rgba(7, 193, 96, 0.08)',
    placeholder: '企业微信 userId，多个用逗号分隔',
  },
  email: {
    icon: <MailOutlined />,
    label: '邮件',
    color: '#722ED1',
    bg: 'rgba(114, 46, 209, 0.08)',
    placeholder: '邮箱地址，多个用逗号分隔',
  },
};

const eventOrder: NotificationEventType[] = [
  'meeting_todo',
  'workitem_due',
  'approval_change',
  'sandbox_critical',
  'risk_alert',
];

const ExternalPushSettings: React.FC = () => {
  const { message } = App.useApp();
  const configs = usePushChannelConfigStore((s) => s.configs);
  const toggleEvent = usePushChannelConfigStore((s) => s.toggleEvent);
  const toggleChannel = usePushChannelConfigStore((s) => s.toggleChannel);
  const setRecipients = usePushChannelConfigStore((s) => s.setRecipients);
  const reset = usePushChannelConfigStore((s) => s.reset);

  // 接收人临时输入（草稿态）
  const [recipientDrafts, setRecipientDrafts] = useState<Record<NotificationEventType, string>>(() => {
    const init: any = {};
    eventOrder.forEach((e) => { init[e] = configs[e].recipients.join(', '); });
    return init;
  });

  const enabledCount = eventOrder.filter((e) => configs[e].enabled).length;

  const handleSaveRecipients = (eventType: NotificationEventType) => {
    const raw = recipientDrafts[eventType] || '';
    const list = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    setRecipients(eventType, list);
    message.success(`${configs[eventType].label} 接收人已保存（${list.length} 人）`);
  };

  const handleTestPush = async (eventType: NotificationEventType) => {
    const cfg = configs[eventType];
    if (!cfg.enabled) {
      message.warning('该事件未启用外部推送');
      return;
    }
    const enabledChannels = (Object.keys(cfg.channels) as PushChannel[]).filter((c) => cfg.channels[c]);
    if (enabledChannels.length === 0) {
      message.warning('请至少开启一个推送渠道');
      return;
    }
    if (cfg.recipients.length === 0) {
      message.warning('请配置接收人');
      return;
    }
    const hide = message.loading(`正在向 [${enabledChannels.join(', ')}] 发送测试消息...`, 0);
    const result = await dispatchNotification({
      eventType,
      channels: enabledChannels,
      recipients: cfg.recipients,
      payload: {
        title: `[测试] ${cfg.label}`,
        content: `这是一条来自「睿枢金融办公平台」的测试推送，时间：${new Date().toLocaleString()}`,
        priority: 'normal',
      },
    }, { force: true });
    hide();
    if (result.success) {
      message.success('测试推送成功');
    } else {
      const failed = Object.entries(result.channelResults).filter(([_, r]) => !r?.ok);
      message.error(`部分渠道失败：${failed.map(([ch]) => channelMeta[ch as PushChannel].label).join(', ')}`);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="外部办公系统集成（一期）"
        description={
          <span>
            支持将系统内的关键业务事件实时推送至 <Text strong>钉钉 / 企业微信 / 邮件</Text>。
            配置后将自动分发，无需手动复制通知内容。<Text type="secondary">SSO 单点登录将在二期提供。</Text>
          </span>
        }
        style={{ marginBottom: 16 }}
      />

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>已启用事件类型</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#0F2B5B' }}>
              {enabledCount} <Text type="secondary" style={{ fontSize: 14 }}>/ {eventOrder.length}</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>支持渠道</Text>
            <Space size={6} style={{ marginTop: 8 }}>
              {(['dingtalk', 'wecom', 'email'] as PushChannel[]).map((ch) => (
                <Tag key={ch} icon={channelMeta[ch].icon} color={channelMeta[ch].color}>
                  {channelMeta[ch].label}
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>API 接口</Text>
            <div style={{ fontSize: 13, marginTop: 4, fontFamily: 'monospace', color: '#0F2B5B' }}>
              POST /api/v1/notifications/send
            </div>
          </Card>
        </Col>
      </Row>

      <Form layout="vertical">
        {eventOrder.map((eventType) => {
          const cfg = configs[eventType];
          return (
            <Card
              key={eventType}
              size="small"
              style={{ marginBottom: 12, borderLeft: `3px solid ${cfg.enabled ? '#22A775' : '#d9d9d9'}` }}
              title={
                <Space>
                  <BellOutlined style={{ color: cfg.enabled ? '#22A775' : '#8A94A6' }} />
                  <Text strong>{cfg.label}</Text>
                  {cfg.enabled ? (
                    <Tag color="success">已启用</Tag>
                  ) : (
                    <Tag>未启用</Tag>
                  )}
                  {cfg.lastSentAt && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      最近推送：{new Date(cfg.lastSentAt).toLocaleString()}
                    </Text>
                  )}
                </Space>
              }
              extra={
                <Space>
                  <Tooltip title="向已配置的渠道发送一条测试消息">
                    <Button
                      size="small"
                      icon={<ApiOutlined />}
                      onClick={() => handleTestPush(eventType)}
                      disabled={!cfg.enabled}
                    >
                      测试推送
                    </Button>
                  </Tooltip>
                  <Switch
                    checked={cfg.enabled}
                    onChange={(checked) => toggleEvent(eventType, checked)}
                    checkedChildren="启用"
                    unCheckedChildren="停用"
                  />
                </Space>
              }
            >
              <Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
                {cfg.description}
              </Paragraph>

              <Row gutter={16}>
                {/* 渠道开关 */}
                <Col span={10}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    推送渠道
                  </Text>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {(['dingtalk', 'wecom', 'email'] as PushChannel[]).map((ch) => {
                      const meta = channelMeta[ch];
                      return (
                        <div
                          key={ch}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: cfg.channels[ch] ? meta.bg : '#fafafa',
                            borderRadius: 6,
                            border: `1px solid ${cfg.channels[ch] ? meta.color : '#f0f0f0'}`,
                          }}
                        >
                          <Space>
                            <span style={{ color: meta.color, fontSize: 16 }}>{meta.icon}</span>
                            <Text strong={cfg.channels[ch]}>{meta.label}</Text>
                          </Space>
                          <Switch
                            size="small"
                            checked={cfg.channels[ch]}
                            onChange={(checked) => toggleChannel(eventType, ch, checked)}
                            disabled={!cfg.enabled}
                          />
                        </div>
                      );
                    })}
                  </Space>
                </Col>

                {/* 接收人 */}
                <Col span={14}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    接收人
                  </Text>
                  <Input.TextArea
                    rows={3}
                    placeholder={channelMeta.dingtalk.placeholder + '；邮件用邮箱；企业微信用 userId'}
                    value={recipientDrafts[eventType]}
                    onChange={(e) =>
                      setRecipientDrafts((prev) => ({ ...prev, [eventType]: e.target.value }))
                    }
                    disabled={!cfg.enabled}
                  />
                  <Space style={{ marginTop: 8 }}>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleSaveRecipients(eventType)}
                      disabled={!cfg.enabled}
                    >
                      保存接收人
                    </Button>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      已保存 {cfg.recipients.length} 人
                    </Text>
                  </Space>
                </Col>
              </Row>
            </Card>
          );
        })}
      </Form>

      <Divider />
      <Space>
        <Button icon={<ReloadOutlined />} onClick={() => { reset(); message.success('已恢复默认配置'); }}>
          恢复默认配置
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          配置自动保存到本地，刷新页面不会丢失
        </Text>
      </Space>
    </div>
  );
};

export default ExternalPushSettings;
