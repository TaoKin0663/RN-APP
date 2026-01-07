import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';

type ModalContextType = {
    show: (content: ReactNode) => void;
    hide: () => void;
};

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [content, setContent] = useState<ReactNode | null>(null);
    const [visible, setVisible] = useState(false);
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];

    const hide = () => setVisible(false);

    const handleDismiss = () => {
        setContent(null);
    };

    return (
        <ModalContext.Provider
            value={{
                show: (next) => {
                    setContent(next);
                    setVisible(true);
                },
                hide,
            }}
        >
            {children}
            <ModalOverlay
                visible={visible}
                onDismiss={handleDismiss}
                onBackPress={hide}
                contentContainerStyle={{ backgroundColor: colors.backgroundSecondary }}
            >
                {content}
            </ModalOverlay>
        </ModalContext.Provider>
    );
}

export function useModal() {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error('useModal must be used inside ModalProvider');
    return ctx;
}
