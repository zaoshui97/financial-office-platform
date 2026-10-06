import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Form, Input, Switch, Button, Space, Tabs, message, Divider, Alert, Tag } from 'antd';
import {
  SettingOutlined,
  GlobalOutlined,
  BellOutlined,
  LockOutlined,
  DatabaseOutlined,
  CloudOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ApiOutlined,
  DingtalkOutlined,
  WechatWorkOutlined,
  MailOutlined,
  ReloadOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { getApiKey, setApiKey, hasApiKey } from '@/api/ai';
import { usePushChannelConfigStore } from '@/store/pushChannelConfigStore';
import type { NotificationEventType } from '@/services/notificationDispatchService';
import ExternalPushSettings from './ExternalPushSettings';
import AdminPushChannelSettings from './AdminPushChannelSettings';

const { Title, Text } = Typography;

const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const [currentDateFormat, setCurrentDateFormat] = useState('YYYY-MM-DD');
  const [apiKey, setApiKeyState] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasApiKeyConfig, setHasApiKeyConfig] = useState(false);

  useEffect(() => {
    setHasApiKeyConfig(hasApiKey());
    const storedKey = getApiKey();
    if (storedKey) {
      setApiKeyState(storedKey);
    }
  }, []);

  const handleSave = () => {
    message.success('设置已保存');
  };

  const handleLanguageChange = (lang: string) => {
    setCurrentLang(lang);
    i18n.changeLanguage(lang);
    message.success('语言已切换');
  };

  const handleDateFormatChange = (format: string) => {
    setCurrentDateFormat(format);
    message.success('日期格式已更新');
  };

  const tabItems = [
    {
      key: 'general',
      label: <span><SettingOutlined /> 通用</span>,
      children: (
        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item label="系统名称" name="systemName" initialValue="睿枢金融办公平台">
            <Input />
          </Form.Item>
          <Form.Item label="系统 Logo" name="logo">
            <Input placeholder="Logo 图片地址（URL）" />
          </Form.Item>
          <Form.Item label="版权信息" name="copyright" initialValue="© 2026 睿枢 版权所有">
            <Input />
          </Form.Item>
          <Form.Item label="维护模式" name="maintenance" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </Form>
      ),
    },
    {
      key: 'language',
      label: <span><GlobalOutlined /> 语言</span>,
      children: (
        <Form layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item label="默认语言">
            <Space>
              <Button
                type={currentLang === 'zh-CN' ? 'primary' : 'default'}
                onClick={() => handleLanguageChange('zh-CN')}
              >
                中文
              </Button>
              <Button
                type={currentLang === 'en-US' ? 'primary' : 'default'}
                onClick={() => handleLanguageChange('en-US')}
              >
                英文
              </Button>
            </Space>
          </Form.Item>
          <Form.Item label="时区" initialValue="Asia/Shanghai (UTC+8)">
            <Input disabled />
          </Form.Item>
          <Form.Item label="日期格式">
            <Space>
              <Button
                type={currentDateFormat === 'YYYY-MM-DD' ? 'primary' : 'default'}
                onClick={() => handleDateFormatChange('YYYY-MM-DD')}
              >
                YYYY-MM-DD
              </Button>
              <Button
                type={currentDateFormat === 'YYYY/MM/DD' ? 'primary' : 'default'}
                onClick={() => handleDateFormatChange('YYYY/MM/DD')}
              >
                YYYY/MM/DD
              </Button>
              <Button
                type={currentDateFormat === 'DD-MM-YYYY' ? 'primary' : 'default'}
                onClick={() => handleDateFormatChange('DD-MM-YYYY')}
              >
                DD-MM-YYYY
              </Button>
            </Space>
          </Form.Item>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </Form>
      ),
    },
    {
      key: 'notification',
      label: <span><BellOutlined /> 消息通知</span>,
      children: (
        <Form layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item label="邮件通知">
            <Switch defaultChecked /> <Text type="secondary" style={{ marginLeft: 8 }}>通过邮件接收通知</Text>
          </Form.Item>
          <Form.Item label="短信通知">
            <Switch defaultChecked /> <Text type="secondary" style={{ marginLeft: 8 }}>通过短信接收通知</Text>
          </Form.Item>
          <Form.Item label="浏览器推送">
            <Switch defaultChecked /> <Text type="secondary" style={{ marginLeft: 8 }}>在浏览器中接收推送通知</Text>
          </Form.Item>
          <Form.Item label="通知类型">
            <Space orientation="vertical">
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>会议提醒</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>审批请求</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>系统更新</Text></div>
              <div><Switch /> <Text style={{ marginLeft: 8 }}>营销邮件</Text></div>
            </Space>
          </Form.Item>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </Form>
      ),
    },
    {
      key: 'push',
      label: <span><ApiOutlined /> 外部推送</span>,
      children: <ExternalPushSettings />,
    },
    {
      key: 'adminPush',
      label: <span><GlobalOutlined /> 管理员推送</span>,
      children: <AdminPushChannelSettings />,
    },
    {
      key: 'security',
      label: <span><LockOutlined /> 安全</span>,
      children: (
        <Form layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item label="密码策略">
            <Space orientation="vertical">
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>要求大写字母</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>至少 8 位字符</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>要求包含特殊字符</Text></div>
            </Space>
          </Form.Item>
          <Form.Item label="会话超时">
            <Space>
              <Input defaultValue="30" style={{ width: 80 }} suffix="分钟" />
            </Space>
          </Form.Item>
          <Form.Item label="多因素认证">
            <Switch /> <Text type="secondary" style={{ marginLeft: 8 }}>启用 MFA 以增强安全性</Text>
          </Form.Item>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </Form>
      ),
    },
    {
      key: 'ai',
      label: <span><CloudOutlined /> AI 设置</span>,
      children: (
        <Form layout="vertical" style={{ maxWidth: 600 }}>
          <Alert
            message="API Key 配置"
            description={
              <div>
                <p style={{ margin: '8px 0' }}>
                  请配置您的 DeepSeek API Key 以启用 AI 功能。您的 API Key 仅存储在本地，仅用于 AI 服务请求。
                </p>
                <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">
                  获取 API Key
                </a>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="DeepSeek API Key">
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Input.Password
                value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                placeholder="请输入您的 DeepSeek API Key"
                iconRender={(visible) =>
                  visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
              />
              <div>
                <Button
                  type="primary"
                  onClick={() => {
                    if (apiKey.trim()) {
                      setApiKey(apiKey.trim());
                      setHasApiKeyConfig(true);
                      message.success('API Key 已保存');
                    } else {
                      message.error('请输入 API Key');
                    }
                  }}
                >
                  保存 API Key
                </Button>
                {hasApiKeyConfig && (
                  <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>
                    已配置
                  </Tag>
                )}
              </div>
            </Space>
          </Form.Item>

          <Divider />

          <Form.Item label="AI 模型">
            <Space orientation="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button
                  type="primary"
                  onClick={() => {
                    message.success('已切换到 DeepSeek V3');
                  }}
                >
                  DeepSeek V3
                </Button>
                <Text type="secondary">当前使用中</Text>
              </div>
              <Text type="secondary">
                切换至：
                <Button type="link" size="small" onClick={() => message.info('已切换到 DeepSeek V2')}>DeepSeek V2</Button>
                <Button type="link" size="small" onClick={() => message.info('已切换到 GPT-4o')}>GPT-4o</Button>
                <Button type="link" size="small" onClick={() => message.info('已切换到 Claude 3.5')}>Claude 3.5</Button>
              </Text>
            </Space>
          </Form.Item>

          <Divider />

          <Form.Item label="AI 功能">
            <Space orientation="vertical">
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>智能问答</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>会议纪要</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>文档生成</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>数据分析</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>AI 助手对话</Text></div>
              <div><Switch defaultChecked /> <Text style={{ marginLeft: 8 }}>知识图谱</Text></div>
            </Space>
          </Form.Item>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </Form>
      ),
    },
  ];

  return (
    <div style={{ padding: 20, background: '#F7F9FC', minHeight: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1D2129' }}>
          <SettingOutlined style={{ marginRight: 8 }} />
          系统设置
        </Title>
        <Text type="secondary">配置您的系统偏好与账号设置</Text>
      </div>

      <Card>
        <Tabs items={tabItems} tabPlacement="start" style={{ minHeight: 500 }} />
      </Card>
    </div>
  );
};

export default SystemSettings;
