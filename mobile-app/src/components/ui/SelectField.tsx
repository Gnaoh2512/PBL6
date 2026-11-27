// Native port of web SelectMenu.jsx (listbox with check mark on the selected option, 44px rows on mobile)
import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../common/AppText';
import { COLORS, FONTS, RADIUS } from '../../utils/constants';

export interface Option { value: string; label: string }

export default function SelectField({
  value, onChange, options, ariaLabel = 'Chọn', icon = 'people-outline', variant = 'input',
}: {
  value: string; onChange: (v: string) => void; options: Option[]; ariaLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap; variant?: 'input' | 'plain';
}) {
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.value) === String(value));
  const label = current ? current.label : String(value ?? '');
  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${ariaLabel}: ${label}`}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={variant === 'input' ? s.trigger : s.triggerPlain}
      >
        {variant === 'input' && <Ionicons name={icon} size={15} color={COLORS.primary} />}
        <AppText numberOfLines={1} style={variant === 'input' ? s.text : s.textPlain}>{label}</AppText>
        <Ionicons name="chevron-down" size={variant === 'input' ? 12 : 11} color={variant === 'input' ? COLORS.textMuted : COLORS.primary} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={[s.pop, { width: Math.min(320, width - 32), maxHeight: height * 0.6 }]}>
            <ScrollView>
              {options.map((o) => {
                const sel = String(o.value) === String(value);
                return (
                  <TouchableOpacity key={o.value} role="option" accessibilityState={{ selected: sel }} style={[s.option, sel && { backgroundColor: 'rgba(25,82,95,0.06)' }]} onPress={() => { onChange(String(o.value)); setOpen(false); }}>
                    <AppText style={[s.optText, sel && { color: COLORS.primary, fontFamily: FONTS.family.bodySemiBold }]}>{o.label}</AppText>
                    {sel && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
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
  pop: { backgroundColor: '#fff', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(25,82,95,0.14)', paddingVertical: 6, elevation: 12, shadowColor: '#123139', shadowOpacity: 0.2, shadowRadius: 27, shadowOffset: { width: 0, height: 22 } },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  optText: { fontSize: 14, color: COLORS.text },
});
