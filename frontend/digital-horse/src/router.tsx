import React, { Suspense, lazy, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import AppLayout from '@/components/Layout/AppLayout';
import SimpleLayout from '@/components/Layout/SimpleLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

// 懒加载页面组件
const Dashboard = lazy(() => import('@/pages/Dashboard/index'));
const MeetingHub = lazy(() => import('@/pages/Meeting/MeetingHub'));
const MeetingListPage = lazy(() => import('@/pages/Meeting/index'));
const MeetingDetailPage = lazy(() => import('@/pages/Meeting/Detail'));
const Knowledge = lazy(() => import('@/pages/Knowledge/index'));
const IndustryNews = lazy(() => import('@/pages/IndustryNews/index'));
const Profile = lazy(() => import('@/pages/Profile'));
const SecurityCenter = lazy(() => import('@/pages/Security'));
const SystemSettings = lazy(() => import('@/pages/Settings'));
const Approval = lazy(() => import('@/pages/Approval'));
const Sandbox = lazy(() => import('@/pages/Sandbox'));
const Report = lazy(() => import('@/pages/Report'));
const Login = lazy(() => import('@/pages/Login'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Contacts = lazy(() => import('@/pages/Contacts/index'));
const QA = lazy(() => import('@/pages/QA'));
const AgentCenter = lazy(() => import('@/pages/Agent/index'));
const Chat = lazy(() => import('@/pages/Chat'));

// ===== 旧路由重定向组件 =====
// 旧会议子页面 → 统一跳转 /meeting?tab=xxx&id=xxx
// 旧路由重定向组件：手动从 window.location 提取 :id，避免 react-router v7 数据路由
// 在懒加载 Suspense 边界上 useParams 偶发 subscribe undefined 的问题
const getIdFromPath = (regex: RegExp): string => {
  const match = window.location.pathname.match(regex);
  return match?.[1] ?? '1';
};

const MeetingRoomRedirect: React.FC = () => {
  const id = getIdFromPath(/^\/meeting-room\/([^/]+)/);
  return <Navigate to={`/meeting?tab=room&id=${id}`} replace />;
};
const MeetingRehearsalRedirect: React.FC = () => {
  const id = getIdFromPath(/^\/meeting-rehearsal\/([^/]+)/);
  return <Navigate to={`/meeting?tab=rehearsal&id=${id}`} replace />;
};
const MeetingReportRedirect: React.FC = () => {
  const id = getIdFromPath(/^\/meeting\/([^/]+)\/report/);
  return <Navigate to={`/meeting?tab=report&id=${id}`} replace />;
};
const MeetingDetailRedirect: React.FC = () => {
  const id = getIdFromPath(/^\/meeting\/([^/]+)/);
  return <Navigate to={`/meeting?tab=detail&id=${id}`} replace />;
};

// 加载中组件
const PageLoader: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minHeight: 400,
  }}>
    <div style={{
      width: 40,
      height: 40,
      border: '3px solid var(--color-border)',
      borderTop: '3px solid var(--color-primary)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }} />
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// 路由权限配置
const routePermissions: Record<string, string[]> = {
  '/dashboard': ['*'],
  '/meeting': ['*'],
  '/qa': ['*'],
  '/agent': ['*'],
  '/chat': ['*'],
  '/knowledge': ['*'],
  '/industry-news': ['*'],
  '/profile': ['*'],
  '/notifications': ['*'],
  '/security': ['SUPER_ADMIN'],
  '/settings': ['SUPER_ADMIN'],
  '/approval': ['*'],
  '/sandbox': ['*'],
  '/report': ['*'],
  '/contacts': ['*'],
};

// 独立的全局快捷键监听器（不依赖 useNavigate）
const GlobalShortcuts: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('open-global-search'));
      }
      // Ctrl/Cmd + B 切换侧边栏
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('toggle-sidebar'));
      }
      // ? 显示帮助
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('toggle-shortcuts-help'));
      }
      // G + D 跳转 Dashboard
      if (e.key === 'd' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        const prevKey = (window as any).__prevKey;
        if (prevKey === 'g') {
          e.preventDefault();
          window.location.hash = '#/dashboard';
          (window as any).__prevKey = null;
        } else {
          (window as any).__prevKey = 'g';
          setTimeout(() => { (window as any).__prevKey = null; }, 500);
        }
      }
      // G + M 跳转会议
      if (e.key === 'm' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        const prevKey = (window as any).__prevKey;
        if (prevKey === 'g') {
          e.preventDefault();
          window.location.hash = '#/meeting';
          (window as any).__prevKey = null;
        }
      }
      // G + K 跳转知识库
      if (e.key === 'k' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        const prevKey = (window as any).__prevKey;
        if (prevKey === 'g') {
          e.preventDefault();
          window.location.hash = '#/knowledge';
          (window as any).__prevKey = null;
        }
      }
      // G + Q 跳转问答
      if (e.key === 'q' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        const prevKey = (window as any).__prevKey;
        if (prevKey === 'g') {
          e.preventDefault();
          window.location.hash = '#/qa';
          (window as any).__prevKey = null;
        }
      }
      // G + A 跳转审批
      if (e.key === 'a' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        const prevKey = (window as any).__prevKey;
        if (prevKey === 'g') {
          e.preventDefault();
          window.location.hash = '#/approval';
          (window as any).__prevKey = null;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
};

// 独立的全局搜索面板（不依赖 useNavigate）
const GlobalSearchPanel: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Mock 搜索数据
  const mockData = [
    { id: 'k1', type: 'knowledge', title: '年假如何计算', description: '员工手册', matchScore: 96, url: '/knowledge' },
    { id: 'k2', type: 'knowledge', title: '预算申请流程', description: '财务制度', matchScore: 89, url: '/knowledge' },
    { id: 'm1', type: 'meeting', title: 'Q4预算审批会议', timestamp: '3天前', url: '/meeting' },
    { id: 'q1', type: 'qa', title: '预算申请的流程是什么？', timestamp: '昨天', url: '/qa' },
    { id: 't1', type: 'task', title: '财务部预算审批', url: '/dashboard' },
  ];

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => {
      setIsOpen(false);
      setQuery('');
      setResults([]);
    };

    document.addEventListener('open-global-search', handleOpen);
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    });

    return () => {
      document.removeEventListener('open-global-search', handleOpen);
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      const filtered = mockData.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
      setSelectedIndex(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh'
      }}
      onClick={() => { setIsOpen(false); setQuery(''); setResults([]); }}
    >
      <div
        style={{
          width: 600, maxWidth: '90vw', maxHeight: '70vh',
          background: 'var(--color-bg-card)', borderRadius: 12,
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)', overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ marginRight: 12, color: '#999' }}>搜索</span>
          <input
            autoFocus
            type="text"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, background: 'transparent', color: 'var(--color-text-title)' }}
            placeholder="搜索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(Math.max(selectedIndex - 1, 0)); }
              if (e.key === 'Enter' && results[selectedIndex]) {
                window.location.hash = `#${results[selectedIndex].url}`;
                setIsOpen(false);
                setQuery('');
              }
            }}
          />
          <span style={{ fontSize: 12, color: '#999', background: 'var(--color-bg-hover)', padding: '2px 8px', borderRadius: 4 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {results.length === 0 && query && (
            <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>未找到相关结果</div>
          )}
          {results.map((result, index) => (
            <div
              key={result.id}
              style={{
                padding: '12px 16px', cursor: 'pointer',
                background: index === selectedIndex ? 'var(--color-bg-hover)' : 'transparent',
              }}
              onClick={() => { window.location.hash = `#${result.url}`; setIsOpen(false); setQuery(''); }}
            >
              <div style={{ fontWeight: 500 }}>{result.title}</div>
              {result.description && <div style={{ fontSize: 12, color: '#999' }}>{result.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 独立的快捷键帮助面板（不依赖 useNavigate）
const KeyboardShortcutsHelp: React.FC = () => {
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    const handleToggle = () => setIsVisible((prev) => !prev);
    document.addEventListener('toggle-shortcuts-help', handleToggle);
    return () => document.removeEventListener('toggle-shortcuts-help', handleToggle);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => setIsVisible(false)}
    >
      <div
        style={{
          width: 480, background: '#fff', borderRadius: 12,
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8EDF4', fontWeight: 600 }}>
          键盘快捷键
        </div>
        <div style={{ padding: 16 }}>
          {[
            { keys: ['Ctrl', 'K'], desc: '打开全局搜索' },
            { keys: ['Ctrl', 'B'], desc: '切换侧边栏' },
            { keys: ['G', 'D'], desc: '跳转到工作台' },
            { keys: ['G', 'M'], desc: '跳转到会议' },
            { keys: ['G', 'K'], desc: '跳转到知识库' },
            { keys: ['G', 'Q'], desc: '跳转到问答' },
            { keys: ['G', 'A'], desc: '跳转到审批' },
            { keys: ['?'], desc: '显示快捷键帮助' },
            { keys: ['Esc'], desc: '关闭弹窗/取消' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 7 ? '1px solid #F0F0F0' : 'none' }}>
              <span style={{ color: '#666' }}>{s.desc}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {s.keys.map((key, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <span style={{ color: '#999', margin: '0 2px' }}>+</span>}
                    <span style={{ padding: '4px 10px', background: '#F7F9FC', border: '1px solid #E8EDF4', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>{key}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', background: '#F7F9FC', textAlign: 'center', fontSize: 12, color: '#999' }}>
          按 Esc 或点击外部区域关闭
        </div>
      </div>
    </div>
  );
};

// 路由配置
const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  // ===== 兼容旧路由：自动重定向到整合入口 =====
  {
    // 历史 /memory → /qa（记忆管理已并入问答）
    path: '/memory',
    element: <Navigate to="/qa" replace />,
  },
  {
    // 旧会议页 → /meeting?tab=xxx&id=xxx
    path: '/meeting-room/:id',
    element: <MeetingRoomRedirect />,
  },
  {
    path: '/meeting-rehearsal/:id',
    element: <MeetingRehearsalRedirect />,
  },
  {
    path: '/meeting/:id/report',
    element: <MeetingReportRedirect />,
  },
  {
    path: '/meeting/:id',
    element: <MeetingDetailRedirect />,
  },
  {
    // 旧沙箱日志页 → /sandbox
    path: '/logs',
    element: <Navigate to="/sandbox" replace />,
  },
  {
    // 旧周报页 → /report?scene=6
    path: '/report-weekly',
    element: <Navigate to="/report" replace />,
  },
  {
    path: '/profile',
    element: <ProtectedRoute allowedRoles={routePermissions['/profile']}><SimpleLayout title="个人中心"><Profile /></SimpleLayout></ProtectedRoute>,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <ProtectedRoute allowedRoles={routePermissions['/dashboard']}><Dashboard /></ProtectedRoute> },
      { path: 'meeting', element: <ProtectedRoute allowedRoles={routePermissions['/meeting']}><MeetingHub /></ProtectedRoute> },
      { path: 'meetings', element: <ProtectedRoute allowedRoles={routePermissions['/meeting']}><MeetingListPage /></ProtectedRoute> },
      { path: 'meetings/:id', element: <ProtectedRoute allowedRoles={routePermissions['/meeting']}><MeetingDetailPage /></ProtectedRoute> },
      { path: 'knowledge', element: <ProtectedRoute allowedRoles={routePermissions['/knowledge']}><Knowledge /></ProtectedRoute> },
      { path: 'industry-news', element: <ProtectedRoute allowedRoles={routePermissions['/industry-news']}><IndustryNews /></ProtectedRoute> },
      { path: 'qa', element: <ProtectedRoute allowedRoles={routePermissions['/qa']}><QA /></ProtectedRoute> },
      { path: 'agent', element: <ProtectedRoute allowedRoles={routePermissions['/agent']}><AgentCenter /></ProtectedRoute> },
      { path: 'chat', element: <ProtectedRoute allowedRoles={routePermissions['/chat']}><Chat /></ProtectedRoute> },
      { path: 'notifications', element: <ProtectedRoute allowedRoles={routePermissions['/notifications']}><Notifications /></ProtectedRoute> },
      { path: 'security', element: <ProtectedRoute allowedRoles={routePermissions['/security']}><SecurityCenter /></ProtectedRoute> },
      { path: 'settings', element: <ProtectedRoute allowedRoles={routePermissions['/settings']}><SystemSettings /></ProtectedRoute> },
      { path: 'approval', element: <ProtectedRoute allowedRoles={routePermissions['/approval']}><Approval /></ProtectedRoute> },
      { path: 'sandbox', element: <ProtectedRoute allowedRoles={routePermissions['/sandbox']}><Sandbox /></ProtectedRoute> },
      { path: 'report', element: <ProtectedRoute allowedRoles={routePermissions['/report']}><Report /></ProtectedRoute> },
      { path: 'contacts', element: <ProtectedRoute allowedRoles={routePermissions['/contacts']}><Contacts /></ProtectedRoute> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

// 包装路由组件
const AppRouter: React.FC = () => (
  <>
    <Suspense fallback={<PageLoader />}>
      <RouterProvider router={router} />
    </Suspense>
    <GlobalShortcuts />
    <GlobalSearchPanel />
    <KeyboardShortcutsHelp />
  </>
);

export default AppRouter;
