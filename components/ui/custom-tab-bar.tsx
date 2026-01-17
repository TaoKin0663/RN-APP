import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MsgIcon from '@/assets/images/tabs/msg.svg';
import IndexIcon from '@/assets/images/tabs/index.svg';
import TradeIcon from '@/assets/images/tabs/trade.svg';
import ProfileIcon from '@/assets/images/tabs/profile.svg';

type TabRouteKey = 'index' | 'trade' | 'message' | 'wallet';

type TabRoute = {
    key: TabRouteKey;
    title?: string;
};

type CustomTabBarProps = {
    index: number;
    routes: TabRoute[];
    onTabPress: (nextIndex: number) => void;
};

export function CustomTabBar({ index, routes, onTabPress }: CustomTabBarProps) {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const isLight = colorScheme === 'light';
    const iconSize = 29;

    return (
        <View style={styles.container}>
            <View
                style={[
                    styles.tabBar,
                    {
                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(18, 13, 0, 0.9)',
                        shadowColor: isLight ? colors.shadow : '#000',
                        shadowOpacity: isLight ? 0.08 : 0.3,
                        borderWidth: 0,
                        borderColor: 'transparent',
                    },
                ]}
            >
                {routes.map((route, routeIndex) => {
                    const isFocused = index === routeIndex;

                    const getIcon = () => {
                        const iconColor = isFocused ? colors.primary : '#C4C4C4';

                        switch (route.key) {
                            case 'index':
                                return <IndexIcon width={iconSize} height={iconSize} color={iconColor} />;
                            case 'trade':
                                return <TradeIcon width={iconSize} height={iconSize} color={iconColor} />;
                            case 'message':
                                return <MsgIcon width={iconSize} height={iconSize} color={iconColor} />;
                            case 'wallet':
                            default:
                                return <ProfileIcon width={iconSize} height={iconSize} color={iconColor} />;
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={() => onTabPress(routeIndex)}
                            style={styles.tabItem}
                            activeOpacity={0.7}
                        >
                            <View
                                style={[
                                    styles.tabContent,
                                    isFocused && styles.tabContentActive,
                                ]}
                            >
                                <View style={styles.iconWrapper}>{getIcon()}</View>
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
