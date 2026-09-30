import test from 'node:test';
import assert from 'node:assert/strict';
import { RestStopService } from '../dist/route/rest-stop-service.js';

const geometry = { coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 22, longitude: 105 }], distance_meters: 111_195, duration_seconds: 5000 };
const stop = (id, name, lat, lon, highway = 'rest_area') => ({ type: 'node', id, lat, lon, tags: { name, highway } });

test('returns only named rest areas near the route sorted by travel progress', async () => {
  const service = new RestStopService({ fetch: async (url, init) => {
    assert.equal(init.method, 'GET');
    assert.match(url, /data=/);
    return Response.json({ elements: [
      { type: 'node', id: 1, lat: 21.8, lon: 105, tags: { name: '', 'name:vi': 'Second rest area', highway: 'rest_area' } },
      stop(2, 'First rest area', 21.2, 105.005, 'services'),
      stop(3, 'Remote rest area', 21.4, 105.1), stop(4, '', 21.5, 105), stop(5, 'Fuel', 21.5, 105, 'fuel'),
      { type: 'node', id: 6, lat: 21.6, lon: 105, tags: { operator: 'Road operator', highway: 'services' } }
    ] });
  } });
  const result = await service.findForRoute(geometry);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.items.map(item => item.name), ['First rest area', 'Second rest area']);
  assert.equal(result.items[0].source_url, 'https://www.openstreetmap.org/node/2');
  assert.ok(Math.abs(result.items[0].distance_from_start_meters - 22239) < 2);
});

test('distinguishes empty success from provider failure and partial timeout payloads', async () => {
  for (const [body, status] of [[{ elements: [] }, 'available'], [{ remark: 'timeout', elements: [] }, 'unavailable'], [{ unexpected: [] }, 'unavailable']]) {
    const service = new RestStopService({ fetch: async () => Response.json(body) });
    assert.deepEqual(await service.findForRoute(geometry), { status, source: 'OpenStreetMap', route_type: 'fastest', items: [] });
  }
});

test('coalesces and caches requests without retaining unavailable results for full success TTL', async () => {
  let calls = 0, now = 0;
  const service = new RestStopService({ now: () => now, fetch: async () => { calls++; return new Response('', { status: 503 }); } });
  await Promise.all([service.findForRoute(geometry), service.findForRoute(geometry)]);
  assert.equal(calls, 1);
  now = 60_001;
  await service.findForRoute(geometry);
  assert.equal(calls, 2);
});

test('deadline abort produces unavailable rather than blocking route calculation', async () => {
  const service = new RestStopService({ timeoutMs: 10, fetch: async (_, init) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => resolve(Response.json({ elements: [] })), 1000);
    init.signal.addEventListener('abort', () =>
    { clearTimeout(keepAlive); reject(init.signal.reason); }, { once: true });
  }) });
  assert.equal((await service.findForRoute(geometry)).status, 'unavailable');
});
