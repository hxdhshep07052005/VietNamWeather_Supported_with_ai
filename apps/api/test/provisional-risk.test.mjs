import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessReportHazard } from '../dist/risk/report-hazard.js';
import { provisionalPointAssessment, provisionalRouteScore } from '../dist/route/provisional-risk.js';
import { RouteService } from '../dist/route/route-service.js';
const weather = { rain_mm_per_hour: null, gust_kmh: 30, temperature_c: 25, visibility_m: 5000,
  storm: null, official_alert_level: null, freshness: 'fresh', coverage: 'covered', source: 'test',
  source_time: null, valid_from: null, valid_to: null, reasons: [] };
const assess = (patch={},vehicle='car') => provisionalPointAssessment(assessReportHazard({...weather,...patch},vehicle));
test('provisional ETA uses real vehicle thresholds without changing strict assessment',()=>{
  const strict=assessReportHazard(weather,'car');
  assert.equal(strict.score,null);
  assert.equal(assess().score,1/3);
  assert.equal(assess({},'motorcycle').score,2/3);
  assert.equal(assess({storm:'unclassified'}).score,2/3);
  assert.equal(assess({storm:'direct'}).score,1);
  assert.ok(assess().reasons.includes('alert_unavailable'));
  assert.equal(strict.score,null);
});
test('uncovered stale or missing core evidence stays unscored',()=>{
  for(const patch of [{coverage:'outside'},{freshness:'stale'},{freshness:'unavailable'}, {gust_kmh:null},{temperature_c:null},{visibility_m:null}]) {
    assert.equal(assess(patch).score,null);
  }
});
const samples = (distances,scores) => distances.map((distance_from_start_meters,i)=>({distance_from_start_meters,provisional_assessment:{score:scores[i]}}));
test('distance weighting penalizes gaps and reports observed coverage separately',()=>{
  const risk=provisionalRouteScore(samples([0,1000,4000],[1/3,1/3,null]));
  assert.equal(risk.coverage_percent,25);
  assert.equal(risk.observed_score,1/3);
  assert.ok(Math.abs(risk.score-5/6)<1e-12);
  assert.ok(risk.score>provisionalRouteScore(samples([0,1000,4000],[1/3,1/3,1/3])).score);
  for(const [d,s] of [[[0,1000],[null,null]],[[0,1000],[1/3,null]],[[0,0],[1/3,1/3]],[[0,NaN],[1/3,1/3]],[[],[]]]) assert.equal(provisionalRouteScore(samples(d,s)),undefined);
});
test('partial real weather produces provisional Weather-Safer while strict risk stays unknown',async()=>{
  const routes=[10000,20000].map(distance_meters=>({coordinates:[{latitude:21,longitude:105},{latitude:22,longitude:106}],distance_meters,duration_seconds:distance_meters/10}));
  const service=new RouteService({dbPool:{query:async()=>({rows:[]})},
    geocodingService:{resolveLocation:async original=>({original,coordinates:routes[0].coordinates[0]})},
    routingService:{getAlternatives:async()=>routes},
    routeSampler:{sampleRoute:async r=>samples([0,r.distance_meters],[1/3,1/3])},
    routeRiskEngine:{calculatePointRisks:async()=>new Map(),calculateSegmentRisks:()=>[],calculateRouteRisk:()=>({score:null,level:'unknown',confidence:0})}});
  const result=await service.calculateRoutes({origin:{type:'text',value:'A'},destination:{type:'text',value:'B'},vehicle_type:'car'});
  const safer=result.alternatives.find(a=>a.alternative_type==='weather_safer');
  assert.equal(result.recommended_alternative,'weather_safer');
  assert.equal(safer.route_risk.score,null);
  assert.equal(safer.route_risk.level,'unknown');
  assert.ok(Math.abs(safer.route_risk.provisional.score - 1/3) < 1e-12);
  assert.equal(safer.route_risk.provisional.coverage_percent,100);
  assert.equal(result.is_incomplete,true);
  assert.deepEqual(safer.geometry,routes[0]);
});
