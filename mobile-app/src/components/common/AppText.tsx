import React from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  TextInputProps,
  TextProps,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS } from '../../utils/constants';

function resolveFontFamily(style: TextProps['style']): string {
  const flattened = StyleSheet.flatten(style);
  if (flattened?.fontFamily) return flattened.fontFamily;

  const fontSize = flattened?.fontSize ?? FONTS.sizes.md;
  const rawWeight = flattened?.fontWeight ?? FONTS.weights.regular;
  const weight = rawWeight === 'bold' ? 700 : rawWeight === 'normal' ? 400 : Number(rawWeight);
  if (fontSize >= FONTS.sizes.xl && weight >= 700) return FONTS.family.headingBold;
  if (fontSize >= FONTS.sizes.xl && weight >= 600) return FONTS.family.headingSemiBold;
  if (fontSize >= FONTS.sizes.xl && weight >= 500) return FONTS.family.heading;
  if (weight >= 700) return FONTS.family.bodyBold;
  if (weight >= 600) return FONTS.family.bodySemiBold;
  if (weight >= 500) return FONTS.family.bodyMedium;
  return FONTS.family.body;
}

export function AppText({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ color: COLORS.text, fontFamily: resolveFontFamily(style) }, style]} />;
}

export function AppTextInput({ style, ...props }: TextInputProps) {
  return (
    <NativeTextInput
      {...props}
      style={[{ color: COLORS.text, fontFamily: FONTS.family.body, fontSize: FONTS.sizes.md }, style]}
    />
  );
}