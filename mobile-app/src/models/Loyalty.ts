export interface LoyaltyProfile {
  tierId?: number | string;
  tierCode: string;
  tierName: string;
  tierLevel?: number;
  currentScore: number;
  totalStayDays: number;
  totalSpent: number;
  memberSince?: string | number[] | null;
  nextTierCode?: string | null;
  nextTierName?: string | null;
  pointsToNextTier?: number | null;
}

export interface LoyaltyTransaction {
  id?: string | number;
  txnType: 'EARN' | 'ADJUST' | string;
  scoreEarned: number;
  amountSpent?: number;
  stayDays?: number;
  note?: string;
  createdAt: string | number[];
}

export interface LoyaltyBenefit {
  id?: string | number;
  tierBenefitId: number;
  tierId?: number | string;
  tierCode?: string;
  tierLevel?: number;
  benefitName: string;
  benefitType: string;
  discountPercent?: number | null;
  quota?: number | null;
  remainingQuota?: number | null;
  periodType?: string | null;
  description?: string;
  tierName?: string;
  isActive?: boolean;
  serviceId?: number | null;
  serviceName?: string | null;
  roomTypeId?: number | null;
  roomTypeName?: string | null;
}

export interface RedeemBenefitRequest {
  tierBenefitId: number;
  bookingCode: string;
  idempotencyKey?: string;
  note?: string;
}
