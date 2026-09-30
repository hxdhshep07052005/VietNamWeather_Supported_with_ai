/**
 * Phase 11 Chat API Routes
 * Endpoints for sending messages, viewing history, clearing sessions, and checking quota
 *
 * Decisions: AI-001..007, SEC-001
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { type ChatRequestDto, PLAN_TYPES, type PlanType } from "@vietnam-weather/contracts";

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
        try {
          await requireAuth(req, reply);
        } catch {
          // Soft authentication permits guest interactions with daily quota
        }
        await requireMutationSecurity(req);
      },
    },
    async (request: FastifyRequest) => {
      let userId = request.authSession?.user?.id;
      let plan: PlanType = PLAN_TYPES.FREE;

      if (userId) {
        const entitlements = await billingService.getEntitlements(userId);
        plan = entitlements.plan;
      } else {
        const clientIp = request.ip || "guest";
        userId = `guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}`;
      }

      const body = request.body as ChatRequestDto;
      if (!body || !body.message) {
        throw new ApiError(400, "CHAT_INVALID_REQUEST", false, "Message body is required");
      }

      // Process message with quota check
      const response = await chatService.processMessage(userId, plan, body);

      return { data: response };
    }
  );

  /**
   * GET /api/v1/chat/history
   * Retrieves conversation turns for the current session
   */
  app.get(
    "/api/v1/chat/history",
    {
      preHandler: async (req, reply) => {
        try {
          await requireAuth(req, reply);
        } catch {
          // Soft authentication
        }
      },
    },
    async (request: FastifyRequest) => {
      const clientIp = request.ip || "guest";
      const query = request.query as { conversationId?: string } | undefined;
      const conversationId =
        query?.conversationId ||
        (request.authSession?.user?.id ? `conv_${request.authSession.user.id}` : `conv_guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}`);
      const userId = request.authSession?.user?.id ?? `guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const history = chatService.getHistory(userId, conversationId);

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
        try {
          await requireAuth(req, reply);
        } catch {
          // Soft authentication
        }
        await requireMutationSecurity(req);
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const clientIp = request.ip || "guest";
      const query = request.query as { conversationId?: string } | undefined;
      const conversationId =
        query?.conversationId ||
        (request.authSession?.user?.id ? `conv_${request.authSession.user.id}` : `conv_guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}`);
      const userId = request.authSession?.user?.id ?? `guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}`;
      chatService.clearHistory(userId, conversationId);

      reply.code(204).send();
    }
  );

  /**
   * GET /api/v1/chat/quota
   * Returns current daily chat message quota status
   */
  app.get(
    "/api/v1/chat/quota",
    {
      preHandler: async (req, reply) => {
        try {
          await requireAuth(req, reply);
        } catch {
          // Soft authentication
        }
      },
    },
    async (request: FastifyRequest) => {
      let userId = request.authSession?.user?.id;
      let plan: PlanType = PLAN_TYPES.FREE;

      if (userId) {
        const entitlements = await billingService.getEntitlements(userId);
        plan = entitlements.plan;
      } else {
        const clientIp = request.ip || "guest";
        userId = `guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}`;
      }

      const quotaStatus = await chatService.getQuotaStatus(userId, plan);

      return { data: quotaStatus };
    }
  );
}
