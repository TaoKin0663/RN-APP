import { TouchableOpacity, View, Text, ScrollView, ActivityIndicator, TextInput, Platform, Keyboard, Alert, InteractionManager } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/config/theme';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '@/services/api/api';
import type { IToken, KYCStatusResponse } from '@/services/api/types';
import { TokenIcon } from '@/components/TokenIcon';
import { Button } from '@/components/Button';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatUnits, parseUnits, encodeFunctionData, erc20Abi, type Address } from 'viem';
import * as Clipboard from 'expo-clipboard';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { useModal } from '@/components/ui/Modal';
import { ModalContent } from '@/components/ui/ModalContent';
import { useAppStore } from '@/store';
import { startKYCVerificationWithAlert } from '@/utils/kycVerification';
import { tokenABI } from "@/utils/ABI/token";
import { useAccount, useEstimateGas, useGasPrice, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

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
    const selectedAccountAddress = useAppStore(state => state.selectedAccountAddress);
    const { address: accountAddress, isConnected } = useAccount();
    const chainId = useChainId();
    // 使用选中的账户地址，如果没有则使用连接的钱包地址
    const effectiveAccountAddress = selectedAccountAddress || accountAddress;
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

    // 读取 USDT token 地址
    const { data: usdtTokenAddress } = useReadContract({
        address: tokenAddress as Address | undefined,
        abi: tokenABI,
        functionName: 'usdtToken',
        query: {
            enabled: !!tokenAddress && isConnected,
        },
    });

    // 读取 USDT 精度（不同 USDT 合约可能是 6 或 18）
    const { data: usdtDecimals } = useReadContract({
        address: usdtTokenAddress as Address | undefined,
        abi: erc20Abi,
        functionName: 'decimals',
        query: {
            enabled: !!usdtTokenAddress && isConnected,
        },
    });

    // 计算需要的 USDT 数量（用 BigInt 精确计算，避免浮点误差）
    // 约定：sale_plan.price 是“每 1 个 token（按 token.decimals）”的价格（同样按 token.decimals 缩放）
    // 需要的 USDT = tokenAmountBase * priceRaw / 10^token.decimals，然后按 usdtDecimals 进行缩放对齐
    const calculateUsdtAmount = useMemo(() => {
        if (!token?.sale_plan?.price || !calculateTokenAmount || usdtDecimals === undefined) {
            return null;
        }
        try {
            const priceRaw = BigInt(token.sale_plan.price);
            const tokenDecimals = token.decimals;
            const pow10 = (n: number) => 10n ** BigInt(n);

            // 先算出以 token.decimals 作为缩放的“价格*数量”结果
            let cost = (calculateTokenAmount * priceRaw) / pow10(tokenDecimals);

            // 将 cost 缩放到 USDT 的 decimals
            const diff = usdtDecimals - tokenDecimals;
            if (diff > 0) cost = cost * pow10(diff);
            if (diff < 0) cost = cost / pow10(-diff);

            return cost;
        } catch (error) {
            console.error('计算 USDT 数量失败:', error);
            return null;
        }
    }, [token?.sale_plan?.price, token?.decimals, calculateTokenAmount, usdtDecimals]);

    // 检查 USDT allowance
    const { data: usdtAllowance, refetch: refetchAllowance, isLoading: isLoadingAllowance, error: allowanceError } = useReadContract({
        address: usdtTokenAddress as Address | undefined,
        abi: erc20Abi,
        functionName: 'allowance',
        args: effectiveAccountAddress && tokenAddress
            ? [effectiveAccountAddress as Address, tokenAddress as Address]
            : undefined,
        query: {
            enabled: !!usdtTokenAddress && !!effectiveAccountAddress && !!tokenAddress && isConnected,
            refetchInterval: 5000, // 每5秒刷新一次
        },
    });

    // 调试 allowance 状态
    useEffect(() => {
        console.log('Allowance 状态:', {
            usdtTokenAddress,
            usdtDecimals,
            effectiveAccountAddress,
            tokenAddress,
            isConnected,
            isLoadingAllowance,
            usdtAllowance: usdtAllowance?.toString(),
            allowanceError,
            calculateUsdtAmount: calculateUsdtAmount?.toString(),
        });
    }, [usdtTokenAddress, usdtDecimals, effectiveAccountAddress, tokenAddress, isConnected, isLoadingAllowance, usdtAllowance, allowanceError, calculateUsdtAmount]);

    // 执行 approve
    const { writeContract: writeApprove, isPending: isApproving, data: approveTxHash, error: approveError } = useWriteContract();

    // 等待 approve 交易确认
    const { data: approveReceipt, isLoading: isWaitingApprove } = useWaitForTransactionReceipt({
        hash: approveTxHash,
        query: {
            enabled: !!approveTxHash,
            retry: 3,
            retryDelay: 2000,
        },
    });

    // approve 交易确认成功后刷新 allowance
    useEffect(() => {
        if (approveReceipt && approveReceipt.status === 'success') {
            console.log('Approve 交易确认成功，刷新 allowance');
            refetchAllowance();
        }
    }, [approveReceipt, refetchAllowance]);

    // 处理 approve 错误
    useEffect(() => {
        if (approveError) {
            console.error('Approve 交易失败:', approveError);
            Alert.alert('授权失败', approveError.message || 'USDT 授权失败，请重试');
        }
    }, [approveError]);

    // 执行购买交易
    const { writeContract: writePurchase, isPending: isPurchasing, data: purchaseTxHash, error: purchaseError } = useWriteContract();

    // 购买交易发送成功后，跳转到交易进度页面
    useEffect(() => {
        if (purchaseTxHash) {
            bottomSheetRef.current?.close();
            router.push({
                pathname: '/transaction-progress',
                params: { hash: purchaseTxHash },
            });
        }
    }, [purchaseTxHash, router]);

    // 处理购买错误
    useEffect(() => {
        if (purchaseError) {
            console.error('购买交易失败:', purchaseError);
            Alert.alert('交易失败', purchaseError.message || '购买失败，请重试');
        }
    }, [purchaseError]);

    // 检查是否需要 approve
    // null 表示还在检查中，true 表示需要 approve，false 表示不需要
    const needsApprove = useMemo(() => {
        // 如果数据还没准备好，返回 null（还在检查中）
        if (usdtAllowance === undefined || calculateUsdtAmount === null) {
            console.log('needsApprove: 数据未准备好', { usdtAllowance, calculateUsdtAmount });
            return null;
        }
        try {
            // 如果 allowance 为 0 或者小于需要的数量，则需要 approve
            const needs = usdtAllowance === 0n || usdtAllowance < calculateUsdtAmount;
            console.log('needsApprove: 计算结果', { 
                usdtAllowance: usdtAllowance.toString(), 
                calculateUsdtAmount: calculateUsdtAmount.toString(),
                needs 
            });
            return needs;
        } catch (error) {
            console.error('检查 allowance 失败:', error);
            return null;
        }
    }, [usdtAllowance, calculateUsdtAmount]);

    // 构建 approve 交易数据
    const approveTransactionData = useMemo(() => {
        if (!usdtTokenAddress || !tokenAddress || !calculateUsdtAmount || !effectiveAccountAddress || needsApprove !== true) {
            return undefined;
        }
        try {
            return {
                to: usdtTokenAddress as Address,
                data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [tokenAddress as Address, calculateUsdtAmount],
                }),
            } as const;
        } catch (error) {
            console.error('构建 approve 交易数据失败:', error);
            return undefined;
        }
    }, [usdtTokenAddress, tokenAddress, calculateUsdtAmount, effectiveAccountAddress, needsApprove]);

    // 构建 purchaseTokens 交易数据用于估算 gas
    const transactionData = useMemo(() => {
        // 只有在不需要 approve（needsApprove === false）时才构建交易数据
        if (!token || !tokenAddress || !calculateTokenAmount || !effectiveAccountAddress || needsApprove !== false) {
            return undefined;
        }
        try {
            return {
                to: tokenAddress as Address,
                data: encodeFunctionData({
                    abi: tokenABI,
                    functionName: 'purchaseTokens',
                    args: [calculateTokenAmount],
                }),
                account: effectiveAccountAddress as Address,
            } as const;
        } catch (error) {
            console.error('构建交易数据失败:', error);
            return undefined;
        }
    }, [token, tokenAddress, calculateTokenAmount, effectiveAccountAddress, needsApprove]);

    // 估算 gas limit（需要钱包已连接，且不需要 approve 或已 approve）
    // needsApprove 为 null 时表示还在检查，为 false 时表示不需要 approve，为 true 时表示需要 approve
    const shouldEstimateGas = isConnected && needsApprove === false && !!transactionData && !!effectiveAccountAddress && !!tokenAddress && !!calculateTokenAmount && !!transactionData.to && !!transactionData.data;
    
    // 调试信息
    useEffect(() => {
        console.log('Gas 估算状态:', {
            isConnected,
            needsApprove,
            shouldEstimateGas,
            hasTransactionData: !!transactionData,
            hasAccount: !!effectiveAccountAddress,
            accountAddress: effectiveAccountAddress,
            hasTokenAddress: !!tokenAddress,
            tokenAddress,
            hasTokenAmount: !!calculateTokenAmount,
            tokenAmount: calculateTokenAmount?.toString(),
            hasUsdtAmount: !!calculateUsdtAmount,
            usdtAmount: calculateUsdtAmount?.toString(),
            usdtTokenAddress,
            usdtAllowance: usdtAllowance?.toString(),
            to: transactionData?.to,
            hasData: !!transactionData?.data,
        });
    }, [isConnected, needsApprove, shouldEstimateGas, transactionData, effectiveAccountAddress, tokenAddress, calculateTokenAmount, calculateUsdtAmount, usdtTokenAddress, usdtAllowance]);
    
    // 只有在明确不需要 approve 时才估算 gas
    const canEstimateGas = shouldEstimateGas && needsApprove === false;
    
    const { data: estimatedGas, isLoading: isEstimatingGas, error: gasEstimateError, status: gasEstimateStatus } = useEstimateGas(
        canEstimateGas && transactionData
            ? {
                  to: transactionData.to,
                  data: transactionData.data,
                  query: {
                      refetchInterval: 10000, // 每10秒自动刷新
                      retry: 2, // 重试2次
                  },
              }
            : undefined
    );

    // 调试估算结果
    useEffect(() => {
        console.log('Gas 估算结果:', {
            needsApprove,
            canEstimateGas,
            shouldEstimateGas,
            usdtAllowance: usdtAllowance?.toString(),
            calculateUsdtAmount: calculateUsdtAmount?.toString(),
            status: gasEstimateStatus,
            isLoading: isEstimatingGas,
            estimatedGas: estimatedGas?.toString(),
            error: gasEstimateError,
        });
    }, [needsApprove, canEstimateGas, shouldEstimateGas, usdtAllowance, calculateUsdtAmount, gasEstimateStatus, isEstimatingGas, estimatedGas, gasEstimateError]);

    // 获取 gas price
    const { data: gasPrice, isLoading: isLoadingGasPrice } = useGasPrice({
        query: {
            refetchInterval: 10000, // 每10秒自动刷新
        },
    });

    // 计算 gas 费用（原生代币）
    const gasFeeInNative = useMemo(() => {
        if (!estimatedGas || !gasPrice) {
            return null;
        }
        try {
            // gas 费用 = gas limit * gas price
            const gasFeeInWei = estimatedGas * gasPrice;
            // 转换为原生代币（通常是 18 位精度）
            const gasFeeInNative = formatUnits(gasFeeInWei, 18);
            return gasFeeInNative;
        } catch (error) {
            console.error('计算 gas 费用失败:', error);
            return null;
        }
    }, [estimatedGas, gasPrice]);

    // 获取原生代币符号
    const nativeCurrencySymbol = useMemo(() => {
        if (token?.chain?.native_currency_symbol) {
            return token.chain.native_currency_symbol;
        }
        // 根据 chainId 返回默认符号
        const chainIdNum = chainId || (token?.chain?.chain_id ? parseInt(token.chain.chain_id, 10) : null);
        if (chainIdNum === 1 || chainIdNum === 11155111) return 'ETH'; // Ethereum/Sepolia
        if (chainIdNum === 137) return 'MATIC'; // Polygon
        if (chainIdNum === 56) return 'BNB'; // BSC
        if (chainIdNum === 10) return 'ETH'; // Optimism
        if (chainIdNum === 8453) return 'ETH'; // Base
        if (chainIdNum === 42161) return 'ETH'; // Arbitrum
        return 'ETH'; // 默认
    }, [token?.chain, chainId]);

    const check = async (): Promise<boolean> => {
        if (!token) {
            return false;
        }
        if (!selectedAccountAddress) {
            console.error('未选择账户地址');
            return false;
        }
        const KYCStatusResponse = await api.kyc.getKycStatus({ tokenAddress, userAddressToCheck: selectedAccountAddress });
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
                        <Button variant="outline" onPress={hide}>
                            取消
                        </Button>,
                        <Button color="primary" onPress={async () => {
                            hide();
                            // 检查必要参数
                            if (!selectedAccountAddress || !tokenAddress || !token.factory_address) {
                                Alert.alert('错误', '缺少必要参数');
                                return;
                            }
                            if (KYCStatusResponse.data.type == KYCStatusType.NEW_USER) {
                                // 直接调用 KYC 验证方法
                                await startKYCVerificationWithAlert(
                                    {
                                        walletAddress: selectedAccountAddress,
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
        if (KYCStatusResponse.data.walletaddress != selectedAccountAddress) {
            show(
                <ModalContent
                    title="提示"
                    message={`当前地址不能购买${token?.symbol}，当前账号绑定地址：${formatAddress(KYCStatusResponse.data.walletaddress)}`}
                    buttons={
                        <Button color="primary" onPress={hide}>
                            我知道了
                        </Button>
                    }
                />
            );
            return false;
        }
        // 所有检查通过
        return true;
    }


    const handleInvest = () => {
        console.log('handleInvest');
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
                            onPress={async () => {
                                Keyboard.dismiss();
                                const checkResult = await check();
                                if (!checkResult) return;
                                bottomSheetRef.current?.expand();
                                // handleInvest();
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
                                {investmentAmount && token
                                    ? `${investmentAmount} ${token.symbol}`
                                    : '--'}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-base" style={{ color: colors.textSecondary }}>
                                价格
                            </Text>
                            <Text className="text-base font-semibold" style={{ color: colors.text }}>
                                ${formatPrice(token?.sale_plan?.price || '0', token?.decimals || 18)}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-base" style={{ color: colors.textSecondary }}>
                                网络费用
                            </Text>
                            {needsApprove === null ? (
                                <View className="flex-row items-center">
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text className="text-xs ml-2" style={{ color: colors.textTertiary }}>
                                        检查授权中...
                                    </Text>
                                </View>
                            ) : needsApprove === true ? (
                                <Text className="text-base font-semibold" style={{ color: colors.textTertiary }}>
                                    需要先授权
                                </Text>
                            ) : !shouldEstimateGas ? (
                                <Text className="text-base font-semibold" style={{ color: colors.textTertiary }}>
                                    --
                                </Text>
                            ) : gasEstimateError ? (
                                <Text className="text-base font-semibold" style={{ color: colors.textTertiary }}>
                                    估算失败
                                </Text>
                            ) : isEstimatingGas || isLoadingGasPrice || gasFeeInNative === null ? (
                                <View className="flex-row items-center">
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text className="text-xs ml-2" style={{ color: colors.textTertiary }}>
                                        估算中...
                                    </Text>
                                </View>
                            ) : (
                                <Text className="text-base font-semibold" style={{ color: colors.text }}>
                                    {parseFloat(gasFeeInNative).toFixed(6)} {nativeCurrencySymbol}
                                </Text>
                            )}
                        </View>
                    </View>

                    {needsApprove === true ? (
                        <Button
                            className="w-full mt-4"
                            color="primary"
                            style={{
                                minWidth: '100%',
                                alignSelf: 'stretch',
                            }}
                            onPress={() => {
                                if (approveTransactionData && usdtTokenAddress && tokenAddress && calculateUsdtAmount) {
                                    writeApprove({
                                        address: usdtTokenAddress as Address,
                                        abi: erc20Abi,
                                        functionName: 'approve',
                                        args: [tokenAddress as Address, calculateUsdtAmount],
                                    });
                                }
                            }}
                            disabled={isApproving || isWaitingApprove || !approveTransactionData}
                        >
                            {isApproving ? '授权中...' : isWaitingApprove ? '等待确认中...' : '授权 USDT'}
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
                                if (!tokenAddress || !calculateTokenAmount) {
                                    Alert.alert('错误', '缺少必要参数');
                                    return;
                                }
                                if (needsApprove !== false) {
                                    Alert.alert('提示', '请先完成 USDT 授权');
                                    return;
                                }
                                // 调用 purchaseTokens 合约函数
                                writePurchase({
                                    address: tokenAddress as Address,
                                    abi: tokenABI,
                                    functionName: 'purchaseTokens',
                                    args: [calculateTokenAmount],
                                });
                            }}
                            disabled={isPurchasing || !tokenAddress || !calculateTokenAmount || needsApprove !== false}
                        >
                            {isPurchasing ? '交易中...' : '确认购买'}
                        </Button>
                    )}
                </BottomSheetView>
            </BottomSheet>
        </SafeAreaView>
    );
}

