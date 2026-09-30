/**
 * Phase 11 Chat Service
 * Core orchestrator for Chatbot requests, prompt security, quota checks, and conversation state
 *
 * Decisions: AI-001..007, SEC-001, MONET-004
 */

import {
  CHAT_MAX_MESSAGE_LENGTH,
  CHAT_MAX_HISTORY_TURNS,
  CHAT_ERROR_CODES,
  type ChatRequestDto,
  type ChatResponseDto,
  type ChatHistoryDto,
  type ChatMessageDto,
  type ChatQuotaStatusDto,
  type PlanType,
} from "@vietnam-weather/contracts";

import { ApiError } from "../errors.js";
import { QuotaService } from "../billing/quota-service.js";
import { ChatToolEngine } from "./chat-tools.js";
import { GroundedRuleEngineAdapter, type LlmAdapter } from "./llm-adapter.js";

export interface ChatServiceOptions {
  readonly quotaService?: QuotaService;
  readonly toolEngine?: ChatToolEngine;
  readonly llmAdapter?: LlmAdapter;
}

export class ChatService {
  private readonly quotaService: QuotaService;
  private readonly toolEngine: ChatToolEngine;
  private readonly llmAdapter: LlmAdapter;

  // Scope client-selected conversation IDs to the authenticated caller.
  private readonly historyStore = new Map<string, ChatMessageDto[]>();

  constructor(options?: ChatServiceOptions) {
    this.quotaService = options?.quotaService ?? new QuotaService();
    this.toolEngine = options?.toolEngine ?? new ChatToolEngine();
    this.llmAdapter = options?.llmAdapter ?? new GroundedRuleEngineAdapter();
  }

  /**
   * Sanitizes input string and strips potential injection patterns
   * Per AI-005
   */
  sanitizeInput(input: string): string {
    if (!input || typeof input !== "string") {
      throw new ApiError(400, CHAT_ERROR_CODES.INVALID_REQUEST, false, "Message cannot be empty");
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      throw new ApiError(400, CHAT_ERROR_CODES.INVALID_REQUEST, false, "Message cannot be empty");
    }

    if (trimmed.length > CHAT_MAX_MESSAGE_LENGTH) {
      throw new ApiError(
        400,
        CHAT_ERROR_CODES.MESSAGE_TOO_LONG,
        false,
        `Message exceeds maximum length of ${CHAT_MAX_MESSAGE_LENGTH} characters`
      );
    }

    // Strip common adversarial prompt injection delimiters
    return trimmed
      .replace(/###\s*System:?/gi, "")
      .replace(/\[INST\]/gi, "")
      .replace(/\[\/INST\]/gi, "")
      .replace(/<\|im_start\|>/gi, "")
      .replace(/<\|im_end\|>/gi, "");
  }

  /**
   * Processes a user chat message with atomic quota metering and grounding
   */
  async processMessage(
    userId: string,
    plan: PlanType,
    request: ChatRequestDto
  ): Promise<ChatResponseDto> {
    const cleanMessage = this.sanitizeInput(request.message);
    const locale = request.locale === "en" ? "en" : "vi";
    const conversationKey = JSON.stringify([userId, request.conversationId || `conv_${userId}`]);

    // 1. Quota check & atomic consumption (Per AI-002, MONET-004)
    const quotaResult = await this.quotaService.consume(userId, "chatMessage", plan, 1);
    if (!quotaResult.allowed) {
      throw new ApiError(
        429,
        CHAT_ERROR_CODES.QUOTA_EXCEEDED,
        false,
        `Daily chat quota exceeded (${quotaResult.used}/${quotaResult.limit} messages used). Resets at ${quotaResult.resetAt}`
      );
    }

    // 2. Fetch existing session history
    const existingHistory = this.historyStore.get(conversationKey) ?? [];

    // 3. Generate grounded response
    const generated = await this.llmAdapter.generate(
      cleanMessage,
      existingHistory,
      locale,
      this.toolEngine
    );

    const nowIso = new Date().toISOString();
    const userMsg: ChatMessageDto = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content: cleanMessage,
      timestamp: nowIso,
    };

    const assistantMsg: ChatMessageDto = {
      id: `msg_a_${Date.now() + 1}`,
      role: "assistant",
      content: generated.content,
      timestamp: nowIso,
      citations: generated.citations,
      toolsUsed: generated.toolsUsed,
      disclaimer: generated.disclaimer,
    };

    // 4. Update session history (capped at CHAT_MAX_HISTORY_TURNS)
    const updatedHistory = [...existingHistory, userMsg, assistantMsg].slice(
      -CHAT_MAX_HISTORY_TURNS * 2
    );
    this.historyStore.set(conversationKey, updatedHistory);

    return {
      message: assistantMsg,
      remainingQuota: quotaResult.remaining,
      quotaLimit: quotaResult.limit,
      quotaResetAt: quotaResult.resetAt,
    };
  }

  /**
   * Retrieves conversation history for current session
   * Per AI-004
   */
  getHistory(userId: string, conversationId = `conv_${userId}`): ChatHistoryDto {
    const messages = this.historyStore.get(JSON.stringify([userId, conversationId])) ?? [];
    return {
      conversationId,
      messages,
      count: messages.length,
    };
  }

  /**
   * Clears conversation history for current session
   * Per AI-004, PRIVACY-001
   */
  clearHistory(userId: string, conversationId = `conv_${userId}`): void {
    this.historyStore.delete(JSON.stringify([userId, conversationId]));
  }

  /**
   * Retrieves today's chat quota status for a user
   */
  async getQuotaStatus(userId: string, plan: PlanType): Promise<ChatQuotaStatusDto> {
    return this.quotaService.getChatStatus(userId, plan);
  }
}
