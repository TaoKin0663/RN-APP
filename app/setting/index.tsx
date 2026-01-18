import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserStore } from '@/store';
import { Button } from '@/components/Button';

export default function SettingScreen() {
  const { logout } = useUserStore();
  const { colorScheme, setColorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';


  const handleLogout = () => {
    Alert.alert(
      '确认登出',
      '您确定要登出吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确认',
          style: 'destructive',
          onPress: () => {
            logout();
            Alert.alert('成功', '已成功登出');
          },
        },
      ]
    );
  };
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{
        title: '设置',
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerBackTitle:"返回",
      }} />
      <View className="flex-1 px-4 pt-4 justify-between">
        <View>
          <Text className="text-xs font-medium mb-2 uppercase tracking-[1px]" style={{ color: colors.textSecondary }}>外观</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setColorScheme(isDark ? 'light' : 'dark')}
            className="mt-2 rounded-xl px-4 py-3 flex-row items-center justify-between"
            style={{ backgroundColor: colors.background }}
          >
            <Text className="text-base font-semibold" style={{ color: colors.text }}>主题模式</Text>
            <View className="flex-row items-center">
              <Text className="text-sm mr-1" style={{ color: colors.textSecondary }}>
                {isDark ? '深色' : '浅色'}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <Button
          color='error'
          className="my-4"
          onPress={handleLogout}
        >
          退出登录
        </Button>
      </View>
    </SafeAreaView>
  );
}
