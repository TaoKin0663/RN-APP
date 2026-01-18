import { View, Text, TouchableOpacity, Alert, ImageBackground } from "react-native"
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RelativePathString, useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { Colors } from "@/config/theme";
import { useSwitchChain, useChainId, useDisconnect, useAccount } from "wagmi";
import { useAvatarGenerator } from "@/hooks/useAvatarGenerator";
import Jazzicon from "react-native-jazzicon";
import { formatAddress } from "@/utils/common";
import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppKit } from '@reown/appkit-react-native';
import { Image } from "expo-image";
import { useUserStore } from "@/store";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { api } from "@/services/api/api";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/Button";
import type { IToken } from "@/services/api/types";
import { useAppStore } from "@/store";
import { NetworkSelector, type Network } from "@/components/NetworkSelector";
import { TokenIcon } from "@/components/TokenIcon";
import { formatUnits, type Address } from "viem";
import { ScrollView } from "react-native";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { tokenABI } from "@/utils/ABI/token";
import { tokenStakeABI } from "@/utils/ABI/token_stake";
enum TokenType {
  REGULAR_BENEFITS = "REGULAR_BENEFITS",
  STAKE = "STAKE",
  EQUITY = "EQUITY",
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
  const insets = useSafeAreaInsets();
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
  const handleOpenRedeemSheet = useCallback(() => {
    if (!canRedeem) return;
    router.push({
      pathname: '/redeem' as any,
      params: { tokenAddress: token.address }
    });
  }, [canRedeem, router, token.address]);

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
            </Text>
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
  const insets = useSafeAreaInsets();
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

  const avatarSeed = useMemo(() => {
    if (!address) return null;
    return generateAvatar(address);
  }, [address, generateAvatar]);

  // 根据 chainId 获取当前选中的网络
  const selectedNetwork = useMemo(() => {
    const chainIdToUse = currentChainId || chainId;
    if (!chainIdToUse) {
      return defaultNetworks[6]; // 默认 Sepolia
    }
    return defaultNetworks.find(n => n.chainId === chainIdToUse) || defaultNetworks[6];
  }, [currentChainId, chainId]);

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

  const handlePressSettings = useCallback(() => {
    router.push({
      pathname: '/setting' as RelativePathString,
    });
  }, [router]);

  // 打开底部弹出层并获取数据
  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

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

  const handleNavigateToAddressBook = useCallback(() => {
    handleCloseModal();
    router.push('/safe/address_book');
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


  // 链图标映射
  const chainIconMap: Record<number, any> = {
    1: require('@/assets/images/chain-icons/1.png'),
    10: require('@/assets/images/chain-icons/10.png'),
    56: require('@/assets/images/chain-icons/56.png'),
    137: require('@/assets/images/chain-icons/137.png'),
    8453: require('@/assets/images/chain-icons/8453.png'),
    42161: require('@/assets/images/chain-icons/42161.png'),
    11155111: require('@/assets/images/chain-icons/11155111.png'),
  };

  // 获取链图标
  const getChainIconSource = (chainId: string | number | null | undefined) => {
    if (!chainId) return null;

    let chainIdNumber: number;
    if (typeof chainId === 'string') {
      if (chainId.startsWith('0x') || chainId.startsWith('0X')) {
        chainIdNumber = parseInt(chainId, 16);
      } else {
        chainIdNumber = parseInt(chainId, 10);
      }
    } else {
      chainIdNumber = chainId;
    }

    if (isNaN(chainIdNumber)) return null;

    return chainIconMap[chainIdNumber] || null;
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* 顶部栏：左上角显示钱包地址和头像，右上角显示网络选择器 */}
      <View className="flex-row items-center justify-between px-5 pt-2.5 pb-5">
        {/* 左上角：钱包地址和头像或连接钱包按钮 */}
        {address ? (
          <TouchableOpacity
            onPress={handlePresentModalPress}
            activeOpacity={0.7}
            className="flex-row items-center flex-1"
          >
            {avatarSeed !== null && (
              <Jazzicon size={32} seed={avatarSeed} />
            )}
            <Text className="text-sm font-medium ml-2.5" style={{ color: colors.text }}>
              {formatAddress(address)}
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
              triggerComponent={
                <View className="flex-row items-center">
                  {getChainIconSource(selectedNetwork.chainId) ? (
                    <Image
                      source={getChainIconSource(selectedNetwork.chainId)}
                      style={{ width: 20, height: 20, borderRadius: 10, resizeMode: 'cover' }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: colors.background,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 10,
                          fontWeight: '600',
                        }}
                      >
                        {selectedNetwork.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <MaterialIcons name="arrow-drop-down" size={20} color={colors.text} />
                </View>
              }
            />
          )
        }
        <TouchableOpacity
          onPress={handlePressSettings}
          activeOpacity={0.7}
          className="ml-2 p-2"
        >
          <MaterialIcons name="settings" size={22} color={colors.text} />
        </TouchableOpacity>
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
                {/* 头像 + 用户名 */}
                <View className="mb-3 flex-row items-center">
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
                  <ThemedText
                    className="ml-3"
                    style={{
                      fontSize: 16
                    }}
                  >
                    {userInfo.username}
                  </ThemedText>
                </View>
                {/* 用户ID */}
                {/* <View className="flex-row items-center">
                  <View>
                    <ThemedText className="text-sm mr-2">
                      用户ID:
                    </ThemedText>
                  </View>
                  <ThemedText className="text-sm flex-1">
                    {userInfo.id || 'N/A'}
                  </ThemedText>
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
                    <MaterialIcons name="content-copy" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View> */}
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
              userAddress={address}
              chainId={currentChainId || chainId as number}
            />
          ))
        )}
      </ScrollView>

      {/* 钱包信息底部弹出层 */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        snapPoints={[]}
        enableDynamicSizing={true}
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        enableOverDrag={false}
        enableContentPanningGesture={true}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
        animateOnMount={false}
        index={0}
      >
        <BottomSheetView style={{ paddingBottom: insets.bottom + 20 }}>
          {/* 顶部标题栏 */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Text className="text-lg font-semibold" style={{ color: colors.text }}>
              我的账户
            </Text>
          </View>


          {address ? (
            <View
              className="rounded-xl p-4 mb-3 items-center"
              style={{ backgroundColor: colors.background }}
            >
              {avatarSeed !== null && <Jazzicon size={65} seed={avatarSeed} />}
              <View className="flex-row mt-2 items-center justify-center">
                <Text
                  className="text-md font-semibold"
                  style={{ color: colors.text, textAlign: 'center' }}
                >
                  {formatAddress(address)}
                </Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleCopyAddress(address);
                  }}
                  activeOpacity={0.6}
                  className="px-2"
                >
                  <MaterialIcons name="content-copy" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.6} className="px-2">
                  <MaterialIcons name="qr-code" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="rounded-xl p-4 items-center" style={{ backgroundColor: colors.background }}>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                请先连接钱包
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleNavigateToAddressBook}
            activeOpacity={0.7}
            className="mt-2 rounded-xl px-4 py-5 flex-row items-center justify-between"
            style={{ backgroundColor: colors.background }}
          >
            <Text className="text-md font-semibold" style={{ color: colors.text }}>
              多签账户
            </Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <NetworkSelector
            selectedNetwork={selectedNetwork}
            onSelectNetwork={handleSelectNetwork}
            networks={defaultNetworks}
            triggerComponent={
              <View
                className="mt-2 rounded-xl px-4 py-5 flex-row items-center justify-between"
                style={{ backgroundColor: colors.background }}
              >
                <Text className="text-md font-semibold" style={{ color: colors.text }}>
                  切换网络
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            }
          />

          {address && (
            <TouchableOpacity
              onPress={handleDisconnect}
              activeOpacity={0.7}
              className="mt-2 rounded-xl px-4 py-3 flex-row items-center justify-center gap-2"
              style={{ backgroundColor: colors.background }}
            >
              <MaterialIcons name="power-settings-new" size={20} color={'#ef4444'}/>
              <Text className="text-md font-semibold text-red-500">
                断开钱包
              </Text>
            </TouchableOpacity>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}
