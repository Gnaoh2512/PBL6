// Home — 1:1 port of web HomePage.jsx (mobile view: HomePage.css @800px / @540px + mobile.css section 9).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, Image, StyleSheet, TouchableOpacity, Animated, Easing, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/common/AppText';
import PublicHeader from '../../components/layout/PublicHeader';
import ResortFooter from '../../components/layout/ResortFooter';
import DateField, { addDaysISO, todayISO, parseISODate } from '../../components/ui/DateField';
import SelectField from '../../components/ui/SelectField';
import { Fade, FlipImage, Reveal, RevealContext, Rise } from '../../components/ui/Motion';
import { addToast } from '../../components/common/Toast';
import { roomService } from '../../services/roomService';
import { formatPrice } from '../../utils/priceUtils';
import { COLORS, FONTS, RADIUS } from '../../utils/constants';
import {
  GUEST_OPTIONS, MOMENTS, PHOTOS, SERIF_FONT, SERVICE_CARDS, SectionId, getPrimaryAmenityLabel, getRoomVisual,
} from '../../data/webContent';

interface RoomCardData {
  id: string | null; roomTypeId: number; name: string; label: string; image: string; alternate: string;
  price: string; capacity: number; guests: string; availabilityText: string; amenityHighlight: string; copy: string;
}

const GREY_LABEL = '#899497';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<SectionId, number>>>({});
  const [scrollY, setScrollY] = useState(0);

  const [checkInDate, setCheckInDate] = useState(todayISO());
  const [checkOutDate, setCheckOutDate] = useState(addDaysISO(todayISO(), 1));
  const [guestCount, setGuestCount] = useState(2);
  const [rooms, setRooms] = useState<RoomCardData[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState('');

  const heroZoom = useRef(new Animated.Value(1.05)).current;
  useEffect(() => {
    Animated.timing(heroZoom, { toValue: 1, duration: 18000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);

  // ── scroll to section (navbar / footer / route param) ──
  const scrollToSection = useCallback((id?: SectionId | null) => {
    setTimeout(() => {
      if (!id) { scrollRef.current?.scrollTo({ y: 0, animated: true }); return; }
      const y = sectionY.current[id];
      if (y == null) return;
      // booking bar is centred on screen; every other section starts under the header
      const target = id === 'stay' ? y - height / 2 + 120 : y - 76;
      scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: true });
    }, 60);
  }, [height]);

  useEffect(() => {
    const p = route.params as { section?: SectionId; ts?: number } | undefined;
    if (p?.section) scrollToSection(p.section);
  }, [route.params, scrollToSection]);

  const mark = (id: SectionId) => (e: any) => { sectionY.current[id] = e.nativeEvent.layout.y; };

  // ── rooms (HomePage.loadRooms) ──
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError('');
    try {
      const [typesRes, availRes] = await Promise.allSettled([
        roomService.getRoomTypes(),
        roomService.getAvailableRooms(checkInDate, checkOutDate, 1),
      ]);
      const availableList: any[] = availRes.status === 'fulfilled' && Array.isArray(availRes.value) ? availRes.value : [];
      let typesList: any[] = typesRes.status === 'fulfilled' && Array.isArray(typesRes.value) ? typesRes.value : [];

      if (typesList.length === 0 && availableList.length > 0) {
        const map = new Map<number, any>();
        availableList.forEach((item) => {
          const rt = item.roomType;
          if (rt?.roomTypeId && !map.has(rt.roomTypeId)) map.set(rt.roomTypeId, { ...rt, basePrice: item.pricePerNight ?? rt.basePrice });
        });
        typesList = Array.from(map.values());
      }
      if (typesList.length === 0 && typesRes.status === 'rejected' && availRes.status === 'rejected') {
        setRoomsError('Không thể tải danh sách hạng phòng từ máy chủ.');
        setRooms([]);
        return;
      }
      const sorted = [...typesList].sort((a, b) => Number(a.basePrice || 0) - Number(b.basePrice || 0) || Number(a.roomTypeId || 0) - Number(b.roomTypeId || 0));
      setRooms(sorted.map((rt, index) => {
        const matching = availableList.filter((it) => String(it.roomType?.roomTypeId) === String(rt.roomTypeId));
        const first = matching[0] || null;
        const priceValue = Number(first?.pricePerNight ?? rt.basePrice ?? 0);
        const visual = getRoomVisual(rt, index);
        const capacity = Number(rt.capacity || 2);
        return {
          id: first?.roomId != null ? String(first.roomId) : null,
          roomTypeId: rt.roomTypeId,
          name: rt.typeName || 'Hạng phòng Azure Bay',
          label: visual.label, image: visual.image, alternate: visual.alternate,
          price: formatPrice(priceValue), capacity,
          guests: `Tối đa ${capacity} khách`,
          availabilityText: matching.length > 0 ? `Còn ${matching.length} phòng trống` : 'Kiểm tra lịch trống',
          amenityHighlight: getPrimaryAmenityLabel(rt.amenities),
          copy: rt.description || rt.amenities || 'Không gian nghỉ dưỡng được chuẩn bị cho kỳ lưu trú thoải mái.',
        };
      }));
    } finally {
      setRoomsLoading(false);
    }
  }, [checkInDate, checkOutDate]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const goBooking = (params: Record<string, any> = {}) => nav.navigate('CustomerTabs', { screen: 'Rooms', params: { ...params, ts: Date.now() } });

  const searchRooms = () => {
    const a = parseISODate(checkInDate)!, b = parseISODate(checkOutDate)!;
    if (b <= a) { addToast('Ngày trả phòng phải sau ngày nhận phòng.', 'error'); return; }
    goBooking({ checkIn: checkInDate, checkOut: checkOutDate, guests: String(guestCount) });
  };

  const updateCheckIn = (date: string) => {
    setCheckInDate(date);
    if (parseISODate(checkOutDate)! <= parseISODate(date)!) setCheckOutDate(addDaysISO(date, 1));
  };

  const bookRoom = (room: RoomCardData) => {
    const safe = room.capacity ? Math.min(guestCount, room.capacity) : guestCount;
    goBooking({
      checkIn: checkInDate, checkOut: checkOutDate, guests: String(Math.max(1, safe)),
      ...(room.roomTypeId ? { roomTypeId: String(room.roomTypeId) } : {}),
      ...(room.id ? { roomId: String(room.id) } : {}),
    });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setScrollY(e.nativeEvent.contentOffset.y);
  const heroH = Math.min(720, Math.round(height * 0.9));
  const photoW = width;

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <RevealContext.Provider value={{ scrollY, viewH: height, scrollRef }}>
        <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={32} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* ── Hero ── */}
          <View style={[s.hero, { height: heroH }]}>
            <Animated.Image source={{ uri: PHOTOS.hero }} resizeMode="cover" style={[StyleSheet.absoluteFillObject, { transform: [{ scale: heroZoom }] }]} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(4,25,31,0.30)' }]} />
            <Fade color={[4, 25, 31]} from={0.48} to={0} direction="down" style={{ top: 0, height: '28%' }} />
            <Fade color={[4, 25, 31]} from={0.62} to={0} direction="up" style={{ bottom: 0, height: '32%' }} />
            <View style={[s.heroCopy, { top: heroH * 0.44 - 90 }]}>
              <Rise delay={300} duration={1100} distance={30}><AppText style={s.heroH1}>Nơi đường chân trời</AppText></Rise>
              <Rise delay={600} duration={1100} distance={30}><AppText style={s.heroEm}>khiến bạn sống chậm lại.</AppText></Rise>
            </View>
          </View>

          {/* ── Booking bar ── */}
          <View onLayout={mark('stay')} style={s.bookingWrap}>
            <Rise delay={900} duration={1000}>
              <View style={s.bookingForm}>
                <View style={s.field}>
                  <AppText style={s.fieldLabel}>NHẬN PHÒNG</AppText>
                  <View style={s.fieldRow}>
                    <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                    <DateField variant="plain" ariaLabel="Ngày nhận phòng" min={todayISO()} value={checkInDate} onChange={updateCheckIn} />
                  </View>
                </View>
                <View style={s.field}>
                  <AppText style={s.fieldLabel}>TRẢ PHÒNG</AppText>
                  <View style={s.fieldRow}>
                    <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                    <DateField variant="plain" ariaLabel="Ngày trả phòng" min={addDaysISO(checkInDate, 1)} value={checkOutDate} onChange={setCheckOutDate} />
                  </View>
                </View>
                <View style={s.field}>
                  <AppText style={s.fieldLabel}>KHÁCH</AppText>
                  <View style={s.fieldRow}>
                    <Ionicons name="people-outline" size={18} color={COLORS.primary} />
                    <SelectField variant="plain" ariaLabel="Số khách" value={String(guestCount)} onChange={(v) => setGuestCount(Number(v))} options={GUEST_OPTIONS} />
                  </View>
                </View>
                <TouchableOpacity style={s.searchBtn} onPress={searchRooms} activeOpacity={0.85}>
                  <Ionicons name="search" size={14} color="#fff" />
                  <AppText style={s.searchBtnText}>Kiểm tra phòng trống</AppText>
                </TouchableOpacity>
              </View>
            </Rise>
          </View>

          {/* ── About / intro ── */}
          <View onLayout={mark('about')} style={s.intro}>
            <Reveal variant="left">
              <AppText style={s.eyebrow}>NGHỆ THUẬT ĐÓN TIẾP</AppText>
              <AppText style={s.h2}>Một vẻ đẹp sang trọng tĩnh tại</AppText>
            </Reveal>
            <Reveal variant="right" style={{ marginTop: 30 }}>
              <AppText style={s.introP}>Nằm nép mình bên đường cong kín gió của bờ tây Phú Quốc, Azure Bay là chốn nghỉ dưỡng boutique hòa mình vào cảnh sắc. Nơi đây, mỗi kỳ nghỉ đều chuyển động theo nhịp biển.</AppText>
              <TouchableOpacity style={s.underlineLink} onPress={() => scrollToSection('experiences')}>
                <AppText style={s.underlineLinkText}>Câu chuyện của chúng tôi</AppText>
                <Ionicons name="arrow-forward" size={17} color={COLORS.primary} />
              </TouchableOpacity>
            </Reveal>
          </View>

          {/* ── Showcase / bento ── */}
          <View onLayout={mark('discover')} style={s.width}>
            <SectionHeading eyebrow="TRẢI NGHIỆM AZURE BAY" title="Một kỳ nghỉ rộng mở để khám phá" copy="Từ buổi sáng thong thả bên làn nước đến đêm quây quần bên bàn tiệc, hãy cảm nhận nhiều nhịp sống tại Azure Bay." />
            <View style={{ gap: 14, paddingBottom: 150 }}>
              {MOMENTS.map((m, i) => (
                <Reveal key={m.title} variant="zoom" delay={(i % 6) * 0.1}>
                  <FlipImage primary={m.image} alternate={m.alternate} height={330} style={{ backgroundColor: COLORS.primary }}>
                    <Fade color={[41, 108, 122]} from={0} to={0.9} direction="down" style={{ bottom: 0, height: '70%' }} />
                    <View style={s.bentoCaption}>
                      <AppText style={s.bentoKicker}>KHÁM PHÁ</AppText>
                      <AppText style={s.bentoTitle}>{m.title}</AppText>
                      <AppText style={s.bentoCopy}>{m.copy}</AppText>
                    </View>
                  </FlipImage>
                </Reveal>
              ))}
            </View>
          </View>

          {/* ── Rooms ── */}
          <View onLayout={mark('rooms')} style={[s.width, { paddingBottom: 150 }]}>
            <SectionHeading eyebrow="NGHỈ DƯỠNG BÊN BIỂN" title="Phòng nghỉ & biệt thự" copy="Mỗi không gian được kiến tạo cho buổi sáng thong thả, chiều ngập hương biển và đêm đảo dịu êm." />
            {roomsLoading && rooms.length === 0 ? (
              <View style={s.stateCard}><AppText style={s.stateText}>Đang tải danh sách hạng phòng…</AppText></View>
            ) : rooms.length === 0 ? (
              <View style={s.stateCard}>
                <AppText style={s.stateText}>{roomsError || 'Hiện chưa có hạng phòng khả dụng để hiển thị.'}</AppText>
                <TouchableOpacity style={[s.outlineBtn, { marginTop: 14 }]} onPress={loadRooms}><AppText style={s.outlineBtnText}>Thử lại</AppText></TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 23 }}>
                {rooms.map((room, i) => (
                  <Reveal key={room.roomTypeId || room.name} delay={(i % 6) * 0.1}>
                    <View style={s.roomCard}>
                      <FlipImage primary={room.image} alternate={room.alternate} height={260}>
                        <View style={s.roomLabel}><AppText style={s.roomLabelText}>{room.label}</AppText></View>
                      </FlipImage>
                      <View style={{ padding: 26 }}>
                        <AppText style={s.roomName}>{room.name}</AppText>
                        <AppText style={s.roomCopy}>{room.copy}</AppText>
                        <View style={s.roomMeta}>
                          <MetaItem icon="people-outline" text={room.guests} />
                          <MetaItem icon="bed-outline" text={room.availabilityText} />
                          <MetaItem icon="wifi-outline" text={room.amenityHighlight} />
                        </View>
                        <View style={s.roomFooter}>
                          <View>
                            <AppText style={s.priceKicker}>GIÁ TỪ</AppText>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                              <AppText style={s.roomPrice}>{room.price}</AppText>
                              <AppText style={s.perNight}>/ đêm</AppText>
                            </View>
                          </View>
                          <TouchableOpacity accessibilityLabel={`Đặt ${room.name}`} style={s.roundBtn} onPress={() => bookRoom(room)} activeOpacity={0.8}>
                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Reveal>
                ))}
              </View>
            )}
            <Reveal><TouchableOpacity style={[s.outlineBtn, { alignSelf: 'center', marginTop: 42 }]} onPress={() => goBooking()}>
              <AppText style={s.outlineBtnText}>Khám phá tất cả phòng nghỉ</AppText>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
            </TouchableOpacity></Reveal>
          </View>

          {/* ── Experience ── */}
          <View onLayout={mark('experiences')} style={{ backgroundColor: COLORS.primary }}>
            <Reveal variant="left"><View style={{ height: 320, paddingTop: 30, paddingHorizontal: 25 }}>
              <Image source={{ uri: PHOTOS.retreat }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View></Reveal>
            <View style={{ paddingTop: 55, paddingHorizontal: 25, paddingBottom: 70 }}>
              <Reveal>
                <AppText style={[s.eyebrow, { color: '#fff' }]}>HÒN ĐẢO CỦA BẠN, NHỊP ĐIỆU CỦA BẠN</AppText>
                <AppText style={s.expH2}>{'Những ngày\ntheo nhịp biển'}</AppText>
              </Reveal>
              <Reveal delay={0.1}><AppText style={s.expP}>Theo con nước bằng thuyền kayak, quây quần bên bàn tiệc của bếp trưởng, hay để một buổi chiều trôi êm tại spa. Mỗi trải nghiệm đều đậm bản sắc địa phương, tinh tế và thong thả.</AppText></Reveal>
              <Reveal delay={0.2}>
                <View style={s.expList}>
                  {['Hành trình riêng khám phá đảo', 'Bàn tiệc ven biển', 'Spa Sóng & Tĩnh Lặng'].map((t, i) => (
                    <TouchableOpacity key={t} style={s.expItem} onPress={() => scrollToSection('services')}>
                      <AppText style={s.expIdx}>0{i + 1}</AppText>
                      <AppText style={s.expItemText}>{t}</AppText>
                      <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  ))}
                </View>
              </Reveal>
            </View>
          </View>

          {/* ── Services ── */}
          <View onLayout={mark('services')} style={[s.width, { paddingTop: 135, paddingBottom: 140 }]}>
            <SectionHeading eyebrow="TẬN TÂM PHỤC VỤ" title="Chăm chút trong từng chi tiết" copy="Tiện nghi tinh tế và trải nghiệm đảo được chăm chút theo phong cách riêng của bạn." />
            <View style={{ gap: 22 }}>
              {SERVICE_CARDS.map((c, i) => (
                <Reveal key={c.title} delay={(i % 6) * 0.1}>
                  <View style={s.serviceCard}>
                    <View style={{ height: 230, backgroundColor: COLORS.primary }}>
                      <Image source={{ uri: c.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                    <View style={{ padding: 25 }}>
                      <AppText style={s.serviceTitle}>{c.title}</AppText>
                      <AppText style={s.serviceCopy}>{c.copy}</AppText>
                      <TouchableOpacity style={s.serviceLink} onPress={() => scrollToSection('experiences')}>
                        <AppText style={s.serviceLinkText}>{c.link}</AppText>
                        <Ionicons name="arrow-forward" size={15} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Reveal>
              ))}
            </View>
          </View>

          {/* ── Loyalty ── */}
          <View onLayout={mark('gallery')} style={[s.width, { paddingBottom: 140 }]}>
            <Reveal variant="left"><View style={{ minHeight: 330 }}><Image source={{ uri: PHOTOS.loyalty }} style={{ width: '100%', height: 330 }} resizeMode="cover" /></View></Reveal>
            <View style={{ paddingVertical: 38, paddingHorizontal: 25, backgroundColor: COLORS.backgroundAlt }}>
              <Reveal>
                <AppText style={s.eyebrow}>AZURE BAY PRIVILEGE</AppText>
                <AppText style={s.h2}>Đặc quyền dành riêng cho bạn</AppText>
                <AppText style={s.loyaltyP}>Trở thành một phần của Azure Bay và tận hưởng những ưu đãi được tạo nên cho mỗi hành trình quay trở lại.</AppText>
              </Reveal>
              <Reveal delay={0.1}>
                <View style={s.benefits}>
                  {['Ưu đãi riêng cho thành viên', 'Ưu tiên nâng hạng phòng', 'Trải nghiệm được cá nhân hóa'].map((b) => (
                    <View key={b} style={s.benefit}><AppText style={s.benefitText}>{b}</AppText></View>
                  ))}
                </View>
              </Reveal>
              <Reveal delay={0.2}>
                <View style={{ gap: 10 }}>
                  <TouchableOpacity style={s.primaryBtn} onPress={() => nav.navigate('Auth', { mode: 'register' })} activeOpacity={0.85}>
                    <AppText style={s.primaryBtnText}>Khám phá đặc quyền</AppText>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.outlineBtn} onPress={() => nav.navigate('Auth', { mode: 'login' })}>
                    <AppText style={s.outlineBtnText}>Đăng nhập thành viên</AppText>
                  </TouchableOpacity>
                </View>
              </Reveal>
            </View>
          </View>

          {/* ── Offers ── */}
          <View onLayout={mark('offers')} style={s.offers}>
            <Reveal>
              <AppText style={[s.eyebrow, { textAlign: 'center' }]}>KỲ NGHỈ TIẾP THEO ĐANG CHỜ BẠN</AppText>
              <AppText style={[s.h2, { textAlign: 'center' }]}>Một chốn riêng đang chờ bạn bên bờ biển.</AppText>
              <AppText style={s.offersP}>Để Azure Bay chăm chút cho kỳ nghỉ tiếp theo với những trải nghiệm tinh tế và ưu đãi riêng từ khu nghỉ dưỡng.</AppText>
              <TouchableOpacity style={[s.primaryBtn, { alignSelf: 'center' }]} onPress={() => goBooking()} activeOpacity={0.85}>
                <AppText style={s.primaryBtnText}>Khám phá ưu đãi</AppText>
                <Ionicons name="arrow-forward" size={17} color="#fff" />
              </TouchableOpacity>
            </Reveal>
          </View>

          <View onLayout={mark('contact')}><ResortFooter onSelectSection={scrollToSection} /></View>
        </ScrollView>
      </RevealContext.Provider>

      {/* header overlays the hero like the fixed web nav */}
      <PublicHeader floating onSelectSection={scrollToSection} />

      {/* assistant (web AssistantWidget launcher) */}
      <AssistantFab />
    </View>
  );
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <View style={{ marginBottom: 50, gap: 20 }}>
      <Reveal variant="left"><AppText style={s.eyebrow}>{eyebrow}</AppText><AppText style={s.h2}>{title}</AppText></Reveal>
      <Reveal variant="right"><AppText style={s.headingP}>{copy}</AppText></Reveal>
    </View>
  );
}

function MetaItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={16} color="#69777b" />
      <AppText style={{ color: '#69777b', fontSize: 10 }}>{text}</AppText>
    </View>
  );
}

function AssistantFab() {
  const nav = useNavigation<any>();
  return (
    <TouchableOpacity style={s.fab} activeOpacity={0.85} onPress={() => nav.navigate('Chat')} accessibilityLabel="Mở trợ lý ảo">
      <Ionicons name="chatbubbles" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  hero: { overflow: 'hidden', backgroundColor: '#123b46' },
  heroCopy: { position: 'absolute', left: 25, right: 25 },
  heroH1: { color: '#fff', fontFamily: FONTS.family.heading, fontSize: 45, lineHeight: 44, letterSpacing: -1.1 },
  heroEm: { color: COLORS.secondary, fontFamily: FONTS.family.heading, fontSize: 46, lineHeight: 46, letterSpacing: -1.1, marginTop: 4 },
  bookingWrap: { marginTop: -115, marginHorizontal: 15, zIndex: 10 },
  bookingForm: { backgroundColor: '#fff', padding: 15, shadowColor: 'rgb(18,49,57)', shadowOpacity: 0.11, shadowRadius: 45, shadowOffset: { width: 0, height: 16 }, elevation: 8 },
  field: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  fieldLabel: { marginLeft: 30, color: GREY_LABEL, fontSize: 8, fontFamily: FONTS.family.bodyBold, letterSpacing: 1.44 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 8 },
  searchBtn: { height: 52, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm },
  searchBtnText: { color: '#fff', fontSize: 12, fontFamily: FONTS.family.bodySemiBold, letterSpacing: 0.24 },

  eyebrow: { fontFamily: FONTS.family.heading, fontSize: 16, color: COLORS.text },
  h2: { marginTop: 17, fontFamily: FONTS.family.heading, fontSize: 40, lineHeight: 43, color: COLORS.text },
  headingP: { color: COLORS.textLight, fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 26 },
  width: { paddingHorizontal: 25 },
  intro: { paddingVertical: 95, paddingHorizontal: 25 },
  introP: { color: '#53676e', fontFamily: SERIF_FONT, fontSize: 17, lineHeight: 32 },
  underlineLink: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', marginTop: 26, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: COLORS.primary },
  underlineLinkText: { color: COLORS.primary, fontSize: 12, fontFamily: FONTS.family.bodyBold },

  bentoCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 25 },
  bentoKicker: { color: '#fff', fontSize: 8, fontFamily: FONTS.family.bodyBold, letterSpacing: 1.6, opacity: 0.78 },
  bentoTitle: { marginTop: 8, color: '#fff', fontFamily: FONTS.family.heading, fontSize: 27 },
  bentoCopy: { marginTop: 9, color: '#fff', fontFamily: SERIF_FONT, fontSize: 12, lineHeight: 18.6, opacity: 0.88 },

  stateCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.borderLight, paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center' },
  stateText: { color: COLORS.textMuted, textAlign: 'center' },
  roomCard: { backgroundColor: '#fff', shadowColor: 'rgb(26,52,60)', shadowOpacity: 0.07, shadowRadius: 34, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  roomLabel: { position: 'absolute', top: 18, left: 18, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(13,53,62,0.72)' },
  roomLabelText: { color: '#fff', fontSize: 8, letterSpacing: 1.36 },
  roomName: { fontFamily: FONTS.family.heading, fontSize: 26, color: COLORS.text },
  roomCopy: { minHeight: 59, marginTop: 12, color: COLORS.textLight, fontFamily: SERIF_FONT, fontSize: 13, lineHeight: 21.4 },
  roomMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingVertical: 20, marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  roomFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 21 },
  priceKicker: { color: GREY_LABEL, fontSize: 8, letterSpacing: 1.2 },
  roomPrice: { color: COLORS.primary, fontFamily: FONTS.family.heading, fontSize: 19 },
  perNight: { marginLeft: 5, color: '#8b9598', fontSize: 10, marginBottom: 3 },
  roundBtn: { width: 39, height: 39, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  outlineBtn: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 22, borderWidth: 1, borderColor: '#bac5c3', borderRadius: RADIUS.sm },
  outlineBtnText: { color: COLORS.primary, fontSize: 12, fontFamily: FONTS.family.bodySemiBold, letterSpacing: 0.24 },
  primaryBtn: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 22, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm },
  primaryBtnText: { color: '#fff', fontSize: 12, fontFamily: FONTS.family.bodySemiBold, letterSpacing: 0.24 },

  expH2: { marginTop: 20, marginBottom: 25, fontFamily: FONTS.family.heading, fontSize: 48, lineHeight: 50, color: COLORS.secondary },
  expP: { color: 'rgba(255,255,255,0.69)', fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 27 },
  expList: { marginTop: 37, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  expItem: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.22)' },
  expIdx: { color: '#fff', fontSize: 8, opacity: 0.55 },
  expItemText: { color: '#fff', fontFamily: FONTS.family.heading, fontSize: 20, flexShrink: 1 },

  serviceCard: { backgroundColor: '#fff', overflow: 'hidden', shadowColor: COLORS.primary, shadowOpacity: 0.09, shadowRadius: 34, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  serviceTitle: { fontFamily: FONTS.family.heading, fontSize: 25, color: COLORS.text },
  serviceCopy: { marginTop: 11, marginBottom: 19, color: COLORS.textLight, fontFamily: SERIF_FONT, fontSize: 12, lineHeight: 19.8 },
  serviceLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: COLORS.accent },
  serviceLinkText: { color: COLORS.primary, fontSize: 10, fontFamily: FONTS.family.bodyBold },

  loyaltyP: { marginTop: 23, color: COLORS.textLight, fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 26 },
  benefits: { marginVertical: 30, borderTopWidth: 1, borderTopColor: 'rgba(41,108,122,0.22)' },
  benefit: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(41,108,122,0.22)' },
  benefitText: { fontFamily: FONTS.family.heading, fontSize: 18, color: COLORS.text },
  offers: { paddingVertical: 125, paddingHorizontal: 25, backgroundColor: COLORS.backgroundAlt },
  offersP: { marginTop: 23, marginBottom: 30, color: '#667277', fontFamily: SERIF_FONT, fontSize: 16, lineHeight: 27, textAlign: 'center' },

  fab: { position: 'absolute', right: 16, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});
