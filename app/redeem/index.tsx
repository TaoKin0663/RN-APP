import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/config/theme';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store';
import { formatUnits, type Address } from 'viem';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { tokenStakeABI } from '@/utils/ABI/token_stake';
import { tokenABI } from '@/utils/ABI/token';
import * as Haptics from 'expo-haptics';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { RectButton } from 'react-native-gesture-handler';
import Animated, {
    type SharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
    Extrapolation,
    useSharedValue
} from 'react-native-reanimated';
import RedeemIcon from "@/assets/images/redeem.svg";
export default function Redeem() {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const { tokenAddress } = useLocalSearchParams<{ tokenAddress: string }>();
    const selectedSafeAddress = useAppStore(state => state.selectedSafeAddress);
    const { address: connectedAddress, chainId } = useAccount();
    const userAddress = selectedSafeAddress || connectedAddress;
    const redeemingIndexRef = useRef<number | null>(null);

    const { data: tokenDecimalsData } = useReadContract({
        address: tokenAddress as Address,
        abi: tokenABI,
        functionName: 'decimals',
        query: {
            enabled: !!tokenAddress && !!chainId,
        },
        chainId,
    });
    const tokenDecimals = useMemo(() => {
        if (tokenDecimalsData === undefined || tokenDecimalsData === null) return 18;
        try {
            return Number(tokenDecimalsData);
        } catch {
            return 18;
        }
    }, [tokenDecimalsData]);

    const { data: userStakeInfo, isLoading: isLoadingStakeInfo, refetch: refetchUserStakeInfo } = useReadContract({
        address: tokenAddress as Address,
        abi: tokenStakeABI,
        functionName: 'getUserStakeInfo',
        args: userAddress ? [userAddress as Address] : undefined,
        query: {
            enabled: !!tokenAddress && !!userAddress && !!chainId,
        },
        chainId,
    });

    const stakeLength = useMemo(() => {
        if (!userStakeInfo) return 0;
        const len = userStakeInfo[0] as bigint;
        try {
            return Number(len);
        } catch {
            return 0;
        }
    }, [userStakeInfo]);

    const redeemContracts = useMemo(() => {
        if (!userAddress || !tokenAddress || !chainId) return [];
        if (!stakeLength || stakeLength <= 0) return [];
        return Array.from({ length: stakeLength }, (_, i) => ({
            address: tokenAddress as Address,
            abi: tokenStakeABI,
            functionName: 'getUserStake' as const,
            args: [userAddress as Address, BigInt(i)],
            chainId,
        }));
    }, [userAddress, tokenAddress, stakeLength, chainId]);

    const { data: stakeDetails, isLoading: isLoadingStakeDetails, refetch: refetchStakeDetails } = useReadContracts({
        contracts: redeemContracts,
        allowFailure: false,
        query: {
            enabled: !!redeemContracts.length,
        },
    });

    const parsedStakes = useMemo(() => {
        if (!stakeDetails || !Array.isArray(stakeDetails)) return [];
        return (stakeDetails as any[]).map((it: any) => {
            const r = (it && typeof it === 'object' && 'result' in it) ? (it as any).result : it;
            const [amount, stakeTime, canRedeem, reward, ir, pid] = r as [bigint, bigint, boolean, bigint, boolean, bigint];
            return { amount, stakeTime, canRedeem, reward, ir, pid };
        });
    }, [stakeDetails]);

    const {
        writeContract: writeRedeem,
        isPending: isRedeeming,
        data: redeemTxHash,
        error: redeemError,
    } = useWriteContract();

    const { data: redeemReceipt, isLoading: isWaitingRedeem } = useWaitForTransactionReceipt({
        hash: redeemTxHash,
        query: {
            enabled: !!redeemTxHash,
            retry: 3,
            retryDelay: 2000,
        },
    });

    useEffect(() => {
        if (!redeemReceipt) return;
        if (redeemReceipt.status === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            refetchStakeDetails();
            refetchUserStakeInfo();
        } else if (redeemReceipt.status === 'reverted') {
            Alert.alert('错误', '赎回交易失败');
        }
        redeemingIndexRef.current = null;
    }, [redeemReceipt, refetchStakeDetails, refetchUserStakeInfo]);

    useEffect(() => {
        if (redeemError) {
            console.error('赎回错误:', redeemError);
            Alert.alert('错误', redeemError.message || '赎回失败，请稍后重试');
            redeemingIndexRef.current = null;
        }
    }, [redeemError]);

    const onRedeem = useCallback((index: number) => {
        if (!userAddress || !tokenAddress || !chainId) return;
        if (isRedeeming || isWaitingRedeem) return;
        redeemingIndexRef.current = index;
        writeRedeem({
            address: tokenAddress as Address,
            abi: tokenStakeABI,
            functionName: 'redeem',
            args: [BigInt(index)],
            chainId,
        });
    }, [userAddress, tokenAddress, chainId, writeRedeem, isRedeeming, isWaitingRedeem]);

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
            <Stack.Screen options={{
                title: '赎回明细',
                headerTitleAlign: 'center',
                headerShadowVisible: false,
                headerStyle: {
                    backgroundColor: colors.background,
                },
                headerTintColor: colors.text,
            }} />
            <View className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingVertical: 16,
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* <View className="mb-3">
                        <Text className="text-base font-semibold" style={{ color: colors.text }}>赎回明细</Text>
                        <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                            {stakeLength > 0 ? `共 ${stakeLength} 笔质押` : '暂无可赎回记录'}
                        </Text>
                    </View> */}
                    {isLoadingStakeInfo && (
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>加载中...</Text>
                    )}
                    {!isLoadingStakeDetails && parsedStakes.map((s, idx) => (
                        <StakeRedeemRow
                            key={idx}
                            s={s}
                            idx={idx}
                            tokenDecimals={tokenDecimals}
                            colors={colors}
                            onRedeem={onRedeem}
                        />
                    ))}
                    {!isLoadingStakeDetails && parsedStakes.length === 0 && (
                        <Text className="text-sm" style={{ color: colors.textTertiary }}>暂无数据</Text>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

function StakeRedeemRow({
    s,
    idx,
    tokenDecimals,
    colors,
    onRedeem,
}: {
    s: { amount: bigint; stakeTime: bigint; canRedeem: boolean; reward: bigint; ir: boolean; pid: bigint };
    idx: number;
    tokenDecimals: number;
    colors: typeof Colors.dark;
    onRedeem: (index: number) => void;
}) {
    const swipeableRef = useRef<SwipeableMethods>(null);
    const RedeemAction = ({
        translation,
        onPress,
        primaryColor
    }: {
        translation: SharedValue<number>;
        onPress: () => void;
        primaryColor: string;
    }) => {
        const bounceScale = useSharedValue(1);

        const containerAnimatedStyle = useAnimatedStyle(() => {
            const width = interpolate(
                translation.value,
                [0, -100],
                [0, 100],
                Extrapolation.CLAMP
            );
            return {
                width,
            };
        });

        const contentAnimatedStyle = useAnimatedStyle(() => {
            const scale = interpolate(
                translation.value,
                [-100, 0],
                [1, 0.8],
                Extrapolation.CLAMP
            );

            const springScale = withSpring(scale, {
                damping: 12,
                stiffness: 200,
                mass: 0.6,
            });

            return {
                transform: [{ scale: springScale }],
                opacity: interpolate(
                    translation.value,
                    [-100, -50, 0],
                    [1, 0.5, 0],
                    Extrapolation.CLAMP
                ),
            };
        });

        const buttonAnimatedStyle = useAnimatedStyle(() => {
            return {
                transform: [{ scale: bounceScale.value }],
            };
        });

        const handlePress = () => {
            bounceScale.value = withSpring(0.95, { damping: 12, stiffness: 200 }, () => {
                bounceScale.value = withSpring(1, { damping: 12, stiffness: 200 });
            });
            onPress();
        };

        return (
            <RectButton
                style={{
                    width: 100,
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    backgroundColor: 'transparent',
                }}
                onPress={handlePress}
            >
                <Animated.View
                    style={[
                        {
                            height: '100%',
                            backgroundColor: primaryColor,
                            justifyContent: 'center',
                            alignItems: 'center',
                        },
                        containerAnimatedStyle,
                    ]}
                >
                    <Animated.View style={[contentAnimatedStyle, buttonAnimatedStyle]}>
                        <RedeemIcon width={28} height={28} />
                        <Text className="text-sm mt-1" style={{ color: '#FFFFFF' }}>赎回</Text>
                    </Animated.View>
                </Animated.View>
            </RectButton>
        );
    };
    const renderRightActions = (
        progress: SharedValue<number>,
        translation: SharedValue<number>
    ) => {
        return (
            <RedeemAction
                translation={translation}
                onPress={() => {
                    swipeableRef.current?.close();
                    onRedeem(idx);
                }}
                primaryColor={colors.primary}
            />
        );
    };
    return (
        <View className="mb-3" style={{ backgroundColor: colors.backgroundSecondary }}>
            <ReanimatedSwipeable
                ref={swipeableRef}
                renderRightActions={renderRightActions}
                enabled={true}
                overshootRight={true}
                overshootFriction={6}
                friction={1.5}
            >
                <Animated.View className="p-3 rounded-lg overflow-hidden">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>金额</Text>
                        <Text className="text-sm" style={{ color: colors.text }}>{formatUnits(s.amount, tokenDecimals)}</Text>
                    </View>
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>收益</Text>
                        <Text className="text-sm" style={{ color: colors.text }}>{formatUnits(s.reward, tokenDecimals)}</Text>
                    </View>
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>质押时间</Text>
                        <Text className="text-sm" style={{ color: colors.text }}>
                            {(() => {
                                try {
                                    const t = Number(s.stakeTime) * 1000;
                                    return new Date(t).toLocaleString();
                                } catch {
                                    return '-';
                                }
                            })()}
                        </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>可赎回</Text>
                        <Text className="text-sm" style={{ color: s.canRedeem ? colors.text : colors.textTertiary }}>
                            {s.canRedeem ? '是' : '否'}
                        </Text>
                    </View>
                </Animated.View>
            </ReanimatedSwipeable>
        </View>
    );
}
