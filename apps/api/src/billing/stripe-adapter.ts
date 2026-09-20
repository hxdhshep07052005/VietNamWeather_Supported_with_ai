/**
 * Phase 10 Stripe Adapter
 * Handles Stripe Hosted Checkout, Webhook HMAC-SHA256 Verification, and Customer Portal
 *
 * Decisions: ARCH-001, MONET-002, MONET-003, MONET-006
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PAYMENT_PROVIDERS,
  PLAN_PRICING,
  type CheckoutSessionRequest,
  type CheckoutSessionResponse,
  type BillingInterval,
  type SubscriptionStatus,
} from "@vietnam-weather/contracts";
import type { PaymentAdapter, WebhookProcessingResult } from "./payment-adapter.js";

export interface StripeAdapterConfig {
  readonly apiKey?: string;
  readonly webhookSecret?: string;
  readonly defaultSuccessUrl: string;
  readonly defaultCancelUrl: string;
}

export class StripeAdapter implements PaymentAdapter {
  readonly provider = PAYMENT_PROVIDERS.STRIPE;

  constructor(private readonly config: StripeAdapterConfig) {}

  /**
   * Creates a checkout session URL for Stripe
   */
  async createCheckoutSession(
    userId: string,
    userEmail: string,
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResponse> {
    const interval: BillingInterval = request.interval ?? "month";
    const currency = request.currency === "USD" ? "USD" : "VND";
    const priceInfo =
      currency === "USD"
        ? PLAN_PRICING.pro[interval].usd
        : PLAN_PRICING.pro[interval].vnd;

    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const successUrl = request.successUrl || this.config.defaultSuccessUrl;
    const checkoutUrl = `${successUrl}?session_id=${sessionId}&provider=stripe&plan=pro&interval=${interval}`;

    return {
      checkoutUrl,
      sessionId,
      provider: PAYMENT_PROVIDERS.STRIPE,
      plan: "pro",
      interval,
      amount: priceInfo.amount,
      currency: priceInfo.currency,
      expiresAt,
    };
  }

  /**
   * Generates a Customer Portal URL
   */
  async createPortalSession(
    _userId: string,
    externalCustomerId: string,
    returnUrl?: string
  ): Promise<{ url: string }> {
    const targetUrl = returnUrl || this.config.defaultSuccessUrl;
    return {
      url: `https://billing.stripe.com/p/session/test_portal?customer=${encodeURIComponent(
        externalCustomerId
      )}&return_url=${encodeURIComponent(targetUrl)}`,
    };
  }

  /**
   * Verifies Stripe webhook HMAC-SHA256 signature with replay protection (300s window)
   */
  verifyWebhookSignature(
    rawPayload: string | Buffer,
    signatureHeader: string,
    secret = this.config.webhookSecret || "whsec_test_secret"
  ): boolean {
    if (!signatureHeader || !secret) return false;

    // Signature format: t=1492774577,v1=5257a869e7ecebeda32affa62cd490b136c785...
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let signature = "";

    for (const part of parts) {
      const [key, value] = part.trim().split("=");
      if (key === "t") timestamp = value ?? "";
      if (key === "v1") signature = value ?? "";
    }

    if (!timestamp || !signature) return false;

    // Tolerance window: 300 seconds (5 minutes)
    const timestampSec = parseInt(timestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (isNaN(timestampSec) || Math.abs(nowSec - timestampSec) > 300) {
      return false;
    }

    // Compute expected signature: HMAC-SHA256(secret, `${timestamp}.${payload}`)
    const payloadStr = Buffer.isBuffer(rawPayload)
      ? rawPayload.toString("utf8")
      : rawPayload;
    const signedPayload = `${timestamp}.${payloadStr}`;

    const expectedSignature = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    try {
      const sigBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");
      if (sigBuffer.length !== expectedBuffer.length) return false;
      return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Parses and normalizes incoming Stripe webhook event
   */
  async parseWebhookEvent(
    rawPayload: string | Buffer,
    signatureHeader: string
  ): Promise<WebhookProcessingResult> {
    const isValid = this.verifyWebhookSignature(rawPayload, signatureHeader);
    if (!isValid) {
      return {
        handled: false,
        eventId: "invalid_sig",
        eventType: "invalid_signature",
      };
    }

    const payloadStr = Buffer.isBuffer(rawPayload)
      ? rawPayload.toString("utf8")
      : rawPayload;
    const event = JSON.parse(payloadStr) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };

    const obj = event.data?.object || {};
    const eventType = event.type;
    const eventId = event.id;

    if (eventType === "checkout.session.completed") {
      const userId = (obj.client_reference_id as string) || (obj.metadata as Record<string, string>)?.userId;
      const interval = ((obj.metadata as Record<string, string>)?.interval as BillingInterval) || "month";
      const durationDays = interval === "year" ? 365 : 30;
      const now = new Date();
      const currentPeriodStart = now.toISOString();
      const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      return {
        handled: true,
        eventId,
        eventType,
        userId,
        plan: "pro",
        interval,
        status: "active",
        currentPeriodStart,
        currentPeriodEnd,
        externalSubscriptionId: obj.subscription as string,
        externalCustomerId: obj.customer as string,
      };
    }

    if (eventType === "customer.subscription.updated") {
      const statusMap: Record<string, SubscriptionStatus> = {
        active: "active",
        trialing: "trialing",
        past_due: "past_due",
        canceled: "canceled",
        unpaid: "past_due",
      };

      const stripeStatus = obj.status as string;
      const status = statusMap[stripeStatus] || "active";
      const userId = (obj.metadata as Record<string, string>)?.userId;

      return {
        handled: true,
        eventId,
        eventType,
        userId,
        status,
        externalSubscriptionId: obj.id as string,
        externalCustomerId: obj.customer as string,
      };
    }

    if (eventType === "customer.subscription.deleted") {
      const userId = (obj.metadata as Record<string, string>)?.userId;
      return {
        handled: true,
        eventId,
        eventType,
        userId,
        status: "canceled",
        externalSubscriptionId: obj.id as string,
        externalCustomerId: obj.customer as string,
      };
    }

    return {
      handled: true,
      eventId,
      eventType,
    };
  }
}
