import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, chatApi } from "./client";

describe("API request body headers", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("csrf_token", "test-csrf");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each(["delete", "post"] as const)("%s without a body does not declare empty JSON", async method => {
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const headers = new Headers(options.headers);
      // Fastify rejects an empty body declared as application/json before the handler runs.
      if (headers.get("content-type") === "application/json" && options.body === undefined) {
        return new Response(JSON.stringify({ error: { code: "FST_ERR_CTP_EMPTY_JSON_BODY", message: "Empty JSON" } }), { status: 400 });
      }
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiClient[method]("/chat/history")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    const headers = new Headers(fetchMock.mock.calls[0]?.[1].headers);
    expect(headers.get("x-csrf-token")).toBe("test-csrf");
  });

  it("serializes a payload as JSON and retains mutation protection", async () => {
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) =>
      new Response(JSON.stringify({ data: "ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await apiClient.post("/chat/message", { message: "Hello" });
    const options = fetchMock.mock.calls[0]?.[1];
    expect(options?.body).toBe(JSON.stringify({ message: "Hello" }));
    const headers = new Headers(options?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-csrf-token")).toBe("test-csrf");
  });
});

it("chat clearHistory accepts the API 204 response", async () => {
  localStorage.setItem("csrf_token", "test-csrf");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  try {
    await expect(chatApi.clearHistory()).resolves.toBeUndefined();
  } finally {
    vi.unstubAllGlobals();
    localStorage.clear();
  }
});
