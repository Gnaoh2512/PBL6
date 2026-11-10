import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useBookingStore } from '../../store/useBookingStore';
import { roomService } from '../../services/roomService';
import Button from '../../components/common/Button';
import DateRangePicker, { DateRangeValue } from '../../components/booking/DateRangePicker';
import { formatPrice } from '../../utils/priceUtils';
import { countNights } from '../../utils/dateUtils';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

const { width } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'RoomDetail'>;

export default function RoomDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { room } = route.params;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ checkIn: null, checkOut: null });
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availabilityMsg, setAvailabilityMsg] = useState('');
  // Lưu totalRoomCharge và estimatedDeposit do API trả về
  const [totalCharge, setTotalCharge] = useState<number | null>(null);
  const [deposit, setDeposit] = useState<number | null>(null);

  const { setDraftRoom, setDraftDates } = useBookingStore();

  const handleDateChange = (v: DateRangeValue) => {
    setDateRange(v);
    setAvailable(null);
    setAvailabilityMsg('');
    setTotalCharge(null);
    setDeposit(null);
  };

  const handleCheckAvailability = async () => {
    if (!dateRange.checkIn || !dateRange.checkOut) {
      Alert.alert('Chưa chọn ngày', 'Vui lòng chọn ngày nhận phòng và trả phòng');
      return;
    }
    setChecking(true);
    try {
      // room.id = roomTypeId.toString() (set bởi roomTypeToRoom)
      const roomTypeId = parseInt(room.id, 10);

      const result = await roomService.getAvailableRooms(
        dateRange.checkIn,
        dateRange.checkOut,
        1,
        roomTypeId
      );

      // Lọc theo roomTypeId để tìm phòng vật lý phù hợp
      const match = result.find((r) => r.roomType.roomTypeId === roomTypeId);

      if (match) {
        setAvailable(true);
        setAvailabilityMsg('Phòng còn trống trong khoảng thời gian này!');
        setTotalCharge(match.totalRoomCharge);
        setDeposit(match.estimatedDeposit);
        // Lưu roomId vật lý vào draft để dùng khi đặt phòng
        setDraftRoom({
          ...room,
          id: match.roomId.toString(),
          pricePerNight: match.pricePerNight,
        });
      } else {
        setAvailable(false);
        setAvailabilityMsg('Rất tiếc, phòng đã hết trong khoảng thời gian này.');
        setTotalCharge(null);
        setDeposit(null);
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        'Không thể kiểm tra phòng. Vui lòng thử lại.';
      setAvailable(false);
      setAvailabilityMsg(`Lỗi: ${msg}`);
    } finally {
      setChecking(false);
    }
  };

  const handleBookNow = () => {
    if (!dateRange.checkIn || !dateRange.checkOut) return;
    const [y1, m1, d1] = dateRange.checkIn.split('-').map(Number);
    const [y2, m2, d2] = dateRange.checkOut.split('-').map(Number);
    setDraftDates(new Date(y1, m1 - 1, d1), new Date(y2, m2 - 1, d2));
    navigation.navigate('BookingForm');
  };

  const nights =
    dateRange.checkIn && dateRange.checkOut
      ? countNights(dateRange.checkIn, dateRange.checkOut)
      : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image carousel */}
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentImageIndex(idx);
            }}
            scrollEventThrottle={16}
          >
            {room.images.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.image} resizeMode="cover" />
            ))}
          </ScrollView>

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.surface} />
          </TouchableOpacity>

          {/* Dots */}
          {room.images.length > 1 && (
            <View style={styles.imageDots}>
              {room.images.map((_, idx) => (
                <View
                  key={idx}
                  style={[styles.dot, idx === currentImageIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.roomName}>{room.name}</Text>
            <View>
              <Text style={styles.price}>{formatPrice(room.pricePerNight)}</Text>
              <Text style={styles.perNight}>/đêm</Text>
            </View>
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{room.maxGuests} khách</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="expand-outline" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{room.area} m²</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="bed-outline" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{room.bedType}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>{room.description}</Text>

          {/* Amenities */}
          <Text style={styles.sectionTitle}>Tiện nghi phòng</Text>
          <View style={styles.amenitiesWrap}>
            {room.amenities.map((a) => (
              <View key={a.id} style={styles.amenityBadge}>
                <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.primary} />
                <Text style={styles.amenityText}>{a.name}</Text>
              </View>
            ))}
          </View>

          {/* Date selection */}
          <Text style={styles.sectionTitle}>Chọn ngày</Text>
          <DateRangePicker value={dateRange} onChange={handleDateChange} />

          {/* Summary box — dùng totalRoomCharge nếu API đã trả, fallback tính tay */}
          {dateRange.checkIn && dateRange.checkOut && (
            <View style={styles.summaryBox}>
              {totalCharge !== null ? (
                <>
                  <Text style={styles.summaryText}>
                    Tổng tiền phòng:{' '}
                    <Text style={styles.summaryTotal}>{formatPrice(totalCharge)}</Text>
                  </Text>
                  {deposit !== null && (
                    <Text style={styles.summaryText}>
                      Đặt cọc:{' '}
                      <Text style={styles.summaryTotal}>{formatPrice(deposit)}</Text>
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.summaryText}>
                  {nights} đêm × {formatPrice(room.pricePerNight)} ={' '}
                  <Text style={styles.summaryTotal}>
                    {formatPrice(room.pricePerNight * nights)}
                  </Text>
                </Text>
              )}
            </View>
          )}

          {/* Availability result */}
          {available !== null && (
            <View
              style={[
                styles.availabilityBox,
                { backgroundColor: available ? '#D1FAE5' : '#FEE2E2' },
              ]}
            >
              <Ionicons
                name={available ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={available ? COLORS.success : COLORS.error}
              />
              <Text
                style={[
                  styles.availabilityText,
                  { color: available ? COLORS.success : COLORS.error },
                ]}
              >
                {availabilityMsg}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: SPACING.md + insets.bottom }]}>
        {!available || !dateRange.checkIn || !dateRange.checkOut ? (
          <Button
            title="Kiểm tra phòng trống"
            onPress={handleCheckAvailability}
            loading={checking}
            fullWidth
            size="lg"
            variant="primary"
          />
        ) : (
          <Button
            title="Đặt phòng ngay"
            onPress={handleBookNow}
            fullWidth
            size="lg"
            variant="secondary"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  imageContainer: { height: 280, position: 'relative' },
  image: { width, height: 280 },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageDots: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: COLORS.surface, width: 18 },
  content: { padding: SPACING.md },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  roomName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  price: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.secondary, textAlign: 'right' },
  perNight: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'right' },
  metaRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap', marginBottom: SPACING.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONTS.sizes.sm, color: COLORS.textLight },
  description: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textLight,
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF4FA',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  amenityText: { fontSize: FONTS.sizes.xs, color: COLORS.primary },
  summaryBox: {
    backgroundColor: '#FEF9EC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#F0D58C',
    gap: 4,
  },
  summaryText: { fontSize: FONTS.sizes.md, color: COLORS.text, textAlign: 'center' },
  summaryTotal: { fontWeight: FONTS.weights.bold, color: COLORS.secondary },
  availabilityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  availabilityText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, flex: 1 },
  bottomBar: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
