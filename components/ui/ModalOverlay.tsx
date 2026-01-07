import React, { useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle, BackHandler } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    Easing,
    interpolate,
} from 'react-native-reanimated';

const TIMING_CONFIG = {
    duration: 200,
    easing: Easing.out(Easing.cubic),
};

export function ModalOverlay({
    visible,
    children,
    onDismiss,
    onBackPress,
    contentContainerStyle,
}: {
    visible: boolean;
    children: React.ReactNode;
    onDismiss?: () => void;
    onBackPress?: () => void;
    contentContainerStyle?: StyleProp<ViewStyle>;
}) {
    const progress = useSharedValue(0);
    const [mounted, setMounted] = useState(visible);

    // 处理 Android 返回按钮
    useEffect(() => {
        if (!visible) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (onBackPress) {
                onBackPress();
                return true; // 阻止默认行为（返回上一页）
            }
            return false;
        });

        return () => backHandler.remove();
    }, [visible, onBackPress]);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            progress.value = withTiming(1, TIMING_CONFIG);
        } else {
            progress.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.cubic) }, (finished) => {
                if (finished) {
                    runOnJS(setMounted)(false);
                    if (onDismiss) runOnJS(onDismiss)();
                }
            });
        }
    }, [visible, onDismiss]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: progress.value * 0.5,
    }));

    const contentStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        shadowOpacity: 0.22 * progress.value,
        elevation: 10 * progress.value,
        transform: [
            { translateY: interpolate(progress.value, [0, 1], [12, 0]) },
            { scale: interpolate(progress.value, [0, 1], [0.98, 1]) },
        ],
    }));

    if (!mounted) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View
                style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
            >
                <Pressable style={StyleSheet.absoluteFill} />
            </Animated.View>

            <View style={styles.center}>
                <Animated.View style={[styles.content, styles.card, contentContainerStyle, contentStyle]}>
                    {children}
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: '80%',
        maxWidth: 420,
    },
    card: {
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
    },
});
