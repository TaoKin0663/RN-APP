import React, {
    createContext,
    useCallback,
    useContext,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    forwardRef,
    ReactNode,
} from 'react';
import { ModalOverlay } from './ModalOverlay';
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';

type ModalContextType = {
    show: (content: ReactNode) => void;
    hide: () => void;
};

const ModalContext = createContext<ModalContextType | null>(null);

export type ModalHostRef = {
    show: (content: ReactNode) => void;
    hide: () => void;
};

const ModalHost = forwardRef<ModalHostRef>(function ModalHost(_props, ref) {
    const overlayRef = useRef<{ show: (content: ReactNode) => void; hide: () => void } | null>(null);
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];

    const hide = useCallback(() => {
        overlayRef.current?.hide();
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            show: (next) => {
                overlayRef.current?.show(next);
            },
            hide,
        }),
        [hide]
    );

    return (
        <ModalOverlay
            ref={overlayRef}
            onBackPress={hide}
            contentContainerStyle={{ backgroundColor: colors.backgroundSecondary }}
        />
    );
});

export function ModalProvider({ children }: { children: ReactNode }) {
    const hostRef = useRef<ModalHostRef | null>(null);
    const value = useMemo(
        () => ({
            show: (next: ReactNode) => hostRef.current?.show(next),
            hide: () => hostRef.current?.hide(),
        }),
        []
    );

    return (
        <ModalContext.Provider
            value={value}
        >
            {children}
            <ModalHost ref={hostRef} />
        </ModalContext.Provider>
    );
}

export function useModal() {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error('useModal must be used inside ModalProvider');
    return ctx;
}
