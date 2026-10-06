/**
 * 沙箱 API 契约 —— 前后端严格分离
 *
 * 前端只调 sandboxService.check()
 * 后端按此契约实现即可，UI 0 改动
 *
 * 真实后端上线后：
 *   1. 删除本文件的 mock 实现
 *   2. 把 postMeetingService 的替换模式复制过来
 *   3. 把每个函数的 await delay() 替换为 axios.post()
 */

import type { SandboxResult } from './sandboxEngine';
import { runSandboxCheck } from './sandboxEngine';
import { sandboxLogStore, hashInput, previewInput, type BusinessRef } from './sandboxLog';
import { DEMO_SANDBOX_TEXTS } from '@/mock/sandboxDemo';
import { generateId } from '@/utils/format';
import { eventBus } from '@/services/eventBus';

// ============================================================
// 真实对接时：把这里替换为 axios 调用
//   const { data } = await axios.post<SandboxCheckResponse>(
//     '/api/v1/sandbox/check',
//     { text }
//   );
//   return data.data;
// ============================================================

export interface SandboxCheckRequest {
  text: string;
  source: 'approval' | 'report' | 'qa' | 'sandbox_page' | 'demo' | 'meeting_report' | 'meeting_export' | 'chat_ai' | 'industry_news_review';
  /** 业务单据绑定（用于联动追溯） */
  businessRef?: BusinessRef;
}

export interface SandboxCheckResponse {
  success: boolean;
  data?: SandboxResult;
  error?: string;
}

// ============================================================
// 1. check —— 沙箱主检查
// ============================================================

export async function checkCompliance(
  req: SandboxCheckRequest
): Promise<SandboxResult> {
  // 前端 mock：直接用同步引擎
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

  // 演示模式检测
  if (req.source === 'demo') {
    // 从演示数据里取一条随机
    const idx = Math.floor(Math.random() * DEMO_SANDBOX_TEXTS.length);
    const demoText = DEMO_SANDBOX_TEXTS[idx].text;
    const result = runSandboxCheck(demoText);
    // 记录日志
    const hash = await hashInput(demoText);
    sandboxLogStore.record({
      user: '演示用户',
      inputLength: demoText.length,
      inputPreview: previewInput(demoText),
      inputHash: hash,
      score: result.score,
      passed: result.passed,
      blocked: result.blocked,
      issueCount: result.issues.length,
      totalHits: result.totalHits,
      durationMs: result.durationMs,
      source: req.source,
      businessRef: req.businessRef,
    });
    return result;
  }

  // 正常检查
  const result = runSandboxCheck(req.text);

  // 记录日志
  const hash = await hashInput(req.text);
  sandboxLogStore.record({
    user: '当前用户',
    inputLength: req.text.length,
    inputPreview: previewInput(req.text),
    inputHash: hash,
    score: result.score,
    passed: result.passed,
    blocked: result.blocked,
    issueCount: result.issues.length,
    totalHits: result.totalHits,
    durationMs: result.durationMs,
    source: req.source,
    businessRef: req.businessRef,
  });

  // 外部推送：阻断级合规告警
  if (result.blocked) {
    (async () => {
      const { dispatchSandboxCritical } = await import('@/services/notificationDispatchService');
      const { useNotificationStore } = await import('@/store/notificationStore');
      const { usePushChannelConfigStore } = await import('@/store/pushChannelConfigStore');

      // 1. 系统内通知
      const topRule = result.issues[0]?.ruleName || '阻断级合规违规';
      useNotificationStore.getState().addNotification({
        type: 'urgent',
        title: '合规沙箱检测到阻断级违规',
        content: `来源「${req.source}」：检测到 ${result.issues.length} 项阻断级违规（主要规则：${topRule}），已禁止提交/导出。`,
        action: [
          { label: '查看详情', key: 'view' },
          { label: '前往沙箱', key: 'sandbox' },
        ],
      });

      // 1.1 仿真联动：触发事件总线（Dashboard 风险卡片 +1）
      eventBus.emit('sandbox.blocked', {
        id: `sb_${Date.now()}`,
        title: req.source,
        matchedRules: result.issues.map((i) => i.ruleName),
      });

      // 2. 外部推送（钉钉/企微/邮件）
      const pushResult = await dispatchSandboxCritical({
        title: ` 合规告警：${req.source} 触发阻断级违规`,
        content: `${result.issues.length} 项阻断级违规，主要规则：${topRule}。评分 ${result.score.toFixed(1)}/5。已自动禁止业务提交/导出。`,
        link: '/sandbox',
      });
      if (pushResult.success || Object.values(pushResult.channelResults).some((r) => r?.ok)) {
        usePushChannelConfigStore.getState().recordSent('sandbox_critical');
      }
    })();
  }

  return result;
}

// ============================================================
// 2. getLog —— 获取历史记录（审计用）
// ============================================================

export async function getSandboxLogs(): Promise<ReturnType<typeof sandboxLogStore.list>> {
  await new Promise((r) => setTimeout(r, 200));
  return sandboxLogStore.list();
}

// ============================================================
// 3. exportLog —— 导出沙箱审计日志（CSV）
// ============================================================

export function exportSandboxLogCsv() {
  const logs = sandboxLogStore.list();
  const header = '时间戳,用户,输入预览(脱敏),输入长度,输入哈希,评分,是否通过,是否阻断,问题数,命中数,耗时(ms),来源\n';
  const rows = logs.map((l) =>
    [
      new Date(l.timestamp).toISOString(),
      l.user,
      `"${l.inputPreview.replace(/"/g, '""')}"`,
      l.inputLength,
      l.inputHash,
      l.score,
      l.passed ? '是' : '否',
      l.blocked ? '是' : '否',
      l.issueCount,
      l.totalHits,
      l.durationMs,
      l.source,
    ].join(',')
  );
  const csv = '\ufeff' + header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sandbox-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
