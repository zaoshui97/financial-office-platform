/**
 * Login Page
 * 登录页 —— 中文锁定阶段全中文展示
 */

import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, message, Select, Typography, Space, Divider, Tooltip, Tabs } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, DingtalkOutlined, MobileOutlined, SafetyOutlined, WechatOutlined, QrcodeOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserStore, mapRoleFromBackend, isTokenExpired } from '@/store';
import type { Role } from '@/types/permission';
import { ROLE_LABELS, MOCK_USERS } from '@/types/permission';
import { authApi } from '@/api/auth';
import Logo from '@/components/Layout/Logo';
import DingtalkQrLogin from '@/components/DingtalkQrLogin';
import SystemHealthBanner from '@/components/SystemHealthBanner';

/**
 * 真实模式 vs Mock 模式开关 —— 受 VITE_USE_MOCK 控制。
 * 当 VITE_USE_MOCK=false 时（默认）：
 *   - handleLogin 严格走 /api/v1/auth/login
 *   - 快捷体验账号仍然显示，点击后调用后端真账号（已在 MySQL seed）
 * 当 VITE_USE_MOCK=true 时：
 *   - handleLogin 直接读 MOCK_USERS 放行；快捷按钮仍调本地假数据
 */
const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === 'true';

const { Title, Text } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
  role: Role;
}

// Animated background
const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
    }[] = [];

    const colors = [
      'rgba(59, 130, 246, 0.6)',
      'rgba(99, 102, 241, 0.5)',
      'rgba(14, 165, 233, 0.4)',
      'rgba(139, 92, 246, 0.5)',
      'rgba(6, 182, 212, 0.4)',
    ];

    const createParticles = () => {
      const particleCount = 140;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          radius: Math.random() * 3.5 + 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };
    createParticles();

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        particles.forEach((p2, j) => {
          if (i === j) return;
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.15 * (1 - distance / 120)})`;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
};

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setToken, clearAuth } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [dtQrOpen, setDtQrOpen] = useState(false);
  const [loginWay, setLoginWay] = useState<'password' | 'sms'>('password');
  const [form] = Form.useForm();

  /** 从 query string 读取登录成功后要回到的路径 */
  const fromPath = (() => {
    const params = new URLSearchParams(location.search);
    const from = params.get('from');
    return from && from.startsWith('/') ? from : '/dashboard';
  })();

  /**
   * 把后端 UserRead 映射为前端 User。
   * Phase 1 不区分 DEPARTMENT（DEPT_ADMIN 由后端 User.role 字段返回，前端保留映射扩展位）。
   */
  const mapBackendUserToStore = (backendUser: {
    id: number | string;
    username: string;
    email: string;
    full_name: string | null;
    is_superuser?: boolean;
    role?: string;
    position?: string;
  }) => {
    const role: Role = mapRoleFromBackend({
      is_superuser: backendUser.is_superuser,
      role: backendUser.role,
      position: backendUser.position,
    });
    return {
      id: String(backendUser.id),
      username: backendUser.username,
      name: backendUser.full_name || backendUser.username,
      email: backendUser.email,
      role,
      department: '',
    };
  }

  const handleLogin = async (values: LoginFormValues) => {
    setLoading(true);

    // ============ Mock 模式（仅 VITE_USE_MOCK=true 时启用）============
    if (USE_MOCK) {
      setTimeout(() => {
        const mockUser = MOCK_USERS[values.username];
        if (mockUser) {
          const userData = {
            id: `user-${values.username}`,
            username: values.username,
            name: mockUser.name,
            role: values.role,
            department: mockUser.department,
          };
          setUser(userData);
          setToken({
            access_token: `mock-token-${Date.now()}`,
            token_type: 'bearer',
            expires_in: 7200,
            saved_at: Date.now(),
          });
          message.success(`${t('login.success')} - ${ROLE_LABELS[values.role]}`);
          navigate(fromPath, { replace: true });
        } else {
          const userData = {
            id: `user-${values.username}`,
            username: values.username,
            name: values.username,
            role: values.role,
            department: t('login.department'),
          };
          setUser(userData);
          setToken({
            access_token: `mock-token-${Date.now()}`,
            token_type: 'bearer',
            expires_in: 7200,
            saved_at: Date.now(),
          });
          message.success(`${t('login.success')} - ${ROLE_LABELS[values.role]}`);
          navigate(fromPath, { replace: true });
        }
        setLoading(false);
      }, 500);
      return;
    }

    // ============ 真实模式：走 OAuth2PasswordRequestForm ============
    try {
      clearAuth();
      // 注意：utils/request.ts 的 axios 响应拦截器已经 `return response.data`，
      // 所以 authApi.login() 直接返回 TokenResponse 对象，不要再解构 { data }。
      const token = await authApi.login(values.username, values.password);
      setToken({
        access_token: token.access_token,
        token_type: token.token_type,
        expires_in: token.expires_in,
        saved_at: Date.now(),
      });
      // 用 /auth/me 拉一次真实用户信息
      const me = await authApi.me();
      const userData = mapBackendUserToStore(me);
      setUser(userData);
      message.success(`${t('login.success')} - ${ROLE_LABELS[userData.role]}`);
      navigate(fromPath, { replace: true });
    } catch (err: any) {
      // 友好错误提示：避免后端 JSON 解析失败 / 网络错误时一片空白
      const status = err?.response?.status;
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        '登录失败';
      if (status === 401) {
        message.error(`用户名或密码错误。可用 demo 账号：admin_test / admin123 或 zhangsan / 123456`, 4);
      } else if (status === 422) {
        message.error('请求参数缺失，请检查用户名和密码是否填写', 4);
      } else if (status === 0 || !status) {
        message.error('后端服务不可达，请确认 uvicorn 已运行于 http://127.0.0.1:8030', 4);
      } else {
        message.error(`登录失败：${detail}`, 4);
      }
      // eslint-disable-next-line no-console
      console.error('[login] 真实模式登录失败', err);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (username: string, role: Role) => {
    form.setFieldsValue({ username, password: '123456', role });
    handleLogin({ username, password: '123456', role });
  };

  // 快速登录示例账号 —— 后端 MySQL 已 seed 4 个账号（zhangsan/lisi/wangwu/zhaoliu，密码统一 123456）。
  // 真实模式下：自动填表 + handleLogin 走 /api/v1/auth/login；mock 模式下：MOCK_USERS 直接放行。
  const quickAccounts: Array<{
    username: string;
    role: Role;
    label: string;
  }> = [
    { username: 'zhangsan', role: 'SUPER_ADMIN', label: '张三（超级管理员）' },
    { username: 'lisi', role: 'DEPT_ADMIN', label: '李四（合规部管理员）' },
    { username: 'wangba', role: 'DEPT_ADMIN', label: '王八（市场部管理员）' },
    { username: 'wangwu', role: 'USER', label: '王五（市场部员工）' },
    { username: 'zhaoliu', role: 'AUDITOR', label: '赵六（审计员）' },
  ];

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(120deg, #152b5c 0%, #1a3a72 45%, #234b9e 100%)',
      }}
    >
      {/* 后端健康条幅 —— 顶部 */}
      <SystemHealthBanner />

      {/* 主体内容 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* 全屏共享动态粒子背景 */}
      <AnimatedBackground />

      {/* 中央光晕 —— 跨越中线，消除分裂感 */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.20) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '45%',
          transform: 'translateX(-50%)',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Left brand area */}
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-end',
          padding: '48px 48px 48px 20%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '100%' }}>
          <Logo size={108} />

          <Title
            level={1}
            style={{
              margin: 0,
              fontSize: 56,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.08em',
              textShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            睿枢
          </Title>

          <Text
            style={{
              fontSize: 17,
              color: '#fff',
              fontWeight: 500,
              display: 'block',
              marginTop: 14,
              letterSpacing: '0.02em',
              textShadow: '0 2px 6px rgba(0,0,0,0.4)',
            }}
          >
            AI 驱动的金融企业智能办公提效平台
          </Text>

          <div
            style={{
              marginTop: 40,
              display: 'flex',
              gap: 16,
              flexWrap: 'nowrap',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {[
              { icon: 'AI', label: '智能分析' },
              { icon: 'BI', label: '数据洞察' },
              { icon: 'MR', label: '智能会议' },
              { icon: 'SL', label: '智能知识' },
            ].map((item) => (
              <div
                key={item.icon}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 18px',
                  background: 'rgba(255, 255, 255, 0.18)',
                  borderRadius: 100,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{item.icon}</span>
                <Text style={{ color: '#fff', fontWeight: 600, fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>{item.label}</Text>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form —— 白底卡片浮在全屏动态背景上 */}
      <div
        style={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 8% 48px 48px',
          position: 'relative',
          zIndex: 2,
        }}
      >

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 380,
            padding: '24px 24px 20px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Title level={3} style={{ margin: 0, color: '#0F2B5B' }}>
              欢迎回来
            </Title>
            <Text style={{ fontSize: 12, color: '#666' }}>
              请登录您的账号继续使用
            </Text>
          </div>

          {/* 登录方式 Tab：密码 / 短信 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 18,
              marginBottom: 14,
              fontSize: 13,
            }}
          >
            {[
              { key: 'password', label: '密码登录' },
              { key: 'sms', label: '验证码登录' },
            ].map((it) => {
              const active = loginWay === it.key;
              return (
                <div
                  key={it.key}
                  onClick={() => setLoginWay(it.key as 'password' | 'sms')}
                  style={{
                    cursor: 'pointer',
                    color: active ? '#0F2B5B' : '#666',
                    fontWeight: active ? 600 : 400,
                    paddingBottom: 4,
                    borderBottom: active ? '2px solid #0F2B5B' : '2px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  {it.label}
                </div>
              );
            })}
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            initialValues={{ role: 'USER' }}
            requiredMark={false}
            style={{ rowGap: 0 }}
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
              style={{ marginBottom: 12 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="请输入用户名 / 手机号"
                size="large"
                style={{
                  borderRadius: 10,
                  height: 42,
                  background: '#fff',
                  border: '1px solid #e8e8e8',
                  color: '#1D2129',
                }}
              />
            </Form.Item>

            {loginWay === 'password' ? (
              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
                style={{ marginBottom: 12 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="请输入密码"
                  size="large"
                  style={{
                    borderRadius: 10,
                    height: 42,
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    color: '#1D2129',
                  }}
                />
              </Form.Item>
            ) : (
              <Form.Item
                name="smsCode"
                rules={[{ required: true, message: '请输入验证码' }]}
                style={{ marginBottom: 12 }}
              >
                <Input
                  prefix={<SafetyOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="请输入 6 位短信验证码"
                  size="large"
                  suffix={
                    <span
                      style={{
                        color: '#1677FF',
                        fontSize: 13,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        message.info('验证码已发送（演示）');
                      }}
                    >
                      获取验证码
                    </span>
                  }
                  style={{
                    borderRadius: 10,
                    height: 42,
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    color: '#1D2129',
                  }}
                />
              </Form.Item>
            )}

            <Form.Item
                name="role"
                label={<Text style={{ fontSize: 12, color: '#666' }}>登录角色</Text>}
                style={{ marginBottom: 14 }}
              >
                <Select
                  size="large"
                  style={{ borderRadius: 10 }}
                  popupStyle={{}}
                  options={[
                    { value: 'USER', label: '普通用户' },
                    { value: 'DEPT_ADMIN', label: '部门管理员' },
                    { value: 'SUPER_ADMIN', label: '超级管理员' },
                  ]}
                />
              </Form.Item>

            <Form.Item style={{ marginTop: 0, marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                icon={<LoginOutlined />}
                style={{
                  height: 44,
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  background: '#0F2B5B',
                  border: 'none',
                  boxShadow: '0 6px 20px rgba(15, 43, 91, 0.35)',
                }}
              >
                登录
              </Button>
            </Form.Item>

            {/* 扫码登录 / 钉钉外接图标 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
                marginBottom: 4,
              }}
            >
              <Tooltip title="扫码登录">
                <Button
                  type="text"
                  shape="circle"
                  icon={<QrcodeOutlined style={{ color: '#5B6B85', fontSize: 18 }} />}
                  style={{
                    width: 34,
                    height: 34,
                    background: '#f5f7fa',
                    border: '1px solid #e8e8e8',
                  }}
                />
              </Tooltip>
              <Tooltip title="钉钉扫码登录">
                <Button
                  type="text"
                  shape="circle"
                  onClick={() => setDtQrOpen(true)}
                  icon={<DingtalkOutlined style={{ color: '#1677FF', fontSize: 18 }} />}
                  style={{
                    width: 34,
                    height: 34,
                    background: '#f5f7fa',
                    border: '1px solid #e8e8e8',
                  }}
                />
              </Tooltip>
              <Tooltip title="微信登录">
                <Button
                  type="text"
                  shape="circle"
                  icon={<WechatOutlined style={{ color: '#07C160', fontSize: 18 }} />}
                  style={{
                    width: 34,
                    height: 34,
                    background: '#f5f7fa',
                    border: '1px solid #e8e8e8',
                  }}
                />
              </Tooltip>
            </div>
          </Form>

          {/* 快速体验账号 —— 后端已 seed 4 个 demo 账号（zhangsan/lisi/wangwu/zhaoliu，密码统一 123456）。*/}
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
              <Text style={{ fontSize: 12, color: '#999' }}>快速体验账号</Text>
              <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
            </div>

            <Space orientation="vertical" style={{ width: '100%' }} size={6}>
              {quickAccounts.map((item) => {
                return (
                  <Button
                    key={item.username}
                    block
                    onClick={() => handleQuickLogin(item.username, item.role)}
                    style={{
                      height: 36,
                      borderRadius: 10,
                      background: '#fff',
                      border: '1px solid #e8e8e8',
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                    }}
                  >
                    <Text strong style={{ fontSize: 12, color: '#1D2129' }}>{item.label}</Text>
                  </Button>
                );
              })}
            </Space>
          </div>
        </div>
      </div>
      </div>  {/* 主体内容结束 */}

      {/* 钉钉扫码登录 Modal（仿真 OAuth） */}
      <DingtalkQrLogin
        open={dtQrOpen}
        onClose={() => setDtQrOpen(false)}
        onSuccess={() => {
          // 钉钉登录成功后自动跳转（仅 mock 模式有效）
          setTimeout(() => navigate(fromPath, { replace: true }), 300);
        }}
      />
    </div>
  );
};

export default Login;
