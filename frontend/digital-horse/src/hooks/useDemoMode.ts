/**
 * useDemoMode — 演示模式开关 Hook
 *
 * 提供：
 *   - isDemoMode: boolean，当前是否为演示模式
 *   - enterDemoMode(): 开启演示模式（localStorage 持久化）
 *   - exitDemoMode(): 关闭演示模式
 *   - autoRunDemo(loadingMsg, successMsg): 自动运行演示流程（依次喂入转写 → 触发 Agent），文案由调用方传入 i18n
 */

import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import {
  DEMO_MEETING_ID,
  DEMO_BLACKBOARD_SNAPSHOT,
  DEMO_REPORT_DATA,
  DEMO_TRANSCRIPTS,
} from '@/mock/meetingDemo';
import { blackboardStore, agentRunStore, fanoutChunk } from '@/services/multiAgentOrchestrator';
import { agentBus } from '@/services/multiAgentBus';
import { generateId } from '@/utils/format';

const DEMO_MODE_KEY = 'app_demo_mode';

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DEMO_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // 初始化演示会议
  const initDemoMeeting = useCallback(() => {
    const bb = blackboardStore.get();
    if (bb.meetingId !== DEMO_MEETING_ID) {
      blackboardStore.setMeeting(DEMO_MEETING_ID);
    }
  }, []);

  // 进入演示模式
  const enterDemoMode = useCallback(() => {
    try {
      localStorage.setItem(DEMO_MODE_KEY, 'true');
    } catch { /* ignore */ }
    setIsDemoMode(true);
    initDemoMeeting();
  }, [initDemoMeeting]);

  // 退出演示模式
  const exitDemoMode = useCallback(() => {
    try {
      localStorage.removeItem(DEMO_MODE_KEY);
    } catch { /* ignore */ }
    setIsDemoMode(false);
    // 重置 Blackboard
    (['moderator', 'notetaker', 'decision', 'action'] as const).forEach((r) =>
      agentRunStore.reset(r)
    );
    blackboardStore.setMeeting('');
  }, []);

  // 自动运行演示：依次喂入转写，模拟 4 Agent 并行处理
  // loadingMsg 由调用方从 i18n 传入，避免 Hook 内调用 useTranslation
  const autoRunDemo = useCallback(async (loadingMsg: string, successMsg: string) => {
    initDemoMeeting();
    message.loading({ content: loadingMsg, key: 'demo', duration: 0 });

    for (let i = 0; i < DEMO_TRANSCRIPTS.length; i++) {
      const t = DEMO_TRANSCRIPTS[i];
      await fanoutChunk(t.speaker, t.content);
      // 每条之间加一点延迟，让动画可见
      await new Promise((r) => setTimeout(r, 400));
    }

    message.success({ content: successMsg, key: 'demo', duration: 4 });
  }, [initDemoMeeting]);

  // 将演示报告数据注入报告生成（演示模式下 generateReport 返回这个）
  const injectDemoReport = useCallback(() => {
    return DEMO_REPORT_DATA;
  }, []);

  // 填充演示 Blackboard（用于直接跳到报告页）
  const fillDemoBlackboard = useCallback(() => {
    // 直接用快照填充
    const snap = DEMO_BLACKBOARD_SNAPSHOT;
    blackboardStore.setMeeting(DEMO_MEETING_ID);
    // 逐条注入 facts
    snap.facts.forEach((f) => blackboardStore.addFact(f));
    snap.decisions.forEach((d) => blackboardStore.addDecision(d));
    snap.actions.forEach((a) => blackboardStore.addAction(a));
    snap.topics.forEach((t) => {
      // setTopics 接受 string[]，单条用临时数组
      blackboardStore.setTopics([t]);
    });
    snap.risks.forEach((r) => blackboardStore.addRisk(r));
    blackboardStore.setSummary(snap.summary);
    blackboardStore.setPhase('closed');
  }, []);

  return {
    isDemoMode,
    enterDemoMode,
    exitDemoMode,
    autoRunDemo,
    injectDemoReport,
    fillDemoBlackboard,
    DEMO_MEETING_ID,
    DEMO_MEETING_TITLE: DEMO_BLACKBOARD_SNAPSHOT.summary.slice(0, 20) + '…',
  };
}
