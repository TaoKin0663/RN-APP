import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  LinearTransition,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 统一的底部间距配置，确保两者物理对齐
const BOTTOM_SPACING = 80; 

export default function PerfectAlignedSharedElement() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);

  // 动画参数：快速、无余震
  const transition = LinearTransition.springify().damping(28).stiffness(180).mass(0.8);

  return (
    <View style={styles.container}>
      {/* 1. 遮罩层 (全屏) */}
      {isOpen && (
        <Animated.View 
          entering={FadeIn.duration(300)} 
          exiting={FadeOut.duration(200)} 
          style={styles.overlay} 
        />
      )}

      {/* 2. 弹窗与按钮的统一定位层 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.contentWrapper} pointerEvents="box-none">
          
          {/* 弹窗背景卡片 */}
          {isOpen && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={styles.dialogCard}
            >
              <Animated.View 
                entering={FadeIn.delay(100)} 
                style={styles.innerContent}
              >
                <View style={styles.header}>
                  <View style={styles.titleRow}>
                    <View style={styles.iconCircle}><Text style={styles.iconText}>?</Text></View>
                    <Text style={styles.titleText}>Confirm</Text>
                  </View>
                  <TouchableOpacity onPress={toggle}>
                    <Text style={styles.closeX}>×</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.bodyText}>
                  Are you sure you want to receive a load of money?
                </Text>

                <View style={styles.actionsRow}>
                  <Pressable style={styles.cancelBtn} onPress={toggle}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  {/* 占位，让 Receive 按钮飞到这里 */}
                  <View style={styles.btnPlaceholder} />
                </View>
              </Animated.View>
            </Animated.View>
          )}

          {/* 共享的 Receive 按钮 */}
          <Animated.View
            layout={transition}
            style={[
              styles.sharedBtn,
              isOpen ? styles.btnInDialog : styles.btnInitial
            ]}
          >
            <Pressable style={styles.fullPress} onPress={toggle}>
              <Text style={styles.buttonText}>Receive</Text>
            </Pressable>
          </Animated.View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 1,
  },
  // 核心定位容器：通过 paddingBottom 统一底部基准线
  contentWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: BOTTOM_SPACING,
    zIndex: 2,
  },
  // 弹窗卡片：底部与按钮对齐，高度向上撑开
  dialogCard: {
    position: 'absolute',
    bottom: BOTTOM_SPACING, // 强制对齐底部间距
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 360,
    backgroundColor: '#121417',
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
  },
  innerContent: {
    width: '100%',
  },
  
  // 共享按钮状态 1: 初始大按钮
  sharedBtn: {
    backgroundColor: '#90f1cf',
    zIndex: 3,
  },
  btnInitial: {
    width: 220,
    height: 56,
    borderRadius: 28,
  },
  // 共享按钮状态 2: 弹窗内的小按钮
  btnInDialog: {
    width: '47%', 
    height: 50,
    borderRadius: 16,
    // 使用绝对定位将其精确放置在卡片的右下角区域
    position: 'absolute',
    right: 24,
    bottom: 24 + BOTTOM_SPACING, 
  },

  // 辅助样式
  fullPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#90f1cf', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  iconText: { color: '#90f1cf', fontSize: 10, fontWeight: 'bold' },
  titleText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeX: { color: '#666', fontSize: 28, lineHeight: 28 },
  bodyText: { color: '#999', fontSize: 16, lineHeight: 22, marginBottom: 35 },
  actionsRow: { flexDirection: 'row', gap: 12, height: 50 },
  cancelBtn: { flex: 1, backgroundColor: '#1c1e26', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnPlaceholder: { flex: 1 },
});