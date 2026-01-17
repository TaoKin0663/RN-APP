import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
export default function SettingScreen() {
  const { colorScheme, setColorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';


  // const handleLogout = () => {
  //   Alert.alert(
  //     '确认登出',
  //     '您确定要登出吗？',
  //     [
  //       {
  //         text: '取消',
  //         style: 'cancel',
  //       },
  //       {
  //         text: '确认',
  //         style: 'destructive',
  //         onPress: () => {
  //           logout();
  //           Alert.alert('成功', '已成功登出');
  //         },
  //       },
  //     ]
  //   );
  // };
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
      }} />
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>外观</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setColorScheme(isDark ? 'light' : 'dark')}
          style={[
            styles.row,
            styles.listItem,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.borderLight,
            },
          ]}
        >
          <Text style={[styles.rowTitle, { color: colors.text }]}>主题模式</Text>
          <View style={styles.rowRight}>
            <Text style={[styles.valueText, { color: colors.textSecondary }]}>
              {isDark ? '深色' : '浅色'}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rowDescription: {
    fontSize: 12,
    opacity: 0.8,
  },
  listItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 14,
    marginRight: 4,
  },
});
