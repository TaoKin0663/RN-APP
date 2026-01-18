import React from 'react';
import { View, useWindowDimensions } from 'react-native';
// import { TabView } from 'react-native-tab-view';

// import { CustomTabBar } from '@/components/ui/custom-tab-bar';
// import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { withLayoutContext } from 'expo-router';
import {
  createNativeBottomTabNavigator,
  NativeBottomTabNavigationOptions,
  NativeBottomTabNavigationEventMap,
} from '@bottom-tabs/react-navigation';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';

// import HomeScreen from './index';
// import TradeScreen from './trade';
// import MessageScreen from './message';
// import WalletScreen from './wallet';
// import MsgIcon from '@/assets/images/tabs/msg.svg';
// import IndexIcon from '@/assets/images/tabs/index.svg';
// import TradeIcon from '@/assets/images/tabs/trade.svg';
// import ProfileIcon from '@/assets/images/tabs/profile.svg';

type RouteKey = 'index' | 'trade' | 'message' | 'wallet';

type Route = {
  key: RouteKey;
  title: string;
};

const routes: Route[] = [
  { key: 'index', title: '首页' },
  { key: 'trade', title: '交易' },
  { key: 'message', title: '消息' },
  { key: 'wallet', title: '钱包' },
];

export default function TabLayout() {
  const layout = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;
  const Tabs = withLayoutContext<
    NativeBottomTabNavigationOptions,
    typeof BottomTabNavigator,
    TabNavigationState<ParamListBase>,
    NativeBottomTabNavigationEventMap
  >(BottomTabNavigator);

  // const renderScene = ({ route }: { route: Route }) => {
  //   switch (route.key) {
  //     case 'index':
  //       return <HomeScreen />;
  //     case 'trade':
  //       return <TradeScreen />;
  //     case 'message':
  //       return <MessageScreen />;
  //     case 'wallet':
  //       return <WalletScreen />;
  //     default:
  //       return null;
  //   }
  // };
  const size = 20;
  return (
    <View style={{ flex: 1 }}>
      <Tabs>
        <Tabs.Screen name="index"
          options={{
            title: '首页',
            tabBarIcon: () => ({ sfSymbol: "house.fill" }),
          }} />
        <Tabs.Screen name="trade"
          options={{
            title: '交易',
            tabBarIcon: () => ({ sfSymbol: "chart.bar.xaxis" }),
          }} />
        <Tabs.Screen name="message"
          options={{
            title: '消息',
            tabBarIcon: () => ({ sfSymbol: "bubble.left.and.bubble.right.fill" }),
          }} />
        <Tabs.Screen name="wallet"
          options={{
            title: '钱包',
            tabBarIcon: () => ({ sfSymbol: "wallet.pass.fill" }),
          }} />
      </Tabs>
      {/* <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={() => null}
      />
      <CustomTabBar index={index} routes={routes} onTabPress={setIndex} /> */}
    </View>
  );
}
