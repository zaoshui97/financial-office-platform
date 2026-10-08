/**
 * 本地屏幕共享 Hook
 *
 * 封装 navigator.mediaDevices.getDisplayMedia 的完整生命周期：
 * - start / stop 控制
 * - 自动在组件卸载时释放 stream
 * - 暴露 error 状态供 UI 提示
 * - 自动监听浏览器"停止共享"按钮（track.onended）
 *
 * 浏览器兼容性：
 * - Chrome / Edge / Firefox ✅
 * - Safari 16.4+ ✅（前缀 webkit）
 *
 * 注意：HTTP（非 localhost / 非 https）下 getDisplayMedia 在多数浏览器会被拒绝。
 * 开发用 127.0.0.1 / localhost 已经满足安全上下文；生产建议 HTTPS。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseScreenShareResult {
  stream: MediaStream | null;
  active: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
}

export function useScreenShare(): UseScreenShareResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // 防止 onended 与 stop 互相递归
  const stoppingRef = useRef(false);

  const stopTracks = useCallback((s: MediaStream | null) => {
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setActive(false);
    setError(null);
    // 下一帧重置（让 onended 退出）
    setTimeout(() => {
      stoppingRef.current = false;
    }, 0);
  }, [stopTracks]);

  const start = useCallback(async () => {
    setError(null);

    // 兼容性探测
    const md = navigator.mediaDevices as any;
    const gdm = md?.getDisplayMedia || md?.webkitGetDisplayMedia;
    if (typeof gdm !== 'function') {
      setError('当前浏览器不支持屏幕共享 API（请使用 Chrome / Edge / Firefox 或 Safari 16.4+）');
      setActive(false);
      return;
    }

    try {
      const s: MediaStream = await gdm.call(md, {
        video: {
          // 高质量优先；多数浏览器会忽略，由用户选择窗口决定
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false, // 共享系统声音会让用户额外点选；这里默认不共享
      });

      if (!s || s.getVideoTracks().length === 0) {
        setError('未能获取屏幕共享流');
        setActive(false);
        return;
      }

      // 监听用户从浏览器"停止共享"按钮触发的结束
      const track = s.getVideoTracks()[0];
      track.addEventListener('ended', () => {
        if (stoppingRef.current) return;
        // 用户主动点了系统级"停止共享"
        stop();
      });

      streamRef.current = s;
      setStream(s);
      setActive(true);
    } catch (e: any) {
      const name = e?.name as string | undefined;
      const msg = e?.message as string | undefined;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        // 用户在系统选窗上点了"取消"
        setError(null);
        setActive(false);
        return;
      }
      if (name === 'NotFoundError' || name === 'AbortError') {
        setError('未选择可共享的屏幕或窗口');
      } else if (name === 'NotReadableError') {
        setError('屏幕或窗口正被其他程序占用');
      } else if (name === 'SecurityError') {
        setError('当前页面不是安全上下文（HTTPS / localhost），无法共享屏幕');
      } else {
        setError(msg || '屏幕共享失败');
      }
      setActive(false);
    }
  }, [stop, stopTracks]);

  const toggle = useCallback(async () => {
    if (active) {
      stop();
    } else {
      await start();
    }
  }, [active, start, stop]);

  // 卸载时释放
  useEffect(() => {
    return () => {
      stopTracks(streamRef.current);
    };
  }, [stopTracks]);

  return { stream, active, error, start, stop, toggle };
}
