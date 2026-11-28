import React from 'react';
import { AppText, AppTextInput } from '../common/AppText';
import { View, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Room } from '../../models/Room';
import { formatPrice } from '../../utils/priceUtils';
import { getRoomExtras } from '../../data/roomTypeExtras';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

const { width } = Dimensions.get('window');

interface RoomCardProps {
  room: Room;
  onPress: (room: Room) => void;
}

export default function RoomCard({ room, onPress }: RoomCardProps) {
  const extras = getRoomExtras(Number(room.id), room.name);
  const imageUri =
    room.images && room.images.length > 0 && room.images[0]
      ? room.images[0]
      : extras.images[0];
  const bedType = room.bedType || extras.bedType;
  const area = room.area || parseInt(extras.area) || 30;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(room)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: imageUri }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={[styles.badge, { backgroundColor: room.isAvailable ? COLORS.success : COLORS.error }]}>
        <AppText style={styles.badgeText}>
          {room.isAvailable ? 'Còn phòng' : 'Hết phòng'}
        </AppText>
      </View>
      <View style={styles.content}>
        <AppText style={styles.name}>{room.name}</AppText>
        <AppText style={styles.description} numberOfLines={2}>
          {room.description}
        </AppText>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={COLORS.textLight} />
            <AppText style={styles.metaText}>Tối đa {room.maxGuests} khách</AppText>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="expand-outline" size={14} color={COLORS.textLight} />
            <AppText style={styles.metaText}>{area} m²</AppText>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="bed-outline" size={14} color={COLORS.textLight} />
            <AppText style={styles.metaText} numberOfLines={1}>{bedType}</AppText>
          </View>
        </View>
        <View style={styles.footer}>
          <View>
            <AppText style={styles.price}>{formatPrice(room.pricePerNight)}</AppText>
            <AppText style={styles.perNight}>/đêm</AppText>
          </View>
          <View style={styles.bookBtn}>
            <AppText style={styles.bookBtnText}>Xem phòng</AppText>
            <Ionicons name="chevron-forward" size={14} color={COLORS.surface} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 200,
  },
  badge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    color: COLORS.surface,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
  },
  content: { padding: SPACING.md },
  name: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONTS.sizes.xs, color: COLORS.textLight },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  price: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  perNight: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  bookBtnText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.surface,
  },
});
