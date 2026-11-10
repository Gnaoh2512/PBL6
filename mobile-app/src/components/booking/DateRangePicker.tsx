import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { CalendarList, LocaleConfig, DateData } from 'react-native-calendars';
import { toApiDate, toShortDisplay, countNights } from '../../utils/dateUtils';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

// --- Việt hóa thư viện react-native-calendars ---
LocaleConfig.locales['vi'] = {
  monthNames: [
    'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
    'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12',
  ],
  monthNamesShort: [
    'Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6',
    'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12',
  ],
  dayNames: ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'],
  dayNamesShort: ['CN', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7'],
  today: 'Hôm nay',
};
LocaleConfig.defaultLocale = 'vi';

const PRIMARY = COLORS.primary;
const PRIMARY_LIGHT = '#D1E3F4';

export interface DateRangeValue {
  checkIn: string | null;   // "YYYY-MM-DD"
  checkOut: string | null;  // "YYYY-MM-DD"
}

interface Props {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}

/** Build marking object cho CalendarList (markingType="period") */
function buildMarkedDates(checkIn: string | null, checkOut: string | null) {
  const marks: Record<string, any> = {};
  if (!checkIn) return marks;

  marks[checkIn] = {
    startingDay: true,
    color: PRIMARY,
    textColor: '#fff',
    marked: false,
  };

  if (!checkOut) return marks;

  // Fill in-between days
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
  while (cur < end) {
    const key = toApiDate(cur);
    marks[key] = { color: PRIMARY_LIGHT, textColor: PRIMARY };
    cur.setDate(cur.getDate() + 1);
  }

  marks[checkOut] = {
    endingDay: true,
    color: PRIMARY,
    textColor: '#fff',
  };

  return marks;
}

const DAY_LABELS = ['Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'CN'];
const TODAY = toApiDate(new Date());

interface PickerBodyProps {
  initialCheckIn: string | null;
  initialCheckOut: string | null;
  hasSelection: boolean;
  onClose: () => void;
  onConfirm: (checkIn: string, checkOut: string) => void;
}

/**
 * PickerBody: Component riêng render bên trong <SafeAreaProvider style={{ flex: 1 }}>
 * Gọi useSafeAreaInsets() để nhận insets chuẩn của Modal window.
 */
function PickerBody({
  initialCheckIn,
  initialCheckOut,
  hasSelection,
  onClose,
  onConfirm,
}: PickerBodyProps) {
  const insets = useSafeAreaInsets();
  const [listHeight, setListHeight] = useState<number>(0);

  const [tempIn, setTempIn] = useState<string | null>(initialCheckIn);
  const [tempOut, setTempOut] = useState<string | null>(initialCheckOut);

  const handleDayPress = (day: DateData) => {
    const d = day.dateString;
    if (d < TODAY) return;

    if (!tempIn || (tempIn && tempOut)) {
      setTempIn(d);
      setTempOut(null);
    } else {
      if (d <= tempIn) {
        setTempIn(d);
        setTempOut(null);
      } else {
        setTempOut(d);
      }
    }
  };

  const markedDates = useMemo(
    () => buildMarkedDates(tempIn, tempOut),
    [tempIn, tempOut]
  );

  const nights = tempIn && tempOut ? countNights(tempIn, tempOut) : 0;
  const canConfirm = !!(tempIn && tempOut);

  const inLabel = tempIn ? toShortDisplay(tempIn) : 'Chọn ngày';
  const outLabel = tempOut ? toShortDisplay(tempOut) : 'Chọn ngày';

  const handleConfirm = () => {
    if (tempIn && tempOut) {
      onConfirm(tempIn, tempOut);
    }
  };

  const handleLayoutCalendar = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0 && Math.round(height) !== Math.round(listHeight)) {
      setListHeight(Math.round(height));
    }
  };

  const rawPadding = Math.max(insets.bottom, 16) + 8;
  const footerPaddingBottom =
    Platform.OS === 'android' && insets.bottom === 0
      ? Math.max(rawPadding, 48)
      : rawPadding;

  return (
    <View style={[styles.bodyContainer, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* 1. Tiêu đề + nút X (chiều cao cố định) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {hasSelection ? 'Sửa ngày' : 'Chọn ngày'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 2. Hai ô Nhận phòng / Trả phòng (cố định) */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, !tempOut && tempIn && styles.summaryBoxActive]}>
          <Text style={styles.summaryLabel}>Nhận phòng</Text>
          <Text style={styles.summaryValue}>{inLabel}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={COLORS.textMuted} />
        <View style={[styles.summaryBox, tempIn && !tempOut && styles.summaryBoxHint]}>
          <Text style={styles.summaryLabel}>Trả phòng</Text>
          <Text style={[styles.summaryValue, !tempOut && styles.summaryValueEmpty]}>{outLabel}</Text>
        </View>
      </View>

      {/* 3. Hàng thứ Th 2..CN (cố định) */}
      <View style={styles.dayNamesRow}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={styles.dayNameText}>{d}</Text>
        ))}
      </View>

      {/* 4. Vùng lịch: flex: 1, đo chiều cao onLayout và truyền vào CalendarList */}
      <View style={styles.calendarArea} onLayout={handleLayoutCalendar}>
        {listHeight > 0 && (
          <CalendarList
            style={{ height: listHeight }}
            horizontal={false}
            pastScrollRange={0}
            futureScrollRange={12}
            firstDay={1}
            hideArrows
            hideDayNames
            hideExtraDays
            minDate={TODAY}
            markingType="period"
            markedDates={markedDates}
            onDayPress={handleDayPress}
            calendarStyle={{ paddingHorizontal: 0 }}
            theme={{
              calendarBackground: '#fff',
              monthTextColor: PRIMARY,
              textMonthFontWeight: 'bold' as const,
              textMonthFontSize: 15,
              todayTextColor: COLORS.secondary,
              dayTextColor: COLORS.text,
              textDisabledColor: '#ccc',
              textDayFontSize: 14,
              'stylesheet.calendar.header': {
                monthText: {
                  margin: 10,
                  color: PRIMARY,
                  fontWeight: 'bold',
                  fontSize: 15,
                  textTransform: 'none',
                },
              },
            } as any}
            renderHeader={(date: any) => {
              const d = date instanceof Date ? date : new Date(date.toString());
              const month = d.getMonth();
              const year = d.getFullYear();
              const monthNames = [
                'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
                'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12',
              ];
              return (
                <View style={styles.monthHeader}>
                  <Text style={styles.monthHeaderText}>{monthNames[month]} {year}</Text>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* 5. Chân trang (đặt SAU vùng lịch, KHÔNG position:absolute) */}
      <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
        <TouchableOpacity
          style={[styles.okBtn, !canConfirm && styles.okBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          activeOpacity={0.8}
        >
          <Text style={styles.okBtnText}>
            {canConfirm ? `OK (${nights} đêm)` : 'Chọn đủ 2 ngày'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DateRangePicker({ value, onChange }: Props) {
  const [visible, setVisible] = useState(false);

  const openModal = () => setVisible(true);
  const closeModal = () => setVisible(false);

  const handleConfirm = (checkIn: string, checkOut: string) => {
    onChange({ checkIn, checkOut });
    setVisible(false);
  };

  const hasSelection = !!(value.checkIn && value.checkOut);

  return (
    <>
      {/* Trigger row — hiển thị 2 ô bấm */}
      <View style={styles.triggerRow}>
        <TouchableOpacity style={[styles.triggerBtn, value.checkIn && styles.triggerBtnFilled]} onPress={openModal}>
          <Ionicons name="enter-outline" size={16} color={value.checkIn ? PRIMARY : COLORS.textMuted} />
          <View>
            <Text style={styles.triggerLabel}>Nhận phòng</Text>
            <Text style={[styles.triggerValue, value.checkIn && styles.triggerValueFilled]}>
              {value.checkIn ? toShortDisplay(value.checkIn) : 'Chọn ngày'}
            </Text>
          </View>
        </TouchableOpacity>

        <Ionicons name="arrow-forward" size={18} color={COLORS.textMuted} style={{ marginHorizontal: 4 }} />

        <TouchableOpacity style={[styles.triggerBtn, value.checkOut && styles.triggerBtnFilled]} onPress={openModal}>
          <Ionicons name="exit-outline" size={16} color={value.checkOut ? PRIMARY : COLORS.textMuted} />
          <View>
            <Text style={styles.triggerLabel}>Trả phòng</Text>
            <Text style={[styles.triggerValue, value.checkOut && styles.triggerValueFilled]}>
              {value.checkOut ? toShortDisplay(value.checkOut) : 'Chọn ngày'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal lịch */}
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={closeModal}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <SafeAreaProvider style={{ flex: 1 }}>
          <PickerBody
            initialCheckIn={value.checkIn}
            initialCheckOut={value.checkOut}
            hasSelection={hasSelection}
            onClose={closeModal}
            onConfirm={handleConfirm}
          />
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Trigger
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  triggerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  triggerBtnFilled: {
    borderColor: COLORS.secondary,
  },
  triggerLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  triggerValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semiBold as any, color: COLORS.textMuted },
  triggerValueFilled: { color: COLORS.text },

  // Modal Body
  bodyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold as any, color: COLORS.text },

  // Summary
  summaryRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: '#fff',
  },
  summaryBox: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  summaryBoxActive: { borderColor: PRIMARY },
  summaryBoxHint: { borderColor: COLORS.border },
  summaryLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: 2 },
  summaryValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semiBold as any, color: COLORS.text },
  summaryValueEmpty: { color: COLORS.textMuted, fontWeight: 'normal' as any },

  // Day names header (fixed)
  dayNamesRow: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingHorizontal: 4,
  },
  dayNameText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600' as any,
    color: COLORS.textLight,
  },

  // Calendar container area
  calendarArea: {
    flex: 1,
    overflow: 'hidden',
  },

  // Month header
  monthHeader: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  monthHeaderText: {
    fontSize: 15,
    fontWeight: 'bold' as any,
    color: PRIMARY,
    textTransform: 'capitalize',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  okBtn: {
    backgroundColor: PRIMARY,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  okBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  okBtnText: {
    color: '#fff',
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold' as any,
  },
});
