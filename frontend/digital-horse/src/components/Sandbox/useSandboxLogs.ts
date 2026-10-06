/**
 * useSandboxLogs —— 沙箱历史 Hook
 */

import { useState, useCallback } from 'react';
import { getSandboxLogs, exportSandboxLogCsv } from '@/services/sandbox/sandboxApiContract';
import type { SandboxLogEntry } from '@/services/sandbox/sandboxLog';

export function useSandboxLogs() {
  const [logs, setLogs] = useState<SandboxLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSandboxLogs();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { logs, loading, refresh, exportCsv: exportSandboxLogCsv };
}
