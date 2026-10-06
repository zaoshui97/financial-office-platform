/**
 * AdminPushChannelSettings —— 管理员推送渠道配置（系统级）
 *
 * 与 ExternalPushSettings 的区别：
 *   - ExternalPushSettings：按"业务事件"维度配置（哪些事件推到哪些人）
 *   - AdminPushChannelSettings（此文件）：按"系统管理员"维度配置推送渠道本身的能力
 *     - 全局推送开关
 *     - 每个渠道的 Webhook / AppKey 等凭据占位（演示环境不打真实密钥）
 *     - 各渠道的全局默认接收人
 *     - 推送失败重试 / 速率限制
 *
 * 定位：
 *   仅 SUPER_ADMIN 可见；DEPT_ADMIN 也能查看但不可改。
 *   设置项持久化到 localStorage（admin-push-channel-storage）
 */

import React, { useState } from 'react';
import {
  Card,
  Form,
  Switch,
  Input,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  Tooltip,
  Alert,
  Slider,
  InputNumber,
  Divider,
  App,
  Table,
} from 'antd';
import {
  DingtalkOutlined,
  WechatWorkOutlined,
  MailOutlined,
  LockOutlined,
  ReloadOutlined,
  SaveOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useUserStore } from '@/store/userStore';
import { useDispatchLogStore } from '@/store/dispatchLogStore';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 渠道定义
interface ChannelDef {
  key: 'dingtalk' | 'wecom' | 'email' | 'sms';
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  /** 凭据字段（演示用，不打真实密钥） */
  credentials: Array<{ key: string; label: string; placeholder: string }>;
}

const CHANNELS: ChannelDef[] = [
  {
    key: 'dingtalk',
    label: '钉钉机器人',
    icon: <DingtalkOutlined />,
    color: '#1677FF',
    description: '通过群机器人 Webhook 或应用消息推送，适合企业内部即时沟通。',
    credentials: [
      { key: 'webhook', label: 'Webhook URL', placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
      { key: 'appKey', label: 'AppKey（应用消息）', placeholder: '企业内部应用 AppKey（可选）' },
    ],
  },
  {
    key: 'wecom',
    label: '企业微信',
    icon: <WechatWorkOutlined />,
    color: '#07C160',
    description: '通过企业微信应用消息推送，需配置 corpId + agentId。',
    credentials: [
      { key: 'corpId', label: 'CorpID', placeholder: '企业微信 corpId' },
      { key: 'agentId', label: 'AgentID', placeholder: '应用 AgentID' },
      { key: 'secret', label: '应用 Secret', placeholder: '应用 Secret（演示占位）' },
    ],
  },
  {
    key: 'email',
    label: '邮件 SMTP',
    icon: <MailOutlined />,
    color: '#722ED1',
    description: '通过 SMTP 邮件推送，适用于正式通知与外部往来。',
    credentials: [
      { key: 'smtpHost', label: 'SMTP Host', placeholder: 'smtp.example.com' },
      { key: 'smtpPort', label: 'SMTP Port', placeholder: '465' },
      { key: 'from', label: '发件人', placeholder: 'no-reply@company.com' },
    ],
  },
  {
    key: 'sms',
    label: '短信网关',
    icon: <LockOutlined />,
    color: '#C9A459',
    description: '通过短信网关推送，仅用于紧急告警（暂未上线，预留配置）。',
    credentials: [
      { key: 'endpoint', label: 'API Endpoint', placeholder: 'https://sms.example.com/send' },
      { key: 'signName', label: '短信签名', placeholder: '公司全称' },
    ],
  },
];

// 全局推送策略类型（仅在前端持久化，演示用）
export interface AdminPushConfig {
  /** 全局推送开关 */
  globalEnabled: boolean;
  /** 各渠道开关 */
  channelsEnabled: Record<string, boolean>;
  /** 渠道凭据（演示用占位，未加密） */
  credentials: Record<string, Record<string, string>>;
  /** 全局默认接收人（钉钉 userId / 邮箱 / 手机号） */
  defaultRecipients: string[];
  /** 失败重试次数 */
  retryTimes: number;
  /** 速率限制（条/分钟） */
  rateLimit: number;
}

const DEFAULT_CONFIG: AdminPushConfig = {
  globalEnabled: true,
  channelsEnabled: {
    dingtalk: true,
    wecom: true,
    email: true,
    sms: false,
  },
  credentials: {
    dingtalk: { webhook: '', appKey: '' },
    wecom: { corpId: '', agentId: '', secret: '' },
    email: { smtpHost: '', smtpPort: '465', from: '' },
    sms: { endpoint: '', signName: '' },
  },
  defaultRecipients: ['admin@company.com'],
  retryTimes: 2,
  rateLimit: 60,
};

const STORAGE_KEY = 'admin-push-channel-config';

function loadConfig(): AdminPushConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg: AdminPushConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

const AdminPushChannelSettings: React.FC = () => {
  const { message } = App.useApp();
  const user = useUserStore((s) => s.user);
  // 仅 SUPER_ADMIN 可改，DEPT_ADMIN 只读；其他角色不显示该模块（路由已在 /settings 限制）
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [config, setConfig] = useState<AdminPushConfig>(() => loadConfig());

  const updateConfig = (patch: Partial<AdminPushConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
  };

  const updateChannel = (key: string, patch: Partial<{ enabled: boolean; credential: Record<string, string> }>) => {
    if (patch.enabled !== undefined) {
      updateConfig({
        channelsEnabled: { ...config.channelsEnabled, [key]: patch.enabled },
      });
    }
    if (patch.credential) {
      updateConfig({
        credentials: { ...config.credentials, [key]: patch.credential },
      });
    }
  };

  const handleSave = () => {
    saveConfig(config);
    message.success('管理员推送配置已保存');
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    saveConfig(DEFAULT_CONFIG);
    message.success('已恢复默认配置');
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        icon={<GlobalOutlined />}
        message={
          <Space size={8} wrap>
            <Text strong>推送渠道（系统级）</Text>
            {isSuperAdmin ? <Tag color="blue">SUPER_ADMIN 可编辑</Tag> : <Tag>只读</Tag>}
          </Space>
        }
        description={
          <span>
            这里配置的是<strong>渠道本身</strong>的能力（凭据、限速）；具体"哪些事件推到哪些人"请前往
            <Text strong>「外部推送」</Text> Tab 配置。
          </span>
        }
        style={{ marginBottom: 16 }}
      />

      {/* 全局开关 + 默认接收人 + 限速 */}
      <Card title="全局推送策略" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col xs={24} md={8}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>全局推送</Text>
              <Switch
                checked={config.globalEnabled}
                onChange={(checked) => updateConfig({ globalEnabled: checked })}
                checkedChildren="启用"
                unCheckedChildren="停用"
                disabled={!isSuperAdmin}
              />
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>失败重试次数</Text>
              <InputNumber
                value={config.retryTimes}
                min={0}
                max={5}
                onChange={(v) => updateConfig({ retryTimes: Number(v) || 0 })}
                disabled={!isSuperAdmin}
                style={{ width: '100%' }}
              />
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>速率限制（条 / 分钟）</Text>
              <Slider
                value={config.rateLimit}
                min={10}
                max={600}
                step={10}
                onChange={(v) => updateConfig({ rateLimit: Number(v) })}
                disabled={!isSuperAdmin}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>当前：{config.rateLimit} 条/分钟</Text>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0' }} />

        <Text type="secondary" style={{ fontSize: 12 }}>全局默认接收人</Text>
        <TextArea
          rows={2}
          value={config.defaultRecipients.join(', ')}
          onChange={(e) =>
            updateConfig({
              defaultRecipients: e.target.value
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          disabled={!isSuperAdmin}
          placeholder="钉钉 userId / 邮箱 / 手机号，多个用逗号分隔"
          style={{ marginTop: 6 }}
        />
      </Card>

      {/* 各渠道配置 */}
      <Card title="推送渠道配置" size="small" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {CHANNELS.map((ch) => {
            const enabled = config.channelsEnabled[ch.key];
            const creds = config.credentials[ch.key] || {};
            return (
              <Card
                key={ch.key}
                size="small"
                style={{
                  borderLeft: `3px solid ${enabled ? ch.color : '#d9d9d9'}`,
                  background: enabled ? 'rgba(0,0,0,0.02)' : '#fafafa',
                }}
                title={
                  <Space>
                    <span style={{ color: ch.color, fontSize: 18 }}>{ch.icon}</span>
                    <Text strong>{ch.label}</Text>
                    {enabled ? <Tag color="success">已启用</Tag> : <Tag>未启用</Tag>}
                    {ch.key === 'sms' && <Tag color="default">预留</Tag>}
                  </Space>
                }
                extra={
                  <Switch
                    size="small"
                    checked={enabled}
                    onChange={(c) => updateChannel(ch.key, { enabled: c })}
                    disabled={!isSuperAdmin}
                  />
                }
              >
                <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
                  {ch.description}
                </Paragraph>

                {enabled && (
                  <Row gutter={[16, 12]}>
                    {ch.credentials.map((cred) => (
                      <Col xs={24} md={12} key={cred.key}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                          {cred.label}
                        </Text>
                        <Input.Password
                          // 凭据类信息用 Password 形态展示（避免明文）
                          value={creds[cred.key] || ''}
                          onChange={(e) =>
                            updateChannel(ch.key, {
                              credential: { ...creds, [cred.key]: e.target.value },
                            })
                          }
                          placeholder={cred.placeholder}
                          disabled={!isSuperAdmin}
                          prefix={<LockOutlined style={{ color: '#999' }} />}
                        />
                      </Col>
                    ))}
                  </Row>
                )}
              </Card>
            );
          })}
        </Space>
      </Card>

      <Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          disabled={!isSuperAdmin}
        >
          保存配置
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={!isSuperAdmin}>
          恢复默认
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          配置自动持久化到 localStorage（{STORAGE_KEY}）
        </Text>
      </Space>

      {/* ── 推送历史日志（仿真可视化）────────────────────────────── */}
      <Divider />
      <DispatchLogSection />
    </div>
  );
};

function DispatchLogSection() {
  const logCount = useDispatchLogStore((s) => s.logs.length);
  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Space>
          <HistoryOutlined style={{ color: '#0F2B5B' }} />
          <Text strong style={{ fontSize: 15 }}>推送历史日志</Text>
          <Tag color="blue">{logCount} 条</Tag>
        </Space>
        <Button
          size="small"
          style={{ float: 'right' }}
          danger
          onClick={() => useDispatchLogStore.getState().clear()}
        >
          清空日志
        </Button>
      </div>
      <DispatchLogTable />
    </>
  );
}

function DispatchLogTable() {
  const logs = useDispatchLogStore((s) => s.recent(50));
  const CHANNEL_ICONS: Record<string, React.ReactNode> = {
    dingtalk: <DingtalkOutlined />,
    wecom: <WechatWorkOutlined />,
    email: <MailOutlined />,
    system: <BellOutlined />,
    inapp: <BellOutlined />,
  };
  const columns = [
    {
      title: '时间',
      dataIndex: 'sentAt',
      key: 'sentAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      width: 80,
      render: (v: string) => CHANNEL_ICONS[v] ?? <BellOutlined />,
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 70,
      render: (v: boolean) => v
        ? <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
        : <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '事件类型',
      dataIndex: 'eventType',
      key: 'eventType',
      width: 140,
      render: (v: string) => <Tag>{v}</Tag>,
    },
  ];
  return (
    <Table
      dataSource={logs}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={false}
      scroll={{ y: 240 }}
      style={{ borderRadius: 8, overflow: 'hidden' }}
    />
  );
}

export default AdminPushChannelSettings;