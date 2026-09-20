/**
 * Phase 11 AI Chatbot Contracts
 * Intelligent Travel Weather & Route Assistant with Grounded Tool Calling
 *
 * Decisions: AI-001..007, SEC-001, PRODUCT-004, MONET-004
 */

// =============================================================================
// Constants (AI-001, AI-002, AI-004, AI-005)
// =============================================================================

export const CHAT_ROLES = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
  TOOL: "tool",
} as const;

export type ChatRole = (typeof CHAT_ROLES)[keyof typeof CHAT_ROLES];

export const CHAT_TOOL_NAMES = {
  SEARCH_LOCATION: "tool_search_location",
  GET_CURRENT_WEATHER: "tool_get_current_weather",
  GET_FORECAST: "tool_get_forecast",
  ASSESS_TRAVEL_RISK: "tool_assess_travel_risk",
  EVALUATE_ROUTE: "tool_evaluate_route",
} as const;

export type ChatToolName = (typeof CHAT_TOOL_NAMES)[keyof typeof CHAT_TOOL_NAMES];

export const CHAT_QUOTA_LIMITS = {
  free: { dailyMessages: 3 },
  pro: { dailyMessages: 30 },
} as const;

export const CHAT_MAX_MESSAGE_LENGTH = 1000;
export const CHAT_MAX_HISTORY_TURNS = 10;

export const CHAT_ERROR_CODES = {
  QUOTA_EXCEEDED: "CHAT_QUOTA_EXCEEDED",
  MESSAGE_TOO_LONG: "CHAT_MESSAGE_TOO_LONG",
  PROVIDER_ERROR: "CHAT_PROVIDER_ERROR",
  DISABLED: "CHAT_DISABLED",
  INVALID_REQUEST: "CHAT_INVALID_REQUEST",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
} as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[keyof typeof CHAT_ERROR_CODES];

// =============================================================================
// DTOs & Interfaces
// =============================================================================

export interface ChatCitationDto {
  readonly source: string;
  readonly dataset: string;
  readonly timestamp: string;
  readonly locationName?: string;
  readonly coordinates?: { readonly latitude: number; readonly longitude: number };
}

export interface ChatMessageDto {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly timestamp: string;
  readonly citations?: ChatCitationDto[];
  readonly toolsUsed?: ChatToolName[];
  readonly disclaimer?: string;
}

export interface ChatRequestDto {
  readonly message: string;
  readonly locale?: "vi" | "en";
  readonly conversationId?: string;
}

export interface ChatResponseDto {
  readonly message: ChatMessageDto;
  readonly remainingQuota: number;
  readonly quotaLimit: number;
  readonly quotaResetAt: string;
}

export interface ChatHistoryDto {
  readonly conversationId: string;
  readonly messages: ChatMessageDto[];
  readonly count: number;
}

export interface ChatQuotaStatusDto {
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: string;
  readonly plan: "free" | "pro";
}

export interface ChatToolCallDto {
  readonly id: string;
  readonly name: ChatToolName;
  readonly parameters: Record<string, unknown>;
}

export interface ChatToolResultDto {
  readonly toolCallId: string;
  readonly name: ChatToolName;
  readonly result: Record<string, unknown>;
  readonly citation?: ChatCitationDto;
}
