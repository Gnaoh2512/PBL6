export interface LoyaltyProfile {
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
  benefitName: string;
  benefitType: string;
  discountPercent?: number | null;
  quota?: number | null;
  remainingQuota?: number | null;
  periodType?: string | null;
  description?: string;
  tierName?: string;
}
