// Small motion helpers replacing the web's CSS gradients / scroll-reveal / hover image swap.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle, findNodeHandle, Pressable, Image, StyleSheet } from 'react-native';

/** Vertical linear-gradient substitute (no extra native deps): stacked bands with eased alpha. */
export function Fade({ color, from, to, direction = 'down', style, steps = 14 }: {
  color: [number, number, number]; from: number; to: number; direction?: 'down' | 'up'; style?: StyleProp<ViewStyle>; steps?: number;
}) {
  const bands = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const a = from + (to - from) * t;
    return <View key={i} style={{ flex: 1, backgroundColor: `rgba(${color[0]},${color[1]},${color[2]},${a.toFixed(3)})` }} />;
  });
  return <View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0 }, style]}>{direction === 'down' ? bands : bands.reverse()}</View>;
}

// ── Scroll reveal ──
interface RevealCtx { scrollY: number; viewH: number; scrollRef: React.RefObject<any> | null }
export const RevealContext = createContext<RevealCtx>({ scrollY: 0, viewH: 0, scrollRef: null });

export function Reveal({ children, variant = 'up', delay = 0, style }: {
  children: React.ReactNode; variant?: 'up' | 'left' | 'right' | 'zoom'; delay?: number; style?: StyleProp<ViewStyle>;
}) {
  const { scrollY, viewH, scrollRef } = useContext(RevealContext);
  const ref = useRef<View>(null);
  const a = useRef(new Animated.Value(0)).current;
  const [box, setBox] = useState<{ y: number; h: number } | null>(null);
  const shown = useRef(false);

  const measure = () => {
    const node = scrollRef?.current ? findNodeHandle(scrollRef.current) : null;
    if (!ref.current || !node) { setBox({ y: 0, h: 0 }); return; }
    try {
      (ref.current as any).measureLayout(node, (_x: number, y: number, _w: number, h: number) => setBox({ y, h }), () => setBox({ y: 0, h: 0 }));
    } catch { setBox({ y: 0, h: 0 }); }
  };

  useEffect(() => {
    if (shown.current || !box) return;
    const threshold = box.y + Math.min(box.h * 0.12, 60);
    if (scrollY + viewH * 0.94 >= threshold) {
      shown.current = true;
      Animated.timing(a, { toValue: 1, duration: 900, delay: delay * 1000, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
    }
  }, [scrollY, viewH, box]);

  const from = variant === 'left' ? -56 : variant === 'right' ? 56 : 42;
  const transform = variant === 'zoom'
    ? [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }]
    : variant === 'up'
      ? [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }]
      : [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }];
  return <Animated.View ref={ref as any} onLayout={measure} style={[{ opacity: a, transform }, style]}>{children}</Animated.View>;
}

/** Entrance helper: fade + rise on mount (hero text, booking bar). */
export function Rise({ children, delay = 0, distance = 34, duration = 1000, style }: { children: React.ReactNode; delay?: number; distance?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration, delay, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start(); }, []);
  return <Animated.View style={[{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }, style]}>{children}</Animated.View>;
}

/** Touch equivalent of the web hover image swap: pressing shows the alternate photo. */
export function FlipImage({ primary, alternate, style, children, onPress, height }: {
  primary: string; alternate: string; style?: StyleProp<ViewStyle>; children?: React.ReactNode; onPress?: () => void; height: number;
}) {
  const a = useRef(new Animated.Value(0)).current;
  const go = (v: number) => Animated.timing(a, { toValue: v, duration: 550, useNativeDriver: true }).start();
  return (
    <Pressable onPressIn={() => go(1)} onPressOut={() => go(0)} onPress={onPress} style={[{ height, overflow: 'hidden' }, style]}>
      <Image source={{ uri: alternate }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <Animated.Image source={{ uri: primary }} resizeMode="cover" style={[StyleSheet.absoluteFillObject, { opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }]} />
      {children}
    </Pressable>
  );
}
