/**
 * Phase 10 VNPay Adapter
 * Handles VNPay 2.1.0 Payment URL Generation and IPN HMAC-SHA512 Verification
 *
 * Decisions: ARCH-001, MONET-002, MONET-003, MONET-006
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PAYMENT_PROVIDERS,
  PLAN_PRICING,
  type BillingInterval,
  type CheckoutSessionRequest,
  type CheckoutSessionResponse,
  type VnpayIpnQuery,
} from "@vietnam-weather/contracts";
import type { PaymentAdapter, WebhookProcessingResult } from "./payment-adapter.js";

export interface VnpayAdapterConfig {
  readonly tmnCode?: string;
  readonly hashSecret?: string;
  readonly payUrl?: string;
  readonly returnUrl: string;
}

export class VnpayAdapter implements PaymentAdapter {
  readonly provider = PAYMENT_PROVIDERS.VNPAY;

  constructor(private readonly config: VnpayAdapterConfig) {}

  /**
   * Generates a VNPay Pay URL with sorted query parameters and HMAC-SHA512 checksum
   */
  async createCheckoutSession(
    userId: string,
    _userEmail: string,
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResponse> {
    const interval: BillingInterval = request.interval ?? "month";
    const priceInfo = PLAN_PRICING.pro[interval].vnd;
    const tmnCode = this.config.tmnCode || "DEMOTMN1";
    const hashSecret = this.config.hashSecret || "DEMOSECRETKEYFORTESTING123456789";
    const payUrl = this.config.payUrl || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

    const date = new Date();
    const createDate = this.formatVnpayDate(date);
    const expireDate = this.formatVnpayDate(new Date(date.getTime() + 15 * 60 * 1000)); // 15 mins expiry
    const txnRef = `VN_${userId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8)}_${Date.now()}_${interval}`;

    // VNPay multiplies amount by 100
    const vnpAmount = (priceInfo.amount * 100).toString();

    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Nang cap Pro ${interval === "year" ? "1 Nam" : "1 Thang"} tai Vietnam Weather`,
      vnp_OrderType: "billpayment",
      vnp_Amount: vnpAmount,
      vnp_ReturnUrl: request.successUrl || this.config.returnUrl,
      vnp_IpAddr: "127.0.0.1",
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    // Sort parameters alphabetically
    const sortedKeys = Object.keys(params).sort();
    const signDataParts: string[] = [];
    const queryParts: string[] = [];

    for (const key of sortedKeys) {
      const val = params[key];
      if (val !== undefined && val !== null && val.length > 0) {
        signDataParts.push(`${key}=${encodeURIComponent(val)}`);
        queryParts.push(`${key}=${encodeURIComponent(val)}`);
      }
    }

    const signData = signDataParts.join("&");
    const secureHash = createHmac("sha512", hashSecret).update(signData).digest("hex");
    const checkoutUrl = `${payUrl}?${queryParts.join("&")}&vnp_SecureHash=${secureHash}`;

    return {
      checkoutUrl,
      sessionId: txnRef,
      provider: PAYMENT_PROVIDERS.VNPAY,
      plan: "pro",
      interval,
      amount: priceInfo.amount,
      currency: "VND",
      expiresAt: new Date(date.getTime() + 15 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Verifies VNPay IPN or Return URL HMAC-SHA512 checksum
   */
  verifyIpnChecksum(
    query: VnpayIpnQuery,
    secret = this.config.hashSecret || "DEMOSECRETKEYFORTESTING123456789"
  ): boolean {
    const secureHash = query.vnp_SecureHash;
    if (!secureHash) return false;

    // Filter out hash fields and sort alphabetically
    const cleanParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(query)) {
      if (key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && typeof val === "string" && val.length > 0) {
        cleanParams[key] = val;
      }
    }

    const sortedKeys = Object.keys(cleanParams).sort();
    const signData = sortedKeys.map((k) => `${k}=${encodeURIComponent(cleanParams[k]!)}`).join("&");
    const expectedHash = createHmac("sha512", secret).update(signData).digest("hex");

    try {
      const hashBuffer = Buffer.from(secureHash.toLowerCase(), "hex");
      const expectedBuffer = Buffer.from(expectedHash.toLowerCase(), "hex");
      if (hashBuffer.length !== expectedBuffer.length) return false;
      return timingSafeEqual(hashBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(
    rawPayload: string | Buffer,
    signatureHeader: string,
    secret = this.config.hashSecret || "DEMOSECRETKEYFORTESTING123456789"
  ): boolean {
    // VNPay passes query parameters; if rawPayload is query string
    const queryStr = Buffer.isBuffer(rawPayload) ? rawPayload.toString("utf8") : rawPayload;
    const parsed = Object.fromEntries(new URLSearchParams(queryStr).entries());
    parsed.vnp_SecureHash = signatureHeader;
    return this.verifyIpnChecksum(parsed, secret);
  }

  async parseWebhookEvent(
    rawPayload: string | Buffer,
    signatureHeader: string
  ): Promise<WebhookProcessingResult> {
    const queryStr = Buffer.isBuffer(rawPayload) ? rawPayload.toString("utf8") : rawPayload;
    const query = Object.fromEntries(new URLSearchParams(queryStr).entries());
    const secureHash = signatureHeader || query.vnp_SecureHash || "";
    query.vnp_SecureHash = secureHash;

    const isValid = this.verifyIpnChecksum(query);
    if (!isValid) {
      return {
        handled: false,
        eventId: "invalid_vnpay_hash",
        eventType: "invalid_hash",
      };
    }

    const txnRef = query.vnp_TxnRef || "";
    const responseCode = query.vnp_ResponseCode;
    const isSuccess = responseCode === "00";

    // Extract interval and user hint from txnRef: VN_{userId}_{timestamp}_{interval}
    const parts = txnRef.split("_");
    const interval: BillingInterval = parts[3] === "year" ? "year" : "month";
    const durationDays = interval === "year" ? 365 : 30;

    const now = new Date();
    const currentPeriodStart = now.toISOString();
    const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    return {
      handled: true,
      eventId: query.vnp_TransactionNo || txnRef,
      eventType: isSuccess ? "vnpay.payment.success" : "vnpay.payment.failed",
      userId: parts[1],
      plan: "pro",
      interval,
      status: isSuccess ? "active" : "canceled",
      currentPeriodStart,
      currentPeriodEnd,
      externalSubscriptionId: txnRef,
      externalCustomerId: query.vnp_BankCode,
    };
  }

  /**
   * Formats Date into VNPay required format: yyyyMMddHHmmss
   */
  private formatVnpayDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }
}
