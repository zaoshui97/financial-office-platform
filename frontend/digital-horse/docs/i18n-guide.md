# 国际化 (i18n) 开发规范

## 目的

确保应用支持中英文切换，所有 UI 文案都能正确国际化。

## 规范

### 1. 硬编码中文禁止

**禁止**在组件代码中硬编码中文字符串：

```tsx
//  错误
<span>中文内容</span>
<Button>确定</Button>
<Input placeholder="请输入" />

//  正确
<span>{t('common.example')}</span>
<Button>{t('common.confirm')}</Button>
<Input placeholder={t('common.inputPlaceholder')} />
```

### 2. 使用 t() 函数

所有 UI 文案必须使用 `useTranslation` hook：

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <span>{t('common.welcome')}</span>
      <Button>{t('common.submit')}</Button>
    </div>
  );
};
```

### 3. 翻译 key 命名规范

使用 `模块.功能` 的命名方式：

| 页面 | key 前缀 | 示例 |
|------|----------|------|
| 通用 | `common.` | `common.confirm`, `common.cancel` |
| 布局 | `layout.` | `layout.header`, `layout.sidebar` |
| 工作台 | `dashboard.` | `dashboard.welcome` |
| 会议 | `meeting.` | `meeting.title`, `meeting.pending` |
| 智能问答 | `qa.` | `qa.placeholder` |
| 知识库 | `knowledge.` | `knowledge.search` |

### 4. Mock 数据国际化

Mock 数据使用三元表达式：

```tsx
import i18n from '@/i18n';

// 语言感知的 mock 数据
const getMockData = () => {
  const isZh = i18n.language === 'zh-CN';
  return {
    title: isZh ? '中文标题' : 'English Title',
    description: isZh ? '中文描述' : 'English Description',
  };
};

// 组件中使用
const [data, setData] = useState(getMockData());

// 监听语言变化
useEffect(() => {
  const handleLanguageChange = () => {
    setData(getMockData());
  };
  i18n.on('languageChanged', handleLanguageChange);
  return () => {
    i18n.off('languageChanged', handleLanguageChange);
  };
}, []);
```

### 5. 动态语言切换

**必须使用封装的函数**：

```tsx
//  错误
import i18n from '@/i18n';
i18n.changeLanguage('en-US');

//  正确
import { changeLanguage } from '@/i18n';
changeLanguage('en-US');
```

### 6. Ant Design 组件

Ant Design 组件的语言跟随 `ConfigProvider` 自动切换，无需额外处理。

## 检查工具

### 运行检查

```bash
npm run i18n:check
```

### Git Hook（自动检查）

提交代码前会自动运行 i18n 检查。如果检查失败，需要修复后才能提交。

## 添加新翻译

1. 在 `src/i18n/locales/zh-CN.json` 添加中文翻译
2. 在 `src/i18n/locales/en-US.json` 添加英文翻译
3. 确保两个文件的 key 完全一致

```json
// zh-CN.json
{
  "common": {
    "newFeature": "新功能"
  }
}

// en-US.json
{
  "common": {
    "newFeature": "New Feature"
  }
}
```

## 常见问题

### Q: 日期格式需要国际化吗？

A: 日期格式由业务决定。如果需要国际化，可以使用日期库的 locale 功能。

### Q: 后端返回的数据需要翻译吗？

A: 后端数据（如文档内容）通常不需要前端翻译。如果需要，应该在后端处理多语言。

### Q: 用户输入的内容需要翻译吗？

A: 不需要。用户输入的是业务数据，存储在数据库中。

## 维护

如果发现某个页面有硬编码中文但被忽略了，请更新 `scripts/check-i18n.js` 中的 `SKIP_PATTERNS` 数组。
