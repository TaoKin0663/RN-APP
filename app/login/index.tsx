import React, { useEffect, useState } from 'react';
import { StatusBar, View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useUserStore } from '@/store';
import { useRouter, Stack } from 'expo-router';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

export default function Login() {
    const [isReady, setIsReady] = useState(false);
    const [authingGuardComponent, setAuthingGuardComponent] = useState<any>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const { login } = useUserStore();
    const router = useRouter();
    const appId = '691a983b0804127b385ada81';
    const options = {
        title: 'OutletsRWA Login',
        forceLogin: true, // 将注册和登录合并，当用户不存在的时候为其自动注册
        theme: 'dark'
    };

    const onLogin = (userInfo: any) => {
        try {
            console.log("userInfo------------------")
            console.log(userInfo);
            console.log('userinfoend--------------')

            // userInfo 是一个数组，取第一个元素
            const user = Array.isArray(userInfo) ? userInfo[0] : userInfo;

            if (!user) {
                throw new Error('用户信息为空');
            }

            // 提取用户信息
            const userData = {
                id: user.id || user.userId || user.user_id || '',
                username: user.username || user.name || '',
                email: user.email || '',
                avatar: user.photo || user.avatar || '',
            };

            // 提取 token（根据 Authing 的实际返回结构调整）
            const token = user.token || user.accessToken || user.access_token || '';

            // 存储到 store
            login(userData, token);

            // 登录成功后返回上一页或跳转到首页
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(tabs)');
            }
        } catch (error) {
            console.error('登录失败:', error);
            Alert.alert('登录失败', '存储用户信息时出错，请重试');
        }
    };

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoadError(null);
            setIsReady(false);

            if (isExpoGo) {
                if (!cancelled) {
                    setLoadError('Authing SDK 需要开发构建（Expo Go 不支持）。');
                }
                return;
            }

            try {
                const authingModule: any = require('@authing/rn');
                const Guard =
                    authingModule?.AuthingGuard ??
                    authingModule?.default?.AuthingGuard ??
                    authingModule?.default ??
                    authingModule;

                if (!Guard) {
                    throw new Error('AuthingGuard export is empty');
                }

                if (!cancelled) {
                    setAuthingGuardComponent(() => Guard);
                    setIsReady(true);
                }
            } catch (error: any) {
                const message = error?.message ? String(error.message) : String(error);
                const suggestion =
                    message.includes('RNCWebViewModule') ||
                    message.includes('RNCWebView') ||
                    message.includes('TurboModuleRegistry')
                        ? '当前安装到设备的开发构建缺少 react-native-webview 原生模块，请重新构建并安装：npx expo run:android --device 或 npx expo run:ios --device。'
                        : null;
                if (!cancelled) {
                    setLoadError(suggestion ? `${message}\n\n${suggestion}` : message);
                    setAuthingGuardComponent(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    if (!isReady || !authingGuardComponent) {
        return (
            <>
                {/* <StatusBar barStyle="dark-content" /> */}
                <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['bottom', 'left', 'right']}>
                    <Stack.Screen options={{
                        title: '登录',
                        headerTitleAlign: 'center',
                        headerShadowVisible: false,
                        // headerStyle: {
                        //     backgroundColor: '#000',
                        // },
                        // headerTintColor: '#fff',
                    }} />
                    <View style={{ padding: 20 }}>
                        <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 10 }}>
                            Authing SDK 需要开发构建
                        </Text>
                        <Text style={{ fontSize: 14, textAlign: 'center', color: '#666' }}>
                            请运行以下命令构建应用：
                        </Text>
                        <Text style={{ fontSize: 12, textAlign: 'center', color: '#999', marginTop: 10 }}>
                            npx expo run:android{'\n'}或{'\n'}npx expo run:ios
                        </Text>
                        {!!loadError && (
                            <Text style={{ fontSize: 12, textAlign: 'center', color: '#B91C1C', marginTop: 12 }}>
                                {loadError}
                            </Text>
                        )}
                    </View>
                </SafeAreaView>
            </>
        );
    }

    const AuthingGuard = authingGuardComponent;

    return (
        <>
            <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
                <Stack.Screen options={{
                    title: '登录',
                    headerTitleAlign: 'center',
                    headerShadowVisible: false,
                    // headerStyle: {
                    //     backgroundColor: '#000',
                    // },
                    // headerTintColor: '#fff',
                }} />
                <AuthingGuard appId={appId} options={options} onLogin={onLogin} />
            </SafeAreaView>
        </>
    );
}
