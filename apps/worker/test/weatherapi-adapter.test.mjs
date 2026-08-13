import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inspect } from "node:util";
import test from "node:test";

const weatherModuleUrl = process.env.WEATHER_TEST_MODULE_URL
  ?? new URL("../dist/weather/index.js", import.meta.url).href;
const {
  WeatherApiAdapter,
  WEATHERAPI_ALLOWED_ORIGIN,
  WEATHERAPI_FORECAST_PATH,
  WeatherProviderError
} = await import(weatherModuleUrl);

const forecastFixture = JSON.parse(await readFile(new URL(
  "./fixtures/weatherapi/forecast-3day-hanoi.sanitized.json",
  import.meta.url
), "utf8"));
const quotaFixture = JSON.parse(await readFile(new URL(
  "./fixtures/weatherapi/quota-error.sanitized.json",
  import.meta.url
), "utf8"));
// gitleaks:allow - this is a test-only fake key used to validate SSRF protection and secret non-leakage
const secret = "testSecret_123456789";
const request = {
  target: { latitude: 21.0278, longitude: 105.8342 },
  forecastDays: 3
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function adapterWithResponse(body, status) {
  return new WeatherApiAdapter({
    apiKey: secret,
    timeoutMilliseconds: 1_000,
    now: () => new Date("2026-08-09T12:40:00.000Z"),
    fetch: async () => jsonResponse(body, status)
  });
}

async function captureError(action) {
  try {
    await action();
    assert.fail("Expected WeatherProviderError");
  } catch (error) {
    assert.ok(error instanceof WeatherProviderError);
    return error;
  }
}

test("calls only the exact HTTPS allowlisted WeatherAPI forecast URL", async () => {
  let capturedUrl;
  let capturedOptions;
  const adapter = new WeatherApiAdapter({
    apiKey: secret,
    timeoutMilliseconds: 1_000,
    now: () => new Date("2026-08-09T12:40:00.000Z"),
    fetch: async (url, options) => {
      capturedUrl = new URL(url);
      capturedOptions = options;
      return jsonResponse(forecastFixture);
    }
  });

  const weather = await adapter.getWeather(request);
  assert.equal(capturedUrl.origin, WEATHERAPI_ALLOWED_ORIGIN);
  assert.equal(capturedUrl.pathname, WEATHERAPI_FORECAST_PATH);
  assert.equal(capturedUrl.protocol, "https:");
  assert.equal(capturedUrl.searchParams.get("key"), secret);
  assert.equal(capturedUrl.searchParams.get("q"), "21.0278,105.8342");
  assert.equal(capturedUrl.searchParams.get("days"), "3");
  assert.equal(capturedUrl.searchParams.get("aqi"), "no");
  assert.equal(capturedUrl.searchParams.get("alerts"), "no");
  assert.equal(capturedOptions.method, "GET");
  assert.equal(capturedOptions.redirect, "error");
  assert.ok(capturedOptions.signal instanceof AbortSignal);
  assert.equal(weather.hourly.length, 72);
});

test("rejects non-allowlisted origin, protocol, path, credentials, query, and fragment", () => {
  const rejectedEndpoints = [
    "http://api.weatherapi.com/v1/forecast.json",
    "https://api.weatherapi.com.evil.example/v1/forecast.json",
    "https://api.weatherapi.com/v1/current.json",
    "https://api.weatherapi.com/v1/forecast.json/",
    "https://user@api.weatherapi.com/v1/forecast.json",
    "https://api.weatherapi.com/v1/forecast.json?key=not-allowed-here",
    "https://api.weatherapi.com/v1/forecast.json#fragment"
  ];

  for (const endpoint of rejectedEndpoints) {
    assert.throws(
      () => new WeatherApiAdapter({ apiKey: secret, timeoutMilliseconds: 1_000, endpoint }),
      (error) => {
        assert.ok(error instanceof WeatherProviderError);
        assert.equal(error.code, "WEATHER_PROVIDER_CONFIGURATION_INVALID");
        assert.equal(error.retryable, false);
        assert.equal(inspect(error).includes(secret), false);
        return true;
      }
    );
  }
});

test("never exposes the query key through network or provider errors and logs", async () => {
  const networkAdapter = new WeatherApiAdapter({
    apiKey: secret,
    timeoutMilliseconds: 1_000,
    fetch: async (url) => {
      throw new Error(`network failed for ${url}`);
    }
  });
  const networkError = await captureError(() => networkAdapter.getWeather(request));
  assert.equal(networkError.code, "WEATHER_PROVIDER_UNAVAILABLE");
  assert.equal(networkError.retryable, true);

  const providerAdapter = adapterWithResponse({
    error: { code: 1006, message: `provider echoed ${secret}` }
  }, 400);
  const providerError = await captureError(() => providerAdapter.getWeather(request));
  assert.equal(providerError.code, "WEATHER_PROVIDER_REQUEST_INVALID");

  for (const value of [
    networkError.message,
    networkError.stack,
    JSON.stringify(networkError),
    inspect(networkError),
    providerError.message,
    providerError.stack,
    JSON.stringify(providerError),
    inspect(providerError),
    inspect(networkAdapter)
  ]) {
    assert.equal(String(value).includes(secret), false);
  }
});

test("classifies timeout, rate limit, server, auth, hard quota, and schema errors", async (context) => {
  await context.test("timeout is retryable", async () => {
    const adapter = new WeatherApiAdapter({
      apiKey: secret,
      timeoutMilliseconds: 5,
      fetch: (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      })
    });
    const error = await captureError(() => adapter.getWeather(request));
    assert.equal(error.code, "WEATHER_PROVIDER_TIMEOUT");
    assert.equal(error.retryable, true);
  });

  await context.test("429 is retryable", async () => {
    const error = await captureError(() => adapterWithResponse({}, 429).getWeather(request));
    assert.equal(error.code, "WEATHER_PROVIDER_RATE_LIMITED");
    assert.equal(error.retryable, true);
    assert.equal(error.statusCode, 429);
  });

  await context.test("5xx is retryable", async () => {
    const error = await captureError(() => adapterWithResponse({}, 503).getWeather(request));
    assert.equal(error.code, "WEATHER_PROVIDER_UNAVAILABLE");
    assert.equal(error.retryable, true);
    assert.equal(error.statusCode, 503);
  });

  await context.test("auth is not retryable", async () => {
    const error = await captureError(() => adapterWithResponse({
      error: { code: 2006, message: "sanitized" }
    }, 401).getWeather(request));
    assert.equal(error.code, "WEATHER_PROVIDER_AUTH_FAILED");
    assert.equal(error.retryable, false);
    assert.equal(error.providerCode, 2006);
  });

  await context.test("hard quota is not retryable", async () => {
    const error = await captureError(() => adapterWithResponse(quotaFixture, 403).getWeather(request));
    assert.equal(error.code, "WEATHER_PROVIDER_QUOTA_EXHAUSTED");
    assert.equal(error.retryable, false);
    assert.equal(error.providerCode, 2007);
  });

  await context.test("schema failure is not retryable", async () => {
    const error = await captureError(() => adapterWithResponse({ current: {} }, 200).getWeather(request));
    assert.equal(error.code, "WEATHER_PROVIDER_SCHEMA_INVALID");
    assert.equal(error.retryable, false);
  });
});

test("distinguishes caller abort from retryable timeout", async () => {
  const controller = new AbortController();
  const adapter = new WeatherApiAdapter({
    apiKey: secret,
    timeoutMilliseconds: 1_000,
    fetch: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    })
  });
  const pending = adapter.getWeather({ ...request, signal: controller.signal });
  controller.abort();
  const error = await captureError(() => pending);
  assert.equal(error.code, "WEATHER_PROVIDER_REQUEST_ABORTED");
  assert.equal(error.retryable, false);
});

test("rejects invalid coordinates and capability requests before fetch", async () => {
  let calls = 0;
  const adapter = new WeatherApiAdapter({
    apiKey: secret,
    timeoutMilliseconds: 1_000,
    fetch: async () => {
      calls += 1;
      return jsonResponse(forecastFixture);
    }
  });

  for (const invalidRequest of [
    { target: { latitude: 91, longitude: 105 }, forecastDays: 3 },
    { target: { latitude: 21, longitude: -181 }, forecastDays: 3 },
    { target: { latitude: 21, longitude: 105 }, forecastDays: 0 },
    { target: { latitude: 21, longitude: 105 }, forecastDays: 4 }
  ]) {
    const error = await captureError(() => adapter.getWeather(invalidRequest));
    assert.equal(error.code, "WEATHER_PROVIDER_REQUEST_INVALID");
    assert.equal(error.retryable, false);
  }
  assert.equal(calls, 0);
});
