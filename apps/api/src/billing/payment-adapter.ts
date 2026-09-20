/**
 * Phase 10 Payment Adapter Interface
 * Unified boundary for Stripe and VNPay integrations
 *
 * Decisions: ARCH-001, ARCH-002, MONET-002, MONET-003, MONET-006
 */

import type {
  BillingInterval,
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  PaymentProvider,
  SubscriptionStatus,
} from "@vietnam-weather/contracts";

export interface WebhookProcessingResult {
  readonly handled: boolean;
  readonly eventId: string;
  readonly eventType: string;
  readonly userId?: string;
  readonly plan?: "pro";
  readonly interval?: BillingInterval;
  readonly status?: SubscriptionStatus;
  readonly currentPeriodStart?: string;
  readonly currentPeriodEnd?: string;
  readonly externalSubscriptionId?: string;
  readonly externalCustomerId?: string;
}

export interface PaymentAdapter {
  readonly provider: PaymentProvider;

  createCheckoutSession(
    userId: string,
    userEmail: string,
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResponse>;

  createPortalSession?(
    userId: string,
    externalCustomerId: string,
    returnUrl?: string
  ): Promise<{ url: string }>;

  verifyWebhookSignature(
    rawPayload: string | Buffer,
    signatureHeader: string,
    secret: string
  ): boolean;

  parseWebhookEvent(
    rawPayload: string | Buffer,
    signatureHeader: string
  ): Promise<WebhookProcessingResult>;
}
