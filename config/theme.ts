import { Platform } from 'react-native';

// Reown 品牌颜色常量
export const reownGreen = '#008847';
export const reownOrange = '#FF573B';
export const reownBlue = '#0988F0';
export const reownGray = '#6C6C6C';
export const reownDarkGray = '#202020';
export const reownWhite = '#E9E9E9';

export const Colors = {
  light: {
    primary: '#FFB500',//主色
    secondary: '#7C3AED',//次色
    accent: '#FFB500',//强调色
    success: '#047857',//成功色
    warning: '#B45309',//警告色
    error: '#B91C1C',//错误色
    text: '#0F172A',//文本色
    textSecondary: '#334155',//文本次色
    textTertiary: '#64748B',//文本三级色
    background: '#FFFFFF',//背景色
    backgroundSecondary: '#F8FAFC',//背景二级色
    backgroundTertiary: '#F1F5F9',//背景三级色
    border: '#CBD5E1',//边框色
    borderLight: '#E2E8F0',//边框浅色
    icon: '#475569',//图标色
    buttonPrimary: '#FFB500',
    buttonSecondary: '#F8FAFC',
    buttonAccent: '#FFB500',
    gradientStart: '#0369A1',
    gradientEnd: '#7C3AED',
    gradientAccent: '#FFB500',
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowDark: 'rgba(0, 0, 0, 0.25)',
    // 向后兼容字段
    tint: '#0a7ea4',//主题色调
    tabIconDefault: '#687076',//标签图标默认色
    tabIconSelected: '#0a7ea4',//标签图标选中色
    green: reownGreen,//绿色
    orange: reownOrange,//橙色
    blue: reownBlue,//蓝色
    gray: reownGray,//灰色
  },
  dark: {
    primary: '#FFB500',//主色 - 黄色
    secondary: '#FFC107',//次色 - 金黄
    accent: '#FFB500',//强调色 - 黄色
    success: '#4CAF50',//成功色
    warning: '#FF9800',//警告色
    error: '#F44336',//错误色
    text: '#FFFFFF',//文本色 - 白色
    textSecondary: '#E0E0E0',//文本次色 - 浅灰
    textTertiary: '#B0B0B0',//文本三级色 - 中灰
    background: '#0F0F11',//背景色
    backgroundSecondary: '#1E1F1C',//背景二级色（用于卡片）
    backgroundTertiary: '#2A2A2A',//背景三级色
    border: '#333333',//边框色 - 深灰
    borderLight: '#404040',// 边框浅色
    icon: '#B0B0B0',//图标色 - 中灰
    buttonPrimary: '#FFB500',
    buttonSecondary: '#FFC107',
    buttonAccent: '#FFB500',
    gradientStart: '#FFB500',
    gradientEnd: '#FFC107',
    gradientAccent: '#FFB500',
    shadow: 'rgba(0, 0, 0, 0.5)',
    shadowDark: 'rgba(0, 0, 0, 0.8)',
    // 向后兼容字段
    tint: '#fff',//主题色调
    tabIconDefault: '#9BA1A6',//标签图标默认色
    tabIconSelected: '#fff',//标签图标选中色
    green: reownGreen,//绿色
    orange: reownOrange,//橙色
    blue: reownBlue,//蓝色
    gray: reownGray,//灰色
  },
};

export const tintColorLight = Colors.light.tint;
export const tintColorDark = Colors.dark.tint;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
