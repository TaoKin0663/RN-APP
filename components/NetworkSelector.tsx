import React, { useRef, useCallback, useMemo } from 'react';
import { TouchableOpacity, View, Text, Image } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';

export interface Network {
  id: number;
  name: string;
  chainId: string | number;
}

interface NetworkSelectorProps {
  selectedNetwork: Network;
  onSelectNetwork: (network: Network) => void;
  networks?: Network[];
  snapPoints?: number[];
  triggerComponent?: React.ReactNode;
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

export function NetworkSelector({
  selectedNetwork,
  onSelectNetwork,
  networks = defaultNetworks,
  snapPoints = [400],
  triggerComponent,
}: NetworkSelectorProps) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // 打开底部弹出层
  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  // 关闭底部弹出层
  const handleCloseModal = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  // 选择网络
  const handleSelectNetwork = useCallback(
    (network: Network) => {
      onSelectNetwork(network);
      handleCloseModal();
    },
    [onSelectNetwork, handleCloseModal]
  );

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

  // 默认触发器组件
  const defaultTrigger = (
    <TouchableOpacity
      className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-md self-end"
      style={{ backgroundColor: colors.backgroundSecondary }}
      onPress={handlePresentModalPress}
    >
      {getChainIconSource(selectedNetwork.chainId) ? (
        <Image
          source={getChainIconSource(selectedNetwork.chainId)}
          style={{ width: 20, height: 20, borderRadius: 10 }}
          resizeMode="cover"
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
      <Text className="text-sm font-medium" style={{ color: colors.text }}>
        {selectedNetwork.name}
      </Text>
      <MaterialIcons name="arrow-drop-down" size={20} color={colors.text} />
    </TouchableOpacity>
  );

  return (
    <>
      {triggerComponent ? (
        <TouchableOpacity onPress={handlePresentModalPress} activeOpacity={0.7}>
          {triggerComponent}
        </TouchableOpacity>
      ) : (
        defaultTrigger
      )}

      {/* 网络选择底部弹出层 */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        // 允许超过 snapPoints 的“拉伸/回弹”，配合阻尼提高手感
        enableOverDrag={true}
        overDragResistanceFactor={3}
        enableContentPanningGesture={true}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.backgroundSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
        animateOnMount={true}
        index={0}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          bounces={true}
          alwaysBounceVertical={true}  // 即使内容不满一屏也允许回弹手势传递
          overScrollMode="always"      // 允许 Android 上的越界
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.text }}>
            选择网络
          </Text>
          {networks.map((network) => (
            <TouchableOpacity
              key={network.id}
              className="flex-row items-center justify-between py-4 px-3 rounded-xl mb-2"
              style={{
                backgroundColor:
                  selectedNetwork.id === network.id
                    ? colors.primary + '20'
                    : colors.background,
              }}
              onPress={() => handleSelectNetwork(network)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center flex-1">
                <View className="mr-3">
                  {getChainIconSource(network.chainId) ? (
                    <Image
                      source={getChainIconSource(network.chainId)}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.backgroundSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}
                      >
                        {network.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium" style={{ color: colors.text }}>
                    {network.name}
                  </Text>
                  <Text
                    className="text-xs mt-0.5"
                    style={{ color: colors.textTertiary }}
                  >
                    Chain ID: {network.chainId}
                  </Text>
                </View>
              </View>
              {selectedNetwork.id === network.id && (
                <MaterialIcons name="check-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}

