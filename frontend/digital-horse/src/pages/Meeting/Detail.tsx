/**
 * 会议详情页（Phase 3）
 *
 * 功能：
 *   - 显示会议元数据（标题/主题/议题/阶段）
 *   - 显示 4 个 Agent 的最新 state
 *   - 手动触发 moderator（事件链会自动跑后续 3 个 agent）
 *   - 关闭会议
 *   - WS 实时推送 + 重连后增量同步
 */

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Popconfirm,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { AgentRole, MeetingPhase, meetingApi } from '@/api/meeting';
import { MeetingWebSocket } from '@/api/meetingWs';
import { useMeetingStore } from '@/store/meetingStore';

const ROLES: AgentRole[] = ['moderator', 'noter', 'decision', 'dispatcher'];
const ROLE_LABEL: Record<AgentRole, string> = {
  moderator: '主持',
  noter: '记录',
  decision: '决策',
  dispatcher: '分发',
};
const PHASE_COLOR: Record<MeetingPhase, string> = {
  open: 'blue',
  discussing: 'orange',
  closing: 'gold',
  closed: 'gray',
};

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const mid = Number(id);
  const navigate = useNavigate();
  const token = (localStorage.getItem('auth-storage') &&
    JSON.parse(localStorage.getItem('auth-storage')!).state?.token?.access_token) || '';
  const wsRef = useRef<MeetingWebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const meetingObj = useMeetingStore((s) => s.currentMeeting);
  const blackboard = useMeetingStore((s) => s.blackboard);
  const triggering = useMeetingStore((s) => s.triggering);
  const loadMeeting = useMeetingStore((s) => s.loadMeeting);
  const loadBlackboard = useMeetingStore((s) => s.loadBlackboard);
  const triggerAgent = useMeetingStore((s) => s.triggerAgent);
  const closeMeeting = useMeetingStore((s) => s.closeMeeting);
  const applySnapshot = useMeetingStore((s) => s.applySnapshot);
  const applyUpdate = useMeetingStore((s) => s.applyUpdate);

  useEffect(() => {
    if (!mid || !token) return;
    Promise.all([loadMeeting(mid), loadBlackboard(mid)]).catch((e) =>
      message.error(`加载会议失败：${e.message}`),
    );
  }, [mid, token, loadMeeting, loadBlackboard]);

  // WebSocket 生命周期
  useEffect(() => {
    if (!mid || !token) return;
    const ws = new MeetingWebSocket({
      meetingId: mid,
      token,
      onSnapshot: applySnapshot,
      onUpdate: applyUpdate,
      onError: () => setWsConnected(false),
      onClose: () => setWsConnected(false),
    });
    ws.connect();
    // 初始连接立即视为连接中；onopen 在 ws.onopen 里同步触发不易捕获，
    // 这里用 setTimeout 给一个友好提示
    setWsConnected(true);
    wsRef.current = ws;
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [mid, token, applySnapshot, applyUpdate]);

  if (!meetingObj) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const onTriggerModerator = async () => {
    try {
      await triggerAgent(mid, 'moderator');
      message.success('moderator 已触发，后续 agent 自动跑完');
    } catch (e: any) {
      message.error(`触发失败：${e.message}`);
    }
  };

  const onCloseMeeting = async () => {
    try {
      await closeMeeting(mid);
      message.success('会议已关闭');
      navigate('/meetings');
    } catch (e: any) {
      message.error(`关闭失败：${e.message}`);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {meetingObj.title}
          </Typography.Title>
          {meetingObj.current_phase && (
            <Tag color={PHASE_COLOR[meetingObj.current_phase]}>
              阶段：{meetingObj.current_phase}
            </Tag>
          )}
          <Badge
            status={wsConnected ? 'success' : 'error'}
            text={wsConnected ? 'WS 已连接' : 'WS 断开'}
          />
        </Space>
        <Space>
          <Button
            type="primary"
            loading={triggering.moderator}
            disabled={meetingObj.status !== 'active'}
            onClick={onTriggerModerator}
          >
            触发主持人
          </Button>
          <Popconfirm
            title="确认关闭会议？"
            description="关闭后将无法再触发 Agent"
            onConfirm={onCloseMeeting}
          >
            <Button danger disabled={meetingObj.status === 'closed'}>
              关闭会议
            </Button>
          </Popconfirm>
        </Space>
      </Space>

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="会议 ID">{meetingObj.id}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag>{meetingObj.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="主题" span={2}>
            {meetingObj.topic || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="议题" span={2}>
            {meetingObj.agenda || '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Typography.Title level={4}>Agent 黑板</Typography.Title>
      {meetingObj.status !== 'active' && (
        <Alert
          type="warning"
          message="会议非 active 状态，所有 Agent 不可写"
          style={{ marginBottom: 16 }}
        />
      )}
      <Row gutter={[12, 12]}>
        {ROLES.map((role) => (
          <Col key={role} xs={24} sm={12} md={6}>
            <AgentCard
              role={role}
              snapshot={blackboard[role]}
              triggering={!!triggering[role]}
            />
          </Col>
        ))}
      </Row>
    </div>
  );
}

function AgentCard({
  role,
  snapshot,
  triggering,
}: {
  role: AgentRole;
  snapshot?: { version: number; state: Record<string, unknown> };
  triggering: boolean;
}) {
  const eventType = (snapshot?.state as any)?.event_type as string | undefined;
  return (
    <Card
      title={ROLE_LABEL[role]}
      extra={<Tag>v{snapshot?.version ?? 0}</Tag>}
      loading={triggering}
    >
      {snapshot ? (
        <>
            {eventType && (
              <Tag color="geekblue" style={{ marginBottom: 8 }}>
                {eventType}
              </Tag>
            )}
            <pre
              style={{
                background: '#f6f8fa',
                padding: 8,
                borderRadius: 4,
                maxHeight: 280,
                overflow: 'auto',
                margin: 0,
                fontSize: 12,
              }}
            >
              {JSON.stringify(snapshot.state, null, 2)}
            </pre>
          </>
      ) : (
        <Typography.Text type="secondary">尚未写入</Typography.Text>
      )}
    </Card>
  );
}