/**
 * Phase 11 Floating Chatbot Widget
 * Responsive AI travel weather assistant with grounded citations and quota tracking
 *
 * Decisions: AI-001..007, SEC-001, MONET-004
 */

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Sparkles,
  ShieldAlert,
  Database,
  ArrowUpRight,
  Bot,
  User,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useRequireLoginModal } from "@/hooks/useRequireLoginModal";
import { chatApi } from "@/api/client";
import type { ChatCitationDto } from "@vietnam-weather/contracts";
import styles from "./FloatingChatWidget.module.css";

interface LocalMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: string;
  readonly citations?: ChatCitationDto[];
  readonly disclaimer?: string;
}

const QUICK_SUGGESTIONS = [
  "Thời tiết Hà Nội hôm nay thế nào?",
  "Dự báo thời tiết Đà Lạt 24h tới",
  "Đi Vũng Tàu bằng xe máy có an toàn không?",
  "Tuyến đường an toàn nhất đi Sa Pa",
];

export function FloatingChatWidget() {
  const { i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");
  const { user, isAuthenticated } = useAuthStore();
  const { openModal } = useRequireLoginModal();
  const isPro = user?.plan === "pro";
  const maxQuota = isPro ? 30 : 3;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [remainingQuota, setRemainingQuota] = useState<number>(maxQuota);
  const [isLoading, setIsLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial greeting if empty
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: isEn
            ? "Hello! I am your AI Weather & Travel Assistant. Feel free to ask me about real-time conditions, 72-hour forecasts, vehicle safety risk ratings, or corridor routing across Vietnam."
            : "Xin chào! Tôi là Trợ lý Thời tiết & Lộ trình Du lịch AI. Bạn có thể hỏi tôi về thời tiết hiện tại, dự báo 72 giờ, cấp độ an toàn theo phương tiện hoặc tư vấn tuyến đường di chuyển tại Việt Nam.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // Load initial quota status from backend
    chatApi
      .getQuota()
      .then((res) => {
        if (res && typeof res.remaining === "number") {
          setRemainingQuota(res.remaining);
          if (res.remaining <= 0) {
            setQuotaExceeded(true);
          }
        }
      })
      .catch(() => undefined);
  }, [messages.length]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if (!messageText.trim() || isLoading) return;

    const userMessage: LocalMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: messageText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const responseData = await chatApi.sendMessage({
        message: userMessage.content,
        locale: "vi",
      });

      if (responseData?.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: responseData.message.id,
            role: "assistant",
            content: responseData.message.content,
            timestamp: responseData.message.timestamp,
            citations: responseData.message.citations,
            disclaimer: responseData.message.disclaimer,
          },
        ]);
        if (typeof responseData.remainingQuota === "number") {
          setRemainingQuota(responseData.remainingQuota);
          if (responseData.remainingQuota <= 0) {
            setQuotaExceeded(true);
          }
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { status?: number; code?: string; message?: string };
      if (apiErr.status === 429 || apiErr.code === "QUOTA_EXCEEDED" || apiErr.code === "CHAT_QUOTA_EXCEEDED") {
        setQuotaExceeded(true);
        setRemainingQuota(0);
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: `Bạn đã sử dụng hết hạn ngạch tin nhắn hôm nay (${maxQuota}/${maxQuota} tin). Vui lòng nâng cấp lên gói PRO để nhận 30 tin nhắn/ngày hoặc chờ reset vào 00:00.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } else if (apiErr.status === 401 || apiErr.code === "AUTHENTICATION_REQUIRED" || apiErr.code === "SESSION_REVOKED") {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_auth_${Date.now()}`,
            role: "assistant",
            content: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục trò chuyện cùng Trợ lý AI!",
            timestamp: new Date().toISOString(),
          },
        ]);
        openModal(
          isEn ? "Sign In Required" : "Yêu cầu đăng nhập",
          isEn
            ? "Your session has expired. Please sign in to continue chatting with our AI Travel Assistant."
            : "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập để tiếp tục trò chuyện cùng Trợ lý AI!"
        );
      } else {
        const errorText = apiErr.message || "Không thể kết nối đến máy chủ AI lúc này. Vui lòng thử lại sau vài giây.";
        setMessages((prev) => [
          ...prev,
          {
            id: `fallback_${Date.now()}`,
            role: "assistant",
            content: errorText,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await chatApi.clearHistory();
    } catch {
      // Ignore
    }
    setMessages([
      {
        id: `cleared_${Date.now()}`,
        role: "assistant",
        content: "Đã làm mới cuộc trò chuyện. Bạn muốn tra cứu thời tiết hoặc lộ trình ở đâu?",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      <button
        type="button"
        className={`${styles.floatingTrigger} ${isOpen ? styles.floatingTriggerActive : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isEn ? "Open Weather AI Assistant" : "Mở Trợ lý AI Thời tiết"}
        title={isEn ? "Weather AI Assistant" : "Trợ lý AI Thời tiết"}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Floating Chat Window Modal */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.botAvatar}>
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className={styles.title}>{isEn ? "AI Travel Assistant" : "Trợ Lý Du Lịch AI"}</h4>
                <span className={styles.quotaBadge}>
                  {!isAuthenticated
                    ? (isEn ? "Guest Mode • Sign in to chat" : "Chế độ Khách • Đăng nhập để chat")
                    : isEn
                    ? `${isPro ? "PRO Plan" : "Free Plan"} • ${remainingQuota}/${maxQuota} remaining today`
                    : `${isPro ? "Gói PRO" : "Gói Free"} • Còn ${remainingQuota}/${maxQuota} tin hôm nay`}
                </span>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={handleClearHistory}
                title={isEn ? "Clear chat (Privacy preserved)" : "Xóa đoạn chat (Bảo mật quyền riêng tư)"}
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setIsOpen(false)}
                title={isEn ? "Close window" : "Đóng cửa sổ"}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Message Stream */}
          <div className={styles.messagesList}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`${styles.messageBubble} ${
                  m.role === "user" ? styles.messageUser : styles.messageAssistant
                }`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  {m.role === "user" ? <User size={12} /> : <Bot size={12} color="#FFCD00" />}
                  <span style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.8 }}>
                    {m.role === "user" ? (isEn ? "You" : "Bạn") : (isEn ? "AI Assistant" : "Trợ Lý AI")}
                  </span>
                </div>

                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>

                {/* Provenance Citations Badge */}
                {m.citations && m.citations.length > 0 && (
                  <div className={styles.citationsContainer}>
                    {m.citations.map((c, idx) => (
                      <span key={idx} className={styles.citationBadge}>
                        <Database size={11} />
                        <span>{isEn ? "Source: " : "Nguồn: "}{c.locationName || c.source || (isEn ? "Station" : "Trạm quan trắc")}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Safety Disclaimer */}
                {m.disclaimer && (
                  <div className={styles.disclaimerText}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: 700, marginBottom: "2px" }}>
                      <ShieldAlert size={12} />
                      <span>{isEn ? "Safety Note:" : "Lưu ý an toàn:"}</span>
                    </div>
                    <span>{m.disclaimer}</span>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className={`${styles.messageBubble} ${styles.messageAssistant}`}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-text-secondary)" }}>
                  <Sparkles size={14} className="animate-spin" />
                  <span>Đang tra cứu dữ liệu thời tiết thực...</span>
                </div>
              </div>
            )}

            {/* Quick Suggestion Chips (when user has sent <= 1 message) */}
            {messages.length <= 2 && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)", marginBottom: "6px" }}>
                  Gợi ý câu hỏi nhanh:
                </div>
                <div className={styles.suggestionChips}>
                  {QUICK_SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={styles.chip}
                      onClick={() => handleSendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quota warning */}
          {quotaExceeded && (
            <div className={styles.quotaWarning}>
              <span>Đã hết hạn ngạch tin nhắn hôm nay</span>
              <Link
                to="/upgrade"
                style={{
                  color: "#FFCD00",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  textDecoration: "none",
                }}
              >
                <span>Nâng cấp PRO</span>
                <ArrowUpRight size={12} />
              </Link>
            </div>
          )}

          {/* Input Form */}
          <div className={styles.inputArea}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className={styles.inputForm}
            >
              <input
                type="text"
                className={styles.inputField}
                placeholder={
                  quotaExceeded
                    ? (isEn ? "Daily quota reached..." : "Hết hạn ngạch hôm nay...")
                    : (isEn ? "Ask about weather or travel corridor..." : "Hỏi về thời tiết hoặc lộ trình...")
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                disabled={isLoading || quotaExceeded}
              />
              <button
                type="submit"
                className={styles.sendButton}
                disabled={!input.trim() || isLoading || quotaExceeded}
                title={isEn ? "Send message" : "Gửi tin nhắn"}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
