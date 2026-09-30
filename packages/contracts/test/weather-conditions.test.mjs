import assert from 'node:assert/strict';
import test from 'node:test';
import { weatherV1Schemas } from '../dist/openapi-v1.js';

test('current hourly and daily schemas accept distinct airborne obscuration conditions', () => {
  for (const name of ['CurrentWeatherValue', 'HourlyWeatherValue', 'DailyWeatherValue']) {
    const codes = weatherV1Schemas[name].properties.conditionCode.oneOf[0].enum;
    for (const code of ['haze', 'dust', 'smoke', 'smog', 'dust_storm', 'sandstorm', 'unknown']) {
      assert.ok(codes.includes(code), `${name}: ${code}`);
    }
    assert.equal(codes.includes('unsupported_condition'), false);
  }
});
