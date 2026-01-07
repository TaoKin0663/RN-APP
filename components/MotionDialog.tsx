import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, TouchableOpacity, Dimensions, LayoutRectangle, TextInput, Keyboard, Platform } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useThemeColor } from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PerfectMotionDialog() {
  const [isOpen, setIsOpen] = useState(false);
  // 记录弹窗内 Receive 按钮的精确位置
  const [targetLayout, setTargetLayout] = useState<LayoutRectangle | null>(null);
  const [inputValue, setInputValue] = useState('');
  // 用 transform 做键盘避让，避免触发布局（layout）弹簧动画导致“慢悠悠”
  const keyboardOffset = useSharedValue(0);
  const buttonPrimaryColor = useThemeColor({}, 'buttonPrimary');
  const dialogBackgroundColor = useThemeColor({}, 'backgroundSecondary');
  const inputBackgroundColor = useThemeColor({}, 'backgroundTertiary');
  const inputBorderColor = useThemeColor({}, 'border');
  const inputTextColor = useThemeColor({}, 'text');
  const inputPlaceholderColor = useThemeColor({}, 'textTertiary');

  const keyboardShiftStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: -keyboardOffset.value }],
    };
  });

  // 监听键盘显示/隐藏
  useEffect(() => {
    if (!isOpen) {
      // 弹窗关闭时，立即重置键盘偏移
      keyboardOffset.value = withTiming(0, { duration: 0 });
      return;
    }

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const duration = typeof (e as any)?.duration === 'number' ? (e as any).duration : 120;
        // 额外留一点间距，避免贴键盘太紧
        keyboardOffset.value = withTiming(e.endCoordinates.height + 16, { duration });
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardOffset.value = withTiming(0, { duration: 90 });
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [isOpen]);

  const toggle = () => {
    if (isOpen) {
      setTargetLayout(null);
      // 立即重置键盘偏移，避免按钮停留在中间
      keyboardOffset.value = withTiming(0, { duration: 0 });
      Keyboard.dismiss();
    }
    setIsOpen(!isOpen);
  };

  const transition = LinearTransition.springify().damping(28).stiffness(200).mass(0.8);

  return (
    <View style={styles.wrapper}>
      {/* 1. 背景遮罩 */}
      {isOpen && (
        <Animated.View 
          entering={FadeIn.duration(200)} 
          exiting={FadeOut.duration(200)} 
          style={styles.globalOverlay} 
        />
      )}

      {/* 2. 外部容器：锚点位置 */}
      <View style={styles.anchor}>
        
        {/* 3. 弹窗卡片 */}
        {isOpen && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={[
              styles.dialogCard, 
              { 
                backgroundColor: dialogBackgroundColor,
              }
              ,
              keyboardShiftStyle
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <View style={styles.iconCircle}><Text style={styles.iconText}>?</Text></View>
                  <Text style={styles.titleText}>Confirm</Text>
                </View>
                <TouchableOpacity onPress={toggle}><Text style={styles.closeX}>×</Text></TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    color: inputTextColor,
                  }
                ]}
                placeholder="请输入内容"
                placeholderTextColor={inputPlaceholderColor}
                value={inputValue}
                onChangeText={setInputValue}
              />

              {/* 按钮行 */}
              <View style={styles.actionsRow}>
                <Pressable style={styles.cancelBtn} onPress={toggle}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                
                {/* 关键：目标占位 View，用来告诉共享按钮该飞到哪 */}
                <View 
                  style={styles.targetPlaceholder} 
                  onLayout={(e) => setTargetLayout(e.nativeEvent.layout)}
                />
              </View>
            </View>
          </Animated.View>
        )}

        {/* 4. 共享按钮：它在视觉上始终在最上层 */}
        <Animated.View
          layout={transition}
          style={[
            { backgroundColor: buttonPrimaryColor },
            styles.sharedBtn,
            isOpen ? {
              position: 'absolute',
              // 当 targetLayout 还没获取到时，先给个大概位置避免闪烁
              right: 24,
              bottom: 24,
              width: targetLayout ? targetLayout.width : '46%',
              height: targetLayout ? targetLayout.height : 50,
              borderRadius: 16,
            } : styles.btnInitial
            ,
            // 始终应用 keyboardShiftStyle，但关闭时 keyboardOffset 应该为 0
            keyboardShiftStyle
          ]}
        >
          <Pressable style={styles.fullPress} onPress={toggle}>
            <Text style={styles.buttonText}>投资</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    // 确保父容器不会裁剪掉飞出去的弹窗
    overflow: 'visible',
  },
  globalOverlay: {
    position: 'absolute',
    top: -1000, left: -1000, right: -1000, bottom: -1000,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10,
  },
  anchor: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  dialogCard: {
    position: 'absolute',
    bottom: 0, // 底部对齐
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 360,
    borderRadius: 28,
    padding: 24,
    // 确保卡片在遮罩之上，但在共享按钮之下
    zIndex: 25,
    // borderWidth: 1,
    // borderColor: '#222',
  },
  // 共享按钮样式
  sharedBtn: {
    zIndex: 30, // 最高的 zIndex，保证飞在最前面
    overflow: 'hidden',
  },
  btnInitial: {
    width: '100%',
    height: 45,
    borderRadius: 22.5,
  },
  // 内部 UI
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#90f1cf', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  iconText: { color: '#90f1cf', fontSize: 10, fontWeight: 'bold' },
  titleText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  closeX: { color: '#666', fontSize: 26, lineHeight: 26 },
  bodyText: { color: '#999', fontSize: 15, lineHeight: 22, marginBottom: 25 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 25,
  },
  
  actionsRow: { 
    flexDirection: 'row', 
    gap: 12, 
    height: 45,
    width: '100%',
  },
  cancelBtn: { 
    flex: 1, 
    backgroundColor: '#1c1e26', 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  cancelText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  
  // 占位符：它的大小和位置完全决定了共享按钮飞过去后的样子
  targetPlaceholder: { 
    flex: 1, 
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  
  fullPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});