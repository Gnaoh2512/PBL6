import { Platform } from 'react-native';
import apiClient, { ApiResponse } from './apiClient';

export type AssistantStatus =
  | 'answered'
  | 'needs_clarification'
  | 'no_results'
  | 'requires_login'
  | 'insufficient_evidence'
  | 'capability_unavailable';

export interface AssistantCitation {
  citationId?: string;
  documentId?: string;
  title?: string;
  sectionId?: string;
  version?: string;
  sourceRef?: string;
  excerpt?: string;
}

export interface AssistantRoomCard {
  type: 'room';
  roomId?: number;
  typeName?: string;
  capacity?: number;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  pricePerNight?: string | number;
  totalRoomCharge?: string | number;
  depositPercentage?: number;
  estimatedDeposit?: string | number;
  retrievedAt?: string;
}

export interface AssistantServiceCard {
  type: 'service';
  serviceId?: number;
  serviceName?: string;
  categoryName?: string;
  unit?: string;
  unitPrice?: string | number;
  retrievedAt?: string;
}

export interface AssistantBookingCard {
  type: 'booking';
  bookingCode?: string;
  status?: string;
  roomTypeName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  guestCount?: number;
  totalAmount?: string | number;
  depositAmount?: string | number;
  remainingAmount?: string | number;
  retrievedAt?: string;
}

export type AssistantCard =
  | AssistantRoomCard
  | AssistantServiceCard
  | AssistantBookingCard;

export interface AssistantAction {
  type: 'open_room_search' | 'open_services' | 'open_login' | string;
  label: string;
  targetId?: string | null;
}

export interface AssistantChatData {
  conversationId: string;
  status: AssistantStatus;
  answer: string;
  corpusMode: 'production' | 'demo_synthetic';
  missingFields?: string[];
  citations: AssistantCitation[];
  cards: AssistantCard[];
  actions: AssistantAction[];
}

const ALLOWED_STATUSES: ReadonlyArray<AssistantStatus> = [
  'answered',
  'needs_clarification',
  'no_results',
  'requires_login',
  'insufficient_evidence',
  'capability_unavailable',
];

const NATIVE_ORIGIN =
  process.env.EXPO_PUBLIC_ASSISTANT_ORIGIN || 'http://localhost:3000';

function createClientMessageId(): string {
  const randomHex = (len: number) =>
    Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Request-ID': `mob-${createClientMessageId().slice(0, 20)}`,
  };
  if (Platform.OS !== 'web') {
    headers.Origin = NATIVE_ORIGIN;
  }
  return headers;
}

export const assistantService = {
  async sendMessage(
    message: string,
    conversationId: string | null,
    signal?: AbortSignal
  ): Promise<AssistantChatData> {
    const response = await apiClient.post<ApiResponse<AssistantChatData>>(
      '/api/assistant/chat',
      {
        conversationId,
        clientMessageId: createClientMessageId(),
        message,
      },
      {
        timeout: 22000,
        signal,
        headers: buildHeaders(),
        withCredentials: Platform.OS === 'web',
      }
    );

    const payload = response.data;
    const data = payload?.data;
    if (
      !payload?.success ||
      !data ||
      !ALLOWED_STATUSES.includes(data.status) ||
      !['production', 'demo_synthetic'].includes(data.corpusMode) ||
      typeof data.answer !== 'string' ||
      !Array.isArray(data.citations)
    ) {
      throw new Error('Phản hồi từ trợ lý AI không hợp lệ.');
    }

    return {
      ...data,
      cards: Array.isArray(data.cards) ? data.cards : [],
      actions: Array.isArray(data.actions) ? data.actions : [],
    };
  },

  async resetSession(): Promise<void> {
    try {
      await apiClient.delete('/api/assistant/session', {
        timeout: 5000,
        headers: buildHeaders(),
        withCredentials: Platform.OS === 'web',
      });
    } catch {
      // Best-effort server session cleanup; local state is always cleared.
    }
  },
};
