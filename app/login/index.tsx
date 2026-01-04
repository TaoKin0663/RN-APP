import React, { useEffect, useState } from 'react';
import { StatusBar, View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useUserStore } from '@/store';
import { useRouter } from 'expo-router';

// 动态导入 AuthingGuard，避免在 Expo Go 中直接加载
let AuthingGuard: any = null;
const isExpoGo = Constants.executionEnvironment === 'storeClient';

if (!isExpoGo) {
    // 不在 Expo Go 中，尝试加载 AuthingGuard（开发构建或生产环境）
    try {
        const authingModule = require('@authing/rn');
        AuthingGuard = authingModule.AuthingGuard;
    } catch (error) {
        console.warn('Authing SDK not available:', error);
    }
}

export default function Login() {
    const [isReady, setIsReady] = useState(false);
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
        // 检查是否可以使用 Authing SDK
        console.log('=== Authing SDK Debug Info ===');
        console.log('Execution Environment:', Constants.executionEnvironment);
        console.log('Is Expo Go:', isExpoGo);
        console.log('AuthingGuard available:', !!AuthingGuard);

        if (AuthingGuard) {
            console.log('AuthingGuard loaded successfully');
            setIsReady(true);
        } else {
            console.warn('AuthingGuard not available');
            // 如果不在 Expo Go 中但 AuthingGuard 还是 null，可能是模块加载失败
            if (!isExpoGo) {
                console.error('Development build detected but AuthingGuard failed to load. Check if react-native-webview is properly installed.');
            }
        }
    }, []);

    if (!isReady || !AuthingGuard) {
        return (
            <>
                <StatusBar barStyle="dark-content" />
                <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
                    </View>
                </SafeAreaView>
            </>
        );
    }

    return (
        <>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }}>
                <AuthingGuard appId={appId} options={options} onLogin={onLogin} />
            </SafeAreaView>
        </>
    );
}
