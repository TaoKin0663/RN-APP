import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import MsgIcon from '@/assets/images/tabs/msg.svg';
import IndexIcon from '@/assets/images/tabs/index.svg';
import TradeIcon from '@/assets/images/tabs/trade.svg';
import ProfileIcon from '@/assets/images/tabs/profile.svg';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedLiquidGlassView = Animated.createAnimatedComponent(LiquidGlassView);
const AnimatedLensFallbackView = Animated.createAnimatedComponent(View);

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
    const tabBarWidth = React.useRef(0);
    const dragAreaRef = React.useRef<View>(null);
    const [layoutReady, setLayoutReady] = React.useState(false);
    const [dragging, setDragging] = React.useState(false);
    const [hoverIndex, setHoverIndex] = React.useState(-1);

    /**
     * 只在 iOS 26+ 且系统支持 Liquid Glass 时启用：
     * - 避免在 Android / 低版本 iOS 上出现 “透明但没有玻璃效果” 的 UI 问题
     * - 符合你提出的 “仅 iOS 26+ 使用系统级 Liquid Glass” 的要求
     */
    const liquidEnabled = React.useMemo(() => {
        const version = Platform.OS === 'ios' ? Number(Platform.Version) : 0;
        return Platform.OS === 'ios' && version >= 26 && isLiquidGlassSupported;
    }, []);

    const barWidthSv = useSharedValue(0);
    const dragAreaPageXSv = useSharedValue(0);
    const knobLeftSv = useSharedValue(0);
    const selectedLeftSv = useSharedValue(0);
    const lensOpacitySv = useSharedValue(0);
    const draggingSv = useSharedValue(0);
    const prevHoverIndexSv = useSharedValue(-1);

    const TAB_BAR_HORIZONTAL_PADDING = 12;
    const KNOB_SIZE = 76;
    const TAB_BAR_HEIGHT = 72;
    const DRAG_HIT_AREA_HEIGHT = 120; // 让用户可以在 TabBar 上方开始拖拽
    const springConfig = React.useMemo(() => ({ damping: 18, stiffness: 240, mass: 0.8 }), []);
    const baseLensOpacity = React.useMemo(() => {
        if (!liquidEnabled) return 0;
        return isLight ? 0.9 : 0.85;
    }, [isLight, liquidEnabled]);

    const getSlotWidth = React.useCallback(
        (barWidth: number) => (barWidth - TAB_BAR_HORIZONTAL_PADDING * 2) / Math.max(1, routes.length),
        [routes.length]
    );

    const getKnobLeftForIndex = React.useCallback(
        (nextIndex: number, barWidth: number) => {
            const slotWidth = getSlotWidth(barWidth);
            const left = TAB_BAR_HORIZONTAL_PADDING + slotWidth * (nextIndex + 0.5) - KNOB_SIZE / 2;
            const minLeft = TAB_BAR_HORIZONTAL_PADDING;
            const maxLeft = Math.max(minLeft, barWidth - TAB_BAR_HORIZONTAL_PADDING - KNOB_SIZE);
            return Math.min(Math.max(left, minLeft), maxLeft);
        },
        [getSlotWidth]
    );

    React.useEffect(() => {
        if (!layoutReady || dragging) return;
        const barWidth = tabBarWidth.current;
        if (barWidth <= 0) return;
        const nextLeft = getKnobLeftForIndex(index, barWidth);
        knobLeftSv.value = withSpring(nextLeft, springConfig);
        selectedLeftSv.value = withSpring(nextLeft, springConfig);
    }, [dragging, getKnobLeftForIndex, index, knobLeftSv, layoutReady, selectedLeftSv, springConfig]);

    React.useEffect(() => {
        if (!layoutReady || dragging) return;
        lensOpacitySv.value = withSpring(baseLensOpacity, { damping: 16, stiffness: 240, mass: 0.6 });
    }, [baseLensOpacity, dragging, layoutReady, lensOpacitySv]);

    React.useEffect(() => {
        if (dragging) return;
        if (hoverIndex >= 0 && hoverIndex === index) setHoverIndex(-1);
    }, [dragging, hoverIndex, index]);

    const selectedAnimatedStyle = useAnimatedStyle(() => {
        const left = draggingSv.value ? knobLeftSv.value : selectedLeftSv.value;
        return {
            transform: [{ translateX: left }],
        };
    });

    const lensAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: lensOpacitySv.value,
            transform: [{ translateX: knobLeftSv.value }],
        };
    });

    const panGesture = React.useMemo(() => {
        return Gesture.Pan()
            .enabled(layoutReady)
            // 关键：设为 0，避免 “没激活就不 update” 导致的不跟手/延迟
            .minDistance(0)
            .onBegin((event) => {
                const barWidth = barWidthSv.value;
                if (barWidth <= 0) return;
                const minLeft = TAB_BAR_HORIZONTAL_PADDING;
                const maxLeft = Math.max(minLeft, barWidth - TAB_BAR_HORIZONTAL_PADDING - KNOB_SIZE);

                /**
                 * 关键：用 absoluteX - 容器在屏幕上的 X 计算本地坐标
                 * 这样无论从 TabBar 上方哪里按下，圆块都会立刻“跟手”
                 */
                const localX = event.absoluteX - dragAreaPageXSv.value;
                const startLeft = Math.min(Math.max(localX - KNOB_SIZE / 2, minLeft), maxLeft);
                knobLeftSv.value = startLeft;

                runOnJS(setDragging)(true);
                draggingSv.value = 1;
                // 基于当前镜片位置计算 hover tab
                const slotWidth = (barWidth - TAB_BAR_HORIZONTAL_PADDING * 2) / Math.max(1, routes.length);
                if (slotWidth > 0) {
                    const centerFromPadding = startLeft + KNOB_SIZE / 2 - TAB_BAR_HORIZONTAL_PADDING;
                    let nextHoverIndex = Math.round(centerFromPadding / slotWidth - 0.5);
                    nextHoverIndex = Math.max(0, Math.min(routes.length - 1, nextHoverIndex));
                    prevHoverIndexSv.value = nextHoverIndex;
                    runOnJS(setHoverIndex)(nextHoverIndex);
                } else {
                    prevHoverIndexSv.value = index;
                    runOnJS(setHoverIndex)(index);
                }
                // 拖拽开始时，镜片更“实”一点（更像 Telegram 的效果）
                lensOpacitySv.value = withSpring(1, { damping: 16, stiffness: 240, mass: 0.6 });
            })
            .onUpdate((event) => {
                const barWidth = barWidthSv.value;
                const minLeft = TAB_BAR_HORIZONTAL_PADDING;
                const maxLeft = Math.max(minLeft, barWidth - TAB_BAR_HORIZONTAL_PADDING - KNOB_SIZE);
                const localX = event.absoluteX - dragAreaPageXSv.value;
                const nextLeft = Math.min(Math.max(localX - KNOB_SIZE / 2, minLeft), maxLeft);
                knobLeftSv.value = nextLeft;

                const slotWidth = (barWidth - TAB_BAR_HORIZONTAL_PADDING * 2) / Math.max(1, routes.length);
                if (slotWidth > 0) {
                    const centerFromPadding = knobLeftSv.value + KNOB_SIZE / 2 - TAB_BAR_HORIZONTAL_PADDING;
                    let nextHoverIndex = Math.round(centerFromPadding / slotWidth - 0.5);
                    nextHoverIndex = Math.max(0, Math.min(routes.length - 1, nextHoverIndex));
                    if (nextHoverIndex !== prevHoverIndexSv.value) {
                        prevHoverIndexSv.value = nextHoverIndex;
                        runOnJS(setHoverIndex)(nextHoverIndex);
                    }
                }
            })
            .onEnd(() => {
                const barWidth = barWidthSv.value;
                if (barWidth <= 0) return;
                const slotWidth = (barWidth - TAB_BAR_HORIZONTAL_PADDING * 2) / Math.max(1, routes.length);
                if (slotWidth <= 0) return;

                const centerFromPadding = knobLeftSv.value + KNOB_SIZE / 2 - TAB_BAR_HORIZONTAL_PADDING;
                let nextIndex = Math.round(centerFromPadding / slotWidth - 0.5);
                nextIndex = Math.max(0, Math.min(routes.length - 1, nextIndex));

                const targetLeft =
                    TAB_BAR_HORIZONTAL_PADDING + slotWidth * (nextIndex + 0.5) - KNOB_SIZE / 2;
                const minLeft = TAB_BAR_HORIZONTAL_PADDING;
                const maxLeft = Math.max(minLeft, barWidth - TAB_BAR_HORIZONTAL_PADDING - KNOB_SIZE);
                const clampedTargetLeft = Math.min(Math.max(targetLeft, minLeft), maxLeft);
                knobLeftSv.value = withSpring(clampedTargetLeft, springConfig);
                selectedLeftSv.value = withSpring(clampedTargetLeft, springConfig);
                runOnJS(setHoverIndex)(nextIndex);
                runOnJS(onTabPress)(nextIndex);
            })
            .onFinalize(() => {
                runOnJS(setDragging)(false);
                draggingSv.value = 0;
                prevHoverIndexSv.value = -1;
                lensOpacitySv.value = withSpring(baseLensOpacity, { damping: 16, stiffness: 240, mass: 0.6 });
            });
    }, [
        KNOB_SIZE,
        DRAG_HIT_AREA_HEIGHT,
        TAB_BAR_HORIZONTAL_PADDING,
        barWidthSv,
        baseLensOpacity,
        dragAreaPageXSv,
        draggingSv,
        index,
        lensOpacitySv,
        knobLeftSv,
        layoutReady,
        onTabPress,
        prevHoverIndexSv,
        routes.length,
        selectedLeftSv,
        springConfig,
    ]);

    return (
        <View style={styles.container}>
            <GestureDetector gesture={panGesture}>
                {/* 扩大手势区域：用户可在 TabBar 上方按下并拖动 */}
                <View
                    ref={dragAreaRef}
                    onLayout={() => {
                        // 记录手势容器在屏幕上的 X，用于把 absoluteX 转换成容器内的 localX
                        requestAnimationFrame(() => {
                            dragAreaRef.current?.measureInWindow((x) => {
                                dragAreaPageXSv.value = x;
                            });
                        });
                    }}
                    style={[styles.dragHitArea, { height: DRAG_HIT_AREA_HEIGHT }]}
                >
                    <View
                        onLayout={(event) => {
                            const nextWidth = event.nativeEvent.layout.width;
                            tabBarWidth.current = nextWidth;
                            barWidthSv.value = nextWidth;
                            if (nextWidth > 0) {
                                const nextLeft = getKnobLeftForIndex(index, nextWidth);
                                knobLeftSv.value = nextLeft;
                                selectedLeftSv.value = nextLeft;
                                setLayoutReady(true);
                            }
                        }}
                        style={[
                            styles.tabBar,
                            {
                                height: TAB_BAR_HEIGHT,
                                backgroundColor: liquidEnabled
                                    ? 'transparent'
                                    : isLight
                                      ? 'rgba(255, 255, 255, 0.9)'
                                      : 'rgba(18, 13, 0, 0.9)',
                                shadowColor: isLight ? colors.shadow : '#000',
                                shadowOpacity: isLight ? 0.08 : 0.3,
                                borderWidth: 0,
                                borderColor: 'transparent',
                            },
                        ]}
                    >
                        {/* TabBar 背景玻璃（iOS 26+ 才启用） */}
                        {liquidEnabled ? (
                            <LiquidGlassView
                                pointerEvents="none"
                                style={styles.tabBarGlassBackground}
                                effect="regular"
                                colorScheme={isLight ? 'light' : 'dark'}
                                tintColor={isLight ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}
                            />
                        ) : null}

                        {/* 拖拽“镜片”选择器（跟随手指，松手吸附） */}
                        {liquidEnabled ? (
                            <AnimatedLiquidGlassView
                                pointerEvents="none"
                                style={[styles.lensOuter, lensAnimatedStyle]}
                                effect={dragging ? 'clear' : 'none'}
                                colorScheme={isLight ? 'light' : 'dark'}
                                tintColor={isLight ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)'}
                                interactive={true}
                            />
                        ) : (
                            <AnimatedLensFallbackView
                                pointerEvents="none"
                                style={[
                                    styles.lensOuter,
                                    lensAnimatedStyle,
                                    {
                                        backgroundColor: isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)',
                                    },
                                ]}
                            />
                        )}

                    {routes.map((route, routeIndex) => {
                        const visualIndex = dragging ? hoverIndex : hoverIndex >= 0 ? hoverIndex : index;
                        const isFocused = visualIndex === routeIndex;

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
                                onPress={() => {
                                    if (dragging) return;
                                    setHoverIndex(routeIndex);
                                    const barWidth = tabBarWidth.current;
                                    if (layoutReady && barWidth > 0) {
                                        const nextLeft = getKnobLeftForIndex(routeIndex, barWidth);
                                        knobLeftSv.value = withSpring(nextLeft, springConfig);
                                        selectedLeftSv.value = withSpring(nextLeft, springConfig);
                                    }
                                    onTabPress(routeIndex);
                                }}
                                style={styles.tabItem}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.tabContent, isFocused && styles.tabContentActive]}>
                                    <View style={styles.iconWrapper}>
                                        {/* 选中图标也叠一层 glass（满足“图标 + 镜片都有 Liquid Glass”） */}
                                        {/* {liquidEnabled && isFocused ? (
                                            <LiquidGlassView
                                                pointerEvents="none"
                                                style={styles.iconGlass}
                                                effect="clear"
                                                colorScheme={isLight ? 'light' : 'dark'}
                                                tintColor={isLight ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)'}
                                            />
                                        ) : null} */}
                                        {getIcon()}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    </View>
                </View>
            </GestureDetector>
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
    dragHitArea: {
        width: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        width: '100%',
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
        zIndex: 1,
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
        borderRadius: 20,
        overflow: 'hidden',
    },
    iconGlass: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 20,
        zIndex: 0,
    },
    selectedOuter: {
        position: 'absolute',
        top: -2,
        left: 0,
        width: 76,
        height: 76,
        borderRadius: 38,
        zIndex: 0,
    },
    selectedPill: {
        width: '100%',
        height: '100%',
        borderRadius: 38,
    },
    lensOuter: {
        position: 'absolute',
        top: -2,
        left: 0,
        width: 76,
        height: 76,
        borderRadius: 38,
        zIndex: 2,
    },
    lens: {
        width: '100%',
        height: '100%',
        borderRadius: 38,
    },
    tabBarGlassBackground: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 36,
        zIndex: 0,
    },
});
