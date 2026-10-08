import React from 'react';
import { Card, Typography, Space, Tag, Button, Row, Col } from 'antd';
import {
  WarningOutlined,
  RiseOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  CompassOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import {
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';
import './index.css';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/userStore';

const { Text } = Typography;

// 7 日效率（紧凑）
const efficiencyData = [
  { day: '周一', completed: 8,  avgTime: 3.2 },
  { day: '周二', completed: 11, avgTime: 2.8 },
  { day: '周三', completed: 9,  avgTime: 2.6 },
  { day: '周四', completed: 13, avgTime: 2.1 },
  { day: '周五', completed: 15, avgTime: 1.8 },
  { day: '周六', completed: 5,  avgTime: 1.6 },
  { day: '周日', completed: 3,  avgTime: 1.5 },
];

// 主入口矩阵配置（4 个核心模块）
interface EntryTile {
  key: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
  path: string;
}

const ENTRIES: EntryTile[] = [
  { key: 'approval', label: '智能审批', desc: '7 类场景 · AI 预审 · 超时告警', icon: <AuditOutlined />,           bg: 'rgba(214,64,69,0.08)',    color: '#D64045', path: '/approval' },
  { key: 'sandbox',  label: '合规沙箱', desc: '47 规则 · 批量扫描 · 法规引用', icon: <SafetyCertificateOutlined />, bg: 'rgba(201,164,89,0.10)', color: '#C9A459', path: '/sandbox' },
  { key: 'industry', label: '行业洞察', desc: '每日要闻 · 监管动态 · 风险标记', icon: <ReadOutlined />,        bg: 'rgba(34,167,117,0.08)',  color: '#22A775', path: '/industry-news' },
  { key: 'agentHub', label: 'AI 智能中心', desc: '问答 · 多 Agent · 记忆管理',   icon: <CompassOutlined />,         bg: 'rgba(15,43,91,0.06)',   color: '#0F2B5B', path: '/qa' },
];

const DashboardCharts: React.FC = () => {
  const navigate = useNavigate();
  const role = useUserStore((s) => s.user?.role);
  const isAdmin = role === 'SUPER_ADMIN' || role === 'DEPT_ADMIN';
  // 普通用户不展示「智能审批」入口
  const visibleEntries = isAdmin ? ENTRIES : ENTRIES.filter((e) => e.key !== 'approval');

  return (
    <div className="dashboard-charts">
      {/* ─── 主入口矩阵（一目了然 · 4 个核心模块） ─── */}
      <Card
        size="small"
        styles={{ body: { padding: 12 } }}
        style={{ marginBottom: 12 }}
        title={
          <Space>
            <RiseOutlined style={{ color: '#0F2B5B' }} />
            <span style={{ fontSize: 14 }}>更多入口</span>
            <Text type="secondary" style={{ fontSize: 12 }}>点击进入对应模块</Text>
          </Space>
        }
      >
        <Row gutter={[12, 12]}>
          {visibleEntries.map((e) => (
            <Col xs={12} sm={12} md={6} key={e.key}>
              <div
                onClick={() => navigate(e.path)}
                style={{
                  cursor: 'pointer',
                  padding: '14px 16px',
                  borderRadius: 8,
                  background: e.bg,
                  border: '1px solid transparent',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(el) => {
                  el.currentTarget.style.transform = 'translateY(-2px)';
                  el.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                  el.currentTarget.style.border = `1px solid ${e.color}40`;
                }}
                onMouseLeave={(el) => {
                  el.currentTarget.style.transform = 'translateY(0)';
                  el.currentTarget.style.boxShadow = 'none';
                  el.currentTarget.style.border = '1px solid transparent';
                }}
              >
                <Space size={10}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: '#fff',
                      color: e.color, fontSize: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 2px 6px ${e.color}25`,
                    }}
                  >
                    {e.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: 14, color: '#0F2B5B', display: 'block', lineHeight: 1.3 }}>{e.label}</Text>
                    <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.4 }}>{e.desc}</Text>
                  </div>
                </Space>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* ─── 金融办公效率（迷你：单条趋势线 + 3 个核心数字） ─── */}
      <Card
        size="small"
        styles={{ body: { padding: '8px 12px 4px' } }}
        title={
          <Space>
            <RiseOutlined style={{ color: '#0F2B5B' }} />
            <span style={{ fontSize: 14 }}>金融办公效率</span>
            <Tag color="success" style={{ fontSize: 11, lineHeight: '16px', padding: '0 6px' }}>近 7 天效率 +42%</Tag>
          </Space>
        }
        extra={
          <Button type="link" size="small" onClick={() => navigate('/dashboard?detail=metrics')} style={{ color: '#0F2B5B' }}>
            详情 <ArrowRightOutlined />
          </Button>
        }
      >
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={efficiencyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8A94A6' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ border: '1px solid #E8EDF4', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ fontSize: 12, color: '#0F2B5B', fontWeight: 600 }}
            />
            <Line type="monotone" dataKey="completed" stroke="#22A775" strokeWidth={2}
                  dot={{ r: 2.5, fill: '#22A775' }} activeDot={{ r: 4 }} name="完成任务" />
            <ReferenceLine y={5.0} stroke="#C8CED7" strokeDasharray="2 2"
                           label={{ value: 'AI 基准 5h', position: 'insideTopRight', fill: '#C8CED7', fontSize: 10 }} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, padding: '4px 4px 8px', borderTop: '1px dashed #F0F2F5', marginTop: 4,
        }}>
          <KpiMini label="本周完成" value="64" unit="件" color="#22A775" />
          <KpiMini label="AI 处理率" value="78" unit="%" color="#3B82F6" />
          <KpiMini label="效率提升" value="+42" unit="%" color="#0F2B5B" />
        </div>
      </Card>
    </div>
  );
};

const KpiMini: React.FC<{ label: string; value: string; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, padding: '4px 6px' }}>
    <div style={{ width: 3, height: 20, borderRadius: 2, background: color, marginRight: 4 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <Text type="secondary" style={{ fontSize: 10, display: 'block', lineHeight: 1.2 }}>{label}</Text>
      <div>
        <Text strong style={{ fontSize: 15, color: '#0F2B5B', lineHeight: 1.3 }}>{value}</Text>
        <Text style={{ fontSize: 10, color: '#8A94A6' }}> {unit}</Text>
      </div>
    </div>
  </div>
);

export default DashboardCharts;
