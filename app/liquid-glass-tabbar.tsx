import React from 'react';
import { ImageBackground, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { CustomTabBar } from '@/components/ui/custom-tab-bar';

/**
 * 一个可直接打开的示例页面：
 * - 底部 TabBar（icon only）
 * - TabBar 上方可拖拽的 “Liquid Glass” 圆形镜片（跟随手指，松手吸附最近 Tab）
 *
 * 打开方式（expo-router）：
 * - 路由：/liquid-glass-tabbar
 */
type RouteKey = 'index' | 'trade' | 'message' | 'wallet';

const routes: { key: RouteKey; title: string }[] = [
  { key: 'index', title: '首页' },
  { key: 'trade', title: '交易' },
  { key: 'message', title: '消息' },
  { key: 'wallet', title: '钱包' },
];

export default function LiquidGlassTabBarExampleScreen() {
  const [index, setIndex] = React.useState(0);
  const title = routes[index]?.title ?? '';

  return (
    <View style={styles.root}>
      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1520975958225-1298b7a6d1c0?q=80&w=1200&auto=format&fit=crop',
        }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.scrim} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            在底部 TabBar 上方按下并左右拖动，松手会自动选中最近的 Tab。
          </Text>
        </View>
      </SafeAreaView>

      <CustomTabBar index={index} routes={routes} onTabPress={setIndex} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 16,
    lineHeight: 22,
  },
});

