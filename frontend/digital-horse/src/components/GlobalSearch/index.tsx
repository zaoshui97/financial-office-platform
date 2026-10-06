import React, { useEffect, useRef, useState } from 'react';
import { Input, Spin, Typography, Empty } from 'antd';
import {
  SearchOutlined,
  FileTextOutlined,
  CalendarOutlined,
  MessageOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EnterOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './index.css';

interface SearchResult {
  id: string;
  type: 'knowledge' | 'meeting' | 'qa' | 'task';
  title: string;
  description?: string;
  matchScore?: number;
  timestamp?: string;
  url: string;
}

interface GlobalSearchProps {
  open: boolean;
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  isSearching: boolean;
  onQueryChange: (query: string) => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

const { Text } = Typography;

const getTypeIcon = (type: SearchResult['type']) => {
  switch (type) {
    case 'knowledge':
      return <FileTextOutlined style={{ color: '#22A775' }} />;
    case 'meeting':
      return <CalendarOutlined style={{ color: '#3B82F6' }} />;
    case 'qa':
      return <MessageOutlined style={{ color: '#C9A459' }} />;
    case 'task':
      return <CheckSquareOutlined style={{ color: '#E69948' }} />;
  }
};

const getTypeLabel = (type: SearchResult['type'], t: (key: string) => string) => {
  switch (type) {
    case 'knowledge':
      return t('nav.knowledge');
    case 'meeting':
      return t('nav.meeting');
    case 'qa':
      return t('nav.qa');
    case 'task':
      return t('dashboard.pendingTasks');
  }
};

const GlobalSearch: React.FC<GlobalSearchProps> = ({
  open,
  query,
  results,
  selectedIndex,
  isSearching,
  onQueryChange,
  onSelectNext,
  onSelectPrev,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<any>(null);
  const [localQuery, setLocalQuery] = useState(query);

  // 自动聚焦
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // 同步外部 query
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // 键盘事件处理
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onSelectNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelectPrev();
          break;
        case 'Enter':
          e.preventDefault();
          onConfirm();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onSelectNext, onSelectPrev, onConfirm]);

  if (!open) return null;

  // 按类型分组
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  let globalIndex = -1;

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-container" onClick={(e) => e.stopPropagation()}>
        {/* 搜索输入框 */}
        <div className="global-search-header">
          <SearchOutlined className="global-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder={t('topbar.searchPlaceholder')}
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              onQueryChange(e.target.value);
            }}
          />
          {isSearching ? (
            <Spin indicator={<LoadingOutlined spin style={{ fontSize: 16 }} />} size="small" />
          ) : localQuery ? (
            <CloseOutlined
              className="global-search-clear"
              onClick={() => {
                setLocalQuery('');
                onQueryChange('');
              }}
            />
          ) : (
            <span className="global-search-shortcut">ESC</span>
          )}
        </div>

        {/* 搜索结果 */}
        <div className="global-search-results">
          {!localQuery ? (
            <div className="global-search-hint">
              <div className="global-search-hint-title">{t('topbar.aiSearchTip')}</div>
              <div className="global-search-hint-shortcuts">
                <div className="global-search-shortcut-item">
                  <kbd>↑</kbd><kbd>↓</kbd> <span>{t('common.navigate')}</span>
                </div>
                <div className="global-search-shortcut-item">
                  <kbd>↵</kbd> <span>{t('common.confirm')}</span>
                </div>
                <div className="global-search-shortcut-item">
                  <kbd>esc</kbd> <span>{t('common.cancel')}</span>
                </div>
              </div>
            </div>
          ) : results.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: 'var(--color-text-hint)' }}>
                  未找到相关结果
                </span>
              }
            />
          ) : (
            Object.entries(groupedResults).map(([type, items]) => (
              <div key={type} className="global-search-group">
                <div className="global-search-group-title">
                  {getTypeIcon(type as SearchResult['type'])}
                  <span>{getTypeLabel(type as SearchResult['type'], t)}</span>
                </div>
                {items.map((result) => {
                  globalIndex++;
                  const isSelected = globalIndex === selectedIndex;
                  return (
                    <div
                      key={result.id}
                      className={`global-search-result-item ${isSelected ? 'selected' : ''}`}
                      onClick={onConfirm}
                      data-index={globalIndex}
                    >
                      <div className="global-search-result-main">
                        <Text strong className="global-search-result-title">
                          {result.title}
                        </Text>
                        {result.description && (
                          <Text type="secondary" className="global-search-result-desc">
                            {result.description}
                          </Text>
                        )}
                      </div>
                      <div className="global-search-result-meta">
                        {result.matchScore && (
                          <span className="global-search-match-score">
                            {result.matchScore}%
                          </span>
                        )}
                        {result.timestamp && (
                          <span className="global-search-timestamp">
                            <ClockCircleOutlined /> {result.timestamp}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 底部快捷键提示 */}
        {localQuery && results.length > 0 && (
          <div className="global-search-footer">
            <div className="global-search-footer-item">
              <ArrowUpOutlined /><ArrowDownOutlined /> {t('common.navigate')}
            </div>
            <div className="global-search-footer-item">
              <EnterOutlined /> {t('common.confirm')}
            </div>
            <div className="global-search-footer-item">
              <kbd>esc</kbd> {t('common.cancel')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearch;
