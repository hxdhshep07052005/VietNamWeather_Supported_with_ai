/**
 * Phase 11 Chat API Routes
 * Endpoints for sending messages, viewing history, clearing sessions, and checking quota
 *
 * Decisions: AI-001..007, SEC-001
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ChatRequestDto } from "@vietnam-weather/contracts";

import { ApiError } from "../errors.js";
import type { BillingService } from "../billing/billing-service.js";
import type { ChatService } from "./chat-service.js";

export interface ChatRoutesOptions {
  readonly chatService: ChatService;
  readonly billingService: BillingService;
  readonly requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  readonly requireMutationSecurity: (request: FastifyRequest) => Promise<void>;
}

export function buildChatRoutes(app: FastifyInstance, options: ChatRoutesOptions): void {
  const { chatService, billingService, requireAuth, requireMutationSecurity } = options;

  /**
   * POST /api/v1/chat/message
   * Sends user prompt, calls grounding tools, returns response with citations
   */
  app.post(
    "/api/v1/chat/message",
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

      const body = request.body as ChatRequestDto;
      if (!body || !body.message) {
        throw new ApiError(400, "CHAT_INVALID_REQUEST", false, "Message body is required");
      }

      // Determine user tier (Free vs Pro)
      const entitlements = await billingService.getEntitlements(userId);
      const response = await chatService.processMessage(userId, entitlements.plan, body);

      return { data: response };
    }
  );

  /**
   * GET /api/v1/chat/history
   * Retrieves conversation turns for the current session
   */
  app.get(
    "/api/v1/chat/history",
    { preHandler: requireAuth },
    async (request: FastifyRequest) => {
      const userId = request.authSession?.user?.id;
      if (!userId) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", false, "User authentication required");
      }

      const query = request.query as { conversationId?: string } | undefined;
      const conversationId = query?.conversationId || `conv_${userId}`;
      const history = chatService.getHistory(conversationId);

      return { data: history };
    }
  );

  /**
   * DELETE /api/v1/chat/history
   * Clears session turns to protect privacy (PRIVACY-001)
   */
  app.delete(
    "/api/v1/chat/history",
    {
      preHandler: async (req, reply) => {
        await requireAuth(req, reply);
        await requireMutationSecurity(req);
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.authSession?.user?.id;
      if (!userId) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", false, "User authentication required");
      }

      const query = request.query as { conversationId?: string } | undefined;
      const conversationId = query?.conversationId || `conv_${userId}`;
      chatService.clearHistory(conversationId);

      reply.code(204).send();
    }
  );

  /**
   * GET /api/v1/chat/quota
   * Returns current daily chat message quota status
   */
  app.get(
    "/api/v1/chat/quota",
    { preHandler: requireAuth },
    async (request: FastifyRequest) => {
      const userId = request.authSession?.user?.id;
      if (!userId) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", false, "User authentication required");
      }

      const entitlements = await billingService.getEntitlements(userId);
      const quotaStatus = await chatService.getQuotaStatus(userId, entitlements.plan);

      return { data: quotaStatus };
    }
  );
}
