import assert from "node:assert/strict";
import test from "node:test";

import {
  ContractValidationError,
  WEATHER_ERROR_CATALOG,
  isWeatherCapabilitiesResponse,
  isWeatherQueryRequest,
  isWeatherQueryResponse,
  parseWeatherQueryRequest,
  safeParseWeatherQueryRequest,
  weatherOpenApiV1,
  weatherV1Schemas
} from "../dist/index.js";

const UNITS = {
  temperature: "celsius",
  windSpeed: "metres_per_second",
  precipitation: "millimetres",
  pressure: "hectopascals",
  visibility: "metres",
  relativeHumidity: "percent",
  probability: "percent",
  direction: "degrees"
};

const CORRELATION_ID = "corr-0123456789";
const LOCATION_ID = "11111111-1111-4111-8111-111111111111";

function featureCapability({
  enabled = true,
  granularityMinutes = 60,
  supported = true,
  allowed = true,
  available = true,
  horizon = 72,
  freshForSeconds = 21_600,
  staleDisplayForSeconds = 86_400
} = {}) {
  return {
    enabled,
    granularityMinutes,
    account: {
      supported,
      verifiedAt: "2026-08-09T00:00:00Z",
      maximumHorizonHours: supported ? horizon : null
    },
    entitlement: {
      allowed,
      maximumHorizonHours: allowed ? horizon : null
    },
    providerCoverage: {
      available,
      maximumHorizonHours: available ? horizon : null
    },
    operationalMaximumHorizonHours: enabled ? 72 : 0,
    effectiveMaximumHorizonHours: enabled ? horizon : 0,
    freshnessPolicy: {
      freshForSeconds: enabled ? freshForSeconds : null,
      staleDisplayForSeconds: enabled ? staleDisplayForSeconds : null,
      staleDisplayEligible: enabled,
      staleRiskEligible: false,
      staleRouteEligible: false
    }
  };
}

function unavailableFeature() {
  return featureCapability({
    enabled: false,
    granularityMinutes: null,
    supported: false,
    allowed: false,
    available: false,
    horizon: 0,
    freshForSeconds: null,
    staleDisplayForSeconds: null
  });
}

function datasetCoverage(dataset, status, returnedIntervals, expectedIntervals = returnedIntervals) {
  return {
    dataset,
    status,
    validInterval: status === "not_requested" || status === "unavailable"
      ? null
      : { from: "2026-08-09T01:00:00Z", to: "2026-08-09T02:00:00Z" },
    expectedIntervals,
    returnedIntervals,
    gaps: []
  };
}

function provenance() {
  return {
    provider: "Public weather source",
    parserVersion: "weather-normalizer-1",
    snapshotId: "snapshot:0123456789",
    providerIssuedAt: null,
    fetchedAt: "2026-08-09T01:00:00Z",
    expiresAt: "2026-08-09T07:00:00Z"
  };
}

function freshness(state = "fresh") {
  return {
    state,
    assessedAt: "2026-08-09T01:05:00Z",
    freshUntil: "2026-08-09T07:00:00Z",
    staleUntil: "2026-08-10T01:00:00Z",
    displayEligible: true,
    riskEligible: state === "fresh",
    routeEligible: state === "fresh"
  };
}

function weatherValues() {
  return {
    temperatureCelsius: 29.5,
    apparentTemperatureCelsius: 33,
    relativeHumidityPercent: 78,
    windSpeedMetresPerSecond: 3.2,
    windGustMetresPerSecond: null,
    windDirectionDegrees: 210,
    precipitationMillimetres: 0,
    pressureHectopascals: 1007,
    visibilityMetres: 10_000,
    uvIndex: 3,
    cloudCoverPercent: 55,
    conditionCode: "partly_cloudy"
  };
}

function queryData() {
  const currentCoverage = datasetCoverage("current", "complete", 1);
  const hourlyCoverage = datasetCoverage("hourly", "complete", 1);
  const dailyCoverage = datasetCoverage("daily", "not_requested", 0, null);
  return {
    target: { locationId: LOCATION_ID, timezone: "Asia/Ho_Chi_Minh" },
    units: UNITS,
    providerMixing: false,
    attribution: { name: "Public weather source", url: "https://weather.example.test/" },
    coverage: {
      requested: ["current", "hourly"],
      effectiveHorizonHours: 1,
      datasets: {
        current: currentCoverage,
        hourly: hourlyCoverage,
        daily: dailyCoverage
      }
    },
    current: {
      provenance: provenance(),
      freshness: freshness(),
      coverage: currentCoverage,
      value: {
        kind: "observation",
        observedAt: "2026-08-09T01:00:00Z",
        validInterval: { from: "2026-08-09T01:00:00Z", to: "2026-08-09T01:15:00Z" },
        quality: { state: "partial", missingFields: ["windGustMetresPerSecond"] },
        ...weatherValues()
      }
    },
    hourly: {
      provenance: provenance(),
      freshness: freshness(),
      coverage: hourlyCoverage,
      values: [{
        kind: "forecast",
        validInterval: { from: "2026-08-09T01:00:00Z", to: "2026-08-09T02:00:00Z" },
        quality: { state: "partial", missingFields: ["windGustMetresPerSecond"] },
        ...weatherValues(),
        precipitationProbabilityPercent: 20
      }]
    },
    daily: null
  };
}

test("OpenAPI v1 exposes only the versioned weather endpoints with cookie and mutation protection", () => {
  assert.equal(weatherOpenApiV1.openapi, "3.1.0");
  assert.strictEqual(weatherOpenApiV1.components.schemas, weatherV1Schemas);
  assert.ok(weatherOpenApiV1.paths["/api/v1/weather/capabilities"]);
  const queryPath = weatherOpenApiV1.paths["/api/v1/weather/query"];
  assert.ok(queryPath);
  assert.deepEqual(queryPath.post.security, [{ cookieAuth: [] }]);
  assert.deepEqual(
    queryPath.post.parameters,
    [
      { $ref: "#/components/parameters/Origin" },
      { $ref: "#/components/parameters/CsrfToken" }
    ]
  );
  assert.equal(weatherOpenApiV1.components.securitySchemes.cookieAuth.in, "cookie");
  assert.equal(weatherOpenApiV1.components.parameters.Origin.required, true);
  assert.equal(weatherOpenApiV1.components.parameters.CsrfToken.required, true);
  assert.deepEqual(Object.keys(WEATHER_ERROR_CATALOG).sort(), [
    "AUTHENTICATION_REQUIRED",
    "CSRF_VALIDATION_FAILED",
    "INTERNAL_ERROR",
    "INVALID_REQUEST",
    "LOCATION_NOT_FOUND",
    "ORIGIN_NOT_ALLOWED",
    "RATE_LIMITED",
    "WEATHER_UNAVAILABLE"
  ]);
});

test("weather query accepts exactly one target kind and a unique non-empty include list", () => {
  assert.equal(isWeatherQueryRequest({
    target: { locationId: LOCATION_ID },
    include: ["current", "hourly", "daily"]
  }), true);
  assert.equal(isWeatherQueryRequest({
    target: { coordinates: { latitude: 21.0285, longitude: 105.8542 } },
    include: ["current"]
  }), true);

  for (const invalid of [
    { target: { locationId: LOCATION_ID, coordinates: { latitude: 1, longitude: 1 } }, include: ["current"] },
    { target: { coordinates: { latitude: 91, longitude: 105.8542 } }, include: ["current"] },
    { target: { locationId: LOCATION_ID }, include: [] },
    { target: { locationId: LOCATION_ID }, include: ["current", "current"] },
    { target: { locationId: LOCATION_ID }, include: ["alerts"] },
    { target: { locationId: "location:ha-noi" }, include: ["current"] }
  ]) {
    assert.equal(isWeatherQueryRequest(invalid), false);
  }
});

test("runtime validation errors never retain or print submitted coordinate values", () => {
  const rawLatitude = 190.123456;
  const rawLongitude = 205.654321;
  const invalid = {
    target: { coordinates: { latitude: rawLatitude, longitude: rawLongitude } },
    include: ["current"]
  };
  const result = safeParseWeatherQueryRequest(invalid);
  assert.equal(result.success, false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(`${rawLatitude}|${rawLongitude}`));
  assert.throws(
    () => parseWeatherQueryRequest(invalid),
    (error) => {
      assert.ok(error instanceof ContractValidationError);
      assert.doesNotMatch(`${error.message}\n${JSON.stringify(error.issues)}`, new RegExp(`${rawLatitude}|${rawLongitude}`));
      assert.equal("value" in error, false);
      return true;
    }
  );
});

test("capability schema separates ceilings and fixes public units and baseline constraints", () => {
  const response = {
    status: "success",
    correlationId: CORRELATION_ID,
    data: {
      apiVersion: "v1",
      updatedAt: "2026-08-09T01:00:00Z",
      canonicalTimezone: "Asia/Ho_Chi_Minh",
      units: UNITS,
      fallback: "none",
      providerMixing: false,
      operationalMaximumHorizonHours: 72,
      source: {
        provider: "Public weather source",
        attribution: { name: "Public weather source", url: "https://weather.example.test/" }
      },
      features: {
        current: featureCapability({ granularityMinutes: null, horizon: 0, freshForSeconds: 900, staleDisplayForSeconds: 3_600 }),
        hourly: featureCapability(),
        daily: featureCapability({ granularityMinutes: 1_440 }),
        nowcast: unavailableFeature(),
        alerts: unavailableFeature(),
        spatialLayers: unavailableFeature()
      }
    }
  };
  assert.equal(isWeatherCapabilitiesResponse(response), true);
  assert.equal(isWeatherCapabilitiesResponse({
    ...response,
    data: { ...response.data, units: { ...UNITS, windSpeed: "kilometres_per_hour" } }
  }), false);
  assert.equal(isWeatherCapabilitiesResponse({
    ...response,
    data: { ...response.data, operationalMaximumHorizonHours: 168 }
  }), false);
});

test("query response schema accepts success, pending, degraded, unavailable and stable error", () => {
  const data = queryData();
  const responses = [
    { status: "success", data, correlationId: CORRELATION_ID },
    {
      status: "degraded",
      data: {
        ...data,
        hourly: {
          ...data.hourly,
          freshness: freshness("stale")
        }
      },
      issues: [{ code: "STALE_DATA", dataset: "hourly", retryable: true }],
      correlationId: CORRELATION_ID
    },
    { status: "pending", retryAfterSeconds: 5, correlationId: CORRELATION_ID },
    {
      status: "unavailable",
      error: {
        code: "WEATHER_UNAVAILABLE",
        message: "Weather data is temporarily unavailable.",
        correlationId: CORRELATION_ID,
        retryable: true
      }
    },
    {
      status: "error",
      error: {
        code: "INVALID_REQUEST",
        message: "Request validation failed.",
        correlationId: CORRELATION_ID,
        retryable: false
      }
    }
  ];
  for (const response of responses) assert.equal(isWeatherQueryResponse(response), true);

  assert.equal(data.current.provenance.providerIssuedAt, null);
  assert.notEqual(data.current.provenance.providerIssuedAt, data.current.provenance.fetchedAt);
});

test("freshness schema prevents stale or expired evidence from risk and route use", () => {
  const data = queryData();
  for (const state of ["stale", "expired", "unavailable"]) {
    assert.equal(isWeatherQueryResponse({
      status: "success",
      data: {
        ...data,
        current: {
          ...data.current,
          freshness: {
            ...freshness(state),
            riskEligible: true,
            routeEligible: true
          }
        }
      },
      correlationId: CORRELATION_ID
    }), false);
  }
});

test("public errors reject raw provider or coordinate-bearing messages", () => {
  assert.equal(isWeatherQueryResponse({
    status: "error",
    error: {
      code: "INTERNAL_ERROR",
      message: "Provider request failed at 21.0285,105.8542 with key=secret",
      correlationId: CORRELATION_ID,
      retryable: false
    }
  }), false);
  assert.equal(isWeatherQueryResponse({
    status: "error",
    error: {
      code: "INVALID_REQUEST",
      message: "An unexpected error occurred.",
      correlationId: CORRELATION_ID,
      retryable: true
    }
  }), false);
});
