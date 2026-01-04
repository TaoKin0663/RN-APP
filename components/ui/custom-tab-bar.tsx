import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Image } from 'react-native';

// 定义所有图片资源
const TAB_ICONS = {
    market: require('@/assets/images/tabs/market.png'),
    marketActive: require('@/assets/images/tabs/market-active.png'),
    trade: require('@/assets/images/tabs/trade.png'),
    tradeActive: require('@/assets/images/tabs/trade-active.png'),
    message: require('@/assets/images/tabs/msg.png'),
    messageActive: require('@/assets/images/tabs/msg-active.png'),
    wallet: require('@/assets/images/tabs/wallet.png'),
    walletActive: require('@/assets/images/tabs/wallet-active.png'),
    profile: require('@/assets/images/tabs/profile.png'),
    profileActive: require('@/assets/images/tabs/profile-active.png'),
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const isLight = colorScheme === 'light';
    const iconSize = 24;

    // 预加载所有图片
    useEffect(() => {
        const preloadImages = async () => {
            try {
                const imageUris = Object.values(TAB_ICONS).map(iconSource => {
                    const resolved = Image.resolveAssetSource(iconSource);
                    return resolved?.uri;
                }).filter(Boolean) as string[];

                await Promise.all(imageUris.map(uri => Image.prefetch(uri)));
            } catch (error) {
                console.warn('Failed to preload tab bar images:', error);
            }
        };

        preloadImages();
    }, []);


    return (
        <View style={styles.container}>
            <View
                style={[
                    styles.tabBar,
                    {
                        backgroundColor: 'rgba(18, 13, 0, 0.9)',
                        shadowColor: isLight ? colors.shadow : '#000',
                        shadowOpacity: isLight ? 0.08 : 0.3,
                        borderWidth: 0,
                        borderColor: 'transparent',
                    },
                ]}
            >
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const label = options.tabBarLabel ?? options.title ?? route.name;
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const getIcon = () => {
                        let iconSource;
                        switch (route.name) {
                            case 'index':
                                iconSource = isFocused ? TAB_ICONS.marketActive : TAB_ICONS.market;
                                break;
                            case 'trade':
                                iconSource = isFocused ? TAB_ICONS.tradeActive : TAB_ICONS.trade;
                                break;
                            case 'message':
                                iconSource = isFocused ? TAB_ICONS.messageActive : TAB_ICONS.message;
                                break;
                            case 'wallet':
                                iconSource = isFocused ? TAB_ICONS.walletActive : TAB_ICONS.wallet;
                                break;
                            case 'profile':
                                iconSource = isFocused ? TAB_ICONS.profileActive : TAB_ICONS.profile;
                                break;
                            default:
                                iconSource = TAB_ICONS.market;
                        }
                        return <Image source={iconSource} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />;
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={styles.tabItem}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.tabContent,
                                isFocused && styles.tabContentActive
                            ]}>
                                <View style={styles.iconWrapper}>
                                    {getIcon()}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        height: 72,
        borderRadius: 36,
        paddingHorizontal: 12,
        paddingVertical: 10,
        shadowOffset: { width: 0, height: 14 },
        shadowRadius: 28,
        shadowOpacity: 0.25,
        elevation: 18,
    },

    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        paddingVertical: 10,
    },
    tabContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 24,
        minHeight: 52,
    },
    tabContentActive: {
        transform: [{ scale: 1.1 }],
    },
    iconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
    },
});
