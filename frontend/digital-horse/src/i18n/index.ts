/**
 * 国际化系统初始化 —— "严格准则"的工程实现
 *
 * 设计目标：
 * 1) 静态校验 zh-CN 与 en-US JSON 结构完全一致（key、嵌套层级必须对齐）
 * 2) 缺失 key 在 dev 环境直接 console.error，prod 环境 fallback 到 key 本身（便于发现）
 * 3) 切换语言时强制同步触发 React 树刷新
 * 4) 任何调用方不允许直接 `t('auto.2')`，必须通过 t() 或本文件 `appText()` 工具
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

// ============================================================
// 1. 启动期静态校验：两个语言的 key 结构必须完全一致
// ============================================================

function getKeyPaths(obj: any, prefix = ''): string[] {
  if (obj === null || obj === undefined) return [prefix];
  if (typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  const out: string[] = [];
  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(...getKeyPaths(obj[k], path));
  }
  return out;
}

const zhKeys = new Set(getKeyPaths(zhCN));
const enKeys = new Set(getKeyPaths(enUS));

const onlyZh = [...zhKeys].filter((k) => !enKeys.has(k));
const onlyEn = [...enKeys].filter((k) => !zhKeys.has(k));

if (onlyZh.length > 0 || onlyEn.length > 0) {
  const msg =
    '[i18n] 启动失败：zh-CN 与 en-US JSON 结构不一致。\n' +
    (onlyZh.length ? `  仅 zh-CN 存在: ${onlyZh.join(', ')}\n` : '') +
    (onlyEn.length ? `  仅 en-US 存在: ${onlyEn.join(', ')}\n` : '') +
    '请补齐缺失的 key 后再启动。';
  // 启动期硬错误：打到 console，让浏览器 dev server 立刻看到
  // eslint-disable-next-line no-console
  console.error(msg);
  throw new Error(msg);
}

// ============================================================
// 2. 初始化
// ============================================================

const SAVED_KEY = 'app_language';

const getSavedLanguage = (): 'zh-CN' | 'en-US' => {
  try {
    const saved = localStorage.getItem(SAVED_KEY);
    if (saved === 'zh-CN' || saved === 'en-US') return saved;
  } catch {
    /* localStorage 不可用时降级 */
  }
  const browserLang = typeof navigator !== 'undefined' ? navigator.language : 'zh-CN';
  return browserLang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: 'zh-CN',
    fallbackLng: 'zh-CN', // 锁定中文阶段，缺 key 时回退到 zh-CN 而非英文
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
    returnEmptyString: false,
    react: {
      useSuspense: false,
    },
    saveMissing: false,
    parseMissingKeyHandler: (key) => {
      // 缺 key 时打印警告而不是返回空字符串，方便发现
      // eslint-disable-next-line no-console
      console.warn(`[i18n] 缺失 key: "${key}"`);
      return key;
    },
  });

// ============================================================
// 3. 对外 API
// ============================================================

export type SupportedLanguage = 'zh-CN' | 'en-US';
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['zh-CN', 'en-US'];

export const changeLanguage = (lang: SupportedLanguage) => {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    // eslint-disable-next-line no-console
    console.error(`[i18n] 不支持的语言: ${lang}`);
    return;
  }
  try {
    localStorage.setItem(SAVED_KEY, lang);
  } catch {
    /* ignore */
  }
  i18n.changeLanguage(lang);
  // 通知订阅者（用于非 React 场景刷新）
  document.dispatchEvent(new CustomEvent('app-language-change', { detail: lang }));
};

export const getCurrentLanguage = (): SupportedLanguage => {
  return (i18n.language as SupportedLanguage) || 'zh-CN';
};

/** 当前是否为中文（禁止在业务组件里再写 isZh 三元，硬要走 t()） */
export const isZh = () => getCurrentLanguage() === 'zh-CN';

// ============================================================
// 4. 强类型 helper：消除组件内 isZh 三元 bug
//    使用：appText(isZh(), '登录成功', 'Login Success')
// ============================================================
export const appText = <T>(isChinese: boolean, zh: T, en: T): T =>
  isChinese ? zh : en;

export default i18n;
