import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
    Keyboard,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAccount, useChains, useSendTransaction, useSwitchChain } from 'wagmi';
import { useConfig } from 'wagmi';
import Safe, {
    type PredictedSafeProps,
    type SafeAccountConfig,
    type SafeDeploymentConfig,
} from '@safe-global/protocol-kit';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
    useAnimatedStyle,
    withSpring,
    interpolate,
    Extrapolation,
    useSharedValue,
    type SharedValue,
} from 'react-native-reanimated';
import BottomSheet, {
    BottomSheetFlatList,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetScrollView,
    BottomSheetTextInput,
    type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { BlurView } from 'expo-blur';

import ChainIcon from '@/components/ChainIcon';
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/config/theme';
import { useAvatarGenerator } from '@/hooks/useAvatarGenerator';
import Jazzicon from 'react-native-jazzicon';
import { formatAddress } from '@/utils/common';
import { Button } from '@/components/Button';

type ChainDeployStatus =
    | 'idle'
    | 'predicting'
    | 'switching'
    | 'sending'
    | 'confirming'
    | 'success'
    | 'failed'
    | 'skipped';

type ChainDeployStep = {
    chainId: number;
    chainName: string;
    status: ChainDeployStatus;
    predictedAddress?: `0x${string}`;
    txHash?: `0x${string}`;
    error?: string;
};

type Owner = {
    address: string;
    name: string;
};

// 删除按钮组件，使用 reanimated 实现 Q 弹效果
const DeleteButton = React.memo(function DeleteButton({
    translation,
    onPress,
    errorColor,
}: {
    translation: SharedValue<number>;
    onPress: () => void;
    errorColor: string;
}) {
    const deleteButtonScale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(
            translation.value,
            [-100, 0],
            [1, 0],
            Extrapolation.CLAMP
        );

        // 添加弹簧效果
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
            transform: [{ scale: deleteButtonScale.value }],
        };
    });

    const handlePress = () => {
        // 点击时的 Q 弹效果 - 先缩小
        deleteButtonScale.value = withSpring(0.75, {
            damping: 8,
            stiffness: 400,
        });

        // 然后弹回，并执行删除操作
        setTimeout(() => {
            deleteButtonScale.value = withSpring(1, {
                damping: 10,
                stiffness: 300,
            });
            onPress();
        }, 150);
    };

    return (
        <RectButton
            style={{
                width: 80,
                backgroundColor: errorColor,
                justifyContent: 'center',
                alignItems: 'center',
            }}
            onPress={handlePress}
        >
            <Animated.View style={animatedStyle}>
                <Animated.View style={buttonAnimatedStyle}>
                    <MaterialIcons name="delete" size={35} color="#FFFFFF" />
                </Animated.View>
            </Animated.View>
        </RectButton>
    );
});

// Owner 列表项组件，独立使用 hooks
const OwnerItem = React.memo(function OwnerItem({
    owner,
    index,
    avatar,
    canRemove,
    colors,
    onRemove,
}: {
    owner: Owner;
    index: number;
    avatar: number | null;
    canRemove: boolean;
    address: string | undefined;
    colors: typeof Colors.light;
    onRemove: (index: number) => void;
}) {
    const swipeableRef = useRef<SwipeableMethods>(null);

    const renderRightActions = (
        progress: SharedValue<number>,
        translation: SharedValue<number>
    ) => {
        if (!canRemove) return null;

        return (
            <DeleteButton
                translation={translation}
                onPress={() => {
                    swipeableRef.current?.close();
                    onRemove(index);
                }}
                errorColor={colors.error}
            />
        );
    };

    return (
        <ReanimatedSwipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            enabled={canRemove}
            overshootRight={true}
            overshootFriction={6}
            friction={1.5}
        >
            <Animated.View className="flex-row items-center p-3 gap-3" style={{ backgroundColor: colors.backgroundSecondary }}>
                <View className="w-10 h-10 rounded-full items-center justify-center">
                    {avatar ? (
                        <Jazzicon size={40} seed={avatar} />
                    ) : (
                        <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.primary }}
                        >
                            <MaterialIcons name="person" size={20} color="#FFFFFF" />
                        </View>
                    )}
                </View>
                <View className="flex-1 gap-1">
                    <Text
                        className="text-lg font-mono"
                        style={{ color: colors.textTertiary }}
                        numberOfLines={1}
                    >
                        {formatAddress(owner.address)}
                    </Text>
                </View>
            </Animated.View>
        </ReanimatedSwipeable>
    );
});

export default function NewSafe() {
    const router = useRouter();
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'light'];

    const { address, isConnected, chainId } = useAccount();
    const chains = useChains();
    const { switchChainAsync } = useSwitchChain();
    const { sendTransactionAsync } = useSendTransaction({
        mutation: {
            retry: false,
        },
    });
    const config = useConfig();
    const activeChain = config.chains.find((chain) => chain.id === chainId);

    const [owners, setOwners] = useState<Owner[]>([]);
    const [threshold, setThreshold] = useState<string>('1');
    const [newOwnerAddress, setNewOwnerAddress] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [selectedChainIds, setSelectedChainIds] = useState<number[]>([]);
    const [deploySteps, setDeploySteps] = useState<ChainDeployStep[]>([]);
    const [safeVersion] = useState<string>('1.4.1');
    const [showAddOwnerModal, setShowAddOwnerModal] = useState(false);
    const [tempOwnerAddress, setTempOwnerAddress] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const bottomSheetRef = useRef<BottomSheet>(null);
    const addOwnerSheetRef = useRef<BottomSheet>(null);

    const { generateAvatar } = useAvatarGenerator();

    // BottomSheet 模糊遮罩组件 - 兼容 Android 和 iOS
    const BlurBackdrop = React.memo(function BlurBackdrop(props: BottomSheetBackdropProps) {
        const { animatedIndex } = props;

        // 使用 Reanimated 创建动画样式
        const containerAnimatedStyle = useAnimatedStyle(() => {
            const opacity = interpolate(
                animatedIndex.value,
                [-1, 0],
                [0, 1],
                Extrapolation.CLAMP
            );
            return {
                opacity,
            };
        });

        return (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={1}
                style={[
                    props.style,
                    {
                        backgroundColor: 'transparent', // 移除默认背景色
                    },
                ]}
            >
                {Platform.OS === 'ios' ? (
                    // iOS 使用模糊效果
                    <BlurView
                        intensity={20}
                        tint="dark"
                        style={[
                            {
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                            },
                            containerAnimatedStyle,
                        ]}
                    />
                ) : (
                    // Android 使用半透明背景
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明黑色
                            },
                            containerAnimatedStyle,
                        ]}
                    />
                )}
            </BottomSheetBackdrop>
        );
    });

    // BottomSheet 模糊遮罩渲染函数
    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => <BlurBackdrop {...props} />,
        []
    );

    const handlePresentModalPress = useCallback(() => {
        bottomSheetRef.current?.snapToIndex(0);
    }, []);

    const handleSheetChange = useCallback((index: number) => {
        if (index === -1) {
            // Sheet 关闭
        }
    }, []);

    // 为所有 owners 生成头像映射
    const ownerAvatars = useMemo(() => {
        const avatars: Record<string, number | null> = {};
        owners.forEach((owner) => {
            avatars[owner.address] = generateAvatar(owner.address);
        });
        return avatars;
    }, [owners, generateAvatar]);

    // 初始化 owners（默认包含当前地址）
    useEffect(() => {
        if (address) {
            setOwners([{ address, name: '我 (当前钱包)' }]);
        } else {
            setOwners([]);
            setThreshold('1');
        }
    }, [address]);

    // 默认选择当前钱包所在链（如果存在）
    useEffect(() => {
        if (!isConnected || !chainId) {
            setSelectedChainIds([]);
            return;
        }
        setSelectedChainIds((prev) => (prev.length > 0 ? prev : [chainId]));
    }, [isConnected, chainId]);

    // 监听键盘显示/隐藏
    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                setKeyboardHeight(e.endCoordinates.height);
            }
        );
        const hideSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardHeight(0);
            }
        );

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const toggleChainInSelect = (chainId: number) => {
        setSelectedChainIds((prev) => {
            if (prev.includes(chainId)) {
                return prev.filter((id) => id !== chainId);
            }
            return [...prev, chainId];
        });
    };

    const handleOpenAddOwnerModal = useCallback(() => {
        setTempOwnerAddress('');
        addOwnerSheetRef.current?.snapToIndex(0);
    }, []);

    const handleCloseAddOwnerModal = useCallback(() => {
        addOwnerSheetRef.current?.close();
        setTempOwnerAddress('');
    }, []);

    const handleScanQRCode = useCallback(async () => {
        // TODO: 实现二维码扫描功能
        // 需要安装: expo install expo-camera expo-barcode-scanner
        Alert.alert('提示', '二维码扫描功能需要安装 expo-camera 和 expo-barcode-scanner');
    }, []);

    const handleConfirmAddOwner = useCallback(() => {
        if (!tempOwnerAddress) {
            Alert.alert('错误', '请输入钱包地址');
            return;
        }

        // 简单的地址校验
        if (!tempOwnerAddress.startsWith('0x') || tempOwnerAddress.length !== 42) {
            Alert.alert('错误', '无效的钱包地址');
            return;
        }

        if (owners.some((o) => o.address.toLowerCase() === tempOwnerAddress.toLowerCase())) {
            Alert.alert('错误', '该地址已添加');
            return;
        }

        const newOwners = [
            ...owners,
            { address: tempOwnerAddress, name: `Owner ${owners.length + 1}` },
        ];
        setOwners(newOwners);
        handleCloseAddOwnerModal();
    }, [tempOwnerAddress, owners, handleCloseAddOwnerModal]);

    // 保留旧的 addOwner 函数以兼容（如果还有地方在使用）
    const addOwner = () => {
        if (!newOwnerAddress) return;

        // 简单的地址校验
        if (!newOwnerAddress.startsWith('0x') || newOwnerAddress.length !== 42) {
            Alert.alert('错误', '无效的钱包地址');
            return;
        }

        if (owners.some((o) => o.address.toLowerCase() === newOwnerAddress.toLowerCase())) {
            Alert.alert('错误', '该地址已添加');
            return;
        }

        const newOwners = [
            ...owners,
            { address: newOwnerAddress, name: `Owner ${owners.length + 1}` },
        ];
        setOwners(newOwners);
        setNewOwnerAddress('');
    };

    const removeOwner = (index: number) => {
        const newOwners = [...owners];
        newOwners.splice(index, 1);
        setOwners(newOwners);

        // 如果当前阈值大于剩余人数，自动调低阈值
        const currentThreshold = parseInt(threshold);
        if (currentThreshold > newOwners.length) {
            setThreshold(String(Math.max(1, newOwners.length)));
        }
    };

    const handleCreateSafe = async () => {
        if (!isConnected || !address || !chainId) {
            Alert.alert('错误', '请连接钱包');
            return;
        }

        if (owners.length === 0) {
            Alert.alert('错误', '至少需要一位拥有者');
            return;
        }

        if (selectedChainIds.length === 0) {
            Alert.alert('错误', '请至少选择一条部署链');
            return;
        }

        try {
            setIsCreating(true);
            setDeploySteps([]);

            // 1. Safe 账户配置（owners & threshold）
            const sortedOwnerAddresses = [...owners]
                .sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()))
                .map((o) => o.address as `0x${string}`);

            const safeAccountConfig: SafeAccountConfig = {
                owners: sortedOwnerAddresses,
                threshold: parseInt(threshold),
            };

            const safeDeploymentConfig: SafeDeploymentConfig = {
                safeVersion: safeVersion as any,
                saltNonce: '0',
            };

            const predictedSafe: PredictedSafeProps = {
                safeAccountConfig,
                safeDeploymentConfig,
            };

            // 2. 预测多链 Safe 地址（必须一致）
            type WagmiChain = (typeof chains)[number];
            const selectedChains: WagmiChain[] = selectedChainIds
                .map((id) => chains.find((c) => c.id === id))
                .filter((c): c is WagmiChain => Boolean(c));

            if (selectedChains.length !== selectedChainIds.length) {
                Alert.alert('错误', '选择的链中包含未配置的链，请刷新后重试');
                return;
            }

            const initialSteps: ChainDeployStep[] = selectedChains.map((c) => ({
                chainId: c.id,
                chainName: c.name,
                status: 'predicting',
            }));
            let steps = initialSteps;
            const setStep = (targetChainId: number, patch: Partial<ChainDeployStep>) => {
                steps = steps.map((s) => (s.chainId === targetChainId ? { ...s, ...patch } : s));
                setDeploySteps(steps);
            };
            setDeploySteps(steps);

            const predictedByChain = new Map<number, `0x${string}`>();
            const protocolKitByChain = new Map<number, Safe>();
            for (const c of selectedChains) {
                const provider = c.rpcUrls.default.http?.[0];
                if (!provider) {
                    predictedByChain.set(c.id, '0x0000000000000000000000000000000000000000');
                    setStep(c.id, { status: 'failed', error: '该链未配置 RPC URL' });
                    continue;
                }

                try {
                    const protocolKit = await Safe.init({
                        provider,
                        signer: address as `0x${string}`,
                        predictedSafe,
                    });

                    const predictedAddress = await protocolKit.getAddress();
                    predictedByChain.set(c.id, predictedAddress as `0x${string}`);
                    protocolKitByChain.set(c.id, protocolKit);
                    setStep(c.id, {
                        predictedAddress: predictedAddress as `0x${string}`,
                        status: 'idle',
                    });
                } catch (error) {
                    predictedByChain.set(c.id, '0x0000000000000000000000000000000000000000');
                    setStep(c.id, {
                        status: 'failed',
                        error: `预测失败: ${(error as Error)?.message || '未知错误'}`,
                    });
                }
            }

            const nonZeroPredictedAddresses = Array.from(predictedByChain.entries())
                .filter(([, addr]) => addr !== '0x0000000000000000000000000000000000000000')
                .map(([, addr]) => addr);

            const uniquePredictedLower = Array.from(
                new Set(nonZeroPredictedAddresses.map((a) => a.toLowerCase()))
            );
            if (uniquePredictedLower.length !== 1) {
                steps = steps.map((s) => {
                    const predicted = predictedByChain.get(s.chainId);
                    const isError = s.status === 'failed';
                    return {
                        ...s,
                        status: isError ? ('failed' as const) : ('failed' as const),
                        error: isError
                            ? s.error
                            : `预测地址: ${predicted || '未知'}（与其他链不一致，无法同地址部署）`,
                    };
                });
                setDeploySteps(steps);
                Alert.alert('错误', `多链预测地址不一致（${uniquePredictedLower.length} 个不同地址）`);
                return;
            }

            const finalPredictedAddress = nonZeroPredictedAddresses[0] as `0x${string}`;

            // 3. 逐链部署（仅在需要时切换网络并发送交易）
            const originalChainId = chainId;
            let currentChainId = chainId;
            let firstTxHash: `0x${string}` | null = null;

            for (const c of selectedChains) {
                const provider = c.rpcUrls.default.http?.[0];
                if (!provider) {
                    setStep(c.id, { status: 'skipped', error: '该链未配置 RPC URL' });
                    continue;
                }

                const protocolKit = protocolKitByChain.get(c.id);
                if (!protocolKit) {
                    continue;
                }

                try {
                    // 只在当前链不是目标链时才切换
                    if (currentChainId !== c.id) {
                        setStep(c.id, { status: 'switching' });
                        if (switchChainAsync) {
                            await switchChainAsync({ chainId: c.id });
                            currentChainId = c.id;
                        }
                    }

                    const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction();

                    setStep(c.id, { status: 'sending' });
                    const txHash = await sendTransactionAsync({
                        chainId: c.id,
                        to: deploymentTransaction.to as `0x${string}`,
                        value: BigInt(deploymentTransaction.value),
                        data: deploymentTransaction.data as `0x${string}`,
                    });

                    setStep(c.id, { txHash: txHash as `0x${string}`, status: 'confirming' });

                    // 保存第一条链的交易哈希，用于跳转到交易进度页面
                    if (!firstTxHash) {
                        firstTxHash = txHash as `0x${string}`;
                        // 跳转到交易进度页面，监听第一条链的交易状态
                        router.push({
                            pathname: '/transaction-progress',
                            params: { hash: firstTxHash },
                        });
                    }
                } catch (e) {
                    const msg = (e as Error)?.message || '未知错误';
                    setStep(c.id, { status: 'failed', error: msg });
                }
            }

            // 4. 切回原链（尽力而为）
            try {
                if (switchChainAsync && originalChainId) {
                    await switchChainAsync({ chainId: originalChainId });
                }
            } catch {
                // ignore
            }

            // 注意：交易状态监听已转移到 transaction-progress 页面
            // 这里不再需要检查所有链的状态，因为用户已经在交易进度页面
        } catch (error) {
            Alert.alert('错误', '创建 Safe 智能账户失败: ' + (error as Error).message);
        } finally {
            setIsCreating(false);
        }
    };

    const getStatusIcon = (status: ChainDeployStatus) => {
        switch (status) {
            case 'success':
                return <MaterialIcons name="check-circle" size={20} color={colors.success} />;
            case 'failed':
                return <MaterialIcons name="error" size={20} color={colors.error} />;
            case 'predicting':
            case 'switching':
            case 'sending':
            case 'confirming':
                return <ActivityIndicator size="small" color={colors.primary} />;
            default:
                return <View className="w-4 h-4 rounded-full border-2" style={{ borderColor: colors.border }} />;
        }
    };

    const getStatusText = (status: ChainDeployStatus) => {
        switch (status) {
            case 'idle':
                return '等待中';
            case 'predicting':
                return '预测地址中...';
            case 'switching':
                return '切换网络中...';
            case 'sending':
                return '发送交易中...';
            case 'confirming':
                return '确认中...';
            case 'success':
                return '成功';
            case 'failed':
                return '失败';
            case 'skipped':
                return '已跳过';
            default:
                return status;
        }
    };


    // BottomSheet snap points - 两个高度选项
    const snapPoints = useMemo(() => ['50%', '90%'], []);
    const addOwnerSnapPoints = useMemo(() => ['75%'], []);

    // Render chain item for BottomSheetFlatList
    const renderChainItem = useCallback(
        ({ item: chain }: { item: (typeof chains)[number] }) => {
            const checked = selectedChainIds.includes(chain.id);
            const hasRpc = Boolean(chain.rpcUrls.default.http?.[0]);

            return (
                <TouchableOpacity
                    className="flex-row items-center justify-between p-3 rounded-xl mx-4 my-1"
                    style={{
                        backgroundColor: checked
                            ? colors.primary + '20'
                            : colors.backgroundSecondary,
                        opacity: hasRpc ? 1 : 0.5,
                        borderWidth: 1,
                        borderColor: checked ? colors.primary : colors.border,
                    }}
                    onPress={() => {
                        if (!hasRpc || isCreating) return;
                        toggleChainInSelect(chain.id);
                    }}
                    disabled={!hasRpc || isCreating}
                    activeOpacity={0.7}
                >
                    <View className="flex-row items-center gap-3 flex-1">
                        <ChainIcon chainId={chain.id} size={24} />
                        <View className="flex-1 gap-1">
                            <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                                {chain.name}
                            </Text>
                            <Text className="text-xs" style={{ color: colors.textTertiary }}>
                                Chain ID: {chain.id}
                            </Text>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        {checked && (
                            <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                        )}
                        {!hasRpc && (
                            <Text className="text-xs ml-2" style={{ color: colors.textTertiary }}>
                                无 RPC
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
            );
        },
        [selectedChainIds, colors, isCreating, toggleChainInSelect]
    );

    if (!isConnected) {
        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                <View
                    className="flex-row items-center justify-between px-4 pb-3"
                    style={{
                        backgroundColor: colors.background,
                        paddingTop: 12,
                    }}
                >
                    <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                        创建 Safe 智能账户
                    </Text>
                </View>
                <View className="flex-1 items-center justify-center gap-4">
                    <MaterialIcons name="account-balance-wallet" size={64} color={colors.textTertiary} />
                    <Text className="text-base" style={{ color: colors.text }}>
                        请先连接钱包
                    </Text>
                </View>
            </SafeAreaView>
        );
    }



    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                title: '创建 Safe 智能账户',
                headerTitleAlign: 'center',
                headerShadowVisible: false,
            }} />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="gap-8" >
                    {/* 部署链选择 */}
                    <View className="gap-4">
                        <TouchableOpacity
                            className="flex-row items-center justify-between p-4 rounded-xl"
                            style={{
                                backgroundColor: colors.backgroundSecondary,
                            }}
                            onPress={handlePresentModalPress}
                            disabled={isCreating}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center gap-2">
                                {selectedChainIds.length > 0 ? (
                                    <View className="flex-row items-center" style={{ marginLeft: -8 }}>
                                        {selectedChainIds.slice(0, 3).map((chainId, index) => {
                                            const chain = chains.find((chain) => chain.id === chainId);
                                            if (!chain) return null;
                                            return (
                                                <View
                                                    key={chainId}
                                                    style={{
                                                        marginLeft: index > 0 ? -8 : 0,
                                                        zIndex: index + 1, // 后面的图标 zIndex 更高，叠在前面
                                                        borderWidth: 2,
                                                        borderColor: colors.backgroundSecondary,
                                                        borderRadius: 12,
                                                        backgroundColor: colors.backgroundSecondary,
                                                    }}
                                                >
                                                    <ChainIcon chainId={chain.id} size={24} />
                                                </View>
                                            );
                                        })}
                                        {selectedChainIds.length > 3 && (
                                            <View
                                                style={{
                                                    marginLeft: -8,
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 12,
                                                    backgroundColor: colors.primary,
                                                    borderWidth: 2,
                                                    borderColor: colors.backgroundSecondary,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    zIndex: 4, // 数量徽章在最前面
                                                }}
                                            >
                                                <Text className="text-xs font-semibold" style={{ color: '#FFFFFF' }}>
                                                    +{selectedChainIds.length - 3}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    <Text className="text-base font-medium" style={{ color: colors.text }}>
                                        选择部署链
                                    </Text>
                                )}
                            </View>
                            <MaterialIcons name="arrow-forward-ios" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* 拥有者配置 */}
                    <View className="gap-4">

                        <View style={{ backgroundColor: colors.backgroundSecondary, borderRadius: 12, overflow: 'hidden' }}>
                            {owners.map((owner, index) => {
                                const avatar = ownerAvatars[owner.address];
                                const canRemove = owner.address.toLowerCase() !== address?.toLowerCase();

                                return (
                                    <OwnerItem
                                        key={owner.address}
                                        owner={owner}
                                        index={index}
                                        avatar={avatar}
                                        canRemove={canRemove}
                                        address={address}
                                        colors={colors}
                                        onRemove={removeOwner}
                                    />
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            className="flex-row items-center justify-center gap-2 p-4 rounded-xl border"
                            style={{
                                backgroundColor: colors.backgroundSecondary,
                                borderColor: colors.border,
                                borderWidth: 1,
                                borderStyle: 'dashed',
                            }}
                            onPress={handleOpenAddOwnerModal}
                            disabled={isCreating}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
                            <Text className="text-base font-medium" style={{ color: colors.primary }}>
                                添加拥有者
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* 确认阈值设置 */}
                    <View className="gap-4">
                        <View className="gap-2">
                            <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                                确认阈值
                            </Text>
                            <Text className="text-sm leading-5" style={{ color: colors.textTertiary }}>
                                确认阈值决定了执行交易需要多少位拥有者签名。例如，如果设置为 2/3，则至少需要 2 位拥有者同意才能执行交易。这提供了额外的安全保障，防止单点故障。
                            </Text>
                        </View>
                        <View className="flex-row flex-wrap gap-3">
                            {Array.from({ length: owners.length }).map((_, i) => {
                                const value = String(i + 1);
                                const isSelected = threshold === value;
                                return (
                                    <TouchableOpacity
                                        key={i + 1}
                                        className="px-4 py-2.5 rounded-lg border"
                                        style={{
                                            backgroundColor: isSelected
                                                ? colors.primary
                                                : colors.backgroundSecondary,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                        }}
                                        onPress={() => setThreshold(value)}
                                        disabled={isCreating}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            className="text-sm font-medium"
                                            style={{
                                                color: isSelected ? '#FFFFFF' : colors.text,
                                            }}
                                        >
                                            {i + 1} / {owners.length} 人
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* 确认创建按钮 */}
                    <View className="pt-4">
                        <Button
                            className="w-full flex-row items-center justify-center gap-2"
                            color="primary"
                            onPress={handleCreateSafe}
                            disabled={isCreating || selectedChainIds.length === 0 || owners.length === 0}
                        >
                            {isCreating && <ActivityIndicator size="small" color="#FFFFFF" />}
                            <Text className="text-base font-semibold text-white">
                                {isCreating ? '创建中...' : '确认创建'}
                            </Text>
                        </Button>
                    </View>
                </View>
            </ScrollView>

            {/* 链选择 BottomSheet */}
            <BottomSheet
                ref={bottomSheetRef}
                index={-1}
                snapPoints={snapPoints}
                enableDynamicSizing={false}
                onChange={handleSheetChange}
                enablePanDownToClose={true}
                backdropComponent={renderBackdrop}
            >
                <BottomSheetFlatList
                    data={chains}
                    keyExtractor={(chain: (typeof chains)[number]) => String(chain.id)}
                    renderItem={renderChainItem}
                    ListHeaderComponent={
                        <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 }}>
                            <Text className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
                                选择部署链 ({selectedChainIds.length})
                            </Text>
                            <Text className="text-sm leading-5" style={{ color: colors.textTertiary }}>
                                Safe 智能账户支持多链部署，您可以选择在一条或多条区块链上部署相同的 Safe 账户。所有链上的 Safe 账户将拥有相同的地址，方便您进行跨链资产管理。
                            </Text>
                        </View>
                    }
                    contentContainerStyle={{
                        paddingBottom: 20,
                    }}
                />
            </BottomSheet>

            {/* 添加拥有者 BottomSheet */}
            <BottomSheet
                ref={addOwnerSheetRef}
                index={-1}
                snapPoints={addOwnerSnapPoints}
                enableDynamicSizing={true}
                enablePanDownToClose={true}
                backdropComponent={renderBackdrop}
                keyboardBehavior="interactive"
                keyboardBlurBehavior="restore"
                android_keyboardInputMode="adjustResize"
                enableHandlePanningGesture={true}
                animateOnMount={true}
            >
                <BottomSheetView style={{ flex: 1 }}>
                    <BottomSheetScrollView
                        contentContainerStyle={{
                            paddingHorizontal: 16,
                            paddingTop: 24,
                            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 // 根据键盘高度动态调整 padding
                        }}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                    >
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                                添加拥有者
                            </Text>
                            <TouchableOpacity onPress={handleCloseAddOwnerModal}>
                                <MaterialIcons name="close" size={24} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        <View className="gap-4">
                            <View className="gap-2">
                                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                                    钱包地址
                                </Text>
                                <View className="flex-row gap-2 items-center">
                                    <BottomSheetTextInput
                                        className="flex-1 px-4 py-3 rounded-xl border text-sm font-mono"
                                        style={{
                                            backgroundColor: colors.backgroundSecondary,
                                            borderColor: colors.border,
                                            borderWidth: 1,
                                            color: colors.text,
                                        }}
                                        placeholder="0x..."
                                        placeholderTextColor={colors.textTertiary}
                                        value={tempOwnerAddress}
                                        onChangeText={setTempOwnerAddress}
                                        editable={!isCreating}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        returnKeyType="done"
                                        blurOnSubmit={true}
                                    />
                                    <TouchableOpacity
                                        className="w-12 h-12 rounded-xl items-center justify-center"
                                        style={{
                                            backgroundColor: colors.primary,
                                        }}
                                        onPress={handleScanQRCode}
                                        disabled={isCreating}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="pt-4 pb-4">
                                <Button
                                    className="w-full"
                                    color="primary"
                                    onPress={handleConfirmAddOwner}
                                    disabled={!tempOwnerAddress || isCreating}
                                >
                                    <Text className="text-base font-semibold text-white">
                                        确认添加
                                    </Text>
                                </Button>
                            </View>
                        </View>
                    </BottomSheetScrollView>
                </BottomSheetView>
            </BottomSheet>
        </SafeAreaView>
    );
}
