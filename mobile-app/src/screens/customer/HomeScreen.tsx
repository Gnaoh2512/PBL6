import React, { useEffect } from 'react';
import { AppText, AppTextInput } from '../../components/common/AppText';
import { View, ScrollView, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useHotelStore } from '../../store/useHotelStore';
import { useAuthStore } from '../../store/useAuthStore';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import { COLORS, FONTS, SPACING, RADIUS, HOTEL_INFO } from '../../utils/constants';
import { authService } from '../../services/authService';

const { width, height } = Dimensions.get('window');

const HERO_IMAGE = 'https://images.unsplash.com/photo-1735770517146-e95c872226fc?auto=format&fit=crop&w=2200&q=88';

const AMENITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  water: 'water',
  wifi: 'wifi',
  restaurant: 'restaurant',
  spa: 'flower',
  fitness: 'barbell',
  umbrella: 'umbrella',
  car: 'car',
  'room-service': 'cafe',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { hotel, isLoading, loadHotel } = useHotelStore();
  const { user, logout } = useAuthStore();
  const navigation = useNavigation();

  useEffect(() => {
    loadHotel();
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    logout();
  };

  if (isLoading && !hotel) {
    return <LoadingSpinner fullScreen message="Đang tải thông tin khách sạn..." />;
  }

  const info = hotel ?? {
    name: HOTEL_INFO.name,
    tagline: HOTEL_INFO.tagline,
    description: HOTEL_INFO.description,
    rating: 4.8,
    reviewCount: 342,
    amenities: [],
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { height: height * 0.45 + insets.top }]}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          {/* Top bar */}
          <View style={[styles.topBar, { top: insets.top + SPACING.sm }]}>
            <View style={styles.logoRow}>
              <Ionicons name="business" size={22} color={COLORS.secondary} />
              <AppText style={styles.logoText}>{info.name}</AppText>
            </View>
            {user ? (
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} accessibilityLabel="Đăng xuất">
                <Ionicons name="log-out-outline" size={22} color={COLORS.surface} />
              </TouchableOpacity>
            ) : null}
          </View>
          {/* Hero text */}
          <View style={styles.heroContent}>
            <AppText style={styles.heroTitle}>Nơi đường chân trời</AppText>
            <AppText style={styles.heroTagline}>khiến bạn sống chậm lại.</AppText>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color={COLORS.secondary} />
              <AppText style={styles.ratingText}>{info.rating}</AppText>
              <AppText style={styles.reviewText}>({info.reviewCount} đánh giá)</AppText>
            </View>
            <Button
              title="Kiểm tra phòng trống"
              onPress={() => (navigation as any).navigate('Rooms')}
              size="md"
              style={styles.heroCta}
            />
          </View>
        </View>

        {/* Welcome greeting */}
        {user && (
          <View style={styles.greeting}>
            <AppText style={styles.greetingText}>
              Xin chào, <AppText style={styles.greetingName}>{user.fullName}</AppText> 👋
            </AppText>
          </View>
        )}

        {/* Check-in / out info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Ionicons name="enter-outline" size={20} color={COLORS.primary} />
            <AppText style={styles.infoLabel}>Check-in</AppText>
            <AppText style={styles.infoValue}>{HOTEL_INFO.checkInTime}</AppText>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoBox}>
            <Ionicons name="exit-outline" size={20} color={COLORS.primary} />
            <AppText style={styles.infoLabel}>Check-out</AppText>
            <AppText style={styles.infoValue}>{HOTEL_INFO.checkOutTime}</AppText>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoBox}>
            <Ionicons name="location-outline" size={20} color={COLORS.primary} />
            <AppText style={styles.infoLabel}>Vị trí</AppText>
            <AppText style={styles.infoValue}>Đà Nẵng</AppText>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Về chúng tôi</AppText>
          <AppText style={styles.description}>{info.description}</AppText>
        </View>

        {/* Amenities */}
        {info.amenities.length > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Tiện ích khách sạn</AppText>
            <View style={styles.amenitiesGrid}>
              {info.amenities.map((a) => (
                <View key={a.id} style={styles.amenityItem}>
                  <View style={styles.amenityIconBox}>
                    <Ionicons
                      name={AMENITY_ICONS[a.icon] ?? 'checkmark-circle-outline'}
                      size={22}
                      color={COLORS.primary}
                    />
                  </View>
                  <AppText style={styles.amenityName}>{a.name}</AppText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Location placeholder */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Vị trí</AppText>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={48} color={COLORS.textMuted} />
            <AppText style={styles.mapText}>{HOTEL_INFO.address}</AppText>
            <AppText style={styles.mapCoords}>
              {HOTEL_INFO.latitude}°N, {HOTEL_INFO.longitude}°E
            </AppText>
          </View>
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Nút Chat nổi */}
      <TouchableOpacity 
        style={[styles.chatFab, { bottom: SPACING.xl + insets.bottom }]}
        activeOpacity={0.8}
        onPress={() => (navigation as any).navigate('Chat')}
      >
        <Ionicons name="chatbubbles" size={28} color={COLORS.surface} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  hero: { height: height * 0.45, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(4,25,31,0.48)',
  },
  topBar: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  logoText: {
    color: COLORS.surface,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
  },
  logoutBtn: { padding: SPACING.xs },
  heroContent: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
  },
  heroTitle: {
    color: COLORS.surface,
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.medium,
    marginBottom: SPACING.xs,
  },
  heroTagline: {
    color: COLORS.secondary,
    fontSize: FONTS.sizes.xl,
    fontFamily: FONTS.family.heading,
    marginBottom: SPACING.sm,
  },
  heroCta: { alignSelf: 'flex-start', marginTop: SPACING.md },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: {
    color: COLORS.surface,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    marginLeft: 2,
  },
  reviewText: { color: 'rgba(255,255,255,0.75)', fontSize: FONTS.sizes.sm },
  greeting: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  greetingText: { fontSize: FONTS.sizes.md, color: COLORS.textLight },
  greetingName: { fontWeight: FONTS.weights.semiBold, color: COLORS.primary },
  infoRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  infoBox: { flex: 1, alignItems: 'center', gap: 4 },
  infoDivider: { width: 1, backgroundColor: COLORS.divider },
  infoLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  infoValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semiBold, color: COLORS.text },
  section: { marginHorizontal: SPACING.md, marginTop: SPACING.lg },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textLight,
    lineHeight: 24,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  amenityItem: {
    width: (width - SPACING.md * 2 - SPACING.sm * 3) / 4,
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  amenityIconBox: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityName: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  mapPlaceholder: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    gap: SPACING.sm,
  },
  mapText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  mapCoords: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  chatFab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.md,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
