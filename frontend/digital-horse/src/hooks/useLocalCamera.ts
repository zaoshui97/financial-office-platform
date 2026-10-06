/**
 * 本地摄像头 Hook
 *
 * 封装 navigator.mediaDevices.getUserMedia 的完整生命周期：
 * - enable / disable / toggle 控制
 * - 自动在组件卸载时释放摄像头
 * - 暴露 error 状态供 UI 提示
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseLocalCameraResult {
  stream: MediaStream | null;
  enabled: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => void;
  toggle: () => Promise<void>;
}

export function useLocalCamera(): UseLocalCameraResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback((s: MediaStream | null) => {
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const enable = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('当前浏览器不支持摄像头 API');
      setEnabled(false);
      return;
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
      setEnabled(true);
    } catch (e: any) {
      const msg = e?.message || '无法访问摄像头';
      // 区分最常见的两种情况
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setError('您拒绝了摄像头权限');
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        setError('未检测到可用摄像头');
      } else {
        setError(msg);
      }
      setEnabled(false);
    }
  }, []);

  const disable = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setEnabled(false);
    setError(null);
  }, [stopStream]);

  const toggle = useCallback(async () => {
    if (enabled) {
      disable();
    } else {
      await enable();
    }
  }, [enabled, enable, disable]);

  // 卸载时释放
  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
    };
  }, [stopStream]);

  return { stream, enabled, error, enable, disable, toggle };
}
