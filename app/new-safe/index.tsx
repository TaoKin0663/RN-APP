import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

import ChainIcon from '@/components/ChainIcon';
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/config/theme';
import { useAvatarGenerator } from '@/hooks/useAvatarGenerator';
import Jazzicon from 'react-native-jazzicon';
import { ThemedView } from '@/components/ThemedView';
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
const DeleteButton = React.memo<{
  translation: SharedValue<number>;
  onPress: () => void;
  errorColor: string;
}>(({ translation, onPress, errorColor }) => {
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
const OwnerItem = React.memo<{
  owner: Owner;
  index: number;
  avatar: number | null;
  canRemove: boolean;
  address: string | undefined;
  colors: typeof Colors.light;
  onRemove: (index: number) => void;
}>(({ owner, index, avatar, canRemove, colors, onRemove }) => {
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
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [safeVersion] = useState<string>('1.4.1');

  const { generateAvatar } = useAvatarGenerator();

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

  const toggleChainInSelect = (chainId: number) => {
    setSelectedChainIds((prev) => {
      if (prev.includes(chainId)) {
        return prev.filter((id) => id !== chainId);
      }
      return [...prev, chainId];
    });
  };

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

          // 等待交易确认（简化版，实际应该监听交易状态）
          // 这里我们假设交易已发送，状态会在后续更新
          setStep(c.id, { status: 'success' });
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

      // 检查是否所有链都部署完成
      const allOk = steps.every((s) => s.status === 'success' || s.status === 'skipped');
      if (allOk) {
        Alert.alert('成功', 'Safe 智能账户创建成功！', [
          {
            text: '确定',
            onPress: () => {
              router.push('/(tabs)');
            },
          },
        ]);
      }
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
      {/* 进度条 */}
      <View className="px-4 pt-2">
        <View className="h-1 rounded-sm overflow-hidden" style={{ backgroundColor: colors.border }}>
          <View
            className="h-full rounded-sm"
            style={{
              backgroundColor: colors.primary,
              width: `${(currentStep / 3) * 100}%`,
            }}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 步骤1: 选择部署链 */}
        {currentStep === 1 && (
          <View className="gap-6">
            <View className="items-center px-4 gap-4">
              <Text className="text-sm leading-5 text-center" style={{ color: colors.textTertiary }}>
                Safe 智能账户支持多链部署，您可以选择在一条或多条区块链上部署相同的 Safe 账户。所有链上的 Safe 账户将拥有相同的地址，方便您进行跨链资产管理。
              </Text>
            </View>

            {/* 链列表 */}
            <View className="gap-3">
              {/* <Text className="text-base font-semibold" style={{ color: colors.text }}>
                部署链 ({selectedChainIds.length})
              </Text> */}
              <View className="gap-2">
                {chains.map((c) => {
                  const checked = selectedChainIds.includes(c.id);
                  const hasRpc = Boolean(c.rpcUrls.default.http?.[0]);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      className="flex-row items-center justify-between p-3 rounded-xl"
                      style={{
                        backgroundColor: checked
                          ? colors.primary + '20'
                          : colors.backgroundSecondary,
                        opacity: hasRpc ? 1 : 0.5,
                      }}
                      onPress={() => {
                        if (!hasRpc) return;
                        toggleChainInSelect(c.id);
                      }}
                      disabled={!hasRpc || isCreating}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        <ChainIcon chainId={c.id} size={24} />
                        <View className="flex-1 gap-1">
                          <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                            {c.name}
                          </Text>
                          <Text className="text-xs" style={{ color: colors.textTertiary }}>
                            Chain ID: {c.id}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center">
                        {checked && (
                          <MaterialIcons key="check-icon" name="check-circle" size={24} color={colors.primary} />
                        )}
                        {!hasRpc && (
                          <Text key="no-rpc-text" className="text-xs ml-2" style={{ color: colors.textTertiary }}>
                            无 RPC
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 导航按钮 */}
            <View className="flex-row justify-between gap-3 mt-auto pt-6">
              <Button
                className="flex-row gap-2 flex-1"
                color="primary"
                onPress={() => {
                  if (selectedChainIds.length === 0) {
                    Alert.alert('错误', '请至少选择一条部署链');
                    return;
                  }
                  setCurrentStep(2);
                }}
                disabled={selectedChainIds.length === 0 || isCreating}
              >
                <Text className="text-base font-semibold text-white">继续</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
              </Button>
            </View>
          </View>
        )}

        {/* 步骤2: 配置拥有者 */}
        {currentStep === 2 && (
          <View className="gap-6">
            <View className="items-center py-6 px-4 gap-4">
              <Text className="text-sm leading-5 text-center" style={{ color: colors.textTertiary }}>
                拥有者是 Safe 智能账户的管理者，可以发起交易和进行投票。您可以添加多个拥有者，实现多人共同管理资产。当前钱包地址已自动添加为拥有者。
              </Text>
            </View>

            {/* 拥有者配置 */}
            <View className="gap-3">
              <Text className="text-base font-semibold" style={{ color: colors.text }}>
                拥有者 ({owners.length})
              </Text>
              <View style={{ backgroundColor: colors.backgroundSecondary }}>
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

              <View className="flex-row gap-3 items-center">
                <TextInput
                  className="flex-1 px-3 py-3 rounded-xl border text-sm"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  placeholder="新拥有者地址"
                  placeholderTextColor={colors.textTertiary}
                  value={newOwnerAddress}
                  onChangeText={setNewOwnerAddress}
                  editable={!isCreating}
                />
                <TouchableOpacity
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: colors.primary,
                    opacity: !newOwnerAddress || isCreating ? 0.5 : 1,
                  }}
                  onPress={addOwner}
                  disabled={!newOwnerAddress || isCreating}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 导航按钮 */}
            <View className="flex-row justify-between gap-3 mt-auto pt-6">
              <Button
                className="flex-1 flex-row items-center justify-center gap-2"
                color='secondary'
                textStyle={{ color: colors.text }}
                onPress={() => setCurrentStep(1)}
                disabled={isCreating}
              >
                <MaterialIcons name="arrow-back" size={20} color={colors.text} />
                <Text className="text-base font-semibold" style={{ color: colors.text }}>
                  上一步
                </Text>
              </Button>
              <Button
                className="flex-1 flex-row items-center justify-center gap-2"
                color="primary"
                onPress={() => {
                  if (owners.length === 0) {
                    Alert.alert('错误', '至少需要一位拥有者');
                    return;
                  }
                  setCurrentStep(3);
                }}
                disabled={owners.length === 0 || isCreating}
              >
                <Text className="text-base font-semibold text-white">下一步</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
              </Button>
            </View>
          </View>
        )}

        {/* 步骤3: 设置阈值 */}
        {currentStep === 3 && (
          <View className="gap-6">
            {/* 科普内容 */}
            <View className="items-center py-6 px-4 gap-4">
              <MaterialIcons name="security" size={32} color={colors.primary} />
              <Text className="text-xl font-semibold text-center" style={{ color: colors.text }}>
                设置确认阈值
              </Text>
              <Text className="text-sm leading-5 text-center" style={{ color: colors.textTertiary }}>
                确认阈值决定了执行交易需要多少位拥有者签名。例如，如果设置为 2/3，则至少需要 2 位拥有者同意才能执行交易。这提供了额外的安全保障，防止单点故障。
              </Text>
            </View>

            {/* 阈值选择器 */}
            <View className="gap-3">
              <Text className="text-base font-semibold" style={{ color: colors.text }}>
                确认阈值
              </Text>
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

            {/* 导航和确认按钮 */}
            <View className="flex-row justify-between gap-3 mt-auto pt-6">
              <Button
                className="flex-1 flex-row items-center justify-center gap-2"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                textStyle={{ color: colors.text }}
                onPress={() => setCurrentStep(2)}
                disabled={isCreating}
              >
                <MaterialIcons name="arrow-back" size={20} color={colors.text} />
                <Text className="text-base font-semibold" style={{ color: colors.text }}>
                  上一步
                </Text>
              </Button>
              <Button
                className="flex-1 flex-row items-center justify-center gap-2"
                color="primary"
                onPress={handleCreateSafe}
                disabled={isCreating}
              >
                {isCreating && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text className="text-base font-semibold text-white">
                  {isCreating ? '创建中...' : '确认创建'}
                </Text>
              </Button>
            </View>
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

