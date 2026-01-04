import { create } from 'zustand';
import type { StateCreator } from 'zustand';

/**
 * 用户信息接口
 */
export interface UserInfo {
  id: string;
  username?: string;
  email?: string;
  avatar?: string;
  walletAddress?: string;
  [key: string]: any;
}

/**
 * 用户状态接口
 */
interface UserState {
  // 用户信息
  userInfo: UserInfo | null;
  // 是否已登录
  isLoggedIn: boolean;
  // Token
  token: string | null;
  // 加载状态
  loading: boolean;
}

/**
 * 用户操作接口
 */
interface UserActions {
  // 设置用户信息
  setUserInfo: (userInfo: UserInfo | null) => void;
  // 登录
  login: (userInfo: UserInfo, token: string) => void;
  // 登出
  logout: () => void;
  // 更新用户信息
  updateUserInfo: (partialInfo: Partial<UserInfo>) => void;
  // 设置Token
  setToken: (token: string | null) => void;
  // 设置加载状态
  setLoading: (loading: boolean) => void;
  // 重置状态
  reset: () => void;
}

const initialState: UserState = {
  userInfo: null,
  isLoggedIn: false,
  token: null,
  loading: false,
};

/**
 * 用户Store（纯状态管理，不包含持久化）
 */
export const useUserStore: StateCreator<UserState & UserActions> = (set, get) => ({
  ...initialState,

  // 设置用户信息
  setUserInfo: (userInfo) => {
    set({ userInfo, isLoggedIn: !!userInfo });
  },

  // 登录
  login: (userInfo, token) => {
    set({
      userInfo,
      token,
      isLoggedIn: true,
    });
  },

  // 登出
  logout: () => {
    set(initialState);
  },

  // 更新用户信息
  updateUserInfo: (partialInfo) => {
    const { userInfo } = get();
    if (userInfo) {
      set({ userInfo: { ...userInfo, ...partialInfo } });
    }
  },

  // 设置Token
  setToken: (token) => {
    set({ token });
  },

  // 设置加载状态
  setLoading: (loading) => {
    set({ loading });
  },

  // 重置状态
  reset: () => {
    set(initialState);
  },
});

