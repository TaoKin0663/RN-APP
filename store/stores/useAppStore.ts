import type { StateCreator } from 'zustand';

/**
 * 应用主题类型
 */
export type AppTheme = 'light' | 'dark' | 'auto';

/**
 * 应用状态接口
 */
interface AppState {
  // 主题模式
  theme: AppTheme;
  // 是否首次启动
  isFirstLaunch: boolean;
  // 语言设置
  language: string;
  // 网络状态
  isOnline: boolean;
  // 是否显示引导页
  showOnboarding: boolean;
  // 当前选中的 Safe 地址
  selectedSafeAddress: string | null;
}

/**
 * 应用操作接口
 */
interface AppActions {
  // 设置主题
  setTheme: (theme: AppTheme) => void;
  // 设置首次启动状态
  setFirstLaunch: (isFirstLaunch: boolean) => void;
  // 设置语言
  setLanguage: (language: string) => void;
  // 设置网络状态
  setIsOnline: (isOnline: boolean) => void;
  // 设置引导页显示状态
  setShowOnboarding: (show: boolean) => void;
  // 重置应用设置（保留主题等基本设置）
  resetAppSettings: () => void;
  // 设置当前选中的 Safe 地址
  setSelectedSafeAddress: (address: string | null) => void;
}

const initialState: AppState = {
  theme: 'auto',
  isFirstLaunch: true,
  language: 'zh-CN',
  isOnline: true,
  showOnboarding: true,
  selectedSafeAddress: null,
};

/**
 * 应用全局Store（纯状态管理，不包含持久化）
 */
export const useAppStore: StateCreator<AppState & AppActions> = (set) => ({
  ...initialState,

  // 设置主题
  setTheme: (theme) => {
    set({ theme });
  },

  // 设置首次启动状态
  setFirstLaunch: (isFirstLaunch) => {
    set({ isFirstLaunch });
  },

  // 设置语言
  setLanguage: (language) => {
    set({ language });
  },

  // 设置网络状态
  setIsOnline: (isOnline) => {
    set({ isOnline });
  },

  // 设置引导页显示状态
  setShowOnboarding: (show) => {
    set({ showOnboarding: show });
  },

  // 重置应用设置
  resetAppSettings: () => {
    set({
      isFirstLaunch: true,
      showOnboarding: true,
    });
  },

  // 设置当前选中的 Safe 地址
  setSelectedSafeAddress: (address) => {
    set({ selectedSafeAddress: address });
  },
});

