/**
 * Phase 10 Billing, Subscription & Entitlements Contracts
 * Multi-provider monetization with atomic quota ledger
 *
 * Based on decisions MONET-001..008, PRODUCT-001..007, ARCH-001..002
 */

// =============================================================================
// Constants (MONET-001, MONET-002, MONET-003, MONET-004)
// =============================================================================

/**
 * Supported plan types
 * Per PRODUCT-001 and MONET-001
 */
export const PLAN_TYPES = {
  FREE: "free",
  PRO: "pro",
} as const;

export type PlanType = (typeof PLAN_TYPES)[keyof typeof PLAN_TYPES];

/**
 * Billing intervals for Pro subscriptions
 * Per PRODUCT-003 and MONET-001
 */
export const BILLING_INTERVALS = {
  MONTH: "month",
  YEAR: "year",
} as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[keyof typeof BILLING_INTERVALS];

/**
 * Supported payment providers
 * Per ARCH-001 and MONET-002
 */
export const PAYMENT_PROVIDERS = {
  STRIPE: "stripe",
  VNPAY: "vnpay",
} as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

/**
 * Subscription lifecycle states
 * Per MONET-007
 */
export const SUBSCRIPTION_STATUSES = {
  ACTIVE: "active",
  TRIALING: "trialing",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
  EXPIRED: "expired",
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[keyof typeof SUBSCRIPTION_STATUSES];

/**
 * Standard pricing matrix
 * Per MONET-001 and PRODUCT-003 (Yearly price = 10 months, ~16.7% discount)
 */
export const PLAN_PRICING = {
  pro: {
    month: {
      vnd: { amount: 99_000, currency: "VND", formatted: "99.000 ₫/tháng" },
      usd: { amount: 499, currency: "USD", formatted: "$4.99/mo" }, // cents
    },
    year: {
      vnd: { amount: 990_000, currency: "VND", formatted: "990.000 ₫/năm", savingsPercentage: 17 },
      usd: { amount: 4990, currency: "USD", formatted: "$49.90/yr", savingsPercentage: 17 }, // cents
    },
  },
} as const;

/**
 * Daily quota reset timezone
 * Per PRODUCT-005 and MONET-004
 */
export const QUOTA_RESET_TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Entitlement and quota limits matrix
 * Per PRODUCT-004, PRODUCT-007, MONET-004, MONET-005
 */
export const ENTITLEMENT_LIMITS = {
  free: {
    dailyLocationSearch: 10,
    dailyRouteEvaluation: 3,
    maxRouteAlternatives: 1,
    maxSavedLocations: 3,
    maxSavedRoutes: 1,
    historyRetentionDays: 7,
    futureTimeline: false,
    advancedWeatherOverlays: false,
  },
  pro: {
    dailyLocationSearch: 200,
    dailyRouteEvaluation: 30,
    maxRouteAlternatives: 3,
    maxSavedLocations: 50,
    maxSavedRoutes: 20,
    historyRetentionDays: 90,
    futureTimeline: true,
    advancedWeatherOverlays: true,
  },
} as const;

/**
 * Feature keys for capability gating
 * Per MONET-005
 */
export const FEATURE_KEYS = {
  LOCATION_SEARCH: "feature_location_search",
  ROUTE_EVALUATION: "feature_route_evaluation",
  ROUTE_ALTERNATIVES: "feature_route_alternatives",
  FUTURE_TIMELINE: "feature_weather_future_timeline",
  ADVANCED_OVERLAYS: "feature_weather_advanced_overlays",
  SAVED_LOCATIONS: "feature_saved_locations",
  SAVED_ROUTES: "feature_saved_routes",
  HISTORY_RETENTION: "feature_history_retention",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Billing & Quota error codes
 * Per MONET-004, MONET-006
 */
export const BILLING_ERROR_CODES = {
  PLAN_NOT_FOUND: "BILLING_PLAN_NOT_FOUND",
  CHECKOUT_FAILED: "BILLING_CHECKOUT_FAILED",
  INVALID_SIGNATURE: "BILLING_INVALID_SIGNATURE",
  WEBHOOK_DUPLICATE: "BILLING_WEBHOOK_DUPLICATE",
  PROVIDER_UNAVAILABLE: "BILLING_PROVIDER_UNAVAILABLE",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  UNAUTHORIZED_PRO_CAPABILITY: "UNAUTHORIZED_PRO_CAPABILITY",
  INVALID_PAYLOAD: "BILLING_INVALID_PAYLOAD",
  SESSION_EXPIRED: "BILLING_SESSION_EXPIRED",
} as const;

export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[keyof typeof BILLING_ERROR_CODES];

// =============================================================================
// DTOs & Interfaces
// =============================================================================

export interface PlanFeatureDto {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly includedInFree: boolean;
  readonly includedInPro: boolean;
  readonly highlight?: boolean;
}

export interface PlanPricingDetailDto {
  readonly interval: BillingInterval;
  readonly amount: number;
  readonly currency: "VND" | "USD";
  readonly formattedAmount: string;
  readonly savingsPercentage?: number;
}

export interface PlanDto {
  readonly id: PlanType;
  readonly name: string;
  readonly description: string;
  readonly pricing: PlanPricingDetailDto[];
  readonly features: PlanFeatureDto[];
  readonly recommended?: boolean;
}

export interface CheckoutSessionRequest {
  readonly plan: "pro";
  readonly interval: BillingInterval;
  readonly provider: PaymentProvider;
  readonly currency?: "VND" | "USD";
  readonly successUrl?: string;
  readonly cancelUrl?: string;
}

export interface CheckoutSessionResponse {
  readonly checkoutUrl: string;
  readonly sessionId: string;
  readonly provider: PaymentProvider;
  readonly plan: PlanType;
  readonly interval: BillingInterval;
  readonly amount: number;
  readonly currency: string;
  readonly expiresAt: string;
}

export interface QuotaItemStatus {
  readonly capability: string;
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: string;
}

export interface UserQuotaStatusDto {
  readonly userId: string;
  readonly plan: PlanType;
  readonly timezone: string;
  readonly resetAt: string;
  readonly quotas: {
    readonly locationSearch: QuotaItemStatus;
    readonly routeEvaluation: QuotaItemStatus;
    readonly savedLocations: { readonly current: number; readonly limit: number };
    readonly savedRoutes: { readonly current: number; readonly limit: number };
  };
}

export interface EntitlementStatusDto {
  readonly userId: string;
  readonly plan: PlanType;
  readonly isPro: boolean;
  readonly expiresAt: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly capabilities: {
    readonly maxRouteAlternatives: number;
    readonly historyRetentionDays: number;
    readonly futureTimeline: boolean;
    readonly advancedWeatherOverlays: boolean;
    readonly canExportReports: boolean;
  };
}

export interface SubscriptionRecordDto {
  readonly id: string;
  readonly userId: string;
  readonly plan: PlanType;
  readonly interval: BillingInterval;
  readonly provider: PaymentProvider;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly externalSubscriptionId?: string;
  readonly externalCustomerId?: string;
}

export interface StripeWebhookPayload {
  readonly id: string;
  readonly type: string;
  readonly created: number;
  readonly data: {
    readonly object: Record<string, unknown>;
  };
}

export interface VnpayIpnQuery {
  readonly vnp_TmnCode?: string;
  readonly vnp_Amount?: string;
  readonly vnp_BankCode?: string;
  readonly vnp_BankTranNo?: string;
  readonly vnp_CardType?: string;
  readonly vnp_PayDate?: string;
  readonly vnp_OrderInfo?: string;
  readonly vnp_TransactionNo?: string;
  readonly vnp_ResponseCode?: string;
  readonly vnp_TransactionStatus?: string;
  readonly vnp_TxnRef?: string;
  readonly vnp_SecureHashType?: string;
  readonly vnp_SecureHash?: string;
  [key: string]: string | undefined;
}

export interface VnpayIpnResponse {
  readonly RspCode: "00" | "01" | "02" | "04" | "97" | "99";
  readonly Message: string;
}
