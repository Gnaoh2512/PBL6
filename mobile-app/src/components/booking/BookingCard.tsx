import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking, BookingStatus, BookingServiceUsed, BookingServiceRequest } from '../../models/Booking';
import { formatDate, calculateNights, formatDateTime } from '../../utils/dateUtils';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, SPACING, RADIUS, HOTEL_INFO } from '../../utils/constants';
import { FEATURES } from '../../utils/config';
import { bookingService } from '../../services/bookingService';
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

// Trạng thái yêu cầu dịch vụ
const SERVICE_REQ_STATUS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  PENDING: { label: 'Chờ tiếp nhận', color: '#D97706', bg: '#FEF3C7' },
  DELIVERING: { label: 'Đang phục vụ', color: '#2563EB', bg: '#DBEAFE' },
  IN_PROGRESS: { label: 'Đang phục vụ', color: '#2563EB', bg: '#DBEAFE' },
  COMPLETED: { label: 'Hoàn tất', color: '#059669', bg: '#D1FAE5' },
  CANCELED: { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' },
  CANCELLED: { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' },
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

        {/* Services Summary & Details */}
        <View style={styles.servicesSection}>
          <View style={styles.servicesSummaryRow}>
            <View style={styles.servicesSummaryLeft}>
              <Ionicons name="restaurant-outline" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.servicesSummaryText}>
                {detailLoaded
                  ? (totalServicesCount > 0 ? `${totalServicesCount} dịch vụ đã gọi` : 'Chưa có dịch vụ')
                  : (totalServicesCount > 0 ? `${totalServicesCount} dịch vụ đã gọi` : 'Dịch vụ phòng')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={handleToggleExpand}
              activeOpacity={0.7}
            >
              <Text style={styles.expandBtnText}>
                {expanded ? 'Thu gọn' : 'Chi tiết dịch vụ'}
              </Text>
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
                  <Text style={styles.detailLoadingText}>Đang tải chi tiết dịch vụ...</Text>
                </View>
              ) : totalServicesCount === 0 ? (
                <Text style={styles.emptyServicesText}>Chưa có dịch vụ nào trong đơn này.</Text>
              ) : (
                <>
                  {/* 1. Danh sách dịch vụ đã sử dụng */}
                  {usedList.length > 0 && (
                    <View style={styles.subListBlock}>
                      <Text style={styles.subListTitle}>Dịch vụ đã gọi</Text>
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
                                <Text style={styles.usedItemName}>{s.serviceName}</Text>
                                {isLoyalty && (
                                  <View style={styles.loyaltyBenefitBadge}>
                                    <Ionicons name="sparkles" size={11} color="#7C3AED" style={{ marginRight: 3 }} />
                                    <Text style={styles.loyaltyBenefitText}>Đặc quyền hội viên</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.usedItemMeta}>
                                SL: {s.quantity}{s.unit ? ` ${s.unit}` : ''}
                                {s.orderTime ? ` • ${formatDateTime(s.orderTime)}` : ''}
                              </Text>
                            </View>
                            <Text style={[styles.usedItemAmount, isFree && { color: COLORS.success }]}>
                              {isFree ? 'Miễn phí' : formatPrice(amount)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* 2. Danh sách yêu cầu dịch vụ */}
                  {requestsList.length > 0 && (
                    <View style={[styles.subListBlock, usedList.length > 0 && { marginTop: SPACING.sm }]}>
                      <Text style={styles.subListTitle}>Yêu cầu dịch vụ</Text>
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
                                  <Text style={styles.requestItemName}>{r.serviceName}</Text>
                                  {isLoyalty && (
                                    <View style={styles.loyaltyBenefitBadge}>
                                      <Ionicons name="sparkles" size={11} color="#7C3AED" style={{ marginRight: 3 }} />
                                      <Text style={styles.loyaltyBenefitText}>Đặc quyền hội viên</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              <View style={[styles.reqStatusChip, { backgroundColor: statusCfg.bg }]}>
                                <Text style={[styles.reqStatusText, { color: statusCfg.color }]}>
                                  {statusCfg.label}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.requestItemMetaRow}>
                              <Text style={styles.requestItemMeta}>
                                SL: {r.quantity}{feeText ? ` • ${feeText}` : ''}
                                {r.requestedAt ? ` • ${formatDateTime(r.requestedAt)}` : ''}
                              </Text>
                            </View>

                            {cleanNote ? (
                              <Text style={styles.requestItemNote}>Ghi chú: {cleanNote}</Text>
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
    backgroundColor: '#F0FDF4',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DCFCE7',
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
    color: COLORS.secondary,
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
