import { defaultApi, type RequestOptions } from '@/services/api/http';
import type { ApiResponse, IToken, KycTokenQuery, KycTokenResponse, AuthingUserInfoType, ISafeInfo, KYCStatusResponse } from '@/services/api/types';

/**
 * 业务层统一入口：api.xxx()
 * - types 集中在 services/api/types.ts
 */
export const api = {
    user: {
        getUserInfo: () => {
            return defaultApi.get<ApiResponse<AuthingUserInfoType>>('/api/user/getProfile');
        }
    },
    safe: {
        // /api/safe/getsafesbyownerAddress?chainId=11155111&ownerAddress=0xb1F844b25E735067812205C339f2610dd0b662Dc
        getSafesByOwnerAddress: (chainId: number, ownerAddress: string) => {
            return defaultApi.get<ApiResponse<{
                safes: string[];
            }>>(
                `/api/safe/getsafesbyownerAddress?chainId=${chainId}&ownerAddress=${ownerAddress}`,
            );
        },
        // /api/safe/getSafeInfo?chainId=11155111&safeAddress=0x89BB46F2623c9c06CF4Dd06a6E1E54209920A88D
        getSafeInfo: (chainId: number, safeAddress: string) => {
            return defaultApi.get<ApiResponse<ISafeInfo>>(
                `/api/safe/getSafeInfo?chainId=${chainId}&safeAddress=${safeAddress}`,
            );
        }
    },
    token: {
        getTokenList: (params?: { tokenAddress?: string; symbol?: string; type?: string; chain?: string }) => (
            defaultApi.get<ApiResponse<{
                count: number;
                tokens: IToken[];
            }>>(
                '/api/token/list',
                params,
            )
        )
    },
    kyc: {
        /** 获取 Sumsub/KYC token（对应 GET /api/kyc/token） */
        getToken: (
            query: KycTokenQuery,
            options?: RequestOptions,
        ): Promise<ApiResponse<KycTokenResponse>> =>
            defaultApi.get<ApiResponse<KycTokenResponse>>(
                '/api/kyc/token',
                query,
                options,
            ),
        getKycStatus: (params: { tokenAddress: string; userAddressToCheck: string }) => {
            return defaultApi.get<ApiResponse<KYCStatusResponse>>(
                '/api/kyc/status',
                params,
            );
        },
        onchainKYC: (payload: { type: string; token_address: string; token_type: string; factory_address: string; claimTopic?: string; claimValue?: string; }) => {
            return defaultApi.post<ApiResponse<any>>('/api/kyc/onchain', payload);
        }
    },
} as const;


