/**
 * Phase 10 Billing Service
 * Core orchestrator for subscriptions, entitlements, checkout, webhooks, and manual overrides
 *
 * Decisions: MONET-001..008, PRODUCT-001..007, ARCH-001..002
 */

import {
  PLAN_TYPES,
  BILLING_INTERVALS,
  PAYMENT_PROVIDERS,
  SUBSCRIPTION_STATUSES,
  PLAN_PRICING,
  ENTITLEMENT_LIMITS,
  type PlanType,
  type BillingInterval,
  type PlanDto,
  type CheckoutSessionRequest,
  type CheckoutSessionResponse,
  type EntitlementStatusDto,
  type UserQuotaStatusDto,
  type SubscriptionRecordDto,
  type VnpayIpnQuery,
  type VnpayIpnResponse,
  BILLING_ERROR_CODES,
} from "@vietnam-weather/contracts";

import type { Redis } from "ioredis";
import { ApiError } from "../errors.js";
import { QuotaService } from "./quota-service.js";
import { StripeAdapter } from "./stripe-adapter.js";
import { VnpayAdapter } from "./vnpay-adapter.js";

export interface BillingServiceDependencies {
  readonly quotaService?: QuotaService;
  readonly stripeAdapter?: StripeAdapter;
  readonly vnpayAdapter?: VnpayAdapter;
  readonly redis?: Redis;
}

export interface ManualAuditLogEntry {
  readonly id: string;
  readonly targetUserId: string;
  readonly operatorId: string;
  readonly action: "GRANT_PRO" | "REVOKE_PRO";
  readonly reason: string;
  readonly timestamp: string;
  readonly expiresAt?: string;
}

export class BillingService {
  readonly quotaService: QuotaService;
  readonly stripeAdapter: StripeAdapter;
  readonly vnpayAdapter: VnpayAdapter;

  // In-memory repositories (can be backed by Postgres/Directus)
  private readonly subscriptions = new Map<string, SubscriptionRecordDto>();
  private readonly processedEvents = new Set<string>();
  private readonly auditLogs: ManualAuditLogEntry[] = [];

  constructor(deps?: BillingServiceDependencies) {
    this.quotaService = deps?.quotaService ?? new QuotaService(deps?.redis);
    this.stripeAdapter =
      deps?.stripeAdapter ??
      new StripeAdapter({
        defaultSuccessUrl: "http://localhost:3000/upgrade?status=success",
        defaultCancelUrl: "http://localhost:3000/upgrade?status=canceled",
      });
    this.vnpayAdapter =
      deps?.vnpayAdapter ??
      new VnpayAdapter({
        returnUrl: "http://localhost:3000/upgrade?status=success",
      });
  }

  /**
   * Returns localized public plan catalog
   * Per MONET-001, PRODUCT-001, PRODUCT-003
   */
  getPlans(locale: "vi" | "en" = "vi"): PlanDto[] {
    const isVi = locale === "vi";

    const freePlan: PlanDto = {
      id: PLAN_TYPES.FREE,
      name: isVi ? "Gói Miễn Phí" : "Free Plan",
      description: isVi
        ? "Tra cứu thời tiết cơ bản và lập lộ trình thông minh cho người dùng cá nhân."
        : "Essential weather lookup and smart route planning for everyday travelers.",
      pricing: [
        {
          interval: BILLING_INTERVALS.MONTH,
          amount: 0,
          currency: isVi ? "VND" : "USD",
          formattedAmount: isVi ? "0 ₫" : "$0",
        },
      ],
      features: [
        {
          key: "feature_current_weather",
          name: isVi ? "Thời tiết hiện tại & cảnh báo rủi ro" : "Current weather & risk alerts",
          description: isVi ? "Không giới hạn theo dõi thời tiết thực" : "Unlimited real-time weather tracking",
          includedInFree: true,
          includedInPro: true,
        },
        {
          key: "feature_location_search",
          name: isVi ? "Tìm kiếm địa điểm (10 lượt/ngày)" : "Location search (10/day)",
          description: isVi ? "Đầy đủ 63 tỉnh thành Việt Nam" : "Full Vietnam provincial coverage",
          includedInFree: true,
          includedInPro: true,
        },
        {
          key: "feature_route_evaluation",
          name: isVi ? "Lập lộ trình theo thời tiết (3 lượt/ngày)" : "Weather route evaluations (3/day)",
          description: isVi ? "1 hành lang tuyến khuyên dùng" : "1 recommended route corridor",
          includedInFree: true,
          includedInPro: true,
        },
        {
          key: "feature_weather_future_timeline",
          name: isVi ? "Tua thanh thời gian dự báo tương lai" : "Future timeline scrubber & forecast animation",
          description: isVi ? "Chỉ xem được thời tiết hiện tại" : "Current weather view only",
          includedInFree: false,
          includedInPro: true,
        },
        {
          key: "feature_route_corridors_multi",
          name: isVi ? "So sánh 3 hành lang tuyến (Nhanh nhất, Ngắn nhất, An toàn nhất)" : "3 Route corridors comparison (Fastest, Shortest, Safer)",
          description: isVi ? "Chỉ dành cho gói Pro" : "Pro only",
          includedInFree: false,
          includedInPro: true,
        },
      ],
    };

    const proPlan: PlanDto = {
      id: PLAN_TYPES.PRO,
      name: isVi ? "Gói PRO Cao Cấp" : "Pro Traveler",
      description: isVi
        ? "Mở khóa toàn bộ dữ liệu dự báo tương lai, so sánh đa hành lang tuyến và hạn ngạch mở rộng."
        : "Unlock full future forecast timeline, 3 comparative corridors, and high-capacity quotas.",
      recommended: true,
      pricing: [
        {
          interval: BILLING_INTERVALS.MONTH,
          amount: isVi ? PLAN_PRICING.pro.month.vnd.amount : PLAN_PRICING.pro.month.usd.amount,
          currency: isVi ? "VND" : "USD",
          formattedAmount: isVi ? PLAN_PRICING.pro.month.vnd.formatted : PLAN_PRICING.pro.month.usd.formatted,
        },
        {
          interval: BILLING_INTERVALS.YEAR,
          amount: isVi ? PLAN_PRICING.pro.year.vnd.amount : PLAN_PRICING.pro.year.usd.amount,
          currency: isVi ? "VND" : "USD",
          formattedAmount: isVi ? PLAN_PRICING.pro.year.vnd.formatted : PLAN_PRICING.pro.year.usd.formatted,
          savingsPercentage: PLAN_PRICING.pro.year.vnd.savingsPercentage,
        },
      ],
      features: [
        {
          key: "feature_location_search",
          name: isVi ? "200 lượt tìm kiếm địa điểm / ngày" : "200 location searches / day",
          description: isVi ? "Mở rộng 20x so với gói Miễn phí" : "20x higher than Free",
          includedInFree: false,
          includedInPro: true,
          highlight: true,
        },
        {
          key: "feature_route_evaluation",
          name: isVi ? "30 lượt lập lộ trình / ngày" : "30 route evaluations / day",
          description: isVi ? "Đánh giá chi tiết rủi ro theo ETA từng trạm" : "Detailed risk score by checkpoint ETA",
          includedInFree: false,
          includedInPro: true,
          highlight: true,
        },
        {
          key: "feature_route_corridors_multi",
          name: isVi ? "So sánh đồng thời 3 hành lang tuyến" : "3 Simultaneous route corridor alternatives",
          description: isVi ? "Nhanh nhất (Cao tốc), Ngắn nhất, Thời tiết an toàn nhất" : "Fastest, Shortest, and Weather-safer corridors",
          includedInFree: false,
          includedInPro: true,
          highlight: true,
        },
        {
          key: "feature_weather_future_timeline",
          name: isVi ? "Tua thanh thời gian & dự báo 72h / 3 ngày" : "Interactive timeline scrubber & 72h forecast",
          description: isVi ? "Mô phỏng hướng di chuyển của thời tiết theo giờ" : "Hour-by-hour forecast progression simulation",
          includedInFree: false,
          includedInPro: true,
          highlight: true,
        },
        {
          key: "feature_saved_items",
          name: isVi ? "Lưu 50 địa điểm & 20 hành trình yêu thích" : "Save up to 50 locations & 20 routes",
          description: isVi ? "Đồng bộ đa thiết bị" : "Sync across all devices",
          includedInFree: false,
          includedInPro: true,
        },
      ],
    };

    return [freePlan, proPlan];
  }

  /**
   * Returns current user active entitlements
   */
  async getEntitlements(userId: string): Promise<EntitlementStatusDto> {
    const sub = this.subscriptions.get(userId);
    const now = new Date();

    let isPro = false;
    let expiresAt: string | null = null;
    let cancelAtPeriodEnd = false;

    if (sub && sub.status === SUBSCRIPTION_STATUSES.ACTIVE) {
      const periodEnd = new Date(sub.currentPeriodEnd);
      if (periodEnd > now) {
        isPro = true;
        expiresAt = sub.currentPeriodEnd;
        cancelAtPeriodEnd = sub.cancelAtPeriodEnd;
      } else {
        // Expired -> downgrade
        this.subscriptions.set(userId, {
          ...sub,
          status: SUBSCRIPTION_STATUSES.EXPIRED,
        });
      }
    }

    const plan: PlanType = isPro ? PLAN_TYPES.PRO : PLAN_TYPES.FREE;
    const limits = ENTITLEMENT_LIMITS[plan];

    return {
      userId,
      plan,
      isPro,
      expiresAt,
      cancelAtPeriodEnd,
      capabilities: {
        maxRouteAlternatives: limits.maxRouteAlternatives,
        historyRetentionDays: limits.historyRetentionDays,
        futureTimeline: limits.futureTimeline,
        advancedWeatherOverlays: limits.advancedWeatherOverlays,
        canExportReports: isPro,
      },
    };
  }

  /**
   * Returns current user daily quota status
   */
  async getQuotas(userId: string): Promise<UserQuotaStatusDto> {
    const ent = await this.getEntitlements(userId);
    return this.quotaService.getStatus(userId, ent.plan);
  }

  /**
   * Initiates checkout session with chosen provider
   * Per ARCH-001, ARCH-002, MONET-002
   */
  async createCheckoutSession(
    userId: string,
    userEmail: string,
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResponse> {
    if (request.plan !== PLAN_TYPES.PRO) {
      throw new ApiError(400, BILLING_ERROR_CODES.PLAN_NOT_FOUND, false, "Invalid plan");
    }

    if (request.provider === PAYMENT_PROVIDERS.STRIPE) {
      return this.stripeAdapter.createCheckoutSession(userId, userEmail, request);
    }

    if (request.provider === PAYMENT_PROVIDERS.VNPAY) {
      return this.vnpayAdapter.createCheckoutSession(userId, userEmail, request);
    }

    throw new ApiError(
      400,
      BILLING_ERROR_CODES.PROVIDER_UNAVAILABLE,
      false,
      `Unsupported payment provider: ${request.provider}`
    );
  }

  /**
   * Handles incoming Stripe Webhook with HMAC signature and idempotency
   * Per MONET-006
   */
  async handleStripeWebhook(
    rawPayload: string | Buffer,
    signatureHeader: string
  ): Promise<{ received: boolean; processed: boolean; eventId: string }> {
    const result = await this.stripeAdapter.parseWebhookEvent(rawPayload, signatureHeader);

    if (!result.handled && result.eventType === "invalid_signature") {
      throw new ApiError(400, BILLING_ERROR_CODES.INVALID_SIGNATURE, false, "Invalid Stripe webhook signature");
    }

    // Idempotency check: if event was already processed, ignore duplicate
    if (this.processedEvents.has(result.eventId)) {
      return { received: true, processed: false, eventId: result.eventId };
    }

    if (result.userId && result.status) {
      const existing = this.subscriptions.get(result.userId);
      const subRecord: SubscriptionRecordDto = {
        id: `sub_${Date.now()}`,
        userId: result.userId,
        plan: "pro",
        interval: result.interval || existing?.interval || "month",
        provider: PAYMENT_PROVIDERS.STRIPE,
        status: result.status,
        currentPeriodStart: result.currentPeriodStart || new Date().toISOString(),
        currentPeriodEnd:
          result.currentPeriodEnd ||
          existing?.currentPeriodEnd ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: result.status === "canceled",
        externalSubscriptionId: result.externalSubscriptionId,
        externalCustomerId: result.externalCustomerId,
      };

      this.subscriptions.set(result.userId, subRecord);
    }

    this.processedEvents.add(result.eventId);
    return { received: true, processed: true, eventId: result.eventId };
  }

  /**
   * Handles incoming VNPay IPN with HMAC-SHA512 checksum and idempotency
   * Per MONET-003, MONET-006
   */
  async handleVnpayIpn(query: VnpayIpnQuery): Promise<VnpayIpnResponse> {
    const isValid = this.vnpayAdapter.verifyIpnChecksum(query);
    if (!isValid) {
      return { RspCode: "97", Message: "Checksum failed" };
    }

    const eventId = query.vnp_TransactionNo || query.vnp_TxnRef;
    if (!eventId) {
      return { RspCode: "01", Message: "Order not found" };
    }

    // Idempotency check
    if (this.processedEvents.has(eventId)) {
      return { RspCode: "02", Message: "Order already confirmed" };
    }

    const _parseResult = await this.vnpayAdapter.parseWebhookEvent(
      "",
      query.vnp_SecureHash || ""
    );

    const isSuccess = query.vnp_ResponseCode === "00" && query.vnp_TransactionStatus === "00";
    const txnRef = query.vnp_TxnRef || "";
    const parts = txnRef.split("_");
    const userId = parts[1];

    if (userId && isSuccess) {
      const interval: BillingInterval = parts[3] === "year" ? "year" : "month";
      const durationDays = interval === "year" ? 365 : 30;
      const now = new Date();
      const currentPeriodStart = now.toISOString();
      const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      const subRecord: SubscriptionRecordDto = {
        id: `vnp_sub_${Date.now()}`,
        userId,
        plan: "pro",
        interval,
        provider: PAYMENT_PROVIDERS.VNPAY,
        status: SUBSCRIPTION_STATUSES.ACTIVE,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        externalSubscriptionId: txnRef,
      };

      this.subscriptions.set(userId, subRecord);
    }

    this.processedEvents.add(eventId);
    return { RspCode: "00", Message: "Confirm Success" };
  }

  /**
   * Administrative manual grant of Pro status
   * Per MONET-008
   */
  async manualGrantPro(
    targetUserId: string,
    operatorId: string,
    durationDays: number,
    reason: string
  ): Promise<SubscriptionRecordDto> {
    if (!reason || reason.trim().length < 10) {
      throw new ApiError(400, "VALIDATION_FAILED", false, "Reason must be at least 10 characters");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const subRecord: SubscriptionRecordDto = {
      id: `manual_${Date.now()}`,
      userId: targetUserId,
      plan: "pro",
      interval: durationDays >= 365 ? "year" : "month",
      provider: PAYMENT_PROVIDERS.STRIPE,
      status: SUBSCRIPTION_STATUSES.ACTIVE,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: expiresAt,
      cancelAtPeriodEnd: false,
    };

    this.subscriptions.set(targetUserId, subRecord);

    this.auditLogs.push({
      id: `audit_${Date.now()}`,
      targetUserId,
      operatorId,
      action: "GRANT_PRO",
      reason,
      timestamp: now.toISOString(),
      expiresAt,
    });

    return subRecord;
  }

  /**
   * Administrative manual revocation of Pro status
   * Per MONET-008
   */
  async manualRevokePro(
    targetUserId: string,
    operatorId: string,
    reason: string
  ): Promise<void> {
    if (!reason || reason.trim().length < 10) {
      throw new ApiError(400, "VALIDATION_FAILED", false, "Reason must be at least 10 characters");
    }

    const existing = this.subscriptions.get(targetUserId);
    if (existing) {
      this.subscriptions.set(targetUserId, {
        ...existing,
        status: SUBSCRIPTION_STATUSES.CANCELED,
        cancelAtPeriodEnd: true,
      });
    }

    this.auditLogs.push({
      id: `audit_${Date.now()}`,
      targetUserId,
      operatorId,
      action: "REVOKE_PRO",
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Returns audit logs for inspection
   */
  getAuditLogs(): readonly ManualAuditLogEntry[] {
    return this.auditLogs;
  }
}
