import React, { useState, useEffect, useRef } from 'react';
import { AppText, AppTextInput } from '../../components/common/AppText';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { bookingService } from '../../services/bookingService';
import { QRInfo } from '../../models/Booking';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, SPACING, RADIUS, HOTEL_INFO } from '../../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

export default function PaymentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { bookingCode, qrInfo: initialQrInfo, depositRequired: initialDeposit } = route.params;

  const [qrInfo, setQrInfo] = useState<QRInfo | null>(initialQrInfo || null);
  const [depositRequired, setDepositRequired] = useState<number | null>(initialDeposit ?? null);
  const [loadingInfo, setLoadingInfo] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // Mặc định 15 phút (900s)

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleCallHotel = () => {
    const cleanPhone = HOTEL_INFO.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

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
        <AppText style={styles.loadingText}>Đang tải thông tin thanh toán...</AppText>
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
        <AppText style={styles.pageTitle}>Thanh toán đặt cọc</AppText>
        <AppText style={styles.pageSubtitle}>
          Vui lòng chuyển khoản theo thông tin dưới đây để hoàn tất đặt phòng
        </AppText>

        {/* Trạng thái hết hạn */}
        {isExpired ? (
          <View style={styles.expiredCard}>
            <Ionicons name="time-outline" size={48} color={COLORS.error} />
            <AppText style={styles.expiredTitle}>Đơn đã hết hạn thanh toán cọc</AppText>
            <AppText style={styles.expiredDesc}>
              Thời gian giữ phòng (15 phút) đã kết thúc. Vui lòng quay lại tìm phòng và đặt lại đơn mới.
            </AppText>
            <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome}>
              <AppText style={styles.homeBtnText}>Về trang chủ</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Đồng hồ đếm ngược */}
            <View style={styles.countdownBox}>
              <Ionicons name="timer-outline" size={22} color={COLORS.primary} />
              <AppText style={styles.countdownLabel}>Thời gian giữ phòng còn lại:</AppText>
              <AppText style={styles.countdownTime}>{timeFormatted}</AppText>
            </View>

            {/* Khối hiển thị thông tin chuyển khoản dạng chữ hoặc thông báo nếu không có qrInfo */}
            {!qrInfo ? (
              <View style={styles.noQrCard}>
                <Ionicons name="information-circle-outline" size={44} color={COLORS.primary} style={{ marginBottom: SPACING.sm }} />
                <AppText style={styles.noQrText}>
                  Không lấy lại được thông tin chuyển khoản. Vui lòng liên hệ khách sạn để được hỗ trợ đặt cọc.
                </AppText>
                <TouchableOpacity style={styles.callHotelBtn} onPress={handleCallHotel} activeOpacity={0.8}>
                  <Ionicons name="call" size={16} color={COLORS.surface} style={{ marginRight: 6 }} />
                  <AppText style={styles.callHotelBtnText}>Gọi khách sạn ({HOTEL_INFO.phone})</AppText>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.infoCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
                  <AppText style={styles.cardHeaderTitle}>Thông tin chuyển khoản</AppText>
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
            )}

            {/* Trạng thái chờ */}
            <View style={styles.waitingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <AppText style={styles.waitingText}>
                Hệ thống đang tự động kiểm tra giao dịch mỗi 3 giây...
              </AppText>
            </View>

            {/* Nút Demo giả lập đã thanh toán (chỉ khi __DEV__) */}
            {__DEV__ && (
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={handleSimulatePayment}
                activeOpacity={0.8}
              >
                <Ionicons name="flask-outline" size={18} color={COLORS.surface} />
                <AppText style={styles.demoBtnText}>🧪 Demo: Giả lập đã thanh toán</AppText>
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
      <AppText style={styles.infoLabel}>{label}</AppText>
      <AppText
        style={[
          styles.infoValue,
          bold && styles.valueBold,
          highlight && styles.valueHighlight,
        ]}
        selectable
      >
        {value}
      </AppText>
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
    backgroundColor: COLORS.warningBackground,
    borderWidth: 1,
    borderColor: COLORS.secondaryLight,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  countdownLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  countdownTime: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
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
  valueHighlight: { color: COLORS.primary, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.md },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.primarySubtle,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  waitingText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontStyle: 'italic', flex: 1 },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.warning,
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
    borderColor: COLORS.error,
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
  noQrCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  noQrText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  callHotelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
  },
  callHotelBtnText: {
    color: COLORS.surface,
    fontWeight: FONTS.weights.bold,
    fontSize: FONTS.sizes.sm,
  },
});
