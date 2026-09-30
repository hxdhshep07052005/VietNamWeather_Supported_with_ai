import { test } from "node:test";
import assert from "node:assert/strict";
import { assessReportHazard } from "../dist/risk/report-hazard.js";
import { readWeatherEvidence } from "../dist/risk/weather-evidence.js";

const good = { rain_mm_per_hour: 0, gust_kmh: 0, temperature_c: 25, visibility_m: 10000,
  storm: "none", official_alert_level: 0, freshness: "fresh", coverage: "covered", source: "test-fixture",
  source_time: "2026-09-30T00:00:00Z", valid_from: null, valid_to: null, reasons: [] };
const severity = (vehicle, field, value) => assessReportHazard({ ...good, [field]: value }, vehicle).severity;

for (const [vehicle, rain, gust, visibility, temp] of [
  ["motorcycle", [10,25], [25,40], [2000,1000], [10,13,36,38]],
  ["car", [15,35], [45,60], [1000,500], [5,8,38,40]],
]) {
  test(`${vehicle}: every Table 3.1 numeric boundary and adjacent values`, () => {
    for (const [field, [caution, high]] of [["rain_mm_per_hour",rain],["gust_kmh",gust]]) {
      for (const [value, expected] of [[caution-.001,1],[caution,2],[caution+.001,2],[high-.001,2],[high,3],[high+.001,3]])
        assert.equal(severity(vehicle,field,value),expected,`${field}=${value}`);
    }
    const [caution,high] = visibility;
    for (const [value,expected] of [[high-.001,3],[high,2],[high+.001,2],[caution-.001,2],[caution,1],[caution+.001,1]])
      assert.equal(severity(vehicle,"visibility_m",value),expected,`visibility=${value}`);
    const [coldHigh,coldCaution,hotCaution,hotHigh] = temp;
    for (const [value,expected] of [[coldHigh-.001,3],[coldHigh,2],[coldHigh+.001,2],
      [coldCaution-.001,2],[coldCaution,2],[coldCaution+.001,1],[hotCaution-.001,1],
      [hotCaution,2],[hotCaution+.001,2],[hotHigh-.001,2],[hotHigh,2],[hotHigh+.001,3]])
      assert.equal(severity(vehicle,"temperature_c",value),expected,`temperature=${value}`);
  });
}
test("storm and official alerts require explicit evidence; max is not a sum", () => {
  for (const [storm,expected] of [["none",1],["distant",2],["cumulonimbus",2],["direct",3],["hail",3],["unclassified",0],[null,0]])
    assert.equal(severity("car","storm",storm),expected);
  for (const [alert,expected] of [[0,1],[1,2],[2,2],[3,3],[4,3],[null,0]]) assert.equal(severity("car","official_alert_level",alert),expected);
  const result = assessReportHazard({ ...good, gust_kmh: 50, visibility_m: 499 },"car");
  assert.deepEqual(result.evidence.map(e=>e.severity),[1,2,1,3,1,1]);
  assert.equal(result.severity,3);
  assert.equal(result.score,1);
});
test("Unknown has null score; preserve known high evidence; no default vehicle or rules", () => {
  for (const patch of [{ official_alert_level: null },{ freshness:"stale" },{ coverage:"outside" },{ rain_mm_per_hour: NaN }]) {
    const result = assessReportHazard({ ...good, gust_kmh: 100, ...patch },"car");
    assert.equal(result.level,"unknown"); assert.equal(result.score,null); assert.equal(result.display_score,null);
    assert.equal(result.evidence.find(e=>e.dimension==="wind").severity,3);
  }
  assert.equal(assessReportHazard(good).score,1/3);
  assert.equal(assessReportHazard(good,"car",null).score,null);
  assert.equal(assessReportHazard(good,"car").score,1/3);
  assert.equal(assessReportHazard({...good,freshness:"aging"},"car").score,1/3);
});
test("DB failure/no coverage never manufactures weather",async()=>{
  const coords={latitude:21,longitude:105}; const now=new Date("2026-09-30T00:00:00Z");
  for(const pool of [{query:async()=>{throw Error("fixture failure");}},{query:async()=>({rows:[]})}]) {
    const weather=await readWeatherEvidence(pool,coords,now,now);
    assert.equal(weather.temperature_c,null); assert.equal(weather.freshness,"unavailable");
    assert.equal(assessReportHazard(weather,"car").score,null);
  }
});
test("forecast uses ETA interval, 15km geographic bound, gust conversion and hourly precipitation rate",async()=>{
  const calls=[]; const now=new Date("2026-09-30T00:00:00Z");
  const pool={query:async(sql,args)=>{calls.push({sql,args}); return {rows:[{temperature_c:25,gust_kmh:36,visibility_m:null,rain_mm_per_hour:12,
    source:"fixture",source_time:now,expires_at:"2026-10-01T00:00:00Z",status:"valid",valid_from:args[2],valid_to:"2026-09-30T03:00:00Z",condition_code:"thunderstorm"}]};}};
  const a=await readWeatherEvidence(pool,{latitude:21,longitude:105},new Date("2026-09-30T01:00:00Z"),now);
  await readWeatherEvidence(pool,{latitude:21,longitude:105},new Date("2026-09-30T02:00:00Z"),now);
  assert.notEqual(calls[0].args[2],calls[1].args[2]);
  assert.match(calls[0].sql,/valid_from <= \$3 AND valid_to > \$3/);
  assert.match(calls[0].sql,/ST_DWithin[\s\S]*15000/);
  assert.match(calls[0].sql,/wind_gust_mps \* 3\.6/);
  assert.match(calls[0].sql,/EXTRACT\(EPOCH FROM \(valid_to-valid_from\)\)\/3600/);
  assert.equal(a.gust_kmh,36); assert.equal(a.storm,"unclassified"); assert.equal(a.official_alert_level,null);
});
test("record expiry and report freshness boundaries",async()=>{
  const now=new Date("2026-09-30T12:00:00Z");
  for(const [age,expected] of [[60,"fresh"],[60.1,"aging"],[180,"aging"],[180.1,"stale"]]) {
    const pool={query:async()=>({rows:[{...good,source_time:new Date(now-age*60000),expires_at:"2026-10-01T00:00:00Z",status:"valid",valid_from:now,valid_to:null}]})};
    assert.equal((await readWeatherEvidence(pool,{latitude:21,longitude:105},now,now)).freshness,expected);
  }
});

test("general weather risk uses known evidence without claiming complete vehicle safety", () => {
 const partial={...good, official_alert_level:null, storm:null};
 assert.equal(assessReportHazard(partial).level,"low");
 assert.equal(assessReportHazard({...partial,gust_kmh:30}).level,"caution");
 assert.equal(assessReportHazard({...partial,gust_kmh:45}).level,"high");
 assert.equal(assessReportHazard(partial,"car").level,"unknown");
 assert.equal(assessReportHazard({...partial,freshness:"stale"}).level,"unknown");
});

test("general assessment requires core measurements and never labels detected thunder low", () => {
  assert.equal(assessReportHazard({...good, gust_kmh:null, visibility_m:null}).level,"unknown");
  assert.equal(assessReportHazard({...good,storm:"unclassified",official_alert_level:null}).level,"caution");
});
