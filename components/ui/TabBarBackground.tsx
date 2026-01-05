// This is a shim for web and Android where the tab bar is generally opaque.
export default undefined;

// Tab bar height: 72px + bottom margin: 20px = 92px
const TAB_BAR_HEIGHT = 92;

export function useBottomTabOverflow() {
  return TAB_BAR_HEIGHT;
}
