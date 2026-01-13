import { useEffect } from 'react';
import { useSegments, useRouter, usePathname, Href } from 'expo-router';
import { useUserStore } from '@/store';

/**
 * 路由保护 Hook
 * 用于检查用户登录状态并自动重定向
 * 
 * @param isReady - 是否已准备好（例如字体加载完成）
 * @param options - 配置选项
 * @param options.loginPath - 登录页面路径，默认为 '/login'
 * @param options.homePath - 首页路径，默认为 '/(tabs)'
 */
export function useAuthGuard(
  isReady: boolean,
  options: {
    loginPath?: string;
    homePath?: string;
  } = {}
) {
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn } = useUserStore();

  const { loginPath = '/login', homePath = '/(tabs)' } = options;

  useEffect(() => {
    if (!isReady) {
      return; // 等待准备完成
    }

    const isLoginPage = pathname === loginPath || segments[0] === 'login';

    // 如果未登录且不在登录页面，重定向到登录页
    if (!isLoggedIn && !isLoginPage) {
      router.replace(loginPath as Href);
      return;
    }

    // 如果已登录且在登录页面，重定向到首页
    if (isLoggedIn && isLoginPage) {
      router.replace(homePath as Href);
      return;
    }
  }, [isLoggedIn, segments, pathname, isReady, router, loginPath, homePath]);
}
