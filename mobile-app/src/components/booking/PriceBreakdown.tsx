import React from 'react';
import { AppText, AppTextInput } from '../common/AppText';
import { View, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

interface ServiceItem {
  serviceName?: string;
  name?: string;
  quantity: number;
  unit: string;
  totalPrice?: number;
  subtotal?: number;
}

interface PriceBreakdownProps {
  roomCharge: number;
  nights: number;
  pricePerNight: number;
  serviceBreakdown?: ServiceItem[];
  serviceCharges?: number;
  tax: number;
  taxRate?: number;
  discount?: number;
  totalAmount: number;
  depositPaid?: number;
  remainingBalance?: number;
}

const formatCurrency = (amount: number) =>
  amount.toLocaleString('vi-VN') + ' ₫';

export default function PriceBreakdown({
  roomCharge,
  nights,
  pricePerNight,
  serviceBreakdown = [],
  serviceCharges = 0,
  tax,
  taxRate = 10,
  discount = 0,
  totalAmount,
  depositPaid = 0,
  remainingBalance = 0,
}: PriceBreakdownProps) {
  return (
    <View style={styles.container}>
      <AppText style={styles.title}>Chi tiết thanh toán</AppText>

      {/* Tiền phòng */}
      <View style={styles.section}>
        <View style={styles.row}>
          <AppText style={styles.label}>Tiền phòng</AppText>
          <AppText style={styles.value}>{formatCurrency(roomCharge)}</AppText>
        </View>
        <AppText style={styles.sub}>
          {formatCurrency(pricePerNight)} × {nights} đêm
        </AppText>
      </View>

      {/* Dịch vụ */}
      {serviceCharges > 0 && (
        <View style={styles.section}>
          <View style={styles.row}>
            <AppText style={styles.label}>Dịch vụ thêm</AppText>
            <AppText style={styles.value}>{formatCurrency(serviceCharges)}</AppText>
          </View>
          {serviceBreakdown.map((item, idx) => (
            <View key={idx} style={styles.subRow}>
              <AppText style={styles.sub} numberOfLines={1}>
                • {item.serviceName || item.name} ({item.quantity} {item.unit})
              </AppText>
              <AppText style={styles.sub}>
                {formatCurrency(item.totalPrice ?? item.subtotal ?? 0)}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {/* Giảm giá */}
      {discount > 0 && (
        <View style={styles.row}>
          <AppText style={styles.label}>Giảm giá</AppText>
          <AppText style={[styles.value, { color: COLORS.success }]}>
            -{formatCurrency(discount)}
          </AppText>
        </View>
      )}

      <View style={styles.divider} />

      {/* Thuế */}
      <View style={styles.row}>
        <AppText style={styles.label}>Thuế VAT ({taxRate}%)</AppText>
        <AppText style={styles.value}>{formatCurrency(tax)}</AppText>
      </View>

      <View style={styles.totalDivider} />

      {/* Tổng thanh toán */}
      <View style={styles.row}>
        <AppText style={styles.totalLabel}>Tổng thanh toán</AppText>
        <AppText style={styles.totalValue}>{formatCurrency(totalAmount)}</AppText>
      </View>

      {/* Hai dòng: Đã cọc & Còn lại phải trả */}
      <View style={styles.settleDivider} />

      <View style={styles.settleRow}>
        <AppText style={styles.depositLabel}>Đã cọc</AppText>
        <AppText style={styles.depositValue}>
          {formatCurrency(depositPaid)}
        </AppText>
      </View>

      <View style={[styles.settleRow, { marginTop: 4 }]}>
        <AppText style={styles.remainingLabel}>Còn lại phải trả</AppText>
        <AppText style={styles.remainingValue}>
          {formatCurrency(remainingBalance)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  section: { marginBottom: SPACING.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: SPACING.sm,
    marginVertical: 1,
  },
  label: { fontSize: FONTS.sizes.sm, color: COLORS.textLight, flex: 1 },
  value: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: FONTS.weights.medium },
  sub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  totalDivider: { height: 1.5, backgroundColor: COLORS.primary, marginVertical: SPACING.sm },
  totalLabel: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.primary },
  totalValue: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.primary },
  settleDivider: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 0.8,
    borderColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  settleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  depositLabel: { fontSize: FONTS.sizes.sm, color: COLORS.success, fontWeight: FONTS.weights.semiBold },
  depositValue: { fontSize: FONTS.sizes.sm, color: COLORS.success, fontWeight: FONTS.weights.bold },
  remainingLabel: { fontSize: FONTS.sizes.sm + 1, color: COLORS.error, fontWeight: FONTS.weights.bold },
  remainingValue: { fontSize: FONTS.sizes.md, color: COLORS.error, fontWeight: FONTS.weights.bold },
});
