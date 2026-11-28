// Port of web Footer.jsx variant="resort", mobile layout (mobile.css section 9 @800px):
// brand full-width (logo chip + 2-line clamped copy), two link columns side by side,
// contact full-width, bottom bar with copyright / legal.
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../common/AppText';
import { SectionId } from '../../data/webContent';
import { COLORS, FONTS, RADIUS } from '../../utils/constants';

export default function ResortFooter({ onSelectSection }: { onSelectSection?: (id: SectionId) => void }) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const year = new Date().getFullYear();
  const goSection = (id: SectionId) => onSelectSection?.(id);
  const goServices = () => nav.navigate('Services');
  return (
    <View style={[s.footer, { paddingBottom: 26 + insets.bottom }]}>
      <View style={s.brandBlock}>
        <TouchableOpacity style={s.logoChip} onPress={() => nav.navigate('CustomerTabs', { screen: 'Home' })} accessibilityLabel="Azure Bay - Trang chủ">
          <View style={s.logoMark}><Ionicons name="water" size={22} color={COLORS.primary} /></View>
          <AppText style={s.wordmark}>AZURE BAY</AppText>
        </TouchableOpacity>
        <AppText numberOfLines={2} style={s.brandCopy}>Một chốn nghỉ dưỡng ven biển riêng tư, nơi vẻ đẹp của Phú Quốc hòa cùng lòng hiếu khách tinh tế.</AppText>
      </View>

      <View style={s.columns}>
        <View style={s.col}>
          <AppText style={s.colTitle}>KHÁM PHÁ</AppText>
          <TouchableOpacity onPress={() => goSection('rooms')}><AppText style={s.link}>Phòng nghỉ & biệt thự</AppText></TouchableOpacity>
          <TouchableOpacity onPress={() => goSection('experiences')}><AppText style={s.link}>Trải nghiệm</AppText></TouchableOpacity>
          <TouchableOpacity onPress={() => goSection('offers')}><AppText style={s.link}>Ưu đãi</AppText></TouchableOpacity>
          <TouchableOpacity onPress={() => goSection('gallery')}><AppText style={s.link}>Thư viện ảnh</AppText></TouchableOpacity>
        </View>
        <View style={s.col}>
          <AppText style={s.colTitle}>TRẢI NGHIỆM</AppText>
          <TouchableOpacity onPress={goServices}><AppText style={s.link}>Ẩm thực</AppText></TouchableOpacity>
          <TouchableOpacity onPress={goServices}><AppText style={s.link}>Spa & chăm sóc sức khỏe</AppText></TouchableOpacity>
          <TouchableOpacity onPress={goServices}><AppText style={s.link}>Hồ bơi & bãi biển</AppText></TouchableOpacity>
          <TouchableOpacity onPress={goServices}><AppText style={s.link}>Dịch vụ concierge</AppText></TouchableOpacity>
        </View>
      </View>

      <View style={[s.col, { marginTop: 28 }]}>
        <AppText style={s.colTitle}>LIÊN HỆ</AppText>
        <TouchableOpacity onPress={() => Linking.openURL('https://maps.google.com/?q=Phu+Quoc+Vietnam')}><AppText style={s.link}>Bờ tây Phú Quốc, Việt Nam</AppText></TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL('tel:+842973888888')}><AppText style={s.link}>+84 297 388 8888</AppText></TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:hello@azurebay.vn')}><AppText style={s.link}>hello@azurebay.vn</AppText></TouchableOpacity>
      </View>

      <View style={s.bottom}>
        <AppText style={s.bottomText}>© {year} Azure Bay Resort. Bảo lưu mọi quyền.</AppText>
        <AppText style={s.bottomText}>Quyền riêng tư · Điều khoản sử dụng</AppText>
      </View>
    </View>
  );
}

// The web footer sits on the dark teal primary background (resort-footer).
const FOOT_BG = COLORS.primary;
const s = StyleSheet.create({
  footer: { backgroundColor: FOOT_BG, paddingTop: 40, paddingHorizontal: 24 },
  brandBlock: { marginBottom: 28 },
  logoChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADIUS.md, backgroundColor: COLORS.background, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  logoMark: { width: 38, height: 30, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: FONTS.family.heading, fontSize: 15, letterSpacing: 1.8, color: COLORS.primaryDark },
  brandCopy: { marginTop: 18, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.82)' },
  columns: { flexDirection: 'row', gap: 20 },
  col: { flex: 1, gap: 9 },
  colTitle: { marginBottom: 2, fontSize: 10.5, letterSpacing: 1.6, fontFamily: FONTS.family.bodyBold, color: COLORS.secondary },
  link: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.78)' },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, paddingTop: 14, marginTop: 28, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  bottomText: { fontSize: 11, color: 'rgba(255,255,255,0.68)' },
});
