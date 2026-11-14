import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuthStore } from '../../store/useAuthStore';
import { useBookingStore } from '../../store/useBookingStore';
import { bookingService } from '../../services/bookingService';
import { voucherService, VoucherResult } from '../../services/voucherService';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { formatDate, calculateNights } from '../../utils/dateUtils';
import { formatPrice } from '../../utils/priceUtils';
import { validateEmail, validatePhone } from '../../utils/validationUtils';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BookingFormScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { draft, addBooking } = useBookingStore();

  // Guest info: tự điền sẵn từ user đăng nhập
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [nationality, setNationality] = useState('Vietnam');
  const [idType, setIdType] = useState<'CCCD' | 'PASSPORT' | 'CMND'>('CCCD');
  const [idNumber, setIdNumber] = useState('');
  const [specialRequests, setSpecialRequests] = useState(draft.specialRequests);
  const [guests, setGuests] = useState(draft.guests || 1);

  // Voucher
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherResult, setVoucherResult] = useState<VoucherResult | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  // State xử lý đặt phòng & hiển thị lỗi inline
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { room, checkIn, checkOut } = draft;

  if (!room || !checkIn || !checkOut) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>Dữ liệu đặt phòng không hợp lệ. Vui lòng thử lại.</Text>
          <Button title="Quay lại" onPress={() => navigation.goBack()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const nights = calculateNights(checkIn, checkOut);
  const roomCharge = room.pricePerNight * nights;
  const discount = voucherResult?.discountAmount ?? 0;
  const totalPrice = Math.max(0, roomCharge - discount);

  const handleApplyVoucher = async () => {
    const trimmed = voucherCode.trim();
    if (!trimmed) {
      setVoucherError('Vui lòng nhập mã voucher');
      return;
    }
    setVoucherLoading(true);
    setVoucherError(null);
    try {
      const result = await voucherService.applyVoucher(trimmed, roomCharge);
      setVoucherResult(result);
      setVoucherError(null);
      Alert.alert('Thành công', result.message || 'Áp dụng voucher thành công!');
    } catch (error: any) {
      console.log('[BookingFormScreen] applyVoucher error:', error?.response?.data || error);
      setVoucherResult(null);
      // HTTP 400 hoặc lỗi khác: hiển thị message từ response.data.message
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Mã giảm giá không hợp lệ hoặc đã hết lượt sử dụng';
      setVoucherError(message);
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherResult(null);
    setVoucherCode('');
    setVoucherError(null);
  };

  const handleBooking = async () => {
    setFormError(null);
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ và tên';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Họ và tên phải có ít nhất 2 ký tự';
    }

    if (!phone.trim()) {
      errors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!validatePhone(phone.trim())) {
      errors.phone = 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)';
    }

    if (email.trim() && !validateEmail(email.trim())) {
      errors.email = 'Email không đúng định dạng (VD: name@domain.com)';
    }

    if (guests < 1 || guests > room.maxGuests) {
      errors.guests = `Số khách phải từ 1 đến ${room.maxGuests}`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const created = await bookingService.createBooking({
        userId: user?.id || 'guest',
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
        guests,
        pricePerNight: room.pricePerNight,
        totalPrice,
        guestInfo: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          idNumber: idNumber.trim() || undefined,
          idType,
          nationality: nationality.trim() || 'Vietnam',
        },
        specialRequests: specialRequests.trim() || undefined,
        voucherCode: voucherResult ? (voucherResult.voucherCode || voucherCode.trim().toUpperCase()) : undefined,
      });

      addBooking(created);

      // Chuyển sang màn hình thanh toán kèm mã đặt phòng và thông tin chuyển khoản
      navigation.navigate('Payment', {
        bookingCode: created.bookingCode || created.id,
        qrInfo: created.qrInfo,
        depositRequired: created.depositRequired,
      });
    } catch (err: any) {
      const backendMessage =
        err.response?.data?.message || err.message || 'Đặt phòng thất bại. Vui lòng thử lại sau.';
      setFormError(backendMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: SPACING.xl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tóm tắt đặt phòng */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Tóm tắt đặt phòng</Text>
            <SummaryRow label="Loại phòng" value={room.name} />
            <SummaryRow label="Check-in" value={formatDate(checkIn)} />
            <SummaryRow label="Check-out" value={formatDate(checkOut)} />
            <SummaryRow label="Số đêm" value={`${nights} đêm`} />
            <SummaryRow label="Tiền phòng" value={formatPrice(roomCharge)} />
            {discount > 0 && <SummaryRow label="Giảm giá" value={`- ${formatPrice(discount)}`} />}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Tổng tiền</Text>
              <Text style={styles.totalValue}>{formatPrice(totalPrice)}</Text>
            </View>
          </Card>

          {/* Form thông tin khách */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>

            {/* Họ và tên (gộp 1 ô) */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Họ và tên *</Text>
              <TextInput
                style={[styles.input, fieldErrors.fullName && styles.inputError]}
                value={fullName}
                onChangeText={(t) => {
                  setFullName(t);
                  if (fieldErrors.fullName) {
                    setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                  }
                }}
                placeholder="Nguyễn Văn An"
                placeholderTextColor={COLORS.textMuted}
              />
              {fieldErrors.fullName ? (
                <Text style={styles.fieldErrorText}>{fieldErrors.fullName}</Text>
              ) : null}
            </View>

            {/* Số điện thoại */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Số điện thoại *</Text>
              <TextInput
                style={[styles.input, fieldErrors.phone && styles.inputError]}
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  if (fieldErrors.phone) {
                    setFieldErrors((prev) => ({ ...prev, phone: '' }));
                  }
                }}
                keyboardType="phone-pad"
                placeholder="0901234567"
                placeholderTextColor={COLORS.textMuted}
              />
              {fieldErrors.phone ? (
                <Text style={styles.fieldErrorText}>{fieldErrors.phone}</Text>
              ) : null}
            </View>

            {/* Email (tùy chọn) */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Email (tùy chọn)</Text>
              <TextInput
                style={[styles.input, fieldErrors.email && styles.inputError]}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: '' }));
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="example@email.com"
                placeholderTextColor={COLORS.textMuted}
              />
              {fieldErrors.email ? (
                <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
              ) : null}
            </View>

            {/* Loại giấy tờ: CCCD, PASSPORT, CMND */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Loại giấy tờ (tùy chọn)</Text>
              <View style={styles.toggleRow}>
                {(['CCCD', 'PASSPORT', 'CMND'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.toggleBtn, idType === t && styles.toggleBtnActive]}
                    onPress={() => setIdType(t)}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        idType === t && styles.toggleBtnTextActive,
                      ]}
                    >
                      {t === 'CCCD' ? '🪪 CCCD' : t === 'PASSPORT' ? '🛂 Hộ chiếu' : '📄 CMND'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Số giấy tờ (tùy chọn) */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>
                Số {idType === 'CCCD' ? 'CCCD' : idType === 'PASSPORT' ? 'Hộ chiếu' : 'CMND'} (tùy chọn)
              </Text>
              <TextInput
                style={styles.input}
                value={idNumber}
                onChangeText={setIdNumber}
                placeholder={idType === 'PASSPORT' ? 'B1234567' : '048201009988'}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="default"
              />
            </View>

            {/* Quốc tịch (tùy chọn) */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Quốc tịch</Text>
              <TextInput
                style={styles.input}
                value={nationality}
                onChangeText={setNationality}
                placeholder="Vietnam"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Số khách */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Số khách (tối đa {room.maxGuests})</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setGuests(Math.max(1, guests - 1))}
                  disabled={submitting}
                >
                  <Ionicons name="remove" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{guests}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setGuests(Math.min(room.maxGuests, guests + 1))}
                  disabled={submitting}
                >
                  <Ionicons name="add" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              {fieldErrors.guests ? (
                <Text style={styles.fieldErrorText}>{fieldErrors.guests}</Text>
              ) : null}
            </View>

            {/* Yêu cầu đặc biệt (tùy chọn) */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Yêu cầu đặc biệt</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={specialRequests}
                onChangeText={setSpecialRequests}
                multiline
                numberOfLines={3}
                placeholder="Phòng cao tầng, tầng yên tĩnh, dị ứng..."
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Voucher */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Mã giảm giá</Text>
            <View style={styles.voucherRow}>
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, marginRight: SPACING.sm },
                  voucherError ? styles.inputError : null,
                ]}
                value={voucherCode}
                onChangeText={(t) => {
                  setVoucherCode(t);
                  setVoucherResult(null);
                  setVoucherError(null);
                }}
                placeholder="Nhập mã voucher (VD: PBL6WELCOME)"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                editable={!voucherResult && !submitting}
              />
              <TouchableOpacity
                style={[styles.voucherBtn, voucherResult ? styles.voucherBtnSuccess : null]}
                onPress={voucherResult ? handleRemoveVoucher : handleApplyVoucher}
                disabled={voucherLoading || submitting}
              >
                {voucherLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.voucherBtnText}>{voucherResult ? 'Gỡ mã' : 'Áp dụng'}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Hiển thị lỗi ngay dưới ô nhập khi mã không hợp lệ (HTTP 400) */}
            {voucherError ? (
              <View style={styles.voucherErrorRow}>
                <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
                <Text style={styles.voucherErrorText}>{voucherError}</Text>
              </View>
            ) : null}

            {/* Hiển thị kết quả khi áp dụng thành công */}
            {voucherResult && (
              <View style={styles.voucherSuccessRow}>
                <Text style={styles.voucherSuccess}>
                  ✅ {voucherResult.voucherName} — Giảm {formatPrice(voucherResult.discountAmount)}
                </Text>
                <TouchableOpacity
                  onPress={handleRemoveVoucher}
                  disabled={submitting}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.voucherRemoveText}>Gỡ</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Nút đặt phòng & hiển thị lỗi inline */}
          <View style={styles.submitWrap}>
            {formError ? (
              <View style={styles.formErrorBox}>
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}
            <Button
              title={submitting ? 'Đang tạo đơn...' : `Đặt phòng — ${formatPrice(totalPrice)}`}
              onPress={handleBooking}
              disabled={submitting}
              loading={submitting}
              fullWidth
              size="lg"
              variant="secondary"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  errorText: { fontSize: FONTS.sizes.md, color: COLORS.textLight, textAlign: 'center' },
  summaryCard: { marginBottom: SPACING.lg },
  summaryTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  summaryLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textLight },
  summaryValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.text },
  totalRow: { borderBottomWidth: 0, marginTop: SPACING.sm, paddingVertical: SPACING.sm },
  totalLabel: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text },
  totalValue: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.secondary },
  formSection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  inputWrap: { marginBottom: SPACING.md },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  fieldErrorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.xs,
    marginTop: 4,
    marginLeft: 2,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', gap: SPACING.sm },
  toggleBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },
  toggleBtnActive: { borderColor: COLORS.primary, backgroundColor: '#EEF4FA' },
  toggleBtnText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    fontWeight: FONTS.weights.medium,
  },
  toggleBtnTextActive: { color: COLORS.primary, fontWeight: FONTS.weights.bold },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.background,
    alignSelf: 'flex-start',
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#EEF4FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    minWidth: 40,
    textAlign: 'center',
  },
  voucherRow: { flexDirection: 'row', alignItems: 'center' },
  voucherBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    minWidth: 80,
    alignItems: 'center',
  },
  voucherBtnSuccess: { backgroundColor: COLORS.error },
  voucherBtnText: { color: '#fff', fontWeight: FONTS.weights.semiBold, fontSize: FONTS.sizes.sm },
  voucherErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginLeft: 2,
  },
  voucherErrorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.xs,
    flex: 1,
  },
  voucherSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  voucherSuccess: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: FONTS.weights.medium,
    flex: 1,
  },
  voucherRemoveText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    marginLeft: SPACING.sm,
    textDecorationLine: 'underline',
  },
  submitWrap: { gap: SPACING.sm, marginBottom: SPACING.xl },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#FEE2E2',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  formErrorText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
    fontWeight: FONTS.weights.medium,
  },
});
