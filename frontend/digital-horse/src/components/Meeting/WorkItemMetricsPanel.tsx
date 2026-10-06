/**
 * WorkItemMetricsPanel —— 会议工单闭环指标看板
 *
 * 指标维度：
 *   - 总工单数 / 各状态分布
 *   - 平均闭环时长（小时）
 *   - 滞留工单数（in_progress / reviewing 超过 72h）
 *   - 异常派单率（rejected / closed）
 *   - 部门分布（用于数据权限 demo）
 *
 * 数据源：`useMeetingWorkItemStore.metrics()`
 * 后端接入时改为：`GET /api/workitems/metrics`
 */

import React, { useMemo } from 'react';
import { Card, Row, Col, Statistic, Progress, Tag, Space, Empty, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import {
  useMeetingWorkItemStore,
  WORKITEM_STATUS_LABELS,
  WORKITEM_STATUS_COLORS,
  type WorkItemCloseStatus,
} from '@/store/meetingWorkItemStore';

const STATUS_ORDER: WorkItemCloseStatus[] = [
  'assigned',
  'pending',
  'in_progress',
  'reviewing',
  'approved',
  'rejected',
];

export const WorkItemMetricsPanel: React.FC = () => {
  const metrics = useMeetingWorkItemStore((s) => s.metrics);
  // 订阅 items 以触发 metrics 重算
  const itemsLen = useMeetingWorkItemStore((s) => s.items.length);

  const m = useMemo(() => {
    void itemsLen; // 触发重算
    return metrics();
  }, [metrics, itemsLen]);

  if (m.total === 0) {
    return (
      <Card title="闭环指标" extra={<Tag color="blue">演示模式</Tag>}>
        <Empty description="暂无工单数据。完成一次会议会后流程即可在此查看指标。" />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <ApartmentOutlined />
          <span>会议工单闭环指标</span>
          <Tag color="blue">演示模式</Tag>
        </Space>
      }
      size="small"
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6}>
          <Statistic
            title="工单总数"
            value={m.total}
            prefix={<ApartmentOutlined />}
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Statistic
            title="已闭环"
            value={m.closed}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#3f8600' }}
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Statistic
            title="在途"
            value={m.inFlight}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#1677ff' }}
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Tooltip title="进行中 / 待复核 超过 72 小时未推进">
            <Statistic
              title="滞留工单"
              value={m.stuckCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: m.stuckCount > 0 ? '#cf1322' : undefined }}
            />
          </Tooltip>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Tooltip title="已驳回 / 已闭环，越低越好">
            <Statistic
              title="异常派单率"
              value={(m.rejectRate * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ color: m.rejectRate > 0.1 ? '#cf1322' : '#3f8600' }}
            />
          </Tooltip>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Tooltip title="工单从派发到 approved/rejected 的平均耗时">
            <Statistic
              title="平均闭环时长"
              value={m.avgCloseHours}
              suffix="小时"
              prefix={<ClockCircleOutlined />}
            />
          </Tooltip>
        </Col>
      </Row>

      {/* 状态分布 */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>状态分布</div>
        <Row gutter={[8, 8]}>
          {STATUS_ORDER.map((st) => {
            const count = m.byStatus[st] || 0;
            const pct = m.total > 0 ? (count / m.total) * 100 : 0;
            return (
              <Col key={st} xs={12} sm={8} md={4}>
                <Card size="small" bodyStyle={{ padding: 8 }}>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    <Tag color={WORKITEM_STATUS_COLORS[st]} style={{ marginRight: 4 }}>
                      {WORKITEM_STATUS_LABELS[st]}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{count}</div>
                  <Progress
                    percent={Number(pct.toFixed(1))}
                    showInfo={false}
                    size="small"
                    strokeColor={
                      WORKITEM_STATUS_COLORS[st] === 'default' ? '#bfbfbf' : undefined
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>

      {/* 部门分布 */}
      {Object.keys(m.byDept).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>部门工单分布</div>
          <Space wrap>
            {Object.entries(m.byDept).map(([dept, count]) => (
              <Tag key={dept} color="geekblue">
                {dept}：{count}
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </Card>
  );
};

export default WorkItemMetricsPanel;
