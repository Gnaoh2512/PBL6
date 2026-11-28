// Port of web ToastContext / .hc-toast-container (top, left/right 12 on mobile)
import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { create } from 'zustand';
import { AppText } from './AppText';
import { COLORS, FONTS, RADIUS } from '../../utils/constants';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: number; message: string; type: ToastType }
interface ToastState {
  toasts: ToastItem[];
  add: (message: string, type?: ToastType, duration?: number) => void;
  remove: (id: number) => void;
}

let seq = 1;
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  add: (message, type = 'info', duration = 3500) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().remove(id), duration);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const addToast = (message: string, type: ToastType = 'info', duration?: number) =>
  useToastStore.getState().add(message, type, duration);

const PALETTE: Record<ToastType, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { color: COLORS.success, bg: COLORS.successBackground, icon: 'checkmark-circle' },
  error: { color: COLORS.error, bg: COLORS.errorBackground, icon: 'close-circle' },
  warning: { color: COLORS.warning, bg: COLORS.warningBackground, icon: 'warning' },
  info: { color: COLORS.info, bg: COLORS.infoBackground, icon: 'information-circle' },
};

function ToastView({ item }: { item: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const a = React.useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 250, useNativeDriver: true }).start(); }, [a]);
  const p = PALETTE[item.type];
  return (
    <Animated.View style={[styles.toast, { backgroundColor: p.bg, borderLeftColor: p.color, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
      <Ionicons name={p.icon} size={20} color={p.color} />
      <AppText style={styles.text}>{item.message}</AppText>
      <TouchableOpacity onPress={() => remove(item.id)} hitSlop={8}>
        <Ionicons name="close" size={16} color={COLORS.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: 12 + insets.top }]}>
      {toasts.map((t) => <ToastView key={t.id} item={t} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, zIndex: 9999, gap: 8 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.md, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  text: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.text },
});
