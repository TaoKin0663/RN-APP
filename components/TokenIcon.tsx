import { View, Text, Image } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/config/theme';

interface TokenIconProps {
  symbol: string;
  chainId?: string | number | null;
  size?: number;
  className?: string;
}

const generateBackgroundColor = (text: string, colorScheme: 'light' | 'dark'): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  if (colorScheme === 'dark') {
    const hue = Math.abs(hash) % 360;
    const saturation = 50 + (Math.abs(hash) % 30);
    const lightness = 35 + (Math.abs(hash) % 15);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else {
    const hue = Math.abs(hash) % 360;
    const saturation = 40 + (Math.abs(hash) % 25);
    const lightness = 75 + (Math.abs(hash) % 15);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
};

const chainIconMap: Record<number, any> = {
  1: require('@/assets/images/chain-icons/1.png'),
  10: require('@/assets/images/chain-icons/10.png'),
  56: require('@/assets/images/chain-icons/56.png'),
  137: require('@/assets/images/chain-icons/137.png'),
  8453: require('@/assets/images/chain-icons/8453.png'),
  42161: require('@/assets/images/chain-icons/42161.png'),
  11155111: require('@/assets/images/chain-icons/11155111.png'),
};

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

export function TokenIcon({ symbol, chainId, size = 40, className = '' }: TokenIconProps) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'dark'];
  
  const displayText = symbol || '?';
  const firstLetter = displayText.charAt(0).toUpperCase();
  const backgroundColor = generateBackgroundColor(displayText, colorScheme ?? 'dark');
  const textColor = colors.text;
  const fontSize = size * 0.5;
  const chainIconSource = getChainIconSource(chainId);
  const chainIconSize = size * 0.4;
  
  return (
    <View className={`relative ${className}`} style={{ width: size, height: size }}>
      <View
        className="rounded-full items-center justify-center"
        style={{
          width: size,
          height: size,
          backgroundColor,
        }}
      >
        <Text
          style={{
            fontSize,
            fontWeight: '600',
            color: textColor,
          }}
        >
          {firstLetter}
        </Text>
      </View>
      {chainIconSource && (
        <View
          className="absolute bottom-0 right-0 rounded-full border-2"
          style={{
            width: chainIconSize,
            height: chainIconSize,
            borderColor: colors.background,
            backgroundColor: colors.background,
          }}
        >
          <Image
            source={chainIconSource}
            style={{
              width: chainIconSize - 4,
              height: chainIconSize - 4,
              borderRadius: (chainIconSize - 4) / 2,
            }}
            resizeMode="cover"
          />
        </View>
      )}
    </View>
  );
}

