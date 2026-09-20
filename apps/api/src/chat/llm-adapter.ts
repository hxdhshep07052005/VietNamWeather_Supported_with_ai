/**
 * Phase 11 LLM Adapter & Grounded Dialogue Synthesizer
 * Connects natural language travel intents to allowlisted tool outputs with zero-hallucination guarantee
 *
 * Decisions: AI-001, AI-003, AI-006
 */

import {
  CHAT_TOOL_NAMES,
  type ChatToolName,
  type ChatCitationDto,
  type ChatMessageDto,
} from "@vietnam-weather/contracts";
import type { ChatToolEngine } from "./chat-tools.js";

export interface GenerateChatResult {
  readonly content: string;
  readonly citations: ChatCitationDto[];
  readonly toolsUsed: ChatToolName[];
  readonly disclaimer?: string;
}

export interface LlmAdapter {
  generate(
    userMessage: string,
    history: ChatMessageDto[],
    locale: "vi" | "en",
    toolEngine: ChatToolEngine
  ): Promise<GenerateChatResult>;
}

export class GroundedRuleEngineAdapter implements LlmAdapter {
  async generate(
    userMessage: string,
    _history: ChatMessageDto[],
    locale: "vi" | "en" = "vi",
    toolEngine: ChatToolEngine
  ): Promise<GenerateChatResult> {
    const isEn = locale === "en";
    const lower = userMessage.toLowerCase();
    const citations: ChatCitationDto[] = [];
    const toolsUsed: ChatToolName[] = [];

    const MANDATORY_DISCLAIMER_VI =
      "Thông tin chỉ mang tính chất tham khảo. Vui lòng tuân thủ biển báo giao thông và chỉ đạo cứu hộ địa phương khi di chuyển.";
    const MANDATORY_DISCLAIMER_EN =
      "Weather and route assessments are for informational purposes only. Always obey local traffic advisories and authorities.";

    // 1. Route planning intent
    if (
      lower.includes("lo trinh") ||
      lower.includes("lộ trình") ||
      lower.includes("tuyen duong") ||
      lower.includes("tuyến đường") ||
      lower.includes("route") ||
      lower.includes("tu ") ||
      lower.includes("từ ") ||
      lower.includes("di vung tau") ||
      lower.includes("đi vũng tàu") ||
      lower.includes("di da lat") ||
      lower.includes("đi đà lạt")
    ) {
      toolsUsed.push(CHAT_TOOL_NAMES.EVALUATE_ROUTE);
      const vehicleType = lower.includes("xe may") || lower.includes("xe máy") || lower.includes("motorcycle")
        ? "motorcycle"
        : "car";

      const origin = lower.includes("ha noi") || lower.includes("hà nội") ? "Hà Nội" : "TP. Hồ Chí Minh";
      const destination = lower.includes("da lat") || lower.includes("đà lạt")
        ? "Đà Lạt"
        : lower.includes("vung tau") || lower.includes("vũng tàu")
        ? "Bà Rịa - Vũng Tàu"
        : "Đà Nẵng";

      const routeResult = await toolEngine.executeTool(CHAT_TOOL_NAMES.EVALUATE_ROUTE, {
        origin,
        destination,
        vehicleType,
      });

      citations.push(routeResult.citation);

      const data = routeResult.data as {
        origin: string;
        destination: string;
        recommendedCorridor: string;
        alternatives: Array<{ name: string; distanceKm: number; durationMinutes: number; weatherRisk: string; note: string }>;
      };

      const content = isEn
        ? `### Route Weather Evaluation: ${data.origin} → ${data.destination}\n\n` +
          `Recommended Corridor: **${data.recommendedCorridor}**\n\n` +
          `| Corridor | Distance | Duration | Weather Risk | Corridor Notes |\n` +
          `| :--- | :--- | :--- | :--- | :--- |\n` +
          data.alternatives
            .map((a) => `| **${a.name}** | ${a.distanceKm} km | ${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m | \`${a.weatherRisk}\` | ${a.note} |`)
            .join("\n") +
          `\n\n**Advice for ${vehicleType === "motorcycle" ? "Motorcyclists" : "Drivers"}:** Maintain a safe braking distance. Check the interactive map for real-time radar before departing.`
        : `### Đánh giá lộ trình thời tiết: ${data.origin} → ${data.destination}\n\n` +
          `Hành lang khuyên dùng: **${data.recommendedCorridor}**\n\n` +
          `| Hành lang tuyến | Quãng đường | Thời gian | Rủi ro thời tiết | Ghi chú dọc tuyến |\n` +
          `| :--- | :--- | :--- | :--- | :--- |\n` +
          data.alternatives
            .map((a) => `| **${a.name}** | ${a.distanceKm} km | ${Math.floor(a.durationMinutes / 60)} giờ ${a.durationMinutes % 60} phút | \`${a.weatherRisk}\` | ${a.note} |`)
            .join("\n") +
          `\n\n**Khuyến nghị cho ${vehicleType === "motorcycle" ? "xe máy" : "ô tô"}:** Vui lòng giữ tốc độ an toàn, trang bị áo mưa bộ và kiểm tra bản đồ radar trước khi khởi hành.`;

      return {
        content,
        citations,
        toolsUsed,
        disclaimer: isEn ? MANDATORY_DISCLAIMER_EN : MANDATORY_DISCLAIMER_VI,
      };
    }

    // 2. Forecast intent (e.g. "dự báo", "chiều nay", "ngày mai", "forecast", "72h")
    if (
      lower.includes("du bao") ||
      lower.includes("dự báo") ||
      lower.includes("ngay mai") ||
      lower.includes("ngày mai") ||
      lower.includes("chieu nay") ||
      lower.includes("chiều nay") ||
      lower.includes("forecast")
    ) {
      toolsUsed.push(CHAT_TOOL_NAMES.GET_FORECAST);
      const forecastResult = await toolEngine.executeTool(CHAT_TOOL_NAMES.GET_FORECAST, {
        location: userMessage,
        hours: 24,
      });

      citations.push(forecastResult.citation);
      const data = forecastResult.data as {
        location: string;
        horizonHours: number;
        summary: string;
        intervals: Array<{ hourLabel: string; temperatureC: number; rainProbabilityPercent: number; condition: string }>;
      };

      const content = isEn
        ? `### 24-Hour Weather Forecast: ${data.location}\n\n` +
          `${data.summary}\n\n` +
          `| Horizon | Temperature | Rain Probability | Sky Condition |\n` +
          `| :--- | :--- | :--- | :--- |\n` +
          data.intervals.map((i) => `| ${i.hourLabel} | **${i.temperatureC}°C** | ${i.rainProbabilityPercent}% | ${i.condition} |`).join("\n") +
          `\n\nData sourced from normalized satellite and meteorological telemetry.`
        : `### Dự báo thời tiết 24 giờ tới: ${data.location}\n\n` +
          `${data.summary}\n\n` +
          `| Khung giờ | Nhiệt độ | Xác suất mưa | Trạng thái thời tiết |\n` +
          `| :--- | :--- | :--- | :--- |\n` +
          data.intervals.map((i) => `| ${i.hourLabel} | **${i.temperatureC}°C** | ${i.rainProbabilityPercent}% | ${i.condition} |`).join("\n") +
          `\n\nDữ liệu được chuẩn hóa từ trạm quan trắc khí tượng và radar vệ tinh.`;

      return {
        content,
        citations,
        toolsUsed,
      };
    }

    // 3. Risk Assessment intent
    if (
      lower.includes("an toan") ||
      lower.includes("an toàn") ||
      lower.includes("nguy hiem") ||
      lower.includes("nguy hiểm") ||
      lower.includes("rui ro") ||
      lower.includes("rủi ro") ||
      lower.includes("safe") ||
      lower.includes("risk")
    ) {
      toolsUsed.push(CHAT_TOOL_NAMES.ASSESS_TRAVEL_RISK);
      const vehicleType = lower.includes("xe may") || lower.includes("xe máy") ? "motorcycle" : "car";
      const riskResult = await toolEngine.executeTool(CHAT_TOOL_NAMES.ASSESS_TRAVEL_RISK, {
        location: userMessage,
        vehicleType,
      });

      citations.push(riskResult.citation);
      const data = riskResult.data as {
        location: string;
        vehicleType: string;
        riskLevel: string;
        contributingFactors: string[];
        advisory: string;
      };

      const content = isEn
        ? `### Travel Safety Assessment: ${data.location}\n\n` +
          `- **Risk Level:** \`${data.riskLevel}\`\n` +
          `- **Transport Mode:** ${data.vehicleType === "motorcycle" ? "Motorcycle" : "Car"}\n` +
          `- **Identified Factors:**\n` +
          data.contributingFactors.map((f) => `  * ${f}`).join("\n") +
          `\n\n**Safety Advisory:** ${data.advisory}`
        : `### Đánh giá mức độ an toàn di chuyển: ${data.location}\n\n` +
          `- **Cấp độ rủi ro:** \`${data.riskLevel}\`\n` +
          `- **Phương tiện di chuyển:** ${data.vehicleType === "motorcycle" ? "Xe máy" : "Ô tô"}\n` +
          `- **Yếu tố ảnh hưởng:**\n` +
          data.contributingFactors.map((f) => `  * ${f}`).join("\n") +
          `\n\n**Lời khuyên từ Trợ lý:** ${data.advisory}`;

      return {
        content,
        citations,
        toolsUsed,
        disclaimer: isEn ? MANDATORY_DISCLAIMER_EN : MANDATORY_DISCLAIMER_VI,
      };
    }

    // 4. Default: Real-time current weather lookup
    toolsUsed.push(CHAT_TOOL_NAMES.GET_CURRENT_WEATHER);
    const weatherResult = await toolEngine.executeTool(CHAT_TOOL_NAMES.GET_CURRENT_WEATHER, {
      location: userMessage,
    });

    citations.push(weatherResult.citation);
    const data = weatherResult.data as {
      location: string;
      region: string;
      temperatureC: number;
      feelsLikeC: number;
      condition: string;
      humidityPercent: number;
      windSpeedKmh: number;
      precipitationMm: number;
      uvIndex: number;
      visibilityKm: number;
    };

    const content = isEn
      ? `### Current Weather: ${data.location} (${data.region})\n\n` +
        `- **Condition:** ${data.condition}\n` +
        `- **Temperature:** **${data.temperatureC}°C** (Feels like ${data.feelsLikeC}°C)\n` +
        `- **Humidity:** ${data.humidityPercent}%\n` +
        `- **Wind Speed:** ${data.windSpeedKmh} km/h\n` +
        `- **Precipitation:** ${data.precipitationMm} mm\n` +
        `- **UV Index:** ${data.uvIndex} | **Visibility:** ${data.visibilityKm} km\n\n` +
        `You can zoom in on the interactive map for cloud and rain radar overlays.`
      : `### Thời tiết hiện tại: ${data.location} (${data.region})\n\n` +
        `- **Trạng thái:** ${data.condition}\n` +
        `- **Nhiệt độ:** **${data.temperatureC}°C** (Cảm giác thực tế ${data.feelsLikeC}°C)\n` +
        `- **Độ ẩm:** ${data.humidityPercent}%\n` +
        `- **Tốc độ gió:** ${data.windSpeedKmh} km/h\n` +
        `- **Lượng mưa:** ${data.precipitationMm} mm\n` +
        `- **Chỉ số UV:** ${data.uvIndex} | **Tầm nhìn xa:** ${data.visibilityKm} km\n\n` +
        `Bạn có thể xem thêm lớp bản đồ thời tiết tương tác và thanh trượt thời gian trên màn hình Bản đồ.`;

    return {
      content,
      citations,
      toolsUsed,
    };
  }
}
