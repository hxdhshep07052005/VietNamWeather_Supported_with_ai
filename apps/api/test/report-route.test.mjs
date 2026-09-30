import { test } from "node:test";
import assert from "node:assert/strict";
import { RouteRiskEngine } from "../dist/route/route-risk-engine.js";
import { RouteSampler } from "../dist/route/route-sampler.js";
import { RouteService, rankAlternatives } from "../dist/route/route-service.js";
const pool={query:async()=>({rows:[]})};
const engine=new RouteRiskEngine({dbPool:pool});
const point=s=>({severity:s,score:s?s/3:null,level:["unknown","low","caution","high"][s],reasons:[],evidence:[]});
function aggregate(distances,severities) {
  return engine.calculateRouteRisk(engine.calculateSegmentRisks(new Map(severities.map((s,i)=>[i,point(s)])),distances.map(d=>({distance_from_start_meters:d}))));
}
test("report trapezoid example has score 13/24, display 54 and High maximum",()=>{
  const risk=aggregate([0,10000,30000,40000],[1,1,2,3]);
  assert.ok(Math.abs(risk.score-13/24)<1e-12); assert.equal(Math.round(risk.score*100),54); assert.equal(risk.level,"high");
});
test("all low/high and incomplete or invalid distances",()=>{
  assert.equal(aggregate([0,10000],[1,1]).score,1/3);
  assert.equal(aggregate([0,10000],[3,3]).score,1);
  for(const [d,s] of [[[0,10000],[1,0]],[[0,0],[1,1]],[[2,1],[1,1]],[[0,NaN],[1,1]],[[0],[1]],[[],[]]]) {
    assert.equal(aggregate(d,s).score,null); assert.equal(aggregate(d,s).level,"unknown");
  }
});
test("sparse geometry includes endpoints and meets both sampling bounds",async()=>{
  const sampler=new RouteSampler({dbPool:pool});
  const geometry={coordinates:[{latitude:21,longitude:105},{latitude:22,longitude:106}],distance_meters:200000,duration_seconds:50000};
  const departure=new Date("2026-10-01T00:00:00Z");
  const samples=await sampler.sampleRoute(geometry,departure);
  assert.deepEqual(samples[0].coordinates,geometry.coordinates[0]); assert.deepEqual(samples.at(-1).coordinates,geometry.coordinates[1]);
  assert.equal(samples.at(-1).eta,new Date(+departure+50000000).toISOString());
  for(let i=1;i<samples.length;i++) {
    assert.ok(samples[i].distance_from_start_meters-samples[i-1].distance_from_start_meters<=5000+1e-8);
    assert.ok(samples[i].time_from_departure_seconds-samples[i-1].time_from_departure_seconds<=900+1e-8);
  }
  assert.deepEqual(await sampler.sampleRoute({...geometry,distance_meters:0},departure),[]);
});
test("balanced maxima, label invariance and Unknown exclusion",()=>{
  const a={alternative_type:"fastest",geometry:{distance_meters:100,duration_seconds:10},route_risk:{score:1/3,level:"low"}};
  const b={...a,geometry:{distance_meters:200,duration_seconds:20}};
  const ranked=rankAlternatives([a,b]);
  assert.equal(ranked[0].balanced_score,.5/3+.3*.5+.2*.5);
  assert.equal(rankAlternatives([{...a,alternative_type:"weather_safer"},b])[0].balanced_score,ranked[0].balanced_score);
  assert.equal(rankAlternatives([{...a,route_risk:{score:null,level:"unknown"}}])[0].balanced_score,null);
});
test("all-Low routes can score 64 and 66 using actual time and distance rather than route labels",()=>{
  const routes=[
    {alternative_type:"fastest",geometry:{distance_meters:289544,duration_seconds:11742},route_risk:{score:1/3,level:"low"}},
    {alternative_type:"shortest",geometry:{distance_meters:279708,duration_seconds:12746},route_risk:{score:1/3,level:"low"}},
  ];
  const ranked=rankAlternatives(routes);
  assert.deepEqual(ranked.map(route=>Math.round(route.balanced_score*100)),[64,66]);
  const changedTime=rankAlternatives([{...routes[0],geometry:{...routes[0].geometry,duration_seconds:6000}},routes[1]]);
  assert.ok(changedTime[0].balanced_score<ranked[0].balanced_score);
  const changedDistance=rankAlternatives([routes[0],{...routes[1],geometry:{...routes[1].geometry,distance_meters:150000}}]);
  assert.ok(changedDistance[1].balanced_score<ranked[1].balanced_score);
  const changedWeather=rankAlternatives([{...routes[0],route_risk:{score:2/3,level:"caution"}},routes[1]]);
  assert.ok(changedWeather[0].balanced_score>ranked[0].balanced_score);
  assert.equal(rankAlternatives([{...routes[0],alternative_type:"weather_safer"},routes[1]])[0].balanced_score,ranked[0].balanced_score);
});
test("route orchestrator preserves provider geometry and never recommends missing evidence",async()=>{
  const geometry={coordinates:[{latitude:21,longitude:105},{latitude:21.1,longitude:105.1}],distance_meters:20000,duration_seconds:2000};
  const service=new RouteService({dbPool:pool,geocodingService:{resolveLocation:async original=>({original,coordinates:geometry.coordinates[0]})},routingService:{getAlternatives:async()=>[geometry]}});
  const result=await service.calculateRoutes({origin:{type:"text",value:"A"},destination:{type:"text",value:"B"},vehicle_type:"motorcycle"});
  assert.equal(result.recommended_alternative,null); assert.equal(result.alternatives.length,1);
  assert.deepEqual(result.alternatives[0].geometry,geometry);
  assert.equal(result.alternatives[0].route_risk.score,null);
  assert.ok(result.alternatives[0].sample_points.every(p=>p.assessment.vehicle==="motorcycle" && p.assessment.level==="unknown" && !p.has_weather_data));
});

test('Weather-Safer follows report balanced score rather than minimum risk alone', async () => {
  const routes = [
    {coordinates:[{latitude:21,longitude:105},{latitude:21.1,longitude:105.1}],distance_meters:10000,duration_seconds:600},
    {coordinates:[{latitude:21,longitude:105},{latitude:21.2,longitude:105.2}],distance_meters:100000,duration_seconds:6000},
  ];
  let index=0;
  const service=new RouteService({dbPool:pool,
    geocodingService:{resolveLocation:async original=>({original,coordinates:routes[0].coordinates[0]})},
    routingService:{getAlternatives:async()=>routes},
    routeSampler:{sampleRoute:async()=>[]},
    routeRiskEngine:{calculatePointRisks:async()=>new Map(),calculateSegmentRisks:()=>[],calculateRouteRisk:()=>({score:[2/3,1/3][index++],level:'caution',confidence:100})},
  });
  const result=await service.calculateRoutes({origin:{type:'text',value:'A'},destination:{type:'text',value:'B'},vehicle_type:'car'});
  assert.deepEqual(result.alternatives.find(a=>a.alternative_type==='weather_safer').geometry,routes[0]);
  assert.equal(result.recommended_alternative,'weather_safer');
});

test('weather samples use bounded concurrency and retain their original ETA association', async () => {
  let active=0,maxActive=0;
  const db={query:async(_sql,args)=>{active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,8));active--;return {rows:[]};}};
  const samples=Array.from({length:12},(_,i)=>({coordinates:{latitude:21,longitude:105+i/100},eta:new Date(Date.now()+i*60000).toISOString(),distance_from_start_meters:i*1000}));
  const points=await new RouteRiskEngine({dbPool:db}).calculatePointRisks(samples,'car');
  assert.ok(maxActive>1,'lookups must not serialize all samples');
  assert.ok(maxActive<=4,'do not exhaust database pool');
  assert.equal(points.size,12);
  for(let i=0;i<samples.length;i++) assert.equal(samples[i].coordinates.longitude,105+i/100);
});

test('route reports durable refresh pending without claiming missing weather is scored', async () => {
  const geometry={coordinates:[{latitude:21,longitude:105},{latitude:21.1,longitude:105.1}],distance_meters:20000,duration_seconds:2000};
  let requested=0;
  const service=new RouteService({dbPool:pool,
    geocodingService:{resolveLocation:async original=>({original,coordinates:geometry.coordinates[0]})},
    routingService:{getAlternatives:async()=>[geometry]},
    weatherRefresh:{refresh:async samples=>{requested=samples.length;return {requested:2,inserted:2,deferred:0,runs:[{runId:'r1',status:'pending',inserted:true}]};}}
  });
  const response=await service.calculateRoutes({origin:{type:'text',value:'A'},destination:{type:'text',value:'B'},vehicle_type:'car'});
  assert.ok(requested>0);
  assert.deepEqual(response.weather_refresh,{status:'pending',requested_points:2,retry_after_seconds:5});
  assert.equal(response.alternatives[0].route_risk.score,null);
  assert.equal(response.recommended_alternative,null);
});

test('refresh failure preserves route and reports unavailable', async () => {
  const geometry={coordinates:[{latitude:21,longitude:105},{latitude:21.1,longitude:105.1}],distance_meters:20000,duration_seconds:2000};
  const service=new RouteService({dbPool:pool,
    geocodingService:{resolveLocation:async original=>({original,coordinates:geometry.coordinates[0]})},
    routingService:{getAlternatives:async()=>[geometry]},weatherRefresh:{refresh:async()=>{throw new Error('queue down');}}});
  const response=await service.calculateRoutes({origin:{type:'text',value:'A'},destination:{type:'text',value:'B'},vehicle_type:'car'});
  assert.equal(response.weather_refresh.status,'unavailable');
  assert.deepEqual(response.alternatives[0].geometry,geometry);
});
