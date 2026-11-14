import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
      <Text style={styles.title}>Chi tiết thanh toán</Text>

      {/* Tiền phòng */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Tiền phòng</Text>
          <Text style={styles.value}>{formatCurrency(roomCharge)}</Text>
        </View>
        <Text style={styles.sub}>
          {formatCurrency(pricePerNight)} × {nights} đêm
        </Text>
      </View>

      {/* Dịch vụ */}
      {serviceCharges > 0 && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Dịch vụ thêm</Text>
            <Text style={styles.value}>{formatCurrency(serviceCharges)}</Text>
          </View>
          {serviceBreakdown.map((item, idx) => (
            <View key={idx} style={styles.subRow}>
              <Text style={styles.sub} numberOfLines={1}>
                • {item.serviceName || item.name} ({item.quantity} {item.unit})
              </Text>
              <Text style={styles.sub}>
                {formatCurrency(item.totalPrice ?? item.subtotal ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Giảm giá */}
      {discount > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Giảm giá</Text>
          <Text style={[styles.value, { color: COLORS.success }]}>
            -{formatCurrency(discount)}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* Thuế */}
      <View style={styles.row}>
        <Text style={styles.label}>Thuế VAT ({taxRate}%)</Text>
        <Text style={styles.value}>{formatCurrency(tax)}</Text>
      </View>

      <View style={styles.totalDivider} />

      {/* Tổng thanh toán */}
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Tổng thanh toán</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
      </View>

      {/* Hai dòng: Đã cọc & Còn lại phải trả */}
      <View style={styles.settleDivider} />

      <View style={styles.settleRow}>
        <Text style={styles.depositLabel}>Đã cọc</Text>
        <Text style={styles.depositValue}>
          {formatCurrency(depositPaid)}
        </Text>
      </View>

      <View style={[styles.settleRow, { marginTop: 4 }]}>
        <Text style={styles.remainingLabel}>Còn lại phải trả</Text>
        <Text style={styles.remainingValue}>
          {formatCurrency(remainingBalance)}
        </Text>
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
