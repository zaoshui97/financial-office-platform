import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import AppRouter from './router';
import i18n from './i18n';
import { bindDispatchLogToEventBus } from '@/store/dispatchLogStore';
import { bindCrossStoreBridge } from '@/services/crossStoreBridge';
import './styles/theme.css';
import 'antd/dist/reset.css';

// 仿真初始化：绑定事件总线 → dispatchLog / store 联动
// _eventBusBound / _bound 标志保证幂等，HMR 安全
bindDispatchLogToEventBus();
bindCrossStoreBridge();

// Ant Design 主题配置 - 金融高端商务风
const theme = {
  token: {
    colorPrimary: '#0F2B5B',
    colorSuccess: '#22A775',
    colorWarning: '#E69948',
    colorError: '#D64045',
    colorInfo: '#3B82F6',
    borderRadius: 6,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    colorBorder: '#E8EDF4',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F7F9FC',
  },
};

// 获取 Ant Design locale
const getAntdLocale = (lang: string) => {
  return lang === 'en-US' ? enUS : zhCN;
};

const App: React.FC = () => {
  const [locale, setLocale] = useState(getAntdLocale(i18n.language));

  useEffect(() => {
    // 监听 i18n 语言变化
    const handleLanguageChange = (lng: string) => {
      setLocale(getAntdLocale(lng));
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return (
    <ConfigProvider theme={theme} locale={locale}>
      <AppRouter />
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  // 临时关闭 StrictMode：dev 下双调用 effect 与 persist hydration 配合触发了
  // "Maximum update depth" 死循环（forceStoreRerender 调用栈）。
  // 待彻底排查 store hydration 时机后重新启用。
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
