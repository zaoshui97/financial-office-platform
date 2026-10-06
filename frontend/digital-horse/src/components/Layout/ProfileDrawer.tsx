import React, { useState } from 'react';
import {
  Drawer,
  Avatar,
  Typography,
  Button,
  Form,
  Input,
  Divider,
  message,
  Modal,
  Tag,
  Upload,
  App,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  ApartmentOutlined,
  SaveOutlined,
  LogoutOutlined,
  CameraOutlined,
  SettingOutlined,
  GlobalOutlined,
  StarOutlined,
  LockOutlined,
  LinkOutlined,
  SwapOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/i18n';
import { useUserStore } from '@/store';
import { eventBus } from '@/services/eventBus';

const { Text, Title } = Typography;

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: msg } = App.useApp();
  const { user, logout, updateAvatar, setRole } = useUserStore();
  const [form] = Form.useForm();
  const currentLang = getCurrentLanguage();

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isZh = currentLang === 'zh-CN';

  // 用户显示数据走 t() 翻译
  const mockData = {
    username: 'zhangsan',
    name: user?.name || (isZh ? t('profile.defaultName') : t('profile.defaultNameEn')),
    email: 'zhangsan@hundsun.com',
    phone: '13800138000',
    department: isZh ? t('profile.defaultDepartment') : t('profile.defaultDepartmentEn'),
    position: isZh ? t('profile.defaultPosition') : t('profile.defaultPositionEn'),
    title: isZh ? t('profile.defaultTitle') : t('profile.defaultTitleEn'),
    employeeId: 'HS20231001',
    dingtalkId: t('profile.dingtalkLinked'),
  };

  const handleSave = () => {
    message.success(t('profile.saveSuccess'));
  };

  const handleLogout = () => {
    Modal.confirm({
      title: t('header.logoutConfirm'),
      content: t('header.logoutMessage'),
      okText: t('header.logout'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        logout();
        onClose();
        navigate('/login');
      },
    });
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #E8EDF4',
    padding: 20,
    marginBottom: 16,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#86909C',
    marginBottom: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#86909C',
    marginBottom: 4,
  };

  const fieldValueStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#1D2129',
    fontWeight: 500,
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      styles={{
        wrapper: { width: 420, maxWidth: 'calc(100vw - 32px)' },
        body: { padding: 0, background: '#F7F9FC' },
        header: { display: 'none' },
      }}
      title={null}
      closable={false}
    >
      {/* 顶部 Header - 品牌深蓝渐变 */}
      <div
        style={{
          background: '#0F2B5B',
          padding: '18px 20px 20px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, letterSpacing: 1.5, fontWeight: 500 }}>
            {isZh ? t('profile.drawerTitle') : t('profile.drawerTitleEn')}
          </Text>
          <Button
            type="text"
            onClick={onClose}
            style={{ color: '#fff', fontSize: 18, width: 28, height: 28, padding: 0 }}
            icon={<span style={{ fontSize: 20, lineHeight: 1 }}>×</span>}
          />
        </div>

        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              size={64}
              src={user?.avatar || undefined}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.3)',
                fontSize: 26,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              {!user?.avatar && (mockData.name.charAt(0) || 'U')}
            </Avatar>
            <Upload
              showUploadList={false}
              beforeUpload={(file) => {
                if (!file.type.startsWith('image/')) {
                  message.error(t('profile.avatarImageOnly'));
                  return false;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                  setPreviewImage(e.target?.result as string);
                  setPreviewVisible(true);
                };
                reader.readAsDataURL(file);
                return false;
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <CameraOutlined style={{ color: '#0F2B5B', fontSize: 11 }} />
              </div>
            </Upload>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <Title
              level={4}
              style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}
            >
              {mockData.name}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, display: 'block', marginTop: 3 }}>
              {mockData.title}
            </Text>
            <div style={{ marginTop: 6 }}>
              <Tag
                style={{
                  background: 'rgba(82,196,26,0.18)',
                  border: '1px solid rgba(82,196,26,0.4)',
                  color: '#a0e85f',
                  fontSize: 11,
                  margin: 0,
                  padding: '0 8px',
                  lineHeight: '18px',
                }}
              >
                <CheckCircleFilled style={{ fontSize: 10, marginRight: 4 }} />
                {t('profile.onlineStatus')}
              </Tag>
            </div>
          </div>
        </div>
      </div>

      {/* 主体内容 - 不再上移，与渐变区自然分隔 */}
      <div style={{ padding: '16px 16px 24px' }}>
        {/* 基础信息卡片 */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <UserOutlined style={{ marginRight: 8 }} />
            {t('profile.basicInfo')}
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={mockData}
            requiredMark={false}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={fieldLabelStyle}>{t('profile.employeeId')}</div>
                <div style={fieldValueStyle}>
                  <IdcardOutlined style={{ marginRight: 6, color: '#0F2B5B' }} />
                  {mockData.employeeId}
                </div>
              </div>
              <div>
                <div style={fieldLabelStyle}>{t('profile.department')}</div>
                <div
                  style={{
                    ...fieldValueStyle,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={mockData.department}
                >
                  <ApartmentOutlined style={{ marginRight: 6, color: '#0F2B5B' }} />
                  {mockData.department}
                </div>
              </div>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            <Form.Item
              label={<span style={fieldLabelStyle}>{t('profile.name')}</span>}
              name="name"
              style={{ marginBottom: 12 }}
            >
              <Input prefix={<UserOutlined />} />
            </Form.Item>

            <Form.Item
              label={<span style={fieldLabelStyle}>{t('profile.email')}</span>}
              name="email"
              style={{ marginBottom: 12 }}
            >
              <Input prefix={<MailOutlined />} />
            </Form.Item>

            <Form.Item
              label={<span style={fieldLabelStyle}>{t('profile.phone')}</span>}
              name="phone"
              style={{ marginBottom: 0 }}
            >
              <Input prefix={<PhoneOutlined />} />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              block
              style={{
                marginTop: 16,
                background: '#0F2B5B',
                border: 'none',
                height: 38,
                borderRadius: 8,
              }}
            >
              {t('profile.saveChanges')}
            </Button>
          </Form>
        </div>

        {/* 安全设置卡片 */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <LockOutlined style={{ marginRight: 8 }} />
            {t('profile.securitySettings')}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #F0F2F5',
            }}
          >
            <div>
              <div style={{ ...fieldValueStyle, fontSize: 13 }}>{t('profile.password')}</div>
              <div style={{ ...fieldLabelStyle, marginTop: 2 }}>
                {t('profile.passwordLastChanged')}
              </div>
            </div>
            <Button type="link" size="small" style={{ color: '#0F2B5B', padding: 0 }}>
              {t('profile.change')}
            </Button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 0',
            }}
          >
            <div>
              <div style={{ ...fieldValueStyle, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <LinkOutlined style={{ color: '#1677FF' }} />
                {t('profile.dingtalkAccount')}
              </div>
              <div style={{ ...fieldLabelStyle, marginTop: 2 }}>{mockData.dingtalkId}</div>
            </div>
            <Tag color="success" style={{ margin: 0 }}>
              {t('profile.dingtalkLinked')}
            </Tag>
          </div>
        </div>

        {/* 偏好设置卡片 */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <SettingOutlined style={{ marginRight: 8 }} />
            {t('profile.preferences')}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GlobalOutlined style={{ color: '#0F2B5B', fontSize: 16 }} />
              <div>
                <div style={{ ...fieldValueStyle, fontSize: 13 }}>{t('profile.language')}</div>
                <div style={{ ...fieldLabelStyle, marginTop: 2 }}>
                  {currentLang === 'zh-CN' ? t('common.chinese') : t('common.english')}
                </div>
              </div>
            </div>
            {/* 语言切换：中文锁定阶段先隐藏，切换按钮直接去掉 */}
            <Button
              type="link"
              size="small"
              style={{ color: '#0F2BB', padding: 0, visibility: 'hidden' }}
              disabled
            >
              {t('common.switch')}
            </Button>
          </div>
        </div>

        {/* 快捷入口卡片 */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <StarOutlined style={{ marginRight: 8 }} />
            {t('profile.quickAccess')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              {
                key: 'role',
                icon: <SwapOutlined />,
                label: t('settings.switchRole'),
              },
              {
                key: 'favorites',
                icon: <StarOutlined />,
                label: t('profile.favorites'),
              },
              {
                key: 'settings',
                icon: <SettingOutlined />,
                label: t('common.settings'),
              },
            ].map((item) => (
              <div
                key={item.key}
                onClick={async () => {
                  if (item.key === 'settings') {
                    navigate('/settings');
                  } else if (item.key === 'role') {
                    // 角色切换弹窗
                    const { default: RoleSwitchModal } = await import('@/components/RoleSwitchModal');
                    RoleSwitchModal.show({ currentRole: user?.role || 'USER', onSwitch: (newRole) => {
                      setRole(newRole);
                      eventBus.emit('user.roleChanged', {
                        userId: user?.id || '',
                        from: user?.role || '',
                        to: newRole,
                      });
                      msg.success(`已切换为${t(`permission.${newRole}`)}`);
                    }});
                  }
                  onClose();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 8px',
                  borderRadius: 8,
                  background: '#F7F9FC',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(15, 43, 91, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#F7F9FC';
                }}
              >
                <div style={{ color: '#0F2B5B', fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontSize: 12, color: '#4E5969' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 退出登录 */}
        <Button
          danger
          block
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          style={{
            height: 40,
            borderRadius: 8,
            background: '#fff',
            border: '1px solid #FFCCC7',
          }}
        >
          {t('profile.signOut')}
        </Button>
      </div>

      {/* 头像预览 Modal */}
      <Modal
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        centered
        style={{ width: 320, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <Avatar src={previewImage || undefined} size={180} icon={<UserOutlined />} />
          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button onClick={() => setPreviewVisible(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="primary"
              onClick={() => {
                updateAvatar(previewImage!);
                setPreviewVisible(false);
                message.success(t('profile.avatarUpdated'));
              }}
              style={{
                background: '#0F2B5B',
                border: 'none',
              }}
            >
              {t('profile.avatarPreview')}
            </Button>
          </div>
        </div>
      </Modal>
    </Drawer>
  );
};

export default ProfileDrawer;
