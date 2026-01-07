import { View, Text, TouchableOpacity, Alert, Animated } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { Colors } from "@/config/theme";
import { useAccount } from "wagmi";
import { useAvatarGenerator } from "@/hooks/useAvatarGenerator";
import Jazzicon from "react-native-jazzicon";
import { formatAddress } from "@/utils/common";
import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { api } from "@/services/api/api";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/Button";
import type { ISafeInfo } from "@/services/api/types";
import { useAppStore } from "@/store";

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

export default function Wallet() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { address, chainId } = useAccount();
  const { generateAvatar } = useAvatarGenerator();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [safes, setSafes] = useState<string[]>([]);
  const [loadingSafes, setLoadingSafes] = useState(false);
  const [safeInfos, setSafeInfos] = useState<Record<string, ISafeInfo>>({});
  const insets = useSafeAreaInsets();
  // 跟踪正在加载的 Safe 地址，防止重复请求
  const loadingSafeAddresses = useRef<Set<string>>(new Set());

  // 从 store 获取当前选中的账户地址
  const selectedAccountAddress = useAppStore((state) => state.selectedAccountAddress);
  const setSelectedAccountAddress = useAppStore((state) => state.setSelectedAccountAddress);

  // 当前显示的地址：优先使用选中的地址，如果没有则使用连接的钱包地址
  const displayAddress = selectedAccountAddress || address;

  const avatarSeed = useMemo(() => {
    if (!displayAddress) return null;
    return generateAvatar(displayAddress);
  }, [displayAddress, generateAvatar]);

  const allAddresses = useMemo(() => {
    const addresses: string[] = [];
    if (address) {
      addresses.push(address);
    }
    addresses.push(...safes);
    return addresses;
  }, [address, safes]);

  // 当连接的钱包地址变化时，如果当前没有选中的地址，则自动选中连接的钱包地址
  useEffect(() => {
    if (address && !selectedAccountAddress) {
      setSelectedAccountAddress(address);
    }
  }, [address, selectedAccountAddress, setSelectedAccountAddress]);

  // 如果选中的地址不在账户列表中，则重置为连接的钱包地址
  useEffect(() => {
    if (selectedAccountAddress && allAddresses.length > 0 && !allAddresses.includes(selectedAccountAddress)) {
      setSelectedAccountAddress(address || null);
    }
  }, [selectedAccountAddress, allAddresses, address, setSelectedAccountAddress]);

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
      const response = await api.safe.getSafeInfo(chainId, safeAddress);
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
      const response = await api.safe.getSafesByOwnerAddress(chainId, address);
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

  const test = () => {
    router.push({
      pathname: '/transaction-progress',
      params: { hash: '0xd83f14ee77bd6bdd5a27479de788a343ee4518850601299ef58bdbd30789dd1e' },
    });
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* 左上角显示钱包地址和头像 */}
      {displayAddress && (
        <TouchableOpacity
          onPress={handlePresentModalPress}
          activeOpacity={0.7}
          className="flex-row items-center px-5 pt-2.5 pb-5"
        >
          {avatarSeed !== null && (
            <Jazzicon size={32} seed={avatarSeed} />
          )}
          <Text className="text-sm font-medium ml-2.5" style={{ color: colors.text }}>
            {formatAddress(displayAddress)}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={20} color={colors.text} />
        </TouchableOpacity>
      )}

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
          <BottomSheetScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 80, // 为底部按钮留出空间
            }}
          >
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.text }}>
              我的账户
            </Text>

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
                      setSelectedAccountAddress(addr);
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

      {/* <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: colors.text, fontSize: 24, marginBottom: 30 }}>Wallet</Text>
        <TouchableOpacity
          onPress={handleNavigateToNewSafe}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 10,
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.background, fontSize: 16, fontWeight: '600' }}>
            创建新 Safe
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={test}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 10,
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.background, fontSize: 16, fontWeight: '600' }}>
            Test
          </Text>
        </TouchableOpacity>
      </View> */}
    </SafeAreaView>
  );
}