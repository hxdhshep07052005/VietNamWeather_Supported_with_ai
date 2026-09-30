import assert from 'node:assert/strict';
import test from 'node:test';
import { readWeatherEvidence } from '../dist/risk/weather-evidence.js';
import { assessReportHazard } from '../dist/risk/report-hazard.js';
const now=new Date('2026-09-30T03:15:00Z');
const coords={latitude:21.028,longitude:105.854};
const observation={temperature_c:27.3,gust_kmh:17.7012,visibility_m:10000,precipitation_mm:0.2,
  rain_mm_per_hour:null,condition_code:'rain',source:'provider',source_time:now,fetched_at:now,
  expires_at:'2026-09-30T03:30:00Z',status:'valid',valid_from:now,valid_to:null,
  latitude:coords.latitude,longitude:coords.longitude,distance_meters:0};
const hour={rain_mm_per_hour:12,precipitation_probability_percent:34,source:'provider',source_time:null,fetched_at:now,
  valid_from:'2026-09-30T03:00:00Z',valid_to:'2026-09-30T04:00:00Z'};
test('current weather retains observed rainfall while rain risk uses labeled matching hourly forecast',async()=>{
  const calls=[];
  const pool={query:async(sql,args)=>{calls.push({sql,args});return {rows:[calls.length===1?observation:hour]};}};
  const weather=await readWeatherEvidence(pool,coords,now,now);
  assert.equal(weather.precipitation_mm,0.2);
  assert.equal(weather.rain_mm_per_hour,12);
  assert.equal(weather.rain_source.kind,'hourly_forecast');
  assert.equal(weather.rain_source.valid_from,new Date(hour.valid_from).toISOString());
  assert.deepEqual(weather.matched_coordinates,coords);
  const rain=assessReportHazard(weather).evidence.find(e=>e.dimension==='rain');
  assert.equal(rain.value,12);assert.equal(rain.severity,2);assert.equal(rain.source_kind,'hourly_forecast');
  assert.ok(!weather.reasons.includes('observation_precipitation_interval_unspecified'));
  assert.equal(calls.length,2);
  assert.deepEqual(calls[1].args.slice(0,2),[coords.longitude,coords.latitude]);
  assert.match(calls[1].sql,/provider_id::text = \$5/);
  assert.match(calls[1].sql,/expires_at > \$4/);
  assert.match(calls[1].sql,/valid_from <= \$3 AND valid_to > \$3/);
});
test('missing hourly rain keeps the known accumulation and never assumes mm means mm/hour',async()=>{
  let calls=0;
  const weather=await readWeatherEvidence({query:async()=>({rows:++calls===1?[observation]:[]})},coords,now,now);
  assert.equal(weather.precipitation_mm,0.2);assert.equal(weather.rain_mm_per_hour,null);
  assert.equal(weather.rain_source,undefined);
  assert.ok(weather.reasons.includes('observation_precipitation_interval_unspecified'));
});
test('current rain probability comes from the matching hourly forecast without replacing observations',async()=>{
  let calls=0;
  const weather=await readWeatherEvidence({query:async()=>({rows:[++calls===1?observation:hour]})},coords,now,now);
  assert.equal(weather.precipitation_probability_percent,34);
  assert.deepEqual(weather.precipitation_probability_source,weather.rain_source);
  assert.equal(weather.precipitation_probability_source.valid_from,new Date(hour.valid_from).toISOString());
  assert.equal(weather.temperature_c,27.3);
  assert.equal(weather.precipitation_mm,0.2);
});
test('zero rain chance is preserved independently of missing forecast accumulation',async()=>{
  let calls=0;
  const weather=await readWeatherEvidence({query:async()=>({rows:[++calls===1?observation:
    {...hour,rain_mm_per_hour:null,precipitation_probability_percent:0}]})},coords,now,now);
  assert.equal(weather.precipitation_probability_percent,0);
  assert.equal(weather.precipitation_probability_source.kind,'hourly_forecast');
  assert.equal(weather.rain_mm_per_hour,null);
  assert.equal(weather.rain_source,undefined);
  assert.ok(weather.reasons.includes('observation_precipitation_interval_unspecified'));
  assert.ok(!weather.reasons.includes('rain_from_hourly_forecast'));
});
test('unavailable or invalid probability cannot be inferred from rain accumulation',async()=>{
  for(const probability of [null,-1,101]){
    let calls=0;
    const weather=await readWeatherEvidence({query:async()=>({rows:[++calls===1?observation:
      {...hour,precipitation_probability_percent:probability}]})},coords,now,now);
    assert.equal(weather.precipitation_probability_percent,null);
    assert.equal(weather.precipitation_probability_source,undefined);
    assert.equal(weather.rain_mm_per_hour,12);
  }
});
test('future probability uses the selected forecast interval with its source',async()=>{
  const weather=await readWeatherEvidence({query:async()=>({rows:[{...observation,...hour}]})},coords,new Date(+now+60000),now);
  assert.equal(weather.precipitation_probability_percent,34);
  assert.equal(weather.precipitation_probability_source.kind,'hourly_forecast');
  assert.equal(weather.precipitation_probability_source.valid_from,new Date(hour.valid_from).toISOString());
});
test('rain supplement failure cannot discard valid current temperature and wind',async()=>{
  let calls=0;
  const weather=await readWeatherEvidence({query:async()=>{if(++calls>1)throw Error('hour query failed');return {rows:[observation]};}},coords,now,now);
  assert.equal(weather.temperature_c,27.3);assert.equal(weather.gust_kmh,17.7012);assert.equal(weather.rain_mm_per_hour,null);
  assert.ok(weather.reasons.includes('hourly_rain_query_failed'));
});
test('eligible closest source is selected before newest nearby source for current and forecast',async()=>{
  const queries=[];const pool={query:async sql=>{queries.push(sql);return {rows:[]};}};
  await readWeatherEvidence(pool,coords,now,now);
  await readWeatherEvidence(pool,coords,new Date(+now+3600000),now);
  for(const sql of queries){
    const order=sql.slice(sql.indexOf('ORDER BY'));
    assert.ok(order.indexOf('distance_meters')>=0,'order must prioritize matched distance');
    assert.ok(order.indexOf('distance_meters')<order.indexOf('DESC',order.indexOf('distance_meters')));
  }
});
