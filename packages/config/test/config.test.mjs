import assert from "node:assert/strict";
import test from "node:test";

import {
  requireEnvironmentPort,
  requireEnvironmentValue
} from "../dist/index.js";

test("requireEnvironmentValue returns a trimmed value", () => {
  assert.equal(requireEnvironmentValue({ SERVICE_NAME: " worker " }, "SERVICE_NAME"), "worker");
});

test("requireEnvironmentValue rejects a missing value", () => {
  assert.throws(
    () => requireEnvironmentValue({}, "SERVICE_NAME"),
    /Missing required environment variable/
  );
});

test("requireEnvironmentPort validates the TCP port range", () => {
  assert.equal(requireEnvironmentPort({ PORT: "8081" }, "PORT"), 8081);
  assert.throws(() => requireEnvironmentPort({ PORT: "0" }, "PORT"), /Invalid TCP port/);
  assert.throws(() => requireEnvironmentPort({ PORT: "abc" }, "PORT"), /Invalid TCP port/);
});
