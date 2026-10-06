import React from 'react';
import { Dropdown, Button, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/i18n';

const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (lang: 'zh-CN' | 'en-US') => {
    changeLanguage(lang);
  };

  const menuItems = [
    {
      key: 'zh-CN',
      label: (
        <Space>
          <span>中</span>
          <span>{t('common.chinese')}</span>
        </Space>
      ),
      onClick: () => handleLanguageChange('zh-CN'),
    },
    {
      key: 'en-US',
      label: (
        <Space>
          <span>EN</span>
          <span>{t('common.english')}</span>
        </Space>
      ),
      onClick: () => handleLanguageChange('en-US'),
    },
  ];

  const currentLang = i18n.language === 'zh-CN' ? t('common.chinese') : 'EN';

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
      <Button type="text" icon={<GlobalOutlined />}>
        {currentLang}
      </Button>
    </Dropdown>
  );
};

export default LanguageSwitcher;
