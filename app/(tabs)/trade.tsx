import { TouchableOpacity, View, Text, ScrollView, ActivityIndicator, Platform, Image, Animated, RefreshControl } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '@/services/api/api';
import type { IToken } from '@/services/api/types';
import { TokenIcon } from '@/components/TokenIcon';
import { useRouter } from 'expo-router';
import { NetworkSelector, type Network } from '@/components/NetworkSelector';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatUnits } from 'viem';

type TabType = 'regular' | 'stake' | 'equity';

enum TokenType {
  REGULAR_BENEFITS = "REGULAR_BENEFITS",
  STAKE = "STAKE",
  EQUITY = "EQUITY",
}

function TokenItem({ token }: { token: IToken }) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  // 格式化地址显示
  const formatAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  // 格式化总供应量
  const formatTotalSupply = (supply: string) => {
    const num = parseFloat(supply);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  // 格式化价格（使用 viem 的 formatUnits 处理精度）
  const formatPrice = (price: string, decimals: number) => {
    try {
      const formatted = formatUnits(BigInt(price), decimals);
      // 转换为数字并移除末尾的0
      const num = parseFloat(formatted);
      // 如果是整数，直接返回整数部分
      if (num % 1 === 0) {
        return num.toString();
      }
      // 否则保留最多6位小数，但移除末尾的0
      return num.toFixed(6).replace(/\.?0+$/, '');
    } catch (error) {
      // 如果格式化失败，返回原始值
      console.error('格式化价格失败:', error);
      return price;
    }
  };

  const handlePress = () => {
    router.push({
      pathname: '/token-detail',
      params: { tokenAddress: token.address }
    });
  };

  return (
    <TouchableOpacity
      className="rounded-xl p-4 mb-5"
      style={{ backgroundColor: colors.backgroundSecondary }}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center flex-1">
          <View className="mr-3">
            <TokenIcon symbol={token.symbol} chainId={token.chain?.chain_id} size={40} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-base font-semibold" style={{ color: colors.text }}>{token.symbol}</Text>
              {/* <View 
                className="px-2 py-0.5 rounded-xl"
                style={{ backgroundColor: colors.primary }}
              >
                <Text 
                  className="text-xs font-semibold"
                  style={{ color: colors.background }}
                >
                  {token.symbol}
                </Text>
              </View> */}
            </View>
            <Text className="text-xs" style={{ color: colors.textTertiary }}>{formatAddress(token.address)}</Text>
          </View>
        </View>
        {token.type !== TokenType.STAKE && token.sale_plan?.price && (
          <Text className="text-xl font-bold" style={{ color: colors.primary }}>
            ${formatPrice(token.sale_plan.price, token.decimals)}
          </Text>
        )}
      </View>

      <View className="gap-3">
        <Text className="text-sm" style={{ color: colors.textTertiary }}>
          代币类型: {token.type || 'N/A'}
        </Text>

        <View className="flex-row gap-3">
          <View
            className="flex-1 rounded-lg p-3 gap-1"
          >
            <Text className="text-xs" style={{ color: colors.textTertiary }}>总供应量</Text>
            <Text className="text-base font-semibold" style={{ color: colors.primary }}>{formatTotalSupply(token.total_supply)}</Text>
          </View>
          <View
            className="flex-1 rounded-lg p-3 gap-1"
          >
            <Text className="text-xs" style={{ color: colors.textTertiary }}>精度</Text>
            <Text className="text-base font-semibold" style={{ color: colors.text }}>{token.decimals}</Text>
          </View>
        </View>

        <Text className="text-xs mt-1" style={{ color: colors.textTertiary }}>{formatDate(token.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TabTwoScreen() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const [activeTab, setActiveTab] = useState<TabType>('regular');
  const [tokens, setTokens] = useState<IToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const tabLayouts = useRef<{ [key: string]: { x: number; width: number } }>({}).current;
  const [layoutsReady, setLayoutsReady] = useState(false);
  // 默认网络列表（Sepolia）
  const defaultNetworks: Network[] = [
    { id: 1, name: 'Ethereum', chainId: 1 },
    { id: 2, name: 'Optimism', chainId: 10 },
    { id: 3, name: 'BSC', chainId: 56 },
    { id: 4, name: 'Polygon', chainId: 137 },
    { id: 5, name: 'Base', chainId: 8453 },
    { id: 6, name: 'Arbitrum', chainId: 42161 },
    { id: 7, name: 'Sepolia', chainId: 11155111 },
  ];

  const [selectedNetwork, setSelectedNetwork] = useState<Network>(defaultNetworks[6]); // 默认选择 Sepolia

  // 选择网络回调
  const handleSelectNetwork = useCallback((network: Network) => {
    setSelectedNetwork(network);
    // 可以在这里添加其他逻辑，比如更新 API 请求参数等
  }, []);

  // 获取代币列表的函数
  const fetchTokenList = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const response = await api.token.getTokenList();
      if (response.success && response.data) {
        setTokens(response.data.tokens || []);
      } else {
        setError(response.message || '获取代币列表失败');
      }
    } catch (err) {
      setError('网络请求失败，请稍后重试');
      console.error('获取代币列表失败:', err);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  // 下拉刷新处理函数
  const onRefresh = useCallback(() => {
    fetchTokenList(true);
  }, [fetchTokenList]);

  useEffect(() => {
    fetchTokenList(false);
  }, [fetchTokenList]);

  // 根据 activeTab 过滤代币
  const filteredTokens = tokens.filter(token => {
    if (activeTab === 'regular') {
      return token.type === 'REGULAR_BENEFITS' || !token.type;
    } else if (activeTab === 'stake') {
      return token.type === 'STAKE';
    } else if (activeTab === 'equity') {
      return token.type === 'EQUITY';
    }
    return true;
  });

  // 处理标签切换和指示器动画
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const tabIndex = ['regular', 'stake', 'equity'].indexOf(tab);
    Animated.spring(indicatorAnim, {
      toValue: tabIndex,
      useNativeDriver: false,
      tension: 68,
      friction: 8,
    }).start();
  };

  // 测量标签布局
  const onTabLayout = (tab: TabType, event: any) => {
    const { x, width } = event.nativeEvent.layout;
    tabLayouts[tab] = { x, width };

    // 检查是否所有标签都已测量完成
    const allLayoutsReady = tabLayouts['regular'] && tabLayouts['stake'] && tabLayouts['equity'];
    if (allLayoutsReady && !layoutsReady) {
      setLayoutsReady(true);
      // 初始化指示器位置
      const currentIndex = ['regular', 'stake', 'equity'].indexOf(activeTab);
      indicatorAnim.setValue(currentIndex);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {/* 顶部导航栏 */}
      <View
        className="flex-row items-center justify-between px-4 pb-3 pt-3"
        style={{
          backgroundColor: colors.background
        }}
      >
        <Text className="text-lg font-semibold" style={{ color: colors.text }}>交易</Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-[20px]"
            style={{ backgroundColor: colors.backgroundSecondary }}
          >
            <MaterialIcons name="search" size={18} color={colors.textSecondary} />
            <Text className="text-sm" style={{ color: colors.textSecondary }}>搜索</Text>
          </TouchableOpacity>
          <TouchableOpacity className="p-1">
            <Image
              source={require('@/assets/images/customer-service.png')}
              style={{ width: 24, height: 24 }}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 92 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      // overScrollMode={Platform.OS === 'android' ? 'always' : undefined}  // Android 回弹
      >
        {/* 网络选择器 - 在客服图标下方 */}
        <View className="items-end mb-4">
          <NetworkSelector
            selectedNetwork={selectedNetwork}
            onSelectNetwork={handleSelectNetwork}
          />
        </View>

        {/* 导航标签 */}
        <View className="flex-row mb-5 relative">
          <TouchableOpacity
            className="pb-3 mr-6"
            onPress={() => handleTabChange('regular')}
            onLayout={(e) => onTabLayout('regular', e)}
            activeOpacity={0.7}
          >
            <Text
              className="text-base font-medium"
              style={{ color: activeTab === 'regular' ? colors.primary : colors.textSecondary }}
            >
              Regular Benefits
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="pb-3 mr-6"
            onPress={() => handleTabChange('stake')}
            onLayout={(e) => onTabLayout('stake', e)}
            activeOpacity={0.7}
          >
            <Text
              className="text-base font-medium"
              style={{ color: activeTab === 'stake' ? colors.primary : colors.textSecondary }}
            >
              Stake
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="pb-3 mr-6"
            onPress={() => handleTabChange('equity')}
            onLayout={(e) => onTabLayout('equity', e)}
            activeOpacity={0.7}
          >
            <Text
              className="text-base font-medium"
              style={{ color: activeTab === 'equity' ? colors.primary : colors.textSecondary }}
            >
              Equity
            </Text>
          </TouchableOpacity>

          {/* 滑动指示器 */}
          {layoutsReady && tabLayouts['regular'] && tabLayouts['stake'] && tabLayouts['equity'] && (
            <Animated.View
              style={{
                position: 'absolute',
                bottom: 0,
                height: 3,
                backgroundColor: colors.primary,
                borderRadius: 1.5,
                width: indicatorAnim.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [
                    tabLayouts['regular'].width * 0.6,
                    tabLayouts['stake'].width * 0.6,
                    tabLayouts['equity'].width * 0.6,
                  ],
                }),
                left: indicatorAnim.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [
                    tabLayouts['regular'].x + tabLayouts['regular'].width * 0.2,
                    tabLayouts['stake'].x + tabLayouts['stake'].width * 0.2,
                    tabLayouts['equity'].x + tabLayouts['equity'].width * 0.2,
                  ],
                }),
              }}
            />
          )}
        </View>

        {/* 代币卡片 */}
        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-sm mt-4" style={{ color: colors.textSecondary }}>加载中...</Text>
          </View>
        ) : error ? (
          <View className="items-center justify-center py-10">
            <MaterialIcons name="error-outline" size={48} color={colors.textSecondary} />
            <Text className="text-sm mt-4" style={{ color: colors.textSecondary }}>{error}</Text>
          </View>
        ) : filteredTokens.length === 0 ? (
          <View className="items-center justify-center py-10">
            <MaterialIcons name="inbox" size={48} color={colors.textSecondary} />
            <Text className="text-sm mt-4" style={{ color: colors.textSecondary }}>暂无代币数据</Text>
          </View>
        ) : (
          filteredTokens.map((token) => (
            <TokenItem key={token.id} token={token} />
          ))
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
