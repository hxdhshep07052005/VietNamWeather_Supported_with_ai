import assert from 'node:assert/strict';
import test from 'node:test';
import { RouteWeatherRefresh } from '../dist/route/route-weather-refresh.js';

const now = new Date('2026-09-30T02:05:00Z');
function sample(latitude = 21, longitude = 105, weather) {
  return { coordinates: { latitude, longitude }, eta: now.toISOString(), distance_from_start_meters: 0,
    time_from_departure_seconds: 0, is_interpolated: false, has_weather_data: false, weather };
}
function store() {
  const calls = [];
  return { calls, async enqueue(...args) {
    calls.push(args);
    return { runId: String(calls.length), status: 'queued', inserted: true };
  } };
}

test('refreshes missing core weather but ignores absent official alerts and rainfall', async () => {
  const queue = store();
  const usable = { coverage: 'covered', freshness: 'aging', gust_kmh: 0, temperature_c: 0,
    visibility_m: 0, official_alert_level: null, rain_mm_per_hour: null, valid_to: null };
  const result = await new RouteWeatherRefresh(queue, () => now).refresh([
    sample(21, 105, usable), sample(22, 105, { ...usable, freshness: 'stale' }),
    sample(23, 105, { ...usable, temperature_c: null }), sample(24, 105),
  ]);
  assert.equal(result.requested, 3);
  assert.equal(result.inserted, 3);
  assert.deepEqual(queue.calls.map(call => call[0].coordinates.latitude), [22, 23, 24]);
  assert.ok(queue.calls.every(call => call[1] === 'bundle' && call[3] === now));
});

test('deduplicates nearby coordinates regardless of route distance and retains distant points', async () => {
  const queue = store();
  const result = await new RouteWeatherRefresh(queue, () => now).refresh([
    sample(21, 105), { ...sample(21.04, 105.04), distance_from_start_meters: 500000 }, sample(21.11, 105),
  ]);
  assert.equal(result.requested, 2);
  assert.equal(result.deferred, 0);
  assert.deepEqual(queue.calls.map(call => call[0].coordinates), [
    { latitude: 21, longitude: 105 }, { latitude: 21.11, longitude: 105 },
  ]);
});

test('uses opaque stable keys for rounded coordinates within a ten minute bucket', async () => {
  const queue = store();
  await new RouteWeatherRefresh(queue, () => now).refresh([sample(21.00011, 105.00012)]);
  await new RouteWeatherRefresh(queue, () => new Date('2026-09-30T02:09:59Z')).refresh([sample(21.00019, 105.00019)]);
  await new RouteWeatherRefresh(queue, () => new Date('2026-09-30T02:10:00Z')).refresh([sample(21.00019, 105.00019)]);
  assert.equal(queue.calls[0][2], queue.calls[1][2]);
  assert.notEqual(queue.calls[1][2], queue.calls[2][2]);
  assert.match(queue.calls[0][2], /^route-weather:[a-f0-9]{64}$/);
});

test('caps spatial anchors and limits queue concurrency to four', async () => {
  let active = 0, maximum = 0, total = 0;
  const queue = { async enqueue() {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active--; total++;
    return { runId: String(total), status: 'queued', inserted: total % 2 === 0 };
  } };
  const result = await new RouteWeatherRefresh(queue, () => now).refresh(
    Array.from({ length: 105 }, (_, index) => sample(0, index * 0.2)),
  );
  assert.equal(maximum, 4);
  assert.equal(result.requested, 100);
  assert.equal(result.inserted, 50);
  assert.equal(result.runs.length, 100);
  assert.equal(result.deferred, 5);
});

test('does not queue any requests when every point has usable core weather', async () => {
  const queue = store();
  const result = await new RouteWeatherRefresh(queue, () => now).refresh([sample(21, 105, {
    coverage: 'covered', freshness: 'fresh', gust_kmh: 1, temperature_c: 25, visibility_m: 10000,
  })]);
  assert.deepEqual(result, { requested: 0, inserted: 0, deferred: 0, runs: [] });
});
