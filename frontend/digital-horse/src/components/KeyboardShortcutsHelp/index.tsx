import React, { useState, useEffect } from 'react';
import { Modal, Typography, Divider, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import './index.css';

const { Title, Text } = Typography;

interface ShortcutItem {
  key: string;
  label: string;
  description: string;
  category: string;
}

const KeyboardShortcutsHelp: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleToggle = () => {
      setVisible((prev) => !prev);
    };

    document.addEventListener('toggle-shortcuts-help', handleToggle);
    return () => {
      document.removeEventListener('toggle-shortcuts-help', handleToggle);
    };
  }, []);

  const shortcuts: ShortcutItem[] = [
    // 全局
    { key: 'Ctrl+K', label: t('shortcut.globalSearch'), description: t('shortcut.globalSearchDesc'), category: t('shortcut.categoryGlobal') },
    { key: 'Ctrl+B', label: t('shortcut.toggleSidebar'), description: t('shortcut.toggleSidebarDesc'), category: t('shortcut.categoryGlobal') },
    { key: '?', label: t('shortcut.showHelp'), description: t('shortcut.showHelpDesc'), category: t('shortcut.categoryGlobal') },
    { key: 'ESC', label: t('shortcut.close'), description: t('shortcut.closeDesc'), category: t('shortcut.categoryGlobal') },

    // 导航
    { key: 'G → D', label: t('shortcut.goDashboard'), description: t('shortcut.goDashboardDesc'), category: t('shortcut.categoryNavigation') },
    { key: 'G → M', label: t('shortcut.goMeeting'), description: t('shortcut.goMeetingDesc'), category: t('shortcut.categoryNavigation') },
    { key: 'G → K', label: t('shortcut.goKnowledge'), description: t('shortcut.goKnowledgeDesc'), category: t('shortcut.categoryNavigation') },
    { key: 'G → Q', label: t('shortcut.goQA'), description: t('shortcut.goQADesc'), category: t('shortcut.categoryNavigation') },

    // 快捷操作
    { key: 'Ctrl+N', label: t('shortcut.newMeeting'), description: t('shortcut.newMeetingDesc'), category: t('shortcut.categoryAction') },
    { key: 'Ctrl+/', label: t('shortcut.openAI'), description: t('shortcut.openAIDesc'), category: t('shortcut.categoryAction') },
  ];

  const groupedShortcuts = shortcuts.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ShortcutItem[]>);

  return (
    <Modal
      title={
        <Space>
          <span style={{ fontSize: 20 }}>键盘</span>
          <span>{t('shortcut.title')}</span>
        </Space>
      }
      open={visible}
      onCancel={() => setVisible(false)}
      footer={null}
      style={{ width: 560, maxWidth: 'calc(100vw - 32px)' }}
      centered
      className="shortcuts-help-modal"
    >
      <div className="shortcuts-help-content">
        {Object.entries(groupedShortcuts).map(([category, items]) => (
          <div key={category} className="shortcuts-category">
            <div className="shortcuts-category-title">{category}</div>
            <div className="shortcuts-list">
              {items.map((item) => (
                <div key={item.key} className="shortcuts-item">
                  <div className="shortcuts-keys">
                    {item.key.split('→').map((k, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="shortcuts-arrow">→</span>}
                        <kbd>{k.trim()}</kbd>
                      </React.Fragment>
                    ))}
                  </div>
                  <Text className="shortcuts-desc">{item.description}</Text>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      <div className="shortcuts-footer">
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('shortcut.footer')}
        </Text>
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsHelp;
