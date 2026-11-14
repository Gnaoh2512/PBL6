import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoyaltyProfile } from '../../models/Loyalty';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';
import { formatPrice } from '../../utils/priceUtils';
import { formatDateTime } from '../../utils/dateUtils';

interface LoyaltyCardProps {
  profile: LoyaltyProfile;
  style?: ViewStyle;
}

interface TierTheme {
  cardBg: string;
  badgeBg: string;
  badgeText: string;
  progressFill: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TIER_THEMES: Record<string, TierTheme> = {
  SEASHELL: {
    cardBg: '#57534E', // be / xám đá ấm
    badgeBg: '#E7E5E4',
    badgeText: '#292524',
    progressFill: '#D6D3D1',
    icon: 'shield-outline',
  },
  STARFISH: {
    cardBg: '#C2410C', // cam biển
    badgeBg: '#FFEDD5',
    badgeText: '#9A3412',
    progressFill: '#FDBA74',
    icon: 'star-outline',
  },
  CORAL: {
    cardBg: '#BE123C', // hồng san hô
    badgeBg: '#FFE4E6',
    badgeText: '#9F1239',
    progressFill: '#FDA4AF',
    icon: 'heart-outline',
  },
  PEARL: {
    cardBg: '#6D28D9', // tím ngọc trai ánh bạc
    badgeBg: '#EDE9FE',
    badgeText: '#5B21B6',
    progressFill: '#C4B5FD',
    icon: 'diamond-outline',
  },
};

const getTierTheme = (tierCode?: string): TierTheme => {
  const code = (tierCode || '').toUpperCase().trim();
  return (
    TIER_THEMES[code] || {
      cardBg: COLORS.primary,
      badgeBg: '#FEF3C7',
      badgeText: '#92400E',
      progressFill: COLORS.secondary,
      icon: 'ribbon-outline',
    }
  );
};

export default function LoyaltyCard({ profile, style }: LoyaltyCardProps) {
  const theme = getTierTheme(profile.tierCode);

  // Điểm hiện tại (làm tròn 1 số lẻ)
  const current = Number(profile.currentScore) || 0;
  const currentScoreDisplay = (Math.round(current * 10) / 10).toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

  // Thanh tiến độ & điểm lên hạng tiếp theo
  const toNext =
    profile.pointsToNextTier != null ? Number(profile.pointsToNextTier) : null;
  const isHighestTier = !profile.nextTierCode || toNext == null || toNext <= 0;

  let ratio = 1;
  if (!isHighestTier && toNext != null) {
    const totalNeeded = current + toNext;
    ratio = totalNeeded > 0 ? Math.min(1, Math.max(0, current / totalNeeded)) : 0;
  }

  const progressPercent = Math.round(ratio * 100);

  const nextTierInfoText = isHighestTier
    ? 'Bạn đang ở hạng cao nhất'
    : `Còn ${(Math.round((toNext || 0) * 10) / 10).toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })} điểm nữa để lên hạng ${profile.nextTierName || profile.nextTierCode}`;

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg }, style]}>
      {/* Họa tiết trang trí mờ góc phải */}
      <View style={styles.decorCircle} />

      {/* Header của thẻ: Tên hạng lớn và Badge */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardSuperTitle}>HẠNG HỘI VIÊN</Text>
          <Text style={styles.tierName}>{profile.tierName || profile.tierCode}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
          <Ionicons name={theme.icon} size={14} color={theme.badgeText} style={{ marginRight: 4 }} />
          <Text style={[styles.badgeText, { color: theme.badgeText }]}>
            {profile.tierCode || 'MEMBER'}
          </Text>
        </View>
      </View>

      {/* Khối điểm hiện tại */}
      <View style={styles.scoreSection}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreValue}>{currentScoreDisplay}</Text>
          <Text style={styles.scoreUnit}>điểm</Text>
        </View>
        <Text style={styles.scoreLabel}>Điểm tích lũy hiện tại</Text>
      </View>

      {/* Thanh tiến độ lên hạng */}
      <View style={styles.progressSection}>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: theme.progressFill,
              },
            ]}
          />
        </View>
        <View style={styles.progressNoteRow}>
          <Ionicons
            name={isHighestTier ? 'checkmark-circle' : 'trending-up'}
            size={13}
            color="rgba(255, 255, 255, 0.9)"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.progressNoteText}>{nextTierInfoText}</Text>
        </View>
      </View>

      {/* Đường phân cách */}
      <View style={styles.divider} />

      {/* Thống kê: Số đêm, Tổng chi tiêu, Hội viên từ */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Đã ở</Text>
          <Text style={styles.statValue}>{profile.totalStayDays ?? 0} đêm</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={[styles.statCol, { flex: 1.3 }]}>
          <Text style={styles.statLabel}>Tổng chi tiêu</Text>
          <Text style={styles.statValue}>{formatPrice(profile.totalSpent ?? 0)}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Hội viên từ</Text>
          <Text style={styles.statValue}>
            {formatDateTime(profile.memberSince)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  decorCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  cardSuperTitle: {
    fontSize: FONTS.sizes.xs - 1,
    letterSpacing: 1.5,
    fontWeight: FONTS.weights.bold,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 2,
  },
  tierName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: '#FFFFFF',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },
  scoreSection: {
    marginBottom: SPACING.md,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreValue: {
    fontSize: FONTS.sizes.display || 32,
    fontWeight: FONTS.weights.bold,
    color: '#FFFFFF',
    lineHeight: 38,
  },
  scoreUnit: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  scoreLabel: {
    fontSize: FONTS.sizes.xs,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 2,
  },
  progressSection: {
    marginBottom: SPACING.md,
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressNoteText: {
    fontSize: FONTS.sizes.xs,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: FONTS.weights.medium,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    marginHorizontal: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs - 1,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  statValue: {
    fontSize: FONTS.sizes.xs + 1,
    fontWeight: FONTS.weights.bold,
    color: '#FFFFFF',
  },
});
