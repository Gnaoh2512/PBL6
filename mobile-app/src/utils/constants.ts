export const COLORS = {
  primary: '#296C7A',
  primaryLight: '#8DD7E7',
  primaryDark: '#1D5360',
  primarySubtle: '#E7F7FA',
  secondary: '#FFE6BF',
  secondaryLight: '#FFF0D8',
  secondaryDark: '#8A6840',
  accent: '#8DD7E7',
  accentLight: '#B8EAF3',
  background: '#F5FFFF',
  backgroundAlt: '#E3DAC8',
  surface: '#FFFFFF',
  surfaceHover: '#F2FBFC',
  text: '#19343B',
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#19343B',
  textLight: '#52676D',
  textMuted: '#718287',
  success: '#2D8A4E',
  successBackground: '#E8F5EF',
  warning: '#D4920A',
  warningBackground: '#FEF7E8',
  error: '#C0392B',
  errorBackground: '#FDECEA',
  info: '#296C7A',
  infoBackground: '#E7F7FA',
  border: '#D5E3E5',
  borderLight: '#E7EFF0',
  divider: '#E7EFF0',
  overlay: 'rgba(0,0,0,0.4)',
};

export const FONTS = {
  family: {
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
    heading: 'PlayfairDisplay_500Medium',
    headingSemiBold: 'PlayfairDisplay_600SemiBold',
    headingBold: 'PlayfairDisplay_700Bold',
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    display: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 2,
  md: 2,
  lg: 2,
  xl: 2,
  xxl: 2,
  full: 9999,
  round: 9999,
};

export const STATUS_COLORS = {
  pending: { color: COLORS.warning, bg: COLORS.warningBackground },
  success: { color: COLORS.success, bg: COLORS.successBackground },
  info: { color: COLORS.info, bg: COLORS.infoBackground },
  neutral: { color: COLORS.textMuted, bg: COLORS.surfaceHover },
  error: { color: COLORS.error, bg: COLORS.errorBackground },
};

export const TAX_RATE = 0.1;

export const HOTEL_INFO = {
  name: 'Azure Bay Hotel',
  tagline: 'Where Luxury Meets the Sea',
  address: '123 Coastal Boulevard, Đà Nẵng, Việt Nam',
  phone: '+84 236 123 4567',
  email: 'info@azurebayhotel.com',
  website: 'www.azurebayhotel.com',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  description:
    'Azure Bay Hotel là điểm đến sang trọng bậc nhất bên bờ biển Đà Nẵng. Với tầm nhìn toàn cảnh vịnh biển xanh ngọc, chúng tôi mang đến trải nghiệm nghỉ dưỡng hoàn hảo kết hợp giữa kiến trúc hiện đại và văn hóa Việt Nam đặc sắc.',
  latitude: 16.0544,
  longitude: 108.2022,
};
