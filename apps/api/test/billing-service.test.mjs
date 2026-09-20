/**
 * Phase 10 Billing Service Tests
 * Tests for multi-provider checkout, webhook reconciliation, idempotency, and entitlements
 *
 * Decisions: MONET-001..008, ARCH-001..003
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";

import {
  BillingService,
  StripeAdapter,
  VnpayAdapter,
} from "../dist/billing/index.js";

import {
  PLAN_PRICING,
  PAYMENT_PROVIDERS,
  SUBSCRIPTION_STATUSES,
} from "@vietnam-weather/contracts";

describe("Phase 10 Billing Service & Adapters", () => {
  let billingService;
  const testStripeSecret = "whsec_test_secret_for_unit_tests_123456";
  const testVnpaySecret = "VNPAYTESTSECRETKEY1234567890ABCDEF";

  beforeEach(() => {
    const stripeAdapter = new StripeAdapter({
      webhookSecret: testStripeSecret,
      defaultSuccessUrl: "http://localhost:3000/upgrade?status=success",
      defaultCancelUrl: "http://localhost:3000/upgrade?status=canceled",
    });

    const vnpayAdapter = new VnpayAdapter({
      hashSecret: testVnpaySecret,
      tmnCode: "TESTTMN01",
      returnUrl: "http://localhost:3000/upgrade?status=success",
    });

    billingService = new BillingService({ stripeAdapter, vnpayAdapter });
  });

  describe("Product Catalog & Pricing (MONET-001, PRODUCT-003)", () => {
    it("should return both Free and Pro plans", () => {
      const plans = billingService.getPlans("vi");
      assert.strictEqual(plans.length, 2);
      assert.strictEqual(plans[0].id, "free");
      assert.strictEqual(plans[1].id, "pro");
    });

    it("should price Pro Yearly at 10x Monthly (PRODUCT-003)", () => {
      const monthlyVnd = PLAN_PRICING.pro.month.vnd.amount;
      const yearlyVnd = PLAN_PRICING.pro.year.vnd.amount;

      assert.strictEqual(monthlyVnd, 99_000);
      assert.strictEqual(yearlyVnd, 990_000);
      assert.strictEqual(yearlyVnd, monthlyVnd * 10);
    });

    it("should support localized plans in Vietnamese and English", () => {
      const viPlans = billingService.getPlans("vi");
      const enPlans = billingService.getPlans("en");

      assert.strictEqual(viPlans[1].name, "Gói PRO Cao Cấp");
      assert.strictEqual(enPlans[1].name, "Pro Traveler");
    });
  });

  describe("Stripe Checkout & Webhooks (MONET-002, MONET-006)", () => {
    it("should generate Stripe checkout session URL", async () => {
      const session = await billingService.createCheckoutSession("user_stripe_1", "test@test.com", {
        plan: "pro",
        interval: "month",
        provider: PAYMENT_PROVIDERS.STRIPE,
      });

      assert.ok(session.checkoutUrl.includes("session_id="));
      assert.strictEqual(session.provider, "stripe");
      assert.strictEqual(session.amount, 99_000);
    });

    it("should verify valid Stripe webhook signature and activate Pro", async () => {
      const eventId = `evt_test_${Date.now()}`;
      const payloadObj = {
        id: eventId,
        type: "checkout.session.completed",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            client_reference_id: "user_webhook_1",
            subscription: "sub_123456",
            customer: "cus_123456",
            metadata: { interval: "year", userId: "user_webhook_1" },
          },
        },
      };

      const payloadStr = JSON.stringify(payloadObj);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", testStripeSecret)
        .update(`${timestamp}.${payloadStr}`)
        .digest("hex");
      const signatureHeader = `t=${timestamp},v1=${signature}`;

      const res = await billingService.handleStripeWebhook(payloadStr, signatureHeader);
      assert.strictEqual(res.received, true);
      assert.strictEqual(res.processed, true);

      // Verify user entitlement is now PRO
      const ent = await billingService.getEntitlements("user_webhook_1");
      assert.strictEqual(ent.isPro, true);
      assert.strictEqual(ent.plan, "pro");
      assert.strictEqual(ent.capabilities.futureTimeline, true);
      assert.strictEqual(ent.capabilities.maxRouteAlternatives, 3);
    });

    it("should reject invalid Stripe webhook signatures", async () => {
      const payloadStr = JSON.stringify({ id: "evt_fake", type: "test" });
      const signatureHeader = `t=${Math.floor(Date.now() / 1000)},v1=invalid_signature_hex`;

      await assert.rejects(
        () => billingService.handleStripeWebhook(payloadStr, signatureHeader),
        (err) => err.code === "BILLING_INVALID_SIGNATURE"
      );
    });

    it("should be idempotent and ignore duplicate Stripe webhooks", async () => {
      const eventId = `evt_dup_${Date.now()}`;
      const payloadObj = {
        id: eventId,
        type: "checkout.session.completed",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            client_reference_id: "user_dup_1",
            subscription: "sub_dup",
            metadata: { interval: "month", userId: "user_dup_1" },
          },
        },
      };

      const payloadStr = JSON.stringify(payloadObj);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", testStripeSecret)
        .update(`${timestamp}.${payloadStr}`)
        .digest("hex");
      const signatureHeader = `t=${timestamp},v1=${signature}`;

      // First run: processes
      const first = await billingService.handleStripeWebhook(payloadStr, signatureHeader);
      assert.strictEqual(first.processed, true);

      // Second run: ignored as duplicate
      const second = await billingService.handleStripeWebhook(payloadStr, signatureHeader);
      assert.strictEqual(second.received, true);
      assert.strictEqual(second.processed, false);
    });
  });

  describe("VNPay Checkout & IPN (MONET-002, MONET-003, MONET-006)", () => {
    it("should generate valid VNPay Pay URL with HMAC-SHA512 checksum", async () => {
      const session = await billingService.createCheckoutSession("user_vnpay_1", "vnpay@test.com", {
        plan: "pro",
        interval: "month",
        provider: PAYMENT_PROVIDERS.VNPAY,
      });

      assert.ok(session.checkoutUrl.includes("vnp_SecureHash="));
      assert.ok(session.checkoutUrl.includes("vnp_Amount=9900000")); // 99,000 * 100
      assert.strictEqual(session.provider, "vnpay");
    });

    it("should process valid VNPay IPN and activate Pro", async () => {
      const txnRef = `VN_uservnp1_${Date.now()}_year`;
      const queryParams = {
        vnp_Amount: "99000000",
        vnp_BankCode: "NCB",
        vnp_Command: "pay",
        vnp_PayDate: "20260814120000",
        vnp_ResponseCode: "00",
        vnp_TmnCode: "TESTTMN01",
        vnp_TransactionNo: `TRANS_${Date.now()}`,
        vnp_TransactionStatus: "00",
        vnp_TxnRef: txnRef,
      };

      // Compute valid VNPay signature
      const sortedKeys = Object.keys(queryParams).sort();
      const signData = sortedKeys.map((k) => `${k}=${encodeURIComponent(queryParams[k])}`).join("&");
      const secureHash = createHmac("sha512", testVnpaySecret).update(signData).digest("hex");

      const fullIpnQuery = {
        ...queryParams,
        vnp_SecureHash: secureHash,
      };

      const ipnRes = await billingService.handleVnpayIpn(fullIpnQuery);
      assert.strictEqual(ipnRes.RspCode, "00");
      assert.strictEqual(ipnRes.Message, "Confirm Success");

      // Verify entitlement
      const ent = await billingService.getEntitlements("uservnp1");
      assert.strictEqual(ent.isPro, true);
      assert.strictEqual(ent.capabilities.futureTimeline, true);
    });

    it("should reject VNPay IPN with invalid checksum", async () => {
      const fullIpnQuery = {
        vnp_Amount: "99000000",
        vnp_ResponseCode: "00",
        vnp_TxnRef: "VN_fake_123",
        vnp_SecureHash: "invalid_hash_value",
      };

      const ipnRes = await billingService.handleVnpayIpn(fullIpnQuery);
      assert.strictEqual(ipnRes.RspCode, "97");
      assert.strictEqual(ipnRes.Message, "Checksum failed");
    });
  });

  describe("Administrative Manual Overrides & Audit Log (MONET-008)", () => {
    it("should allow admin to manually grant Pro with audit trail", async () => {
      const sub = await billingService.manualGrantPro(
        "user_manual_1",
        "admin_operator_99",
        30,
        "Customer support compensation for downtime"
      );

      assert.strictEqual(sub.status, SUBSCRIPTION_STATUSES.ACTIVE);
      assert.strictEqual(sub.plan, "pro");

      const ent = await billingService.getEntitlements("user_manual_1");
      assert.strictEqual(ent.isPro, true);

      const logs = billingService.getAuditLogs();
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].operatorId, "admin_operator_99");
      assert.strictEqual(logs[0].action, "GRANT_PRO");
    });

    it("should reject manual grant without sufficient reason", async () => {
      await assert.rejects(
        () => billingService.manualGrantPro("user_manual_2", "admin_1", 30, "short"),
        (err) => err.code === "VALIDATION_FAILED"
      );
    });
  });
});
