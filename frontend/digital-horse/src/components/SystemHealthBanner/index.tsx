/**
 * 系统健康条幅 — 顶部红色/黄色条
 *
 * 用法：放在 Layout 的最外层。组件内部自动：
 *   1) 启动时调 GET /api/v1/system/health/live
 *   2) 成功后调 /api/v1/system/health/ready
 *   3) 失败时显示"后端服务不可达"条幅
 *   4) 周期 30s 重检
 *
 * 不抛错、不阻断 UI —— 完全静默降级。
 */
import React, { useEffect, useState } from 'react';
import { Alert, Space, Button, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

type HealthState = 'checking' | 'live-and-ready' | 'live-only' | 'unreachable' | 'unknown';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface Props {
  /** 是否展示在登录页（登录页要展示，提示用户先启动后端） */
  showOnLogin?: boolean;
}

export const SystemHealthBanner: React.FC<Props> = ({ showOnLogin = true }) => {
  const [state, setState] = useState<HealthState>('checking');
  const [detail, setDetail] = useState<string>('');
  // 连续失败次数：仅当 ≥2 次连续失败才显示红条，避免 Vite 首次模块编译
  // 导致第一次请求超时（5s 不够）时显示"不可达"误报。
  const failStreakRef = React.useRef(0);
  const [visibleState, setVisibleState] = useState<HealthState>('checking');
  const [path] = useState(() => window.location.pathname);
  const isLoginPage = path === '/login' || path.startsWith('/login');

  const check = async () => {
    if (!isLoginPage && !showOnLogin) {
      setState('unknown');
      return;
    }
    setState('checking');
    try {
      const liveResp = await fetch(`${API_BASE}/system/health/live`, {
        method: 'GET',
        // 给 Vite 第一次 dev 编译留余地（模块图很大时首次 fetch 可能 5~8s）
        signal: AbortSignal.timeout(10000),
      });
      if (!liveResp.ok) {
        failStreakRef.current += 1;
        if (failStreakRef.current >= 2) {
          setState('unreachable');
          setVisibleState('unreachable');
          setDetail(`健康检查接口返回 ${liveResp.status}`);
        }
        return;
      }
      // liveness 通过 → 检查 readiness
      const readyResp = await fetch(`${API_BASE}/system/health/ready`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      // 任意一个 OK 就算成功，重置失败计数
      failStreakRef.current = 0;
      if (readyResp.ok) {
        setState('live-and-ready');
        setVisibleState('live-and-ready');
        setDetail('');
      } else {
        setState('live-only');
        setVisibleState('live-only');
        setDetail('后端进程在跑，但就绪检查未通过（可能是数据库/AI 依赖未起）');
      }
    } catch (err: any) {
      failStreakRef.current += 1;
      if (failStreakRef.current >= 2) {
        setState('unreachable');
        setVisibleState('unreachable');
        setDetail(
          err?.name === 'TimeoutError'
            ? '后端请求超时（>10s），请确认后端已启动'
            : `后端不可达：${err?.message || '网络错误'}`
        );
      }
    }
  };

  useEffect(() => {
    if (!isLoginPage) return;
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoginPage]);

  // 非登录页 + 未开启 → 不渲染
  if (!isLoginPage && !showOnLogin) return null;

  // 已就绪 → 登录页也不渲染（避免遮挡登录卡片；非登录页本就不会渲染）
  if (visibleState === 'live-and-ready') return null;

  if (visibleState === 'live-only') {
    return (
      <Alert
        type="warning"
        message={
          <Space>
            <Spin size="small" />
            <span>后端进程运行中，但依赖未就绪：{detail}</span>
          </Space>
        }
        action={<Button size="small" icon={<ReloadOutlined />} onClick={check}>重检</Button>}
        style={{ borderRadius: 0, marginBottom: 0 }}
      />
    );
  }

  if (visibleState === 'unreachable') {
    return (
      <Alert
        type="error"
        message={
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <span><b>⚠️ 后端服务不可达</b> · 启动方式：</span>
            <code style={{ background: '#fff1f0', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
              cd D:\Apexis\financial-office-platform &amp;&amp; python -m uvicorn app.main:app --port 8030 --reload
            </code>
            <span style={{ fontSize: 12, color: '#666' }}>{detail}</span>
          </Space>
        }
        action={<Button size="small" icon={<ReloadOutlined />} onClick={check}>重试</Button>}
        style={{ borderRadius: 0, marginBottom: 0 }}
      />
    );
  }

  // checking / unknown：什么都不渲染（避免一次性误报遮挡登录表单）
  return null;
};

export default SystemHealthBanner;
