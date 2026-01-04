# Store 状态管理

基于 [Zustand](https://zustand-demo.pmnd.rs/) 封装的状态管理方案，专为 React Native 优化。

## 特性

- 🚀 **简单易用** - API 直观，学习成本低
- 📦 **轻量级** - 只有 1-2KB，无依赖
- 🔄 **持久化** - 自动与 AsyncStorage 集成
- 🛠️ **开发工具** - 内置 Redux DevTools 支持
- 💪 **TypeScript** - 完整的类型支持
- ⚡ **高性能** - 支持细粒度订阅，避免不必要的重渲染

## 目录结构

```
store/
├── config.ts          # 基础配置（AsyncStorage适配器等）
├── types.ts           # 通用类型定义
├── persist.ts         # 统一持久化配置（缓存管理）
├── stores/            # 纯状态管理模块（独立模块）
│   ├── useUserStore.ts    # 用户状态
│   └── useAppStore.ts     # 应用全局状态
├── index.ts           # 统一导出
└── README.md          # 文档
```

### 架构说明

- **stores/** - 纯状态管理模块，每个 store 都是独立的，只定义状态和操作，不包含持久化逻辑
- **persist.ts** - 统一管理所有 store 的持久化（缓存）配置，集中处理缓存策略
- **index.ts** - 统一导出所有 store 和类型，外部使用时只需从这里导入

## 快速开始

### 1. 基本使用

```tsx
import { useUserStore, useAppStore } from '@/store';

function MyComponent() {
  // 获取整个store
  const { userInfo, isLoggedIn, login } = useUserStore();
  const { theme, setTheme } = useAppStore();
  
  return (
    <View>
      <Text>用户名: {userInfo?.username}</Text>
      <Text>当前主题: {theme}</Text>
      <Button onPress={() => setTheme('dark')} title="切换主题" />
    </View>
  );
}
```

### 2. 性能优化 - 细粒度订阅

只订阅需要的状态，避免不必要的重渲染：

```tsx
import { useUserStore } from '@/store';

function LoginButton() {
  // 只订阅 isLoggedIn，其他状态变化不会触发重渲染
  const isLoggedIn = useUserStore(state => state.isLoggedIn);
  const login = useUserStore(state => state.login);
  
  return (
    <Button 
      onPress={() => login(userInfo, token)} 
      title={isLoggedIn ? '已登录' : '登录'}
    />
  );
}
```

### 3. 组合选择器

如果需要订阅多个字段，使用组合选择器：

```tsx
import { useAppStore } from '@/store';

function Settings() {
  // 一次性选择多个字段
  const { theme, language, setTheme, setLanguage } = useAppStore(state => ({
    theme: state.theme,
    language: state.language,
    setTheme: state.setTheme,
    setLanguage: state.setLanguage,
  }));
  
  return (
    <View>
      <Text>主题: {theme}</Text>
      <Text>语言: {language}</Text>
    </View>
  );
}
```

### 4. 在组件外使用

```tsx
import { useUserStore } from '@/store';

// 在非React组件中使用（如API服务）
const store = useUserStore.getState();
store.login(userInfo, token);

// 订阅变化（在非React环境中）
const unsubscribe = useUserStore.subscribe(
  (state) => state.isLoggedIn,
  (isLoggedIn) => {
    console.log('登录状态更新:', isLoggedIn);
  }
);
```

## 创建新的 Store

### 1. 在 stores/ 目录下创建纯状态管理模块

```tsx
// store/stores/useMyStore.ts
import type { StateCreator } from 'zustand';

interface MyState {
  count: number;
  name: string;
}

interface MyActions {
  increment: () => void;
  setName: (name: string) => void;
  reset: () => void;
}

const initialState: MyState = {
  count: 0,
  name: '',
};

/**
 * 我的Store（纯状态管理，不包含持久化）
 */
export const useMyStore: StateCreator<MyState & MyActions> = (set, get) => ({
  ...initialState,

  increment: () => {
    set((state) => ({ count: state.count + 1 }));
  },

  setName: (name) => {
    set({ name });
  },

  reset: () => {
    set(initialState);
  },
});
```

### 2. 在 persist.ts 中添加持久化配置

```tsx
// store/persist.ts
import { useMyStore as myStoreCreator } from './stores/useMyStore';

// 在 persist.ts 中添加
export const useMyStore = withPersist(myStoreCreator, {
  name: 'MyStore',
  storageKey: STORAGE_KEYS.MY, // 需要在 config.ts 的 STORAGE_KEYS 中添加
  partialize: (state) => ({
    name: state.name, // 只持久化name，不持久化count
  }),
});
```

### 3. 在 config.ts 中添加存储键名（如需要）

```tsx
// store/config.ts
export const STORAGE_KEYS = {
  // ... 其他键名
  MY: 'my-store',
} as const;
```

### 4. 在 index.ts 中导出（可选，如需要导出类型）

```tsx
// store/index.ts
// Store 已通过 persist.ts 统一导出，无需额外操作
// 如需导出类型，可添加：
// export type { MyState } from './stores/useMyStore';
```

## Store 列表

### useUserStore - 用户状态

管理用户相关状态，包括：
- `userInfo`: 用户信息
- `isLoggedIn`: 是否已登录
- `token`: 认证Token
- `loading`: 加载状态

### useAppStore - 应用全局状态

管理应用全局配置，包括：
- `theme`: 主题模式（light/dark/auto）
- `language`: 语言设置
- `isFirstLaunch`: 是否首次启动
- `isOnline`: 网络状态
- `showOnboarding`: 是否显示引导页

## 最佳实践

1. **细粒度订阅** - 只订阅组件需要的状态，提升性能
2. **类型安全** - 充分利用 TypeScript 的类型检查
3. **持久化策略** - 合理选择需要持久化的字段，避免存储过多数据
4. **错误处理** - 在store操作中添加适当的错误处理
5. **异步操作** - 对于异步操作，使用专门的action处理

## 注意事项

- 持久化数据会自动保存到 AsyncStorage，确保存储键名唯一
- 开发环境下会自动启用 Redux DevTools
- 如果需要数据迁移，可以在 `createPersistStorage` 中指定 `version`

## 参考资源

- [Zustand 官方文档](https://zustand-demo.pmnd.rs/)
- [Zustand GitHub](https://github.com/pmndrs/zustand)

