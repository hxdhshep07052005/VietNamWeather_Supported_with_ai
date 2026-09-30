import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {RiskService} from '../dist/risk/risk-service.js';

test('a 63-province map refresh is not blocked by the default 60-request limit', async () => {
  const app = Fastify();
  await app.register(rateLimit, {max:60,timeWindow:60000});
  new RiskService({dbPool:{query:async()=>({rows:[]})}}).registerRiskRoutes(app);
  try {
    for(let i=0;i<63;i++) {
      const result=await app.inject('/api/v1/risk/report-point?latitude=21&longitude=105');
      assert.equal(result.statusCode,200,`province ${i+1}`);
    }
  } finally {await app.close();}
});
