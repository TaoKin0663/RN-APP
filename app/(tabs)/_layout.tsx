import React from 'react';
import { View } from 'react-native';
import { withLayoutContext } from 'expo-router';
import {
  createNativeBottomTabNavigator,
  NativeBottomTabNavigationOptions,
  NativeBottomTabNavigationEventMap,
} from '@bottom-tabs/react-navigation';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';


export default function TabLayout() {
  const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;
  const Tabs = withLayoutContext<
    NativeBottomTabNavigationOptions,
    typeof BottomTabNavigator,
    TabNavigationState<ParamListBase>,
    NativeBottomTabNavigationEventMap
  >(BottomTabNavigator);

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
    </View>
  );
}
