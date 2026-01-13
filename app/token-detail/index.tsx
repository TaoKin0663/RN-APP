import { TouchableOpacity, View, Text, ScrollView, ActivityIndicator, TextInput, Platform, Keyboard, Alert, InteractionManager } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '@/services/api/api';
import type { IToken } from '@/services/api/types';
import { TokenIcon } from '@/components/TokenIcon';
import { Button } from '@/components/Button';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatUnits, parseUnits } from 'viem';
import * as Clipboard from 'expo-clipboard';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { useModal } from '@/components/ui/Modal';
import { ModalContent } from '@/components/ui/ModalContent';
import { useAppStore } from '@/store';
import { startKYCVerificationWithAlert } from '@/utils/kycVerification';
import { useRegularBenefitsTrade } from '@/hooks/trade/useRegularBenefitsTrade';
import { useStakeTrade } from '@/hooks/trade/useStakeTrade';
import { useAppKit, useAccount } from '@reown/appkit-react-native';

enum TokenType {
    REGULAR_BENEFITS = "REGULAR_BENEFITS",
    STAKE = "STAKE",
    EQUITY = "EQUITY",
}

/**
 * KYC 状态类型枚举
 * 用于标识用户 KYC 的不同场景
 */
export enum KYCStatusType {
    /** 新用户且未通过 KYC（链上链下） */
    NEW_USER = 6,
    /** 老用户在该工厂尚未完成 KYC（切换工厂） */
    SWITCH_FACTORY = 7,
    /** 老用户换 Token（切换token） */
    SWITCH_TOKEN = 8,
}



export default function TokenDetailScreen() {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const router = useRouter();
    const { tokenAddress } = useLocalSearchParams<{ tokenAddress: string }>();
    const selectedSafeAddress = useAppStore(state => state.selectedSafeAddress);
    const { address: accountAddress, isConnected, chainId } = useAccount();
    // 使用选中的 Safe 地址，如果没有则使用连接的钱包地址
    const effectiveAccountAddress = selectedSafeAddress || accountAddress;
    const [token, setToken] = useState<IToken | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [investmentAmount, setInvestmentAmount] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const { show, hide } = useModal();
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

    // 计算要购买的代币数量（investmentAmount 是 token 数量，不是 USD 金额）
    const calculateTokenAmount = useMemo(() => {
        if (!token || !investmentAmount) {
            return null;
        }
        try {
            const tokenAmount = parseFloat(investmentAmount);
            if (isNaN(tokenAmount) || tokenAmount <= 0) {
                return null;
            }
            // 将 token 数量转换为最小单位（考虑精度）
            return parseUnits(tokenAmount.toFixed(token.decimals), token.decimals);
        } catch (error) {
            console.error('计算代币数量失败:', error);
            return null;
        }
    }, [token, investmentAmount]);

    const isRegularBenefits = token?.type === TokenType.REGULAR_BENEFITS;
    const isStake = token?.type === TokenType.STAKE;

    const regularBenefitsTrade = useRegularBenefitsTrade({
        enabled: isRegularBenefits,
        token,
        tokenAddress: tokenAddress ?? undefined,
        tokenAmount: calculateTokenAmount,
        accountAddress: effectiveAccountAddress ?? undefined,
        isConnected,
    });

    const stakeTrade = useStakeTrade({
        enabled: isStake,
        token,
        tokenAddress: tokenAddress ?? undefined,
        tokenAmount: calculateTokenAmount,
        accountAddress: effectiveAccountAddress ?? undefined,
        isConnected,
    });

    // 处理 approve 错误（REGULAR_BENEFITS 和 STAKE）
    useEffect(() => {
        if (isRegularBenefits && regularBenefitsTrade.approveError) {
            console.error('Approve 交易失败:', regularBenefitsTrade.approveError);
            show(<ModalContent
                title="提示"
                message={'授权失败，请重试'}
                buttons={
                    <Button color="primary" onPress={hide}>
                        我知道了
                    </Button>
                }
            />)
        }
        if (isStake && stakeTrade.approveError) {
            console.error('Approve 交易失败:', stakeTrade.approveError);
            show(<ModalContent
                title="提示"
                message={'授权失败，请重试'}
                buttons={
                    <Button color="primary" onPress={hide}>
                        我知道了
                    </Button>
                }
            />)
        }
    }, [isRegularBenefits, isStake, regularBenefitsTrade.approveError, stakeTrade.approveError]);

    // 处理购买/质押错误（REGULAR_BENEFITS 和 STAKE）
    useEffect(() => {
        if (isRegularBenefits && regularBenefitsTrade.purchaseError) {
            console.error('购买交易失败:', regularBenefitsTrade.purchaseError);
            show(<ModalContent
                title="提示"
                message={'交易失败，请重试'}
                buttons={
                    <Button color="primary" onPress={hide}>
                        我知道了
                    </Button>
                }
            />)
        }
        if (isStake && stakeTrade.stakeError) {
            console.error('质押交易失败:', stakeTrade.stakeError);
            show(<ModalContent
                title="提示"
                message={'交易失败，请重试'}
                buttons={
                    <Button color="primary" onPress={hide}>
                        我知道了
                    </Button>
                }
            />)
        }
    }, [isRegularBenefits, isStake, regularBenefitsTrade.purchaseError, stakeTrade.stakeError]);

    // 购买/质押交易发送成功后，跳转到交易进度页面（REGULAR_BENEFITS 和 STAKE）
    useEffect(() => {
        if (isRegularBenefits && regularBenefitsTrade.purchaseTxHash) {
            bottomSheetRef.current?.close();
            router.push({
                pathname: '/transaction-progress',
                params: { hash: regularBenefitsTrade.purchaseTxHash },
            });
        }
        if (isStake && stakeTrade.stakeTxHash) {
            bottomSheetRef.current?.close();
            router.push({
                pathname: '/transaction-progress',
                params: { hash: stakeTrade.stakeTxHash },
            });
        }
    }, [isRegularBenefits, isStake, regularBenefitsTrade.purchaseTxHash, stakeTrade.stakeTxHash, router]);

    const needsApprove = isRegularBenefits ? regularBenefitsTrade.needsApprove : (isStake ? stakeTrade.needsApprove : null);
    const isApproving = isRegularBenefits ? regularBenefitsTrade.isApproving : (isStake ? stakeTrade.isApproving : false);
    const isWaitingApprove = isRegularBenefits ? regularBenefitsTrade.isWaitingApprove : (isStake ? stakeTrade.isWaitingApprove : false);
    const isPurchasing = isRegularBenefits ? regularBenefitsTrade.isPurchasing : (isStake ? stakeTrade.isStaking : false);
    const isLoadingAllowance = isRegularBenefits ? regularBenefitsTrade.isLoadingAllowance : (isStake ? stakeTrade.isLoadingAllowance : false);

    const check = async (): Promise<boolean> => {
        if (!token) {
            return false;
        }
        if (!effectiveAccountAddress) {
            console.error('未选择账户地址');
            return false;
        }

        // 检查当前网络是否与代币所在网络匹配
        if (token.chain?.chain_id && chainId) {
            // 解析代币的 chain_id（可能是十六进制字符串或数字字符串）
            let tokenChainId: number | null = null;
            const chainIdStr = token.chain.chain_id.toString();
            // 如果是十六进制格式（0x开头），转换为数字
            if (chainIdStr.startsWith('0x') || chainIdStr.startsWith('0X')) {
                tokenChainId = parseInt(chainIdStr, 16);
            } else {
                // 否则直接解析为数字
                tokenChainId = parseInt(chainIdStr, 10);
            }

            // 如果解析失败或网络不匹配，提示用户
            if (tokenChainId === null || isNaN(tokenChainId) || chainId !== tokenChainId) {
                show(
                    <ModalContent
                        title="提示"
                        message={`当前网络与代币所在网络不匹配，请切换到 ${token.chain.display_name || token.chain.name || '对应网络'}`}
                        buttons={
                            <Button color="primary" onPress={hide}>
                                我知道了
                            </Button>
                        }
                    />
                );
                return false;
            }
        }

        const KYCStatusResponse = await api.kyc.getKycStatus({ tokenAddress, userAddressToCheck: effectiveAccountAddress });
        console.log("KYCStatusResponse----------------------")
        console.log(KYCStatusResponse);
        if (!KYCStatusResponse.success) {
            return false;
        }
        if (!KYCStatusResponse.data.isVerified) {
            show(
                <ModalContent
                    title="提示"
                    message={`当前地址不能购买${token?.symbol}，当前账号未通过KYC`}
                    buttons={[
                        <Button key="cancel" variant="outline" onPress={hide}>
                            取消
                        </Button>,
                        <Button key="kyc" color="primary" onPress={async () => {
                            hide();
                            // 检查必要参数
                            if (!effectiveAccountAddress || !tokenAddress || !token.factory_address) {
                                Alert.alert('错误', '缺少必要参数');
                                return;
                            }
                            if (KYCStatusResponse.data.type === KYCStatusType.NEW_USER) {
                                // 直接调用 KYC 验证方法
                                await startKYCVerificationWithAlert(
                                    {
                                        walletAddress: effectiveAccountAddress,
                                        tokenAddress: tokenAddress,
                                        factoryAddress: token.factory_address,
                                        chainId: '11155111',
                                    },
                                    () => {
                                        // 验证成功回调，可以刷新状态
                                        console.log('KYC 验证成功');
                                    },
                                    (error) => {
                                        // 验证失败回调
                                        console.log('KYC 验证失败:', error);
                                    }
                                );
                            } else {
                                await api.kyc.onchainKYC({
                                    type: KYCStatusResponse.data.type?.toString() || "",
                                    token_address: tokenAddress,
                                    token_type: token.type || "",
                                    factory_address: token.factory_address || "",
                                })
                            }
                        }}>
                            去认证
                        </Button>
                    ]}
                />
            );
            return false;
        }
        if (KYCStatusResponse.data.walletaddress.toLocaleLowerCase() !== effectiveAccountAddress?.toLocaleLowerCase()) {
            show(
                <ModalContent
                    title="提示"
                    message={`当前地址不能购买${token?.symbol}，当前账号绑定地址：${formatAddress(KYCStatusResponse.data.walletaddress)}`}
                    buttons={
                        <>
                        <Button color="primary" onPress={hide}>
                            我知道了
                        </Button>
                        </>
                    }
                />
            );
            return false;
        }
        // 所有检查通过
        return true;
    }

    // 获取代币详情
    // useEffect(() => {
    //     const fetchTokenDetail = async () => {
    //         console.log("请求代币详情----------------------")
    //         if (!tokenAddress) {
    //             setError('缺少代币地址参数');
    //             setLoading(false);
    //             return;
    //         }

    //         try {
    //             setLoading(true);
    //             setError(null);
    //             const response = await api.token.getTokenList({ tokenAddress });
    //             if (response.success && response.data && response.data.tokens && response.data.tokens.length > 0) {
    //                 setToken(response.data.tokens[0]);
    //             } else {
    //                 setError(response.message || '获取代币详情失败');
    //             }
    //         } catch (err) {
    //             setError('网络请求失败，请稍后重试');
    //             console.error('获取代币详情失败:', err);
    //         } finally {
    //             setLoading(false);
    //         }
    //     };
    //     setTimeout(() => {
    //         fetchTokenDetail();
    //     }, 5000);
    // }, [tokenAddress]);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            InteractionManager.runAfterInteractions(async () => {
                console.log("请求代币详情----------------------")
                if (!tokenAddress) {
                    if (isMounted) {
                        setError('缺少代币地址参数');
                        setLoading(false);
                    }
                    return;
                }

                try {
                    if (isMounted) {
                        setLoading(true);
                        setError(null);
                    }

                    const response = await api.token.getTokenList({ tokenAddress });

                    // 检查组件是否仍然挂载
                    if (!isMounted) {
                        return;
                    }

                    if (response.success && response.data && response.data.tokens && response.data.tokens.length > 0) {
                        setToken(response.data.tokens[0]);
                    } else {
                        setError(response.message || '获取代币详情失败');
                    }
                } catch (err) {
                    // 如果组件已卸载，不更新状态
                    if (!isMounted) {
                        return;
                    }
                    setError('网络请求失败，请稍后重试');
                    console.error('获取代币详情失败:', err);
                } finally {
                    if (isMounted) {
                        setLoading(false);
                    }
                }
                console.log("优化后的请求代币详情----------------------")
            });

            // 清理函数：标记组件已卸载
            // 注意：runAfterInteractions 返回的 Promise 无法直接取消
            // 但通过 isMounted 标志可以避免在组件卸载后更新状态
            return () => {
                isMounted = false;
            };
        }, [tokenAddress])
    );

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
                style={[
                    props.style,
                    {
                        backgroundColor: colorScheme === 'dark' 
                            ? 'rgba(0, 0, 0, 0.5)' 
                            : 'rgba(0, 0, 0, 0.3)',
                    },
                ]}
            />
        ),
        [colorScheme]
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
                                {isStake ? '质押数量' : '投资金额'}
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
                                placeholder={isStake ? '请输入质押数量' : '请输入投资金额'}
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
                            onPress={async () => {
                                Keyboard.dismiss();
                                const checkResult = await check();
                                if (!checkResult) return;
                                bottomSheetRef.current?.expand();
                            }}
                        >
                            {isStake ? '质押' : '投资'}
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
                backgroundStyle={{ backgroundColor: colors.background }}
                handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
            >
                <BottomSheetView className='flex-1 px-4 py-6'>
                    <Text className="text-xl font-bold mb-6" style={{ color: colors.text }}>
                        {isStake ? '质押预览' : '购买预览'}
                    </Text>

                    <View className="mb-4">
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-base" style={{ color: colors.textSecondary }}>
                                数量
                            </Text>
                            <Text className="text-base font-semibold" style={{ color: colors.text }}>
                                {investmentAmount && token
                                    ? `${investmentAmount} ${token.symbol}`
                                    : '--'}
                            </Text>
                        </View>

                        {!isStake && (
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-base" style={{ color: colors.textSecondary }}>
                                    价格
                                </Text>
                                <Text className="text-base font-semibold" style={{ color: colors.text }}>
                                    ${formatPrice(token?.sale_plan?.price || '0', token?.decimals || 18)}
                                </Text>
                            </View>
                        )}

                        {/* 授权状态提示 */}
                        {(isRegularBenefits || isStake) && (
                            <View className="mb-3">
                                {!isConnected ? (
                                    <View className="rounded-xl p-3" style={{ backgroundColor: colors.backgroundSecondary }}>
                                        <Text className="text-sm" style={{ color: colors.textTertiary }}>
                                            请先连接钱包
                                        </Text>
                                    </View>
                                ) : isLoadingAllowance || needsApprove === null ? (
                                    <View className="flex-row items-center rounded-xl p-3" style={{ backgroundColor: colors.backgroundSecondary }}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                        <Text className="text-sm ml-2" style={{ color: colors.textTertiary }}>
                                            检查授权状态中...
                                        </Text>
                                    </View>
                                ) : needsApprove === true ? (
                                    <View className="rounded-xl p-3" style={{ backgroundColor: colors.backgroundSecondary }}>
                                        <Text className="text-sm" style={{ color: colors.primary }}>
                                            ⚠️ {isStake ? '需要先授权代币才能进行质押' : '需要先授权 USDT 才能进行购买'}
                                        </Text>
                                    </View>
                                ) : (
                                    <View className="rounded-xl p-3" style={{ backgroundColor: colors.backgroundSecondary }}>
                                        <Text className="text-sm" style={{ color: colors.textSecondary }}>
                                            ✓ 授权状态正常，{isStake ? '可以质押' : '可以购买'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {!isRegularBenefits && !isStake ? (
                        <Button
                            className="w-full mt-4"
                            color="primary"
                            style={{
                                minWidth: '100%',
                                alignSelf: 'stretch',
                            }}
                            disabled
                        >
                            暂不支持该类型购买
                        </Button>
                    ) : needsApprove === true ? (
                        <Button
                            className="w-full mt-4"
                            color="primary"
                            style={{
                                minWidth: '100%',
                                alignSelf: 'stretch',
                            }}
                            onPress={() => {
                                if (isRegularBenefits) {
                                    regularBenefitsTrade.approve();
                                } else if (isStake) {
                                    stakeTrade.approve();
                                }
                            }}
                            disabled={
                                isApproving || 
                                isWaitingApprove || 
                                (isRegularBenefits && !regularBenefitsTrade.canApprove) ||
                                (isStake && !stakeTrade.canApprove)
                            }
                        >
                            {isApproving ? '授权中...' : isWaitingApprove ? '等待确认中...' : (isStake ? '授权代币' : '授权 USDT')}
                        </Button>
                    ) : (
                        <Button
                            className="w-full mt-4"
                            color="primary"
                            style={{
                                minWidth: '100%',
                                alignSelf: 'stretch',
                            }}
                            onPress={() => {
                                if (isRegularBenefits) {
                                    regularBenefitsTrade.purchase();
                                } else if (isStake) {
                                    stakeTrade.stake();
                                }
                            }}
                            disabled={
                                isPurchasing || 
                                (isRegularBenefits && !regularBenefitsTrade.canPurchase) ||
                                (isStake && !stakeTrade.canStake)
                            }
                        >
                            {isPurchasing ? (isStake ? '质押中...' : '交易中...') : (isStake ? '确认质押' : '确认购买')}
                        </Button>
                    )}
                </BottomSheetView>
            </BottomSheet>
        </SafeAreaView>
    );
}

