import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../store/useAuthStore';
import { useBookingStore } from '../../store/useBookingStore';
import { bookingService } from '../../services/bookingService';
import { Booking } from '../../models/Booking';
import BookingCard from '../../components/booking/BookingCard';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import HeaderBackButton from '../../components/common/HeaderBackButton';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

type RefundOptionType = 'CASH_REFUND' | 'CREDIT_VOUCHER' | 'LOYALTY_POINTS';

interface CancelResultData {
  message: string;
  depositPaid?: number;
  refundPercentage?: number;
  refundAmount?: number;
  penaltyFee?: number;
  creditVoucherCode?: string;
  loyaltyPointsCredited?: number;
}

export default function MyBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { bookings, setBookings, isLoading, setLoading } = useBookingStore();
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  // Guest lookup (chưa đăng nhập hoặc muốn tra cứu bằng SĐT)
  const [phone, setPhone] = useState('');
  const [lookupResults, setLookupResults] = useState<Booking[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Trạng thái hủy đơn
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedRefundOption, setSelectedRefundOption] = useState<RefundOptionType>('CASH_REFUND');

  // Trạng thái modal kết quả hủy
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelResultData | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState(false);

  // Nếu đã đăng nhập → tải lịch sử ngay
  const loadMyBookings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await bookingService.getMyBookings();
      setBookings(data);
    } catch {
      // lỗi đã được xử lý bởi apiClient interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadMyBookings();
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (user) await loadMyBookings();
    setRefreshing(false);
  };

  const handleLookup = async () => {
    if (!phone.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại');
      return;
    }
    setLookupLoading(true);
    setHasSearched(true);
    try {
      const results = await bookingService.lookupByPhone(phone.trim());
      setLookupResults(results);
    } catch {
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  };

  const navigateToInvoice = (item: Booking) => {
    navigation.navigate('Invoice', { bookingId: item.bookingCode || item.id });
  };

  const handlePayDeposit = (bookingCode: string) => {
    navigation.navigate('Payment', { bookingCode });
  };

  const handleOrderService = (bookingCode: string) => {
    navigation.navigate('Services', { bookingCode });
  };

  // ─── XỬ LÝ HỦY ĐƠN ─────────────────────────────────────────────
  const handlePressCancel = (booking: Booking) => {
    const isPending =
      booking.status === 'PENDING_DEPOSIT' || booking.status === 'pending';

    if (isPending) {
      // Đơn chưa cọc: chỉ cần hộp xác nhận không phát sinh hoàn tiền
      Alert.alert(
        'Xác nhận hủy đặt phòng',
        'Bạn chắc chắn muốn hủy đơn này? Đơn chưa đặt cọc nên không phát sinh hoàn tiền.',
        [
          { text: 'Quay lại', style: 'cancel' },
          {
            text: 'Hủy đơn',
            style: 'destructive',
            onPress: () => executeCancel(booking, { refundOption: 'CASH_REFUND' }),
          },
        ]
      );
    } else {
      // Đơn đã cọc (CONFIRMED): mở modal chọn lý do và phương thức hoàn cọc
      setSelectedBookingForCancel(booking);
      setCancelReason('');
      setSelectedRefundOption('CASH_REFUND');
      setCancelModalVisible(true);
    }
  };

  const handleConfirmCancelWithDeposit = () => {
    if (!selectedBookingForCancel) return;
    const code = selectedBookingForCancel.bookingCode || selectedBookingForCancel.id;

    Alert.alert(
      'Xác nhận hủy đặt phòng',
      `Bạn có chắc chắn muốn hủy đơn #${code}?`,
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Đồng ý hủy',
          style: 'destructive',
          onPress: () => {
            setCancelModalVisible(false);
            executeCancel(selectedBookingForCancel, {
              reason: cancelReason,
              refundOption: selectedRefundOption,
            });
          },
        },
      ]
    );
  };

  const executeCancel = async (
    booking: Booking,
    params: { reason?: string; refundOption: string }
  ) => {
    const code = booking.bookingCode || booking.id;
    if (!code) return;

    setIsCancelling(true);
    try {
      const responseData: any = await bookingService.cancelBooking(code, params);
      const data = responseData?.data || responseData || {};
      const message =
        responseData?.message || data?.message || 'Hủy đặt phòng thành công';

      setCancelResult({
        message,
        depositPaid: data.depositPaid,
        refundPercentage: data.refundPercentage,
        refundAmount: data.refundAmount,
        penaltyFee: data.penaltyFee,
        creditVoucherCode: data.creditVoucherCode,
        loyaltyPointsCredited: data.loyaltyPointsCredited,
      });
      setCopiedVoucher(false);
      setResultModalVisible(true);

      // Tải lại danh sách đơn đặt phòng
      loadMyBookings();
    } catch (err: any) {
      console.error('[MyBookingsScreen] cancel error:', err);
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể hủy đơn đặt phòng. Vui lòng liên hệ khách sạn.';
      Alert.alert('Không thể hủy', errorMsg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCopyVoucher = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedVoucher(true);
      setTimeout(() => setCopiedVoucher(false), 2500);
    } catch (e) {
      console.error('[MyBookingsScreen] copy error:', e);
    }
  };

  const handleCloseResultModal = () => {
    setResultModalVisible(false);
    setCancelResult(null);
    loadMyBookings();
  };

  // Tính padding chân modal chuẩn theo Android 3 nút điều hướng
  const footerPaddingBottom =
    Platform.OS === 'android' ? Math.max(insets.bottom, 48) : Math.max(insets.bottom, SPACING.md);

  // ─── CHƯA ĐĂNG NHẬP ───────────────────────────────────────────
  if (!user) {
    return (
      <View style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
          <View style={styles.headerRow}>
            <HeaderBackButton style={styles.backBtn} />
            <Text style={styles.title}>Tra cứu đặt phòng</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.lookupBox}>
            <Ionicons name="search-outline" size={36} color={COLORS.primary} style={{ marginBottom: SPACING.sm }} />
            <Text style={styles.lookupTitle}>Nhập SĐT để tra cứu</Text>
            <Text style={styles.lookupSubtitle}>
              Bạn chưa đăng nhập. Nhập số điện thoại đã dùng khi đặt phòng để xem lịch sử.
            </Text>
            <View style={styles.lookupRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: SPACING.sm }]}
                placeholder="0901234567"
                placeholderTextColor={COLORS.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="search"
                onSubmitEditing={handleLookup}
              />
              <Button
                title="Tìm"
                onPress={handleLookup}
                loading={lookupLoading}
                size="md"
              />
            </View>
          </View>

          {lookupLoading && <LoadingSpinner message="Đang tra cứu..." />}

          {!lookupLoading && hasSearched && (
            <FlatList
              data={lookupResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <BookingCard
                  booking={item}
                  onPress={() => navigateToInvoice(item)}
                  onPayDeposit={handlePayDeposit}
                  onOrderService={handleOrderService}
                  isLoggedIn={false}
                />
              )}
              contentContainerStyle={[styles.list, { paddingBottom: SPACING.xl + insets.bottom }]}
              ListEmptyComponent={
                <EmptyState
                  icon="search-outline"
                  title="Không tìm thấy đặt phòng"
                  subtitle="Không có đơn đặt phòng nào gắn với số điện thoại này."
                />
              }
            />
          )}
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ─── ĐÃ ĐĂNG NHẬP ─────────────────────────────────────────────
  if (isLoading && bookings.length === 0) {
    return <LoadingSpinner fullScreen message="Đang tải lịch sử đặt phòng..." />;
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <HeaderBackButton style={styles.backBtn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Đặt phòng của tôi</Text>
            <Text style={styles.subtitle}>{bookings.length} đơn</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            onPress={() => navigateToInvoice(item)}
            onPayDeposit={handlePayDeposit}
            onOrderService={handleOrderService}
            isLoggedIn={true}
            onCancelBooking={handlePressCancel}
            isCancelling={isCancelling}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: SPACING.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="Chưa có đặt phòng nào"
            subtitle="Hãy khám phá các loại phòng của chúng tôi và thực hiện đặt phòng đầu tiên!"
          />
        }
      />

      {/* ─── MODAL HỦY ĐƠN ĐÃ CỌC (CONFIRMED) ─── */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModalVisible(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Hủy đặt phòng</Text>
                <Text style={styles.modalSubtitle}>
                  #{selectedBookingForCancel?.bookingCode || selectedBookingForCancel?.id} - {selectedBookingForCancel?.roomName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCancelModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: SPACING.md }}
              showsVerticalScrollIndicator={false}
            >
              {/* Thông tin tiền cọc đã đóng */}
              <View style={styles.depositInfoBanner}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={styles.depositInfoLabel}>Tiền cọc đã thanh toán:</Text>
                  <Text style={styles.depositInfoValue}>
                    {formatPrice(selectedBookingForCancel?.depositPaid || selectedBookingForCancel?.depositRequired || 0)}
                  </Text>
                </View>
              </View>

              {/* Ô lý do hủy (tùy chọn) */}
              <Text style={styles.fieldLabel}>Lý do hủy (không bắt buộc):</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Nhập lý do bạn muốn hủy phòng..."
                placeholderTextColor={COLORS.textMuted}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Lựa chọn xử lý tiền cọc */}
              <Text style={styles.fieldLabel}>Lựa chọn xử lý tiền cọc:</Text>

              {/* 1. CASH_REFUND */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedRefundOption === 'CASH_REFUND' && styles.optionCardActive,
                ]}
                onPress={() => setSelectedRefundOption('CASH_REFUND')}
                activeOpacity={0.8}
              >
                <View style={styles.radioRow}>
                  <Ionicons
                    name={
                      selectedRefundOption === 'CASH_REFUND'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={20}
                    color={selectedRefundOption === 'CASH_REFUND' ? COLORS.primary : COLORS.textMuted}
                  />
                  <Text style={styles.optionTitle}>Hoàn tiền</Text>
                </View>
                <Text style={styles.optionNote}>
                  Ghi chú: từ 3 ngày trở lên hoàn 100%, 1-2 ngày hoàn 50%, trong ngày 0%.
                </Text>
              </TouchableOpacity>

              {/* 2. CREDIT_VOUCHER */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedRefundOption === 'CREDIT_VOUCHER' && styles.optionCardActive,
                ]}
                onPress={() => setSelectedRefundOption('CREDIT_VOUCHER')}
                activeOpacity={0.8}
              >
                <View style={styles.radioRow}>
                  <Ionicons
                    name={
                      selectedRefundOption === 'CREDIT_VOUCHER'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={20}
                    color={selectedRefundOption === 'CREDIT_VOUCHER' ? COLORS.primary : COLORS.textMuted}
                  />
                  <Text style={styles.optionTitle}>Bảo lưu thành voucher hạn 6 tháng</Text>
                  <View style={styles.badge100}>
                    <Text style={styles.badge100Text}>100% cọc</Text>
                  </View>
                </View>
                <Text style={styles.optionNote}>
                  Nhận mã voucher có giá trị tương đương 100% số tiền cọc, hạn sử dụng trong vòng 6 tháng.
                </Text>
              </TouchableOpacity>

              {/* 3. LOYALTY_POINTS */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedRefundOption === 'LOYALTY_POINTS' && styles.optionCardActive,
                ]}
                onPress={() => setSelectedRefundOption('LOYALTY_POINTS')}
                activeOpacity={0.8}
              >
                <View style={styles.radioRow}>
                  <Ionicons
                    name={
                      selectedRefundOption === 'LOYALTY_POINTS'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={20}
                    color={selectedRefundOption === 'LOYALTY_POINTS' ? COLORS.primary : COLORS.textMuted}
                  />
                  <Text style={styles.optionTitle}>Đổi sang điểm thưởng</Text>
                  <View style={styles.badge100}>
                    <Text style={styles.badge100Text}>100% cọc</Text>
                  </View>
                </View>
                <Text style={styles.optionNote}>
                  Quy đổi 100% số tiền cọc thành điểm thưởng tích lũy vào tài khoản khách hàng.
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Chân trang Modal */}
            <View style={[styles.modalFooter, { paddingBottom: footerPaddingBottom }]}>
              <TouchableOpacity
                style={[styles.submitCancelBtn, isCancelling && styles.submitCancelBtnDisabled]}
                onPress={handleConfirmCancelWithDeposit}
                disabled={isCancelling}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.submitCancelBtnText}>
                  {isCancelling ? 'Đang xử lý...' : 'Xác nhận hủy đặt phòng'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL KẾT QUẢ HỦY ĐƠN ─── */}
      <Modal
        visible={resultModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseResultModal}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.resultModalOverlay}>
          <View style={[styles.resultCard, { paddingBottom: footerPaddingBottom }]}>
            <View style={styles.resultIconWrap}>
              <Ionicons name="checkmark-circle" size={54} color={COLORS.success} />
            </View>

            <Text style={styles.resultTitle}>Hủy phòng thành công</Text>
            <Text style={styles.resultMessage}>{cancelResult?.message}</Text>

            {/* Bảng chi tiết hoàn cọc */}
            <View style={styles.resultDetailsBox}>
              {cancelResult?.depositPaid !== undefined && (
                <View style={styles.resultDetailRow}>
                  <Text style={styles.resultDetailLabel}>Tiền cọc ban đầu:</Text>
                  <Text style={styles.resultDetailVal}>
                    {formatPrice(cancelResult.depositPaid)}
                  </Text>
                </View>
              )}

              {cancelResult?.refundPercentage !== undefined && (
                <View style={styles.resultDetailRow}>
                  <Text style={styles.resultDetailLabel}>Tỷ lệ hoàn cọc:</Text>
                  <Text style={[styles.resultDetailVal, { color: COLORS.primary }]}>
                    {cancelResult.refundPercentage}%
                  </Text>
                </View>
              )}

              {cancelResult?.refundAmount !== undefined && (
                <View style={styles.resultDetailRow}>
                  <Text style={styles.resultDetailLabel}>Số tiền hoàn lại:</Text>
                  <Text style={[styles.resultDetailVal, { color: COLORS.success, fontWeight: FONTS.weights.bold }]}>
                    {formatPrice(cancelResult.refundAmount)}
                  </Text>
                </View>
              )}

              {cancelResult?.penaltyFee !== undefined && cancelResult.penaltyFee > 0 && (
                <View style={styles.resultDetailRow}>
                  <Text style={styles.resultDetailLabel}>Phí hủy:</Text>
                  <Text style={[styles.resultDetailVal, { color: COLORS.error }]}>
                    {formatPrice(cancelResult.penaltyFee)}
                  </Text>
                </View>
              )}

              {/* Nếu có mã voucher */}
              {cancelResult?.creditVoucherCode && (
                <View style={styles.voucherBox}>
                  <Text style={styles.voucherBoxTitle}>Mã voucher bảo lưu tiền cọc:</Text>
                  <View style={styles.voucherCodeRow}>
                    <Text style={styles.voucherCodeText}>{cancelResult.creditVoucherCode}</Text>
                    <TouchableOpacity
                      style={styles.copyVoucherBtn}
                      onPress={() => handleCopyVoucher(cancelResult.creditVoucherCode!)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={copiedVoucher ? 'checkmark-outline' : 'copy-outline'}
                        size={16}
                        color={COLORS.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.copyVoucherBtnText}>
                        {copiedVoucher ? 'Đã chép' : 'Sao chép'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.voucherExpiryNote}>Hạn sử dụng: 6 tháng kể từ ngày cấp</Text>
                </View>
              )}

              {/* Nếu có điểm thưởng */}
              {cancelResult?.loyaltyPointsCredited !== undefined && cancelResult.loyaltyPointsCredited > 0 && (
                <View style={styles.pointsBox}>
                  <Ionicons name="gift-outline" size={20} color={COLORS.secondary} />
                  <Text style={styles.pointsText}>
                    Điểm thưởng được cộng:{' '}
                    <Text style={{ fontWeight: FONTS.weights.bold, color: COLORS.secondary }}>
                      +{cancelResult.loyaltyPointsCredited} điểm
                    </Text>
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.resultCloseBtn}
              onPress={handleCloseResultModal}
              activeOpacity={0.8}
            >
              <Text style={styles.resultCloseBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    paddingBottom: SPACING.sm, backgroundColor: COLORS.primary,
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
  subtitle: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  list: { paddingTop: SPACING.md, paddingBottom: SPACING.xl },
  lookupBox: {
    margin: SPACING.md, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SPACING.lg,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  lookupTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.primary, marginBottom: SPACING.xs },
  lookupSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textLight, textAlign: 'center', marginBottom: SPACING.md, lineHeight: 20 },
  lookupRow: { flexDirection: 'row', width: '100%', alignItems: 'center' },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
    fontSize: FONTS.sizes.md, color: COLORS.text, backgroundColor: COLORS.background,
  },

  // Modal Sheet Hủy Đơn
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: SPACING.xs,
  },
  modalBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  depositInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  depositInfoLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
  },
  depositInfoValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    minHeight: 65,
    marginBottom: SPACING.md,
  },
  optionCard: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  optionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F8FAFC',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: FONTS.sizes.sm + 1,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  badge100: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badge100Text: {
    fontSize: 10,
    fontWeight: FONTS.weights.bold,
    color: '#D97706',
  },
  optionNote: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginLeft: 28,
    lineHeight: 18,
  },
  modalFooter: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: '#fff',
  },
  submitCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
  },
  submitCancelBtnDisabled: {
    opacity: 0.6,
  },
  submitCancelBtnText: {
    color: '#fff',
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },

  // Modal Kết quả
  resultModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  resultIconWrap: {
    marginBottom: SPACING.sm,
  },
  resultTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  resultMessage: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  resultDetailsBox: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: 8,
  },
  resultDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultDetailLabel: {
    fontSize: FONTS.sizes.xs + 1,
    color: COLORS.textLight,
  },
  resultDetailVal: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  voucherBox: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  voucherBoxTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
    marginBottom: 6,
  },
  voucherCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  voucherCodeText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  copyVoucherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  copyVoucherBtnText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  voucherExpiryNote: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  pointsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    gap: 8,
  },
  pointsText: {
    fontSize: FONTS.sizes.xs + 1,
    color: '#92400E',
  },
  resultCloseBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  resultCloseBtnText: {
    color: '#fff',
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
});
