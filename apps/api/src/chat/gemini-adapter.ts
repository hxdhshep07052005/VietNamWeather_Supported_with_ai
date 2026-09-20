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
  private readonly fallbackAdapter: GroundedRuleEngineAdapter;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.fallbackAdapter = new GroundedRuleEngineAdapter();
  }

  async generate(
    userMessage: string,
    history: ChatMessageDto[],
    locale: "vi" | "en" = "vi",
    toolEngine: ChatToolEngine
  ): Promise<GenerateChatResult> {
    if (!this.apiKey) {
      return this.fallbackAdapter.generate(userMessage, history, locale, toolEngine);
    }

    try {
      return await this.callGeminiWithTools(userMessage, history, locale, toolEngine);
    } catch {
      // Fallback on any Gemini API error or timeout
      return this.fallbackAdapter.generate(userMessage, history, locale, toolEngine);
    }
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
