import assert from "node:assert/strict";
import { inspect } from "node:util";
import test from "node:test";

const runtimeModuleUrl = process.env.WEATHER_RUNTIME_TEST_MODULE_URL
  ?? new URL("../dist/runtime/index.js", import.meta.url).href;
const weatherModuleUrl = process.env.WEATHER_TEST_MODULE_URL
  ?? new URL("../dist/weather/index.js", import.meta.url).href;
const {
  calculateWeatherRetryDelayMilliseconds,
  mapNormalizedWeatherPayload,
  parseWeatherRuntimeConfig,
  parseWeatherRuntimeSecrets,
  PostgresWeatherRuntimeStore,
  WeatherDurableRuntime,
  WEATHERAPI_CREDENTIAL_REFERENCE
} = await import(runtimeModuleUrl);
const {
  WEATHERAPI_ALLOWED_ORIGIN,
  WEATHERAPI_PARSER_VERSION,
  WeatherProviderError
} = await import(weatherModuleUrl);

const now = new Date("2026-08-09T12:40:00.000Z");
const secret = "runtimeSecret_123456789";
const rawMarker = "raw-provider-marker-never-retained";

const baseConfig = Object.freeze({
  workerId: "weather-worker.test",
  pollIntervalMilliseconds: 5,
  leaseDurationMilliseconds: 5_000,
  heartbeatIntervalMilliseconds: 1_000,
  providerTimeoutMilliseconds: 1_000,
  retryBaseDelayMilliseconds: 1_000,
  retryMaximumDelayMilliseconds: 8_000,
  retryJitterRatio: 0.2,
  circuitFailureThreshold: 3,
  circuitResetMilliseconds: 60_000,
  forecastDays: 3
});

function claim(overrides = {}) {
  return {
    runId: "10000000-0000-4000-8000-000000000001",
    providerId: "10000000-0000-4000-8000-000000000002",
    providerKey: "weatherapi",
    providerBaseUrl: WEATHERAPI_ALLOWED_ORIGIN,
    credentialReference: WEATHERAPI_CREDENTIAL_REFERENCE,
    requestKind: "bundle",
    targetLocationId: "10000000-0000-4000-8000-000000000003",
    targetLongitude: 105.8342,
    targetLatitude: 21.0278,
    parserVersion: WEATHERAPI_PARSER_VERSION,
    attemptCount: 1,
    maxAttempts: 3,
    leaseToken: "10000000-0000-4000-8000-000000000004",
    leaseExpiresAt: new Date(now.getTime() + 5_000),
    sanitizedMetadata: null,
    ...overrides
  };
}

function quality(state = "complete") {
  return {
    state,
    missingFields: state === "partial" ? ["visibilityMetres"] : []
  };
}

function payload(overrides = {}) {
  return {
    schemaVersion: "weather.v1",
    source: {
      provider: "weatherapi",
      attribution: { name: "WeatherAPI.com", url: "https://www.weatherapi.com/" },
      parserVersion: WEATHERAPI_PARSER_VERSION
    },
    target: { latitude: 21.0278, longitude: 105.8342 },
    providerIssuedAt: null,
    fetchedAt: now.toISOString(),
    units: {
      temperature: "celsius",
      windSpeed: "metres_per_second",
      precipitation: "millimetres",
      pressure: "hectopascals",
      visibility: "metres",
      relativeHumidity: "percent",
      probability: "percent",
      direction: "degrees"
    },
    current: {
      kind: "observation",
      observedAt: "2026-08-09T12:34:56.000Z",
      validInterval: {
        from: "2026-08-09T12:34:56.000Z",
        to: "2026-08-09T12:34:56.000Z"
      },
      quality: quality(),
      temperatureCelsius: 31.25,
      apparentTemperatureCelsius: 35.5,
      relativeHumidityPercent: 72,
      windSpeedMetresPerSecond: 2.5,
      windGustMetresPerSecond: 4.5,
      windDirectionDegrees: 180,
      precipitationMillimetres: 0.5,
      pressureHectopascals: 1_006,
      visibilityMetres: 8_000,
      uvIndex: 7,
      cloudCoverPercent: 60,
      conditionCode: "rain",
      providerIssuedAt: null,
      expiresAt: "2026-08-09T13:40:00.000Z"
    },
    hourly: [{
      kind: "forecast",
      granularity: "hour",
      validInterval: {
        from: "2026-08-09T13:00:00.000Z",
        to: "2026-08-09T14:00:00.000Z"
      },
      quality: quality(),
      temperatureCelsius: 32,
      apparentTemperatureCelsius: 36,
      relativeHumidityPercent: 70,
      windSpeedMetresPerSecond: 3,
      windGustMetresPerSecond: 5,
      windDirectionDegrees: 190,
      precipitationMillimetres: 1,
      pressureHectopascals: 1_005,
      visibilityMetres: 7_000,
      uvIndex: 6,
      cloudCoverPercent: 70,
      conditionCode: "rain",
      precipitationProbabilityPercent: 65,
      providerIssuedAt: null,
      expiresAt: "2026-08-10T12:40:00.000Z"
    }],
    daily: [{
      kind: "forecast",
      granularity: "day",
      date: "2026-08-09",
      validInterval: {
        from: "2026-08-09T00:00:00.000Z",
        to: "2026-08-10T00:00:00.000Z"
      },
      quality: quality(),
      minimumTemperatureCelsius: 26,
      maximumTemperatureCelsius: 34,
      precipitationMillimetres: 8,
      maximumPrecipitationProbabilityPercent: 80,
      maximumWindSpeedMetresPerSecond: 7,
      averageRelativeHumidityPercent: 75,
      conditionCode: "thunderstorm",
      providerIssuedAt: null,
      expiresAt: "2026-08-10T12:40:00.000Z"
    }],
    capabilities: {
      current: { available: true, observedAt: "2026-08-09T12:34:56.000Z" },
      hourly: {
        available: true,
        records: 1,
        validFrom: "2026-08-09T13:00:00.000Z",
        validTo: "2026-08-09T14:00:00.000Z",
        intervalMinutes: 60
      },
      daily: {
        available: true,
        records: 1,
        validFrom: "2026-08-09T00:00:00.000Z",
        validTo: "2026-08-10T00:00:00.000Z",
        intervalDays: 1
      },
      operationalHorizonHours: 72,
      day4To7Outlook: false
    },
    normalizedPayloadChecksumSha256: "a".repeat(64),
    raw_response: rawMarker,
    ...overrides
  };
}

class MockStore {
  constructor(claims = []) {
    this.claims = [...claims];
    this.calls = [];
    this.persistenceResult = {
      observationsInserted: 1,
      observationsExisting: 0,
      forecastsInserted: 2,
      forecastsExisting: 0
    };
    this.retryResult = {
      runStatus: "retry_wait",
      availableAt: new Date(now.getTime() + 1_000),
      deadLetteredAt: null
    };
  }

  async claim(...args) {
    this.calls.push(["claim", ...args]);
    const value = this.claims.shift();
    if (value instanceof Error) throw value;
    return value ?? null;
  }

  async heartbeat(...args) {
    this.calls.push(["heartbeat", ...args]);
    return new Date(now.getTime() + 5_000);
  }

  async persist(...args) {
    this.calls.push(["persist", ...args]);
    return this.persistenceResult;
  }

  async complete(...args) {
    this.calls.push(["complete", ...args]);
    return args[2];
  }

  async retry(...args) {
    this.calls.push(["retry", ...args]);
    return this.retryResult;
  }

  async fail(...args) {
    this.calls.push(["fail", ...args]);
    return "failed";
  }

  async close() {
    this.calls.push(["close"]);
  }
}

function logger() {
  const entries = [];
  return {
    entries,
    info(entry) { entries.push(entry); },
    error(entry) { entries.push(entry); }
  };
}

function adapterFactory(action) {
  return ({ apiKey, timeoutMilliseconds }) => ({
    providerId: "weatherapi",
    async getWeather(request) {
      return action({ apiKey, timeoutMilliseconds, request });
    }
  });
}

async function waitFor(predicate, timeoutMilliseconds = 1_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail("Timed out waiting for runtime state");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

function call(store, name) {
  return store.calls.find((entry) => entry[0] === name);
}

test("maps only exact SQL-whitelisted normalized fields with deterministic row identity", () => {
  const first = mapNormalizedWeatherPayload(payload(), "bundle");
  const secondPayload = payload({
    fetchedAt: "2026-08-09T12:41:00.000Z",
    current: {
      ...payload().current,
      expiresAt: "2026-08-09T13:41:00.000Z"
    },
    hourly: payload().hourly.map((record) => ({
      ...record,
      expiresAt: "2026-08-10T12:41:00.000Z"
    })),
    daily: payload().daily.map((record) => ({
      ...record,
      expiresAt: "2026-08-10T12:41:00.000Z"
    }))
  });
  const second = mapNormalizedWeatherPayload(secondPayload, "bundle");

  const observationKeys = [
    "condition_code", "expires_at", "feels_like_celsius", "fetched_at",
    "humidity_percent", "idempotency_key", "normalized_payload_checksum_sha256",
    "observed_at", "precipitation_mm", "pressure_hpa", "provider_record_id",
    "source_quality", "status", "temperature_celsius", "visibility_meters",
    "wind_direction_degrees", "wind_gust_mps", "wind_speed_mps"
  ].sort();
  const forecastKeys = [
    "condition_code", "confidence_percent", "expires_at", "fetched_at",
    "horizon_kind", "idempotency_key", "normalized_payload_checksum_sha256",
    "precipitation_mm", "precipitation_probability_percent", "provider_issued_at",
    "provider_record_id", "status", "temperature_celsius", "temperature_max_celsius",
    "temperature_min_celsius", "valid_from", "valid_to", "wind_gust_mps",
    "wind_speed_mps"
  ].sort();

  assert.deepEqual(Object.keys(first.observations[0]).sort(), observationKeys);
  assert.ok(first.forecasts.every((record) => (
    assert.deepEqual(Object.keys(record).sort(), forecastKeys) === undefined
  )));
  assert.equal(first.observations[0].expires_at, "2026-08-09T12:55:00.000Z");
  assert.ok(first.forecasts.every((record) => record.expires_at === "2026-08-09T18:40:00.000Z"));
  assert.deepEqual(
    first.observations.map((record) => [record.idempotency_key, record.normalized_payload_checksum_sha256]),
    second.observations.map((record) => [record.idempotency_key, record.normalized_payload_checksum_sha256])
  );
  assert.deepEqual(
    first.forecasts.map((record) => [record.idempotency_key, record.normalized_payload_checksum_sha256]),
    second.forecasts.map((record) => [record.idempotency_key, record.normalized_payload_checksum_sha256])
  );
  assert.match(first.observations[0].idempotency_key, /^weather:v1:observation:[a-f0-9]{64}$/);
  assert.match(first.forecasts[0].normalized_payload_checksum_sha256, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(first);
  for (const forbidden of [
    '"raw_response":', rawMarker, '"quality":', '"missingFields":', '"uvIndex":',
    '"cloudCoverPercent":', '"target":', '"capabilities":', '"attribution":'
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("parses bounded runtime policy and resolves only the injected WeatherAPI secret", () => {
  const environment = {
    WEATHER_WORKER_ID: "worker-1.test",
    WEATHER_WORKER_POLL_INTERVAL_MS: "250",
    WEATHER_WORKER_LEASE_DURATION_MS: "5000",
    WEATHER_WORKER_HEARTBEAT_INTERVAL_MS: "1000",
    WEATHER_PROVIDER_TIMEOUT_MS: "3000",
    WEATHER_WORKER_RETRY_BASE_DELAY_MS: "500",
    WEATHER_WORKER_RETRY_MAX_DELAY_MS: "8000",
    WEATHER_WORKER_RETRY_JITTER_RATIO: "0.25",
    WEATHER_PROVIDER_CIRCUIT_FAILURE_THRESHOLD: "4",
    WEATHER_PROVIDER_CIRCUIT_RESET_MS: "30000",
    WEATHERAPI_FORECAST_DAYS: "3",
    WEATHERAPI_API_KEY: secret,
    OTHER_SECRET: "must-not-be-resolved"
  };
  assert.deepEqual(parseWeatherRuntimeConfig(environment), {
    workerId: "worker-1.test",
    pollIntervalMilliseconds: 250,
    leaseDurationMilliseconds: 5_000,
    heartbeatIntervalMilliseconds: 1_000,
    providerTimeoutMilliseconds: 3_000,
    retryBaseDelayMilliseconds: 500,
    retryMaximumDelayMilliseconds: 8_000,
    retryJitterRatio: 0.25,
    circuitFailureThreshold: 4,
    circuitResetMilliseconds: 30_000,
    forecastDays: 3
  });
  assert.deepEqual(parseWeatherRuntimeSecrets(environment), {
    WEATHERAPI_API_KEY: secret
  });
  assert.throws(
    () => parseWeatherRuntimeConfig({ ...environment, WEATHER_WORKER_HEARTBEAT_INTERVAL_MS: "5000" }),
    /heartbeat interval/u
  );
  assert.throws(
    () => parseWeatherRuntimeSecrets({ ...environment, WEATHERAPI_API_KEY: " short " }),
    /WEATHERAPI_API_KEY/u
  );
});

test("Postgres store delegates every durable transition to the Phase 5 SQL functions", async () => {
  const queries = [];
  const results = [
    { rows: [{
      run_id: claim().runId,
      provider_id: claim().providerId,
      provider_key: "weatherapi",
      provider_base_url: WEATHERAPI_ALLOWED_ORIGIN,
      credential_reference: WEATHERAPI_CREDENTIAL_REFERENCE,
      request_kind: "bundle",
      target_location_id: claim().targetLocationId,
      target_longitude: 105.8342,
      target_latitude: 21.0278,
      parser_version: WEATHERAPI_PARSER_VERSION,
      attempt_count: 1,
      max_attempts: 3,
      lease_token: claim().leaseToken,
      lease_expires_at: new Date(now.getTime() + 5_000),
      sanitized_metadata: null
    }] },
    { rows: [{ lease_expires_at: new Date(now.getTime() + 5_000) }] },
    { rows: [{
      observations_inserted: 1,
      observations_existing: 0,
      forecasts_inserted: 2,
      forecasts_existing: 0
    }] },
    { rows: [{ run_status: "succeeded" }] },
    { rows: [{
      run_status: "retry_wait",
      available_at: new Date(now.getTime() + 1_000),
      dead_lettered_at: null
    }] },
    { rows: [{ run_status: "failed" }] }
  ];
  const sqlClient = {
    async query(text, values) {
      queries.push({ text, values });
      return results.shift();
    }
  };
  const store = new PostgresWeatherRuntimeStore(sqlClient);
  const run = await store.claim(baseConfig.workerId, baseConfig.leaseDurationMilliseconds);
  await store.heartbeat(run.runId, run.leaseToken, baseConfig.workerId, 5_000);
  const bundle = mapNormalizedWeatherPayload(payload(), "bundle");
  await store.persist(run.runId, run.leaseToken, bundle);
  await store.complete(run.runId, run.leaseToken, "succeeded", 3, 3, null, null);
  await store.retry(run.runId, run.leaseToken, new Date(now.getTime() + 1_000), "retryable", null);
  await store.fail(run.runId, run.leaseToken, "terminal", null);

  assert.equal(queries.length, 6);
  for (const functionName of [
    "claim_weather_run", "heartbeat_weather_run", "persist_weather_bundle",
    "complete_weather_run", "retry_weather_run", "fail_weather_run"
  ]) {
    assert.ok(queries.some(({ text }) => text.includes(`app_weather.${functionName}`)));
  }
  const persistQuery = queries[2];
  assert.deepEqual(JSON.parse(persistQuery.values[2]), bundle.observations);
  assert.deepEqual(JSON.parse(persistQuery.values[3]), bundle.forecasts);
  assert.equal(queries.every(({ text }) => !text.includes(secret)), true);
});

test("persists a successful run, heartbeats its lease, and exposes graceful readiness", async () => {
  const store = new MockStore([claim()]);
  const log = logger();
  let releaseProvider;
  const providerGate = new Promise((resolve) => { releaseProvider = resolve; });
  const runtime = new WeatherDurableRuntime({
    config: { ...baseConfig, heartbeatIntervalMilliseconds: 5 },
    secrets: { WEATHERAPI_API_KEY: secret },
    store,
    logger: log,
    adapterFactory: adapterFactory(async ({ apiKey, request }) => {
      assert.equal(apiKey, secret);
      assert.deepEqual(request.target, { latitude: 21.0278, longitude: 105.8342 });
      await providerGate;
      return payload();
    }),
    now: () => now,
    random: () => 0.5
  });

  runtime.start();
  await waitFor(() => call(store, "heartbeat") !== undefined);
  assert.equal(runtime.getReadiness().activeRun, true);
  releaseProvider();
  await waitFor(() => call(store, "complete") !== undefined);

  const persistCall = call(store, "persist");
  assert.equal(persistCall[3].observations.length, 1);
  assert.equal(persistCall[3].forecasts.length, 2);
  assert.deepEqual(call(store, "complete").slice(3), ["succeeded", 3, 3, null, null]);
  assert.equal(runtime.getReadiness().ready, true);
  await runtime.stop();
  assert.deepEqual(runtime.getReadiness(), {
    state: "stopped",
    ready: false,
    acceptingWork: false,
    activeRun: false,
    consecutivePollFailures: 0,
    lastSuccessfulPollAt: now
  });
});

test("completes partial normalized persistence with sanitized status details", async () => {
  const store = new MockStore([claim()]);
  const current = payload().current;
  const runtime = new WeatherDurableRuntime({
    config: baseConfig,
    secrets: { WEATHERAPI_API_KEY: secret },
    store,
    adapterFactory: adapterFactory(async () => payload({
      current: { ...current, quality: quality("partial") }
    })),
    now: () => now
  });

  runtime.start();
  await waitFor(() => call(store, "complete") !== undefined);
  assert.deepEqual(call(store, "complete").slice(3), [
    "partial",
    3,
    3,
    "weather_data_partial",
    "Normalized weather data is partial."
  ]);
  await runtime.stop();
});

test("uses bounded exponential backoff and delegates retry/dead-letter decisions", async (context) => {
  assert.equal(calculateWeatherRetryDelayMilliseconds(1, 1_000, 8_000, 0.2, 0), 800);
  assert.equal(calculateWeatherRetryDelayMilliseconds(3, 1_000, 8_000, 0.2, 0.5), 4_000);
  assert.equal(calculateWeatherRetryDelayMilliseconds(20, 1_000, 8_000, 0.2, 1), 8_000);

  for (const [name, attemptCount, delegatedStatus] of [
    ["retry", 2, "retry_wait"],
    ["final attempt", 3, "dead_letter"]
  ]) {
    await context.test(name, async () => {
      const store = new MockStore([claim({ attemptCount })]);
      store.retryResult = {
        runStatus: delegatedStatus,
        availableAt: new Date(now.getTime() + 2_000),
        deadLetteredAt: delegatedStatus === "dead_letter" ? now : null
      };
      const runtime = new WeatherDurableRuntime({
        config: baseConfig,
        secrets: { WEATHERAPI_API_KEY: secret },
        store,
        adapterFactory: adapterFactory(async () => {
          throw new WeatherProviderError(
            "WEATHER_PROVIDER_UNAVAILABLE",
            true,
            `unsafe ${secret} ${WEATHERAPI_ALLOWED_ORIGIN}`
          );
        }),
        now: () => now,
        random: () => 0.5
      });

      runtime.start();
      await waitFor(() => call(store, "retry") !== undefined);
      const retryCall = call(store, "retry");
      assert.equal(retryCall[3].toISOString(), new Date(
        now.getTime() + (attemptCount === 2 ? 2_000 : 4_000)
      ).toISOString());
      assert.equal(retryCall[4], "weather_provider_unavailable");
      assert.equal(call(store, "fail"), undefined);
      await runtime.stop();
    });
  }
});

test("auth, schema, and non-allowlisted provider configuration are terminal", async (context) => {
  const cases = [
    ["auth", claim(), new WeatherProviderError(
      "WEATHER_PROVIDER_AUTH_FAILED",
      false,
      `unsafe ${secret}`
    ), "weather_provider_auth_failed"],
    ["schema", claim(), new WeatherProviderError(
      "WEATHER_PROVIDER_SCHEMA_INVALID",
      false,
      `unsafe ${rawMarker}`
    ), "weather_provider_schema_invalid"],
    ["provider key", claim({ providerKey: "other" }), null, "weather_provider_configuration_invalid"],
    ["provider URL", claim({ providerBaseUrl: `${WEATHERAPI_ALLOWED_ORIGIN}/v1` }), null, "weather_provider_configuration_invalid"],
    ["credential reference", claim({ credentialReference: "OTHER_KEY" }), null, "weather_provider_configuration_invalid"]
  ];

  for (const [name, run, providerError, expectedCode] of cases) {
    await context.test(name, async () => {
      const store = new MockStore([run]);
      let adapterCalls = 0;
      const runtime = new WeatherDurableRuntime({
        config: baseConfig,
        secrets: { WEATHERAPI_API_KEY: secret },
        store,
        adapterFactory: adapterFactory(async () => {
          adapterCalls += 1;
          if (providerError !== null) throw providerError;
          return payload();
        }),
        now: () => now
      });

      runtime.start();
      await waitFor(() => call(store, "fail") !== undefined);
      assert.equal(call(store, "fail")[3], expectedCode);
      assert.equal(call(store, "retry"), undefined);
      if (name.includes("provider") || name === "credential reference") {
        assert.equal(adapterCalls, 0);
      }
      await runtime.stop();
    });
  }
});

test("recovers durable polling when PostgreSQL and optional wake coordination fail", async () => {
  const store = new MockStore([
    new Error(`database exposed ${secret}`),
    null,
    claim()
  ]);
  const log = logger();
  let wakeCalls = 0;
  const wakeChannel = {
    async waitForWake() {
      wakeCalls += 1;
      throw new Error(`redis exposed ${secret}`);
    },
    async publish() {
      throw new Error("redis unavailable");
    }
  };
  const runtime = new WeatherDurableRuntime({
    config: baseConfig,
    secrets: { WEATHERAPI_API_KEY: secret },
    store,
    wakeChannel,
    logger: log,
    adapterFactory: adapterFactory(async () => payload()),
    now: () => now
  });

  runtime.start();
  await waitFor(() => call(store, "complete") !== undefined);
  assert.ok(store.calls.filter(([name]) => name === "claim").length >= 3);
  assert.ok(wakeCalls >= 1);
  assert.ok(log.entries.some((entry) => entry.event === "weather_runtime_poll_failed"));
  assert.equal(runtime.getReadiness().state, "ready");
  await runtime.stop();
});

test("never leaks secrets, target, URL, raw fields, or unsafe error text", async () => {
  const store = new MockStore([claim()]);
  const log = logger();
  const unsafeError = new Error([
    secret,
    WEATHERAPI_ALLOWED_ORIGIN,
    "21.0278,105.8342",
    rawMarker
  ].join(" "));
  const runtime = new WeatherDurableRuntime({
    config: baseConfig,
    secrets: { WEATHERAPI_API_KEY: secret },
    store,
    logger: log,
    adapterFactory: adapterFactory(async () => { throw unsafeError; }),
    now: () => now,
    random: () => 0.5
  });

  runtime.start();
  await waitFor(() => call(store, "retry") !== undefined);
  const visibleValues = [
    JSON.stringify(log.entries),
    JSON.stringify(call(store, "retry").slice(3)),
    inspect(runtime),
    inspect(log.entries)
  ].join("\n");
  for (const forbidden of [
    secret,
    WEATHERAPI_ALLOWED_ORIGIN,
    "21.0278",
    "105.8342",
    rawMarker
  ]) {
    assert.equal(visibleValues.includes(forbidden), false);
  }
  assert.equal(call(store, "retry")[4], "weather_runtime_unavailable");
  assert.equal(call(store, "retry")[5], "Weather runtime dependency is unavailable.");
  await runtime.stop();
});
