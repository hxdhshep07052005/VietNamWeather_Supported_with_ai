/**
 * Phase 10 Billing Routes
 * API endpoints for plans catalog, entitlements, quotas, checkout, portal, and webhooks
 *
 * Decisions: MONET-001..008, ARCH-001..003
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  CheckoutSessionRequest,
  VnpayIpnQuery,
} from "@vietnam-weather/contracts";

import { ApiError } from "../errors.js";
import type { BillingService } from "./billing-service.js";

export interface BillingRoutesOptions {
  readonly billingService: BillingService;
  readonly requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  readonly requireMutationSecurity: (request: FastifyRequest) => Promise<void>;
}

export function buildBillingRoutes(app: FastifyInstance, options: BillingRoutesOptions): void {
  const { billingService, requireAuth, requireMutationSecurity } = options;

  /**
   * GET /api/v1/billing/plans
   * Public plan and pricing catalog
   */
  app.get("/api/v1/billing/plans", async (request: FastifyRequest) => {
    const query = request.query as { locale?: string } | undefined;
    const locale = query?.locale === "en" ? "en" : "vi";
    const plans = billingService.getPlans(locale);
    return { data: { plans } };
  });

  /**
   * GET /api/v1/billing/entitlements
   * Current user plan and feature capabilities
   */
  app.get(
    "/api/v1/billing/entitlements",
    { preHandler: requireAuth },
    async (request: FastifyRequest) => {
      const userId = request.authSession?.user?.id;
      if (!userId) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", false, "User authentication required");
      }
      const entitlements = await billingService.getEntitlements(userId);
      return { data: entitlements };
    }
  );

  /**
   * GET /api/v1/billing/quotas
   * Current user remaining and used daily quotas
   */
  app.get(
    "/api/v1/billing/quotas",
    { preHandler: requireAuth },
    async (request: FastifyRequest) => {
      const userId = request.authSession?.user?.id;
      if (!userId) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", false, "User authentication required");
      }
      const quotas = await billingService.getQuotas(userId);
      return { data: quotas };
    }
  );

  /**
   * POST /api/v1/billing/checkout
   * Initiates payment checkout session for Stripe or VNPay
   */
  app.post(
    "/api/v1/billing/checkout",
    {
      preHandler: async (req, reply) => {
        await requireAuth(req, reply);
        await requireMutationSecurity(req);
      },
    },
    async (request: FastifyRequest) => {
      const userId = request.authSession?.user?.id;
      const userEmail = "user@vietnamweather.vn";
      if (!userId) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", false, "User authentication required");
      }

      const body = request.body as CheckoutSessionRequest;
      if (!body || !body.provider || !body.plan) {
        throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid checkout request body");
      }

      const checkout = await billingService.createCheckoutSession(userId, userEmail, body);
      return { data: checkout };
    }
  );

  /**
   * POST /api/v1/billing/portal
   * Customer portal link for subscription management
   */
  app.post(
    "/api/v1/billing/portal",
    {
      preHandler: async (req, reply) => {
        await requireAuth(req, reply);
        await requireMutationSecurity(req);
      },
    },
    async (request: FastifyRequest) => {
      const userId = request.authSession?.user?.id;
      if (!userId) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", false, "User authentication required");
      }

      const entitlements = await billingService.getEntitlements(userId);
      if (!entitlements.isPro) {
        throw new ApiError(400, "VALIDATION_FAILED", false, "No active Pro subscription found");
      }

      const portal = await billingService.stripeAdapter.createPortalSession(
        userId,
        `cus_${userId}`
      );
      return { data: portal };
    }
  );

  /**
   * POST /api/v1/billing/webhooks/stripe
   * Stripe event notification webhook
   */
  app.post(
    "/api/v1/billing/webhooks/stripe",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers["stripe-signature"];
      if (typeof signature !== "string") {
        throw new ApiError(400, "BILLING_INVALID_SIGNATURE", false, "Missing stripe-signature header");
      }

      const rawPayload = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
      const result = await billingService.handleStripeWebhook(rawPayload, signature);

      reply.code(200);
      return { data: result };
    }
  );

  /**
   * GET /api/v1/billing/webhooks/vnpay
   * VNPay IPN (Instant Payment Notification) callback
   */
  app.get(
    "/api/v1/billing/webhooks/vnpay",
    async (request: FastifyRequest) => {
      const query = request.query as VnpayIpnQuery;
      const ipnResult = await billingService.handleVnpayIpn(query);
      return ipnResult;
    }
  );
}
