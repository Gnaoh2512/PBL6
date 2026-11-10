import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { LiveFolio, invoiceService } from '../../services/invoiceService';
import PriceBreakdown from '../../components/booking/PriceBreakdown';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Invoice'>;

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_DEPOSIT: { label: 'Chờ đặt cọc', color: '#D97706', bg: '#FEF3C7' },
  CONFIRMED: { label: 'Đã xác nhận', color: '#059669', bg: '#D1FAE5' },
  CHECKED_IN: { label: 'Đang lưu trú', color: '#2563EB', bg: '#DBEAFE' },
  CHECKED_OUT: { label: 'Hoàn thành', color: '#6B7280', bg: '#F3F4F6' },
  CANCELED: { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' },
  CANCELLED: { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' },
  EXPIRED: { label: 'Hết hạn', color: '#EA580C', bg: '#FFEDD5' },
};

const formatCurrency = (amount: number) => amount.toLocaleString('vi-VN') + ' ₫';

const formatDateStr = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export default function InvoiceScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params; // bookingCode
  const [folio, setFolio] = useState<LiveFolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoiceService
      .getFolio(bookingId)
      .then((data) => {
        setFolio(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error('[InvoiceScreen] getFolio error:', e);
        setLoading(false);
      });
  }, [bookingId]);

  const handleShare = async () => {
    if (!folio) return;
    const statusCfg = STATUS_MAP[folio.bookingStatus] || { label: folio.bookingStatus };
    try {
      await Share.share({
        message: [
          '🏨 HÓA ĐƠN LƯU TRÚ - AZURE BAY HOTEL',
          `Mã đặt phòng: ${folio.bookingCode}`,
          `Khách hàng: ${folio.customerName} (${folio.customerPhone})`,
          `Phòng: ${folio.roomTypeName} - Số ${folio.roomNumber || 'Chưa gán'}`,
          `Check-in: ${formatDateStr(folio.checkInDate)}`,
          `Check-out: ${formatDateStr(folio.checkOutDate)} (${folio.nights} đêm)`,
          `─────────────────────────`,
          `Tiền phòng: ${formatCurrency(folio.roomCharge)}`,
          folio.serviceCharge > 0 ? `Dịch vụ thêm: ${formatCurrency(folio.serviceCharge)}` : '',
          `Thuế VAT (${folio.taxRate}%): ${formatCurrency(folio.taxAmount)}`,
          folio.discountAmount > 0 ? `Giảm giá: -${formatCurrency(folio.discountAmount)}` : '',
          `Tổng hóa đơn: ${formatCurrency(folio.totalAmount)}`,
          `Đã thanh toán cọc: ${formatCurrency(folio.depositPaid)}`,
          `CÒN LẠI PHẢI TRẢ: ${formatCurrency(folio.remainingBalance)}`,
          `─────────────────────────`,
          `Trạng thái đơn: ${statusCfg.label}`,
          `Quyết toán: ${folio.isFullySettled ? 'Đã quyết toán hoàn tất' : 'Chưa quyết toán'}`,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch {
      Alert.alert('Lỗi', 'Không thể chia sẻ hóa đơn.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải hóa đơn lưu trú...</Text>
      </SafeAreaView>
    );
  }

  if (!folio) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
        <Text style={styles.errorText}>Không tìm thấy hóa đơn cho đơn #{bookingId}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_MAP[folio.bookingStatus] || {
    label: folio.bookingStatus,
    color: COLORS.textMuted,
    bg: COLORS.divider,
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header hóa đơn */}
        <View style={styles.invoiceHeader}>
          <Text style={styles.hotelName}>AZURE BAY HOTEL</Text>
          <Text style={styles.invoiceSubtitle}>BẢNG KÊ CHI PHÍ LƯU TRÚ (LIVE FOLIO)</Text>
          <Text style={styles.invoiceId}>Mã đơn: #{folio.bookingCode}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>

        {/* Thông tin khách hàng */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
          <Row label="Họ và tên" value={folio.customerName || 'Khách vãng lai'} />
          <Row label="Số điện thoại" value={folio.customerPhone || '—'} />
        </View>

        {/* Thông tin lưu trú */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin lưu trú</Text>
          <Row
            label="Loại phòng"
            value={`${folio.roomTypeName}${folio.roomNumber ? ` (Phòng ${folio.roomNumber})` : ''}`}
          />
          <Row label="Ngày nhận phòng" value={formatDateStr(folio.checkInDate)} />
          <Row label="Ngày trả phòng" value={formatDateStr(folio.checkOutDate)} />
          <Row label="Thời gian lưu trú" value={`${folio.nights} đêm`} />
          <Row label="Giá niêm yết" value={`${formatCurrency(folio.pricePerNight)} / đêm`} />
        </View>

        {/* Bảng chi tiết giá & dịch vụ */}
        <PriceBreakdown
          roomCharge={folio.roomCharge}
          nights={folio.nights}
          pricePerNight={folio.pricePerNight}
          serviceCharges={folio.serviceCharge}
          serviceBreakdown={folio.services}
          tax={folio.taxAmount}
          taxRate={folio.taxRate}
          discount={folio.discountAmount}
          totalAmount={folio.totalAmount}
          depositPaid={folio.depositPaid}
          remainingBalance={folio.remainingBalance}
        />

        {/* Trạng thái quyết toán */}
        <View style={[styles.section, { marginTop: SPACING.md }]}>
          <Text style={styles.sectionTitle}>Tình trạng quyết toán</Text>
          <Row label="Đã đặt cọc" value={formatCurrency(folio.depositPaid)} />
          <Row
            label="Còn lại phải trả"
            value={formatCurrency(folio.remainingBalance)}
            bold
          />
          <Row
            label="Quyết toán hóa đơn"
            value={folio.isFullySettled ? 'Đã quyết toán hoàn tất' : 'Chưa hoàn tất'}
            highlightColor={folio.isFullySettled ? COLORS.success : COLORS.warning}
          />
        </View>
      </ScrollView>

      {/* Footer chia sẻ */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom:
              Platform.OS === 'android'
                ? Math.max(insets.bottom, 48)
                : Math.max(insets.bottom, 16),
          },
        ]}
      >
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={20} color={COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={styles.shareBtnText}>Chia sẻ hóa đơn</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  bold,
  highlightColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlightColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          bold && { fontWeight: 'bold', color: COLORS.error, fontSize: FONTS.sizes.md },
          highlightColor ? { color: highlightColor, fontWeight: 'bold' } : undefined,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg, gap: 12 },
  loadingText: { fontSize: FONTS.sizes.sm, color: COLORS.textLight, marginTop: 8 },
  errorText: { fontSize: FONTS.sizes.md, color: COLORS.error, textAlign: 'center' },
  backBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  backBtnText: { color: COLORS.surface, fontWeight: FONTS.weights.bold },
  content: { padding: SPACING.md, paddingBottom: 110 },
  invoiceHeader: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  hotelName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.secondary,
    letterSpacing: 1.5,
  },
  invoiceSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  invoiceId: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.surface,
    marginTop: 6,
    fontWeight: FONTS.weights.semiBold,
  },
  statusBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONTS.sizes.xs + 1,
    fontWeight: FONTS.weights.bold,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textLight },
  rowValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  shareBtn: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
    fontSize: FONTS.sizes.md,
  },
});
