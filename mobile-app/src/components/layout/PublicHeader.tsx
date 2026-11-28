// Port of web Navbar.jsx (variant="resort" and compact booking variant) at <=800px.
// Slim 60px bar, "Đặt phòng" pill, hamburger -> floating menu card with icon tiles, chevrons,
// login / book actions (or portal + logout when authenticated) and a dimmed backdrop.
import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Pressable, ScrollView, useWindowDimensions, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../common/AppText';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import { addToast } from '../common/Toast';
import { RESORT_NAV_ITEMS, SectionId } from '../../data/webContent';
import { COLORS, FONTS, RADIUS } from '../../utils/constants';

const TINT = 'rgba(41,108,122,0.09)';
const TINT_ACTIVE = 'rgba(41,108,122,0.18)';
const LINE = 'rgba(23,71,81,0.08)';

export function useAuthNavActions() {
  const nav = useNavigation<any>();
  const user = useAuthStore((st) => st.user);
  const goPortal = () => nav.navigate('CustomerTabs', { screen: 'Profile' });
  const logout = async () => {
    await authService.logout();
    addToast('Đã đăng xuất thành công', 'info');
    nav.navigate('Auth');
  };
  return { nav, user, goPortal, logout };
}

function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <View style={s.brand}>
      <View style={s.logoMark}><Ionicons name="water" size={compact ? 18 : 20} color={COLORS.primary} /></View>
      {compact ? (
        <AppText style={s.brandCompact}>Azure Bay</AppText>
      ) : (
        <AppText style={s.brandText}>AZURE BAY</AppText>
      )}
    </View>
  );
}

export default function PublicHeader({
  variant = 'resort', onSelectSection, floating = false,
}: {
  variant?: 'resort' | 'compact';
  onSelectSection?: (id: SectionId) => void;
  floating?: boolean; // true on Home: bar overlays the hero like the fixed web nav
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { nav, user, goPortal, logout } = useAuthNavActions();
  const [open, setOpen] = useState(false);
  const drop = useRef(new Animated.Value(0)).current;
  const barIn = useRef(new Animated.Value(floating ? 0 : 1)).current;

  useEffect(() => {
    if (floating) Animated.timing(barIn, { toValue: 1, duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, []);
  useEffect(() => {
    Animated.timing(drop, { toValue: open ? 1 : 0, duration: 220, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [open]);

  const close = () => setOpen(false);
  const barH = 60 + insets.top;
  const hideBookPill = width <= 340;

  const header = (
    <Animated.View
      style={[
        s.bar, { height: barH, paddingTop: insets.top, paddingLeft: Math.max(14, insets.left), paddingRight: Math.max(14, insets.right) },
        floating && { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, opacity: barIn, transform: [{ translateY: barIn.interpolate({ inputRange: [0, 1], outputRange: [-barH, 0] }) }] },
        !floating && { zIndex: 1000 },
      ]}
    >
      <TouchableOpacity onPress={() => { close(); nav.navigate('CustomerTabs', { screen: 'Home' }); }} accessibilityLabel="Azure Bay - Trang chủ" activeOpacity={0.85}>
        <BrandMark compact={variant === 'compact'} />
      </TouchableOpacity>

      {variant === 'resort' ? (
        <View style={s.actions}>
          {!hideBookPill && (
            <TouchableOpacity style={s.bookPill} onPress={() => { close(); nav.navigate('CustomerTabs', { screen: 'Rooms' }); }} activeOpacity={0.85}>
              <AppText style={s.bookPillText}>Đặt phòng</AppText>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.toggle, open && { backgroundColor: TINT_ACTIVE }]} onPress={() => setOpen((v) => !v)} accessibilityLabel="Mở hoặc đóng trình đơn">
            <Ionicons name={open ? 'close' : 'menu'} size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.actions}>
          {user ? (
            <>
              <TouchableOpacity style={s.userBadge} onPress={goPortal} accessibilityLabel="Chuyển đến trang cá nhân">
                <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
                <AppText numberOfLines={1} style={s.userBadgeText}>{user.fullName || user.username}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.smOutline} onPress={logout} accessibilityLabel="Đăng xuất">
                <Ionicons name="log-out-outline" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={s.smOutline} onPress={() => nav.navigate('Auth', { mode: 'login' })}>
                <AppText style={s.smOutlineText}>Đăng nhập</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.smPrimary} onPress={() => nav.navigate('Auth', { mode: 'register' })}>
                <AppText style={s.smPrimaryText}>Đăng ký</AppText>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </Animated.View>
  );

  return (
    <>
      {header}
      {open && variant === 'resort' && (
        <>
          <Animated.View style={[s.backdrop, { opacity: drop }]} pointerEvents="auto">
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Đóng trình đơn" />
          </Animated.View>
          <Animated.View
            style={[
              s.menu,
              { top: barH + 8, maxHeight: height - barH - 24 - insets.bottom, opacity: drop, transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }, { scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] },
            ]}
          >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {RESORT_NAV_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.section}
                  style={s.menuItem}
                  activeOpacity={0.6}
                  onPress={() => { close(); nav.navigate('CustomerTabs', { screen: 'Home', params: { section: item.section, ts: Date.now() } }); onSelectSection?.(item.section); }}
                >
                  <View style={s.menuIco}><Ionicons name={item.icon as any} size={16} color={COLORS.primary} /></View>
                  <AppText style={s.menuLabel}>{item.label}</AppText>
                  <Ionicons name="chevron-forward" size={12} color={COLORS.primary} style={{ marginLeft: 'auto', opacity: 0.35 }} />
                </TouchableOpacity>
              ))}
              <View style={s.mobileActions}>
                {user ? (
                  <>
                    <TouchableOpacity style={[s.mAction, { width: '100%' }]} onPress={() => { close(); goPortal(); }}>
                      <Ionicons name="person-circle-outline" size={16} color={COLORS.primary} />
                      <AppText numberOfLines={1} style={s.mActionText}>{user.fullName || user.username}</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.mAction, s.mLogout, { width: '100%' }]} onPress={() => { close(); logout(); }}>
                      <Ionicons name="log-out-outline" size={16} color="#c0392b" />
                      <AppText style={[s.mActionText, { color: '#c0392b' }]}>Đăng xuất</AppText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[s.mAction, { flex: 1 }]} onPress={() => { close(); nav.navigate('Auth', { mode: 'login' }); }}>
                      <Ionicons name="person-outline" size={16} color={COLORS.primary} />
                      <AppText style={s.mActionText}>Đăng nhập</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.mAction, { flex: 1 }]} onPress={() => { close(); nav.navigate('CustomerTabs', { screen: 'Rooms' }); }}>
                      <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                      <AppText style={s.mActionText}>Đặt phòng</AppText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}
    </>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.94)', borderBottomWidth: 1, borderBottomColor: LINE, shadowColor: 'rgb(23,71,81)', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 0, elevation: 2 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 30 },
  logoMark: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: FONTS.family.heading, fontSize: 14, letterSpacing: 2, color: COLORS.primary },
  brandCompact: { fontFamily: FONTS.family.headingSemiBold, fontSize: FONTS.sizes.xl, color: COLORS.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookPill: { minHeight: 34, paddingHorizontal: 15, borderRadius: 999, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  bookPillText: { color: '#fff', fontSize: 12.5, fontFamily: FONTS.family.bodySemiBold },
  toggle: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: TINT, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: 'rgba(15,38,45,0.42)' },
  menu: { position: 'absolute', left: 10, right: 10, zIndex: 1001, backgroundColor: '#fff', padding: 8, borderWidth: 1, borderColor: LINE, borderRadius: RADIUS.lg, shadowColor: 'rgb(15,38,45)', shadowOpacity: 0.22, shadowRadius: 25, shadowOffset: { width: 0, height: 22 }, elevation: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.lg, marginBottom: 2 },
  menuIco: { width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: TINT, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: COLORS.primary, fontSize: 15, fontFamily: FONTS.family.bodySemiBold },
  mobileActions: { gap: 8, paddingTop: 10, paddingHorizontal: 2, paddingBottom: 2, marginTop: 6, borderTopWidth: 1, borderTopColor: LINE },
  mAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md },
  mActionText: { color: COLORS.primary, fontSize: 14, fontFamily: FONTS.family.bodySemiBold },
  mLogout: { borderColor: 'rgba(192,57,43,0.35)' },
  userBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 150 },
  userBadgeText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontFamily: FONTS.family.bodyMedium, flexShrink: 1 },
  smOutline: { minHeight: 36, paddingHorizontal: 12, borderWidth: 2, borderColor: COLORS.primary, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  smOutlineText: { color: COLORS.primary, fontSize: FONTS.sizes.xs, fontFamily: FONTS.family.bodySemiBold },
  smPrimary: { minHeight: 36, paddingHorizontal: 12, borderWidth: 2, borderColor: COLORS.primary, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  smPrimaryText: { color: '#fff', fontSize: FONTS.sizes.xs, fontFamily: FONTS.family.bodySemiBold },
});
