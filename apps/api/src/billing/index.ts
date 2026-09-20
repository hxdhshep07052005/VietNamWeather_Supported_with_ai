/**
 * Phase 10 Billing Module
 * Multi-provider monetization and entitlement services
 */

export { QuotaService, type QuotaConsumeResult, getVietnamDateKey, getNextVietnamMidnight } from "./quota-service.js";
export { StripeAdapter, type StripeAdapterConfig } from "./stripe-adapter.js";
export { VnpayAdapter, type VnpayAdapterConfig } from "./vnpay-adapter.js";
export { BillingService, type BillingServiceDependencies, type ManualAuditLogEntry } from "./billing-service.js";
export { buildBillingRoutes, type BillingRoutesOptions } from "./routes.js";
export type { PaymentAdapter, WebhookProcessingResult } from "./payment-adapter.js";
