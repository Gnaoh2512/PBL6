// Booking — 1:1 port of web BookingPage.jsx (mobile view: BookingPage.css @540/@640 + mobile.css section 10).
// Phase A: search card + available rooms; Phase B (after "Chọn phòng"): order summary + voucher + bill + guest form.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Image, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/common/AppText';
import PublicHeader from '../../components/layout/PublicHeader';
import DateField, { addDaysISO, parseISODate, todayISO } from '../../components/ui/DateField';
import SelectField from '../../components/ui/SelectField';
import { EmptyBox, WButton, WCard, WCardBody, WCardHeader, WInput, WLabel } from '../../components/ui/WebUI';
import { addToast } from '../../components/common/Toast';
import { roomService } from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import { voucherService, VoucherResult } from '../../services/voucherService';
import { useAuthStore } from '../../store/useAuthStore';
import { formatPrice } from '../../utils/priceUtils';
import { GUEST_OPTIONS, ID_TYPE_OPTIONS, getRoomVisual } from '../../data/webContent';
import { COLORS, FONTS, RADIUS } from '../../utils/constants';

const FALLBACK_COPY = 'Không gian nghỉ dưỡng được chuẩn bị cho kỳ lưu trú thoải mái.';
const roomPriceOf = (r: any) => Number(r?.pricePerNight ?? r?.roomType?.basePrice ?? r?.basePrice ?? 0);
const roomNameOf = (r: any) => r?.roomType?.typeName || r?.roomTypeName || `Phòng ${r?.roomNumber}`;
const roomCopyOf = (r: any) => r?.roomType?.description || r?.description || r?.roomType?.amenities || FALLBACK_COPY;
const roomTypeIdOf = (r: any) => String(r?.roomType?.roomTypeId || r?.roomTypeId || '');

export default function RoomsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const user = useAuthStore((st) => st.user);
  const p = (route.params || {}) as { checkIn?: string; checkOut?: string; guests?: string; roomTypeId?: string; roomId?: string; ts?: number };

  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState(p.roomId || '');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(p.roomTypeId || '');
  const [checkInDate, setCheckInDate] = useState(p.checkIn || todayISO());
  const [checkOutDate, setCheckOutDate] = useState(p.checkOut || addDaysISO(todayISO(), 1));
  const [guestCount, setGuestCount] = useState(p.guests || '2');

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [nationality, setNationality] = useState('Việt Nam');
  const [idType, setIdType] = useState('CCCD');
  const [idNumber, setIdNumber] = useState('');
  const [note, setNote] = useState('');

  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherResult | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // incoming navigation params (from Home search / room card) — equals the web query-string
  useEffect(() => {
    if (!route.params) return;
    if (p.checkIn) setCheckInDate(p.checkIn);
    if (p.checkOut) setCheckOutDate(p.checkOut);
    if (p.guests) setGuestCount(p.guests);
    setSelectedRoomTypeId(p.roomTypeId || '');
    setSelectedRoomId(p.roomId || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ts]);

  // keep guest info in sync when the user logs in
  useEffect(() => {
    if (user) {
      setFullName((v) => v || user.fullName || '');
      setPhone((v) => v || user.phone || '');
      setEmail((v) => v || user.email || '');
    }
  }, [user]);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const data = await roomService.getAvailableRooms(checkInDate, checkOutDate, 1);
      setAvailableRooms(data as any[]);
      setSelectedRoomId((current) => {
        if (p.roomId && data.some((r: any) => String(r.roomId) === String(p.roomId))) return p.roomId;
        return data.some((r: any) => String(r.roomId) === String(current)) ? current : '';
      });
    } catch {
      // silent fallback (same as web)
    } finally {
      setRoomsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInDate, checkOutDate, p.roomId]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const a = parseISODate(checkInDate)!, b = parseISODate(checkOutDate)!;
  const nights = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) || 1);
  const roomsForGuests = availableRooms.filter((r) => Number(r.roomType?.capacity || r.capacity || 10) >= Number(guestCount));
  const filteredRooms = selectedRoomTypeId ? roomsForGuests.filter((r) => roomTypeIdOf(r) === String(selectedRoomTypeId)) : roomsForGuests;
  const activeRoomTypeName =
    filteredRooms[0]?.roomType?.typeName ||
    availableRooms.find((r) => roomTypeIdOf(r) === String(selectedRoomTypeId))?.roomType?.typeName || '';
  const currentRoom = roomsForGuests.find((r) => String(r.roomId) === String(selectedRoomId));
  const pricePerNight = currentRoom ? roomPriceOf(currentRoom) : 0;
  const subtotal = pricePerNight * nights;
  const discountAmount = appliedVoucher ? appliedVoucher.discountAmount || 0 : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const depositRequired = Math.round(finalTotal * 0.3);
  const badRange = b <= a;

  const handleApplyVoucher = async () => {
    const clean = voucherCodeInput.trim().toUpperCase();
    if (!clean) { addToast('Vui lòng nhập mã voucher', 'warning'); return; }
    setVoucherLoading(true);
    try {
      const res = await voucherService.applyVoucher(clean, subtotal);
      setAppliedVoucher(res);
      addToast(`Áp dụng thành công voucher ${res.voucherCode || clean}! Giảm ${formatPrice(res.discountAmount || 0)}`, 'success');
    } catch (err: any) {
      setAppliedVoucher(null);
      addToast(err?.response?.data?.data?.message || err?.response?.data?.message || err?.message || 'Mã voucher không hợp lệ hoặc không đủ điều kiện áp dụng', 'error');
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleCheckInChange = (v: string) => {
    setSelectedRoomId('');
    setCheckInDate(v);
    if (!checkOutDate || checkOutDate <= v) setCheckOutDate(addDaysISO(v, 1));
  };

  const handleSubmitBooking = async () => {
    if (!selectedRoomId) { addToast('Vui lòng chọn phòng lưu trú!', 'warning'); return; }
    if (badRange) { addToast('Ngày trả phòng phải sau ngày nhận phòng!', 'error'); return; }
    if (!fullName.trim() || !phone.trim()) { addToast('Vui lòng điền họ tên và số điện thoại liên hệ!', 'warning'); return; }
    setSubmitting(true);
    try {
      const created = await bookingService.createBooking({
        userId: user?.id || 'guest',
        roomId: String(selectedRoomId),
        roomName: roomNameOf(currentRoom),
        roomType: roomNameOf(currentRoom),
        checkInDate: a,
        checkOutDate: b,
        nights,
        guests: parseInt(guestCount, 10),
        pricePerNight,
        totalPrice: finalTotal,
        guestInfo: {
          fullName: fullName.trim(), phone: phone.trim(), email: email.trim() || undefined,
          nationality: nationality || 'Việt Nam', idType, idNumber: idNumber.trim() || undefined,
        },
        specialRequests: note.trim() || undefined,
        voucherCode: appliedVoucher ? appliedVoucher.voucherCode || appliedVoucher.code : voucherCodeInput.trim().toUpperCase() || undefined,
      });
      addToast('Tạo đơn đặt phòng thành công! Vui lòng quét mã VietQR để cọc giữ chỗ.', 'success');
      nav.navigate('Payment', {
        bookingCode: created.bookingCode || created.id,
        qrInfo: created.qrInfo,
        depositRequired: created.depositRequired,
      });
    } catch (err: any) {
      addToast(err?.response?.data?.message || err?.message || 'Lỗi tạo đơn đặt phòng', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <PublicHeader variant="compact" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* title row */}
          <View style={s.titleRow}>
            <AppText style={s.h2}>Đặt Phòng Trực Tuyến</AppText>
            <AppText style={s.titleP}>Điền thông tin lưu trú và quét mã QR thanh toán tiền cọc 30% để xác nhận giữ chỗ an toàn</AppText>
            <View style={{ gap: 8, marginTop: 12 }}>
              {currentRoom && <WButton variant="outline" size="sm" icon="arrow-back" title="Chọn phòng khác" onPress={() => setSelectedRoomId('')} style={{ minHeight: 40 }} />}
              <WButton variant="outline" size="sm" icon="home-outline" title="Trở về trang chủ" onPress={() => nav.navigate('CustomerTabs', { screen: 'Home' })} style={{ minHeight: 40 }} />
            </View>
          </View>

          {/* search card */}
          <WCard style={{ marginBottom: 35 }}>
            <WCardBody style={{ padding: 24 }}>
              <View style={s.searchGrid}>
                <View style={s.half}><WLabel>Ngày nhận phòng</WLabel><DateField ariaLabel="Ngày nhận phòng" min={todayISO()} value={checkInDate} onChange={handleCheckInChange} /></View>
                <View style={s.half}>
                  <WLabel>Ngày trả phòng</WLabel>
                  <DateField ariaLabel="Ngày trả phòng" min={addDaysISO(checkInDate, 1)} value={checkOutDate} onChange={(v) => { setSelectedRoomId(''); setCheckOutDate(v); }} />
                </View>
                <View style={s.full}><WLabel>Số khách</WLabel><SelectField ariaLabel="Số khách" icon="people-outline" value={guestCount} onChange={setGuestCount} options={GUEST_OPTIONS} /></View>
                <View style={s.full}><WButton icon="search" title="Tìm phòng trống" onPress={loadRooms} disabled={roomsLoading || badRange} /></View>
              </View>
            </WCardBody>
          </WCard>

          {!currentRoom ? (
            <View>
              <View style={{ marginBottom: 18 }}>
                <AppText style={s.resultsH2}>{activeRoomTypeName ? `Hạng phòng: ${activeRoomTypeName}` : 'Chọn không gian lưu trú'}</AppText>
                <AppText style={s.resultsP}>{filteredRooms.length} phòng phù hợp với ngày ở và số khách đã chọn.</AppText>
                {!!selectedRoomTypeId && <WButton variant="outline" size="sm" icon="grid-outline" title="Xem tất cả hạng phòng" onPress={() => setSelectedRoomTypeId('')} style={{ marginTop: 12, alignSelf: 'flex-start' }} fullWidth={false} />}
              </View>
              {roomsLoading ? (
                <EmptyBox>Đang kiểm tra phòng trống…</EmptyBox>
              ) : filteredRooms.length === 0 ? (
                <EmptyBox icon="lock-closed-outline">
                  <AppText style={{ color: COLORS.textMuted, textAlign: 'center' }}>
                    {selectedRoomTypeId && roomsForGuests.length > 0 ? 'Hạng phòng bạn chọn hiện đã hết phòng trống trong ngày này.' : 'Không tìm thấy phòng phù hợp. Hãy đổi ngày hoặc số khách.'}
                  </AppText>
                  {!!selectedRoomTypeId && roomsForGuests.length > 0 && (
                    <WButton size="sm" title={`Xem tất cả ${roomsForGuests.length} phòng trống khác`} onPress={() => setSelectedRoomTypeId('')} style={{ marginTop: 12 }} fullWidth={false} />
                  )}
                </EmptyBox>
              ) : (
                <View style={{ gap: 18 }}>
                  {filteredRooms.map((room, index) => (
                    <View key={room.roomId} style={s.roomCard}>
                      <Image source={{ uri: getRoomVisual(room, index).image }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
                      <View style={{ padding: 18 }}>
                        {room.roomNumber ? <RoomNumber n={room.roomNumber} /> : <HeroBadge text="AZURE BAY" />}
                        <AppText style={s.cardH3}>{roomNameOf(room)}</AppText>
                        <AppText style={s.cardP}>{roomCopyOf(room)}</AppText>
                        <View style={s.facts}>
                          <Fact icon="people-outline" text={`Tối đa ${room.roomType?.capacity || room.capacity || '—'} khách`} />
                          <Fact icon="location-outline" text={`Tầng ${room.floor || '—'}`} />
                        </View>
                        <View style={s.roomFooter}>
                          <AppText style={s.priceStrong}>{formatPrice(roomPriceOf(room))} <AppText style={s.priceSmall}>/ đêm</AppText></AppText>
                          <WButton title="Chọn phòng" iconRight="arrow-forward" onPress={() => setSelectedRoomId(String(room.roomId))} fullWidth={false} />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={{ gap: 22 }}>
              {/* order summary first on mobile (grid-row 1), customer form second */}
              <View style={{ gap: 18 }}>
                <View style={s.roomCard}>
                  <Image source={{ uri: getRoomVisual(currentRoom).image }} style={{ width: '100%', height: 225 }} resizeMode="cover" />
                  <View style={{ paddingTop: 19, paddingHorizontal: 21, paddingBottom: 22 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <HeroBadge text="LỰA CHỌN CỦA BẠN" />
                      {!!currentRoom.roomNumber && <RoomNumber n={currentRoom.roomNumber} />}
                    </View>
                    <AppText style={[s.cardH3, { marginVertical: 7 }]}>{roomNameOf(currentRoom)}</AppText>
                    <AppText style={[s.cardP, { fontSize: 12, marginBottom: 14 }]}>{roomCopyOf(currentRoom)}</AppText>
                    <View style={s.facts}>
                      <Fact icon="people-outline" text={`${guestCount} khách`} />
                      <Fact icon="moon-outline" text={`${nights} đêm`} />
                    </View>
                    <AppText style={[s.priceStrong, { marginTop: 17 }]}>{formatPrice(pricePerNight)} <AppText style={s.priceSmall}>/ đêm</AppText></AppText>
                  </View>
                </View>

                <WCard style={{ marginBottom: 24 }}>
                  <WCardHeader icon="ticket-outline" title="Mã Ưu Đãi" />
                  <WCardBody style={{ padding: 23 }}>
                    <View style={{ gap: 8 }}>
                      <WInput value={voucherCodeInput} onChangeText={(t) => setVoucherCodeInput(t.toUpperCase())} placeholder="Nhập mã voucher (VD: WELCOME10)" autoCapitalize="characters" style={{ marginBottom: 0 }} />
                      <WButton variant="outline" title={voucherLoading ? 'Đang kiểm tra...' : 'Áp dụng'} onPress={handleApplyVoucher} disabled={voucherLoading} />
                    </View>
                    {appliedVoucher && (
                      <View style={s.voucherApplied}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                          <AppText style={s.voucherAppliedText}>{appliedVoucher.voucherName} (-{formatPrice(appliedVoucher.discountAmount)})</AppText>
                        </View>
                        <TouchableOpacity style={s.voucherRemove} onPress={() => { setAppliedVoucher(null); setVoucherCodeInput(''); }}>
                          <AppText style={{ color: COLORS.error, fontSize: FONTS.sizes.xs, fontFamily: FONTS.family.bodySemiBold }}>Hủy dùng</AppText>
                        </TouchableOpacity>
                      </View>
                    )}
                  </WCardBody>
                </WCard>

                <WCard>
                  <WCardHeader icon="receipt-outline" title="Tạm Tính Chi Phí" />
                  <WCardBody style={{ padding: 23 }}>
                    <BillRow label="Đơn giá phòng:" value={`${formatPrice(pricePerNight)} / đêm`} />
                    <BillRow label="Thời gian lưu trú:" value={`${nights} đêm`} bold />
                    <BillRow label="Tiền phòng gốc:" value={formatPrice(subtotal)} bold />
                    {discountAmount > 0 && <BillRow label="Giảm giá mã ưu đãi:" value={`- ${formatPrice(discountAmount)}`} bold color={COLORS.success} labelColor={COLORS.success} />}
                    <View style={{ height: 1, backgroundColor: COLORS.borderLight, marginVertical: 24 }} />
                    <View style={s.totalRow}>
                      <AppText style={s.totalLabel}>Tổng tiền phòng:</AppText>
                      <AppText style={s.totalValue}>{formatPrice(finalTotal)}</AppText>
                    </View>
                    <View style={s.depositBox}>
                      <AppText style={s.depositLabel}>Tiền cọc yêu cầu (30%):</AppText>
                      <AppText style={s.depositValue}>{formatPrice(depositRequired)}</AppText>
                      <AppText style={s.depositNote}>* Quý khách chỉ cần cọc trước 30%. Số tiền còn lại sẽ được thanh toán khi hoàn tất thủ tục check-out tại quầy lễ tân.</AppText>
                    </View>
                  </WCardBody>
                </WCard>
              </View>

              <WCard>
                <WCardHeader icon="person-outline" title="Thông Tin Khách Lưu Trú" />
                <WCardBody style={{ padding: 23 }}>
                  <View style={s.pair}>
                    <View style={s.half}><WInput label="Họ và tên khách" required placeholder="Nguyễn Văn A" value={fullName} onChangeText={setFullName} /></View>
                    <View style={s.half}><WInput label="Số điện thoại liên hệ" required placeholder="0912345678" keyboardType="phone-pad" value={phone} onChangeText={setPhone} /></View>
                  </View>
                  <View style={s.pair}>
                    <View style={s.half}><WInput label="Email nhận biên lai" placeholder="khachhang@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} /></View>
                    <View style={s.half}><WInput label="Quốc tịch" value={nationality} onChangeText={setNationality} /></View>
                  </View>
                  <View style={s.pair}>
                    <View style={s.half}>
                      <View style={{ marginBottom: 18 }}><WLabel>Loại giấy tờ</WLabel><SelectField ariaLabel="Loại giấy tờ" icon="id-card-outline" value={idType} onChange={setIdType} options={ID_TYPE_OPTIONS} /></View>
                    </View>
                    <View style={s.half}><WInput label="Số CCCD / Hộ chiếu" placeholder="048201009988" value={idNumber} onChangeText={setIdNumber} /></View>
                  </View>
                  <WInput label="Yêu cầu đặc biệt (Ghi chú)" multiline numberOfLines={2} placeholder="Ví dụ: Cần phòng tầng cao, giường đôi, nhận phòng muộn sau 18h..." value={note} onChangeText={setNote} />
                  <WButton size="lg" icon="qr-code-outline" title={submitting ? 'Đang tạo đơn đặt phòng...' : 'Xác nhận Đặt phòng & Nhận mã VietQR →'} loading={submitting} onPress={handleSubmitBooking} style={{ marginTop: 12 }} />
                </WCardBody>
              </WCard>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function HeroBadge({ text }: { text: string }) {
  return (
    <View style={s.badge}>
      <View style={s.badgeDot} />
      <AppText style={s.badgeText}>{text}</AppText>
    </View>
  );
}
function RoomNumber({ n }: { n: string | number }) {
  return (
    <AppText style={s.roomNo}>PHÒNG <AppText style={s.roomNoB}>{n}</AppText></AppText>
  );
}
function Fact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={13} color={COLORS.primary} />
      <AppText style={{ color: '#547077', fontSize: 11 }}>{text}</AppText>
    </View>
  );
}
function BillRow({ label, value, bold, color, labelColor }: { label: string; value: string; bold?: boolean; color?: string; labelColor?: string }) {
  return (
    <View style={s.billRow}>
      <AppText style={{ color: labelColor || COLORS.textMuted, fontSize: 14, flexShrink: 1 }}>{label}</AppText>
      <AppText style={{ fontSize: 14, textAlign: 'right', color: color || COLORS.text, fontFamily: bold ? FONTS.family.bodyBold : FONTS.family.body }}>{value}</AppText>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  page: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40 },
  titleRow: { marginBottom: 32 },
  h2: { fontFamily: FONTS.family.heading, fontSize: 24, color: COLORS.text, marginBottom: 8 },
  titleP: { color: COLORS.textLight, fontSize: FONTS.sizes.md },
  searchGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 12, alignItems: 'flex-end' },
  half: { width: '48%', flexGrow: 1, minWidth: 0 },
  full: { width: '100%' },
  pair: { flexDirection: 'row', gap: 10 },
  resultsH2: { fontFamily: FONTS.family.heading, fontSize: 28, color: COLORS.text, marginVertical: 6 },
  resultsP: { color: COLORS.textLight, fontSize: 13 },
  roomCard: { overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, shadowColor: 'rgb(24,60,68)', shadowOpacity: 0.06, shadowRadius: 34, shadowOffset: { width: 0, height: 12 }, elevation: 3 },
  cardH3: { marginVertical: 8, fontFamily: FONTS.family.heading, fontSize: 24, color: COLORS.text },
  cardP: { marginBottom: 15, color: COLORS.textLight, fontSize: 13, lineHeight: 21.5 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 12 },
  roomFooter: { alignItems: 'flex-start', gap: 12, paddingTop: 20 },
  priceStrong: { color: COLORS.text, fontSize: 18, fontFamily: FONTS.family.bodyBold },
  priceSmall: { color: COLORS.textLight, fontSize: 11, fontFamily: FONTS.family.bodyMedium },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: COLORS.primarySubtle, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm },
  badgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary, opacity: 0.55 },
  badgeText: { color: COLORS.primary, fontSize: 10, fontFamily: FONTS.family.bodyBold, letterSpacing: 1.6 },
  roomNo: { color: COLORS.primary, fontSize: 12, fontFamily: FONTS.family.bodySemiBold, letterSpacing: 1.92 },
  roomNoB: { color: COLORS.primary, fontFamily: FONTS.family.heading, fontSize: FONTS.sizes.md, letterSpacing: 0.96 },
  voucherApplied: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  voucherAppliedText: { color: COLORS.success, fontSize: 13, fontFamily: FONTS.family.bodySemiBold, flexShrink: 1 },
  voucherRemove: { paddingVertical: 2, paddingHorizontal: 8, borderWidth: 2, borderColor: COLORS.error, borderRadius: RADIUS.sm },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  totalLabel: { fontSize: 16, fontFamily: FONTS.family.bodyBold },
  totalValue: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.family.bodyBold, color: COLORS.primary, textAlign: 'right' },
  depositBox: { padding: 12, backgroundColor: COLORS.primarySubtle, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md },
  depositLabel: { fontSize: 14, fontFamily: FONTS.family.bodyBold, color: COLORS.primary },
  depositValue: { fontSize: 20, fontFamily: FONTS.family.bodyBold, color: COLORS.error, marginTop: 4, marginBottom: 6 },
  depositNote: { fontSize: 12, lineHeight: 18, color: COLORS.textLight },
});
