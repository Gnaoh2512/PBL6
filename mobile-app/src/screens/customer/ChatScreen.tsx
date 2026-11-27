import React, { useState, useRef, useEffect } from 'react';
import { AppText, AppTextInput } from '../../components/common/AppText';
import { View, TouchableOpacity, FlatList, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';
import { useAuthStore } from '../../store/useAuthStore';
import {
  assistantService,
  AssistantAction,
  AssistantCard,
  AssistantCitation,
  AssistantStatus,
} from '../../services/assistantService';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  status?: AssistantStatus;
  citations?: AssistantCitation[];
  cards?: AssistantCard[];
  actions?: AssistantAction[];
  timestamp: Date;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  text: 'Chào bạn! Tôi là trợ lý AI của Azure Bay Hotel. Bạn có thể hỏi về chính sách khách sạn, tìm phòng trống, dịch vụ hoặc kiểm tra đơn đặt phòng của bạn.',
  sender: 'bot',
  timestamp: new Date(),
};

const QUICK_PROMPTS = [
  { label: 'Giá phòng trống', prompt: 'Tìm phòng trống cho 2 khách từ 2026-12-10 đến 2026-12-12' },
  { label: 'Dịch vụ', prompt: 'Khách sạn hiện có những dịch vụ nào và giá bao nhiêu?' },
  { label: 'Chính sách hủy', prompt: 'Chính sách hủy đặt phòng hoàn cọc thế nào?' },
  { label: 'Đơn của tôi', prompt: 'Xem danh sách đơn đặt phòng của tôi' },
];

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_DEPOSIT: 'Chờ cọc',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};

function formatVnd(raw?: string | number): string {
  if (raw === undefined || raw === null) return '';
  const text = String(raw).trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(text)) return text;
  const [intPart, fracPart] = text.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fracPart ? `${formatted},${fracPart} VND` : `${formatted} VND`;
}

function cleanAnswerText(text: string): string {
  return text.replace(/\[[^\]]*Chính sách demo đã duyệt[^\]]*\]\s*/g, '').trim();
}

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Clear private chat state whenever account/token changes (never store chat in AsyncStorage).
  useEffect(() => {
    abortRef.current?.abort();
    conversationIdRef.current = null;
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
    setErrorText(null);
  }, [token, userId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleReset = async () => {
    abortRef.current?.abort();
    conversationIdRef.current = null;
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
    setErrorText(null);
    setIsTyping(false);
    await assistantService.resetSession();
  };

  const handleActionPress = (action: AssistantAction) => {
    if (action.type === 'open_room_search') {
      navigation.navigate('CustomerTabs', { screen: 'Rooms' });
    } else if (action.type === 'open_services') {
      navigation.navigate('Services');
    } else if (action.type === 'open_login') {
      navigation.navigate('Auth');
    }
  };

  const sendPrompt = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isTyping) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      text: trimmed,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setErrorText(null);
    setIsTyping(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await assistantService.sendMessage(
        trimmed,
        conversationIdRef.current,
        controller.signal
      );
      if (controller.signal.aborted) return;

      conversationIdRef.current = data.conversationId;

      const botMessage: ChatMessage = {
        id: `b-${Date.now()}`,
        text: cleanAnswerText(data.answer),
        sender: 'bot',
        status: data.status,
        citations: data.citations,
        cards: data.cards,
        actions: data.actions,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      const errCode = err?.response?.data?.data?.code;
      if (errCode === 'CONVERSATION_NOT_FOUND') {
        conversationIdRef.current = null;
      }
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể kết nối tới trợ lý AI lúc này. Vui lòng thử lại.';
      setErrorText(msg);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsTyping(false);
    }
  };

  const renderCard = (card: AssistantCard, index: number) => {
    if (card.type === 'room') {
      return (
        <TouchableOpacity
          key={`room-${card.roomId ?? index}`}
          style={styles.infoCard}
          onPress={() => navigation.navigate('CustomerTabs', { screen: 'Rooms' })}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeaderRow}>
            <AppText style={styles.cardTitle}>{card.typeName || 'Phòng trống'}</AppText>
            {card.capacity ? (
              <AppText style={styles.cardBadge}>Tối đa {card.capacity} khách</AppText>
            ) : null}
          </View>
          <AppText style={styles.cardPrice}>
            {formatVnd(card.pricePerNight)}/đêm
            {card.totalRoomCharge ? ` · Dự kiến ${formatVnd(card.totalRoomCharge)}` : ''}
          </AppText>
          {card.estimatedDeposit ? (
            <AppText style={styles.cardMeta}>
              Cọc {card.depositPercentage ?? 30}%: {formatVnd(card.estimatedDeposit)}
            </AppText>
          ) : null}
          <AppText style={styles.cardLink}>Xem & đặt phòng →</AppText>
        </TouchableOpacity>
      );
    }

    if (card.type === 'service') {
      return (
        <TouchableOpacity
          key={`svc-${card.serviceId ?? index}`}
          style={styles.infoCard}
          onPress={() => navigation.navigate('Services')}
          activeOpacity={0.8}
        >
          <AppText style={styles.cardTitle}>{card.serviceName}</AppText>
          <AppText style={styles.cardPrice}>
            {formatVnd(card.unitPrice)} / {card.unit}
          </AppText>
          {card.categoryName ? <AppText style={styles.cardMeta}>{card.categoryName}</AppText> : null}
        </TouchableOpacity>
      );
    }

    if (card.type === 'booking') {
      return (
        <TouchableOpacity
          key={`bk-${card.bookingCode ?? index}`}
          style={styles.infoCard}
          onPress={() => navigation.navigate('CustomerTabs', { screen: 'MyBookings' })}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeaderRow}>
            <AppText style={styles.cardTitle}>{card.bookingCode}</AppText>
            {card.status ? (
              <AppText style={styles.cardBadge}>
                {BOOKING_STATUS_LABELS[card.status] || card.status}
              </AppText>
            ) : null}
          </View>
          {card.roomTypeName ? <AppText style={styles.cardMeta}>{card.roomTypeName}</AppText> : null}
          {card.checkInDate && card.checkOutDate ? (
            <AppText style={styles.cardMeta}>
              {card.checkInDate} → {card.checkOutDate}
              {card.nights ? ` (${card.nights} đêm)` : ''}
            </AppText>
          ) : null}
          {card.totalAmount !== undefined ? (
            <AppText style={styles.cardPrice}>
              Tổng: {formatVnd(card.totalAmount)}
              {card.remainingAmount !== undefined
                ? ` · Còn lại: ${formatVnd(card.remainingAmount)}`
                : ''}
            </AppText>
          ) : null}
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowBot]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={15} color={COLORS.surface} />
          </View>
        )}
        <View style={styles.bubbleWrap}>
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.messageBubbleUser : styles.messageBubbleBot,
            ]}
          >
            <AppText
              style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextBot]}
            >
              {item.text}
            </AppText>
          </View>

          {item.cards && item.cards.length > 0 && (
            <View style={styles.cardsContainer}>
              {item.cards.map((card, i) => renderCard(card, i))}
            </View>
          )}

          {item.actions && item.actions.length > 0 && (
            <View style={styles.actionsRow}>
              {item.actions.map((act, i) => (
                <TouchableOpacity
                  key={`${act.type}-${i}`}
                  style={styles.actionBtn}
                  onPress={() => handleActionPress(act)}
                >
                  <AppText style={styles.actionBtnText}>{act.label}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.topUtilityBar}>
          <View style={styles.statusRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.primary} />
            <AppText style={styles.statusLabel}>Azure Bay AI Concierge</AppText>
          </View>
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <Ionicons name="refresh-outline" size={15} color={COLORS.primary} />
            <AppText style={styles.resetBtnText}>Mới</AppText>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {isTyping && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <AppText style={styles.typingText}>Trợ lý AI đang kiểm tra thông tin...</AppText>
          </View>
        )}

        {errorText && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
            <AppText style={styles.errorText}>{errorText}</AppText>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsBar}
          contentContainerStyle={styles.pillsContent}
        >
          {QUICK_PROMPTS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.pill}
              onPress={() => sendPrompt(item.prompt)}
              disabled={isTyping}
            >
              <AppText style={styles.pillText}>{item.label}</AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <AppTextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Hỏi về phòng, dịch vụ, chính sách..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={1000}
            editable={!isTyping}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={() => sendPrompt(inputText)}
            disabled={!inputText.trim() || isTyping}
          >
            <Ionicons name="send" size={18} color={COLORS.surface} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  topUtilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textLight, fontWeight: '500' },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
  },
  resetBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  listContent: { padding: SPACING.md, flexGrow: 1 },
  messageRow: { flexDirection: 'row', marginBottom: SPACING.md, alignItems: 'flex-start' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowBot: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  bubbleWrap: { maxWidth: '82%' },
  messageBubble: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.lg,
  },
  messageBubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleBot: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: { fontSize: FONTS.sizes.md, lineHeight: 20 },
  messageTextUser: { color: COLORS.surface },
  messageTextBot: { color: COLORS.text },
  citationBox: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs + 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  citationHeading: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 2,
  },
  citationItem: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, lineHeight: 16 },
  cardsContainer: { marginTop: SPACING.xs + 2, gap: SPACING.xs + 2 },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardBadge: {
    fontSize: 11,
    color: COLORS.primary,
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    fontWeight: '600',
  },
  cardPrice: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 4,
  },
  cardMeta: { fontSize: FONTS.sizes.xs, color: COLORS.textLight, marginTop: 2 },
  cardLink: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 6,
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs + 2 },
  actionBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  actionBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.surface, fontWeight: '600' },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  typingText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontStyle: 'italic' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.errorBackground,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: { fontSize: FONTS.sizes.xs, color: COLORS.error, flex: 1 },
  pillsBar: { maxHeight: 42, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  pillsContent: { paddingHorizontal: SPACING.sm, alignItems: 'center', gap: SPACING.xs + 2 },
  pill: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  pillText: { fontSize: FONTS.sizes.xs, color: COLORS.text, fontWeight: '500' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm + 2 : SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.textMuted, opacity: 0.5 },
});
