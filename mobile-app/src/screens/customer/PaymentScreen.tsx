import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { bookingService } from '../../services/bookingService';
import { QRInfo } from '../../models/Booking';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

export default function PaymentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { bookingCode, qrInfo: initialQrInfo, depositRequired: initialDeposit } = route.params;

  const [qrInfo, setQrInfo] = useState<QRInfo | null>(initialQrInfo || null);
  const [depositRequired, setDepositRequired] = useState<number | null>(initialDeposit ?? null);
  const [loadingInfo, setLoadingInfo] = useState<boolean>(!initialQrInfo);
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // Mặc định 15 phút (900s)

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Tải thông tin đơn/qrInfo nếu chưa có từ params
  useEffect(() => {
    let isMounted = true;
    if (!initialQrInfo) {
      setLoadingInfo(true);
      bookingService
        .getBookingByCode(bookingCode)
        .then((b) => {
          if (!isMounted) return;
          console.log('[PaymentScreen] fetched booking detail:', b);
          if (b.qrInfo) setQrInfo(b.qrInfo);
          if (b.depositRequired) setDepositRequired(b.depositRequired);
          if (b.status === 'EXPIRED') setIsExpired(true);
          setLoadingInfo(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('[PaymentScreen] failed to fetch booking detail:', err);
          setLoadingInfo(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [bookingCode, initialQrInfo]);

  // 2. Thiết lập đồng hồ đếm ngược 15 phút (hoặc theo expiredAt nếu có)
  useEffect(() => {
    let initialSeconds = 15 * 60;
    if (qrInfo?.expiredAt) {
      const expTime = new Date(qrInfo.expiredAt).getTime();
      const diff = Math.floor((expTime - Date.now()) / 1000);
      initialSeconds = diff > 0 ? diff : 0;
    }
    setTimeLeft(initialSeconds);

    if (initialSeconds <= 0) {
      setIsExpired(true);
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          // Hết giờ -> kiểm tra lại payment status một lần cuối
          checkPaymentStatusOnce();
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [qrInfo?.expiredAt]);

  const checkPaymentStatusOnce = async () => {
    try {
      const statusData = await bookingService.getPaymentStatus(bookingCode);
      console.log('[PaymentScreen] final status check on countdown 0:', statusData);
      if (statusData?.bookingStatus === 'CONFIRMED') {
        navigation.replace('BookingSuccess', { bookingId: bookingCode });
      } else {
        setIsExpired(true);
      }
    } catch (e) {
      console.warn('[PaymentScreen] check status on expiry error:', e);
      setIsExpired(true);
    }
  };

  // 3. Polling kiểm tra trạng thái thanh toán mỗi 3 giây
  useEffect(() => {
    if (isExpired) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }

    pollingTimerRef.current = setInterval(async () => {
      try {
        const statusData = await bookingService.getPaymentStatus(bookingCode);
        console.log('[PaymentScreen] polling payment status:', statusData);

        // KHÔNG dùng field isPaid (có thể bị Lombok đổi tên thành paid)
        if (statusData?.bookingStatus === 'CONFIRMED') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          navigation.replace('BookingSuccess', { bookingId: bookingCode });
        } else if (statusData?.bookingStatus === 'EXPIRED') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setIsExpired(true);
        }
      } catch (error) {
        console.warn('[PaymentScreen] polling error:', error);
      }
    }, 3000);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [bookingCode, isExpired]);

  // 4. Giả lập thanh toán (Dành cho Demo / DEV)
  const handleSimulatePayment = async () => {
    try {
      await bookingService.simulateDeposit(bookingCode);
      Alert.alert('Thành công', 'Đã giả lập nạp cọc thành công! Đang chờ xác nhận hệ thống...');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Lỗi giả lập thanh toán.';
      Alert.alert('Lỗi', msg);
    }
  };

  const handleGoHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CustomerTabs', params: { screen: 'Home' } }],
    });
  };

  // Định dạng thời gian đếm ngược mm:ss
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const depositAmount = qrInfo?.amount ?? depositRequired ?? 0;

  if (loadingInfo) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải thông tin thanh toán...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: SPACING.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Thanh toán đặt cọc</Text>
        <Text style={styles.pageSubtitle}>
          Vui lòng chuyển khoản theo thông tin dưới đây để hoàn tất đặt phòng
        </Text>

        {/* Trạng thái hết hạn */}
        {isExpired ? (
          <View style={styles.expiredCard}>
            <Ionicons name="time-outline" size={48} color={COLORS.error} />
            <Text style={styles.expiredTitle}>Đơn đã hết hạn thanh toán cọc</Text>
            <Text style={styles.expiredDesc}>
              Thời gian giữ phòng (15 phút) đã kết thúc. Vui lòng quay lại tìm phòng và đặt lại đơn mới.
            </Text>
            <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome}>
              <Text style={styles.homeBtnText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Đồng hồ đếm ngược */}
            <View style={styles.countdownBox}>
              <Ionicons name="timer-outline" size={22} color={COLORS.secondary} />
              <Text style={styles.countdownLabel}>Thời gian giữ phòng còn lại:</Text>
              <Text style={styles.countdownTime}>{timeFormatted}</Text>
            </View>

            {/* Khối hiển thị thông tin chuyển khoản dạng chữ (TẠM BỎ QUA ảnh QR) */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
                <Text style={styles.cardHeaderTitle}>Thông tin chuyển khoản</Text>
              </View>

              <View style={styles.divider} />

              <InfoRow label="Mã đặt phòng" value={bookingCode} bold />
              <InfoRow
                label="Số tiền cọc cần chuyển"
                value={formatPrice(depositAmount)}
                highlight
              />
              <InfoRow label="Ngân hàng thụ hưởng" value={qrInfo?.bankId || 'MB (Ngân hàng Quân Đội)'} />
              <InfoRow label="Số tài khoản" value={qrInfo?.accountNo || 'Chưa cập nhật'} bold />
              <InfoRow label="Tên chủ tài khoản" value={qrInfo?.accountName || 'AZURE BAY HOTEL'} />
              <InfoRow
                label="Nội dung chuyển khoản"
                value={qrInfo?.transferContent || bookingCode}
                bold
                highlight
              />
            </View>

            {/* Trạng thái chờ */}
            <View style={styles.waitingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.waitingText}>
                Hệ thống đang tự động kiểm tra giao dịch mỗi 3 giây...
              </Text>
            </View>

            {/* Nút Demo giả lập đã thanh toán (chỉ khi __DEV__) */}
            {__DEV__ && (
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={handleSimulatePayment}
                activeOpacity={0.8}
              >
                <Ionicons name="flask-outline" size={18} color={COLORS.surface} />
                <Text style={styles.demoBtnText}>🧪 Demo: Giả lập đã thanh toán</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  highlight,
  bold,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          bold && styles.valueBold,
          highlight && styles.valueHighlight,
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textLight, fontSize: FONTS.sizes.sm },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  pageTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: '#FEF9EC',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  countdownLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  countdownTime: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.secondary,
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  cardHeaderTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  divider: { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.sm },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  infoLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textLight, flex: 1, marginRight: SPACING.sm },
  infoValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    flex: 1.2,
    textAlign: 'right',
  },
  valueBold: { fontWeight: FONTS.weights.bold, color: COLORS.text },
  valueHighlight: { color: COLORS.secondary, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.md },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#EEF4FA',
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  waitingText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontStyle: 'italic', flex: 1 },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: '#F59E0B',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
  },
  demoBtnText: { color: COLORS.surface, fontWeight: 'bold', fontSize: FONTS.sizes.sm },
  expiredCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: SPACING.md,
  },
  expiredTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.error,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  expiredDesc: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  homeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xl,
  },
  homeBtnText: { color: COLORS.surface, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },
});
