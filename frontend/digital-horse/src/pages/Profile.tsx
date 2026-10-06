import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Avatar, Space, Upload, message, Divider, Modal } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

const { Dragger } = Upload;

// 语言感知的 Mock 用户数据
const getMockUserData = (t: (key: string) => string) => {
  return {
    username: 'zhangsan',
    name: t('auto.23'),
    email: 'zhangsan@hundsun.com',
    phone: '13800138000',
    department: t('auto.68'),
    position: t('auto.67'),
    title: t('auto.66'),
  };
};

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [mockUser] = useState(getMockUserData(t));
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 监听语言变化，更新表单初始值
  useEffect(() => {
    const handleLanguageChange = () => {
      const newUserData = getMockUserData();
      form.setFieldsValue({
        name: newUserData.name,
        department: newUserData.department,
        position: newUserData.position,
      });
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [form]);

  const handleFinish = () => {
    message.success(t('profile.saveSuccess'));
  };

  return (
    <Card>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Card style={{ background: '#fafafa' }}>
          <Space>
            <Avatar size={80} icon={<UserOutlined />} />
            <div>
              <h3>{mockUser.name}</h3>
              <p style={{ color: '#8c8c8c' }}>{mockUser.title}</p>
            <Dragger
                showUploadList={false}
                beforeUpload={(file) => {
                  const isImage = file.type.startsWith('image/');
                  if (!isImage) {
                    message.error(t('profile.avatarImageOnly'));
                    return false;
                  }
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    setPreviewImage(e.target?.result as string);
                    setAvatarPreviewVisible(true);
                  };
                  reader.readAsDataURL(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>{t('profile.changeAvatar')}</Button>
              </Dragger>
            </div>
          </Space>
        </Card>

        <Divider>{t('profile.basicInfo')}</Divider>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{
            username: mockUser.username,
            name: mockUser.name,
            email: mockUser.email,
            phone: mockUser.phone,
            department: mockUser.department,
            position: mockUser.position,
          }}
        >
          <Form.Item label={t('profile.username')} name="username">
            <Input disabled prefix={<UserOutlined />} />
          </Form.Item>

          <Form.Item label={t('settings.name')} name="name" rules={[{ required: true, message: t('common.required') }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>

          <Form.Item label={t('settings.email')} name="email" rules={[{ required: true, type: 'email', message: t('profile.emailInvalid') }]}>
            <Input prefix={<MailOutlined />} />
          </Form.Item>

          <Form.Item label={t('settings.phone')} name="phone">
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>

          <Form.Item label={t('settings.department')} name="department">
            <Input />
          </Form.Item>

          <Form.Item label={t('settings.position')} name="position">
            <Input />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              {t('profile.saveChanges')}
            </Button>
          </Form.Item>
        </Form>

        <Modal
          title={t('profile.avatarPreview')}
          open={avatarPreviewVisible}
          onCancel={() => setAvatarPreviewVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setAvatarPreviewVisible(false)}>
              {t('common.cancel')}
            </Button>,
            <Button key="confirm" type="primary" onClick={() => {
              message.success(t('profile.avatarUpdated'));
              setAvatarPreviewVisible(false);
            }}>
              {t('common.confirm')}
            </Button>,
          ]}
        >
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {previewImage && (
              <Avatar src={previewImage} size={200} icon={<UserOutlined />} />
            )}
            <p style={{ marginTop: 16, color: '#666' }}>{t('profile.avatarPreviewTip')}</p>
          </div>
        </Modal>
      </Space>
    </Card>
  );
};

export default Profile;
