import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  id: string;
  type: 'knowledge' | 'meeting' | 'qa' | 'task';
  title: string;
  description?: string;
  matchScore?: number;
  timestamp?: string;
  url: string;
}

interface UseGlobalSearchReturn {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  isSearching: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  selectNext: () => void;
  selectPrev: () => void;
  confirmSelection: () => void;
}

// Mock 搜索数据
const mockData: SearchResult[] = [
  {
    id: 'k1',
    type: 'knowledge',
    title: '年假如何计算',
    description: '员工手册 - 假期管理制度',
    matchScore: 96,
    url: '/knowledge',
  },
  {
    id: 'k2',
    type: 'knowledge',
    title: '预算申请流程',
    description: '财务制度 - 预算管理办法',
    matchScore: 89,
    url: '/knowledge',
  },
  {
    id: 'k3',
    type: 'knowledge',
    title: '差旅费用报销标准',
    description: '财务制度 - 费用报销指引',
    matchScore: 85,
    url: '/knowledge',
  },
  {
    id: 'm1',
    type: 'meeting',
    title: '2026年Q4预算审批会议',
    description: '7月24日 14:00',
    timestamp: '3天前',
    url: '/meeting/m1',
  },
  {
    id: 'm2',
    type: 'meeting',
    title: '产品评审会 - 技术方案讨论',
    description: '7月20日 10:00',
    timestamp: '上周',
    url: '/meeting/m2',
  },
  {
    id: 'q1',
    type: 'qa',
    title: '预算申请的流程是什么？',
    description: 'AI 回答：预算申请需要经过部门负责人审批...',
    timestamp: '昨天',
    url: '/approval',
  },
  {
    id: 'q2',
    type: 'qa',
    title: '如何申请年假？',
    description: 'AI 回答：员工累计工作已满1年不满10年的...',
    timestamp: '3天前',
    url: '/approval',
  },
  {
    id: 't1',
    type: 'task',
    title: '财务部预算审批',
    description: '待办 · 2天后到期',
    url: '/dashboard',
  },
  {
    id: 't2',
    type: 'task',
    title: '完成缓存方案详细设计',
    description: '待办 · 今天到期',
    url: '/dashboard',
  },
];

export function useGlobalSearch(): UseGlobalSearchReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // 搜索逻辑
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    // 模拟搜索延迟
    setTimeout(() => {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = mockData.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.description?.toLowerCase().includes(lowerQuery)
      );
      setResults(filtered);
      setSelectedIndex(0);
      setIsSearching(false);
    }, 150);
  }, []);

  // 防抖处理
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 200);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }

      // ESC 关闭
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
  }, []);

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
  }, [results.length]);

  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const confirmSelection = useCallback(() => {
    if (results[selectedIndex]) {
      navigate(results[selectedIndex].url);
      closeSearch();
    }
  }, [results, selectedIndex, navigate, closeSearch]);

  return {
    isOpen,
    query,
    results,
    selectedIndex,
    isSearching,
    openSearch,
    closeSearch,
    setQuery,
    selectNext,
    selectPrev,
    confirmSelection,
  };
}
