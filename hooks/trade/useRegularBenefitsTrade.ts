import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import type { IToken } from '@/services/api/types';
import { encodeFunctionData, erc20Abi, formatUnits, type Address } from 'viem';
import { tokenABI } from '@/utils/ABI/token';
import { useAccount, useEstimateGas, useGasPrice, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

type Params = {
  /** 仅当 token.type === REGULAR_BENEFITS 时开启 */
  enabled: boolean;
  token: IToken | null;
  tokenAddress?: string;
  /** 购买数量（最小单位，已按 token.decimals parseUnits 后的 bigint） */
  tokenAmount: bigint | null;
  /** 使用页面传入的“有效账户地址”（选中账户优先） */
  accountAddress?: string;
  /** 页面钱包连接状态 */
  isConnected: boolean;
};

export function useRegularBenefitsTrade({
  enabled,
  token,
  tokenAddress,
  tokenAmount,
  accountAddress,
  isConnected,
}: Params) {
  const { address: connectedAddress } = useAccount();
  const effectiveAccountAddress = accountAddress ?? connectedAddress;

  // 读取 USDT token 地址（来自 token 合约）
  const { data: usdtTokenAddress } = useReadContract({
    address: (enabled ? (tokenAddress as Address | undefined) : undefined),
    abi: tokenABI,
    functionName: 'usdtToken',
    query: {
      enabled: enabled && !!tokenAddress && isConnected,
    },
  });
  // 读取 USDT 精度（不同 USDT 合约可能是 6 或 18）
  const { data: usdtDecimals } = useReadContract({
    address: (enabled ? (usdtTokenAddress as Address | undefined) : undefined),
    abi: erc20Abi,
    functionName: 'decimals',
    query: {
      enabled: enabled && !!usdtTokenAddress && isConnected,
    },
  });

  // 计算需要的 USDT 数量（BigInt 精确计算）
  const usdtAmount = useMemo(() => {
    if (!enabled) return null;
    if (!token?.sale_plan?.price || !tokenAmount || usdtDecimals === undefined) {
      return null;
    }
    try {
      const priceRaw = BigInt(token.sale_plan.price);
      const tokenDecimals = token.decimals;
      const pow10 = (n: number) => 10n ** BigInt(n);

      // cost(token.decimals) = tokenAmountBase * priceRaw / 10^token.decimals
      let cost = (tokenAmount * priceRaw) / pow10(tokenDecimals);

      // 将 cost 缩放到 USDT 的 decimals
      const diff = Number(usdtDecimals) - tokenDecimals;
      if (diff > 0) cost = cost * pow10(diff);
      if (diff < 0) cost = cost / pow10(-diff);

      return cost;
    } catch {
      return null;
    }
  }, [enabled, token?.sale_plan?.price, token?.decimals, tokenAmount, usdtDecimals]);

  // 检查 USDT allowance
  const {
    data: usdtAllowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance,
    error: allowanceError,
  } = useReadContract({
    address: (enabled ? (usdtTokenAddress as Address | undefined) : undefined),
    abi: erc20Abi,
    functionName: 'allowance',
    args:
      enabled && effectiveAccountAddress && tokenAddress
        ? [effectiveAccountAddress as Address, tokenAddress as Address]
        : undefined,
    query: {
      enabled:
        enabled &&
        !!usdtTokenAddress &&
        !!effectiveAccountAddress &&
        !!tokenAddress &&
        isConnected,
      refetchInterval: 5000,
    },
  });

  // 从钱包返回 App 时，强制刷新 allowance（解决后台暂停导致一直“检查授权中”）
  const canRefetchAllowance =
    enabled && isConnected && !!usdtTokenAddress && !!effectiveAccountAddress && !!tokenAddress;

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && canRefetchAllowance) {
        refetchAllowance();
      }
    });
    return () => sub.remove();
  }, [enabled, canRefetchAllowance, refetchAllowance]);

  // 当关键依赖就绪/变化时也主动刷新一次（避免长时间停留在 undefined）
  useEffect(() => {
    if (!canRefetchAllowance) return;
    refetchAllowance();
  }, [canRefetchAllowance, refetchAllowance]);

  // 检查是否需要 approve（null 表示还在检查中）
  const needsApprove = useMemo(() => {
    if (!enabled) return null;
    if (usdtAllowance === undefined || usdtAmount === null) {
      return null;
    }
    try {
      return usdtAllowance === 0n || usdtAllowance < usdtAmount;
    } catch {
      return null;
    }
  }, [enabled, usdtAllowance, usdtAmount]);

  // 执行 approve
  const {
    writeContract: writeApprove,
    isPending: isApproving,
    data: approveTxHash,
    error: approveError,
  } = useWriteContract();

  // 等待 approve 交易确认
  const { data: approveReceipt, isLoading: isWaitingApprove } =
    useWaitForTransactionReceipt({
      hash: approveTxHash,
      query: {
        enabled: enabled && !!approveTxHash,
        retry: 3,
        retryDelay: 2000,
      },
    });

  // approve 交易确认成功后刷新 allowance
  useEffect(() => {
    if (!enabled) return;
    if (approveReceipt && approveReceipt.status === 'success') {
      refetchAllowance();
    }
  }, [enabled, approveReceipt, refetchAllowance]);

  const canApprove =
    enabled &&
    isConnected &&
    needsApprove === true &&
    !!usdtTokenAddress &&
    !!tokenAddress &&
    !!usdtAmount &&
    !!effectiveAccountAddress;

  const approve = useCallback(() => {
    if (!canApprove) return;
    writeApprove({
      address: usdtTokenAddress as Address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [tokenAddress as Address, usdtAmount as bigint],
    });
  }, [canApprove, writeApprove, usdtTokenAddress, tokenAddress, usdtAmount]);

  // 执行购买交易
  const {
    writeContract: writePurchase,
    isPending: isPurchasing,
    data: purchaseTxHash,
    error: purchaseError,
  } = useWriteContract();

  const canPurchase =
    enabled &&
    isConnected &&
    needsApprove === false &&
    !!tokenAddress &&
    !!tokenAmount &&
    !!effectiveAccountAddress;

  const purchase = useCallback(() => {
    if (!canPurchase) return;
    writePurchase({
      address: tokenAddress as Address,
      abi: tokenABI,
      functionName: 'purchaseTokens',
      args: [tokenAmount as bigint],
    });
  }, [canPurchase, writePurchase, tokenAddress, tokenAmount]);

  // 构建 purchaseTokens 交易数据用于估算 gas
  const purchaseTransactionData = useMemo(() => {
    if (!enabled) return undefined;
    if (!token || !tokenAddress || !tokenAmount || !effectiveAccountAddress) {
      return undefined;
    }
    if (needsApprove !== false) {
      return undefined;
    }
    try {
      return {
        to: tokenAddress as Address,
        data: encodeFunctionData({
          abi: tokenABI,
          functionName: 'purchaseTokens',
          args: [tokenAmount],
        }),
        account: effectiveAccountAddress as Address,
      } as const;
    } catch {
      return undefined;
    }
  }, [enabled, token, tokenAddress, tokenAmount, effectiveAccountAddress, needsApprove]);

  const shouldEstimateGas =
    enabled &&
    isConnected &&
    needsApprove === false &&
    !!purchaseTransactionData &&
    !!purchaseTransactionData.to &&
    !!purchaseTransactionData.data;

  const canEstimateGas = shouldEstimateGas && needsApprove === false;

  const {
    data: estimatedGas,
    isLoading: isEstimatingGas,
    error: gasEstimateError,
  } = useEstimateGas(
    canEstimateGas && purchaseTransactionData
      ? {
          to: purchaseTransactionData.to,
          data: purchaseTransactionData.data,
          query: {
            refetchInterval: 10000,
            retry: 2,
          },
        }
      : undefined
  );

  // 获取 gas price
  const { data: gasPrice, isLoading: isLoadingGasPrice } = useGasPrice({
    query: {
      enabled: enabled && isConnected,
      refetchInterval: 10000,
    },
  });

  // 计算 gas 费用（原生代币）
  const gasFeeInNative = useMemo(() => {
    if (!enabled) return null;
    if (!estimatedGas || !gasPrice) {
      return null;
    }
    try {
      const gasFeeInWei = estimatedGas * gasPrice;
      return formatUnits(gasFeeInWei, 18);
    } catch {
      return null;
    }
  }, [enabled, estimatedGas, gasPrice]);

  return {
    // 支付相关
    usdtTokenAddress,
    usdtDecimals,
    usdtAmount,
    usdtAllowance,
    refetchAllowance,
    isLoadingAllowance,
    allowanceError,

    // 授权/购买状态
    needsApprove,
    approve,
    purchase,
    canApprove,
    canPurchase,

    isApproving,
    isWaitingApprove,
    isPurchasing,
    approveTxHash,
    purchaseTxHash,
    approveError,
    purchaseError,

    // gas 估算
    shouldEstimateGas,
    estimatedGas,
    isEstimatingGas,
    gasEstimateError,
    gasPrice,
    isLoadingGasPrice,
    gasFeeInNative,
  };
}

