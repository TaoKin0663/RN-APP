/**
 * 格式化地址显示，显示前后部分，中间用省略号连接
 * @param address 完整的地址字符串
 * @param startLength 前面显示的字符数，默认6
 * @param endLength 后面显示的字符数，默认4
 * @returns 格式化后的地址，例如：0x1234...5678
 */
export function formatAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (!address) return '';
  
  // 如果地址长度小于等于前后长度之和，直接返回原地址
  if (address.length <= startLength + endLength) {
    return address;
  }
  
  const start = address.slice(0, startLength);
  const end = address.slice(-endLength);
  
  return `${start}...${end}`;
}

