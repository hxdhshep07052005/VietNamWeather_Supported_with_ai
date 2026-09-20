/**
 * Phase 10 Quota Service Tests
 * Tests for atomic daily usage limits and midnight VN timezone resets
 *
 * Decisions: MONET-004, PRODUCT-004, PRODUCT-005
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

import {
  QuotaService,
  getVietnamDateKey,
  getNextVietnamMidnight,
} from "../dist/billing/quota-service.js";

import {
  ENTITLEMENT_LIMITS,
  QUOTA_RESET_TIMEZONE,
} from "@vietnam-weather/contracts";

describe("Phase 10 Quota Service", () => {
  let quotaService;

  beforeEach(() => {
    quotaService = new QuotaService();
    quotaService.clearAll();
  });

  describe("Constants & Decision Alignment (MONET-004, PRODUCT-004, PRODUCT-005)", () => {
    it("should enforce Free daily search limit of 10", () => {
      assert.strictEqual(ENTITLEMENT_LIMITS.free.dailyLocationSearch, 10);
    });

    it("should enforce Free daily route evaluation limit of 3", () => {
      assert.strictEqual(ENTITLEMENT_LIMITS.free.dailyRouteEvaluation, 3);
    });

    it("should enforce Pro daily search limit of 200", () => {
      assert.strictEqual(ENTITLEMENT_LIMITS.pro.dailyLocationSearch, 200);
    });

    it("should enforce Pro daily route evaluation limit of 30", () => {
      assert.strictEqual(ENTITLEMENT_LIMITS.pro.dailyRouteEvaluation, 30);
    });

    it("should align reset timezone with Asia/Ho_Chi_Minh", () => {
      assert.strictEqual(QUOTA_RESET_TIMEZONE, "Asia/Ho_Chi_Minh");
    });

    it("should format Vietnam date key correctly as YYYY-MM-DD", () => {
      const dateKey = getVietnamDateKey();
      assert.match(dateKey, /^\d{4}-\d{2}-\d{2}$/);
    });

    it("should compute next Vietnam midnight in the future", () => {
      const nextMidnight = getNextVietnamMidnight();
      const now = new Date();
      assert.ok(nextMidnight.getTime() > now.getTime());
      // Must be within 24 hours
      assert.ok(nextMidnight.getTime() - now.getTime() <= 24 * 60 * 60 * 1000);
    });
  });

  describe("Atomic Quota Consumption", () => {
    it("should allow consumption within limits for Free tier", async () => {
      const res = await quotaService.consume("user_1", "locationSearch", "free", 1);
      assert.strictEqual(res.allowed, true);
      assert.strictEqual(res.used, 1);
      assert.strictEqual(res.remaining, 9);
      assert.strictEqual(res.limit, 10);
    });

    it("should reject consumption when limit is exceeded", async () => {
      // Consume 10 times
      for (let i = 0; i < 10; i++) {
        const r = await quotaService.consume("user_2", "locationSearch", "free", 1);
        assert.strictEqual(r.allowed, true);
      }

      // 11th time should fail
      const failed = await quotaService.consume("user_2", "locationSearch", "free", 1);
      assert.strictEqual(failed.allowed, false);
      assert.strictEqual(failed.remaining, 0);
      assert.strictEqual(failed.used, 10);
    });

    it("should allow higher limits for Pro tier", async () => {
      // Consume 20 times on Pro (exceeds Free 10, but well within Pro 200)
      for (let i = 0; i < 20; i++) {
        const r = await quotaService.consume("user_pro", "locationSearch", "pro", 1);
        assert.strictEqual(r.allowed, true);
      }

      const status = await quotaService.getStatus("user_pro", "pro");
      assert.strictEqual(status.quotas.locationSearch.used, 20);
      assert.strictEqual(status.quotas.locationSearch.remaining, 180);
      assert.strictEqual(status.quotas.locationSearch.limit, 200);
    });

    it("should track route evaluations independently of searches", async () => {
      await quotaService.consume("user_split", "locationSearch", "free", 5);
      await quotaService.consume("user_split", "routeEvaluation", "free", 2);

      const status = await quotaService.getStatus("user_split", "free");
      assert.strictEqual(status.quotas.locationSearch.used, 5);
      assert.strictEqual(status.quotas.locationSearch.remaining, 5);

      assert.strictEqual(status.quotas.routeEvaluation.used, 2);
      assert.strictEqual(status.quotas.routeEvaluation.remaining, 1);
    });

    it("should reset quota on demand", async () => {
      await quotaService.consume("user_reset", "locationSearch", "free", 8);
      quotaService.resetForUser("user_reset");

      const status = await quotaService.getStatus("user_reset", "free");
      assert.strictEqual(status.quotas.locationSearch.used, 0);
      assert.strictEqual(status.quotas.locationSearch.remaining, 10);
    });
  });
});
