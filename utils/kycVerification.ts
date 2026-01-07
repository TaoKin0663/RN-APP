import { Alert } from 'react-native';
import SumsubSdk from '@sumsub/react-native-mobilesdk-module';
import { api } from '@/services/api/api';

interface KYCVerificationParams {
    walletAddress: string;
    tokenAddress: string;
    factoryAddress: string;
    chainId?: string;
}

interface KYCVerificationResult {
    success: boolean;
    status?: string;
    errorMsg?: string;
}

/**
 * 启动 KYC 验证流程
 * @param params 验证参数
 * @returns 验证结果 Promise
 */
export const startKYCVerification = async (
    params: KYCVerificationParams
): Promise<KYCVerificationResult> => {
    const { walletAddress, tokenAddress, factoryAddress, chainId = '11155111' } = params;

    try {
        // 验证必要参数
        if (!walletAddress) {
            throw new Error('请先选择钱包地址');
        }

        if (!tokenAddress || !factoryAddress) {
            throw new Error('缺少必要参数：tokenAddress 或 factoryAddress');
        }

        // 从 API 获取 token
        const data = await api.kyc.getToken({
            walletAddress,
            tokenAddress,
            factoryAddress,
            chainId,
        });

        // 根据参考代码，token 在 data.data.token 中
        const sumsubToken = data.data.token;
        console.log('sumsubToken', sumsubToken);
        
        if (!sumsubToken) {
            throw new Error('Token 格式错误');
        }

        // 根据参考代码，实际 token 在 sumsubToken.data.token 中
        const actualToken = sumsubToken.data?.token || sumsubToken.token || sumsubToken;
        
        if (!actualToken) {
            throw new Error('Token 格式错误');
        }

        // Token 过期处理函数
        const getNewToken = async (): Promise<string> => {
            try {
                const refreshData = await api.kyc.getToken({
                    walletAddress,
                    tokenAddress,
                    factoryAddress,
                    chainId,
                });

                const newToken = refreshData.data.token || refreshData.data.accessToken || refreshData.data.tokens || refreshData.data;
                const actualNewToken = typeof newToken === 'object' && newToken?.data?.token 
                    ? newToken.data.token 
                    : typeof newToken === 'object' && newToken?.token
                    ? newToken.token
                    : typeof newToken === 'string' 
                        ? newToken 
                        : null;

                if (!actualNewToken) {
                    throw new Error('新 Token 格式错误');
                }

                return actualNewToken;
            } catch (error: any) {
                console.error('获取新 token 失败:', error);
                throw error;
            }
        };

        // 初始化并启动 Sumsub SDK
        const snsMobileSDK = SumsubSdk.init(actualToken as string, getNewToken)
            .withHandlers({
                onStatusChanged: (status: any) => {
                    console.log('Sumsub status changed:', status);
                },
                onEvent: (event: any) => {
                    console.log('Sumsub event:', event);
                },
            })
            .build();

        // 启动 SDK
        const result = await snsMobileSDK.launch();

        console.log('Sumsub verification result:', result);

        return result;
    } catch (error: any) {
        console.error('Sumsub error:', error);
        return {
            success: false,
            errorMsg: error.message || '启动 Sumsub 验证失败',
        };
    }
};

/**
 * 启动 KYC 验证并显示结果提示
 * @param params 验证参数
 * @param onSuccess 成功回调
 * @param onError 失败回调
 */
export const startKYCVerificationWithAlert = async (
    params: KYCVerificationParams,
    onSuccess?: () => void,
    onError?: (error: string) => void
): Promise<void> => {
    const result = await startKYCVerification(params);

    // 使用 setTimeout 延迟显示 Alert，确保原生界面完全关闭
    setTimeout(() => {
        if (result.success) {
            console.log("执行成功分支");
            Alert.alert('成功', `验证状态: ${result.status}`, [
                { 
                    text: '确定', 
                    onPress: () => {
                        onSuccess?.();
                    }
                }
            ]);
        } else {
            Alert.alert('错误', result.errorMsg || '验证失败', [
                { 
                    text: '确定', 
                    onPress: () => {
                        onError?.(result.errorMsg || '验证失败');
                    }
                }
            ]);
        }
    }, 300);
};

