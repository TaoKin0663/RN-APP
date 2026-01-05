export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

export type KycTokenQuery = {
  walletAddress: string;
  tokenAddress: string;
  factoryAddress: string;
  chainId: string | number;
};

/**
 * 后端返回格式目前在业务代码里是 “data.token || data.accessToken || data”
 * 所以这里做成“可访问字段”的宽松结构，避免 strict TS 把业务代码卡死。
 */
export type KycTokenResponse = {
  token?: any;
  accessToken?: any;
  data?: any;
  [k: string]: any;
};


export interface IChain {
  // 链 ID（UUID）
  id: string;
  // 链 ID（十六进制，如 "0x1"）
  chain_id: string;
  // 链名称
  name: string;
  // 显示名称
  display_name: string;
  // RPC URL
  rpc_url: string;
  // 原生货币名称
  native_currency_name: string;
  // 原生货币符号
  native_currency_symbol: string;
  // 原生货币精度
  native_currency_decimals: number | null;
  // 是否隐藏
  is_hidden: boolean | null;
  // 显示顺序
  display_order: number | null;
  // 创建时间
  created_at: string | null;
  // 更新时间
  updated_at: string | null;
}

export interface IToken {
  // 主键 ID（UUID）
  id: string;
  // 代币合约地址
  address: string;
  // 代币名称
  name: string;
  // 代币符号
  symbol: string;
  // 代币精度
  decimals: number;
  // 总供应量
  total_supply: string;
  // 所有者地址
  owner_address: string;
  // 代币类型
  type: string | null;
  // 工厂部署 ID
  factory_deployment_id: string | null;
  // 工厂地址
  factory_address: string | null;
  // 是否隐藏
  is_hidden: boolean;
  // 身份注册表地址
  identity_registry: string | null;
  // 合规合约地址
  compliance: string | null;
  // 声明主题注册表地址
  claim_topics_registry: string | null;
  // 可信发行者注册表地址
  trusted_issuers_registry: string | null;
  // 部署交易哈希
  deployment_transaction_hash: string | null;
  // 部署使用的 Gas
  deployment_gas_used: string | null;
  // Salt 值
  salt: string | null;
  // 网络名称
  network: string | null;
  // 部署 ID
  deployment_id: string | null;
  // 创建时间
  created_at: string;
  // 更新时间
  updated_at: string;
  // 链信息
  chain?: IChain | null;
}

export type AuthingUserInfoType = {
  id: string,
  email: string | null,
  username: string | null,
  nickname: string | null,
  name: string | null,
  photo: string | null,
  phone: string | null
};

export interface ISafeInfo {
  // Safe 账户地址
  address: string;
  // 当前 nonce 值
  nonce: string;
  // 确认阈值（需要多少个拥有者签名）
  threshold: number;
  // 拥有者地址列表
  owners: string[];
  // 模块列表
  modules: string[];
  // 回退处理器地址
  fallbackHandler: string;
  // 守护者地址（0x0 表示无守护者）
  guard: string;
  // Safe 版本
  version: string;
  // Singleton 合约地址
  singleton: string;
}