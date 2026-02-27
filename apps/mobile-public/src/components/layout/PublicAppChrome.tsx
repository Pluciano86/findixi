import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { FooterWebStyle } from '../home/FooterWebStyle';
import { HeaderWebStyle } from '../home/HeaderWebStyle';

type PublicAppChromeRenderProps = {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  contentPaddingStyle: ViewStyle;
};

type PublicAppChromeProps = {
  children: (props: PublicAppChromeRenderProps) => ReactNode;
};

const SCROLL_THRESHOLD = 8;
const ANIMATION_MS = 180;
const DEFAULT_HEADER_HEIGHT = 92;
const DEFAULT_FOOTER_HEIGHT = 96;

export function PublicAppChrome({ children }: PublicAppChromeProps) {
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
  const [footerHeight, setFooterHeight] = useState(DEFAULT_FOOTER_HEIGHT);

  const headerTranslate = useRef(new Animated.Value(0)).current;
  const footerTranslate = useRef(new Animated.Value(0)).current;
  const lastOffsetYRef = useRef(0);
  const hiddenRef = useRef(false);

  const animateChrome = useCallback(
    (hidden: boolean) => {
      if (hiddenRef.current === hidden) return;
      hiddenRef.current = hidden;

      Animated.parallel([
        Animated.timing(headerTranslate, {
          toValue: hidden ? -headerHeight : 0,
          duration: ANIMATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(footerTranslate, {
          toValue: hidden ? footerHeight : 0,
          duration: ANIMATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [footerHeight, footerTranslate, headerHeight, headerTranslate]
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - lastOffsetYRef.current;
      const movedEnough = Math.abs(delta) >= SCROLL_THRESHOLD;

      if (currentY <= 0) {
        animateChrome(false);
        lastOffsetYRef.current = currentY;
        return;
      }

      if (movedEnough) {
        if (delta > 0) {
          animateChrome(true);
        } else {
          animateChrome(false);
        }
        lastOffsetYRef.current = currentY;
      }
    },
    [animateChrome]
  );

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0) setHeaderHeight(next);
  }, []);

  const onFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0) setFooterHeight(next);
  }, []);

  const contentPaddingStyle = useMemo<ViewStyle>(
    () => ({
      paddingTop: headerHeight,
      paddingBottom: footerHeight,
    }),
    [footerHeight, headerHeight]
  );

  return (
    <View style={styles.screenRoot}>
      <View style={styles.deviceFrame}>
        <Animated.View onLayout={onHeaderLayout} style={[styles.headerWrap, { transform: [{ translateY: headerTranslate }] }]}>
          <HeaderWebStyle />
        </Animated.View>

        <View style={styles.contentWrap}>{children({ onScroll, scrollEventThrottle: 16, contentPaddingStyle })}</View>

        <Animated.View onLayout={onFooterLayout} style={[styles.footerWrap, { transform: [{ translateY: footerTranslate }] }]}>
          <FooterWebStyle />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
  },
  deviceFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    backgroundColor: '#ffffff',
  },
  contentWrap: {
    flex: 1,
  },
  headerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
  },
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
});
