import { View, Text, TouchableOpacity, Alert, Animated, StyleSheet, ImageBackground } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { Colors } from "@/config/theme";
import { useSwitchChain, useChainId, useDisconnect } from "wagmi";
import { useAvatarGenerator } from "@/hooks/useAvatarGenerator";
import Jazzicon from "react-native-jazzicon";
import { formatAddress } from "@/utils/common";
import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppKit, useAccount } from '@reown/appkit-react-native';
import { Image } from "expo-image";
import { useUserStore } from "@/store";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetFooterProps
} from "@gorhom/bottom-sheet";
import { api } from "@/services/api/api";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/Button";
import type { ISafeInfo, IToken } from "@/services/api/types";
import { useAppStore } from "@/store";
import { NetworkSelector, type Network } from "@/components/NetworkSelector";
import { TokenIcon } from "@/components/TokenIcon";
import { formatUnits, type Address } from "viem";
import { ScrollView } from "react-native";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { tokenABI } from "@/utils/ABI/token";
import { tokenStakeABI } from "@/utils/ABI/token_stake";
enum TokenType {
  REGULAR_BENEFITS = "REGULAR_BENEFITS",
  STAKE = "STAKE",
  EQUITY = "EQUITY",
}
// 骨架屏项组件
function SkeletonItem({ colors }: { colors: typeof Colors.dark }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.25],
  });

  // 使用边框颜色作为基础，更浅
  const skeletonColor = colors.border || colors.textTertiary;

  return (
    <View
      className="rounded-xl p-4 mb-3 flex-row items-center"
      style={{ backgroundColor: colors.background }}
    >
      <Animated.View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: skeletonColor,
          opacity,
        }}
      />
      <View className="ml-3 flex-1">
        <Animated.View
          style={{
            width: 120,
            height: 16,
            borderRadius: 8,
            backgroundColor: skeletonColor,
            opacity,
          }}
        />
      </View>
      <Animated.View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: skeletonColor,
          opacity,
          marginLeft: 8,
        }}
      />
      <Animated.View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: skeletonColor,
          opacity,
          marginLeft: 8,
        }}
      />
    </View>
  );
}

// 骨架屏列表组件
function SkeletonList({ colors }: { colors: typeof Colors.dark }) {
  return (
    <View>
      <SkeletonItem colors={colors} />
      <SkeletonItem colors={colors} />
      <SkeletonItem colors={colors} />
    </View>
  );
}

// 代币列表项组件
function TokenListItem({
  token,
  colors,
  userAddress,
  chainId
}: {
  token: IToken;
  colors: typeof Colors.dark;
  userAddress?: string;
  chainId?: number;
}) {
  const redeemSheetRef = useRef<BottomSheetModal>(null);
  const [redeemVisible, setRedeemVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const redeemingIndexRef = useRef<number | null>(null);
  const router = useRouter();
  // 解析 token 的 chainId（可能是十六进制字符串或数字字符串）
  const tokenChainId = useMemo(() => {
    if (!token.chain?.chain_id) return null;
    const chainIdStr = token.chain.chain_id;
    // 如果是十六进制格式（0x开头），转换为数字
    if (chainIdStr.startsWith('0x') || chainIdStr.startsWith('0X')) {
      return parseInt(chainIdStr, 16);
    }
    // 否则直接解析为数字
    return parseInt(chainIdStr, 10);
  }, [token.chain?.chain_id]);

  // 检查 token 是否在当前链上
  const isTokenOnCurrentChain = useMemo(() => {
    return chainId !== undefined && tokenChainId !== null && chainId === tokenChainId;
  }, [chainId, tokenChainId]);

  // 获取代币余额
  const { data: balance, isLoading: isLoadingBalance } = useReadContract({
    address: token.address as Address,
    abi: tokenABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress as Address] : undefined,
    query: {
      enabled: !!token.address && !!userAddress && isTokenOnCurrentChain,
    },
    chainId: chainId,
  });

  // 获取待领取分红（仅对 REGULAR_BENEFITS 类型）
  const isRegularBenefits = token.type === TokenType.REGULAR_BENEFITS;
  const {
    data: pendingDividends,
    isLoading: isLoadingDividends,
    refetch: refetchPendingDividends
  } = useReadContract({
    address: token.address as Address,
    abi: tokenABI,
    functionName: 'getPendingDividends',
    args: userAddress ? [userAddress as Address] : undefined,
    query: {
      enabled: isRegularBenefits && !!token.address && !!userAddress && isTokenOnCurrentChain,
    },
    chainId: chainId,
  });

  // 领取分红
  const {
    writeContract: writeClaimDividends,
    isPending: isClaiming,
    data: claimTxHash,
    error: claimError,
  } = useWriteContract();

  // 等待交易确认
  const { data: claimReceipt, isLoading: isWaitingClaim } = useWaitForTransactionReceipt({
    hash: claimTxHash,
    query: {
      enabled: !!claimTxHash,
      retry: 3,
      retryDelay: 2000,
    },
  });

  const { data: userStakeInfo, isLoading: isLoadingStakeInfo, refetch: refetchUserStakeInfo } = useReadContract({
    address: token.address as Address,
    abi: tokenStakeABI,
    functionName: 'getUserStakeInfo',
    args: userAddress ? [userAddress as Address] : undefined,
    query: {
      enabled: token.type === TokenType.STAKE && !!token.address && !!userAddress && isTokenOnCurrentChain,
    },
    chainId: chainId,
  });
  const stakeAmount = useMemo(() => {
    if (!userStakeInfo) return 0n;
    const amount = userStakeInfo[1] as bigint;
    return amount ?? 0n;
  }, [userStakeInfo]);
  const canRedeem = useMemo(() => {
    if (!isTokenOnCurrentChain) return false;
    if (isLoadingStakeInfo) return false;
    if (!userAddress || !token.address) return false;
    return stakeAmount > 0n;
  }, [isTokenOnCurrentChain, isLoadingStakeInfo, userAddress, token.address, stakeAmount]);
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
    if (!redeemVisible) return [];
    if (!userAddress || !token.address || !isTokenOnCurrentChain) return [];
    if (!stakeLength || stakeLength <= 0) return [];
    return Array.from({ length: stakeLength }, (_, i) => ({
      address: token.address as Address,
      abi: tokenStakeABI,
      functionName: 'getUserStake' as const,
      args: [userAddress as Address, BigInt(i)],
      chainId,
    }));
  }, [redeemVisible, userAddress, token.address, isTokenOnCurrentChain, stakeLength, chainId]);
  const { data: stakeDetails, isLoading: isLoadingStakeDetails, refetch: refetchStakeDetails } = useReadContracts({
    contracts: redeemContracts,
    allowFailure: false,
    query: {
      enabled: redeemVisible && !!redeemContracts.length,
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
  const handleOpenRedeemSheet = useCallback(() => {
    if (!canRedeem) return;
    router.push({
      pathname: '/redeem' as any,
      params: { tokenAddress: token.address }
    });
    // setRedeemVisible(true);
    // redeemSheetRef.current?.present();
    // refetchStakeDetails();
  }, [canRedeem, refetchStakeDetails]);
  const handleCloseRedeemSheet = useCallback(() => {
    setRedeemVisible(false);
    redeemSheetRef.current?.dismiss();
  }, []);

  // 赎回交易
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
    if (!isTokenOnCurrentChain || !userAddress || !token.address) return;
    redeemingIndexRef.current = index;
    writeRedeem({
      address: token.address as Address,
      abi: tokenStakeABI,
      functionName: 'redeem',
      args: [BigInt(index)],
      chainId,
    });
  }, [isTokenOnCurrentChain, userAddress, token.address, writeRedeem, chainId]);

  // 交易确认成功后刷新待领取分红数据
  useEffect(() => {
    if (claimReceipt && claimReceipt.status === 'success') {
      refetchPendingDividends();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (claimReceipt && claimReceipt.status === 'reverted') {
      Alert.alert('错误', '领取分红交易失败');
    }
  }, [claimReceipt, refetchPendingDividends]);

  // 处理交易错误
  useEffect(() => {
    if (claimError) {
      console.error('领取分红错误:', claimError);
      Alert.alert('错误', claimError.message || '领取分红失败，请稍后重试');
    }
  }, [claimError]);

  // 检查是否可以领取分红
  const canClaimDividends = useMemo(() => {
    if (!isRegularBenefits) return false;
    if (!isTokenOnCurrentChain) return false;
    if (!userAddress || !token.address) return false;
    if (isClaiming || isWaitingClaim) return false;
    // 检查待领取分红是否大于0
    if (!pendingDividends || pendingDividends === 0n) return false;
    return true;
  }, [isRegularBenefits, isTokenOnCurrentChain, userAddress, token.address, isClaiming, isWaitingClaim, pendingDividends]);

  // 处理领取分红
  const handleClaimDividends = useCallback(() => {
    if (!canClaimDividends || !userAddress || !token.address) return;

    try {
      writeClaimDividends({
        address: token.address as Address,
        abi: tokenABI,
        functionName: 'claimDividends',
        args: [userAddress as Address],
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('领取分红失败:', error);
      Alert.alert('错误', '领取分红失败，请稍后重试');
    }
  }, [canClaimDividends, userAddress, token.address, writeClaimDividends]);

  // 格式化余额显示
  const formatBalance = () => {
    // 如果 token 不在当前链上，显示提示
    if (!isTokenOnCurrentChain) {
      return "请切换到对应链";
    }

    if (isLoadingBalance) {
      return "加载中...";
    }

    if (!balance) {
      return "0";
    }

    try {
      const formatted = formatUnits(balance as bigint, token.decimals);
      const num = parseFloat(formatted);

      // 如果余额为0，直接返回0
      if (num === 0) {
        return "0";
      }

      // 如果余额很小（小于0.000001），使用科学计数法显示
      if (num > 0 && num < 0.000001) {
        return num.toExponential(2);
      }

      // 如果是整数，直接返回整数部分
      if (num % 1 === 0) {
        return num.toString();
      }

      // 否则保留最多6位小数，但移除末尾的0
      return num.toFixed(6).replace(/\.?0+$/, '');
    } catch (error) {
      console.error('格式化余额失败:', error);
      return "0";
    }
  };

  // 格式化待领取分红显示
  const formatPendingDividends = () => {
    // 如果不是 REGULAR_BENEFITS 类型，显示 ---
    if (!isRegularBenefits) {
      return "---";
    }

    // 如果 token 不在当前链上，显示提示
    if (!isTokenOnCurrentChain) {
      return "请切换到对应链";
    }

    if (isLoadingDividends) {
      return "加载中...";
    }

    if (!pendingDividends) {
      return "0";
    }

    try {
      const formatted = formatUnits(pendingDividends as bigint, token.decimals);
      const num = parseFloat(formatted);

      // 如果分红为0，直接返回0
      if (num === 0) {
        return "0";
      }

      // 如果分红很小（小于0.000001），使用科学计数法显示
      if (num > 0 && num < 0.000001) {
        return num.toExponential(2);
      }

      // 如果是整数，直接返回整数部分
      if (num % 1 === 0) {
        return num.toString();
      }

      // 否则保留最多6位小数，但移除末尾的0
      return num.toFixed(6).replace(/\.?0+$/, '');
    } catch (error) {
      console.error('格式化待领取分红失败:', error);
      return "0";
    }
  };


  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={{
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
          paddingHorizontal: 16,
          backgroundColor: colors.background, // 确保背景色遮住下方内容
        }}>
          <Button color="primary" onPress={() => { }}>
            赎回
          </Button>
        </View>
      </BottomSheetFooter>
    ),
    [insets.bottom]
  );

  return (
    <View
      className="mb-4 p-4 rounded-xl"
      style={{ backgroundColor: colors.backgroundSecondary }}
    >
      {/* 顶部：代币图标、名称和分享图标 */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center flex-1">
          <TokenIcon symbol={token.symbol} chainId={token.chain?.chain_id} size={40} />
          <Text className="text-base font-semibold ml-2.5" style={{ color: colors.text }}>
            {token.symbol}
          </Text>
        </View>
      </View>

      {/* 交易详情 */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2.5">
          <Text className="text-sm" style={{ color: colors.textSecondary }}>余额</Text>
          <Text className="text-sm" style={{ color: colors.text }}>{formatBalance()}</Text>
        </View>
        <View className="flex-row items-center justify-between mb-2.5">
          <Text className="text-sm" style={{ color: colors.textSecondary }}>待领取分红</Text>
          <Text className="text-sm" style={{ color: '#FF4444' }}>{formatPendingDividends()}</Text>
        </View>
        {
          token.type == TokenType.STAKE && (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm" style={{ color: colors.textSecondary }}>质押数量</Text>
              <Text className="text-sm" style={{ color: colors.text }}>
                {isLoadingStakeInfo ? '加载中...' : formatUnits(stakeAmount, token.decimals)}
              </Text>
            </View>
          )
        }
      </View>

      {/* 操作按钮 */}
      {isRegularBenefits && (
        <View className="flex-row gap-2 justify-end">
          <Button
            className="py-2.5 px-3 rounded-lg items-center border-[0px] w-[auto] min-h-[0px] min-w-[0px]"
            style={{
              backgroundColor: canClaimDividends
                ? (colors.backgroundTertiary || colors.background)
                : (colors.backgroundTertiary || colors.background),
              opacity: canClaimDividends ? 1 : 0.5,
            }}
            onPress={handleClaimDividends}
            disabled={!canClaimDividends}
          >
            <Text
              className="text-sm font-medium"
              style={{
                color: canClaimDividends ? colors.textSecondary : colors.textTertiary
              }}
            >
              {isClaiming || isWaitingClaim ? '领取中...' : '领取分红'}
            </Text>
          </Button>
        </View>
      )}

      {token.type == TokenType.STAKE && (
        <View className="flex-row gap-2 justify-end">
          <Button
            className="py-2.5 px-3 rounded-lg items-center border-[0px] w-[auto] min-h-[0px] min-w-[0px]"
            style={{
              backgroundColor: canRedeem
                ? (colors.backgroundTertiary || colors.background)
                : (colors.backgroundTertiary || colors.background),
              opacity: canRedeem ? 1 : 0.5,
            }}
            onPress={handleOpenRedeemSheet}
            disabled={!canRedeem}
          >
            <Text
              className="text-sm font-medium"
              style={{
                color: canRedeem ? colors.textSecondary : colors.textTertiary
              }}
            >
              {'赎回'}
              {/* {isClaiming || isWaitingClaim ? '赎回中...' : '赎回'} */}
            </Text>
          </Button>
        </View>
      )}

      <BottomSheetModal
        ref={redeemSheetRef}
        snapPoints={['50%', '80%']}
        enableDynamicSizing={false}
        enablePanDownToClose={true}
        backdropComponent={(props) => <BottomSheetBackdrop appearsOnIndex={0} disappearsOnIndex={-1} {...props} />}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
        onDismiss={handleCloseRedeemSheet}
        activeOffsetY={[-50, 50]}
        footerComponent={renderFooter}
      >
        <BottomSheetScrollView
          style={{ paddingHorizontal: 16, paddingTop: 8 }}
          bounces={true}
          alwaysBounceVertical={true}  // 即使内容不满一屏也允许回弹手势传递
          overScrollMode="always"      // 允许 Android 上的越界
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: insets.bottom + 40
          }}>
          <View className="mb-3">
            <Text className="text-base font-semibold" style={{ color: colors.text }}>赎回明细</Text>
            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
              {stakeLength > 0 ? `共 ${stakeLength} 笔质押` : '暂无可赎回记录'}
            </Text>
          </View>
          {isLoadingStakeDetails && (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>加载中...</Text>
          )}
          {!isLoadingStakeDetails && parsedStakes.map((s, idx) => (
            <StakeRedeemRow
              key={idx}
              s={s}
              idx={idx}
              tokenDecimals={token.decimals}
              colors={colors}
              onRedeem={onRedeem}
            />
          ))}
          {!isLoadingStakeDetails && parsedStakes.length === 0 && (
            <Text className="text-sm" style={{ color: colors.textTertiary }}>暂无数据</Text>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
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
  return (
    <View className="mb-3 p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
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
      {s.canRedeem && (
        <View className="mt-2 items-end">
          <Button
            color="primary"
            onPress={() => onRedeem(idx)}
            className="py-1 px-2 w-[auto] min-h-[0] min-w-[0]"
          >
            <Text className="text-sm" style={{ color: colors.textSecondary }}>赎回</Text>
          </Button>
        </View>
      )}
    </View>
  );
}

// 默认网络列表
const defaultNetworks: Network[] = [
  { id: 1, name: 'Ethereum', chainId: 1 },
  { id: 2, name: 'Optimism', chainId: 10 },
  { id: 3, name: 'BSC', chainId: 56 },
  { id: 4, name: 'Polygon', chainId: 137 },
  { id: 5, name: 'Base', chainId: 8453 },
  { id: 6, name: 'Arbitrum', chainId: 42161 },
  { id: 7, name: 'Sepolia', chainId: 11155111 },
];

export default function Wallet() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { address, chainId, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const { generateAvatar } = useAvatarGenerator();
  const { open } = useAppKit();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [safes, setSafes] = useState<string[]>([]);
  const [loadingSafes, setLoadingSafes] = useState(false);
  const [safeInfos, setSafeInfos] = useState<Record<string, ISafeInfo>>({});
  const insets = useSafeAreaInsets();
  // 跟踪正在加载的 Safe 地址，防止重复请求
  const loadingSafeAddresses = useRef<Set<string>>(new Set());
  // 代币列表相关状态
  const [tokens, setTokens] = useState<IToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  // 获取 tabbar 高度，用于设置底部内边距
  const tabBarHeight = useBottomTabOverflow();

  // 从 store 获取当前选中的 Safe 地址
  const selectedSafeAddress = useAppStore((state) => state.selectedSafeAddress);
  const setSelectedSafeAddress = useAppStore((state) => state.setSelectedSafeAddress);

  // 获取用户信息
  const { userInfo, isLoggedIn } = useUserStore();

  // 当前显示的地址：优先使用选中的 Safe 地址，如果没有则使用连接的钱包地址
  const displayAddress = selectedSafeAddress || address;

  const avatarSeed = useMemo(() => {
    if (!displayAddress) return null;
    return generateAvatar(displayAddress);
  }, [displayAddress, generateAvatar]);

  // 根据 chainId 获取当前选中的网络
  const selectedNetwork = useMemo(() => {
    const chainIdToUse = currentChainId || chainId;
    if (!chainIdToUse) {
      return defaultNetworks[6]; // 默认 Sepolia
    }
    return defaultNetworks.find(n => n.chainId === chainIdToUse) || defaultNetworks[6];
  }, [currentChainId, chainId]);

  // 切换网络的处理函数
  const handleSelectNetwork = useCallback(async (network: Network) => {
    if (!switchChainAsync) {
      Alert.alert('错误', '无法切换网络，请确保钱包已连接');
      return;
    }

    try {
      await switchChainAsync({ chainId: network.chainId as number });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('切换网络失败:', error);
      Alert.alert('切换失败', (error as Error)?.message || '请稍后重试');
    }
  }, [switchChainAsync]);

  const allAddresses = useMemo(() => {
    const addresses: string[] = [];
    if (address) {
      addresses.push(address);
    }
    addresses.push(...safes);
    return addresses;
  }, [address, safes]);

  // 如果选中的 Safe 地址不在 Safe 列表中，则重置为 null
  useEffect(() => {
    if (selectedSafeAddress && safes.length > 0 && !safes.includes(selectedSafeAddress)) {
      setSelectedSafeAddress(null);
    }
  }, [selectedSafeAddress, safes, setSelectedSafeAddress]);

  // 为所有地址生成头像映射
  const addressAvatars = useMemo(() => {
    const avatars: Record<string, number | null> = {};
    allAddresses.forEach((addr) => {
      avatars[addr] = generateAvatar(addr);
    });
    return avatars;
  }, [allAddresses, generateAvatar]);

  // 获取 Safe 信息
  const fetchSafeInfo = useCallback(async (safeAddress: string) => {
    if (!chainId) return;

    // 如果正在加载，跳过
    if (loadingSafeAddresses.current.has(safeAddress)) return;

    try {
      loadingSafeAddresses.current.add(safeAddress);
      const response = await api.safe.getSafeInfo(chainId as number, safeAddress);
      if (response.success && response.data) {
        setSafeInfos(prev => ({ ...prev, [safeAddress]: response.data }));
      }
    } catch (error) {
      console.error(`获取 Safe 信息失败 (${safeAddress}):`, error);
    } finally {
      loadingSafeAddresses.current.delete(safeAddress);
    }
  }, [chainId]);

  // 获取 Safe 地址列表
  const fetchSafes = useCallback(async () => {
    if (!address || !chainId) {
      setSafes([]);
      return;
    }

    try {
      setLoadingSafes(true);
      const response = await api.safe.getSafesByOwnerAddress(chainId as number, address);
      if (response.success && response.data) {
        const safeAddresses = response.data.safes || [];
        setSafes(safeAddresses);

        // 为每个 Safe 地址获取详细信息
        safeAddresses.forEach((safeAddress) => {
          fetchSafeInfo(safeAddress);
        });
      } else {
        setSafes([]);
        console.error('获取 Safe 列表失败:', response.message);
      }
    } catch (error) {
      console.error('获取 Safe 列表失败:', error);
      setSafes([]);
    } finally {
      setLoadingSafes(false);
    }
  }, [address, chainId, fetchSafeInfo]);

  // 打开底部弹出层并获取数据
  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
    fetchSafes();
  }, [fetchSafes]);

  // 关闭底部弹出层
  const handleCloseModal = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  // 断开钱包连接
  const handleDisconnect = useCallback(() => {
    Alert.alert(
      '确认断开',
      '您确定要断开钱包连接吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确认',
          style: 'destructive',
          onPress: () => {
            disconnect();
            setSelectedSafeAddress(null);
            handleCloseModal();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  }, [disconnect, setSelectedSafeAddress, handleCloseModal]);

  // 复制地址到剪贴板
  const handleCopyAddress = useCallback(async (addr: string) => {
    try {
      await Clipboard.setStringAsync(addr);
      // 触觉反馈
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // 显示提示（可以使用 Toast，这里先用简单的 Alert）
    } catch (error) {
      console.error('复制失败:', error);
      // Alert.alert('复制失败', '请稍后重试');
    }
  }, []);

  // 自定义背景遮罩
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const handleNavigateToNewSafe = () => {
    router.push('/new-safe');
  };

  // 导航到 Safe 设置页面
  const handleNavigateToSafeSettings = useCallback((safeAddress: string) => {
    handleCloseModal();
    router.push({
      pathname: '/safe-settings' as any,
      params: { safeAddress },
    });
  }, [router, handleCloseModal]);

  // 获取代币列表
  const fetchTokenList = useCallback(async () => {
    try {
      setLoadingTokens(true);
      const response = await api.token.getTokenList();
      if (response.success && response.data) {
        setTokens(response.data.tokens || []);
      }
    } catch (error) {
      console.error('获取代币列表失败:', error);
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  // 组件挂载时获取代币列表
  useEffect(() => {
    fetchTokenList();
  }, [fetchTokenList]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* 顶部栏：左上角显示钱包地址和头像，右上角显示网络选择器 */}
      <View className="flex-row items-center justify-between px-5 pt-2.5 pb-5">
        {/* 左上角：钱包地址和头像或连接钱包按钮 */}
        {displayAddress ? (
          <TouchableOpacity
            onPress={handlePresentModalPress}
            activeOpacity={0.7}
            className="flex-row items-center flex-1"
          >
            {avatarSeed !== null && (
              <Jazzicon size={32} seed={avatarSeed} />
            )}
            <Text className="text-sm font-medium ml-2.5" style={{ color: colors.text }}>
              {formatAddress(displayAddress)}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View>
            <Button
              color="primary"
              onPress={() => open({ view: 'Connect' })}
              // className="py-2.5 px-3 rounded-lg items-center border-[0px] w-[auto] min-h-[0px] min-w-[0px]"
              className="px-4 py-2 w-[auto] min-h-[0] min-w-[0]"
            >
              <Text className="text-sm font-medium" style={{ color: colors.text }}>连接钱包</Text>
            </Button>
          </View>
        )}

        {/* 右上角：网络选择器 */}
        {
          isConnected && (
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onSelectNetwork={handleSelectNetwork}
              networks={defaultNetworks}
            />
          )
        }
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: tabBarHeight + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 用户信息卡片 */}
        {isLoggedIn && userInfo && (
          <ImageBackground
            source={require('@/assets/images/Banner.png')}
            style={{
              marginBottom: 16,
              borderRadius: 16,
              overflow: 'hidden',
            }}
            imageStyle={{
              borderRadius: 16,
            }}
            resizeMode="cover"
          >
            <View
              className="p-4 flex-row items-center"
              style={{
                minHeight: 120,
              }}
            >
              {/* 左侧：头像和用户ID */}
              <View className="flex-1">
                {/* 头像 */}
                <View className="mb-3">
                  {userInfo.avatar ? (
                    <Image
                      source={{ uri: userInfo.avatar }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        borderWidth: 2,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: colors.primary || colors.tint,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 24,
                          fontWeight: '700',
                          color: '#FFFFFF',
                        }}
                      >
                        {userInfo.username?.charAt(0)?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                </View>
                {/* 用户ID */}
                <View className="flex-row items-center">
                  <Text className="text-sm mr-2" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    用户ID:
                  </Text>
                  <Text className="text-sm flex-1" style={{ color: '#FFFFFF', fontFamily: 'monospace' }}>
                    {userInfo.id || 'N/A'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (userInfo.id) {
                        handleCopyAddress(userInfo.id);
                        Alert.alert('已复制', '用户ID已复制到剪贴板');
                      }
                    }}
                    activeOpacity={0.7}
                    className="ml-2 p-1"
                  >
                    <MaterialIcons name="content-copy" size={16} color="rgba(255, 255, 255, 0.8)" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ImageBackground>
        )}

        {/* 代币列表 */}
        {loadingTokens ? (
          <View className="items-center justify-center py-10">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>加载中...</Text>
          </View>
        ) : tokens.length === 0 ? (
          <View className="items-center justify-center py-10">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>暂无代币</Text>
          </View>
        ) : (
          tokens.map((token) => (
            <TokenListItem
              key={token.id}
              token={token}
              colors={colors}
              userAddress={displayAddress}
              chainId={currentChainId || chainId as number}
            />
          ))
        )}
      </ScrollView>

      {/* 钱包信息底部弹出层 */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        snapPoints={[500]}
        enableDynamicSizing={false}
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        enableOverDrag={false}
        enableContentPanningGesture={true}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.backgroundSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
        animateOnMount={true}
        index={0}
      >
        <View style={{ flex: 1 }}>
          {/* 顶部标题栏 */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Text className="text-lg font-semibold" style={{ color: colors.text }}>
              我的账户
            </Text>
            {address && (
              <Button
                color="error"
                variant="outline"
                onPress={handleDisconnect}
                className="px-3 py-1.5"
                style={{ minHeight: 32 }}
                textStyle={{ fontSize: 14 }}
              >
                断开钱包
              </Button>
            )}
          </View>

          <BottomSheetScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 80, // 为底部按钮留出空间
            }}
          >

            {loadingSafes ? (
              <SkeletonList colors={colors} />
            ) : allAddresses.length === 0 ? (
              <View className="rounded-xl p-4 items-center" style={{ backgroundColor: colors.background }}>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  暂无地址
                </Text>
              </View>
            ) : (
              allAddresses.map((addr, index) => {
                const addrAvatar = addressAvatars[addr];
                const isSafe = safes.includes(addr);
                const safeInfo = safeInfos[addr];
                const thresholdText = safeInfo ? `${safeInfo.threshold}/${safeInfo.owners.length}` : null;
                const isSelected = displayAddress === addr;

                return (
                  <TouchableOpacity
                    key={`${addr}-${index}`}
                    className="rounded-xl p-4 mb-3 flex-row items-center"
                    style={{
                      backgroundColor: isSelected ? colors.backgroundTertiary : colors.background,
                    }}
                    activeOpacity={0.7}
                    onPress={() => {
                      // 只设置 Safe 地址，不设置 EOA 地址
                      if (isSafe) {
                        setSelectedSafeAddress(addr);
                      } else {
                        setSelectedSafeAddress(null);
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleCloseModal();
                    }}
                  >
                    <View className="relative">
                      {addrAvatar !== null && (
                        <Jazzicon size={40} seed={addrAvatar} />
                      )}
                      {isSafe && thresholdText && (
                        <View
                          className="absolute -top-1 -right-1 rounded-full border-2 items-center justify-center"
                          style={{
                            minWidth: 24,
                            height: 24,
                            paddingHorizontal: 4,
                            backgroundColor: colors.primary,
                            borderColor: colors.background,
                          }}
                        >
                          <Text
                            className="text-xs font-bold"
                            style={{
                              color: '#FFFFFF',
                              fontSize: 10,
                            }}
                          >
                            {thresholdText}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-semibold mb-1" style={{ color: colors.text }}>
                        {formatAddress(addr)}
                      </Text>
                    </View>
                    {isSafe && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleNavigateToSafeSettings(addr);
                        }}
                        activeOpacity={0.6}
                        className="ml-1 p-2"
                      >
                        <MaterialIcons name="settings" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleCopyAddress(addr);
                      }}
                      activeOpacity={0.6}
                      className="ml-2 p-2"
                    >
                      <MaterialIcons name="content-copy" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.6}
                      className="ml-1 p-2"
                    >
                      <MaterialIcons name="qr-code" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </BottomSheetScrollView>

          {/* 创建 Safe 账户按钮 - 固定在底部 */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 16,
              paddingBottom: insets.bottom || 0,
              paddingTop: 8,
              backgroundColor: colors.backgroundSecondary,
            }}
          >
            <Button
              color="primary"
              onPress={() => {
                handleCloseModal();
                handleNavigateToNewSafe();
              }}
              className="w-full"
            >
              创建 Safe 账户
            </Button>
          </View>
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
}
