/**
 * Phase 10 Quota Service
 * Thread-safe atomic daily usage counter aligned with Asia/Ho_Chi_Minh midnight reset
 *
 * Decisions: MONET-004, PRODUCT-004, PRODUCT-005
 */

import type { Redis } from "ioredis";
import {
  ENTITLEMENT_LIMITS,
  QUOTA_RESET_TIMEZONE,
  CHAT_QUOTA_LIMITS,
  type PlanType,
  type UserQuotaStatusDto,
  type QuotaItemStatus,
  type ChatQuotaStatusDto,
} from "@vietnam-weather/contracts";

export interface QuotaConsumeResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  readonly used: number;
  readonly resetAt: string;
}

export function getVietnamDateKey(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: QUOTA_RESET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // Returns YYYY-MM-DD
}

export function getNextVietnamMidnight(now = new Date()): Date {
  const vnOffsetMs = 7 * 60 * 60 * 1000;
  const vnNow = new Date(now.getTime() + vnOffsetMs);

  const vnNextMidnight = new Date(
    Date.UTC(
      vnNow.getUTCFullYear(),
      vnNow.getUTCMonth(),
      vnNow.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );

  return new Date(vnNextMidnight.getTime() - vnOffsetMs);
}

export class QuotaService {
  // Key format: `${userId}:${dateKey}:${capability}` -> counter
  private readonly usageMap = new Map<string, number>();
  private readonly redis?: Redis;

  constructor(redis?: Redis) {
    this.redis = redis;
  }

  /**
   * Atomically consumes quota for a capability.
   * If limit is reached, returns allowed: false without consuming.
   */
  async consume(
    userId: string,
    capability: "locationSearch" | "routeEvaluation" | "chatMessage",
    plan: PlanType,
    amount = 1
  ): Promise<QuotaConsumeResult> {
    const dateKey = getVietnamDateKey();
    const nextReset = getNextVietnamMidnight().toISOString();
    const mapKey = `${userId}:${dateKey}:${capability}`;

    let limit: number;
    if (capability === "chatMessage") {
      limit = plan === "pro" ? CHAT_QUOTA_LIMITS.pro.dailyMessages : CHAT_QUOTA_LIMITS.free.dailyMessages;
    } else if (capability === "locationSearch") {
      limit = ENTITLEMENT_LIMITS[plan].dailyLocationSearch;
    } else {
      limit = ENTITLEMENT_LIMITS[plan].dailyRouteEvaluation;
    }

    if (this.redis) {
      try {
        const redisKey = `quota:v1:${userId}:${dateKey}:${capability}`;
        const ttlMs = Math.max(1000, getNextVietnamMidnight().getTime() - Date.now());

        const script = `
          local current = tonumber(redis.call('GET', KEYS[1])) or 0
          local limit = tonumber(ARGV[1])
          local amount = tonumber(ARGV[2])
          local ttlMs = tonumber(ARGV[3])
          if current + amount > limit then
            return { 0, current }
          else
            local newUsed = current + amount
            redis.call('SET', KEYS[1], newUsed, 'PX', ttlMs)
            return { 1, newUsed }
          end
        `;

        const result = (await this.redis.eval(
          script,
          1,
          redisKey,
          limit.toString(),
          amount.toString(),
          ttlMs.toString()
        )) as [number, number];

        const allowed = result[0] === 1;
        const used = Number(result[1]);

        return {
          allowed,
          remaining: Math.max(0, limit - used),
          limit,
          used,
          resetAt: nextReset,
        };
      } catch {
        // Fallback to in-memory store if Redis evaluation encounters an error
      }
    }

    const currentUsed = this.usageMap.get(mapKey) ?? 0;

    if (currentUsed + amount > limit) {
      return {
        allowed: false,
        remaining: Math.max(0, limit - currentUsed),
        limit,
        used: currentUsed,
        resetAt: nextReset,
      };
    }

    const newUsed = currentUsed + amount;
    this.usageMap.set(mapKey, newUsed);

    return {
      allowed: true,
      remaining: limit - newUsed,
      limit,
      used: newUsed,
      resetAt: nextReset,
    };
  }

  /**
   * Retrieves comprehensive quota status for a user today.
   */
  async getStatus(
    userId: string,
    plan: PlanType,
    savedLocationsCount = 0,
    savedRoutesCount = 0
  ): Promise<UserQuotaStatusDto> {
    const dateKey = getVietnamDateKey();
    const nextReset = getNextVietnamMidnight().toISOString();

    let searchUsed = 0;
    let routeUsed = 0;

    if (this.redis) {
      try {
        const searchKey = `quota:v1:${userId}:${dateKey}:locationSearch`;
        const routeKey = `quota:v1:${userId}:${dateKey}:routeEvaluation`;
        const [searchVal, routeVal] = await Promise.all([
          this.redis.get(searchKey),
          this.redis.get(routeKey),
        ]);
        searchUsed = searchVal ? parseInt(searchVal, 10) || 0 : 0;
        routeUsed = routeVal ? parseInt(routeVal, 10) || 0 : 0;
      } catch {
        searchUsed = this.usageMap.get(`${userId}:${dateKey}:locationSearch`) ?? 0;
        routeUsed = this.usageMap.get(`${userId}:${dateKey}:routeEvaluation`) ?? 0;
      }
    } else {
      searchUsed = this.usageMap.get(`${userId}:${dateKey}:locationSearch`) ?? 0;
      routeUsed = this.usageMap.get(`${userId}:${dateKey}:routeEvaluation`) ?? 0;
    }

    const searchLimit = ENTITLEMENT_LIMITS[plan].dailyLocationSearch;
    const routeLimit = ENTITLEMENT_LIMITS[plan].dailyRouteEvaluation;

    const locationSearchStatus: QuotaItemStatus = {
      capability: "locationSearch",
      used: searchUsed,
      limit: searchLimit,
      remaining: Math.max(0, searchLimit - searchUsed),
      resetAt: nextReset,
    };

    const routeEvaluationStatus: QuotaItemStatus = {
      capability: "routeEvaluation",
      used: routeUsed,
      limit: routeLimit,
      remaining: Math.max(0, routeLimit - routeUsed),
      resetAt: nextReset,
    };

    return {
      userId,
      plan,
      timezone: QUOTA_RESET_TIMEZONE,
      resetAt: nextReset,
      quotas: {
        locationSearch: locationSearchStatus,
        routeEvaluation: routeEvaluationStatus,
        savedLocations: {
          current: savedLocationsCount,
          limit: ENTITLEMENT_LIMITS[plan].maxSavedLocations,
        },
        savedRoutes: {
          current: savedRoutesCount,
          limit: ENTITLEMENT_LIMITS[plan].maxSavedRoutes,
        },
      },
    };
  }

  /**
   * Retrieves chat message quota status for a user today.
   */
  async getChatStatus(userId: string, plan: PlanType): Promise<ChatQuotaStatusDto> {
    const dateKey = getVietnamDateKey();
    const nextReset = getNextVietnamMidnight().toISOString();

    let used = 0;
    if (this.redis) {
      try {
        const chatKey = `quota:v1:${userId}:${dateKey}:chatMessage`;
        const chatVal = await this.redis.get(chatKey);
        used = chatVal ? parseInt(chatVal, 10) || 0 : 0;
      } catch {
        used = this.usageMap.get(`${userId}:${dateKey}:chatMessage`) ?? 0;
      }
    } else {
      used = this.usageMap.get(`${userId}:${dateKey}:chatMessage`) ?? 0;
    }

    const limit = plan === "pro" ? CHAT_QUOTA_LIMITS.pro.dailyMessages : CHAT_QUOTA_LIMITS.free.dailyMessages;

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: nextReset,
      plan,
    };
  }

  /**
   * Resets usage for a user (used in testing or administrative resets)
   */
  resetForUser(userId: string): void {
    const dateKey = getVietnamDateKey();
    this.usageMap.delete(`${userId}:${dateKey}:locationSearch`);
    this.usageMap.delete(`${userId}:${dateKey}:routeEvaluation`);
    this.usageMap.delete(`${userId}:${dateKey}:chatMessage`);

    if (this.redis) {
      this.redis
        .del(
          `quota:v1:${userId}:${dateKey}:locationSearch`,
          `quota:v1:${userId}:${dateKey}:routeEvaluation`,
          `quota:v1:${userId}:${dateKey}:chatMessage`
        )
        .catch(() => undefined);
    }
  }

  /**
   * Clears all in-memory usage records
   */
  clearAll(): void {
    this.usageMap.clear();
  }
}
