import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { BouncyButton } from '@/components/BouncyButton';
import { useUserStore } from '@/store';
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/config/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { isLoggedIn, userInfo, logout } = useUserStore();
  const handleLoginPress = () => {
    router.push('/login');
  };

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {/* 顶部导航栏 */}
      <View 
        className="flex-row items-center justify-between px-4 pb-3"
        style={{ 
          backgroundColor: colors.background,
          paddingTop: insets.top + 12
        }}
      >
        <Text className="text-lg font-semibold" style={{ color: colors.text }}>个人</Text>
        <TouchableOpacity 
          className="p-1"
          onPress={toggleColorScheme}
          activeOpacity={0.7}
        >
          <MaterialIcons 
            name={colorScheme === 'dark' ? 'light-mode' : 'dark-mode'} 
            size={24} 
            color={colors.text} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {!isLoggedIn ? (
          // 未登录状态：显示登录入口
          <View style={styles.loginContainer}>
            <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.iconText, { color: colors.text }]}>👤</Text>
            </View>
            <ThemedText type="default" style={styles.loginPrompt}>
              请先登录以查看个人信息
            </ThemedText>
            <BouncyButton
              style={[styles.loginButton, { backgroundColor: colors.tint }]}
              textStyle={styles.loginButtonText}
              onPress={handleLoginPress}
            >
              立即登录
            </BouncyButton>
          </View>
        ) : (
          // 已登录状态：显示用户信息
          <View style={styles.userInfoContainer}>
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {userInfo?.avatar ? (
                  <Image
                    source={{ uri: userInfo.avatar }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
                    <Text style={styles.avatarText}>
                      {userInfo?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={[styles.infoCard, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text, opacity: 0.6 }]}>用户名</Text>
                <ThemedText type="defaultSemiBold" style={styles.infoValue}>
                  {userInfo?.username || '未设置用户名'}
                </ThemedText>
              </View>
              
              {userInfo?.email && (
                <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              )}
              
              {userInfo?.email && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.text, opacity: 0.6 }]}>邮箱</Text>
                  <ThemedText type="default" style={styles.infoValue}>
                    {userInfo.email}
                  </ThemedText>
                </View>
              )}
              
              {userInfo?.id && (
                <>
                  <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.text, opacity: 0.6 }]}>用户ID</Text>
                    <ThemedText type="default" style={[styles.infoValue, { opacity: 0.8 }]}>
                      {userInfo.id}
                    </ThemedText>
                  </View>
                </>
              )}
            </View>

            <BouncyButton
              style={[styles.logoutButton, { backgroundColor: '#ff4444' }]}
              textStyle={styles.logoutButtonText}
              onPress={handleLogout}
            >
              登出
            </BouncyButton>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 16,
  },
  loginContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  iconText: {
    fontSize: 64,
  },
  loginPrompt: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
    lineHeight: 24,
  },
  loginButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfoContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarWrapper: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  infoDivider: {
    height: 1,
    marginVertical: 8,
    opacity: 0.2,
  },
  logoutButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
