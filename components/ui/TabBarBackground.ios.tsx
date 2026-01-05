import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function BlurTabBarBackground() {
  return (
    <BlurView
      // System chrome material automatically adapts to the system's theme
      // and matches the native tab bar appearance on iOS.
      tint="systemChromeMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Tab bar height: 72px + bottom margin: 20px = 92px
const TAB_BAR_HEIGHT = 92;

export function useBottomTabOverflow() {
  // Since we're using a custom absolutely positioned tab bar,
  // we need to use a fixed value instead of useBottomTabBarHeight()
  return TAB_BAR_HEIGHT;
}
