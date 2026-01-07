import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';

type ModalContentProps = {
    title?: string;
    message?: string | ReactNode;
    children?: ReactNode;
    buttons?: ReactNode | ReactNode[];
};

export function ModalContent({ title, message, children, buttons }: ModalContentProps) {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];

    const buttonArray = buttons ? (Array.isArray(buttons) ? buttons : [buttons]) : [];
    const isSingleButton = buttonArray.length === 1;

    return (
        <View style={styles.container}>
            {title && (
                <Text style={[styles.title, { color: colors.text }]}>
                    {title}
                </Text>
            )}
            
            {message && (
                <View style={styles.messageContainer}>
                    {typeof message === 'string' ? (
                        <Text style={[styles.message, { color: colors.textSecondary }]}>
                            {message}
                        </Text>
                    ) : (
                        message
                    )}
                </View>
            )}

            {children && <View style={styles.content}>{children}</View>}

            {buttonArray.length > 0 && (
                <View style={[
                    styles.buttonContainer,
                    isSingleButton ? styles.buttonContainerCenter : styles.buttonContainerRow
                ]}>
                    {buttonArray.map((button, index) => (
                        <View 
                            key={index} 
                            style={[
                                styles.buttonWrapper,
                                !isSingleButton && index > 0 && styles.buttonSpacing
                            ]}
                        >
                            {button}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    messageContainer: {
        marginVertical: 16,
        width: '100%',
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    content: {
        width: '100%',
        marginBottom: 16,
    },
    buttonContainer: {
        width: '100%',
    },
    buttonContainerCenter: {
        alignItems: 'center',
    },
    buttonContainerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    buttonWrapper: {
        minWidth: 120,
    },
    buttonSpacing: {
        marginLeft: 12,
    },
});

