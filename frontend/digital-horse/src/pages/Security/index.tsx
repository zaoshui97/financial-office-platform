import React, { useState } from 'react';
import { Card, Row, Col, Typography, Tag, Space, Button, Table, Modal, message, Descriptions, Divider } from 'antd';
import {
  SafetyCertificateOutlined,
  UserOutlined,
  LockOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  userCount: number;
  permissionCount: number;
}

interface User {
  id: string;
  name: string;
  department: string;
  role: string;
  status: 'active' | 'disabled';
  lastLogin: string;
}

const SecurityCenter: React.FC = () => {
  const { t } = useTranslation();
  const [roles] = useState<Role[]>([
    { id: '1', name: '超级管理员', code: 'SUPER_ADMIN', description: '拥有系统所有权限', userCount: 2, permissionCount: 156 },
    { id: '2', name: '部门管理员', code: 'DEPT_ADMIN', description: '管理部门内部事务', userCount: 8, permissionCount: 78 },
    { id: '3', name: '普通用户', code: 'USER', description: '日常办公使用', userCount: 156, permissionCount: 45 },
    { id: '4', name: '审计员', code: 'AUDITOR', description: '查看审计日志', userCount: 4, permissionCount: 23 },
  ]);

  const [users, setUsers] = useState<User[]>([
    { id: '1', name: '张三', department: '技术部', role: '超级管理员', status: 'active', lastLogin: '2026-07-24 14:30' },
    { id: '2', name: '李四', department: '合规部', role: '部门管理员', status: 'active', lastLogin: '2026-07-24 13:45' },
    { id: '3', name: '王五', department: '市场部', role: '普通用户', status: 'active', lastLogin: '2026-07-24 11:20' },
    { id: '4', name: '赵六', department: '财务部', role: '普通用户', status: 'disabled', lastLogin: '2026-07-20 09:00' },
  ]);

  // 角色详情弹窗
  const [roleDetailVisible, setRoleDetailVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // 权限分配弹窗
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionRole, setPermissionRole] = useState<Role | null>(null);

  // 重置密码弹窗
  const [resetPwdVisible, setResetPwdVisible] = useState(false);
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null);

  // 角色查看
  const handleViewRole = (role: Role) => {
    setSelectedRole(role);
    setRoleDetailVisible(true);
  };

  // 权限分配
  const handleAssignPermission = (role: Role) => {
    setPermissionRole(role);
    setPermissionModalVisible(true);
  };

  // 重置密码
  const handleResetPwd = (user: User) => {
    setResetPwdUser(user);
    setResetPwdVisible(true);
  };

  // 确认重置密码
  const confirmResetPwd = () => {
    if (!resetPwdUser) return;
    message.success(`已向 ${resetPwdUser.name} 的手机/邮箱发送密码重置链接`);
    setResetPwdVisible(false);
  };

  // 切换用户状态
  const handleToggleUserStatus = (user: User) => {
    const isDisabling = user.status === 'active';
    Modal.confirm({
      title: isDisabling ? '禁用用户' : '启用用户',
      content: `确认${isDisabling ? '禁用' : '启用'}用户「${user.name}」？${isDisabling ? '禁用后该用户将无法登录系统' : '启用后该用户可正常使用系统'}`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: isDisabling ? 'disabled' as const : 'active' as const } : u));
        message.success(`用户「${user.name}」已${isDisabling ? '禁用' : '启用'}`);
      },
    });
  };

  const roleColumns: ColumnsType<Role> = [
    { title: t('security.roleName'), dataIndex: 'name', key: 'name', render: (text) => <Text strong>{text}</Text> },
    { title: t('security.roleCode'), dataIndex: 'code', key: 'code', render: (code) => <Tag>{code}</Tag> },
    { title: t('security.description'), dataIndex: 'description', key: 'description', ellipsis: true },
    { title: t('security.userCount'), dataIndex: 'userCount', key: 'userCount', render: (n) => <Tag color="blue">{n}人</Tag> },
    { title: t('security.permissionCount'), dataIndex: 'permissionCount', key: 'permissionCount', render: (n) => `${n}项` },
    {
      title: t('common.action'),
      key: 'action',
      render: (_, record: Role) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewRole(record)}>查看</Button>
          <Button type="link" size="small" icon={<LockOutlined />} onClick={() => handleAssignPermission(record)}>权限</Button>
        </Space>
      ),
    },
  ];

  const userColumns: ColumnsType<User> = [
    {
      title: t('security.userName'),
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Space><UserOutlined />{text}</Space>,
    },
    { title: t('security.department'), dataIndex: 'department', key: 'department' },
    { title: t('security.role'), dataIndex: 'role', key: 'role', render: (text) => <Tag color="blue">{text}</Tag> },
    {
      title: t('security.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'} icon={status === 'active' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {status === 'active' ? '正常' : '禁用'}
        </Tag>
      ),
    },
    { title: t('security.lastLogin'), dataIndex: 'lastLogin', key: 'lastLogin' },
    {
      title: t('common.action'),
      key: 'action',
      render: (_, record: User) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleResetPwd(record)}>{t('security.resetPwd')}</Button>
          <Button type="link" size="small" danger={record.status === 'active'} onClick={() => handleToggleUserStatus(record)}>
            {record.status === 'active' ? t('security.disable') : '启用'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 20, background: '#F7F9FC', minHeight: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1D2129' }}>
          <SafetyCertificateOutlined style={{ marginRight: 8 }} />
          {t('security.title') || '权限安全中心'}
        </Title>
        <Text type="secondary">{t('security.subtitle') || '统一管理系统用户、角色权限与安全策略'}</Text>
      </div>

      {/* 安全概览 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 32, color: '#22A775', marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 600, color: '#0F2B5B' }}>170</div>
              <Text type="secondary">在线用户</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <ExclamationCircleOutlined style={{ fontSize: 32, color: '#E69948', marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 600, color: '#0F2B5B' }}>3</div>
              <Text type="secondary">待审批申请</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <LockOutlined style={{ fontSize: 32, color: '#3B82F6', marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 600, color: '#0F2B5B' }}>4</div>
              <Text type="secondary">角色总数</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#C9A459', marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 600, color: '#0F2B5B' }}>156</div>
              <Text type="secondary">权限项</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 角色列表 */}
      <Card title={t('security.roleList') || '角色列表'} style={{ marginBottom: 20 }}>
        <Table columns={roleColumns} dataSource={roles} rowKey="id" pagination={false} />
      </Card>

      {/* 用户列表 */}
      <Card title={t('security.userList') || '用户列表'}>
        <Table columns={userColumns} dataSource={users} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      {/* 角色详情 Modal */}
      <Modal
        title={selectedRole ? `角色详情：${selectedRole.name}` : '角色详情'}
        open={roleDetailVisible}
        onCancel={() => setRoleDetailVisible(false)}
        footer={<Button type="primary" onClick={() => setRoleDetailVisible(false)}>关闭</Button>}
        style={{ width: 640, maxWidth: 'calc(100vw - 32px)' }}
      >
        {selectedRole && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="角色名称">{selectedRole.name}</Descriptions.Item>
            <Descriptions.Item label="角色编码">{selectedRole.code}</Descriptions.Item>
            <Descriptions.Item label="用户数量" span={2}>
              <Tag color="blue">{selectedRole.userCount} 人</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="权限项数" span={2}>
              <Tag color="blue">{selectedRole.permissionCount} 项</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="角色描述" span={2}>
              {selectedRole.description}
            </Descriptions.Item>
            <Descriptions.Item label="包含用户" span={2}>
              {users.filter(u => u.role === selectedRole.name).map(u => (
                <Tag key={u.id} color={u.status === 'active' ? 'success' : 'default'}>{u.name}</Tag>
              ))}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 权限分配 Modal */}
      <Modal
        title={permissionRole ? `权限分配：${permissionRole.name}` : '权限分配'}
        open={permissionModalVisible}
        onCancel={() => setPermissionModalVisible(false)}
        onOk={() => {
          message.success(`已保存 ${permissionRole?.name} 的权限配置`);
          setPermissionModalVisible(false);
        }}
        okText="保存配置"
        cancelText="取消"
        style={{ width: 680, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">为该角色配置可访问的模块权限，操作将记录审计日志</Text>
        </div>
        <div style={{ background: '#F7F9FC', padding: 16, borderRadius: 6 }}>
          {[
            { module: '工作台', perms: ['查看', '编辑'] },
            { module: '会议协同', perms: ['创建会议', '查看会议', '编辑会议', '删除会议', '导出纪要'] },
            { module: 'AI智能助手', perms: ['发起对话', '上传文档', '查看历史'] },
            { module: '知识库', perms: ['查看', '上传', '编辑', '删除', '下载'] },
            { module: '长会话记忆', perms: ['查看个人', '查看全部门'] },
            { module: '权限安全', perms: ['用户管理', '角色管理', '审计日志'] },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: 12, padding: 12, background: '#fff', borderRadius: 4 }}>
              <Text strong style={{ color: '#0F2B5B', marginRight: 12 }}>{item.module}</Text>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {item.perms.map((p, j) => (
                  <Tag key={j} color={j === 0 ? 'blue' : 'default'}>{p}</Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* 重置密码 Modal */}
      <Modal
        title="重置密码"
        open={resetPwdVisible}
        onCancel={() => setResetPwdVisible(false)}
        onOk={confirmResetPwd}
        okText="发送重置链接"
        cancelText="取消"
      >
        {resetPwdUser && (
          <div>
            <p>确认向用户 <Text strong>{resetPwdUser.name}</Text> 发送密码重置链接？</p>
            <div style={{ background: '#F7F9FC', padding: 12, borderRadius: 6, marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}><Text type="secondary">所属部门：</Text>{resetPwdUser.department}</div>
              <div style={{ marginBottom: 8 }}><Text type="secondary">角色：</Text><Tag color="blue">{resetPwdUser.role}</Tag></div>
              <div><Text type="secondary">当前状态：</Text>
                <Tag color={resetPwdUser.status === 'active' ? 'success' : 'default'}>
                  {resetPwdUser.status === 'active' ? '正常' : '禁用'}
                </Tag>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SecurityCenter;
