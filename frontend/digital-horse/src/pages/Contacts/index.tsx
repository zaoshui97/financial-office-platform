/**
 * 通讯录 / 一对一聊天 —— 系统内部辅助工具
 *
 * 结构（金融公司标准组织架构，参考组织架构图）：
 *   左侧：层级化导航（顶层 / 管理层 / 业务部门 / 职能部门），可折叠展开
 *   右侧：员工卡片列表（按部门分组，每个部门内部按团队子分组）
 *
 * 设计原则：
 *   - 左侧导航按"组织层级"分组，让用户一眼看清公司架构
 *   - 点左侧部门 → 右侧滚动到对应部门
 *   - 搜索支持跨层级（姓名 / 职位 / 部门 / 团队）
 *
 * ⚠️ 定位说明：
 *   - 本产品是金融企业内部办公平台，不面向通用社交沟通
 *   - 通讯录仅作为企业员工查找入口：一键定位同事 → 发起内部私聊 / 邀请入会 / @通知
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Input,
  Avatar,
  Typography,
  Tag,
  Empty,
  Badge,
  Space,
  Button,
  Tooltip,
  Collapse,
  Card,
} from 'antd';
import {
  TeamOutlined,
  SearchOutlined,
  MessageOutlined,
  CrownOutlined,
  CheckCircleOutlined,
  ApartmentOutlined,
  CaretRightOutlined,
  UserOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useContactsStore, useUserStore } from '@/store';
import { ROLE_LABELS } from '@/types/permission';
import type { ContactEmployee, OrgLevel } from '@/types/contacts';
import { fetchDingtalkContacts, getDingtalkConnection, saveDingtalkConnection, type DingtalkContactEmployee } from '@/services/dingtalk';
import { App } from 'antd';
import './index.css';

const { Text } = Typography;

/** 组织层级中文标签 + 排序权重 */
const ORG_LEVEL_META: Record<OrgLevel, { label: string; color: string; order: number; icon: string }> = {
  TOP:        { label: '顶层 · 决策层',     color: '#0F2B5B', order: 0, icon: '◆' },
  MANAGEMENT: { label: '管理层 · CXO',      color: '#0F2B5B', order: 1, icon: '★' },
  BUSINESS:   { label: '业务部门',          color: '#f5222d', order: 2, icon: '◈' },
  SUPPORT:    { label: '职能部门',          color: '#52c41a', order: 3, icon: '◇' },
};

/** 部门节点类型（模块顶层，方便 OrgDeptBlock 组件引用） */
export interface DeptNode {
  id: string;
  name: string;
  level: OrgLevel;
  teams: Map<string, ContactEmployee[]>; // team name -> employees
  all: ContactEmployee[];
}

/** 层级节点类型（模块顶层，方便 OrgDeptBlock 组件引用） */
export interface LevelNode {
  level: OrgLevel;
  meta: { label: string; color: string; order: number; icon: string };
  depts: DeptNode[];
}

interface ContactsProps {
  /** 点击联系人后跳转回调（交给 AppLayout 打开抽屉） */
  onOpenChat?: (peer: ContactEmployee) => void;
}

const Contacts: React.FC<ContactsProps> = ({ onOpenChat }) => {
  const { user } = useUserStore();
  const { message } = App.useApp();
  const employees = useContactsStore((s) => s.employees);
  const bootstrap = useContactsStore((s) => s.bootstrap);
  const getMessages = useContactsStore((s) => s.getMessages);
  const getUnread = useContactsStore((s) => s.getUnread);

  // ───── 钉钉集成状态 ─────
  const [dtConnection, setDtConnection] = useState(getDingtalkConnection());
  const [dtSyncing, setDtSyncing] = useState(false);
  const [dtLastSyncedAt, setDtLastSyncedAt] = useState<string | null>(null);
  const [dtStats, setDtStats] = useState<{ departments: number; employees: number } | null>(null);

  const handleDingtalkSync = async () => {
    setDtSyncing(true);
    try {
      const result = await fetchDingtalkContacts(true);
      setDtStats({ departments: result.departments.length, employees: result.totalCount });
      setDtLastSyncedAt(new Date().toISOString());
      // 模拟把钉钉员工追加到 contactsStore 的 employees
      const bootstrap = useContactsStore.getState().bootstrap;
      bootstrap?.();
      // 更新连接状态
      const newConn = { ...dtConnection, connected: true, appName: '睿枢 Apexis' };
      saveDingtalkConnection(newConn);
      setDtConnection(newConn);
      message.success(`钉钉通讯录同步完成：${result.departments.length} 个部门，${result.totalCount} 名员工`);
    } catch (err) {
      message.error('钉钉同步失败：' + (err as Error).message);
    } finally {
      setDtSyncing(false);
    }
  };

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const [keyword, setKeyword] = useState('');
  const [activeDeptId, setActiveDeptId] = useState<string>(''); // 左侧高亮 + 右侧滚动
  const [expandedLevels, setExpandedLevels] = useState<Set<OrgLevel>>(
    new Set<OrgLevel>(['TOP', 'MANAGEMENT', 'BUSINESS', 'SUPPORT'])
  );
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(
    // 默认展开所有部门
    new Set<string>()
  );

  const rightRef = useRef<HTMLDivElement>(null);

  // 首次加载注入 mock
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // 过滤本人
  const others = useMemo(
    () => employees.filter((e) => e.username !== user?.username),
    [employees, user]
  );

  // 关键字过滤
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return others;
    return (others as ContactEmployee[]).filter(
      (e) =>
        e.name.toLowerCase().includes(kw) ||
        e.department.toLowerCase().includes(kw) ||
        (e.team || '').toLowerCase().includes(kw) ||
        e.position.toLowerCase().includes(kw) ||
        (e.username || '').toLowerCase().includes(kw)
    );
  }, [others, keyword]);

  // 按组织层级 → 部门 → 团队分组
  const orgTree = useMemo(() => {
    type _DeptNode = Omit<DeptNode, 'teams'> & { teams: Map<string, ContactEmployee[]> };
    type _LevelNode = Omit<LevelNode, 'depts'> & { depts: Map<string, _DeptNode> };

    const levelMap = new Map<OrgLevel, _LevelNode>();
    filtered.forEach((e: ContactEmployee) => {
      const level = e.orgLevel as OrgLevel;
      let lv = levelMap.get(level);
      if (!lv) {
        lv = { level, meta: ORG_LEVEL_META[level] || ORG_LEVEL_META.SUPPORT, depts: new Map() };
        levelMap.set(level, lv);
      }
      let dept = lv.depts.get(e.department);
      if (!dept) {
        dept = { id: `dept-${e.orgLevel}-${e.department}`, name: e.department, level: e.orgLevel, teams: new Map(), all: [] };
        lv.depts.set(e.department, dept);
      }
      dept.all.push(e);
      const teamName = e.team || '__no_team__';
      if (!dept.teams.has(teamName)) dept.teams.set(teamName, []);
      dept.teams.get(teamName)!.push(e);
    });

    // 排序：层级按 order、每个层级内部门按"管理者在前"再按名字
    const sortDept = (a: _DeptNode, b: _DeptNode): number => {
      const aIsLeader = a.all.some((e2) => e2.role === 'DEPT_ADMIN' || e2.role === 'SUPER_ADMIN');
      const bIsLeader = b.all.some((e2) => e2.role === 'DEPT_ADMIN' || e2.role === 'SUPER_ADMIN');
      if (aIsLeader && !bIsLeader) return -1;
      if (!aIsLeader && bIsLeader) return 1;
      return a.name.localeCompare(b.name);
    };

    return Array.from(levelMap.values())
      .sort((a, b) => a.meta.order - b.meta.order)
      .map((lv) => ({
        ...lv,
        depts: Array.from(lv.depts.values()).sort(sortDept),
        teams: lv.depts, // 显式覆盖 teams 类型（spread 推断会丢失 ContactEmployee[] 精度）
      })) as LevelNode[];
  }, [filtered]);

  // 初始化：默认展开所有部门
  useEffect(() => {
    const allDeptIds = orgTree.flatMap((lv) => lv.depts.map((d) => d.id));
    if (allDeptIds.length > 0 && expandedDepts.size === 0) {
      setExpandedDepts(new Set(allDeptIds));
    }
  }, [orgTree, expandedDepts.size]);

  // 最近会话
  const recentPeers = useMemo(() => {
    if (!user) return [];
    const allConversations: { peer: ContactEmployee; lastTime: string }[] = [];
    others.forEach((e) => {
      const msgs = getMessages(user.id, e.id);
      if (msgs.length > 0) {
        allConversations.push({
          peer: e,
          lastTime: msgs[msgs.length - 1].timestamp,
        });
      }
    });
    return allConversations
      .sort((a, b) => b.lastTime.localeCompare(a.lastTime))
      .slice(0, 6);
  }, [user, others, getMessages]);

  const handleClick = (employee: ContactEmployee) => {
    if (onOpenChat) {
      onOpenChat(employee);
      return;
    }
    document.dispatchEvent(new CustomEvent('open-chat', { detail: employee }));
  };

  const handleNavClick = (deptId: string) => {
    setActiveDeptId(deptId);
    // 展开对应部门
    setExpandedDepts((prev) => new Set(prev).add(deptId));
    // 滚动到对应部门
    requestAnimationFrame(() => {
      const el = document.getElementById(deptId);
      if (el && rightRef.current) {
        const offset = el.offsetTop - 16;
        rightRef.current.scrollTo({ top: offset, behavior: 'smooth' });
      }
    });
  };

  const toggleLevel = (level: OrgLevel) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  };

  const toggleDept = (deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      next.has(deptId) ? next.delete(deptId) : next.add(deptId);
      return next;
    });
  };

  // 在线统计
  const onlineCount = others.filter((e) => e.online).length;

  return (
    <div className="contacts-page">
      {/* 顶部 Header */}
      <div className="contacts-header">
        <Space size={12}>
          <ApartmentOutlined style={{ fontSize: 24, color: 'var(--color-primary)' }} />
          <Text strong style={{ fontSize: 18 }}>
            组织通讯录
          </Text>
          <Tag color="blue">{employees.length} 人</Tag>
          <Tag color="green">{onlineCount} 在线</Tag>
          {dtConnection.connected && (
            <Tag color="processing" icon={<CheckCircleOutlined />}>
              已对接钉钉{dtStats ? ` · ${dtStats.employees}人` : ''}
            </Tag>
          )}
        </Space>
        <Space>
          <Button
            type={dtConnection.connected ? 'default' : 'primary'}
            icon={<SyncOutlined />}
            loading={dtSyncing}
            onClick={handleDingtalkSync}
          >
            {dtConnection.connected ? '重新同步钉钉' : '同步钉钉通讯录'}
          </Button>
          <Input
            placeholder="搜索姓名 / 职位 / 部门 / 团队"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ width: 280 }}
            size="large"
          />
        </Space>
      </div>

      {/* 钉钉同步详情卡 */}
      {dtStats && (
        <Card
          size="small"
          style={{ margin: '12px 16px 0', border: '1px solid #91caff', background: '#e6f4ff' }}
          styles={{ body: { padding: '10px 16px' } }}
        >
          <Space size={20}>
            <CheckCircleOutlined style={{ color: '#1677FF', fontSize: 18 }} />
            <Text>钉钉通讯录已同步：</Text>
            <Text strong>{dtStats.departments} 个部门</Text>
            <Text strong>{dtStats.employees} 名员工</Text>
            {dtLastSyncedAt && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                上次同步：{new Date(dtLastSyncedAt).toLocaleString('zh-CN')}
              </Text>
            )}
          </Space>
        </Card>
      )}

      <div className="contacts-body">
        {/* ===== 左侧导航：组织层级树 ===== */}
        <div className="contacts-nav">
          <div className="contacts-nav-inner">
            <div
              className={`nav-item nav-item-all ${activeDeptId === '' ? 'active' : ''}`}
              onClick={() => {
                setActiveDeptId('');
                if (rightRef.current) rightRef.current.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <TeamOutlined />
              <span>全部员工</span>
              <Tag style={{ marginLeft: 'auto' }}>{others.length}</Tag>
            </div>

            {recentPeers.length > 0 && !keyword && (
              <>
                <div className="nav-section-title">
                  <ClockCircleOutlined />
                  <span>最近联系</span>
                </div>
                {recentPeers.map(({ peer }) => {
                  const unread = getUnread(user?.id ?? '', peer.id);
                  return (
                    <div
                      key={`recent-${peer.id}`}
                      className="nav-item nav-item-recent"
                      onClick={() => handleClick(peer)}
                    >
                      <Badge count={unread} size="small">
                        <Avatar size={24} style={{ backgroundColor: peer.avatar || '#1890ff' }}>
                          {peer.name.charAt(0)}
                        </Avatar>
                      </Badge>
                      <span className="nav-item-name">{peer.name}</span>
                    </div>
                  );
                })}
              </>
            )}

            {orgTree.map((lv) => {
              const expanded = expandedLevels.has(lv.level);
              return (
                <div key={lv.level} className="nav-level">
                  <div
                    className="nav-level-header"
                    style={{ borderLeftColor: lv.meta.color }}
                    onClick={() => toggleLevel(lv.level)}
                  >
                    <CaretRightOutlined
                      className="nav-level-caret"
                      style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
                    />
                    <span className="nav-level-icon" style={{ color: lv.meta.color }}>
                      {lv.meta.icon}
                    </span>
                    <span className="nav-level-label">{lv.meta.label}</span>
                    <Tag style={{ marginLeft: 'auto' }}>
                      {lv.depts.reduce((s, d) => s + d.all.length, 0)}
                    </Tag>
                  </div>
                  {expanded &&
                    lv.depts.map((dept) => (
                      <div
                        key={dept.id}
                        className={`nav-item nav-item-dept ${activeDeptId === dept.id ? 'active' : ''}`}
                        onClick={() => handleNavClick(dept.id)}
                      >
                        <span className="nav-item-dot" style={{ background: lv.meta.color }} />
                        <span className="nav-item-name">{dept.name}</span>
                        <Tag style={{ marginLeft: 'auto' }}>{dept.all.length}</Tag>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== 右侧：组织架构展示 ===== */}
        <div className="contacts-content" ref={rightRef}>
          {orgTree.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到匹配的同事" />
          ) : (
            (() => {
              // 点击左侧部门 → 进入聚焦模式，只显示该部门
              const focusedDeptId = activeDeptId;
              const focusedDept =
                focusedDeptId
                  ? orgTree
                      .flatMap((lv) => lv.depts.map((d) => ({ ...d, _lv: lv })))
                      .find((d) => d.id === focusedDeptId)
                  : null;

              return (
                <>
                  {/* 聚焦模式：顶部显示返回按钮 */}
                  {focusedDept && (
                    <div className="org-focus-back">
                      <Button
                        icon={<CaretRightOutlined style={{ transform: 'rotate(180deg)' }} />}
                        onClick={() => setActiveDeptId('')}
                        size="small"
                      >
                        返回全部通讯录
                      </Button>
                      <Text type="secondary">
                        已聚焦：{focusedDept._lv.meta.label} / {focusedDept.name}
                      </Text>
                    </div>
                  )}

                  {focusedDept ? (
                    // 聚焦模式：只渲染当前部门
                    <OrgDeptBlock
                      key={focusedDept.id}
                      dept={focusedDept}
                      lv={focusedDept._lv}
                      expanded={expandedDepts.has(focusedDept.id) ?? true}
                      onToggle={() => toggleDept(focusedDept.id)}
                      onEmployeeClick={handleClick}
                    />
                  ) : (
                    // 全部模式：渲染所有部门块
                    orgTree.map((lv) =>
                      lv.depts.map((dept) => (
                        <OrgDeptBlock
                          key={dept.id}
                          dept={dept}
                          lv={lv}
                          expanded={expandedDepts.has(dept.id) ?? true}
                          onToggle={() => toggleDept(dept.id)}
                          onEmployeeClick={handleClick}
                        />
                      ))
                    )
                  )}
                </>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};

/** 部门块组件（聚焦模式下单独渲染） */
interface OrgDeptBlockProps {
  dept: DeptNode & { _lv?: LevelNode };
  lv: LevelNode;
  expanded: boolean;
  onToggle: () => void;
  onEmployeeClick: (e: ContactEmployee) => void;
}
const OrgDeptBlock: React.FC<OrgDeptBlockProps> = ({
  dept,
  lv,
  expanded,
  onToggle,
  onEmployeeClick,
}) => {
  const lvMeta = lv.meta;
  return (
    <div key={dept.id} id={dept.id} className="org-dept-block">
      {/* 部门标题 */}
      <div className="org-dept-header">
        <div className="org-dept-title">
          <span className="org-dept-icon" style={{ background: lvMeta.color }}>
            {lvMeta.icon}
          </span>
          <Text strong style={{ fontSize: 16 }}>
            {dept.name}
          </Text>
          <Tag color={lvMeta.color === '#0F2B5B' ? 'blue' : 'default'}>
            {lvMeta.label}
          </Tag>
          <Tag>{dept.all.length} 人</Tag>
        </div>
        <Button
          type="text"
          size="small"
          icon={
            <CaretRightOutlined
              style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'all 0.2s' }}
            />
          }
          onClick={onToggle}
        >
          {expanded ? '收起' : '展开'}
        </Button>
      </div>

      {expanded && (
        <Collapse
          ghost
          activeKey={Array.from(dept.teams.keys())}
          items={Array.from(dept.teams.entries()).map(([teamName, members]) => ({
            key: teamName,
            label: (
              <Space>
                <Text strong style={{ fontSize: 13 }}>
                  {teamName === '__no_team__' ? '部门管理层' : teamName}
                </Text>
                <Tag>{members.length}</Tag>
              </Space>
            ),
            children: (
                  <div className="employee-grid">
                    {members.map((e) => (
                      <EmployeeCard
                        key={e.id}
                        employee={e}
                        onClick={() => onEmployeeClick(e)}
                      />
                    ))}
                  </div>
            ),
          }))}
        />
      )}
    </div>
  );
};

/** 员工卡片（拆出来方便复用 + 控制 props 稳定，避免父组件每次 render 重建） */
const EmployeeCard: React.FC<{
  employee: ContactEmployee;
  onClick: () => void;
}> = React.memo(({ employee: e, onClick }) => {
  const roleLabel = ROLE_LABELS[e.role];
  const isLeader = e.role === 'DEPT_ADMIN' || e.role === 'SUPER_ADMIN';
  return (
    <div className={`employee-card ${isLeader ? 'employee-card-leader' : ''}`} onClick={onClick}>
      <Badge dot color={e.online ? '#52c41a' : '#bfbfbf'} offset={[-4, 36]}>
        <Avatar
          size={48}
          style={{ backgroundColor: e.avatar || '#1890ff' }}
          icon={isLeader ? <CrownOutlined /> : undefined}
        >
          {!isLeader ? e.name.charAt(0) : undefined}
        </Avatar>
      </Badge>
      <div className="employee-info">
        <Space size={4} className="employee-name-line">
          <Text strong ellipsis style={{ maxWidth: 130 }}>
            {e.name}
          </Text>
          {isLeader && (
            <Tooltip title={roleLabel}>
              <CrownOutlined style={{ color: '#faad14', fontSize: 12 }} />
            </Tooltip>
          )}
        </Space>
        <Text type="secondary" className="employee-position" ellipsis>
          {e.position}
        </Text>
        <Space size={4} wrap>
          {e.team && (
            <Tag style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
              {e.team}
            </Tag>
          )}
          {e.online ? (
            <Tag color="success" style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
              <CheckCircleOutlined /> 在线
            </Tag>
          ) : (
            <Tag style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
              离线
            </Tag>
          )}
        </Space>
      </div>
      <Button
        type="primary"
        ghost
        size="small"
        icon={<MessageOutlined />}
        onClick={(ev) => {
          ev.stopPropagation();
          onClick();
        }}
      >
        私聊
      </Button>
    </div>
  );
});
EmployeeCard.displayName = 'EmployeeCard';

export const openChatEvent = 'open-chat';

export default Contacts;
