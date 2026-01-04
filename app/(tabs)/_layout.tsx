import { Tabs } from 'expo-router';

import { CustomTabBar } from '@/components/ui/custom-tab-bar';
import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const { colorScheme } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
        }}
      />
      <Tabs.Screen
        name="trade"
        options={{
          title: '交易',
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          title: '消息',
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: '钱包',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '个人',
        }}
      />
    </Tabs>
  );
}
