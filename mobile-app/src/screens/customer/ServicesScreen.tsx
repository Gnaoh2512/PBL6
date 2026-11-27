import React, { useEffect, useState } from 'react';
import { AppText, AppTextInput } from '../../components/common/AppText';
import { View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Service } from '../../models/Service';
import { serviceService } from '../../services/serviceService';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Services'>;

const formatCurrency = (amount: number) => {
  if (amount === 0) return 'Miễn phí';
  return amount.toLocaleString('vi-VN') + ' ₫';
};

// Icon gán cứng theo categoryName kèm một icon mặc định cho danh mục lạ
const getCategoryIcon = (categoryName: string): keyof typeof Ionicons.glyphMap => {
  const lower = (categoryName || '').toLowerCase();
  if (
    lower.includes('ẩm thực') ||
    lower.includes('đồ uống') ||
    lower.includes('f&b') ||
    lower.includes('ăn') ||
    lower.includes('food') ||
    lower.includes('beverage')
  ) {
    return 'restaurant-outline';
  }
  if (lower.includes('giặt') || lower.includes('ủi') || lower.includes('laundry')) {
    return 'shirt-outline';
  }
  if (
    lower.includes('spa') ||
    lower.includes('massage') ||
    lower.includes('làm đẹp') ||
    lower.includes('wellness')
  ) {
    return 'sparkles-outline';
  }
  if (lower.includes('đưa đón') || lower.includes('xe') || lower.includes('transport')) {
    return 'car-sport-outline';
  }
  if (lower.includes('phòng') || lower.includes('room')) {
    return 'bed-outline';
  }
  return 'star-outline'; // Icon mặc định cho danh mục lạ
};

export default function ServicesScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const bookingCode = route.params?.bookingCode;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal order state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderNote, setOrderNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    serviceService.getServices().then((data) => {
      setServices(data);
      setLoading(false);
    });
  }, []);

  // Nhóm ĐỘNG theo chuỗi categoryName trả về
  const grouped = services.reduce<Record<string, Service[]>>((acc, item) => {
    const cat = item.categoryName || 'Dịch vụ khác';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handleOpenOrder = (item: Service) => {
    if (!bookingCode) {
      Alert.alert(
        'Yêu cầu đơn đặt phòng',
        'Vui lòng chọn "Gọi dịch vụ" từ một đơn phòng cụ thể trong mục "Đặt phòng của tôi".',
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Đến Đặt phòng',
            onPress: () => navigation.navigate('CustomerTabs', { screen: 'MyBookings' } as any),
          },
        ]
      );
      return;
    }
    setSelectedService(item);
    setOrderQuantity(1);
    setOrderNote('');
    setModalVisible(true);
  };

  const handleConfirmOrder = async () => {
    if (!selectedService || !bookingCode) return;
    setIsSubmitting(true);
    try {
      const res = await serviceService.orderService(
        bookingCode,
        selectedService.serviceId,
        orderQuantity,
        orderNote.trim()
      );
      setIsSubmitting(false);
      setModalVisible(false);
      Alert.alert(
        'Gọi dịch vụ thành công!',
        res?.message ||
          `Đã ghi nhận yêu cầu ${orderQuantity} ${selectedService.unit} ${selectedService.serviceName} vào hóa đơn phòng ${bookingCode}.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      setIsSubmitting(false);
      const serverMsg =
        error.response?.data?.message ||
        error.message ||
        'Có lỗi xảy ra khi gọi dịch vụ. Vui lòng thử lại!';
      Alert.alert('Gọi dịch vụ thất bại', serverMsg);
    }
  };

  const renderServiceItem = (item: Service) => {
    const iconName = getCategoryIcon(item.categoryName);
    return (
      <View style={styles.serviceCard} key={item.serviceId}>
        <View style={styles.serviceIcon}>
          <Ionicons name={iconName} size={22} color={COLORS.primary} />
        </View>
        <View style={styles.serviceInfo}>
          <AppText style={styles.serviceName}>{item.serviceName}</AppText>
          <AppText style={styles.servicePrice}>
            {item.unitPrice === 0 ? 'Miễn phí' : `${formatCurrency(item.unitPrice)} / ${item.unit}`}
          </AppText>
        </View>
        <TouchableOpacity
          style={styles.orderBtn}
          onPress={() => handleOpenOrder(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="cart-outline" size={16} color={COLORS.surface} style={{ marginRight: 4 }} />
          <AppText style={styles.orderBtnText}>Gọi dịch vụ</AppText>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <AppText style={styles.loadingText}>Đang tải danh sách dịch vụ...</AppText>
      </SafeAreaView>
    );
  }

  const categoryKeys = Object.keys(grouped);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />
      {/* Banner thông tin phòng */}
      <View style={styles.bookingBanner}>
        <Ionicons
          name={bookingCode ? 'bed-outline' : 'information-circle-outline'}
          size={20}
          color={bookingCode ? COLORS.primary : COLORS.warning}
        />
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <AppText style={styles.bannerTitle}>
            {bookingCode ? `Đơn đặt phòng: ${bookingCode}` : 'Chưa chọn đơn đặt phòng'}
          </AppText>
          <AppText style={styles.bannerSubtitle}>
            {bookingCode
              ? 'Dịch vụ sẽ được tính trực tiếp vào hóa đơn của phòng này.'
              : 'Hãy vào "Đặt phòng của tôi" để gọi dịch vụ theo phòng.'}
          </AppText>
        </View>
      </View>

      <FlatList
        data={categoryKeys}
        keyExtractor={(cat) => cat}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: cat }) => {
          const icon = getCategoryIcon(cat);
          return (
            <View style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Ionicons name={icon} size={18} color={COLORS.primary} />
                <AppText style={styles.categoryLabel}>{cat}</AppText>
              </View>
              {grouped[cat].map(renderServiceItem)}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="sparkles-outline" size={48} color={COLORS.textMuted} />
            <AppText style={styles.emptyText}>Hiện chưa có dịch vụ nào đang mở</AppText>
          </View>
        }
      />

      {/* Modal gọi dịch vụ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmitting) setModalVisible(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalContent}
            >
              {selectedService && (
                <>
                  <View style={styles.modalHeader}>
                    <AppText style={styles.modalTitle}>Gọi dịch vụ phòng</AppText>
                    <TouchableOpacity
                      onPress={() => setModalVisible(false)}
                      disabled={isSubmitting}
                    >
                      <Ionicons name="close" size={24} color={COLORS.textLight} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.serviceDetailBox}>
                    <AppText style={styles.modalServiceName}>{selectedService.serviceName}</AppText>
                    <AppText style={styles.modalCategoryName}>{selectedService.categoryName}</AppText>
                    <AppText style={styles.modalServicePrice}>
                      Đơn giá: {selectedService.unitPrice === 0 ? 'Miễn phí' : `${formatCurrency(selectedService.unitPrice)} / ${selectedService.unit}`}
                    </AppText>
                  </View>

                  {/* Chọn số lượng */}
                  <View style={styles.quantitySection}>
                    <AppText style={styles.qtySectionLabel}>Số lượng ({selectedService.unit}):</AppText>
                    <View style={styles.qtyControlRow}>
                      <TouchableOpacity
                        style={[styles.qtyBtn, orderQuantity <= 1 && styles.qtyBtnDisabled]}
                        disabled={orderQuantity <= 1 || isSubmitting}
                        onPress={() => setOrderQuantity((q) => Math.max(1, q - 1))}
                      >
                        <Ionicons name="remove" size={18} color={orderQuantity <= 1 ? COLORS.textMuted : COLORS.primary} />
                      </TouchableOpacity>
                      <AppText style={styles.qtyValueText}>{orderQuantity}</AppText>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        disabled={isSubmitting}
                        onPress={() => setOrderQuantity((q) => q + 1)}
                      >
                        <Ionicons name="add" size={18} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Tổng tạm tính */}
                  <View style={styles.totalRow}>
                    <AppText style={styles.totalRowLabel}>Tổng cộng:</AppText>
                    <AppText style={styles.totalRowValue}>
                      {formatCurrency(selectedService.unitPrice * orderQuantity)}
                    </AppText>
                  </View>

                  {/* Ghi chú */}
                  <AppText style={styles.noteLabel}>Ghi chú thêm (tùy chọn):</AppText>
                  <AppTextInput
                    style={styles.noteInput}
                    placeholder="Vd: Giao lúc 19:30, mang thêm đá..."
                    placeholderTextColor={COLORS.textMuted}
                    value={orderNote}
                    onChangeText={setOrderNote}
                    multiline
                    numberOfLines={3}
                    editable={!isSubmitting}
                  />

                  {/* Nút hành động */}
                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      disabled={isSubmitting}
                      onPress={() => setModalVisible(false)}
                    >
                      <AppText style={styles.cancelBtnText}>Hủy</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmBtn, isSubmitting && { opacity: 0.7 }]}
                      disabled={isSubmitting}
                      onPress={handleConfirmOrder}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color={COLORS.surface} size="small" />
                      ) : (
                        <AppText style={styles.confirmBtnText}>Xác nhận gọi</AppText>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textLight, fontSize: FONTS.sizes.sm },
  bookingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bannerTitle: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.primary },
  bannerSubtitle: { fontSize: FONTS.sizes.xs, color: COLORS.textLight, marginTop: 1 },
  listContent: { padding: SPACING.md, paddingBottom: 60 },
  categoryBlock: { marginBottom: SPACING.lg },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  serviceInfo: { flex: 1, marginRight: SPACING.sm },
  serviceName: {
    fontSize: FONTS.sizes.sm + 1,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  servicePrice: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
  },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 3,
    borderRadius: RADIUS.md,
  },
  orderBtnText: {
    color: COLORS.surface,
    fontSize: FONTS.sizes.xs + 1,
    fontWeight: FONTS.weights.semiBold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    marginTop: SPACING.sm,
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  serviceDetailBox: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalServiceName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  modalCategoryName: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  modalServicePrice: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  qtySectionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.text,
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  qtyBtnDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  qtyValueText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    minWidth: 24,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  totalRowLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  totalRowValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  noteLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    textAlignVertical: 'top',
    minHeight: 65,
    marginBottom: SPACING.lg,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md - 2,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: FONTS.sizes.sm + 1,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textLight,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md - 2,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: FONTS.sizes.sm + 1,
    fontWeight: FONTS.weights.bold,
    color: COLORS.surface,
  },
});
