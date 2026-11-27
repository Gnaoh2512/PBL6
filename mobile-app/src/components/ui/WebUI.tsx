// RN equivalents of the web design-system classes (.hc-btn, .hc-card, .hc-input, .hc-label ...)
// using the mobile (<=560px) overrides from mobile.css (inputs 14px / min-height 38+, buttons min-height 42).
import React from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput, TextInputProps, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../common/AppText';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/constants';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'dangerOutline';
type Size = 'sm' | 'md' | 'lg';

export function WButton({
  title, onPress, variant = 'primary', size = 'md', icon, iconRight, loading, disabled, fullWidth = true, style, textStyle,
}: {
  title: string; onPress?: () => void; variant?: Variant; size?: Size;
  icon?: keyof typeof Ionicons.glyphMap; iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean; disabled?: boolean; fullWidth?: boolean;
  style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
}) {
  const fg = variant === 'primary' || variant === 'danger' ? '#fff'
    : variant === 'dangerOutline' ? COLORS.error : variant === 'ghost' ? COLORS.textLight : COLORS.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        s.btn, s[`size_${size}` as const], s[variant],
        fullWidth && { alignSelf: 'stretch' }, (disabled || loading) && { opacity: 0.55 }, style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 14 : 16} color={fg} /> : null}
          <AppText style={[{ color: fg, fontFamily: FONTS.family.bodySemiBold, fontSize: size === 'lg' ? FONTS.sizes.md : size === 'sm' ? FONTS.sizes.xs : FONTS.sizes.sm }, textStyle]}>{title}</AppText>
          {iconRight ? <Ionicons name={iconRight} size={size === 'sm' ? 14 : 16} color={fg} /> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

export function WCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function WCardHeader({ icon, title, right }: { icon?: keyof typeof Ionicons.glyphMap; title: string; right?: React.ReactNode }) {
  return (
    <View style={s.cardHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
        {icon ? <Ionicons name={icon} size={18} color={COLORS.primary} style={{ marginRight: 8 }} /> : null}
        <AppText style={s.cardTitle}>{title}</AppText>
      </View>
      {right}
    </View>
  );
}
export const WCardBody = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[{ padding: 16 }, style]}>{children}</View>;

export function WLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <AppText style={s.label}>{children}{required ? <AppText style={{ color: COLORS.error }}> *</AppText> : null}</AppText>
  );
}

export function WInput({ label, required, error, multiline, style, ...rest }: TextInputProps & { label?: string; required?: boolean; error?: string | null }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={{ marginBottom: SPACING.md - 0 }}>
      {label ? <WLabel required={required}>{label}</WLabel> : null}
      <TextInput
        placeholderTextColor={COLORS.textMuted}
        {...rest}
        multiline={multiline}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        style={[s.input, multiline && { minHeight: 64, textAlignVertical: 'top', paddingTop: 10 }, focus && s.inputFocus, !!error && { borderColor: COLORS.error }, style]}
      />
      {error ? <AppText style={{ color: COLORS.error, fontSize: FONTS.sizes.xs, marginTop: 4 }}>{error}</AppText> : null}
    </View>
  );
}

export function EmptyBox({ icon, children }: { icon?: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <WCard style={{ paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center' }}>
      {icon ? <Ionicons name={icon} size={48} color={COLORS.textMuted} style={{ opacity: 0.3, marginBottom: 16 }} /> : null}
      {typeof children === 'string' ? <AppText style={{ color: COLORS.textMuted, textAlign: 'center' }}>{children}</AppText> : children}
    </WCard>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: 'transparent', minHeight: 42 },
  size_sm: { paddingVertical: 6, paddingHorizontal: 14 },
  size_md: { paddingVertical: 10, paddingHorizontal: 20 },
  size_lg: { paddingVertical: 14, paddingHorizontal: 28 },
  primary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  outline: { backgroundColor: 'transparent', borderColor: COLORS.primary },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  dangerOutline: { backgroundColor: 'transparent', borderColor: COLORS.error },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cardHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  cardTitle: { fontFamily: FONTS.family.headingSemiBold, fontSize: FONTS.sizes.lg, color: COLORS.text },
  label: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.family.bodySemiBold, color: COLORS.text, marginBottom: 6 },
  input: { minHeight: 42, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, fontFamily: FONTS.family.body, color: COLORS.text, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.sm },
  inputFocus: { borderColor: COLORS.primary },
});
