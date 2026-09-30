/**
 * Phase 11 Gemini LLM Adapter
 * Integrates Google Gemini models with function calling for allowlisted grounding tools
 * Falls back to GroundedRuleEngineAdapter when API key is unavailable or on network failures
 *
 * Decisions: AI-001, AI-003, AI-006, SEC-001
 */

import {
  CHAT_TOOL_NAMES,
  type ChatToolName,
  type ChatCitationDto,
  type ChatMessageDto,
} from "@vietnam-weather/contracts";

import type { ChatToolEngine } from "./chat-tools.js";
import {
  GroundedRuleEngineAdapter,
  type LlmAdapter,
  type GenerateChatResult,
} from "./llm-adapter.js";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const TOOL_DECLARATIONS = [
  {
    name: CHAT_TOOL_NAMES.SEARCH_LOCATION,
    description: "Tra cứu thông tin vị trí, tọa độ địa lý tỉnh thành tại Việt Nam",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Tên địa điểm hoặc tỉnh thành" },
      },
      required: ["query"],
    },
  },
  {
    name: CHAT_TOOL_NAMES.GET_CURRENT_WEATHER,
    description: "Lấy dữ liệu quan trắc thời tiết hiện tại tại một tỉnh thành",
    parameters: {
      type: "OBJECT",
      properties: {
        location: { type: "STRING", description: "Tên tỉnh thành hoặc địa điểm" },
      },
      required: ["location"],
    },
  },
  {
    name: CHAT_TOOL_NAMES.GET_FORECAST,
    description: "Lấy dự báo thời tiết 24h - 72h tới",
    parameters: {
      type: "OBJECT",
      properties: {
        location: { type: "STRING", description: "Tên địa điểm" },
        hours: { type: "NUMBER", description: "Số giờ dự báo (24 hoặc 72)" },
      },
      required: ["location"],
    },
  },
  {
    name: CHAT_TOOL_NAMES.ASSESS_TRAVEL_RISK,
    description: "Đánh giá mức độ rủi ro du lịch và an toàn giao thông cho xe máy hoặc ô tô",
    parameters: {
      type: "OBJECT",
      properties: {
        location: { type: "STRING", description: "Tên địa điểm" },
        vehicleType: { type: "STRING", enum: ["car", "motorcycle"], description: "Loại phương tiện di chuyển" },
      },
      required: ["location"],
    },
  },
  {
    name: CHAT_TOOL_NAMES.EVALUATE_ROUTE,
    description: "Đánh giá lộ trình di chuyển giữa 2 điểm với 3 hành lang thời tiết",
    parameters: {
      type: "OBJECT",
      properties: {
        origin: { type: "STRING", description: "Điểm khởi hành" },
        destination: { type: "STRING", description: "Điểm đến" },
        vehicleType: { type: "STRING", enum: ["car", "motorcycle"], description: "Loại phương tiện" },
      },
      required: ["origin", "destination"],
    },
  },
];

export class GeminiLlmAdapter implements LlmAdapter {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fallbackAdapter: GroundedRuleEngineAdapter;

  constructor(apiKey?: string, baseUrl?: string, model?: string) {
    this.apiKey =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      "sk-d2e45af9b966ac7a-hjw8ib-346cb898";
    this.baseUrl =
      baseUrl ||
      process.env.GEMINI_BASE_URL ||
      (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production"
        ? "http://host.docker.internal:20128/v1"
        : "http://localhost:20128/v1");
    this.model = model || process.env.GEMINI_MODEL || "ag/gemini-3.8-flash-high";
    this.fallbackAdapter = new GroundedRuleEngineAdapter();
  }

  async generate(
    userMessage: string,
    history: ChatMessageDto[],
    locale: "vi" | "en" = "vi",
    toolEngine: ChatToolEngine
  ): Promise<GenerateChatResult> {
    // 1. Always evaluate grounding tools to obtain ground truth data & provenance citations
    const groundedResult = await this.fallbackAdapter.generate(
      userMessage,
      history,
      locale,
      toolEngine
    );

    // 2. Synthesize natural language via OpenAI-compatible Gemini endpoint if configured
    if (this.apiKey && this.baseUrl) {
      try {
        const isEn = locale === "en";
        const systemPrompt = isEn
          ? "You are the Vietnam Weather AI travel assistant (VietForecast). " +
            "Your goal is to answer the user's travel weather or routing questions naturally, clearly, and concisely, " +
            "based STRICTLY on the real meteorological ground truth data provided below. " +
            "Never fabricate weather data or thresholds. Keep answers structured in Markdown with bullet points or tables where appropriate."
          : "Bạn là Trợ lý Du lịch Thời tiết Thông minh VietForecast tại Việt Nam. " +
            "Nhiệm vụ của bạn là giải đáp câu hỏi của người dùng về thời tiết du lịch và lộ trình một cách tự nhiên, súc tích, chuyên nghiệp, " +
            "dựa HOÀN TOÀN trên số liệu quan trắc thực tế được cung cấp dưới đây. " +
            "Tuyệt đối không bịa đặt số liệu thời tiết. Định dạng câu trả lời rõ ràng bằng Markdown.";

        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
        ];

        for (const h of history.slice(-4)) {
          messages.push({
            role: h.role === "user" ? "user" : "assistant",
            content: h.content,
          });
        }

        const promptWithData = isEn
          ? `USER QUESTION: ${userMessage}\n\nREAL GROUND TRUTH WEATHER & ROUTE TELEMETRY:\n${groundedResult.content}`
          : `CÂU HỎI CỦA NGƯỜI DÙNG: ${userMessage}\n\nDỮ LIỆU THỜI TIẾT & LỘ TRÌNH QUAN TRẮC THỰC TẾ TỪ TRẠM:\n${groundedResult.content}`;

        messages.push({ role: "user", content: promptWithData });

        const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            stream: false,
            temperature: 0.3,
            max_tokens: 1024,
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (response.ok) {
          const json = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = json?.choices?.[0]?.message?.content;
          if (content && typeof content === "string" && content.trim().length > 0) {
            return {
              content: content.trim(),
              citations: groundedResult.citations,
              toolsUsed: groundedResult.toolsUsed,
              disclaimer: groundedResult.disclaimer,
            };
          }
        }
      } catch {
        // Fallback gracefully on timeout or connection error
      }
    }

    return groundedResult;
  }

  private async callGeminiWithTools(
    userMessage: string,
    history: ChatMessageDto[],
    locale: "vi" | "en",
    toolEngine: ChatToolEngine
  ): Promise<GenerateChatResult> {
    const citations: ChatCitationDto[] = [];
    const toolsUsed: ChatToolName[] = [];

    const systemInstruction = {
      role: "user",
      parts: [
        {
          text:
            "SYSTEM: You are the Vietnam Weather AI travel assistant. Provide accurate, grounded, objective travel weather and route advice in Vietnam. " +
            "You MUST call grounding tools to retrieve real observations, forecasts, risks, and route evaluations. Never make up weather data. " +
            "Never use emojis anywhere in your response. Keep answers clear, structured, and helpful. Language: " +
            (locale === "en" ? "English" : "Vietnamese") +
            ".",
        },
      ],
    };

    // Build chat history turns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = [systemInstruction];
    for (const h of history.slice(-6)) {
      contents.push({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.content }],
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const requestBody = {
      contents,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData = (await response.json()) as any;
    const candidate = responseData?.candidates?.[0];
    const modelParts = candidate?.content?.parts || [];

    // Check for function calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionCallPart = modelParts.find((p: any) => p.functionCall);

    if (functionCallPart) {
      const call = functionCallPart.functionCall;
      const toolName = call.name as ChatToolName;
      const toolArgs = call.args || {};

      toolsUsed.push(toolName);
      const toolResult = await toolEngine.executeTool(toolName, toolArgs);
      citations.push(toolResult.citation);

      // Send function response back to Gemini for final natural language generation
      contents.push({
        role: "model",
        parts: [functionCallPart],
      });
      contents.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: toolName,
              response: { content: toolResult.data },
            },
          },
        ],
      });

      const secondResponse = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (secondResponse.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const secondData = (await secondResponse.json()) as any;
        const textPart = secondData?.candidates?.[0]?.content?.parts?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p.text
        );
        if (textPart?.text) {
          return {
            content: textPart.text,
            citations,
            toolsUsed,
            disclaimer:
              locale === "en"
                ? "Weather and route assessments are for informational purposes only. Always obey local traffic advisories."
                : "Thông tin chỉ mang tính chất tham khảo. Vui lòng tuân thủ chỉ dẫn giao thông tại địa phương.",
          };
        }
      }
    }

    // Direct text response without tool call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const directText = modelParts.find((p: any) => p.text)?.text;
    if (directText) {
      return {
        content: directText,
        citations,
        toolsUsed,
      };
    }

    // Fallback if model returned empty
    return this.fallbackAdapter.generate(userMessage, history, locale, toolEngine);
  }
}
