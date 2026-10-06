/**
 * 格式化日期
 * @param date - Date 对象或日期字符串
 * @param format - 格式化模板，默认为 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | string | number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

/**
 * 生成唯一ID
 * @param prefix - ID前缀，默认为空
 * @returns 唯一ID字符串
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  const randomStr2 = Math.random().toString(36).substring(2, 6);

  return prefix ? `${prefix}_${timestamp}${randomStr}${randomStr2}` : `${timestamp}${randomStr}${randomStr2}`;
}

/**
 * 格式化相对时间
 * @param date - Date 对象或日期字符串
 * @param t - 可选的翻译函数，用于 i18n
 * @returns 相对时间字符串
 */
export function formatRelativeTime(date: Date | string | number, t?: (key: string) => string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const justNow = t ? t('common.justNow') : '刚刚';
  const minutesAgo = t ? t('common.minutesAgo', { count: minutes }) : `${minutes} 分钟前`;
  const hoursAgo = t ? t('common.hoursAgo', { count: hours }) : `${hours} 小时前`;
  const daysAgo = t ? t('common.daysAgo', { count: days }) : `${days} 天前`;

  if (seconds < 60) {
    return justNow;
  } else if (minutes < 60) {
    return minutesAgo;
  } else if (hours < 24) {
    return hoursAgo;
  } else if (days < 7) {
    return daysAgo;
  } else {
    return formatDate(d, 'YYYY-MM-DD');
  }
}

/**
 * 截断文本
 * @param text - 原始文本
 * @param maxLength - 最大长度
 * @param suffix - 截断后缀，默认为 '...'
 * @returns 截断后的文本
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + suffix;
}
