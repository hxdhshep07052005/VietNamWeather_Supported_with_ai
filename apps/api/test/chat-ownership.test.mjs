import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { ChatService } from "../dist/chat/chat-service.js";
import { buildChatRoutes } from "../dist/chat/routes.js";

async function fixture(t) {
  const app = Fastify();
  const histories = [];
  const chatService = new ChatService({
    llmAdapter: {
      async generate(_message, history) {
        histories.push(history.map(message => message.content));
        return { content: "Test reply", citations: [], toolsUsed: [], disclaimer: "Test only" };
      },
    },
  });
  buildChatRoutes(app, {
    chatService,
    billingService: { async getEntitlements() { return { plan: "pro" }; } },
    async requireAuth(request) {
      request.authSession = { user: { id: request.headers["x-test-user"] } };
    },
    async requireMutationSecurity() {},
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  t.after(() => app.close());
  async function request(user, method, path, body) {
    return fetch(`${address}/api/v1/chat${path}`, {
      method,
      headers: { "x-test-user": user, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  return { request, histories };
}

test("another user cannot read a known conversation ID", async t => {
  const { request } = await fixture(t);
  assert.equal((await request("alice", "POST", "/message", {
    message: "Alice private itinerary", conversationId: "shared-id",
  })).status, 200);
  const own = await (await request("alice", "GET", "/history?conversationId=shared-id")).json();
  assert.equal(own.data.count, 2);
  const other = await (await request("bob", "GET", "/history?conversationId=shared-id")).json();
  assert.equal(other.data.count, 0);
});

test("another user cannot delete a known conversation ID", async t => {
  const { request } = await fixture(t);
  await request("alice", "POST", "/message", { message: "Alice itinerary", conversationId: "shared-id" });
  assert.equal((await request("bob", "DELETE", "/history?conversationId=shared-id")).status, 204);
  const own = await (await request("alice", "GET", "/history?conversationId=shared-id")).json();
  assert.equal(own.data.count, 2);
  await request("alice", "DELETE", "/history?conversationId=shared-id");
  const cleared = await (await request("alice", "GET", "/history?conversationId=shared-id")).json();
  assert.equal(cleared.data.count, 0);
});

test("shared conversation IDs never send another user's context to the model", async t => {
  const { request, histories } = await fixture(t);
  await request("alice", "POST", "/message", { message: "Private Alice itinerary", conversationId: "shared-id" });
  await request("bob", "POST", "/message", { message: "Bob question", conversationId: "shared-id" });
  assert.deepEqual(histories[1], []);
});

test("default conversation retains its owner's history and can be cleared", async t => {
  const { request } = await fixture(t);
  await request("alice", "POST", "/message", { message: "Alice question" });
  const own = await (await request("alice", "GET", "/history")).json();
  assert.equal(own.data.count, 2);
  assert.equal(own.data.conversationId, "conv_alice");
  const other = await (await request("bob", "GET", "/history")).json();
  assert.equal(other.data.count, 0);
  await request("alice", "DELETE", "/history");
  const cleared = await (await request("alice", "GET", "/history")).json();
  assert.equal(cleared.data.count, 0);
});
