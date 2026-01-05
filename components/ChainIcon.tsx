import React, { useMemo } from 'react';
import { View, Text, Image, ImageSourcePropType } from 'react-native';

// 根据字符串生成稳定的随机颜色（相同输入总是返回相同颜色）
const generateColorFromString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 生成柔和且对比度高的颜色
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// 链图标映射
const chainIconMap: Record<number, ImageSourcePropType> = {
  1: require('@/assets/images/chain-icons/1.png'),
  10: require('@/assets/images/chain-icons/10.png'),
  56: require('@/assets/images/chain-icons/56.png'),
  137: require('@/assets/images/chain-icons/137.png'),
  8453: require('@/assets/images/chain-icons/8453.png'),
  42161: require('@/assets/images/chain-icons/42161.png'),
  11155111: require('@/assets/images/chain-icons/11155111.png'),
};

interface ChainIconProps {
  size?: number;
  chainId?: number;
}

export default function ChainIcon({ size = 48, chainId }: ChainIconProps) {
  const iconSource = useMemo(() => {
    if (!chainId) return null;
    return chainIconMap[chainId] || null;
  }, [chainId]);

  const placeholderText = useMemo(() => {
    if (chainId) {
      const chainIdStr = chainId.toString();
      return chainIdStr.charAt(0);
    }
    return '?';
  }, [chainId]);

  const backgroundColor = useMemo(
    () => generateColorFromString(chainId?.toString() || ''),
    [chainId]
  );

  if (!chainId) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#9CA3AF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: size * 0.4,
            fontWeight: '600',
          }}
        >
          ?
        </Text>
      </View>
    );
  }

  if (iconSource) {
    return (
      <Image
        source={iconSource}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
        resizeMode="cover"
      />
    );
  }

  // 占位符
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.4,
          fontWeight: '600',
        }}
      >
        {placeholderText}
      </Text>
    </View>
  );
}

