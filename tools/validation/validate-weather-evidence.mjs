import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fromRoot = path => import(pathToFileURL(resolve(path)).href);
const { default: pg } = await fromRoot('apps/api/node_modules/pg/lib/index.js');
const { readWeatherEvidence } = await fromRoot('apps/api/dist/risk/weather-evidence.js');
const { assessReportHazard } = await fromRoot('apps/api/dist/risk/report-hazard.js');
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_DATABASE, user: process.env.API_DB_USER, password: process.env.API_DB_PASSWORD });
const client = await pool.connect();
const now = new Date('2026-09-30T03:15:00Z');
const target = new Date('2026-09-30T03:30:00Z');
const coordinates = { latitude: 21, longitude: 105 };
const results = [];

// Run the production SQL against transaction-local fixtures; leave stored weather untouched.
const fixturePool = { query: (sql, args) => client.query(sql
  .replaceAll('public.weather_forecasts', 'pg_temp.forecast_probe')
  .replaceAll('public.weather_observations', 'pg_temp.observation_probe'), args) };
const read = (time = target) => readWeatherEvidence(fixturePool, coordinates, time, now);
const check = async (name, scenario) => {
  try { await scenario(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, actual: error.actual, expected: error.expected }); }
};

try {
  await client.query('BEGIN');
  await client.query(`CREATE TEMP TABLE forecast_probe (
    coordinates geometry(Point,4326), temperature_celsius numeric, wind_gust_mps numeric,
    humidity_percent numeric, wind_speed_mps numeric, feels_like_celsius numeric,
    pressure_hpa numeric, precipitation_mm numeric, visibility_meters numeric,
    uv_index numeric, cloud_cover_percent numeric, precipitation_probability_percent numeric,
    fetched_at timestamptz, condition_code text, provider_id text, provider_issued_at timestamptz,
    expires_at timestamptz, status text, valid_from timestamptz, valid_to timestamptz,
    horizon_kind text, observed_at timestamptz
  ) ON COMMIT DROP`);
  await client.query('CREATE TEMP TABLE observation_probe (LIKE forecast_probe) ON COMMIT DROP');
  await client.query(`INSERT INTO forecast_probe (coordinates, temperature_celsius, wind_gust_mps,
    visibility_meters, precipitation_mm, fetched_at, condition_code, provider_id,
    provider_issued_at, expires_at, status, valid_from, valid_to, horizon_kind, observed_at)
    VALUES (ST_SetSRID(ST_MakePoint(105,21),4326),27,6.94,10000,12,'2026-09-30T03:05:00Z',
      'clear','provider','2026-09-30T03:00:00Z','2026-09-30T05:00:00Z','valid',
      '2026-09-30T03:00:00Z','2026-09-30T04:00:00Z','hourly','2026-09-30T03:00:00Z')`);
  await client.query(`INSERT INTO forecast_probe SELECT ST_SetSRID(ST_MakePoint(105.01,21),4326),
    28,wind_gust_mps,humidity_percent,wind_speed_mps,feels_like_celsius,pressure_hpa,
    precipitation_mm,visibility_meters,uv_index,cloud_cover_percent,precipitation_probability_percent,
    '2026-09-30T03:10:00Z',condition_code,provider_id,provider_issued_at,expires_at,status,
    valid_from,valid_to,horizon_kind,observed_at FROM forecast_probe`);

  await check('nearest eligible sample wins over newer nearby sample', async () => {
    assert.equal((await read()).temperature_c, 27);
  });
  await check('gust just below caution threshold stays low', async () => {
    const weather = await read();
    assert.equal(assessReportHazard(weather).evidence.find(e => e.dimension === 'wind').severity, 1);
  });
  await client.query('UPDATE forecast_probe SET wind_gust_mps = 11.107');
  await check('gust just below high threshold stays caution', async () => {
    assert.equal(assessReportHazard(await read()).evidence.find(e => e.dimension === 'wind').severity, 2);
  });
  await client.query(`UPDATE forecast_probe SET provider_issued_at='2026-09-29T02:00:00Z'
    WHERE temperature_celsius=27`);
  await check('fresh nearby forecast wins over old issuance at nearest sample', async () => {
    const weather = await read();
    assert.equal(weather.temperature_c, 28);
    assert.equal(weather.freshness, 'fresh');
  });

  await client.query('INSERT INTO observation_probe SELECT * FROM forecast_probe');
  await check('current amount and hourly forecast are kept distinct', async () => {
    const weather = await read(now);
    assert.equal(weather.precipitation_mm, 12);
    assert.equal(weather.rain_mm_per_hour, null);
    assert.equal(weather.rain_source, undefined);
  });
  await client.query(`UPDATE forecast_probe SET provider_issued_at='2026-09-30T03:00:00Z',
    precipitation_probability_percent=34`);
  await check('fresh forecast supplies labeled hourly rain for current time', async () => {
    const weather = await read(now);
    assert.equal(weather.rain_mm_per_hour, 12);
    assert.equal(weather.rain_source.kind, 'hourly_forecast');
    assert.equal(weather.rain_source.valid_from, '2026-09-30T03:00:00.000Z');
  });
  await check('current rain probability uses the matching hourly forecast and preserves observations', async () => {
    const weather = await read(now);
    assert.equal(weather.precipitation_probability_percent, 34);
    assert.deepEqual(weather.precipitation_probability_source, weather.rain_source);
    assert.equal(weather.temperature_c, 27);
    assert.equal(weather.precipitation_mm, 12);
  });
  await client.query('UPDATE forecast_probe SET precipitation_mm=NULL, precipitation_probability_percent=0');
  await check('zero rain probability survives a missing hourly rainfall amount', async () => {
    const weather = await read(now);
    assert.equal(weather.precipitation_probability_percent, 0);
    assert.equal(weather.precipitation_probability_source.kind, 'hourly_forecast');
    assert.equal(weather.rain_mm_per_hour, null);
    assert.equal(weather.rain_source, undefined);
  });
  await client.query('UPDATE forecast_probe SET precipitation_probability_percent=NULL');
  await check('missing rain probability remains unknown without erasing current weather', async () => {
    const weather = await read(now);
    assert.equal(weather.precipitation_probability_percent, null);
    assert.equal(weather.precipitation_probability_source, undefined);
    assert.equal(weather.temperature_c, 27);
  });
  await client.query(`UPDATE observation_probe SET observed_at=CASE WHEN temperature_celsius=27
    THEN '2026-09-30T00:00:00Z'::timestamptz ELSE '2026-09-30T01:00:00Z'::timestamptz END`);
  await check('eligible nearby observation wins over stale nearest observation for past target', async () => {
    const weather = await read(new Date('2026-09-30T02:00:00Z'));
    assert.equal(weather.temperature_c, 28);
    assert.equal(weather.freshness, 'aging');
  });
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.every(result => result.passed) ? 0 : 1;
