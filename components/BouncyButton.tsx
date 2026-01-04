import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, Text, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface BouncyButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  enableHaptic?: boolean;
  springConfig?: {
    damping?: number;
    stiffness?: number;
    mass?: number;
  };
}

export function BouncyButton({
  children,
  style,
  textStyle,
  enableHaptic = true,
  springConfig,
  onPress,
  ...props
}: BouncyButtonProps) {
  const scale = useSharedValue(1);

  const defaultSpringConfig = {
    damping: 12,//阻尼
    stiffness: 400,//刚度
    mass: 0.5,//质量
    ...springConfig,
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.96, {
      ...defaultSpringConfig,
      damping: 15,
    });
    if (enableHaptic) {
      runOnJS(triggerHaptic)();
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      ...defaultSpringConfig,
      damping: 10,
    });
  };

  const handlePress = (event: any) => {
    if (onPress) {
      onPress(event);
    }
  };

  const renderContent = () => {
    if (typeof children === 'string') {
      return <Text style={textStyle}>{children}</Text>;
    }
    return children;
  };

  return (
    <AnimatedTouchableOpacity
      {...props}
      style={[style, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      activeOpacity={1}
    >
      {renderContent()}
    </AnimatedTouchableOpacity>
  );
}

