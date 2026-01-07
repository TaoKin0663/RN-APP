import '@walletconnect/react-native-compat';
import { AppKitButton } from '@reown/appkit-react-native';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useAccount } from 'wagmi';

import { MobileWave } from '@/components/MobileWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import ReownFigures from '@/components/ReownFigures';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { WalletInfoView } from '@/components/WalletInfoView';
import { reownDarkGray, reownOrange } from '@/constants/Colors';
import { formatAddress } from '@/utils/common';

export default function HomeScreen() {
  const { address, isConnected } = useAccount();

  // 调试：在控制台输出连接状态，帮助排查热更新问题
  useEffect(() => {
    console.log('Wallet connection status:', { address, isConnected });
  }, [address, isConnected]);

  return (
    <>
      <ParallaxScrollView
        headerBackgroundColor={{ light: reownDarkGray, dark: reownDarkGray }}
        headerImage={
          <View style={styles.headerContainer}>
            <View style={styles.leftColumn}>
              <Image
                source={require('@/assets/images/reown-logo.png')}
                style={styles.reownLogo}
              />
              <Text className='text-[red] text-lg'>
                Powering the future of the financial internet
              </Text>
            </View>
            <ReownFigures />
          </View>
        }>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">AppKit</ThemedText>
          <ThemedText type="subtitle">for React Native</ThemedText>
          <MobileWave />
        </ThemedView>
        <WalletInfoView />
        
        {/* 显示钱包地址 */}
        {address && (
          <View style={styles.addressContainer}>
            <ThemedText style={styles.addressLabel}>钱包地址:</ThemedText>
            <ThemedText style={styles.addressText}>{formatAddress(address)}</ThemedText>
          </View>
        )}
        
        <View style={styles.appKitButtonContainer}>
          <AppKitButton connectStyle={styles.appKitButton} label='Connect Wallet' />
        </View>
      </ParallaxScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  reownLogo: {
    height: 48,
    width: 180,
  },
  appKitButtonContainer: {
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appKitButton: {
    marginTop: 20,
    backgroundColor: reownOrange,
  },
  headerText: {
    fontFamily: 'KHTekaMono',
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '600',
    color: '#fff',
  },
  headerContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  leftColumn: {
    flexDirection: 'column',
    width: '50%',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 10,
  },
  addressContainer: {
    marginTop: 16,
    alignItems: 'center',
    gap: 4,
  },
  addressLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'KHTekaMono',
  },
});
