// Native port of web DatePicker.jsx: Monday-first calendar, "Tháng M, YYYY", Hôm nay / Đóng footer.
import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../common/AppText';
import { COLORS, FONTS, RADIUS } from '../../utils/constants';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad = (n: number) => String(n).padStart(2, '0');
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISODate = (v?: string | null) => {
  if (!v) return null;
  const [y, m, d] = String(v).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
export const todayISO = () => toISODate(new Date());
export const addDaysISO = (v: string, days: number) => {
  const d = parseISODate(v) || new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
};
export const formatDisplayDate = (v?: string | null) => {
  const d = parseISODate(v);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

interface Props {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  ariaLabel?: string;
  placeholder?: string;
  /** 'input' = bordered .hc-input trigger, 'plain' = bare text (home booking bar) */
  variant?: 'input' | 'plain';
  showChevron?: boolean;
}

export default function DateField({ value, onChange, min, max, ariaLabel = 'Chọn ngày', placeholder = 'Chọn ngày', variant = 'input', showChevron }: Props) {
  const { width } = useWindowDimensions();
  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);
  const selected = parseISODate(value);
  const today = parseISODate(todayISO())!;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfMonth(selected || minDate || today));

  const openPicker = () => { setView(startOfMonth(parseISODate(value) || minDate || today)); setOpen(true); };
  const isDisabled = (d: Date) => Boolean((minDate && d < minDate) || (maxDate && d > maxDate));
  const year = view.getFullYear();
  const month = view.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month, 1 - offset + i);
    return { date, iso: toISODate(date), inMonth: date.getMonth() === month, disabled: isDisabled(date) };
  });
  const selectedIso = selected ? toISODate(selected) : null;
  const todayIso = toISODate(today);
  const prevDisabled = Boolean(minDate && new Date(year, month, 0) < minDate);
  const nextDisabled = Boolean(maxDate && new Date(year, month + 1, 1) > maxDate);
  const pick = (iso: string) => { onChange(iso); setOpen(false); };
  const display = formatDisplayDate(value);
  const calW = Math.min(304, width - 24);
  const cellW = (calW - 28) / 7;

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={display ? `${ariaLabel}: ${display}` : ariaLabel}
        onPress={openPicker}
        activeOpacity={0.8}
        style={variant === 'input' ? s.trigger : s.triggerPlain}
      >
        {variant === 'input' && <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />}
        <AppText numberOfLines={1} style={[variant === 'input' ? s.text : s.textPlain, !display && { color: COLORS.textMuted }]}>{display || placeholder}</AppText>
        {(variant === 'input' || showChevron) && <Ionicons name="chevron-down" size={12} color={COLORS.textMuted} />}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[s.pop, { width: calW }]} onPress={() => {}}>
            <View style={s.head}>
              <TouchableOpacity style={[s.nav, prevDisabled && { opacity: 0.28 }]} disabled={prevDisabled} onPress={() => setView(new Date(year, month - 1, 1))} accessibilityLabel="Tháng trước">
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <AppText style={s.title}>Tháng {month + 1}, {year}</AppText>
              <TouchableOpacity style={[s.nav, nextDisabled && { opacity: 0.28 }]} disabled={nextDisabled} onPress={() => setView(new Date(year, month + 1, 1))} accessibilityLabel="Tháng sau">
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={s.weekdays}>
              {WEEKDAYS.map((d) => <AppText key={d} style={[s.weekday, { width: cellW }]}>{d}</AppText>)}
            </View>
            <View style={s.grid}>
              {cells.map((c) => {
                const isSel = c.iso === selectedIso;
                const isToday = c.iso === todayIso;
                return (
                  <TouchableOpacity
                    key={c.iso}
                    disabled={c.disabled}
                    onPress={() => pick(c.iso)}
                    accessibilityLabel={formatDisplayDate(c.iso)}
                    style={{ width: cellW, height: Math.min(cellW, 40), alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={[s.day, isToday && !isSel && s.dayToday, isSel && s.daySel]}>
                      <AppText style={[s.dayText, !c.inMonth && { color: '#a9b5b8' }, isToday && { color: COLORS.primary, fontFamily: FONTS.family.bodyBold }, isSel && { color: '#fff', fontFamily: FONTS.family.bodySemiBold }, c.disabled && { color: '#c9d1d3' }]}>{c.date.getDate()}</AppText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.foot}>
              <TouchableOpacity disabled={isDisabled(today)} onPress={() => pick(todayISO())} style={[s.footBtn, isDisabled(today) && { opacity: 0.4 }]}>
                <AppText style={s.footText}>Hôm nay</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)} style={s.footBtn}>
                <AppText style={[s.footText, { color: COLORS.textMuted }]}>Đóng</AppText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.sm },
  triggerPlain: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6, minHeight: 24 },
  text: { flex: 1, fontSize: 14, color: COLORS.text },
  textPlain: { flex: 1, fontSize: 13, fontFamily: FONTS.family.bodyMedium, color: COLORS.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,38,45,0.35)', alignItems: 'center', justifyContent: 'center' },
  pop: { backgroundColor: '#fff', padding: 14, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(25,82,95,0.14)', shadowColor: '#123139', shadowOpacity: 0.2, shadowRadius: 27, shadowOffset: { width: 0, height: 22 }, elevation: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: COLORS.primary, fontFamily: FONTS.family.heading, fontSize: 17 },
  nav: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', marginBottom: 6 },
  weekday: { color: COLORS.textMuted, fontSize: 10, fontFamily: FONTS.family.bodyBold, letterSpacing: 1.2, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1, borderColor: 'rgba(25,82,95,0.4)' },
  daySel: { backgroundColor: COLORS.primary },
  dayText: { fontSize: 13, color: COLORS.text },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 8 },
  footBtn: { paddingVertical: 8, paddingHorizontal: 10, minHeight: 40, justifyContent: 'center' },
  footText: { fontSize: 13, fontFamily: FONTS.family.bodySemiBold, color: COLORS.primary },
});
