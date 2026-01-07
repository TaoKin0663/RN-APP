import React, { useEffect } from 'react';
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

interface ButtonProps extends Omit<TouchableOpacityProps, 'style' | 'className'> {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  className?: string;
  enableHaptic?: boolean;
  color?: ButtonColor;
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
  
  const backgroundColor = useThemeColor({}, getColorKey());

  // 风格的弹簧配置：更柔和的弹跳效果
  const defaultSpringConfig = {
    damping: 20, // 阻尼，值越大回弹越少
    stiffness: 300, // 刚度，控制动画速度
    mass: 0.5, // 质量，影响惯性
    ...springConfig,
  };

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

  const handlePress = (event: any) => {
    if (onPress && !props.disabled) {
      onPress(event);
    }
  };

  // 默认文字样式
  const defaultTextStyle: TextStyle = {
    color: '#FFFFFF', // 白色文字，确保在按钮背景上清晰可见
    fontSize: 16,
    fontWeight: '500',
  };

  // 递归处理 children，为所有 Text 元素应用默认样式
  const applyTextStyle = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') {
      return <Text style={[defaultTextStyle, textStyle]}>{node}</Text>;
    }
    
    if (React.isValidElement(node)) {
      const element = node as React.ReactElement<any>;
      // 如果是 Text 组件，应用样式
      if (element.type === Text) {
        return React.cloneElement(element, {
          style: [defaultTextStyle, textStyle, element.props?.style],
        });
      }
      
      // 如果有 children，递归处理
      if (element.props && element.props.children) {
        const processedChildren = React.Children.map(element.props.children, applyTextStyle);
        return React.cloneElement(element, {
          children: processedChildren,
        });
      }
    }
    
    // 如果是数组，递归处理每个元素
    if (Array.isArray(node)) {
      return node.map(applyTextStyle);
    }
    
    return node;
  };

  // 自动处理字符串子元素，渲染为 Text
  const renderContent = () => {
    return applyTextStyle(children);
  };

  // 默认样式：风格（圆角、内边距、背景色等）
  const minHeight = 40; // 适中的高度
  const minWidth = 120;
  const defaultStyle: ViewStyle = {
    backgroundColor,
    borderRadius: 100,
    paddingVertical: 0,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start', // 宽度由内容撑开
    minHeight, // 适中的高度
    minWidth, // 适中的宽度
  };

  return (
    <AnimatedTouchableOpacity
      {...props}
      className={className}
      style={[defaultStyle, style, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      activeOpacity={1}
    >
      {renderContent()}
    </AnimatedTouchableOpacity>
  );
}

