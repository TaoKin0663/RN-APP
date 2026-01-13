import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import type { IToken } from '@/services/api/types';
import { erc20Abi, type Address } from 'viem';
import { tokenStakeABI } from '@/utils/ABI/token_stake';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

type Params = {
  /** 仅当 token.type === STAKE 时开启 */
  enabled: boolean;
  token: IToken | null;
  tokenAddress?: string;
  /** 质押数量（最小单位，已按 token.decimals parseUnits 后的 bigint） */
  tokenAmount: bigint | null;
  /** 使用页面传入的"有效账户地址"（选中账户优先） */
  accountAddress?: string;
  /** 页面钱包连接状态 */
  isConnected: boolean;
};

export function useStakeTrade({
  enabled,
  token,
  tokenAddress,
  tokenAmount,
  accountAddress,
  isConnected,
}: Params) {
  const { address: connectedAddress } = useAccount();
  const effectiveAccountAddress = accountAddress ?? connectedAddress;

  // 读取质押计划 ID
  const { data: stakingPlanId } = useReadContract({
    address: (enabled ? (tokenAddress as Address | undefined) : undefined),
    abi: tokenStakeABI,
    functionName: 'stakingPlanid',
    query: {
      enabled: enabled && !!tokenAddress && isConnected,
    },
  });

  // 检查代币 allowance（质押需要 approve 代币本身给合约）
  const {
    data: tokenAllowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance,
    error: allowanceError,
  } = useReadContract({
    address: (enabled ? (tokenAddress as Address | undefined) : undefined),
    abi: erc20Abi,
    functionName: 'allowance',
    args:
      enabled && effectiveAccountAddress && tokenAddress
        ? [effectiveAccountAddress as Address, tokenAddress as Address]
        : undefined,
    query: {
      enabled:
        enabled &&
        !!tokenAddress &&
        !!effectiveAccountAddress &&
        isConnected,
      refetchInterval: 5000,
    },
  });

  // 从钱包返回 App 时，强制刷新 allowance（解决后台暂停导致一直"检查授权中"）
  const canRefetchAllowance =
    enabled && isConnected && !!tokenAddress && !!effectiveAccountAddress;

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
    if (tokenAllowance === undefined || tokenAmount === null) {
      return null;
    }
    try {
      return tokenAllowance === 0n || tokenAllowance < tokenAmount;
    } catch {
      return null;
    }
  }, [enabled, tokenAllowance, tokenAmount]);

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
    !!tokenAddress &&
    !!tokenAmount &&
    !!effectiveAccountAddress;

  const approve = useCallback(() => {
    if (!canApprove) return;
    writeApprove({
      address: tokenAddress as Address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [tokenAddress as Address, tokenAmount as bigint],
    });
  }, [canApprove, writeApprove, tokenAddress, tokenAmount]);

  // 执行质押交易
  const {
    writeContract: writeStake,
    isPending: isStaking,
    data: stakeTxHash,
    error: stakeError,
  } = useWriteContract();

  const canStake =
    enabled &&
    isConnected &&
    needsApprove === false &&
    !!tokenAddress &&
    !!tokenAmount &&
    stakingPlanId !== undefined &&
    !!effectiveAccountAddress;

  const stake = useCallback(() => {
    if (!canStake || stakingPlanId === undefined) return;
    writeStake({
      address: tokenAddress as Address,
      abi: tokenStakeABI,
      functionName: 'stakeMint',
      args: [stakingPlanId - BigInt(1), tokenAmount as bigint],
    });
  }, [canStake, writeStake, tokenAddress, stakingPlanId, tokenAmount]);

  return {
    // 质押相关
    stakingPlanId,
    tokenAllowance,
    refetchAllowance,
    isLoadingAllowance,
    allowanceError,

    // 授权/质押状态
    needsApprove,
    approve,
    stake,
    canApprove,
    canStake,

    isApproving,
    isWaitingApprove,
    isStaking,
    approveTxHash,
    stakeTxHash,
    approveError,
    stakeError,
  };
}
