import assert from "node:assert/strict";
import test from "node:test";

import * as shared from "@vietnam-weather/contracts";
import * as schedulerRegistry from "../dist/weather/vietnam-provinces.js";

test("scheduler import path re-exports the shared registry and lookup objects", () => {
  assert.equal(schedulerRegistry.VIETNAM_PROVINCES.length, 63);
  for (const key of ["VIETNAM_PROVINCES", "VIETNAM_PROVINCES_BY_ID",
    "VIETNAM_PROVINCES_BY_COORDS", "normalizeProvinceName", "findVietnamProvinceByName"]) {
    assert.strictEqual(schedulerRegistry[key], shared[key], key);
  }
});
