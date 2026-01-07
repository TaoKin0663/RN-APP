import React, { useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export type ModalOverlayRef = {
    show: (content: React.ReactNode) => void;
    hide: () => void;
};

export const ModalOverlay = forwardRef<ModalOverlayRef, {
    onDismiss?: () => void;
    onBackPress?: () => void;
    contentContainerStyle?: StyleProp<ViewStyle>;
}>(function ModalOverlay({
    onDismiss,
    onBackPress,
    contentContainerStyle,
}, ref) {
    const [content, setContent] = useState<React.ReactNode | null>(null);
    const [visible, setVisible] = useState(false);

    useImperativeHandle(ref, () => ({
        show: (next: React.ReactNode) => {
            setContent(next);
            setVisible(true);
        },
        hide: () => {
            setVisible(false);
        },
    }), []);

    useEffect(() => {
        if (!visible && onDismiss) {
            onDismiss();
        }
    }, [visible, onDismiss]);

    if (!visible && !content) {
        return null;
    }

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => {
                // Android 返回键：优先走自定义回调
                if (onBackPress) onBackPress();
                else if (onDismiss) onDismiss();
            }}
        >
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <View style={[StyleSheet.absoluteFill, styles.backdrop]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onBackPress || onDismiss} />
                </View>

                <View style={styles.center}>
                    <View style={[styles.content, styles.card, contentContainerStyle]}>
                        {content}
                    </View>
                </View>
            </View>
        </Modal>
    );
});

const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
        shadowOpacity: 0.22,
        elevation: 10,
    },
});
