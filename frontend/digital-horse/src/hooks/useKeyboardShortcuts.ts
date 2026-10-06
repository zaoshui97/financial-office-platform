import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutConfig {
  key: string;
  description: string;
  action: () => void;
  scope?: 'global' | 'dashboard' | 'meeting' | 'qa';
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const sequenceRef = useRef<{ key: string; timeout: ReturnType<typeof setTimeout> } | null>(null);

  const shortcuts: ShortcutConfig[] = [
    // 全局快捷键
    {
      key: 'ctrl+k',
      description: 'globalSearch',
      action: () => {
        document.dispatchEvent(new CustomEvent('open-global-search'));
      },
      scope: 'global',
    },
    {
      key: 'ctrl+b',
      description: 'toggleSidebar',
      action: () => {
        document.dispatchEvent(new CustomEvent('toggle-sidebar'));
      },
      scope: 'global',
    },
    {
      key: 'g d',
      description: 'goDashboard',
      action: () => navigate('/dashboard'),
      scope: 'global',
    },
    {
      key: 'g m',
      description: 'goMeeting',
      action: () => navigate('/meeting'),
      scope: 'global',
    },
    {
      key: 'g k',
      description: 'goKnowledge',
      action: () => navigate('/knowledge'),
      scope: 'global',
    },
    {
      key: 'g q',
      description: 'goQA',
      action: () => navigate('/meeting'),
      scope: 'global',
    },
    {
      key: '?',
      description: 'showHelp',
      action: () => {
        document.dispatchEvent(new CustomEvent('toggle-shortcuts-help'));
      },
      scope: 'global',
    },
    // 页面级快捷键
    {
      key: 'ctrl+n',
      description: 'newMeeting',
      action: () => {
        document.dispatchEvent(new CustomEvent('open-new-meeting-modal'));
      },
      scope: 'meeting',
    },
  ];

  const matchShortcut = useCallback(
    (pressedKey: string, shortcutKey: string): boolean => {
      const pressed = pressedKey.toLowerCase().trim();
      const shortcut = shortcutKey.toLowerCase().trim();

      // 单键匹配
      if (!shortcut.includes(' ')) {
        return pressed === shortcut;
      }

      // 组合键匹配
      const parts = shortcut.split(' ');
      return pressed === parts[parts.length - 1];
    },
    []
  );

  useEffect(() => {
    let lastKey = '';

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // 但允许特定快捷键
        if (!(e.ctrlKey || e.metaKey) && e.key !== 'Escape') {
          return;
        }
      }

      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // ESC 始终可用
      if (key === 'escape') {
        e.preventDefault();
        return;
      }

      // Ctrl/Cmd + 组合键
      if (ctrlOrMeta) {
        e.preventDefault();
        const shortcut = shortcuts.find(
          (s) => s.key.startsWith('ctrl+') && s.key.slice(6) === key
        );
        if (shortcut) {
          shortcut.action();
          return;
        }
      }

      // 序列快捷键（如 g d）
      if (!ctrlOrMeta && !e.shiftKey && !e.altKey) {
        const sequence = `${lastKey} ${key}`;

        const sequenceShortcut = shortcuts.find((s) => s.key === sequence);
        if (sequenceShortcut) {
          e.preventDefault();
          sequenceShortcut.action();
          lastKey = '';
          return;
        }

        // 检查是否是一段序列的开始（如 'g'）
        if (
          ['g'].includes(key) &&
          target.tagName !== 'INPUT' &&
          target.tagName !== 'TEXTAREA' &&
          !target.isContentEditable
        ) {
          // 清除之前的序列超时
          if (sequenceRef.current) {
            clearTimeout(sequenceRef.current.timeout);
          }

          // 设置新的序列超时
          sequenceRef.current = {
            key,
            timeout: setTimeout(() => {
              lastKey = '';
              sequenceRef.current = null;
            }, 500),
          };
        }

        lastKey = key;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (sequenceRef.current) {
        clearTimeout(sequenceRef.current.timeout);
      }
    };
  }, [shortcuts]);

  return { shortcuts };
}

export const shortcutDescriptions: Record<string, string> = {
  'ctrl+k': 'Ctrl+K',
  'ctrl+b': 'Ctrl+B',
  'ctrl+n': 'Ctrl+N',
  'ctrl+/': 'Ctrl+/',
  'g d': 'G then D',
  'g m': 'G then M',
  'g k': 'G then K',
  'g q': 'G then Q',
  '?': '?',
  esc: 'ESC',
};
