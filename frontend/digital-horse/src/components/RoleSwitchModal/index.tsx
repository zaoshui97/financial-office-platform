/**
 * 角色切换 Modal —— 仿真切换登录角色
 *
 * 触发方式：
 *   RoleSwitchModal.show({ currentRole, onSwitch })
 *
 * 效果：
 *   - 切换 userStore.setRole()
 *   - 触发 eventBus.user.roleChanged（联动通知中心清空等）
 *   - 刷新整个 App（走 React 重渲染，Sidebar / Topbar / 各页面菜单自动响应权限变化）
 *
 * 注意：这是纯前端仿真，切换角色后数据权限按 mock 规则过滤。
 */

import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Divider, Tag, message, App } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  CrownOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { Role } from '@/types/permission';
import { useUserStore } from '@/store/userStore';

const { Text, Title } = Typography;

const ROLE_META: Array<{
  role: Role;
  label: string;
  labelEn: string;
  desc: string;
  color: string;
  icon: React.ReactNode;
}> = [
  {
    role: 'USER',
    label: '普通用户',
    labelEn: 'Employee',
    desc: '可使用核心办公功能，数据仅限本人',
    color: '#3B82F6',
    icon: <UserOutlined />,
  },
  {
    role: 'DEPT_ADMIN',
    label: '部门管理员',
    labelEn: 'Dept Admin',
    desc: '可管理本部门所有数据，审批与查看范围扩展',
    color: '#8B5CF6',
    icon: <TeamOutlined />,
  },
  {
    role: 'SUPER_ADMIN',
    label: '超级管理员',
    labelEn: 'Super Admin',
    desc: '系统全权限，可访问所有模块与系统设置',
    color: '#F59E0B',
    icon: <CrownOutlined />,
  },
];

interface ShowOptions {
  currentRole: Role;
  onSwitch: (role: Role) => void;
}

let _showFn: ((options: ShowOptions) => void) | null = null;

/** 调用入口（暴露给外部） */
function show(options: ShowOptions) {
  _showFn?.(options);
}

/** 导出 show 函数供外部调用 */
export { show as showRoleSwitchModal };

export const RoleSwitchModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ShowOptions | null>(null);
  const { message: msg } = App.useApp();

  // 注册 show 函数（组件 mount 时注册，unmount 时清除）
  React.useEffect(() => {
    _showFn = (options) => {
      setPending(options);
      setOpen(true);
    };
    return () => { _showFn = null; };
  }, []);

  const handleSwitch = (role: Role) => {
    if (!pending) return;
    setOpen(false);
    pending.onSwitch(role);
  };

  const current = pending?.currentRole;

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      style={{ width: 440, maxWidth: 'calc(100vw - 32px)' }}
      centered
      destroyOnHidden
      title={
        <Space>
          <SwapOutlined style={{ color: '#0F2B5B' }} />
          <span>切换登录角色</span>
        </Space>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          切换角色可体验不同权限下的平台功能。切换仅在前端生效（仿真），不影响真实账号。
        </Text>
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {ROLE_META.map((meta) => {
          const isCurrent = current === meta.role;
          return (
            <div
              key={meta.role}
              onClick={() => !isCurrent && handleSwitch(meta.role)}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: `2px solid ${isCurrent ? meta.color : '#e8e8e8'}`,
                background: isCurrent ? `${meta.color}10` : '#fff',
                cursor: isCurrent ? 'default' : 'pointer',
                transition: 'all 0.2s',
                opacity: isCurrent ? 1 : 0.85,
              }}
            >
              <Space>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `${meta.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: meta.color,
                    fontSize: 18,
                  }}
                >
                  {meta.icon}
                </div>
                <div>
                  <Space>
                    <Text strong style={{ fontSize: 15 }}>{meta.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>({meta.labelEn})</Text>
                    {isCurrent && <Tag color={meta.color}>当前角色</Tag>}
                  </Space>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{meta.desc}</div>
                </div>
              </Space>
            </div>
          );
        })}
      </Space>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button onClick={() => setOpen(false)}>取消</Button>
      </div>
    </Modal>
  );
};

export default RoleSwitchModal;
