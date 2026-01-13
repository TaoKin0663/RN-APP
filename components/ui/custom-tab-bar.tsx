import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MsgIcon from '@/assets/images/tabs/msg.svg';
import IndexIcon from '@/assets/images/tabs/index.svg';
import TradeIcon from '@/assets/images/tabs/trade.svg';
import ProfileIcon from '@/assets/images/tabs/profile.svg';

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const isLight = colorScheme === 'light';
    const iconSize = 24;


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
                        // 选中时使用主题色，未选中时使用灰色
                        const iconColor = isFocused ? colors.primary : '#C4C4C4';

                        switch (route.name) {
                            case 'index':
                                return <IndexIcon width={iconSize} height={iconSize} color={iconColor} />
                            case 'trade':
                                return <TradeIcon width={iconSize} height={iconSize} color={iconColor} />
                            case 'message':
                                return <MsgIcon width={iconSize} height={iconSize} color={iconColor} />
                            case 'wallet':
                                return <ProfileIcon width={iconSize} height={iconSize} color={iconColor} />
                            default:
                                return <ProfileIcon width={iconSize} height={iconSize} color={iconColor} />
                        }
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
