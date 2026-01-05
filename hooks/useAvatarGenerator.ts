import { useCallback } from 'react';

/**
 * 从钱包地址生成确定性的 seed 值用于 Jazzicon
 * 将地址转换为一个数字 seed，确保相同地址总是生成相同的 seed
 */
const addressToSeed = (address: string): number => {
  if (!address) return 0;
  
  // 移除 0x 前缀（如果存在）
  const addr = address.toLowerCase().replace(/^0x/, '');
  
  // 取地址的前 10 个字符，转换为十六进制数字
  // 使用 JavaScript 的 parseInt 将十六进制字符串转换为整数
  const seedString = addr.slice(0, 10);
  const seed = parseInt(seedString, 16);
  
  // 确保返回一个有效的数字（如果解析失败则使用哈希值）
  return isNaN(seed) || seed === 0 ? Math.abs(hashCode(address)) : seed;
};

/**
 * 简单的字符串哈希函数（备用方案）
 */
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为 32 位整数
  }
  return hash;
};

/**
 * 为地址生成稳定头像的自定义 Hook
 * 使用 react-native-jazzicon 生成几何图案头像
 * 返回 seed 值，用于 Jazzicon 组件
 */
export function useAvatarGenerator() {
  const generateAvatar = useCallback((address: string): number | null => {
    if (!address) return null;
    
    try {
      return addressToSeed(address);
    } catch (error) {
      console.error('生成头像 seed 失败:', error);
      return null;
    }
  }, []);

  return { generateAvatar };
}

