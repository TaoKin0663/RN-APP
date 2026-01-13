import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { createJSONStorage } from 'zustand/middleware';
import { asyncStorage, STORAGE_KEYS } from './config';
import { useUserStore as userStoreCreator } from './stores/useUserStore';
import { useAppStore as appStoreCreator } from './stores/useAppStore';

/**
 * 统一持久化配置
 * 在这里管理所有 store 的缓存策略
 */

/**
 * 应用持久化中间件
 * @param storeCreator Store创建函数
 * @param persistConfig 持久化配置
 */
function withPersist<T>(
  storeCreator: StateCreator<T, [], [], T>,
  persistConfig: {
    name: string;
    storageKey: string;
    partialize?: (state: T) => Partial<T>;
    version?: number;
  }
) {
  return create<T>()(
    devtools(
      persist(storeCreator, {
        name: persistConfig.storageKey,
        storage: createJSONStorage(() => asyncStorage),
        partialize: persistConfig.partialize,
        version: persistConfig.version ?? 1,
      }),
      {
        name: persistConfig.name,
        enabled: __DEV__,
      }
    )
  );
}

/**
 * 用户Store（带持久化）
 */
export const useUserStore = withPersist(userStoreCreator, {
  name: 'UserStore',
  storageKey: STORAGE_KEYS.USER,
  partialize: (state) => ({
    userInfo: state.userInfo,
    isLoggedIn: state.isLoggedIn,
    token: state.token,
  }),
});

/**
 * 应用Store（带持久化）
 */
export const useAppStore = withPersist(appStoreCreator, {
  name: 'AppStore',
  storageKey: STORAGE_KEYS.APP,
  partialize: (state) => ({
    theme: state.theme,
    language: state.language,
    isFirstLaunch: state.isFirstLaunch,
    showOnboarding: state.showOnboarding,
    selectedSafeAddress: state.selectedSafeAddress,
  }),
});

