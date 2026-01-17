import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, Text, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  useAnimatedReaction,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Colors } from '@/config/theme';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type ButtonColor = 
  | 'primary' 
  | 'secondary' 
  | 'accent' 
  | 'success' 
  | 'warning' 
  | 'error';

type ButtonVariant = 'solid' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style' | 'className'> {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  className?: string;
  enableHaptic?: boolean;
  color?: ButtonColor;
  variant?: ButtonVariant;
  size?: ButtonSize;
  springConfig?: {
    damping?: number;
    stiffness?: number;
    mass?: number;
  };
}

export function Button({
  children,
  style,
  textStyle,
  className,
  enableHaptic = true,
  springConfig,
  color,
  variant = 'solid',
  size = 'md',
  onPress,
  ...props
}: ButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  // 根据 color 参数映射到对应的主题颜色键名
  const getColorKey = (): keyof typeof Colors.light & keyof typeof Colors.dark => {
    if (!color) {
      return 'buttonPrimary';
    }
    
    // 优先使用 button 前缀的颜色
    const buttonColorMap: Record<ButtonColor, keyof typeof Colors.light & keyof typeof Colors.dark> = {
      primary: 'buttonPrimary',
      secondary: 'buttonSecondary',
      accent: 'buttonAccent',
      success: 'success',
      warning: 'warning',
      error: 'error',
    };
    
    return buttonColorMap[color];
  };
  
  const buttonColor = useThemeColor({}, getColorKey());
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  
  // 根据 variant 决定背景色和文字颜色
  const backgroundColor = variant === 'outline' ? 'transparent' : buttonColor;
  const finalTextColor = variant === 'outline' ? textColor : '#FFFFFF';

  // 使用 useAnimatedReaction 在 UI 线程上平滑处理 disabled 状态变化
  useAnimatedReaction(
    () => props.disabled,
    (disabled) => {
      // 取消之前的动画，避免冲突
      cancelAnimation(opacity);
      // 使用更平滑的弹簧配置
      opacity.value = withSpring(disabled ? 0.5 : 1, {
        damping: 25, // 增加阻尼，减少弹跳
        stiffness: 250, // 降低刚度，使过渡更平滑
        mass: 0.6,
      });
    },
    [props.disabled]
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressIn = () => {
    if (props.disabled) return;
    
    // 点击时轻微放大效果
    scale.value = withSpring(1.04, {
      damping: 15,
      stiffness: 400,
      mass: 0.4,
    });
    // 只在非 disabled 状态下临时降低透明度，不影响 disabled 状态的动画
    if (!props.disabled) {
      opacity.value = withSpring(0.9, {
        damping: 15,
        stiffness: 400,
      });
    }
    if (enableHaptic) {
      runOnJS(triggerHaptic)();
    }
  };

  const handlePressOut = () => {
    if (props.disabled) return;
    
    // 松手时自然回弹效果：增加阻尼，减少弹跳，让动画更平滑
    scale.value = withSpring(1, {
      damping: 22, // 增加阻尼，减少回弹，让动画更自然
      stiffness: 320, // 降低刚度，让动画不那么快
      mass: 0.5, // 增加质量，让动画更有重量感
    });
    // 恢复透明度，根据 disabled 状态决定最终值
    opacity.value = withSpring(props.disabled ? 0.5 : 1, {
      damping: 20,
      stiffness: 300,
    });
  };

  // 默认文字样式
  const defaultTextStyle: TextStyle = {
    color: finalTextColor,
    fontSize: 16,
    fontWeight: '500',
  };

  // 渲染内容：如果是字符串就用 Text 包裹并应用默认样式，如果是 ReactNode 就直接渲染
  const renderContent = () => {
    // 如果是字符串，用 Text 包裹并应用默认样式
    if (typeof children === 'string') {
      return <Text style={[defaultTextStyle, textStyle]}>{children}</Text>;
    }
    
    // 如果是 ReactNode，直接渲染，不进行任何处理
    return children;
  };

  // 构建默认的 className
  const sizeClasses =
    size === 'sm'
      ? 'px-2 min-h-[28px] min-w-[40px]'
      : size === 'lg'
      ? 'px-4 min-h-[48px] min-w-[140px]'
      : 'px-3 min-h-[40px] min-w-[120px]';
  const defaultClassName = [
    'items-center justify-center',
    'rounded-full',
    sizeClasses,
    variant === 'outline' ? 'border-[1.5px]' : '',
  ].filter(Boolean).join(' ');
  
  const mergedClassName = className 
    ? `${defaultClassName} ${className}` 
    : defaultClassName;

  // 只保留需要动态设置的样式（主题色相关）
  const dynamicStyle: ViewStyle = {
    ...(variant === 'outline' 
      ? { borderColor: borderColor }
      : { backgroundColor }
    ),
  };

  return (
    <AnimatedTouchableOpacity
      {...props}
      className={mergedClassName}
      style={[dynamicStyle, style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {renderContent()}
    </AnimatedTouchableOpacity>
  );
}
