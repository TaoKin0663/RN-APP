import 'text-encoding';
import "@walletconnect/react-native-compat";
import {
  AppKit,
  AppKitProvider,
  bitcoin,
  createAppKit,
  solana,
} from "@reown/appkit-react-native";
import { WagmiAdapter } from "@reown/appkit-wagmi-react-native";
import { SolanaAdapter, PhantomConnector, SolflareConnector } from "@reown/appkit-solana-react-native";
import { BitcoinAdapter } from "@reown/appkit-bitcoin-react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { arbitrum, mainnet, polygon, sepolia, base, optimism, bsc } from "@wagmi/core/chains";
import { WagmiProvider } from "wagmi";

import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { storage } from "@/utils/StorageUtil";
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ModalProvider } from "@/components/ui/Modal";
import { setApiTokenProvider } from '@/services/api/http';
import { useUserStore } from '@/store';
import { useEffect } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import '../global.css';

const clipboardClient = {
  setString: async (value: string) => {
    Clipboard.setStringAsync(value);
  },
};

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Get projectId at https://dashboard.reown.com
const projectId = "f6e099565a97386648a4a99d5efc94ed"; // This project ID will only work for Expo Go. Use your own project ID for production.



// 2. Create config
const metadata = {
  name: "AppKit RN",
  description: "AppKit RN Example",
  url: "https://reown.com/appkit",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
  redirect: {
    native: "appkitexpowagmi://",
    universal: "YOUR_APP_UNIVERSAL_LINK.com",
  },
};

const networks = [sepolia,mainnet];//mainnet, polygon, arbitrum, base, optimism, bsc, 

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: networks as any,
});

const solanaAdapter = new SolanaAdapter();
const bitcoinAdapter = new BitcoinAdapter();

// 3. Create modal
const appkit = createAppKit({
  projectId,
  networks: [...networks, solana, bitcoin],
  adapters: [wagmiAdapter, solanaAdapter, bitcoinAdapter],
  extraConnectors: [new PhantomConnector(), new SolflareConnector()],
  metadata,
  clipboardClient,
  storage,
  defaultNetwork: sepolia, // Optional
  enableAnalytics: true, // Optional - defaults to your Cloud configuration
  features: {
    socials: false,
  },
});

function RootLayoutContent() {
  const { colorScheme } = useTheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    KHTeka: require('../assets/fonts/KHTeka-Regular.otf'),
    KHTekaMedium: require('../assets/fonts/KHTeka-Medium.otf'),
    KHTekaMono: require('../assets/fonts/KHTekaMono-Regular.otf'),
  });

  // 设置 token provider，让 http 模块可以从 store 获取 token
  useEffect(() => {
    setApiTokenProvider(() => {
      // 每次都从 store 获取最新的 token
      return useUserStore.getState().token || undefined;
    });
  }, []);

  // 路由保护：检查登录状态并自动重定向
  useAuthGuard(loaded);

  // 当 token 变化时，tokenProvider 会自动获取最新值（因为它是从 store 读取的）

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <AppKitProvider instance={appkit}>
              <BottomSheetModalProvider>
                <ModalProvider>
                  <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="login" options={{ headerShown: false }} />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                  <StatusBar style="auto" />
                  {/* This is a workaround for the Android modal issue. https://github.com/expo/expo/issues/32991#issuecomment-2489620459 */}
                  <View style={{ position: "absolute", height: "100%", width: "100%" }}>
                    <AppKit />
                  </View>
                </ModalProvider>
              </BottomSheetModalProvider>
            </AppKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </NavigationThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}
