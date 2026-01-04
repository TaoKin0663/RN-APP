import { StateStorage, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Zustand持久化存储适配器 - 适配React Native的AsyncStorage
 */
export const asyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      console.error(`[Store] Failed to get item "${name}":`, error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      console.error(`[Store] Failed to set item "${name}":`, error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.error(`[Store] Failed to remove item "${name}":`, error);
    }
  },
};

/**
 * 创建持久化存储配置
 * @param storageKey 存储键名
 * @param options 可选的配置选项
 */
export const createPersistStorage = <T>(storageKey: string, options?: {
  /** 需要持久化的字段白名单，如果为空则持久化全部 */
  partialize?: (state: T) => Partial<T>;
  /** 版本号，用于数据迁移 */
  version?: number;
}) => {
  return {
    name: storageKey,
    storage: createJSONStorage(() => asyncStorage),
    partialize: options?.partialize,
    version: options?.version ?? 1,
  };
};

/**
 * Store存储键名常量
 */
export const STORAGE_KEYS = {
  USER: 'user-store',
  APP: 'app-store',
} as const;

