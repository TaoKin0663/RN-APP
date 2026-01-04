import { defaultApi, type RequestOptions } from '@/services/api/http';
import type { ApiResponse, IToken, KycTokenQuery, KycTokenResponse, AuthingUserInfoType } from '@/services/api/types';

/**
 * 业务层统一入口：api.xxx()
 * - types 集中在 services/api/types.ts
 */
export const api = {
    user:{
        getUserInfo: ()=>{
            return defaultApi.get<ApiResponse<AuthingUserInfoType>>('/api/user/getProfile');
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
    },
} as const;


