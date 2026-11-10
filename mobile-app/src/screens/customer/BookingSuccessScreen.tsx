import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import Button from '../../components/common/Button';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bookingId } = route.params;

  const scaleAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={[styles.container, { paddingBottom: SPACING.xl + insets.bottom }]}>
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark" size={64} color={COLORS.surface} />
        </Animated.View>

        <Text style={styles.title}>Đặt phòng thành công!</Text>
        <Text style={styles.subtitle}>
          Yêu cầu đặt phòng của bạn đã được ghi nhận và đang chờ xác nhận từ khách sạn.
        </Text>

        <View style={styles.bookingIdBox}>
          <Text style={styles.bookingIdLabel}>Mã đặt phòng</Text>
          <Text style={styles.bookingId}>{bookingId.toUpperCase()}</Text>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Xác nhận sẽ được gửi qua email trong vòng 2 giờ.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Khách sạn có thể liên hệ để xác nhận thêm thông tin.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            title="Xem lịch sử đặt phòng"
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'CustomerTabs',
                    params: { screen: 'MyBookings' },
                  },
                ],
              });
            }}
            variant="primary"
            fullWidth
            size="lg"
          />
          <Button
            title="Về trang chủ"
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'CustomerTabs',
                    params: { screen: 'Home' },
                  },
                ],
              });
            }}
            variant="outline"
            fullWidth
            style={{ marginTop: SPACING.sm }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  bookingIdBox: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    width: '100%',
  },
  bookingIdLabel: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: SPACING.xs,
  },
  bookingId: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.secondary,
    letterSpacing: 2,
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: '100%',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  infoText: { fontSize: FONTS.sizes.sm, color: COLORS.textLight, flex: 1, lineHeight: 20 },
  actions: { width: '100%' },
});
