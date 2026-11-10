import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, HOTEL_INFO } from '../../utils/constants';
import Card from '../../components/common/Card';
import HeaderBackButton from '../../components/common/HeaderBackButton';

interface ContactItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}

function ContactItem({ icon, label, value, onPress }: ContactItemProps) {
  return (
    <TouchableOpacity style={styles.contactItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.contactIconBox}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <View style={styles.contactText}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const openPhone = () => {
    Linking.openURL(`tel:${HOTEL_INFO.phone}`).catch(() =>
      Alert.alert('Lỗi', 'Không thể mở ứng dụng gọi điện'),
    );
  };

  const openEmail = () => {
    Linking.openURL(`mailto:${HOTEL_INFO.email}`).catch(() =>
      Alert.alert('Lỗi', 'Không thể mở ứng dụng email'),
    );
  };

  const openMaps = () => {
    const url = `https://maps.google.com/?q=${HOTEL_INFO.latitude},${HOTEL_INFO.longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Lỗi', 'Không thể mở bản đồ'),
    );
  };

  const openWebsite = () => {
    Linking.openURL(`https://${HOTEL_INFO.website}`).catch(() =>
      Alert.alert('Lỗi', 'Không thể mở trình duyệt'),
    );
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <HeaderBackButton style={styles.backBtn} />
          <Text style={styles.title}>Liên hệ & Thông tin</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xl + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Map placeholder */}
        <View style={styles.mapBanner}>
          <Ionicons name="location" size={40} color={COLORS.secondary} />
          <Text style={styles.mapBannerTitle}>{HOTEL_INFO.name}</Text>
          <Text style={styles.mapBannerAddr}>{HOTEL_INFO.address}</Text>
          <TouchableOpacity style={styles.mapBtn} onPress={openMaps}>
            <Ionicons name="navigate" size={16} color={COLORS.surface} />
            <Text style={styles.mapBtnText}>Mở bản đồ</Text>
          </TouchableOpacity>
        </View>

        {/* Contact info */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin liên hệ</Text>
          <ContactItem
            icon="call"
            label="Điện thoại"
            value={HOTEL_INFO.phone}
            onPress={openPhone}
          />
          <View style={styles.divider} />
          <ContactItem
            icon="mail"
            label="Email"
            value={HOTEL_INFO.email}
            onPress={openEmail}
          />
          <View style={styles.divider} />
          <ContactItem
            icon="globe"
            label="Website"
            value={HOTEL_INFO.website}
            onPress={openWebsite}
          />
          <View style={styles.divider} />
          <ContactItem
            icon="location"
            label="Địa chỉ"
            value={HOTEL_INFO.address}
            onPress={openMaps}
          />
        </Card>

        {/* Check-in/out policy */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Chính sách lưu trú</Text>
          <View style={styles.policyRow}>
            <View style={styles.policyItem}>
              <Ionicons name="enter-outline" size={24} color={COLORS.primary} />
              <Text style={styles.policyLabel}>Check-in từ</Text>
              <Text style={styles.policyValue}>{HOTEL_INFO.checkInTime}</Text>
            </View>
            <View style={styles.policyDivider} />
            <View style={styles.policyItem}>
              <Ionicons name="exit-outline" size={24} color={COLORS.primary} />
              <Text style={styles.policyLabel}>Check-out trước</Text>
              <Text style={styles.policyValue}>{HOTEL_INFO.checkOutTime}</Text>
            </View>
          </View>
        </Card>

        {/* FAQ */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Câu hỏi thường gặp</Text>
          {[
            {
              q: 'Có hỗ trợ đặt phòng cho nhóm lớn không?',
              a: 'Vui lòng liên hệ trực tiếp để được tư vấn và báo giá ưu đãi cho đoàn.',
            },
            {
              q: 'Có bãi đỗ xe không?',
              a: 'Có bãi đỗ xe miễn phí dành cho khách lưu trú tại khách sạn.',
            },
            {
              q: 'Thú cưng có được phép không?',
              a: 'Rất tiếc, hiện tại chúng tôi chưa cho phép mang thú cưng vào khu vực lưu trú.',
            },
          ].map((faq, i) => (
            <View key={i} style={styles.faqItem}>
              <Text style={styles.faqQ}>❓ {faq.q}</Text>
              <Text style={styles.faqA}>{faq.a}</Text>
            </View>
          ))}
        </Card>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: SPACING.xs,
    marginLeft: -SPACING.xs,
  },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: COLORS.surface },
  mapBanner: {
    backgroundColor: COLORS.primary,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  mapBannerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.surface,
    textAlign: 'center',
  },
  mapBannerAddr: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 20,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
  },
  mapBtnText: { color: COLORS.surface, fontWeight: FONTS.weights.semiBold, fontSize: FONTS.sizes.sm },
  card: { marginHorizontal: SPACING.md, marginTop: SPACING.md },
  cardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  contactIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: '#EEF4FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  contactText: { flex: 1 },
  contactLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: 2 },
  contactValue: { fontSize: FONTS.sizes.md, color: COLORS.text, fontWeight: FONTS.weights.medium },
  divider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 56 },
  policyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  policyItem: { flex: 1, alignItems: 'center', gap: SPACING.xs },
  policyDivider: { width: 1, backgroundColor: COLORS.divider },
  policyLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textLight },
  policyValue: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: COLORS.primary },
  faqItem: { marginBottom: SPACING.md },
  faqQ: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  faqA: { fontSize: FONTS.sizes.sm, color: COLORS.textLight, lineHeight: 20 },
});
