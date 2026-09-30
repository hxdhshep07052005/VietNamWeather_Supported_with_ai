import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const weatherModuleUrl = process.env.WEATHER_TEST_MODULE_URL
  ?? new URL("../dist/weather/index.js", import.meta.url).href;
const {
  calculateNormalizedPayloadChecksum,
  kilometersPerHourToMetersPerSecond,
  kilometersToMeters,
  normalizeWeatherApiResponse,
  WeatherProviderError
} = await import(weatherModuleUrl);

const fixtureUrl = new URL(
  "./fixtures/weatherapi/forecast-3day-hanoi.sanitized.json",
  import.meta.url
);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const target = { latitude: 21.0278, longitude: 105.8342 };
const fetchedAt = new Date("2026-08-09T12:40:00.000Z");

function normalize(value = structuredClone(fixture)) {
  return normalizeWeatherApiResponse(value, {
    target,
    forecastDays: 3,
    fetchedAt
  });
}

function assertSchemaError(error) {
  assert.ok(error instanceof WeatherProviderError);
  assert.equal(error.code, "WEATHER_PROVIDER_SCHEMA_INVALID");
  assert.equal(error.retryable, false);
  return true;
}

test("normalizes sanitized current, 72 hourly, and 3 daily records", () => {
  const weather = normalize();

  assert.equal(weather.schemaVersion, "weather.v1");
  assert.equal(weather.source.provider, "weatherapi");
  assert.deepEqual(weather.source.attribution, {
    name: "WeatherAPI.com",
    url: "https://www.weatherapi.com/"
  });
  assert.equal(weather.providerIssuedAt, null);
  assert.deepEqual(weather.target, target);
  assert.equal(weather.current.kind, "observation");
  assert.equal(weather.current.providerIssuedAt, null);
  assert.equal(weather.hourly.length, 72);
  assert.equal(weather.daily.length, 3);
  assert.ok(weather.hourly.every((hour) => hour.providerIssuedAt === null));
  assert.ok(weather.daily.every((day) => day.providerIssuedAt === null));

  assert.deepEqual(weather.capabilities.current, {
    available: true,
    observedAt: "2026-08-09T12:34:56.000Z"
  });
  assert.deepEqual(weather.capabilities.hourly, {
    available: true,
    records: 72,
    validFrom: "2026-08-08T17:00:00.000Z",
    validTo: "2026-08-11T17:00:00.000Z",
    intervalMinutes: 60
  });
  assert.deepEqual(weather.capabilities.daily, {
    available: true,
    records: 3,
    validFrom: "2026-08-08T17:00:00.000Z",
    validTo: "2026-08-11T17:00:00.000Z",
    intervalDays: 1
  });
  assert.equal(weather.capabilities.operationalHorizonHours, 72);
  assert.equal(weather.capabilities.day4To7Outlook, false);
});

test("preserves Vietnam local-day coverage while emitting UTC instants and metric units", () => {
  const weather = normalize();

  assert.equal(weather.current.observedAt, "2026-08-09T12:34:56.000Z");
  assert.equal(weather.daily[0].date, "2026-08-09");
  assert.equal(weather.daily[0].validInterval.from, "2026-08-08T17:00:00.000Z");
  assert.equal(weather.hourly[0].validInterval.from, "2026-08-08T17:00:00.000Z");
  assert.equal(weather.hourly[0].validInterval.to, "2026-08-08T18:00:00.000Z");
  assert.equal(JSON.stringify(weather).includes("ignored-local"), false);

  assert.equal(weather.units.temperature, "celsius");
  assert.equal(weather.units.windSpeed, "metres_per_second");
  assert.equal(weather.units.visibility, "metres");
  assert.equal(weather.current.windSpeedMetresPerSecond, 1);
  assert.equal(weather.current.windGustMetresPerSecond, 2);
  assert.equal(weather.current.visibilityMetres, 1_250);
  assert.equal(weather.current.windDirectionDegrees, 360);
  assert.equal(weather.hourly[0].windSpeedMetresPerSecond, 0);
  assert.equal(weather.hourly[0].visibilityMetres, 0);
  assert.equal(weather.daily[0].maximumWindSpeedMetresPerSecond, 10);
  assert.equal(weather.current.conditionCode, "rain");
  assert.equal(weather.daily[0].conditionCode, "thunderstorm");
  assert.equal(weather.hourly[1].quality.state, "partial");
  assert.ok(weather.hourly[1].quality.missingFields.includes("visibilityMetres"));
});

test("unit conversion covers zero, exact values, and invalid boundaries", () => {
  assert.equal(kilometersPerHourToMetersPerSecond(0), 0);
  assert.equal(kilometersPerHourToMetersPerSecond(3.6), 1);
  assert.equal(kilometersToMeters(0), 0);
  assert.equal(kilometersToMeters(1.25), 1_250);
  assert.throws(() => kilometersPerHourToMetersPerSecond(-0.001), RangeError);
  assert.throws(() => kilometersPerHourToMetersPerSecond(Number.POSITIVE_INFINITY), RangeError);
  assert.throws(() => kilometersToMeters(-0.001), RangeError);
  assert.throws(() => kilometersToMeters(Number.NaN), RangeError);
});

test("keeps local midnight boundaries when the provider returns a partial day", () => {
  const partial = structuredClone(fixture);
  partial.forecast.forecastday[0].hour = partial.forecast.forecastday[0].hour.slice(12);

  const weather = normalize(partial);

  assert.equal(weather.daily[0].date, "2026-08-09");
  assert.deepEqual(weather.daily[0].validInterval, {
    from: "2026-08-08T17:00:00.000Z",
    to: "2026-08-09T17:00:00.000Z"
  });
  assert.equal(weather.hourly.length, 60);
  assert.equal(weather.hourly[0].validInterval.from, "2026-08-09T05:00:00.000Z");
});

test("rejects inconsistent provider days instead of silently dropping forecast hours", () => {
  const wrongHour = structuredClone(fixture);
  wrongHour.forecast.forecastday[0].hour[23].time_epoch += 3_600;
  assert.throws(() => normalize(wrongHour), assertSchemaError);

  const wrongDate = structuredClone(fixture);
  wrongDate.forecast.forecastday[0].date = "2026-08-10";
  assert.throws(() => normalize(wrongDate), assertSchemaError);
});

test("checksum is deterministic over the complete normalized payload", () => {
  const first = normalize();
  const second = normalize();
  assert.equal(first.normalizedPayloadChecksumSha256, second.normalizedPayloadChecksumSha256);
  assert.match(first.normalizedPayloadChecksumSha256, /^[a-f0-9]{64}$/);

  const { normalizedPayloadChecksumSha256: checksum, ...payload } = first;
  assert.equal(calculateNormalizedPayloadChecksum(payload), checksum);
  assert.equal(
    calculateNormalizedPayloadChecksum({ b: 2, a: [1, null] }),
    calculateNormalizedPayloadChecksum({ a: [1, null], b: 2 })
  );

  const changed = structuredClone(fixture);
  changed.current.temp_c += 0.1;
  assert.notEqual(normalize(changed).normalized_payload_checksum_sha256, checksum);
});

test("rejects malformed, missing, and out-of-range data with stable unknown conditions", () => {
  const missing = structuredClone(fixture);
  delete missing.current.temp_c;
  assert.throws(() => normalize(missing), assertSchemaError);

  const malformed = structuredClone(fixture);
  malformed.forecast.forecastday[0].hour[0].time_epoch = "1786233600";
  assert.throws(() => normalize(malformed), assertSchemaError);

  const outOfRange = structuredClone(fixture);
  outOfRange.current.humidity = 101;
  assert.throws(() => normalize(outOfRange), assertSchemaError);

  const unknownCondition = structuredClone(fixture);
  unknownCondition.current.condition.code = 9998;
  assert.equal(normalize(unknownCondition).current.conditionCode, "unknown");

  assert.throws(() => normalize(null), assertSchemaError);
});

test("does not retain raw provider fields or provider condition text", () => {
  const raw = structuredClone(fixture);
  raw.location.name = "sanitized-provider-location-label";
  raw.current.condition.text = "sanitized-provider-condition-text";
  raw.unrecognized_provider_field = "sanitized-raw-marker";
  const serialized = JSON.stringify(normalize(raw));

  assert.equal(serialized.includes("sanitized-provider-location-label"), false);
  assert.equal(serialized.includes("sanitized-provider-condition-text"), false);
  assert.equal(serialized.includes("sanitized-raw-marker"), false);
  assert.equal(serialized.includes("unrecognized_provider_field"), false);
});

test("normalizes ice pellets as sleet without inventing hail evidence", () => {
  for (const code of [1237, 1261, 1264]) {
    const raw = structuredClone(fixture);
    raw.current.condition.code = code;
    raw.forecast.forecastday[0].hour[0].condition.code = code;
    raw.forecast.forecastday[0].day.condition.code = code;

    const weather = normalize(raw);

    assert.equal(weather.current.conditionCode, "sleet", `current ${code}`);
    assert.equal(weather.hourly[0].conditionCode, "sleet", `hourly ${code}`);
    assert.equal(weather.daily[0].conditionCode, "sleet", `daily ${code}`);
  }
});

for (const [code, condition] of [
  [1012, 'haze'], [1015, 'haze'], [1018, 'dust'], [1021, 'dust_storm'],
  [1024, 'sandstorm'], [1027, 'sandstorm'], [1033, 'smoke'], [1036, 'haze'],
  [1039, 'smog'], [1042, 'smog'], [1045, 'dust'], [1048, 'dust'],
]) {
  test(`normalizes provider condition ${code} as ${condition} in all datasets`, () => {
    const raw = structuredClone(fixture);
    raw.current.condition.code = code;
    raw.forecast.forecastday[0].hour[0].condition.code = code;
    raw.forecast.forecastday[0].day.condition.code = code;
    const weather = normalize(raw);
    assert.equal(weather.current.conditionCode, condition);
    assert.equal(weather.hourly[0].conditionCode, condition);
    assert.equal(weather.daily[0].conditionCode, condition);
  });
}
