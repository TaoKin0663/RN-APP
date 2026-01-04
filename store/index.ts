/**
 * Store统一导出
 * 
 * 使用示例：
 * 
 * ```tsx
 * // 导入需要的store
 * import { useUserStore, useAppStore } from '@/store';
 * 
 * // 在组件中使用
 * function MyComponent() {
 *   const { userInfo, isLoggedIn } = useUserStore();
 *   const { theme } = useAppStore();
 *   
 *   // 只订阅部分状态（性能优化）
 *   const isLoggedIn = useUserStore(state => state.isLoggedIn);
 *   
 *   return <View>...</View>;
 * }
 * ```
 */

// 导出所有store（已包含持久化配置）
export { useUserStore, useAppStore } from './persist';

// 导出类型
export type { UserInfo } from './stores/useUserStore';
export type { AppTheme } from './stores/useAppStore';
export type { BaseState } from './types';

// 导出配置
export { asyncStorage, STORAGE_KEYS } from './config';

