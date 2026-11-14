import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking, BookingStatus } from '../../models/Booking';
import { formatDate, calculateNights } from '../../utils/dateUtils';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, SPACING, RADIUS, HOTEL_INFO } from '../../utils/constants';
import Card from '../common/Card';

// 6 trạng thái chuẩn theo API thật
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  PENDING_DEPOSIT: { label: 'Chờ đặt cọc', color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
  CONFIRMED: { label: 'Đã xác nhận', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  CHECKED_IN: { label: 'Đang lưu trú', color: '#2563EB', bg: '#DBEAFE', icon: 'bed-outline' },
  CHECKED_OUT: { label: 'Hoàn thành', color: '#6B7280', bg: '#F3F4F6', icon: 'checkmark-done-outline' },
  CANCELED: { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
  CANCELLED: { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
  EXPIRED: { label: 'Hết hạn', color: '#EA580C', bg: '#FFEDD5', icon: 'alert-circle-outline' },
  // Khả năng tương thích dữ liệu cũ
  pending: { label: 'Chờ đặt cọc', color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
  confirmed: { label: 'Đã xác nhận', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  completed: { label: 'Hoàn thành', color: '#6B7280', bg: '#F3F4F6', icon: 'checkmark-done-outline' },
  cancelled: { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

interface BookingCardProps {
  booking: Booking;
  onPress?: () => void;
  onPayDeposit?: (bookingCode: string) => void;
  onOrderService?: (bookingCode: string) => void;
  isLoggedIn?: boolean;
  onCancelBooking?: (booking: Booking) => void;
  isCancelling?: boolean;
}

export default function BookingCard({
  booking,
  onPress,
  onPayDeposit,
  onOrderService,
  isLoggedIn,
  onCancelBooking,
  isCancelling,
}: BookingCardProps) {
  const cfg = STATUS_CONFIG[booking.status] || {
    label: booking.status,
    color: COLORS.textMuted,
    bg: COLORS.divider,
    icon: 'information-circle-outline',
  };

  const nights = calculateNights(booking.checkInDate, booking.checkOutDate);
  const code = booking.bookingCode || booking.id;
  const isPendingDeposit = booking.status === 'PENDING_DEPOSIT' || booking.status === 'pending';
  const isConfirmed = booking.status === 'CONFIRMED' || booking.status === 'confirmed';
  const canCancel = !!isLoggedIn && (isPendingDeposit || isConfirmed);
  const canOrderService = !['CANCELED', 'CANCELLED', 'EXPIRED', 'CHECKED_OUT', 'completed'].includes(
    booking.status
  );
  const canContactCancel = !['CANCELED', 'CANCELLED', 'EXPIRED', 'CHECKED_OUT', 'completed'].includes(
    booking.status
  );

  const handleCallHotel = () => {
    const cleanPhone = HOTEL_INFO.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.85 : 1}>
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: SPACING.sm }}>
            <Text style={styles.bookingId}>#{code.toUpperCase()}</Text>
            <Text style={styles.roomName} numberOfLines={1}>
              {booking.roomName}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={13} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>Nhận phòng</Text>
            <Text style={styles.dateValue}>{formatDate(booking.checkInDate)}</Text>
          </View>
          <View style={styles.nightsBadge}>
            <Ionicons name="moon-outline" size={12} color={COLORS.secondary} />
            <Text style={styles.nightsText}>{nights} đêm</Text>
          </View>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>Trả phòng</Text>
            <Text style={styles.dateValue}>{formatDate(booking.checkOutDate)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.guestRow}>
            <Ionicons name="people-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.guestText}>{booking.guests} khách</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.totalPriceLabel}>Tổng tiền:</Text>
            <Text style={styles.totalPrice}>{formatPrice(booking.totalPrice)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {(isPendingDeposit || canOrderService || canCancel) && (
          <View style={styles.actionsContainer}>
            {isPendingDeposit && (
              <TouchableOpacity
                style={styles.payDepositBtn}
                onPress={() => onPayDeposit?.(code)}
                activeOpacity={0.8}
              >
                <Ionicons name="card-outline" size={15} color={COLORS.surface} style={{ marginRight: 4 }} />
                <Text style={styles.payDepositBtnText}>Tiếp tục thanh toán cọc</Text>
              </TouchableOpacity>
            )}

            {(canOrderService || canCancel) && (
              <View style={styles.actionsRow}>
                {canOrderService && (
                  <TouchableOpacity
                    style={[styles.orderServiceBtn, canCancel && { flex: 1 }]}
                    onPress={() => onOrderService?.(code)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="restaurant-outline" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.orderServiceBtnText}>Gọi dịch vụ</Text>
                  </TouchableOpacity>
                )}

                {canCancel && (
                  <TouchableOpacity
                    style={[styles.cancelBtn, canOrderService && { flex: 1 }]}
                    onPress={() => onCancelBooking?.(booking)}
                    disabled={isCancelling}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={15} color={COLORS.error} style={{ marginRight: 4 }} />
                    <Text style={styles.cancelBtnText}>Hủy đặt phòng</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Cần hủy phòng liên hệ khách sạn (chỉ hiện khi KHÔNG hiện nút hủy trực tiếp) */}
        {!canCancel && canContactCancel && (
          <View style={styles.contactCancelBox}>
            <Text style={styles.contactCancelText}>Cần hủy phòng? Vui lòng liên hệ khách sạn:</Text>
            <TouchableOpacity style={styles.phoneLink} onPress={handleCallHotel}>
              <Ionicons name="call" size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.phoneLinkText}>{HOTEL_INFO.phone}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  bookingId: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
    fontWeight: FONTS.weights.semiBold,
  },
  roomName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  dateBox: { alignItems: 'center' },
  dateLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: 4 },
  dateValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semiBold, color: COLORS.text },
  nightsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  nightsText: { fontSize: FONTS.sizes.xs, color: COLORS.secondary, fontWeight: FONTS.weights.semiBold },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.xs,
  },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  guestText: { fontSize: FONTS.sizes.sm, color: COLORS.textLight },
  totalPriceLabel: { fontSize: 10, color: COLORS.textMuted },
  totalPrice: { fontSize: FONTS.sizes.md + 1, fontWeight: FONTS.weights.bold, color: COLORS.secondary },
  // Action buttons
  actionsContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payDepositBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  payDepositBtnText: {
    color: COLORS.surface,
    fontSize: FONTS.sizes.xs + 1,
    fontWeight: FONTS.weights.bold,
  },
  orderServiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm - 1,
  },
  orderServiceBtnText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.xs + 1,
    fontWeight: FONTS.weights.semiBold,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm - 1,
  },
  cancelBtnText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.xs + 1,
    fontWeight: FONTS.weights.semiBold,
  },
  // Liên hệ hủy phòng
  contactCancelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  contactCancelText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  phoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneLinkText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
    textDecorationLine: 'underline',
  },
});
