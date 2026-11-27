import React, { useState } from 'react';
import { AppText, AppTextInput } from '../common/AppText';
import { View, StyleSheet, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking, BookingStatus, BookingServiceUsed, BookingServiceRequest } from '../../models/Booking';
import { formatDate, calculateNights, formatDateTime } from '../../utils/dateUtils';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, SPACING, RADIUS, HOTEL_INFO, STATUS_COLORS } from '../../utils/constants';
import { FEATURES } from '../../utils/config';
import { bookingService } from '../../services/bookingService';
import Card from '../common/Card';

// 6 trạng thái chuẩn theo API thật
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  PENDING_DEPOSIT: { label: 'Chờ đặt cọc', ...STATUS_COLORS.pending, icon: 'time-outline' },
  CONFIRMED: { label: 'Đã xác nhận', ...STATUS_COLORS.success, icon: 'checkmark-circle-outline' },
  CHECKED_IN: { label: 'Đang lưu trú', ...STATUS_COLORS.info, icon: 'bed-outline' },
  CHECKED_OUT: { label: 'Hoàn thành', ...STATUS_COLORS.neutral, icon: 'checkmark-done-outline' },
  CANCELED: { label: 'Đã hủy', ...STATUS_COLORS.error, icon: 'close-circle-outline' },
  CANCELLED: { label: 'Đã hủy', ...STATUS_COLORS.error, icon: 'close-circle-outline' },
  EXPIRED: { label: 'Hết hạn', ...STATUS_COLORS.pending, icon: 'alert-circle-outline' },
  // Khả năng tương thích dữ liệu cũ
  pending: { label: 'Chờ đặt cọc', ...STATUS_COLORS.pending, icon: 'time-outline' },
  confirmed: { label: 'Đã xác nhận', ...STATUS_COLORS.success, icon: 'checkmark-circle-outline' },
  completed: { label: 'Hoàn thành', ...STATUS_COLORS.neutral, icon: 'checkmark-done-outline' },
  cancelled: { label: 'Đã hủy', ...STATUS_COLORS.error, icon: 'close-circle-outline' },
};

// Trạng thái yêu cầu dịch vụ
const SERVICE_REQ_STATUS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  PENDING: { label: 'Chờ tiếp nhận', ...STATUS_COLORS.pending },
  DELIVERING: { label: 'Đang phục vụ', ...STATUS_COLORS.info },
  IN_PROGRESS: { label: 'Đang phục vụ', ...STATUS_COLORS.info },
  COMPLETED: { label: 'Hoàn tất', ...STATUS_COLORS.success },
  CANCELED: { label: 'Đã hủy', ...STATUS_COLORS.error },
  CANCELLED: { label: 'Đã hủy', ...STATUS_COLORS.error },
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
  const [expanded, setExpanded] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);

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
  const canCancel = FEATURES.customerCancelBooking && !!isLoggedIn && (isPendingDeposit || isConfirmed);
  const canOrderService = !['CANCELED', 'CANCELLED', 'EXPIRED', 'CHECKED_OUT', 'completed'].includes(
    booking.status
  );
  const canContactCancel = !['CANCELED', 'CANCELLED', 'EXPIRED', 'CHECKED_OUT', 'completed'].includes(
    booking.status
  );

  const currentBooking = detailBooking || booking;
  const usedList: BookingServiceUsed[] = currentBooking.servicesUsed || [];
  const requestsList: BookingServiceRequest[] = currentBooking.serviceRequests || [];
  const totalServicesCount = usedList.length + requestsList.length;

  const handleToggleExpand = async () => {
    if (!expanded) {
      setExpanded(true);
      if (!detailLoaded && code) {
        setLoadingDetail(true);
        try {
          const detail = await bookingService.getBookingDetail(code);
          setDetailBooking(detail);
          setDetailLoaded(true);
        } catch (e) {
          console.log('[BookingCard] getBookingDetail error:', e);
        } finally {
          setLoadingDetail(false);
        }
      }
    } else {
      setExpanded(false);
    }
  };

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
            <AppText style={styles.bookingId}>#{code.toUpperCase()}</AppText>
            <AppText style={styles.roomName} numberOfLines={1}>
              {booking.roomName}
            </AppText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={13} color={cfg.color} />
            <AppText style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</AppText>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <View style={styles.dateBox}>
            <AppText style={styles.dateLabel}>Nhận phòng</AppText>
            <AppText style={styles.dateValue}>{formatDate(booking.checkInDate)}</AppText>
          </View>
          <View style={styles.nightsBadge}>
            <Ionicons name="moon-outline" size={12} color={COLORS.primary} />
            <AppText style={styles.nightsText}>{nights} đêm</AppText>
          </View>
          <View style={styles.dateBox}>
            <AppText style={styles.dateLabel}>Trả phòng</AppText>
            <AppText style={styles.dateValue}>{formatDate(booking.checkOutDate)}</AppText>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.guestRow}>
            <Ionicons name="people-outline" size={14} color={COLORS.textLight} />
            <AppText style={styles.guestText}>{booking.guests} khách</AppText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText style={styles.totalPriceLabel}>Tổng tiền:</AppText>
            <AppText style={styles.totalPrice}>{formatPrice(booking.totalPrice)}</AppText>
          </View>
        </View>

        {/* Services Summary & Details */}
        <View style={styles.servicesSection}>
          <View style={styles.servicesSummaryRow}>
            <View style={styles.servicesSummaryLeft}>
              <Ionicons name="restaurant-outline" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
              <AppText style={styles.servicesSummaryText}>
                {detailLoaded
                  ? (totalServicesCount > 0 ? `${totalServicesCount} dịch vụ đã gọi` : 'Chưa có dịch vụ')
                  : (totalServicesCount > 0 ? `${totalServicesCount} dịch vụ đã gọi` : 'Dịch vụ phòng')}
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={handleToggleExpand}
              activeOpacity={0.7}
            >
              <AppText style={styles.expandBtnText}>
                {expanded ? 'Thu gọn' : 'Chi tiết dịch vụ'}
              </AppText>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          {expanded && (
            <View style={styles.expandedContent}>
              {loadingDetail ? (
                <View style={styles.detailLoadingRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <AppText style={styles.detailLoadingText}>Đang tải chi tiết dịch vụ...</AppText>
                </View>
              ) : totalServicesCount === 0 ? (
                <AppText style={styles.emptyServicesText}>Chưa có dịch vụ nào trong đơn này.</AppText>
              ) : (
                <>
                  {/* 1. Danh sách dịch vụ đã sử dụng */}
                  {usedList.length > 0 && (
                    <View style={styles.subListBlock}>
                      <AppText style={styles.subListTitle}>Dịch vụ đã gọi</AppText>
                      {usedList.map((s, idx) => {
                        const amount = s.totalAmount ?? (s.unitPrice ? s.unitPrice * s.quantity : 0);
                        const isLoyalty = Boolean(
                          s.loyaltyBenefit === true ||
                          s.isLoyaltyBenefit === true ||
                          (typeof s.benefitName === 'string' && s.benefitName.trim().length > 0)
                        );
                        const isFree = isLoyalty || amount === 0;
                        return (
                          <View key={s.serviceUsageId || idx} style={styles.usedItemRow}>
                            <View style={{ flex: 1, marginRight: SPACING.sm }}>
                              <View style={styles.requestNameRow}>
                                <AppText style={styles.usedItemName}>{s.serviceName}</AppText>
                                {isLoyalty && (
                                  <View style={styles.loyaltyBenefitBadge}>
                                    <Ionicons name="sparkles" size={11} color="#7C3AED" style={{ marginRight: 3 }} />
                                    <AppText style={styles.loyaltyBenefitText}>Đặc quyền hội viên</AppText>
                                  </View>
                                )}
                              </View>
                              <AppText style={styles.usedItemMeta}>
                                SL: {s.quantity}{s.unit ? ` ${s.unit}` : ''}
                                {s.orderTime ? ` • ${formatDateTime(s.orderTime)}` : ''}
                              </AppText>
                            </View>
                            <AppText style={[styles.usedItemAmount, isFree && { color: COLORS.success }]}>
                              {isFree ? 'Miễn phí' : formatPrice(amount)}
                            </AppText>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* 2. Danh sách yêu cầu dịch vụ */}
                  {requestsList.length > 0 && (
                    <View style={[styles.subListBlock, usedList.length > 0 && { marginTop: SPACING.sm }]}>
                      <AppText style={styles.subListTitle}>Yêu cầu dịch vụ</AppText>
                      {requestsList.map((r, idx) => {
                        const reqStatus = (r.status || 'PENDING').toUpperCase();
                        const statusCfg = SERVICE_REQ_STATUS[reqStatus] || {
                          label: r.status,
                          color: COLORS.textMuted,
                          bg: COLORS.divider,
                        };
                        const isLoyalty =
                          r.isLoyaltyBenefit === true ||
                          r.loyaltyBenefit === true ||
                          (typeof r.note === 'string' && r.note.trim().startsWith('[LOYALTY BENEFIT]'));

                        const feeText = isLoyalty
                          ? 'Miễn phí'
                          : r.feeAmount != null
                          ? r.feeAmount === 0
                            ? 'Miễn phí'
                            : formatPrice(r.feeAmount)
                          : null;

                        const cleanNote = r.note
                          ? r.note.replace(/^\[LOYALTY BENEFIT\](?:\s*\[TIER_BENEFIT\s*#?\d+\])?\s*/i, '').trim()
                          : '';

                        return (
                          <View key={r.serviceRequestId || idx} style={styles.requestItemCard}>
                            <View style={styles.requestItemTop}>
                              <View style={{ flex: 1, marginRight: SPACING.xs }}>
                                <View style={styles.requestNameRow}>
                                  <AppText style={styles.requestItemName}>{r.serviceName}</AppText>
                                  {isLoyalty && (
                                    <View style={styles.loyaltyBenefitBadge}>
                                      <Ionicons name="sparkles" size={11} color="#7C3AED" style={{ marginRight: 3 }} />
                                      <AppText style={styles.loyaltyBenefitText}>Đặc quyền hội viên</AppText>
                                    </View>
                                  )}
                                </View>
                              </View>
                              <View style={[styles.reqStatusChip, { backgroundColor: statusCfg.bg }]}>
                                <AppText style={[styles.reqStatusText, { color: statusCfg.color }]}>
                                  {statusCfg.label}
                                </AppText>
                              </View>
                            </View>

                            <View style={styles.requestItemMetaRow}>
                              <AppText style={styles.requestItemMeta}>
                                SL: {r.quantity}{feeText ? ` • ${feeText}` : ''}
                                {r.requestedAt ? ` • ${formatDateTime(r.requestedAt)}` : ''}
                              </AppText>
                            </View>

                            {cleanNote ? (
                              <AppText style={styles.requestItemNote}>Ghi chú: {cleanNote}</AppText>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
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
                <AppText style={styles.payDepositBtnText}>Tiếp tục thanh toán cọc</AppText>
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
                    <AppText style={styles.orderServiceBtnText}>Gọi dịch vụ</AppText>
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
                    <AppText style={styles.cancelBtnText}>Hủy đặt phòng</AppText>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Cần hủy phòng liên hệ khách sạn (chỉ hiện khi KHÔNG hiện nút hủy trực tiếp) */}
        {!canCancel && canContactCancel && (
          <View style={styles.contactCancelBox}>
            <AppText style={styles.contactCancelText}>Cần hủy phòng? Vui lòng liên hệ khách sạn:</AppText>
            <TouchableOpacity style={styles.phoneLink} onPress={handleCallHotel}>
              <Ionicons name="call" size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
              <AppText style={styles.phoneLinkText}>{HOTEL_INFO.phone}</AppText>
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
    borderColor: COLORS.primary,
  },
  nightsText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: FONTS.weights.semiBold },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.xs,
  },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  guestText: { fontSize: FONTS.sizes.sm, color: COLORS.textLight },
  totalPriceLabel: { fontSize: 10, color: COLORS.textMuted },
  totalPrice: { fontSize: FONTS.sizes.md + 1, fontWeight: FONTS.weights.bold, color: COLORS.primary },
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
    backgroundColor: COLORS.warning,
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
    backgroundColor: COLORS.errorBackground,
    borderWidth: 1,
    borderColor: COLORS.error,
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
  // Services section styles
  servicesSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  servicesSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.successBackground,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.successBackground,
  },
  servicesSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  servicesSummaryText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primaryDark,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  expandBtnText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  expandedContent: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  subListBlock: {
    gap: 6,
  },
  subListTitle: {
    fontSize: FONTS.sizes.xs - 1,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  usedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  usedItemName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  usedItemMeta: {
    fontSize: FONTS.sizes.xs - 1,
    color: COLORS.textLight,
    marginTop: 2,
  },
  usedItemAmount: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  requestItemCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  requestItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestItemName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  requestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  loyaltyBenefitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  loyaltyBenefitText: {
    fontSize: FONTS.sizes.xs - 2,
    fontWeight: FONTS.weights.bold,
    color: '#7C3AED',
  },
  reqStatusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  reqStatusText: {
    fontSize: FONTS.sizes.xs - 1,
    fontWeight: FONTS.weights.bold,
  },
  requestItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestItemMeta: {
    fontSize: FONTS.sizes.xs - 1,
    color: COLORS.textLight,
  },
  requestItemNote: {
    fontSize: FONTS.sizes.xs - 1,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  detailLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  detailLoadingText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  emptyServicesText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: SPACING.xs,
  },
});
