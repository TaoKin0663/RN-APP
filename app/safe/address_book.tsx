import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";
import { Colors } from "@/config/theme";
import { useAccount } from "wagmi";
import { useAvatarGenerator } from "@/hooks/useAvatarGenerator";
import Jazzicon from "react-native-jazzicon";
import { formatAddress } from "@/utils/common";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppStore } from "@/store";
import { api } from "@/services/api/api";
import type { ISafeInfo } from "@/services/api/types";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter, Stack } from "expo-router";
import { Button } from "@/components/Button";

export default function AddressBook() {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? "dark"];
    const { address, chainId } = useAccount();
    const { generateAvatar } = useAvatarGenerator();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const selectedSafeAddress = useAppStore((state) => state.selectedSafeAddress);
    const setSelectedSafeAddress = useAppStore((state) => state.setSelectedSafeAddress);

    const [safes, setSafes] = useState<string[]>([]);
    const [loadingSafes, setLoadingSafes] = useState(false);
    const [safeInfos, setSafeInfos] = useState<Record<string, ISafeInfo>>({});
    const loadingSafeAddresses = useRef<Set<string>>(new Set());

    const addressAvatars = useMemo(() => {
        const avatars: Record<string, number | null> = {};
        safes.forEach((addr) => {
            avatars[addr] = generateAvatar(addr);
        });
        return avatars;
    }, [safes, generateAvatar]);

    const displayAddress = selectedSafeAddress || address;

    const fetchSafeInfo = useCallback(
        async (safeAddress: string) => {
            if (!chainId) return;
            if (loadingSafeAddresses.current.has(safeAddress)) return;

            try {
                loadingSafeAddresses.current.add(safeAddress);
                const response = await api.safe.getSafeInfo(chainId as number, safeAddress);
                if (response.success && response.data) {
                    setSafeInfos((prev) => ({ ...prev, [safeAddress]: response.data }));
                }
            } catch (error) {
                console.error(`获取 Safe 信息失败 (${safeAddress}):`, error);
            } finally {
                loadingSafeAddresses.current.delete(safeAddress);
            }
        },
        [chainId]
    );

    const fetchSafes = useCallback(async () => {
        if (!address || !chainId) {
            setSafes([]);
            return;
        }

        try {
            setLoadingSafes(true);
            const response = await api.safe.getSafesByOwnerAddress(chainId as number, address);
            if (response.success && response.data) {
                const safeAddresses = response.data.safes || [];
                setSafes(safeAddresses);
                safeAddresses.forEach((safeAddress) => {
                    fetchSafeInfo(safeAddress);
                });
            } else {
                setSafes([]);
                console.error("获取 Safe 列表失败:", response.message);
            }
        } catch (error) {
            console.error("获取 Safe 列表失败:", error);
            setSafes([]);
        } finally {
            setLoadingSafes(false);
        }
    }, [address, chainId, fetchSafeInfo]);

    useEffect(() => {
        fetchSafes();
    }, [fetchSafes]);

    const handleCopyAddress = useCallback(async (addr: string) => {
        try {
            await Clipboard.setStringAsync(addr);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            console.error("复制失败:", error);
        }
    }, []);

    const handleNavigateToSafeSettings = useCallback(
        (safeAddress: string) => {
            router.push({
                pathname: "/safe/settings",
                params: { safeAddress },
            });
        },
        [router]
    );

    const handleNavigateToNewSafe = useCallback(() => {
        router.push("/safe/new");
    }, [router]);

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <Stack.Screen
                options={{
                    title: "多签账户",
                    headerTitleAlign: "center",
                    headerShadowVisible: false,
                    headerStyle: {
                        backgroundColor: colors.background,
                    },
                    headerTintColor: colors.text,
                    headerRight: () => (
                        <Button
                            color="primary"
                            size="sm"
                            onPress={handleNavigateToNewSafe}
                            className="mr-2"
                        >
                            创建
                        </Button>
                    ),
                }}
            />
            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 8,
                    paddingBottom: insets.bottom + 16,
                }}
                showsVerticalScrollIndicator={false}
            >
                {loadingSafes ? (
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        加载中...
                    </Text>
                ) : safes.length === 0 ? (
                    <View className="rounded-xl p-4 items-center" style={{ backgroundColor: colors.background }}>
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>
                            暂无地址
                        </Text>
                    </View>
                ) : (
                    safes.map((addr, index) => {
                        const addrAvatar = addressAvatars[addr];
                        const isSafe = safes.includes(addr);
                        const safeInfo = safeInfos[addr];
                        const thresholdText = safeInfo ? `${safeInfo.threshold}/${safeInfo.owners.length}` : null;
                        const isSelected = displayAddress === addr;

                        return (
                            <TouchableOpacity
                                key={`${addr}-${index}`}
                                className="rounded-xl p-4 mb-3 flex-row items-center"
                                style={{
                                    backgroundColor: isSelected ? colors.backgroundTertiary : colors.background,
                                }}
                                activeOpacity={0.7}
                                onPress={() => {
                                    if (isSafe) {
                                        setSelectedSafeAddress(addr);
                                    } else {
                                        setSelectedSafeAddress(null);
                                    }
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                            >
                                <View className="relative">
                                    {addrAvatar !== null && <Jazzicon size={40} seed={addrAvatar} />}
                                    {isSafe && thresholdText && (
                                        <View
                                            className="absolute -top-1 -right-1 rounded-full border-2 items-center justify-center"
                                            style={{
                                                minWidth: 24,
                                                height: 24,
                                                paddingHorizontal: 4,
                                                backgroundColor: colors.primary,
                                                borderColor: colors.background,
                                            }}
                                        >
                                            <Text
                                                className="text-xs font-bold"
                                                style={{
                                                    color: "#FFFFFF",
                                                    fontSize: 10,
                                                }}
                                            >
                                                {thresholdText}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="text-sm font-semibold mb-1" style={{ color: colors.text }}>
                                        {formatAddress(addr)}
                                    </Text>
                                </View>
                                {isSafe && (
                                    <TouchableOpacity
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleNavigateToSafeSettings(addr);
                                        }}
                                        activeOpacity={0.6}
                                        className="ml-1 p-2"
                                    >
                                        <MaterialIcons name="settings" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleCopyAddress(addr);
                                    }}
                                    activeOpacity={0.6}
                                    className="ml-2 p-2"
                                >
                                    <MaterialIcons name="content-copy" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.6} className="ml-1 p-2">
                                    <MaterialIcons name="qr-code" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
