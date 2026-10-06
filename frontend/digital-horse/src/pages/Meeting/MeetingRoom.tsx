import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Avatar,
  Badge,
  Tooltip,
  Input,
  Tag,
  Spin,
  message,
  Modal,
  Dropdown,
  Tabs,
  Segmented,
  Empty,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
  DesktopOutlined,
  PhoneOutlined,
  MoreOutlined,
  SendOutlined,
  RobotOutlined,
  MessageOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  SoundOutlined,
  AimOutlined,
  FileTextOutlined,
  TeamOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  UserAddOutlined,
  SettingOutlined,
  ShareAltOutlined,
  LockOutlined,
  WifiOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import type { Meeting } from '@/types/api';
import type { ContactEmployee } from '@/types/contacts';
import { generateId } from '@/utils/format';
import { useUserStore } from '@/store';
import { useContactsStore } from '@/store';
import { useLocalCamera } from '@/hooks/useLocalCamera';
import { AgentPanel } from '@/components/Meeting/AgentPanel';
import { PostMeetingDrawer } from '@/components/Meeting/PostMeeting/PostMeetingDrawer';
import { resetMeeting, fanoutChunk, runClosingSummary } from '@/services/multiAgentOrchestrator';
import { useBlackboard } from '@/services/useMultiAgent';
import i18n from '@/i18n';
import './MeetingRoom.css';

const { Text, Paragraph } = Typography;

// ============================================================
// 类型定义
// ============================================================

type ViewMode = 'speaker' | 'grid' | 'fullscreen';
type ParticipantStatus = 'joined' | 'left' | 'offline';

interface Participant {
  id: string;
  name: string;
  avatar: string;
  role: 'host' | 'co-host' | 'member';
  status: ParticipantStatus;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  joinedAt: string;
  department?: string;
  position?: string;
}

interface TranscriptItem {
  id: number;
  speaker: string;
  speakerId: string;
  content: string;
  time: string;
  type: 'transcript' | 'chat' | 'ai';
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  references?: { title: string; snippet: string }[];
}

interface ActionItemForMeeting {
  id: string;
  description: string;
  assignee: string;
  assigneeName: string;
  dueDate: string;
  status: 'pending' | 'done';
}

// ============================================================
// 工具：从通讯录构造其他参与者
// ============================================================

const buildOtherParticipantsFromContacts = (
  employees: ContactEmployee[],
  excludeName: string | undefined
): Omit<Participant, 'role'>[] => {
  const others = employees.filter((e) => e.name !== excludeName).slice(0, 4);
  const flags: { status: ParticipantStatus; isMuted: boolean; isVideoOff: boolean }[] = [
    { status: 'joined', isMuted: true, isVideoOff: false },
    { status: 'joined', isMuted: false, isVideoOff: true },
    { status: 'joined', isMuted: true, isVideoOff: false },
    { status: 'left', isMuted: false, isVideoOff: false },
  ];
  return others.map((e, i) => ({
    id: e.id,
    name: e.name,
    avatar: e.avatar || '#1890ff',
    status: flags[i]?.status ?? 'joined',
    isMuted: flags[i]?.isMuted ?? false,
    isVideoOff: flags[i]?.isVideoOff ?? false,
    isSpeaking: false,
    isScreenSharing: false,
    joinedAt: new Date().toISOString(),
    department: e.department,
    position: e.position,
  }));
};

const getMockTranscripts = (isZh: boolean, hostName: string): TranscriptItem[] => {
  // 模块级不能使用 hook 的 t，改用 i18n.t
  const tKey = (key: string) => i18n.t(key);
  return [
    {
      id: 1,
      speaker: hostName || (tKey('meeting.host')),
      speakerId: 'current-user',
      content: tKey('auto.65'),
      time: '14:00:01',
      type: 'transcript',
    },
    {
      id: 2,
      speaker: tKey('auto.22'),
      speakerId: 'user-002',
      content: tKey('auto.64'),
      time: '14:00:25',
      type: 'transcript',
    },
    {
      id: 3,
      speaker: tKey('auto.21'),
      speakerId: 'user-003',
      content: tKey('auto.63'),
      time: '14:01:15',
      type: 'transcript',
    },
    {
      id: 4,
      speaker: hostName || (tKey('meeting.host')),
      speakerId: 'current-user',
      content: tKey('auto.62'),
      time: '14:01:30',
      type: 'transcript',
    },
  ];
};

const getMockAIMessages = (isZh: boolean): AIMessage[] => [
  {
    id: 'ai-001',
    role: 'assistant',
    content: i18n.t('auto.61'),
    timestamp: new Date().toISOString(),
  },
];

// ============================================================
// 会议房间组件
// ============================================================

interface MeetingRoomProps {
  /** 由父组件 MeetingHub 通过 query string 传入 */
  meetingId?: string;
}

const MeetingRoom: React.FC<MeetingRoomProps> = ({ meetingId: propMeetingId }) => {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  // 优先用 props 传入的 id（MeetingHub 嵌入式场景），否则用路由参数（独立路由）
  const id = propMeetingId || params.id;
  const [isZh] = useState(i18n.language === 'zh-CN');

  const { user } = useUserStore();
  const employees = useContactsStore((s) => s.employees);
  // 用 getState() 拿 bootstrap 函数引用，避免 selector 订阅函数引用导致无限循环
  const bootstrap = useContactsStore.getState().bootstrap;
  const bootstrappedRef = useRef(false);

  // 真实身份 → 通讯录 employee
  const currentEmployee = useMemo(
    () => (user ? employees.find((e) => e.username === user.username) : undefined),
    [user, employees]
  );
  const currentUserId = user?.id ?? 'current-user';
  const currentDisplayName = user?.name ?? (t('auto.60'));
  const currentAvatar = currentEmployee?.avatar || '#0F2B5B';
  const currentDepartment = user?.department || currentEmployee?.department || '';

  // 状态定义
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // 控制状态
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 摄像头（真实接入）
  const camera = useLocalCamera();

  // 视图状态
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showParticipantList, setShowParticipantList] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(true);
  const [aiPanelMode, setAiPanelMode] = useState<'classic' | 'multiagent'>('multiagent');
  const [activePanelTab, setActivePanelTab] = useState('ai');

  // 转写状态
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [isTranscribing] = useState(true);

  // AI 助手状态
  const [aiMessages, setAIMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // AI 分析
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiKeyPoints, setAiKeyPoints] = useState<string[]>([]);
  const [aiDecisions, setAiDecisions] = useState<string[]>([]);
  const [actionItems] = useState<ActionItemForMeeting[]>([]);

  // 时间
  const [meetingDuration, setMeetingDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speakingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 会后 Drawer
  const [postMeetingOpen, setPostMeetingOpen] = useState(false);

  // 组件卸载时释放摄像头
  useEffect(() => {
    return () => {
      camera.disable();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 摄像头错误 → toast（去重：相同错误信息只弹一次）
  const lastCameraErrRef = useRef<string | null>(null);
  useEffect(() => {
    if (camera.error && lastCameraErrRef.current !== camera.error) {
      lastCameraErrRef.current = camera.error;
      message.warning(camera.error);
    }
  }, [camera.error]);

  // 初始化 mock 数据（只跑一次，避免 bootstrap 引用变化导致无限循环）
  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      // 异步调用，避免在 React commit 阶段同步触发其他 store 更新
      queueMicrotask(() => bootstrap());
    }
    // bootstrap 来自 getState() 引用稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换 meeting 时重置多 Agent 状态
  useEffect(() => {
    if (id) {
      resetMeeting(id);
    }
  }, [id]);

  // 初始化会议对象与转写内容
  useEffect(() => {
    if (id) {
      setMeeting({
        id,
        title: t('auto.14'),
        startTime: new Date().toISOString(),
        endTime: '',
        participants: [currentUserId, 'user-002', 'user-003', 'user-004', 'user-005'],
        status: 'ongoing',
      });
    }
    setTranscripts(getMockTranscripts(isZh, currentDisplayName));
    setAIMessages(getMockAIMessages(isZh));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 构造参与者列表 + 同步本人摄像头/静音状态：合并到一个 effect，
  // 用 ref 守卫避免重复 setParticipants，并消除两个 effect 之间的相互触发
  const lastParticipantsSnapshotRef = useRef<string>('');
  useEffect(() => {
    const otherList = buildOtherParticipantsFromContacts(employees, currentDisplayName).map<Participant>(
      (p) => ({ ...p, role: 'member' as const })
    );
    if (otherList.length > 0) {
      otherList[0] = { ...otherList[0], role: 'co-host' as const };
    }
    const hostParticipant: Participant = {
      id: currentUserId,
      name: currentDisplayName,
      avatar: currentAvatar,
      role: 'host',
      status: 'joined',
      isMuted,
      isVideoOff: !camera.enabled,
      isSpeaking: false,
      isScreenSharing: false,
      joinedAt: new Date().toISOString(),
      department: currentDepartment,
      position: currentEmployee?.position,
    };
    const next = [hostParticipant, ...otherList];
    // 序列化对比，避免结构一致但引用不同造成的重复 set
    const sig = JSON.stringify(next.map((p) => `${p.id}:${p.role}:${p.isMuted}:${p.isVideoOff}:${p.status}:${p.isSpeaking}`));
    if (lastParticipantsSnapshotRef.current === sig) return;
    lastParticipantsSnapshotRef.current = sig;
    setParticipants(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    employees.length,
    currentUserId,
    currentDisplayName,
    currentAvatar,
    currentDepartment,
    camera.enabled,
    isMuted,
  ]);

  // 会议计时器
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setMeetingDuration((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 模拟发言轮流
  // 修复：用 ref 保存最新 participants，避免过期闭包；用 speakerIndexRef 让重启 timer 不重置索引
  const participantsRef = useRef<Participant[]>([]);
  const speakerIndexRef = useRef(0);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);
  useEffect(() => {
    const tick = () => {
      const list = participantsRef.current;
      const joined = list.filter((p) => p.status === 'joined' && !p.isMuted);
      if (joined.length > 0) {
        setParticipants((prev) =>
          prev.map((p) => ({
            ...p,
            isSpeaking: p.id === joined[speakerIndexRef.current % joined.length].id,
          }))
        );
        speakerIndexRef.current++;
      }
    };
    speakingTimerRef.current = setInterval(tick, 4000);
    return () => {
      if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);
    };
    // 只在挂载/卸载时启停 timer，避免依赖变化导致重启重置 speakerIndex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI 模拟分析（启动后 2 秒一次性填充，避免重复 setState 触发循环）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isZh) {
        setAiKeyPoints([
          'Q1 MAU 增长15%，付费转化率从3.2%提升至4.1%',
          'Q2 重点：用户留存率和付费场景扩展',
          '移动端体验问题需要重点解决',
        ]);
        setAiDecisions([
          '确定Q2核心目标：提升留存率',
          '移动端优化列为最高优先级',
        ]);
        setAiSummary(`## 会议摘要

### 核心要点
- 上季度MAU增长15%，付费转化率达4.1%
- Q2重点：用户留存率和付费场景

### 决议事项
- 移动端优化列为最高优先级

### 待办事项
- 由 ${currentDisplayName} 统筹规划`);
      } else {
        setAiKeyPoints([
          'Q1 MAU grew 15%, paid conversion rate improved from 3.2% to 4.1%',
          'Q2 Focus: user retention and paid scenarios expansion',
        ]);
        setAiDecisions(['Confirm Q2 core goal: improve retention rate']);
        setAiSummary(`## Meeting Summary\n\nOwned by ${currentDisplayName}.`);
      }
    }, 2000);
    return () => clearTimeout(timer);
    // 启动时一次性填充，依赖 isZh 切换语言时重新填充；currentDisplayName 取自 ref-stable user 派生，eslint 抑制
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isZh]);

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 获取用户颜色
  const getUserColor = (userId: string) => {
    return participants.find((p) => p.id === userId)?.avatar || '#1890ff';
  };

  // 发送聊天消息（真实身份）→ 自动触发 4 Agent 协作
  const handleSendChat = async () => {
    if (!chatMessage.trim()) return;
    const newTranscript: TranscriptItem = {
      id: Date.now(),
      speaker: currentDisplayName,
      speakerId: currentUserId,
      content: chatMessage,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      type: 'chat',
    };
    setTranscripts((prev) => [...prev, newTranscript]);
    const text = chatMessage;
    setChatMessage('');
    // 触发 4 Agent 并行分析
    fanoutChunk(currentDisplayName, text).catch((e) => console.error(e));
  };

  // 发送 AI 消息
  const handleSendAIMessage = async () => {
    if (!aiInput.trim()) return;

    const userMessage: AIMessage = {
      id: generateId('msg'),
      role: 'user',
      content: aiInput,
      timestamp: new Date().toISOString(),
    };
    setAIMessages((prev) => [...prev, userMessage]);
    setAiInput('');
    setAiLoading(true);

    setTimeout(() => {
      const responses = isZh
        ? ['根据会议内容，已经整理好相关要点。', '好的，可以帮您生成会议纪要。']
        : ['Summary is ready.', 'Sure, I can help generate the meeting summary.'];

      const aiResponse: AIMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toISOString(),
      };
      setAIMessages((prev) => [...prev, aiResponse]);
      setAiLoading(false);
    }, 1500);
  };

  // 结束会议
  const handleEndMeeting = () => {
    Modal.confirm({
      title: t('meeting.confirmEndMeeting'),
      content: t('auto.59'),
      okText: t('meeting.endMeeting'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        camera.disable();
        message.success(t('auto.58'));

        //  触发 4 Agent 自动汇总 + 自动派单
        // runClosingSummary 内部会调用 postMeetingService.closeMeeting()
        try {
          await runClosingSummary();
        } catch (e) {
          console.error('[MeetingRoom] runClosingSummary failed', e);
        }

        // 弹出 PostMeetingDrawer
        setPostMeetingOpen(true);
      },
    });
  };

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // 摄像头切换
  const handleToggleCamera = async () => {
    await camera.toggle();
  };

  // 参与者菜单
  const participantMenuItems: MenuProps['items'] = [
    { key: 'invite', icon: <UserAddOutlined />, label: t('auto.57') },
    { key: 'mute-all', icon: <AudioMutedOutlined />, label: t('auto.56') },
    { type: 'divider' },
    { key: 'setting', icon: <SettingOutlined />, label: t('auto.55') },
  ];

  // 更多菜单
  const moreMenuItems: MenuProps['items'] = [
    { key: 'record', icon: <SoundOutlined />, label: isRecording ? (t('auto.38')) : (t('auto.37')) },
    { key: 'share', icon: <ShareAltOutlined />, label: isScreenSharing ? (t('meeting.stopSharing')) : (t('meeting.shareScreen')) },
    { key: 'lock', icon: <LockOutlined />, label: t('auto.54') },
    { type: 'divider' },
    { key: 'fullscreen', icon: isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />, label: isFullscreen ? (t('auto.53')) : (t('auto.52')) },
  ];

  // 当前发言者
  const currentSpeaker = participants.find((p) => p.isSpeaking);

  // 活跃参与者
  const activeParticipants = participants.filter((p) => p.status === 'joined');
  const leftParticipants = participants.filter((p) => p.status === 'left');

  return (
    <div className={`meeting-room ${viewMode === 'fullscreen' ? 'fullscreen' : ''}`}>
      {/* 顶部栏 */}
      <div className="meeting-header">
        <div className="meeting-header-left">
          <Space size="middle">
            <Tooltip title={t('auto.51')}>
              <Button
                type="text"
                icon={showParticipantList ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                onClick={() => setShowParticipantList(!showParticipantList)}
              />
            </Tooltip>
            <Badge status="processing" />
            <Text strong className="meeting-title">{meeting?.title || (t('auto.50'))}</Text>
            <Tag color="blue" icon={<ClockCircleOutlined />}>
              {formatDuration(meetingDuration)}
            </Tag>
            <Tag color={isRecording ? 'red' : 'default'} icon={<SoundOutlined />}>
              {isRecording ? (t('meeting.recording')) : (t('auto.49'))}
            </Tag>
          </Space>
        </div>

        <div className="meeting-header-center">
          <Space size="small">
            <Tag icon={<WifiOutlined />} color="success">
              {t('auto.48')}
            </Tag>
            <Tag icon={<TeamOutlined />}>
              {activeParticipants.length} {t('auto.47')}
            </Tag>
          </Space>
        </div>

        <div className="meeting-header-right">
          <Space>
            <Button
              type="text"
              icon={<RobotOutlined />}
              className={showAIPanel ? 'ai-active' : ''}
              onClick={() => setShowAIPanel(!showAIPanel)}
            >
              AI
            </Button>
            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
            <Button
              type="primary"
              danger
              icon={<PhoneOutlined />}
              onClick={handleEndMeeting}
            >
              {t('auto.46')}
            </Button>
          </Space>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="meeting-main">
        {!showParticipantList && (
          <Tooltip placement="right" title={t('auto.45')}>
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<MenuUnfoldOutlined />}
              className="participant-toggle-fab"
              onClick={() => setShowParticipantList(true)}
            />
          </Tooltip>
        )}

        {showParticipantList && (
          <div className="participant-sidebar">
            <div className="participant-header">
              <Text strong>{t('auto.43')} ({participants.length})</Text>
              <Space size="small">
                <Tooltip title={t('auto.44')}>
                  <Button type="text" size="small" icon={<UserAddOutlined />} />
                </Tooltip>
              </Space>
            </div>

            <div className="participant-list">
              <div className="participant-group">
                <Text type="secondary" className="participant-group-label">
                  {t('meeting.host')}
                </Text>
                {participants.filter((p) => p.role === 'host').map((p) => (
                  <ParticipantItem key={p.id} participant={p} isZh={isZh} />
                ))}
              </div>

              <div className="participant-group">
                <Text type="secondary" className="participant-group-label">
                  {t('auto.43')} ({activeParticipants.length})
                </Text>
                {activeParticipants.filter((p) => p.role !== 'host').map((p) => (
                  <ParticipantItem key={p.id} participant={p} isZh={isZh} />
                ))}
              </div>

              {leftParticipants.length > 0 && (
                <div className="participant-group">
                  <Text type="secondary" className="participant-group-label">
                    {t('auto.26')} ({leftParticipants.length})
                  </Text>
                  {leftParticipants.map((p) => (
                    <ParticipantItem key={p.id} participant={p} isZh={isZh} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 视频区域 */}
        <div className="video-area">
          {camera.error && (
            <div style={{
              position: 'absolute', top: 48, left: 12, right: 12, zIndex: 20,
              background: 'rgba(250, 173, 20, 0.15)', border: '1px solid #faad14',
              padding: '6px 12px', borderRadius: 6, color: '#faad14', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <ExclamationCircleOutlined />
              <span>{camera.error}</span>
            </div>
          )}

          <div className="view-switcher">
            <Segmented
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              options={[
                { value: 'speaker', label: t('auto.42'), icon: <BulbOutlined /> },
                { value: 'grid', label: t('auto.41'), icon: <MenuUnfoldOutlined /> },
              ]}
            />
          </div>

          {/* 视频网格 */}
          <div className={`video-grid view-${viewMode}`}>
            {viewMode === 'speaker' && currentSpeaker ? (
              <>
                <div className="video-main">
                  <VideoTile
                    participant={currentSpeaker}
                    isZh={isZh}
                    isCurrentUser={currentSpeaker.id === currentUserId}
                    cameraStream={currentSpeaker.id === currentUserId ? camera.stream : null}
                  />
                </div>
                <div className="video-others">
                  {activeParticipants
                    .filter((p) => p.id !== currentSpeaker.id)
                    .map((p) => (
                      <VideoTile
                        key={p.id}
                        participant={p}
                        isZh={isZh}
                        isCurrentUser={p.id === currentUserId}
                        small
                        cameraStream={p.id === currentUserId ? camera.stream : null}
                      />
                    ))}
                </div>
              </>
            ) : (
              activeParticipants.map((p) => (
                <VideoTile
                  key={p.id}
                  participant={p}
                  isZh={isZh}
                  isCurrentUser={p.id === currentUserId}
                  cameraStream={p.id === currentUserId ? camera.stream : null}
                />
              ))
            )}
          </div>

          {/* 控制栏 */}
          <div className="control-bar">
            <div className="control-bar-main">
              <Tooltip title={isMuted ? (t('meeting.unmute')) : (t('meeting.mute'))}>
                <Button
                  type={isMuted ? 'primary' : 'default'}
                  danger={isMuted}
                  shape="circle"
                  size="large"
                  icon={isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                  onClick={() => setIsMuted(!isMuted)}
                />
              </Tooltip>

              <Tooltip
                title={
                  !camera.enabled
                    ? (t('auto.40'))
                    : (t('auto.39'))
                }
              >
                <Button
                  type={camera.enabled ? 'primary' : 'default'}
                  danger={!camera.enabled}
                  shape="circle"
                  size="large"
                  icon={camera.enabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                  onClick={handleToggleCamera}
                  loading={camera.stream === null && camera.error === null && !camera.enabled ? false : false}
                />
              </Tooltip>

              <Tooltip title={isScreenSharing ? (t('meeting.stopSharing')) : (t('meeting.shareScreen'))}>
                <Button
                  type={isScreenSharing ? 'primary' : 'default'}
                  shape="circle"
                  size="large"
                  icon={<DesktopOutlined />}
                  onClick={() => setIsScreenSharing(!isScreenSharing)}
                />
              </Tooltip>

              <Tooltip title={isRecording ? (t('auto.38')) : (t('auto.37'))}>
                <Button
                  type={isRecording ? 'primary' : 'default'}
                  danger={isRecording}
                  shape="circle"
                  size="large"
                  icon={<SoundOutlined />}
                  onClick={() => setIsRecording(!isRecording)}
                />
              </Tooltip>

              <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
                <Button type="default" shape="circle" size="large" icon={<MoreOutlined />} />
              </Dropdown>

              <Button
                type="primary"
                danger
                shape="round"
                size="large"
                icon={<PhoneOutlined />}
                onClick={handleEndMeeting}
                className="end-meeting-btn"
              >
                {t('meeting.endMeeting')}
              </Button>
            </div>
          </div>
        </div>

        {/* AI 分析面板 */}
        {showAIPanel && (
          <div className="ai-panel">
            {aiPanelMode === 'multiagent' ? (
              <AgentPanel meetingId={currentUserId} isZh={isZh} onClose={() => setShowAIPanel(false)} />
            ) : (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 6 }}>
                <Button size="small" onClick={() => setAiPanelMode('multiagent')}>
                  {'多 Agent 协作'}
                </Button>
              </div>
            )}
            {aiPanelMode === 'multiagent' && (
              <div style={{ padding: '4px 12px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-hover)' }}>
                <Button size="small" type="link" onClick={() => setAiPanelMode('classic')}>
                  ← {'切换到经典 AI 助手'}
                </Button>
              </div>
            )}
            {aiPanelMode === 'classic' && (
              <Tabs
                selectedKey={activePanelTab}
                onChange={setActivePanelTab}
                className="ai-panel-tabs"
                items={[
                {
                  key: 'transcript',
                  label: (
                    <span>
                      <MessageOutlined />
                      {t('auto.36')}
                      {isTranscribing && <SyncOutlined spin style={{ marginLeft: 4 }} />}
                    </span>
                  ),
                  children: (
                    <div className="transcript-panel">
                      <div className="transcript-list">
                        {transcripts.length === 0 ? (
                          <div className="transcript-empty">
                            <Spin tip={t('meeting.startingTranscription')} />
                          </div>
                        ) : (
                          transcripts.map((item, idx) => (
                            <div key={idx} className={`transcript-item ${item.type}`}>
                              <div className="transcript-header">
                                <Avatar
                                  size="small"
                                  style={{ backgroundColor: getUserColor(item.speakerId) }}
                                >
                                  {item.speaker.charAt(0)}
                                </Avatar>
                                <Text strong className="speaker-name">{item.speaker}</Text>
                                <Text type="secondary" className="transcript-time">{item.time}</Text>
                                {item.type === 'chat' && <Tag color="blue" size="small">{t('meeting.chat')}</Tag>}
                              </div>
                              <Paragraph className="transcript-content" ellipsis={{ rows: 3 }}>
                                {item.content}
                              </Paragraph>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="transcript-input">
                        <Input.Search
                          placeholder={t('meeting.sendMessage')}
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onSearch={handleSendChat}
                          enterButton={<SendOutlined />}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'ai',
                  label: (
                    <span>
                      <RobotOutlined />
                      AI {t('auto.35')}
                    </span>
                  ),
                  children: (
                    <div className="ai-chat-panel">
                      <div className="ai-messages">
                        {aiMessages.map((msg) => (
                          <div key={msg.id} className={`ai-message ${msg.role}`}>
                            <Avatar
                              size="small"
                              icon={msg.role === 'assistant' ? <RobotOutlined /> : undefined}
                              style={{ backgroundColor: msg.role === 'assistant' ? '#1890ff' : '#52c41a' }}
                            >
                              {msg.role === 'user' ? (currentDisplayName.charAt(0)) : 'AI'}
                            </Avatar>
                            <div className="ai-message-content">
                              <div className="ai-message-bubble">
                                {msg.content.split('\n').map((line, i) => (
                                  <p key={i}>{line}</p>
                                ))}
                              </div>
                              <Text type="secondary" className="ai-message-time">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </Text>
                            </div>
                          </div>
                        ))}
                        {aiLoading && (
                          <div className="ai-message assistant">
                            <Avatar size="small" icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
                            <div className="ai-message-content">
                              <div className="ai-message-bubble loading">
                                <Spin size="small" /> {t('auto.34')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="ai-input">
                        <Input.Search
                          placeholder={t('auto.33')}
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          onSearch={handleSendAIMessage}
                          enterButton={t('qa.send')}
                          loading={aiLoading}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'analysis',
                  label: (
                    <span>
                      <BulbOutlined />
                      {t('auto.32')}
                    </span>
                  ),
                  children: (
                    <div className="ai-analysis-panel">
                      {aiKeyPoints.length > 0 && (
                        <Card
                          size="small"
                          title={
                            <Space>
                              <AimOutlined style={{ color: '#1890ff' }} />
                              {t('meeting.keyPoints')}
                            </Space>
                          }
                          style={{ marginBottom: 12 }}
                        >
                          <div>
                            {aiKeyPoints.map((item, index) => (
                              <div key={index} style={{ padding: '8px 0', display: 'flex', alignItems: 'center' }}>
                                <Space>
                                  <Tag color="blue">{index + 1}</Tag>
                                  <Text>{item}</Text>
                                </Space>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {aiDecisions.length > 0 && (
                        <Card
                          size="small"
                          title={
                            <Space>
                              <CheckCircleOutlined style={{ color: '#52c41a' }} />
                              {t('meeting.decisions')}
                            </Space>
                          }
                          style={{ marginBottom: 12 }}
                        >
                          <div>
                            {aiDecisions.map((item, index) => (
                              <div key={index} style={{ padding: '8px 0', display: 'flex', alignItems: 'center' }}>
                                <Space>
                                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                  <Text>{item}</Text>
                                </Space>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {actionItems.length > 0 && (
                        <Card
                          size="small"
                          title={
                            <Space>
                              <FileTextOutlined style={{ color: '#fa8c16' }} />
                              {t('meeting.actionItems')}
                            </Space>
                          }
                        >
                          <div>
                            {actionItems.map((item, index) => (
                              <div key={index} style={{ padding: '10px 0' }}>
                                <div style={{ width: '100%' }}>
                                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                    <Text>{item.description}</Text>
                                    <Tag>{item.assigneeName}</Tag>
                                  </Space>
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('auto.31')}: {item.dueDate}
                                  </Text>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {aiKeyPoints.length === 0 && (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={t('auto.30')}
                        />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'summary',
                  label: (
                    <span>
                      <FileTextOutlined />
                      {t('auto.29')}
                    </span>
                  ),
                  children: (
                    <div className="ai-summary-panel">
                      {aiSummary ? (
                        <div className="markdown-content">
                          <ReactMarkdown>{aiSummary}</ReactMarkdown>
                        </div>
                      ) : (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={t('auto.28')}
                        />
                      )}
                    </div>
                  ),
                },
              ]}
              />
            )}
          </div>
        )}
      </div>

      {/* 会后报告 Drawer（结束会议后弹出） */}
      {id && (
        <PostMeetingDrawer
          open={postMeetingOpen}
          onClose={() => setPostMeetingOpen(false)}
          meetingId={id}
          meetingTitle={meeting?.title}
        />
      )}
    </div>
  );
};

// ============================================================
// 参会人项组件
// ============================================================

interface ParticipantItemProps {
  participant: Participant;
  isZh: boolean;
}

const ParticipantItem: React.FC<ParticipantItemProps> = ({ participant, isZh }) => {
  const { t } = useTranslation();
  return (
    <div className={`participant-item ${participant.status}`}>
      <Avatar
        size={36}
        style={{ backgroundColor: participant.avatar }}
      >
        {participant.name.charAt(0)}
      </Avatar>
      <div className="participant-info">
        <Text className="participant-name">
          {participant.name}
          {participant.role === 'host' && <Tag color="gold" size="small" style={{ marginLeft: 4 }}>{t('auto.27')}</Tag>}
        </Text>
        <Space size={4} className="participant-status">
          {participant.isSpeaking && <SoundOutlined style={{ color: '#52c41a' }} />}
          {participant.isMuted && <AudioMutedOutlined style={{ color: '#999' }} />}
          {participant.isVideoOff && <VideoCameraAddOutlined style={{ color: '#999' }} />}
          {participant.status === 'left' && <Text type="secondary">{t('auto.26')}</Text>}
        </Space>
      </div>
    </div>
  );
};

// ============================================================
// 视频瓦片组件
// ============================================================

interface VideoTileProps {
  participant: Participant;
  isZh: boolean;
  isCurrentUser: boolean;
  small?: boolean;
  cameraStream: MediaStream | null;
}

const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isZh,
  isCurrentUser,
  small,
  cameraStream,
}) => {
  const { t } = useTranslation();
  const showCamera = isCurrentUser && !participant.isVideoOff && cameraStream;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream]);

  return (
    <div className={`video-tile ${participant.isSpeaking ? 'speaking' : ''} ${small ? 'small' : ''}`}>
      {participant.isVideoOff ? (
        <div className="video-off">
          <Avatar size={small ? 48 : 80} style={{ backgroundColor: participant.avatar }}>
            {participant.name.charAt(0)}
          </Avatar>
        </div>
      ) : showCamera ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            background: '#000',
            transform: 'scaleX(-1)',
          }}
        />
      ) : (
        <div className="video-on">
          <div className="video-placeholder" style={{ background: `${participant.avatar}33` }}>
            <Avatar size={small ? 48 : 80} style={{ backgroundColor: participant.avatar }}>
              {participant.name.charAt(0)}
            </Avatar>
          </div>
        </div>
      )}

      <div className="video-info-bar">
        <div className="video-name">
          {participant.isSpeaking && (
            <div className="speaking-indicator">
              <span></span><span></span><span></span>
            </div>
          )}
          <Text style={{ color: '#fff', fontSize: small ? 11 : 13 }}>
            {participant.name}
            {isCurrentUser && <Text type="secondary" style={{ fontSize: 11 }}>（{t('auto.25')}）</Text>}
          </Text>
        </div>
        <Space size={4}>
          {participant.isMuted ? (
            <AudioMutedOutlined style={{ color: '#fff', fontSize: 12 }} />
          ) : (
            <SoundOutlined style={{ color: '#52c41a', fontSize: 12 }} />
          )}
        </Space>
      </div>

      {participant.role === 'host' && (
        <Tag color="gold" className="role-tag">
          {t('meeting.host')}
        </Tag>
      )}

      {participant.isScreenSharing && (
        <Tag color="cyan" className="sharing-tag" icon={<DesktopOutlined />}>
          {t('auto.24')}
        </Tag>
      )}
    </div>
  );
};

export default MeetingRoom;
