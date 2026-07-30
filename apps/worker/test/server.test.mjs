import assert from "node:assert/strict";
import test from "node:test";

import { createWorkerServer } from "../dist/server.js";

test("worker exposes live and ready health endpoints", async (context) => {
  const server = createWorkerServer({ serviceName: "worker-test", port: 0 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const liveResponse = await fetch(`http://127.0.0.1:${address.port}/health/live`);
  assert.equal(liveResponse.status, 200);
  assert.equal((await liveResponse.json()).status, "live");

  const readyResponse = await fetch(`http://127.0.0.1:${address.port}/health/ready`);
  assert.equal(readyResponse.status, 200);
  assert.equal((await readyResponse.json()).status, "ready");
});
