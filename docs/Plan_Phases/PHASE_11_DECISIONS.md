# Phase 11 Decision Gate — AI Chatbot (Travel Weather & Route Intelligent Assistant)

**Date:** 2026-08-15
**Status:** APPROVED
**Approved by:** Technical Owner & Product Owner
**Decision IDs:** `AI-001` through `AI-007`

## Decision Gate Summary

Phase 11 implements the AI-powered travel assistant for the Vietnam Weather platform. This document records all product, security, and architectural decisions required before implementation.

---

## AI-001 — Grounded Tool Architecture & Zero-Hallucination

**Ruling:** The AI Chatbot operates exclusively via **Grounded Tool Calling**.
- The model is strictly prohibited from generating raw meteorological values (temperature, wind speed, rainfall, UV, humidity) or risk assessments from ungrounded memory.
- Every weather claim must originate from one of the 5 approved backend tools:
  1. `tool_search_location`: Resolves Vietnam locations to coordinates and verified IDs.
  2. `tool_get_current_weather`: Retrieves real-time observations from normalized store/cache.
  3. `tool_get_forecast`: Retrieves 24h to 72h hour-by-hour forecast data.
  4. `tool_assess_travel_risk`: Evaluates safety indices by travel mode (car, motorcycle).
  5. `tool_evaluate_route`: Analyzes 3 route corridors (Fastest, Shortest, Weather-safer) with checkpoint weather ETAs.
- Responses must prominently cite the source provider (`WeatherAPI` / NCHMF) and valid update timestamp.

---

## AI-002 — Daily Quota Allocation & Enforcement

**Ruling:** Chatbot interactions are metered atomically at the backend (per `PRODUCT-004` and `MONET-004`):
- **Free Tier:** **3 messages / day**
- **Pro Tier:** **30 messages / day**
- **Anonymous Users:** Denied access (requires authenticated account per `PRODUCT-006`).
- **Reset Schedule:** Daily at **00:00 `Asia/Ho_Chi_Minh`** (UTC+7 per `PRODUCT-005`).
- When a user's quota is exhausted, backend returns HTTP 429 with error code `CHAT_QUOTA_EXCEEDED` and a timestamp indicating when the quota resets.

---

## AI-003 — Dual-Adapter LLM Orchestration & Fail-Safe

**Ruling:** Multi-adapter architecture:
- Primary external adapter: Google Gemini Flash (fast inference, low latency, native Vietnamese fluency).
- Built-in Deterministic Grounded Engine: Performs rule-based intent parsing and direct tool dispatch. Ensures complete system operability and instant response during offline development, CI/CD automated test runs, or upstream LLM service degradation.
- **Fail-Safe Policy:** If upstream LLM provider fails, returns structured fallback message with direct links to the Map and Route Planner. Never fabricate a successful AI response.

---

## AI-004 — Privacy, Retention & Session Scoping

**Ruling:**
- Chat history is scoped to the active user session, retaining a maximum of **10 conversation turns** in memory.
- Users can clear their conversation history at any time using the "Xóa cuộc trò chuyện" button, which immediately purges session turns from the server (`PRIVACY-001`).
- No PII, precise continuous GPS coordinates, passwords, or session tokens are logged or included in prompt context.

---

## AI-005 — Prompt Injection Defense & Input Sanitization

**Ruling:**
- System prompts are stored securely in backend configuration and never exposed to the client.
- Input strings are sanitized: maximum 1000 characters per message, removal of delimiter control sequences (e.g. `### System:`, `[INST]`, `Ignore all previous instructions`).
- System prompt secrecy is **not** treated as a security boundary (`SEC-001`): All tools perform independent authorization on the server side. Even if a jailbreak occurs, tools cannot access database collections, credentials, or user tables outside their allowlist.

---

## AI-006 — Safety Disclaimers & Travel Advisories

**Ruling:**
- The assistant is classified strictly as a **decision-support tool**, not an authoritative safety command (`PRODUCT-010`).
- Any response involving high-risk weather (heavy thunderstorms, typhoon warnings, flood alerts, steep mountain pass travel like Hai Van, O Quy Ho) must append the mandatory advisory:
  > *"Thông tin chỉ mang tính chất tham khảo. Vui lòng theo dõi thông báo chính thức từ Trung tâm Dự báo Khí tượng Thủy văn Quốc gia (NCHMF) và chỉ đạo cứu hộ địa phương khi di chuyển."*

---

## AI-007 — UI Integration & Floating Chat Widget

**Ruling:**
- Integrated as a responsive **Floating Chat Widget** positioned at the bottom-right corner of the application screen.
- Persistently accessible across all authenticated pages (`/map`, `/route`, `/location/:id`, `/settings`).
- Displays real-time quota count, quick action suggestion chips, message bubbles, provenance tags, and upgrade CTA when quota runs out.
