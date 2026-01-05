import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useWaitForTransactionReceipt } from 'wagmi';
import { sepolia } from '@wagmi/core/chains';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/config/theme';

type TransactionStatus = 'loading' | 'success' | 'failed';

export default function TransactionProgress() {
    const params = useLocalSearchParams<{ hash: string }>();
    const router = useRouter();
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'light'];
    
    const [status, setStatus] = useState<TransactionStatus>('loading');
    const [error, setError] = useState<string | null>(null);
    const lottieRef = useRef<LottieView>(null);
    const hasPlayedSuccess = useRef(false);

    const transactionHash = params.hash as `0x${string}` | undefined;

    // 使用 wagmi 监听交易状态
    const { data: receipt, isLoading, isError, error: txError } = useWaitForTransactionReceipt({
        hash: transactionHash,
        chainId: sepolia.id,
        query: {
            enabled: !!transactionHash,
            retry: 3,
            retryDelay: 2000,
        },
    });

    useEffect(() => {
        if (receipt) {
            // 交易成功
            if (receipt.status === 'success') {
                setStatus('success');
            } else {
                // 交易失败
                setStatus('failed');
                setError('交易失败');
            }
        } else if (isError) {
            // 监听出错
            setStatus('failed');
            setError(txError?.message || '交易监听失败');
        } else if (isLoading && transactionHash) {
            // 仍在加载中
            setStatus('loading');
        }
    }, [receipt, isLoading, isError, txError, transactionHash]);

    // 当状态变为成功时，播放成功动画（只播放一次）
    useEffect(() => {
        if (status === 'success' && !hasPlayedSuccess.current && lottieRef.current) {
            lottieRef.current.play();
            hasPlayedSuccess.current = true;
        }
    }, [status]);

    const handleBackToHome = () => {
        router.replace('/(tabs)');
    };

    if (!transactionHash) {
        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
                <ThemedView className="flex-1 justify-center items-center p-5">
                    <ThemedText type="title" className="mt-4 text-base text-center">
                        缺少交易哈希
                    </ThemedText>
                    <Button onPress={handleBackToHome} className="mt-8 min-w-[200px] self-center">
                        返回首页
                    </Button>
                </ThemedView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
            <Stack.Screen options={{
                title: '',
                headerTitleAlign: 'center',
                headerShadowVisible: false,
            }} />
            <ThemedView className="flex-1 justify-center items-center p-5">
                {/* Loading 状态 */}
                {status === 'loading' && (
                    <View className="items-center justify-center w-full">
                        <LottieView
                            source={require('@/assets/lottie/txing.json')}
                            autoPlay
                            loop
                            style={{ width: 200, height: 200 }}
                        />
                        <ThemedText type="title" className="mt-5 text-2xl font-bold text-center">
                            交易处理中...
                        </ThemedText>
                        <ThemedText type="default" className="mt-4 text-xs text-center opacity-70 font-mono">
                            {transactionHash}
                        </ThemedText>
                    </View>
                )}

                {/* Success 状态 */}
                {status === 'success' && (
                    <View className="items-center justify-center w-full max-w-[400px]">
                        <LottieView
                            ref={lottieRef}
                            source={require('@/assets/lottie/Done.json')}
                            autoPlay={false}
                            loop={false}
                            style={{ width: 200, height: 200 }}
                            onAnimationFinish={() => {
                                // 动画播放完成后的回调
                            }}
                        />
                        <ThemedText type="title" className="mt-6 text-2xl font-bold text-center" style={{ color: colors.success }}>
                            交易成功！
                        </ThemedText>
                        {receipt && (
                            <View 
                                className="mt-8 w-full rounded-xl p-4"
                                style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border }}
                            >
                                <View className="flex-row justify-between items-center py-3">
                                    <ThemedText type="default" className="text-sm font-medium flex-0 min-w-[80px]" style={{ color: colors.textSecondary }}>
                                        区块高度
                                    </ThemedText>
                                    <ThemedText type="default" className="text-sm flex-1 text-right ml-4" style={{ color: colors.text }}>
                                        {receipt.blockNumber.toString()}
                                    </ThemedText>
                                </View>
                                <View className="h-px w-full my-1" style={{ backgroundColor: colors.border }} />
                                <View className="flex-row justify-between items-center py-3">
                                    <ThemedText type="default" className="text-sm font-medium flex-0 min-w-[80px]" style={{ color: colors.textSecondary }}>
                                        交易哈希
                                    </ThemedText>
                                    <ThemedText type="default" className="text-sm flex-1 text-right ml-4 font-mono" numberOfLines={1} style={{ color: colors.text }}>
                                        {transactionHash}
                                    </ThemedText>
                                </View>
                            </View>
                        )}
                        <Button onPress={handleBackToHome} className="mt-8 min-w-[200px] self-center mx-auto" color="success">
                            返回首页
                        </Button>
                    </View>
                )}

                {/* Failed 状态 */}
                {status === 'failed' && (
                    <View className="items-center justify-center w-full">
                        <ThemedText type="title" className="mt-5 text-2xl font-bold text-center" style={{ color: colors.error }}>
                            交易失败
                        </ThemedText>
                        {error && (
                            <ThemedText type="default" className="mt-4 text-base text-center" style={{ color: colors.error }}>
                                {error}
                            </ThemedText>
                        )}
                        <ThemedText type="default" className="mt-4 text-xs text-center opacity-70 font-mono">
                            {transactionHash}
                        </ThemedText>
                        <Button onPress={handleBackToHome} className="mt-8 min-w-[200px] self-center" color="error">
                            返回首页
                        </Button>
                    </View>
                )}
            </ThemedView>
        </SafeAreaView>
    );
}