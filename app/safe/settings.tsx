import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/config/theme';
import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api } from '@/services/api/api';
import type { ISafeInfo } from '@/services/api/types';
import { useAvatarGenerator } from '@/hooks/useAvatarGenerator';
import Jazzicon from 'react-native-jazzicon';
import { formatAddress } from '@/utils/common';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

export default function SafeSettingsScreen() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { safeAddress } = useLocalSearchParams<{ safeAddress: string }>();
  const { chainId } = useAccount();
  const insets = useSafeAreaInsets();
  const { generateAvatar } = useAvatarGenerator();

  const [safeInfo, setSafeInfo] = useState<ISafeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 为所有 owners 生成头像映射
  const ownerAvatars = useMemo(() => {
    if (!safeInfo) return {};
    const avatars: Record<string, number | null> = {};
    safeInfo.owners.forEach((owner) => {
      avatars[owner] = generateAvatar(owner);
    });
    return avatars;
  }, [safeInfo, generateAvatar]);

  // 获取 Safe 信息
  useEffect(() => {
    const fetchSafeInfo = async () => {
      if (!safeAddress || !chainId) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await api.safe.getSafeInfo(chainId, safeAddress);
        if (response.success && response.data) {
          setSafeInfo(response.data);
        } else {
          setError(response.message || '获取 Safe 信息失败');
        }
      } catch (err) {
        setError('网络请求失败，请稍后重试');
        console.error('获取 Safe 信息失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSafeInfo();
  }, [safeAddress, chainId]);

  // 复制地址到剪贴板
  const handleCopyAddress = async (addr: string) => {
    try {
      await Clipboard.setStringAsync(addr);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <Stack.Screen
          options={{
            title: 'Safe 设置',
            headerTitleAlign: 'center',
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-sm" style={{ color: colors.textSecondary }}>
            加载中...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !safeInfo) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <Stack.Screen
          options={{
            title: 'Safe 设置',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <View className="flex-1 items-center justify-center px-5">
          <MaterialIcons name="error-outline" size={48} color={colors.error || colors.textSecondary} />
          <Text className="mt-4 text-base font-semibold text-center" style={{ color: colors.text }}>
            {error || '获取 Safe 信息失败'}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 px-6 py-3 rounded-xl"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-base font-semibold" style={{ color: '#FFFFFF' }}>
              返回
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'Safe 设置',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Safe 地址信息 */}
        <View
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: colors.backgroundSecondary }}
        >
          <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
            Safe 地址
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold flex-1" style={{ color: colors.text }}>
              {formatAddress(safeInfo.address)}
            </Text>
            <TouchableOpacity
              onPress={() => handleCopyAddress(safeInfo.address)}
              activeOpacity={0.6}
              className="ml-2 p-2"
            >
              <MaterialIcons name="content-copy" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 签名阈值 */}
        <View
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: colors.backgroundSecondary }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold" style={{ color: colors.text }}>
              签名阈值
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center"
            >
              <Text className="text-base font-semibold mr-1" style={{ color: colors.primary }}>
                {safeInfo.threshold} / {safeInfo.owners.length}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            需要 {safeInfo.threshold} 个拥有者签名才能执行交易
          </Text>
        </View>

        {/* 拥有者列表 */}
        <View
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: colors.backgroundSecondary }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold" style={{ color: colors.text }}>
              拥有者 ({safeInfo.owners.length})
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center"
            >
              <MaterialIcons name="add" size={20} color={colors.primary} />
              <Text className="text-sm font-medium ml-1" style={{ color: colors.primary }}>
                添加
              </Text>
            </TouchableOpacity>
          </View>
          <View>
            {safeInfo.owners.map((owner, index) => {
              const avatar = ownerAvatars[owner];
              return (
                <View
                  key={owner}
                  className="flex-row items-center py-3"
                  style={{
                    borderBottomWidth: index < safeInfo.owners.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border || colors.backgroundTertiary,
                  }}
                >
                  {avatar !== null && (
                    <Jazzicon size={32} seed={avatar} />
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-medium" style={{ color: colors.text }}>
                      {formatAddress(owner)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCopyAddress(owner)}
                    activeOpacity={0.6}
                    className="ml-2 p-2"
                  >
                    <MaterialIcons name="content-copy" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Safe 版本信息 */}
        <View
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: colors.backgroundSecondary }}
        >
          <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
            Safe 版本
          </Text>
          <Text className="text-base font-semibold" style={{ color: colors.text }}>
            {safeInfo.version}
          </Text>
        </View>

        {/* 提示信息 */}
        <View
          className="rounded-xl p-4"
          style={{ backgroundColor: colors.backgroundTertiary || colors.backgroundSecondary }}
        >
          <View className="flex-row items-start">
            <MaterialIcons name="info-outline" size={20} color={colors.textSecondary} />
            <Text className="text-sm ml-2 flex-1" style={{ color: colors.textSecondary }}>
              修改 Safe 设置需要创建交易并等待其他拥有者签名确认。所有修改操作都是链上交易，需要支付 Gas 费用。
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

