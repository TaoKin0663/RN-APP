/**
 * 通用状态接口
 */
export interface BaseState {
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
}

