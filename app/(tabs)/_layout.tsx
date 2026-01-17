import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { TabView } from 'react-native-tab-view';

import { CustomTabBar } from '@/components/ui/custom-tab-bar';
import HomeScreen from './index';
import TradeScreen from './trade';
import MessageScreen from './message';
import WalletScreen from './wallet';

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

  const renderScene = ({ route }: { route: Route }) => {
    switch (route.key) {
      case 'index':
        return <HomeScreen />;
      case 'trade':
        return <TradeScreen />;
      case 'message':
        return <MessageScreen />;
      case 'wallet':
        return <WalletScreen />;
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={() => null}
      />
      <CustomTabBar index={index} routes={routes} onTabPress={setIndex} />
    </View>
  );
}
