import { Text } from 'react-native';
import {
  LiquidGlassView,
  LiquidGlassContainerView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

export default function MyComponent() {
  return (
    <LiquidGlassView
      style={[
        { width: 200, height: 100, borderRadius: 20 },
        !isLiquidGlassSupported && { backgroundColor: 'rgba(255,255,255,0.5)' },
      ]}
      interactive
      effect="clear"
    >
      <Text>Hello World</Text>
    </LiquidGlassView>
  );
}

// For combining multiple glass elements
function MergingGlassElements() {
  return (
    <LiquidGlassContainerView spacing={20}>
      <LiquidGlassView style={{ width: 100, height: 100, borderRadius: 50 }} />
      <LiquidGlassView style={{ width: 100, height: 100, borderRadius: 50 }} />
    </LiquidGlassContainerView>
  );
}