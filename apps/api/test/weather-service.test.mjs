import assert from "node:assert/strict";
import test from "node:test";

import { isWeatherQueryResponse } from "@vietnam-weather/contracts";

import { WeatherService } from "../dist/weather-service.js";

const NOW = new Date("2026-08-09T12:00:00.000Z");
const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const PROVIDER_RUN_ID = "22222222-2222-4222-8222-222222222222";
const RECORD_ID = "33333333-3333-4333-8333-333333333333";

function source() {
  return {
    provider_key: "weatherapi",
    display_name: "WeatherAPI.com",
    attribution_text: "Weather data provided by WeatherAPI.com.",
    terms_url: "https://www.weatherapi.com/terms.aspx"
  };
}

function observation(overrides = {}) {
  return {
    id: RECORD_ID,
    provider_run_id: PROVIDER_RUN_ID,
    observed_at: "2026-08-09T11:55:00.000Z",
    fetched_at: "2026-08-09T11:58:00.000Z",
    expires_at: "2026-08-09T12:13:00.000Z",
    parser_version: "weatherapi-forecast-v1",
    condition_code: "rain",
    temperature_celsius: 30,
    feels_like_celsius: 35,
    humidity_percent: 80,
    precipitation_mm: 1,
    wind_speed_mps: 3,
    wind_gust_mps: 5,
    wind_direction_degrees: 180,
    pressure_hpa: 1005,
    visibility_meters: 8000,
    ...overrides
  };
}

function forecast(kind, from, to, overrides = {}) {
  return {
    id: RECORD_ID,
    provider_run_id: PROVIDER_RUN_ID,
    horizon_kind: kind,
    provider_issued_at: null,
    valid_from: from,
    valid_to: to,
    fetched_at: "2026-08-09T11:58:00.000Z",
    expires_at: "2026-08-09T17:58:00.000Z",
    parser_version: "weatherapi-forecast-v1",
    condition_code: "rain",
    temperature_celsius: kind === "hourly" ? 31 : null,
    temperature_min_celsius: kind === "daily" ? 26 : null,
    temperature_max_celsius: kind === "daily" ? 34 : null,
    precipitation_mm: 2,
    precipitation_probability_percent: 70,
    wind_speed_mps: 4,
    wind_gust_mps: 6,
    ...overrides
  };
}

class Store {
  constructor(document) { this.document = document; this.enqueues = []; }
  async capabilities() {
    return {
      source: source(),
      last_verified_at: "2026-08-09T00:00:00.000Z",
      capabilities: { current: true, hourly: true, daily: true, operational_horizon_hours: 72 }
    };
  }
  async fetch() { return this.document; }
  async enqueue(...args) {
    this.enqueues.push(args);
    return { runId: PROVIDER_RUN_ID, status: "pending", inserted: this.enqueues.length === 1 };
  }
}

function request(include = ["current", "hourly", "daily"]) {
  return { target: { locationId: LOCATION_ID }, include };
}

function available(overrides = {}) {
  return {
    status: "available",
    source: source(),
    observation: observation(),
    forecasts: [
      forecast("hourly", "2026-08-09T12:00:00.000Z", "2026-08-09T13:00:00.000Z"),
      forecast("daily", "2026-08-09T00:00:00.000Z", "2026-08-10T00:00:00.000Z")
    ],
    ...overrides
  };
}

function service(store, options = {}) {
  return new WeatherService({
    store,
    cacheTtlSeconds: 30,
    pendingRetrySeconds: 2,
    now: () => NOW,
    ...options
  });
}

test("returns validated provider-neutral capabilities", async () => {
  const response = await service(new Store(available())).capabilities("corr-0123456789");
  assert.equal(response.status, "success");
  assert.equal(response.data.fallback, "none");
  assert.equal(response.data.providerMixing, false);
  assert.equal(response.data.features.current.freshnessPolicy.freshForSeconds, 900);
  assert.equal(response.data.features.hourly.freshnessPolicy.staleDisplayForSeconds, 86400);
});

test("maps normalized rows without exposing coordinates, credentials, or internal URLs", async () => {
  const response = await service(new Store(available())).query(request(), "corr-0123456789");
  assert.equal(isWeatherQueryResponse(response), true);
  assert.equal(response.status, "degraded");
  assert.equal(response.data.current.provenance.providerIssuedAt, null);
  assert.equal(response.data.hourly.values.length, 1);
  assert.equal(response.data.daily.values.length, 1);
  const serialized = JSON.stringify(response);
  assert.doesNotMatch(serialized, /coordinates|credential|api\.weatherapi\.com|provider_run_id/iu);
});

test("filters unrequested datasets", async () => {
  const response = await service(new Store(available())).query(request(["current"]), "corr-0123456789");
  assert.equal(response.data.hourly, null);
  assert.equal(response.data.daily, null);
  assert.equal(response.data.coverage.datasets.hourly.status, "not_requested");
});

const restoredMeasurements = [
  ["feels_like_celsius", "apparentTemperatureCelsius", 35.125],
  ["humidity_percent", "relativeHumidityPercent", 82.5],
  ["wind_direction_degrees", "windDirectionDegrees", 187.5],
  ["pressure_hpa", "pressureHectopascals", 1005.25],
  ["visibility_meters", "visibilityMetres", 7250.5],
  ["uv_index", "uvIndex", 6.75],
  ["cloud_cover_percent", "cloudCoverPercent", 62.5]
];

for (const name of ["reported values", "zero", "null", "absent legacy columns"]) {
  test(`returns restored measurements and accurate quality: ${name}`, async () => {
    const document = available();
    const current = document.observation;
    const hourly = document.forecasts[0];
    for (const [column, , reported] of restoredMeasurements) {
      for (const row of [current, hourly]) {
        // Only UV/cloud columns are new to observations.
        if (row === current && !["uv_index", "cloud_cover_percent"].includes(column)) continue;
        if (name === "absent legacy columns") delete row[column];
        else if (name === "zero") {
          // The existing public contract requires pressure between 800 and 1200 hPa.
          row[column] = column === "pressure_hpa" ? reported : 0;
        } else row[column] = name === "reported values" ? reported : null;
      }
    }
    const store = new Store(document);
    const response = await service(store).query(request(["current", "hourly"]), "corr-0123456789");
    const missing = name === "null" || name === "absent legacy columns";
    assert.equal(isWeatherQueryResponse(response), true);
    assert.equal(response.status, missing ? "degraded" : "success");
    for (const [section, row] of [[response.data.current, current], [response.data.hourly, hourly]]) {
      const value = section.value ?? section.values[0];
      for (const [column, field] of restoredMeasurements) {
        assert.equal(value[field], row[column] ?? null, field);
      }
      const expectedMissing = restoredMeasurements
        .filter(([column]) => row[column] === null || row[column] === undefined)
        .map(([, field]) => field);
      assert.deepEqual(value.quality.missingFields, expectedMissing);
      assert.equal(value.quality.state, missing ? "partial" : "complete");
      assert.equal(section.coverage.status, missing ? "partial" : "complete");
    }
    assert.equal(store.enqueues.length, missing ? 1 : 0);
  });
}

for (const humidity of [75, 0, null]) {
  test(`returns daily average humidity and accurate quality for ${humidity}`, async () => {
    const document = available();
    document.forecasts[1].humidity_percent = humidity;

    const response = await service(new Store(document)).query(request(["daily"]), "corr-0123456789");

    assert.equal(isWeatherQueryResponse(response), true);
    assert.equal(response.status, humidity === null ? "degraded" : "success");
    const daily = response.data.daily.values[0];
    assert.equal(daily.averageRelativeHumidityPercent, humidity);
    assert.deepEqual(daily.quality.missingFields, humidity === null ? ["averageRelativeHumidityPercent"] : []);
    assert.equal(daily.quality.state, humidity === null ? "partial" : "complete");
  });
}

test("enqueues one durable hashed refresh on a cache miss", async () => {
  const store = new Store({ status: "unavailable" });
  const response = await service(store).query({
    target: { coordinates: { latitude: 21.0278, longitude: 105.8342 } },
    include: ["current"]
  }, "corr-0123456789");
  assert.equal(response.status, "pending");
  assert.equal(store.enqueues.length, 1);
  assert.match(store.enqueues[0][2], /^weather:v1:[a-f0-9]{64}$/u);
  assert.doesNotMatch(store.enqueues[0][2], /21\.0278|105\.8342/u);
  assert.deepEqual(store.enqueues[0][0], {
    coordinates: { latitude: 21.028, longitude: 105.834 }
  });
});

test("marks stale data degraded and ineligible for risk or route", async () => {
  const staleNow = new Date("2026-08-09T12:30:00.000Z");
  const response = await new WeatherService({
    store: new Store(available()),
    cacheTtlSeconds: 30,
    pendingRetrySeconds: 2,
    now: () => staleNow
  }).query(request(["current"]), "corr-0123456789");
  assert.equal(response.status, "degraded");
  assert.equal(response.data.current.freshness.state, "stale");
  assert.equal(response.data.current.freshness.riskEligible, false);
  assert.equal(response.data.current.freshness.routeEligible, false);
});

test("returns unavailable rather than expired or malformed weather", async () => {
  const expired = available({ observation: observation({ fetched_at: "2026-08-09T09:00:00.000Z", expires_at: "2026-08-09T09:15:00.000Z" }), forecasts: [] });
  const store = new Store(expired);
  store.enqueue = async () => ({ runId: PROVIDER_RUN_ID, status: "failed", inserted: false });
  const response = await service(store).query(request(["current"]), "corr-0123456789");
  assert.equal(response.status, "unavailable");
  assert.equal(response.error.code, "WEATHER_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(response), /09:00|provider_run|coordinate/iu);
});

test("uses only contract-valid cached responses", async () => {
  const cached = { status: "pending", retryAfterSeconds: 2, correlationId: "corr-0123456789" };
  const cache = { async get() { return cached; }, async set() { assert.fail("cache set should not run"); } };
  const response = await service(new Store(available()), { cache }).query(request(), "corr-other-123456");
  assert.equal(response.status, "pending");
  assert.equal(response.correlationId, "corr-other-123456");
});
