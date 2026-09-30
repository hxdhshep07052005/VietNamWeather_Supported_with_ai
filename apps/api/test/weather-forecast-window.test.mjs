import assert from 'node:assert/strict';
import test from 'node:test';
import { selectForecastWindow } from '../dist/weather-forecast-window.js';

test('limits daily forecasts to three overlapping future days, excluding expired days', () => {
  const now = new Date('2026-09-30T02:00:00Z');
  const rows = Array.from({length: 5}, (_, i) => ({ fetched_at: '2026-09-30T01:00:00Z', horizon_kind: 'daily', valid_from: new Date(Date.UTC(2026,8,28+i,17)).toISOString(), valid_to: new Date(Date.UTC(2026,8,29+i,17)).toISOString() }));
  const result = selectForecastWindow(rows.reverse(), 'daily', now);
  assert.equal(result.length, 3);
  assert.equal(result[0].valid_from, '2026-09-29T17:00:00.000Z');
});

test('keeps current hourly interval and excludes points beyond 72 hours', () => {
  const now = new Date('2026-09-30T02:30:00Z');
  const rows = Array.from({length: 100}, (_, i) => ({ fetched_at: '2026-09-30T01:00:00Z', horizon_kind: 'hourly', valid_from: new Date(Date.UTC(2026,8,30,i)).toISOString(), valid_to: new Date(Date.UTC(2026,8,30,i+1)).toISOString() }));
  const result = selectForecastWindow(rows, 'hourly', now);
  assert.equal(result.length, 72);
  assert.equal(result[0].valid_from, '2026-09-30T02:00:00.000Z');
});

test('selects the latest run without mixing old UTC-midnight daily intervals', () => {
  const now = new Date('2026-09-30T02:00:00Z');
  const oldDays = Array.from({length: 3}, (_, i) => ({
    horizon_kind: 'daily', fetched_at: '2026-09-30T00:00:00Z',
    valid_from: new Date(Date.UTC(2026, 8, 30 + i)).toISOString(),
    valid_to: new Date(Date.UTC(2026, 8, 31 + i)).toISOString(),
  }));
  const newDays = Array.from({length: 3}, (_, i) => ({
    horizon_kind: 'daily', fetched_at: '2026-09-30T01:00:00Z',
    valid_from: new Date(Date.UTC(2026, 8, 29 + i, 17)).toISOString(),
    valid_to: new Date(Date.UTC(2026, 8, 30 + i, 17)).toISOString(),
  }));

  const result = selectForecastWindow([...oldDays, ...newDays].reverse(), 'daily', now);

  assert.deepEqual(result, newDays);
});

test('does not fill a newer partial run with hours or days from an older run', () => {
  const now = new Date('2026-09-30T02:30:00Z');
  const oldHour = { horizon_kind: 'hourly', fetched_at: '2026-09-30T00:00:00Z', valid_from: '2026-09-30T03:00:00Z', valid_to: '2026-09-30T04:00:00Z' };
  const oldDay = { ...oldHour, horizon_kind: 'daily', valid_from: '2026-09-29T17:00:00Z', valid_to: '2026-09-30T17:00:00Z' };
  const newHour = { ...oldHour, fetched_at: '2026-09-30T01:00:00+00:00', valid_from: '2026-09-30T02:00:00Z', valid_to: '2026-09-30T03:00:00Z' };

  assert.deepEqual(selectForecastWindow([oldDay, oldHour, newHour], 'hourly', now), [newHour]);
  assert.deepEqual(selectForecastWindow([oldDay, oldHour, newHour], 'daily', now), []);
});
