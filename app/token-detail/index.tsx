import { TouchableOpacity, View, Text, ScrollView, ActivityIndicator, TextInput, Platform, Keyboard } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect, useRef, useCallback,useMemo } from 'react';
import { api } from '@/services/api/api';
import type { IToken } from '@/services/api/types';
import { TokenIcon } from '@/components/TokenIcon';
import { Button } from '@/components/Button';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatUnits } from 'viem';
import * as Clipboard from 'expo-clipboard';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetBackdropProps } from "@gorhom/bottom-sheet";

enum TokenType {
    REGULAR_BENEFITS = "REGULAR_BENEFITS",
    STAKE = "STAKE",
    EQUITY = "EQUITY",
}

export default function TokenDetailScreen() {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const router = useRouter();
    const { tokenAddress } = useLocalSearchParams<{ tokenAddress: string }>();
    const [token, setToken] = useState<IToken | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [investmentAmount, setInvestmentAmount] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const bottomSheetRef = useRef<BottomSheet>(null);
    // const snapPoints = useMemo(() => ["25%", "50%", "75%"], []);

    // 格式化地址显示
    const formatAddress = (address: string) => {
        if (!address) return '';
        if (address.length <= 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // 格式化完整地址（用于复制）
    const formatFullAddress = (address: string) => {
        if (!address) return '';
        return address;
    };

    // 格式化日期
    const formatDate = (dateString: string | number) => {
        if (!dateString) return 'N/A';

        // 如果是数字或数字字符串，处理时间戳
        const numValue = typeof dateString === 'string' ? parseFloat(dateString) : dateString;
        if (!isNaN(numValue)) {
            // 10位时间戳（秒级）需要转换为13位（毫秒级）
            const timestamp = numValue.toString().length === 10 ? numValue * 1000 : numValue;
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return 'N/A';
            return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }

        // 如果是日期字符串，直接使用
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    // 格式化总供应量
    const formatTotalSupply = (supply: string) => {
        if (!supply) return '0';
        const num = parseFloat(supply);
        if (num >= 1000000000) {
            return `${(num / 1000000000).toFixed(2)}B`;
        } else if (num >= 1000000) {
            return `${(num / 1000000).toFixed(2)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(2)}K`;
        }
        return num.toFixed(2);
    };

    // 将秒数转换为天数
    const formatSecondsToDays = (seconds: number | string) => {
        const secondsNum = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
        if (isNaN(secondsNum) || secondsNum <= 0) return '0';
        const days = secondsNum / 86400; // 86400秒 = 1天
        return Math.ceil(days).toString(); // 向上取整，确保至少显示1天
    };

    // 格式化价格（使用 viem 的 formatUnits 处理精度）
    const formatPrice = (price: string, decimals: number) => {
        try {
            const formatted = formatUnits(BigInt(price), decimals);
            const num = parseFloat(formatted);
            if (num % 1 === 0) {
                return num.toString();
            }
            return num.toFixed(6).replace(/\.?0+$/, '');
        } catch (error) {
            console.error('格式化价格失败:', error);
            return price;
        }
    };

    // 复制到剪贴板
    const copyToClipboard = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text);
            // 可以添加一个 toast 提示
        } catch (error) {
            console.error('复制失败:', error);
        }
    };

    // 获取代币详情
    useEffect(() => {
        const fetchTokenDetail = async () => {
            if (!tokenAddress) {
                setError('缺少代币地址参数');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                const response = await api.token.getTokenList({ tokenAddress });
                if (response.success && response.data && response.data.tokens && response.data.tokens.length > 0) {
                    setToken(response.data.tokens[0]);
                } else {
                    setError(response.message || '获取代币详情失败');
                }
            } catch (err) {
                setError('网络请求失败，请稍后重试');
                console.error('获取代币详情失败:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTokenDetail();
    }, [tokenAddress]);

    // 监听键盘显示/隐藏
    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                setKeyboardHeight(e.endCoordinates.height);
            }
        );
        const hideSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardHeight(0);
            }
        );

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);


    const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
			/>
		),
		[]
	);

    // 信息卡片组件
    const InfoCard = ({ label, value, onPress, copyable = false }: {
        label: string;
        value: string;
        onPress?: () => void;
        copyable?: boolean;
    }) => (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={copyable ? 0.7 : 1}
            className="rounded-xl p-4 mb-3"
            style={{ backgroundColor: colors.backgroundSecondary }}
        >
            <View className="flex-row items-center justify-between">
                <Text className="text-xs" style={{ color: colors.textTertiary }}>{label}</Text>
                {copyable && (
                    <TouchableOpacity
                        onPress={() => copyToClipboard(value)}
                        className="ml-2"
                    >
                        <MaterialIcons name="content-copy" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
            <Text
                className="text-base font-semibold mt-1"
                style={{ color: colors.text }}
                numberOfLines={1}
                ellipsizeMode="middle"
            >
                {value}
            </Text>
        </TouchableOpacity>
    );

    // 统计卡片组件
    const StatCard = ({ label, value, valueColor }: {
        label: string;
        value: string;
        valueColor?: string;
    }) => (
        <View
            className="flex-1 rounded-xl p-4"
            style={{ backgroundColor: colors.backgroundSecondary }}
        >
            <Text className="text-xs mb-2" style={{ color: colors.textTertiary }}>{label}</Text>
            <Text className="text-lg font-bold" style={{ color: valueColor || colors.primary }}>
                {value}
            </Text>
        </View>
    );

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
            {/* <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} /> */}
            <Stack.Screen options={{
                title: token?.symbol || '',
                headerTitleAlign: 'center',
                headerShadowVisible: false,
                headerStyle: {
                    backgroundColor: colors.background,
                },
                headerTintColor: colors.text,
            }} />

            <View className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingBottom: token && !loading && !error ? 200 : 16
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View className="items-center justify-center py-20">
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text className="text-sm mt-4" style={{ color: colors.textSecondary }}>加载中...</Text>
                        </View>
                    ) : error ? (
                        <View className="items-center justify-center py-20">
                            <MaterialIcons name="error-outline" size={48} color={colors.textSecondary} />
                            <Text className="text-sm mt-4" style={{ color: colors.textSecondary }}>{error}</Text>
                            <TouchableOpacity
                                onPress={() => router.back()}
                                className="mt-6 px-6 py-3 rounded-xl"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Text className="text-base font-semibold" style={{ color: colors.background }}>
                                    返回
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : token ? (
                        <>
                            {/* 代币头部信息 */}
                            <View
                                className="rounded-xl p-6 mb-5 flex-row items-center justify-between"
                                style={{ backgroundColor: colors.backgroundSecondary }}
                            >
                                <View className="flex-row items-center flex-1">
                                    <TokenIcon symbol={token.symbol} chainId={token.chain?.chain_id} size={60} />
                                    <View className="ml-4 flex-1">
                                        <Text className="text-2xl font-bold mb-1" style={{ color: colors.text }}>
                                            {token.symbol}
                                        </Text>
                                        <Text className="text-sm" style={{ color: colors.textTertiary }}>
                                            {token.name}
                                        </Text>
                                    </View>
                                </View>
                                {token.type !== TokenType.STAKE && token.sale_plan?.price && (
                                    <View className="ml-4">
                                        <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                                            ${formatPrice(token.sale_plan.price, token.decimals)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* 统计信息 */}
                            <View className="flex-row gap-3 mb-5">
                                <StatCard
                                    label="总供应量"
                                    value={formatTotalSupply(token.total_supply)}
                                />
                                <StatCard
                                    label="精度"
                                    value={token.decimals.toString()}
                                    valueColor={colors.text}
                                />
                            </View>

                            {/* 基本信息 */}
                            <View className="mb-5">
                                <Text className="text-base font-semibold mb-3" style={{ color: colors.text }}>
                                    基本信息
                                </Text>
                                <InfoCard
                                    label="代币类型"
                                    value={token.type || 'N/A'}
                                />
                                <InfoCard
                                    label="合约地址"
                                    value={formatFullAddress(token.address)}
                                    copyable
                                />
                                {token.owner_address && (
                                    <InfoCard
                                        label="所有者地址"
                                        value={formatFullAddress(token.owner_address)}
                                        copyable
                                    />
                                )}
                                {token.chain && (
                                    <InfoCard
                                        label="网络"
                                        value={token.chain.display_name || token.chain.name || 'N/A'}
                                    />
                                )}
                            </View>

                            {/* 销售计划信息 */}
                            {token.sale_plan && (
                                <View className="mb-5">
                                    <Text className="text-base font-semibold mb-3" style={{ color: colors.text }}>
                                        销售计划
                                    </Text>
                                    <InfoCard
                                        label="总代币数量"
                                        value={formatTotalSupply(token.sale_plan.total_tokens)}
                                    />
                                    <InfoCard
                                        label="价格"
                                        value={`$${formatPrice(token.sale_plan.price, token.decimals)}`}
                                    />
                                    {token.sale_plan.validity_period && (
                                        <InfoCard
                                            label="有效期（天）"
                                            value={formatSecondsToDays(token.sale_plan.validity_period)}
                                        />
                                    )}
                                    {token.sale_plan.dividend_interval && (
                                        <InfoCard
                                            label="分红间隔（天）"
                                            value={token.sale_plan.dividend_interval.toString()}
                                        />
                                    )}
                                    {token.sale_plan.start_time && (
                                        <InfoCard
                                            label="开始时间"
                                            value={formatDate(token.sale_plan.start_time)}
                                        />
                                    )}
                                </View>
                            )}

                            {/* 质押计划信息 */}
                            {token.staking_plan && (
                                <View className="mb-5">
                                    <Text className="text-base font-semibold mb-3" style={{ color: colors.text }}>
                                        质押计划
                                    </Text>
                                    {token.staking_plan.lock_period_days && (
                                        <InfoCard
                                            label="锁定期（天）"
                                            value={token.staking_plan.lock_period_days.toString()}
                                        />
                                    )}
                                    {token.staking_plan.min_per_user && (
                                        <InfoCard
                                            label="每用户最小数量"
                                            value={formatTotalSupply(token.staking_plan.min_per_user)}
                                        />
                                    )}
                                    {token.staking_plan.max_per_user && (
                                        <InfoCard
                                            label="每用户最大数量"
                                            value={formatTotalSupply(token.staking_plan.max_per_user)}
                                        />
                                    )}
                                    {token.staking_plan.max_total_supply && (
                                        <InfoCard
                                            label="最大总供应量"
                                            value={formatTotalSupply(token.staking_plan.max_total_supply)}
                                        />
                                    )}
                                    {token.staking_plan.early_redemption_fee !== undefined && (
                                        <InfoCard
                                            label="提前赎回费用（%）"
                                            value={token.staking_plan.early_redemption_fee.toString()}
                                        />
                                    )}
                                </View>
                            )}

                            {/* 合约信息 */}
                            <View className="mb-5">
                                <Text className="text-base font-semibold mb-3" style={{ color: colors.text }}>
                                    合约信息
                                </Text>
                                {token.factory_address && (
                                    <InfoCard
                                        label="工厂地址"
                                        value={formatFullAddress(token.factory_address)}
                                        copyable
                                    />
                                )}
                                {token.identity_registry && (
                                    <InfoCard
                                        label="身份注册表"
                                        value={formatFullAddress(token.identity_registry)}
                                        copyable
                                    />
                                )}
                                {token.compliance && (
                                    <InfoCard
                                        label="合规合约"
                                        value={formatFullAddress(token.compliance)}
                                        copyable
                                    />
                                )}
                                {token.deployment_transaction_hash && (
                                    <InfoCard
                                        label="部署交易哈希"
                                        value={formatFullAddress(token.deployment_transaction_hash)}
                                        copyable
                                    />
                                )}
                            </View>
                        </>
                    ) : null}
                </ScrollView>

                {/* 底部固定投资按钮 */}
                {token && !loading && !error && (
                    <View
                        className="px-4 pt-3"
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: colors.background,
                            borderTopWidth: 1,
                            borderTopColor: colors.backgroundSecondary,
                            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : 25,
                        }}
                    >
                        <View className="mb-4">
                            <Text
                                className="text-sm mb-2"
                                style={{ color: colors.textSecondary }}
                            >
                                投资金额
                            </Text>
                            <TextInput
                                className="w-full rounded-xl"
                                style={{
                                    backgroundColor: colors.backgroundSecondary,
                                    color: colors.text,
                                    fontSize: 16,
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                    height: 52,
                                }}
                                placeholder="请输入投资金额"
                                placeholderTextColor={colors.textTertiary}
                                value={investmentAmount}
                                onChangeText={setInvestmentAmount}
                                keyboardType="decimal-pad"
                                returnKeyType="done"
                            />
                        </View>
                        <Button
                            className="w-full"
                            color="primary"
                            style={{
                                minWidth: '100%',
                                alignSelf: 'stretch',
                            }}
                            onPress={() => {
                                // 先关闭键盘，避免遮挡bottomSheet
                                Keyboard.dismiss();
                                // 延迟一帧再打开bottomSheet，确保键盘完全关闭
                                setTimeout(() => {
                                    bottomSheetRef.current?.expand();
                                }, 100);
                            }}
                        >
                            投资
                        </Button>
                    </View>
                )}
            </View>


            <BottomSheet
                ref={bottomSheetRef}
                index={-1}
                snapPoints={['50%']}
                backdropComponent={renderBackdrop}
                enableDynamicSizing={false}
                enablePanDownToClose={true}
            >
                <BottomSheetView className='flex-1 px-4 py-6'>
                    <Text className="text-xl font-bold mb-6" style={{ color: colors.text }}>
                        购买预览
                    </Text>
                    
                    <View className="mb-4">
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-base" style={{ color: colors.textSecondary }}>
                                数量
                            </Text>
                            <Text className="text-base font-semibold" style={{ color: colors.text }}>
                                100 RWA
                            </Text>
                        </View>
                        
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-base" style={{ color: colors.textSecondary }}>
                                单价
                            </Text>
                            <Text className="text-base font-semibold" style={{ color: colors.text }}>
                                $1.23
                            </Text>
                        </View>
                        
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-base" style={{ color: colors.textSecondary }}>
                                手续费
                            </Text>
                            <Text className="text-base font-semibold" style={{ color: colors.text }}>
                                $1.20
                            </Text>
                        </View>
                        
                        <View 
                            className="h-px my-4"
                            style={{ backgroundColor: colors.backgroundSecondary }}
                        />
                        
                        <View className="flex-row justify-between items-center">
                            <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                                合计
                            </Text>
                            <Text className="text-lg font-bold" style={{ color: colors.primary }}>
                                $124.20
                            </Text>
                        </View>
                    </View>
                    
                    <Button
                        className="w-full mt-4"
                        color="primary"
                        style={{
                            minWidth: '100%',
                            alignSelf: 'stretch',
                        }}
                        onPress={() => {
                            // TODO: 处理确认购买逻辑
                            bottomSheetRef.current?.close();
                        }}
                    >
                        确认购买
                    </Button>
                </BottomSheetView>
            </BottomSheet>
        </SafeAreaView>
    );
}

