import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Room } from '../../models/Room';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

const { width } = Dimensions.get('window');

interface RoomCardProps {
  room: Room;
  onPress: (room: Room) => void;
}

export default function RoomCard({ room, onPress }: RoomCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(room)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: room.images[0] }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={[styles.badge, { backgroundColor: room.isAvailable ? COLORS.success : COLORS.error }]}>
        <Text style={styles.badgeText}>
          {room.isAvailable ? 'Còn phòng' : 'Hết phòng'}
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{room.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {room.description}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.metaText}>Tối đa {room.maxGuests} khách</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="expand-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.metaText}>{room.area} m²</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="bed-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.metaText} numberOfLines={1}>{room.bedType}</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>{formatPrice(room.pricePerNight)}</Text>
            <Text style={styles.perNight}>/đêm</Text>
          </View>
          <View style={styles.bookBtn}>
            <Text style={styles.bookBtnText}>Xem phòng</Text>
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
    color: COLORS.secondary,
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
