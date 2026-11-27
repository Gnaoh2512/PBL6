import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import { loyaltyService } from '../../services/loyaltyService';
import { bookingService } from '../../services/bookingService';
import { User } from '../../models/User';
import { LoyaltyProfile, LoyaltyBenefit, LoyaltyTransaction } from '../../models/Loyalty';
import { Booking } from '../../models/Booking';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import HeaderBackButton from '../../components/common/HeaderBackButton';
import LoyaltyCard from '../../components/loyalty/LoyaltyCard';
import { formatDateTime } from '../../utils/dateUtils';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, SPACING, RADIUS, HOTEL_INFO } from '../../utils/constants';

interface ProfileRowItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isStatus?: boolean;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const cachedUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState<boolean>(!cachedUser);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Loyalty State
  const [loyaltyProfile, setLoyaltyProfile] = useState<LoyaltyProfile | null>(null);
  const [loyaltyProfileLoading, setLoyaltyProfileLoading] = useState<boolean>(true);
  const [loyaltyProfileError, setLoyaltyProfileError] = useState<string | null>(null);
  const [isNotMember, setIsNotMember] = useState<boolean>(false);

  const [benefits, setBenefits] = useState<LoyaltyBenefit[]>([]);
  const [benefitsLoading, setBenefitsLoading] = useState<boolean>(true);
  const [benefitsError, setBenefitsError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  // Redeem state
  const [redeemModalVisible, setRedeemModalVisible] = useState(false);
  const [redeemBenefit, setRedeemBenefit] = useState<LoyaltyBenefit | null>(null);
  const [redeemBookings, setRedeemBookings] = useState<Booking[]>([]);
  const [redeemBookingsLoading, setRedeemBookingsLoading] = useState(false);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const idempotencyKeyRef = useRef<string>('');

  const fetchProfile = useCallback(async (isPull = false) => {
    if (isPull) {
      setRefreshing(true);
    }
    setErrorMessage(null);

    try {
      const data = await authService.getMe();
      setProfile(data);
      setUser(data);
    } catch (err: any) {
      // 401 is handled by apiClient interceptor (auto-logout), skip error display
      if (err?.response?.status === 401) {
        console.log('[ProfileScreen] Token expired, logging out...');
        return;
      }
      console.warn('[ProfileScreen] fetch error:', err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể tải thông tin tài khoản.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser]);

  const fetchLoyaltyProfile = useCallback(async () => {
    setLoyaltyProfileLoading(true);
    setLoyaltyProfileError(null);
    setIsNotMember(false);
    try {
      const data = await loyaltyService.getProfile();
      setLoyaltyProfile(data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        console.log('[ProfileScreen] fetchLoyaltyProfile: token expired');
        return;
      }
      console.log('[ProfileScreen] fetchLoyaltyProfile error:', err);
      if (err?.response?.status === 404) {
        setIsNotMember(true);
        setLoyaltyProfile(null);
      } else {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Không thể tải thông tin hội viên.';
        setLoyaltyProfileError(msg);
      }
    } finally {
      setLoyaltyProfileLoading(false);
    }
  }, []);

  const fetchLoyaltyBenefits = useCallback(async () => {
    setBenefitsLoading(true);
    setBenefitsError(null);
    try {
      const data = await loyaltyService.getBenefits();
      setBenefits(data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        console.log('[ProfileScreen] fetchLoyaltyBenefits: token expired');
        return;
      }
      console.log('[ProfileScreen] fetchLoyaltyBenefits error:', err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể tải danh sách ưu đãi.';
      setBenefitsError(msg);
    } finally {
      setBenefitsLoading(false);
    }
  }, []);

  const fetchLoyaltyTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const data = await loyaltyService.getTransactions();
      setTransactions(data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        console.log('[ProfileScreen] fetchLoyaltyTransactions: token expired');
        return;
      }
      console.log('[ProfileScreen] fetchLoyaltyTransactions error:', err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể tải lịch sử tích điểm.';
      setTransactionsError(msg);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async (isPull = false) => {
    if (isPull) {
      setRefreshing(true);
    }
    await Promise.allSettled([
      fetchProfile(isPull),
      fetchLoyaltyProfile(),
      fetchLoyaltyBenefits(),
      fetchLoyaltyTransactions(),
    ]);
    if (isPull) {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchLoyaltyProfile, fetchLoyaltyBenefits, fetchLoyaltyTransactions]);

  // ────── Redeem benefit flow ──────
  const canRedeem = (b: LoyaltyBenefit): boolean => {
    if (b.isActive === false) return false;
    if (b.benefitType && b.benefitType.toUpperCase() !== 'FREE_SERVICE') return false;
    if (b.quota != null && (b.remainingQuota == null || b.remainingQuota <= 0)) return false;
    return true;
  };

  const fetchEligibleBookings = useCallback(async () => {
    setRedeemBookingsLoading(true);
    try {
      const all = await bookingService.getMyBookings();
      const eligible = all.filter((bk) => (bk.status || '').toUpperCase() === 'CHECKED_IN');
      setRedeemBookings(eligible);
      return eligible;
    } catch (err: any) {
      console.log('[ProfileScreen] fetchEligibleBookings error:', err);
      setRedeemBookings([]);
      return [];
    } finally {
      setRedeemBookingsLoading(false);
    }
  }, []);

  const handleOpenRedeem = useCallback(async (benefit: LoyaltyBenefit) => {
    setRedeemBenefit(benefit);
    idempotencyKeyRef.current = '';
    setRedeemModalVisible(true);
    await fetchEligibleBookings();
  }, [fetchEligibleBookings]);

  const executeRedeem = useCallback(async (benefit: LoyaltyBenefit, booking: Booking) => {
    setRedeemingId(benefit.tierBenefitId);
    try {
      const resp = await loyaltyService.redeemBenefit({
        tierBenefitId: benefit.tierBenefitId,
        bookingCode: booking.bookingCode || booking.id,
        idempotencyKey: idempotencyKeyRef.current,
      });
      // Update remainingQuota locally
      const updatedData = resp?.data || resp;
      if (updatedData?.remainingQuota != null) {
        setBenefits((prev) =>
          prev.map((b) =>
            b.tierBenefitId === benefit.tierBenefitId
              ? { ...b, remainingQuota: updatedData.remainingQuota }
              : b
          )
        );
      }
      idempotencyKeyRef.current = '';
      setRedeemModalVisible(false);
      const successMsg = 'Đã tạo yêu cầu dịch vụ miễn phí, nhân viên sẽ phục vụ tại phòng.';
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Thành công', successMsg);
      }
      // Reload loyalty + bookings in background
      await Promise.allSettled([
        fetchLoyaltyProfile(),
        fetchLoyaltyBenefits(),
        fetchLoyaltyTransactions(),
        fetchEligibleBookings(),
      ]);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể sử dụng đặc quyền.';
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Thông báo', errMsg);
      }
      // Reload loyalty benefits in background to keep quota in sync
      fetchLoyaltyBenefits();
    } finally {
      setRedeemingId(null);
    }
  }, [fetchLoyaltyProfile, fetchLoyaltyBenefits, fetchLoyaltyTransactions, fetchEligibleBookings]);

  const confirmRedeem = useCallback((benefit: LoyaltyBenefit, booking: Booking) => {
    const msg = `Sử dụng đặc quyền "${benefit.benefitName}" cho đơn ${booking.bookingCode || booking.id}?`;
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      executeRedeem(benefit, booking);
    } else {
      Alert.alert('Xác nhận sử dụng', msg, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', onPress: () => executeRedeem(benefit, booking) },
      ]);
    }
  }, [executeRedeem]);

  const handleSelectBooking = useCallback((booking: Booking, benefit: LoyaltyBenefit) => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    }
    confirmRedeem(benefit, booking);
  }, [confirmRedeem]);

  const handleCloseRedeemModal = useCallback(() => {
    if (redeemingId != null) return; // Don't close while redeeming
    setRedeemModalVisible(false);
    setRedeemBenefit(null);
    idempotencyKeyRef.current = '';
  }, [redeemingId]);

  const isSignedIn = Boolean(cachedUser);
  useEffect(() => {
    if (isSignedIn) refreshAll();
  }, [isSignedIn, refreshAll]);

  const handleCallHotel = () => {
    const cleanPhone = HOTEL_INFO.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      logout();
    } else {
      Alert.alert('Xác nhận đăng xuất', 'Bạn có chắc chắn muốn đăng xuất tài khoản?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
      ]);
    }
  };

  const formatRole = (role?: string) => {
    if (!role) return 'Chưa cập nhật';
    const r = role.toUpperCase();
    if (r === 'ROLE_CUSTOMER' || r === 'CUSTOMER') return 'Khách hàng';
    if (r === 'ROLE_ADMIN' || r === 'ADMIN') return 'Quản trị viên';
    return role;
  };

  const formatStatus = (status?: string) => {
    if (!status) return 'Chưa cập nhật';
    const s = status.toUpperCase();
    if (s === 'ACTIVE') return 'Đang hoạt động';
    return status;
  };

  const formatValue = (val?: any) => {
    if (val === undefined || val === null || val === '') return 'Chưa cập nhật';
    return String(val);
  };

  const formatPeriodType = (periodType?: string | null): string => {
    if (!periodType) return '';
    const pt = periodType.trim().toUpperCase();
    if (pt === 'DAY' || pt === 'DAILY') return 'mỗi ngày';
    if (pt === 'MONTH' || pt === 'MONTHLY') return 'mỗi tháng';
    if (pt === 'YEAR' || pt === 'YEARLY' || pt === 'ANNUAL') return 'mỗi năm';
    return periodType;
  };

  const formatBenefitQuota = (b: LoyaltyBenefit): string => {
    const periodText = formatPeriodType(b.periodType);
    if (b.remainingQuota != null) {
      const quotaPart = b.quota ? `/${b.quota}` : '';
      return `Còn lại: ${b.remainingQuota}${quotaPart} lượt${periodText ? ` (${periodText})` : ''}`;
    }
    if (b.quota != null) {
      return `Hạn mức: ${b.quota} lượt${periodText ? ` (${periodText})` : ''}`;
    }
    if (periodText) {
      return `Áp dụng ${periodText}`;
    }
    return '';
  };


  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    return parts[parts.length - 1].charAt(0).toUpperCase();
  };

  const profileRows: ProfileRowItem[] = [
    {
      icon: 'person-outline',
      label: 'Họ và tên',
      value: formatValue(profile?.fullName),
    },
    {
      icon: 'at-outline',
      label: 'Tên đăng nhập',
      value: formatValue(profile?.username),
    },
    {
      icon: 'mail-outline',
      label: 'Email',
      value: formatValue(profile?.email),
    },
    {
      icon: 'call-outline',
      label: 'Số điện thoại',
      value: formatValue(profile?.phone),
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Loại tài khoản',
      value: formatRole(profile?.role),
    },
    {
      icon: 'checkmark-circle-outline',
      label: 'Trạng thái',
      value: formatStatus(profile?.status),
      isStatus: true,
    },
    {
      icon: 'calendar-outline',
      label: 'Ngày tạo tài khoản',
      value: formatDateTime(profile?.createdAt),
    },
    {
      icon: 'time-outline',
      label: 'Đăng nhập gần nhất',
      value: formatDateTime(profile?.lastLogin),
    },
  ];

  if (!cachedUser) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
          <View style={styles.headerRow}>
            <HeaderBackButton style={styles.backBtn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Tài khoản</Text>
              <Text style={styles.headerSubtitle}>Đăng nhập để xem hồ sơ và quyền lợi hội viên</Text>
            </View>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <EmptyState
            icon="person-circle-outline"
            title="Chào mừng bạn"
            subtitle="Bạn có thể xem phòng và đặt phòng với tư cách khách. Đăng nhập để quản lý hồ sơ, lịch sử và điểm thưởng."
          />
          <View style={{ marginTop: SPACING.md }}>
            <Button title="Đăng nhập / Đăng ký" onPress={() => navigation.navigate('Auth')} size="md" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header cố định trên cùng */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <HeaderBackButton style={styles.backBtn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Tài khoản</Text>
            <Text style={styles.headerSubtitle}>Thông tin cá nhân khách hàng</Text>
          </View>
        </View>
      </View>

      {/* Trường hợp lỗi và chưa có dữ liệu cached */}
      {!profile && errorMessage && !loading ? (
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Tải thông tin thất bại"
            subtitle={errorMessage}
          />
          <View style={{ marginTop: SPACING.md }}>
            <Button
              title="Thử lại"
              onPress={() => {
                setLoading(true);
                fetchProfile();
              }}
              size="md"
            />
          </View>
        </View>
      ) : loading && !profile ? (
        <LoadingSpinner fullScreen message="Đang tải thông tin tài khoản..." />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 56 + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refreshAll(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Thông báo lỗi nếu có nhưng vẫn hiển thị dữ liệu cũ */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={16} color={COLORS.error} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => fetchProfile()}>
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Phần Avatar & Tên */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials(profile?.fullName)}</Text>
            </View>
            <Text style={styles.fullName}>{profile?.fullName || 'Khách hàng'}</Text>
            <Text style={styles.username}>@{profile?.username || 'khachhang'}</Text>
          </View>

          {/* Hạng hội viên */}
          <View style={styles.loyaltyContainer}>
            {loyaltyProfileLoading && !loyaltyProfile && !isNotMember && !loyaltyProfileError ? (
              <Card style={styles.loadingCard}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingCardText}>Đang tải thông tin hội viên...</Text>
              </Card>
            ) : isNotMember ? (
              <Card style={styles.notMemberCard}>
                <View style={styles.notMemberRow}>
                  <View style={styles.notMemberIconWrap}>
                    <Ionicons name="sparkles" size={22} color={COLORS.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notMemberTitle}>Hội viên Azure Bay</Text>
                    <Text style={styles.notMemberText}>
                      Bạn chưa là hội viên. Đặt phòng để bắt đầu tích điểm
                    </Text>
                  </View>
                </View>
              </Card>
            ) : loyaltyProfileError ? (
              <Card style={styles.sectionErrorCard}>
                <View style={styles.sectionErrorRow}>
                  <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
                  <Text style={styles.sectionErrorText}>{loyaltyProfileError}</Text>
                </View>
                <TouchableOpacity
                  style={styles.sectionRetryBtn}
                  onPress={() => fetchLoyaltyProfile()}
                >
                  <Text style={styles.sectionRetryText}>Thử lại</Text>
                </TouchableOpacity>
              </Card>
            ) : loyaltyProfile ? (
              <LoyaltyCard profile={loyaltyProfile} />
            ) : null}
          </View>

          {/* Mục Ưu đãi */}
          {!isNotMember && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="gift-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeaderTitle}>Ưu đãi của bạn</Text>
              </View>
              <Text style={styles.roomDiscountNoteText}>
                Ưu đãi giảm giá phòng theo hạng hội viên được tự động trừ trên hóa đơn.
              </Text>

              {benefitsLoading && benefits.length === 0 ? (
                <Card style={styles.loadingCard}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingCardText}>Đang tải danh sách ưu đãi...</Text>
                </Card>
              ) : benefitsError ? (
                <Card style={styles.sectionErrorCard}>
                  <View style={styles.sectionErrorRow}>
                    <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
                    <Text style={styles.sectionErrorText}>{benefitsError}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sectionRetryBtn}
                    onPress={() => fetchLoyaltyBenefits()}
                  >
                    <Text style={styles.sectionRetryText}>Thử lại</Text>
                  </TouchableOpacity>
                </Card>
              ) : benefits.length === 0 ? (
                <Card style={styles.emptyBoxCard}>
                  <Ionicons name="gift-outline" size={32} color={COLORS.textMuted} style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyBoxText}>Chưa có ưu đãi cho hạng này</Text>
                </Card>
              ) : (
                <Card style={styles.benefitsCard} padding={0}>
                  {benefits.map((b, idx) => {
                    const isLast = idx === benefits.length - 1;
                    const showRedeem = canRedeem(b);
                    const isRedeeming = redeemingId === b.tierBenefitId;
                    const quotaText = formatBenefitQuota(b);
                    return (
                      <View key={b.tierBenefitId || b.id || idx}>
                        <View style={styles.benefitItem}>
                          <View style={styles.benefitIconWrap}>
                            <Ionicons name="ribbon" size={18} color={COLORS.secondary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.benefitTitleRow}>
                              <Text style={styles.benefitName}>{b.benefitName}</Text>
                            </View>
                            {b.description ? (
                              <Text style={styles.benefitDesc}>{b.description}</Text>
                            ) : null}
                            {quotaText ? (
                              <Text style={styles.benefitQuota}>{quotaText}</Text>
                            ) : null}
                            {showRedeem && (
                              <TouchableOpacity
                                style={styles.redeemBtn}
                                onPress={() => handleOpenRedeem(b)}
                                disabled={isRedeeming || redeemingId != null}
                                activeOpacity={0.7}
                              >
                                {isRedeeming ? (
                                  <ActivityIndicator size="small" color={COLORS.surface} />
                                ) : (
                                  <>
                                    <Ionicons name="flash-outline" size={14} color={COLORS.surface} style={{ marginRight: 4 }} />
                                    <Text style={styles.redeemBtnText}>Sử dụng</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        {!isLast && <View style={styles.divider} />}
                      </View>
                    );
                  })}
                </Card>
              )}
            </View>
          )}

          {/* Mục Lịch sử tích điểm */}
          {!isNotMember && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeaderTitle}>Lịch sử tích điểm</Text>
              </View>

              {transactionsLoading && transactions.length === 0 ? (
                <Card style={styles.loadingCard}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingCardText}>Đang tải lịch sử tích điểm...</Text>
                </Card>
              ) : transactionsError ? (
                <Card style={styles.sectionErrorCard}>
                  <View style={styles.sectionErrorRow}>
                    <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
                    <Text style={styles.sectionErrorText}>{transactionsError}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sectionRetryBtn}
                    onPress={() => fetchLoyaltyTransactions()}
                  >
                    <Text style={styles.sectionRetryText}>Thử lại</Text>
                  </TouchableOpacity>
                </Card>
              ) : transactions.length === 0 ? (
                <Card style={styles.emptyBoxCard}>
                  <Ionicons name="receipt-outline" size={32} color={COLORS.textMuted} style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyBoxText}>Chưa có giao dịch</Text>
                </Card>
              ) : (
                <Card style={styles.transactionsCard} padding={0}>
                  {transactions.slice(0, 5).map((txn, idx) => {
                    const isLast = idx === Math.min(transactions.length, 5) - 1;
                    const isEarn = txn.txnType === 'EARN';
                    return (
                      <View key={txn.id || idx}>
                        <View style={styles.txnItem}>
                          <View
                            style={[
                              styles.txnIconWrap,
                              { backgroundColor: isEarn ? '#ECFDF5' : '#FEF3C7' },
                            ]}
                          >
                            <Ionicons
                              name={isEarn ? 'add-circle-outline' : 'swap-horizontal-outline'}
                              size={20}
                              color={isEarn ? COLORS.success : COLORS.warning}
                            />
                          </View>

                          <View style={{ flex: 1, marginRight: SPACING.sm }}>
                            <Text style={styles.txnTitle}>
                              {txn.note || (isEarn ? 'Tích điểm lưu trú' : 'Điều chỉnh điểm')}
                            </Text>
                            <Text style={styles.txnDate}>{formatDateTime(txn.createdAt)}</Text>
                            {(txn.stayDays || txn.amountSpent) ? (
                              <Text style={styles.txnSub}>
                                {txn.stayDays ? `${txn.stayDays} đêm` : ''}
                                {txn.stayDays && txn.amountSpent ? ' • ' : ''}
                                {txn.amountSpent ? formatPrice(txn.amountSpent) : ''}
                              </Text>
                            ) : null}
                          </View>

                          <View style={styles.txnScoreWrap}>
                            <Text
                              style={[
                                styles.txnScore,
                                { color: isEarn ? COLORS.success : COLORS.text },
                              ]}
                            >
                              {txn.scoreEarned > 0 ? `+${txn.scoreEarned}` : txn.scoreEarned}
                            </Text>
                            <Text style={styles.txnScoreUnit}>điểm</Text>
                          </View>
                        </View>
                        {!isLast && <View style={styles.divider} />}
                      </View>
                    );
                  })}
                </Card>
              )}
            </View>
          )}

          {/* Tiêu đề thông tin tài khoản */}
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionHeaderTitle}>Thông tin tài khoản</Text>
          </View>

          {/* Card thông tin chi tiết */}
          <Card style={styles.infoCard} padding={0}>
            {profileRows.map((row, index) => {
              const isLast = index === profileRows.length - 1;
              const isActiveStatus = row.isStatus && row.value === 'Đang hoạt động';

              return (
                <View key={row.label}>
                  <View style={styles.infoRow}>
                    <View style={styles.rowLabelContainer}>
                      <View style={styles.iconWrap}>
                        <Ionicons name={row.icon} size={18} color={COLORS.primary} />
                      </View>
                      <Text style={styles.rowLabel}>{row.label}</Text>
                    </View>

                    <View style={styles.rowValueContainer}>
                      {isActiveStatus ? (
                        <View style={styles.statusBadge}>
                          <View style={styles.statusDot} />
                          <Text style={styles.statusBadgeText}>{row.value}</Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.rowValue,
                            row.value === 'Chưa cập nhật' && styles.rowValueMuted,
                          ]}
                          numberOfLines={2}
                        >
                          {row.value}
                        </Text>
                      )}
                    </View>
                  </View>
                  {!isLast && <View style={styles.divider} />}
                </View>
              );
            })}
          </Card>

          {/* Dòng liên hệ thay đổi thông tin */}
          <View style={styles.contactSupportBox}>
            <Text style={styles.contactSupportText}>
              Cần thay đổi thông tin? Vui lòng liên hệ khách sạn:
            </Text>
            <TouchableOpacity style={styles.phoneLink} onPress={handleCallHotel} activeOpacity={0.7}>
              <Ionicons name="call" size={13} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.phoneLinkText}>{HOTEL_INFO.phone}</Text>
            </TouchableOpacity>
          </View>

          {/* Nút đăng xuất */}
          <View style={styles.logoutContainer}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} style={{ marginRight: 6 }} />
              <Text style={styles.logoutButtonText}>Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── Redeem Bottom Sheet Modal ── */}
      <Modal
        visible={redeemModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseRedeemModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseRedeemModal}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modalSheet,
              {
                paddingBottom: Platform.OS === 'android'
                  ? Math.max(insets.bottom, 48)
                  : Math.max(insets.bottom, 16),
              },
            ]}
            onPress={() => {}} // prevent close on sheet tap
          >
            {/* Handle bar */}
            <View style={styles.modalHandleBar} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn đơn đặt phòng</Text>
              <TouchableOpacity onPress={handleCloseRedeemModal} disabled={redeemingId != null}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {redeemBenefit && (
              <View style={styles.modalBenefitInfo}>
                <Ionicons name="ribbon" size={16} color={COLORS.secondary} style={{ marginRight: 6 }} />
                <Text style={styles.modalBenefitName} numberOfLines={1}>
                  {redeemBenefit.benefitName}
                </Text>
              </View>
            )}

            {/* Content */}
            {redeemBookingsLoading ? (
              <View style={styles.modalLoadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.modalLoadingText}>Đang tải đơn đặt phòng...</Text>
              </View>
            ) : redeemBookings.length === 0 ? (
              <View style={styles.modalEmptyWrap}>
                <Ionicons name="bed-outline" size={40} color={COLORS.textMuted} />
                <Text style={styles.modalEmptyText}>
                  Chỉ dùng được khi bạn đang lưu trú (đã nhận phòng)
                </Text>
              </View>
            ) : (
              <FlatList
                data={redeemBookings}
                keyExtractor={(item) => item.bookingCode || item.id}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.bookingItem}
                    onPress={() => redeemBenefit && handleSelectBooking(item, redeemBenefit)}
                    disabled={redeemingId != null}
                    activeOpacity={0.7}
                  >
                    <View style={styles.bookingItemLeft}>
                      <View style={styles.bookingCodeRow}>
                        <Text style={styles.bookingCode}>{item.bookingCode || item.id}</Text>
                        <View style={[
                          styles.bookingStatusBadge,
                          { backgroundColor: '#ECFDF5' },
                        ]}>
                          <Text style={[
                            styles.bookingStatusText,
                            { color: '#065F46' },
                          ]}>
                            Đang ở
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.bookingRoom}>{item.roomName || item.roomType}</Text>
                      <Text style={styles.bookingDate}>
                        {formatDateTime(item.checkInDate)} – {formatDateTime(item.checkOutDate)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: SPACING.xs,
    marginLeft: -SPACING.xs,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.surface,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: 6,
  },
  errorBannerText: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: COLORS.error,
  },
  retryText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: FONTS.weights.bold,
    color: '#fff',
  },
  fullName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  username: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  infoCard: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  rowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  rowLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
  },
  rowValueContainer: {
    flex: 1.4,
    alignItems: 'flex-end',
  },
  rowValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    textAlign: 'right',
  },
  rowValueMuted: {
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.regular,
    fontStyle: 'italic',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: '#065F46',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginLeft: 54,
  },
  contactSupportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  contactSupportText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  phoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneLinkText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
    textDecorationLine: 'underline',
  },
  logoutContainer: {
    marginBottom: SPACING.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
  },
  logoutButtonText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  loyaltyContainer: {
    marginBottom: SPACING.md,
  },
  sectionWrap: {
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  loadingCardText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
  },
  notMemberCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    padding: SPACING.md,
  },
  notMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  notMemberIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notMemberTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryDark,
    marginBottom: 2,
  },
  notMemberText: {
    fontSize: FONTS.sizes.xs,
    color: '#0369A1',
    lineHeight: 18,
  },
  sectionErrorCard: {
    padding: SPACING.md,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    alignItems: 'center',
  },
  sectionErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  sectionErrorText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.error,
    textAlign: 'center',
  },
  sectionRetryBtn: {
    marginTop: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionRetryText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
  },
  emptyBoxCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  emptyBoxText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  roomDiscountNoteText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
    lineHeight: 18,
  },
  benefitsGroupsContainer: {
    gap: SPACING.md,
  },
  benefitGroupWrap: {
    gap: SPACING.xs,
  },
  subGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  subGroupTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryDark,
  },
  autoApplyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    marginTop: 6,
  },
  autoApplyBadgeText: {
    fontSize: FONTS.sizes.xs - 1,
    fontWeight: FONTS.weights.semiBold,
    color: '#047857',
  },
  benefitsCard: {
    backgroundColor: COLORS.surface,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  benefitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  benefitName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    flex: 1,
  },
  discountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginLeft: 6,
  },
  discountBadgeText: {
    fontSize: FONTS.sizes.xs - 1,
    fontWeight: FONTS.weights.bold,
    color: '#15803D',
  },
  benefitDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginTop: 2,
    lineHeight: 16,
  },
  benefitQuota: {
    fontSize: FONTS.sizes.xs - 1,
    color: COLORS.secondary,
    fontWeight: FONTS.weights.medium,
    marginTop: 4,
  },
  transactionsCard: {
    backgroundColor: COLORS.surface,
  },
  txnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  txnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  txnTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  txnDate: {
    fontSize: FONTS.sizes.xs - 1,
    color: COLORS.textMuted,
  },
  txnSub: {
    fontSize: FONTS.sizes.xs - 1,
    color: COLORS.textLight,
    marginTop: 2,
  },
  txnScoreWrap: {
    alignItems: 'flex-end',
  },
  txnScore: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  txnScoreUnit: {
    fontSize: FONTS.sizes.xs - 1,
    color: COLORS.textMuted,
  },
  // ── Redeem button ──
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  redeemBtnText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.surface,
  },
  // ── Modal styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '75%',
    paddingHorizontal: SPACING.md,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  modalBenefitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  modalBenefitName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    flex: 1,
  },
  modalLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  modalLoadingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
  },
  modalEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  modalEmptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalList: {
    flexGrow: 0,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  bookingItemLeft: {
    flex: 1,
  },
  bookingCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  bookingCode: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  bookingStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  bookingStatusText: {
    fontSize: FONTS.sizes.xs - 1,
    fontWeight: FONTS.weights.semiBold,
  },
  bookingRoom: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    marginBottom: 2,
  },
  bookingDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  serviceName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  serviceDetail: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
  },
  modalConfirmBtn: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  modalConfirmBtnText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.surface,
  },
  backToBookingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  backToBookingsText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.medium,
  },
  skipServiceFooterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
  },
  skipServiceFooterText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
});
