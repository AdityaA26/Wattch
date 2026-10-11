import test from 'node:test';
import assert from 'node:assert/strict';
import {homeId, backendProfile, demoReadings} from '../frontend/src/features/insights/insightsApi.js';
const profile = {occupants:3, squareFeet:2100, latitude:34.0007, longitude:-81.0348,
  timezone:'America/New_York', city:'Columbia', state:'South Carolina', batteryCapacityKwh:13.5,
  startingSocPct:55, backupReservePct:30, maxBatteryPowerKw:5, solarCapacityKw:5, monthlyElectricKwh:720};
test('distinct homes have separate valid backend IDs, including long browser IDs', () => {
  const ids = ['home-default', 'home-new', 'x'.repeat(100)+'a', 'x'.repeat(100)+'b'].map(homeId);
  assert.equal(new Set(ids).size, 4);
  assert.ok(ids.every(id => /^[A-Za-z0-9_-]{1,60}$/.test(id)));
  assert.ok(!ids.includes('demo-home'));
});
test('browser profile fields map to backend quantities without account credentials', () => {
  const mapped = backendProfile({...profile, password:'must-not-leave-browser'}, 'home-default');
  assert.equal(mapped.floorAreaSqft,2100); assert.equal(mapped.reservePct,30);
  assert.equal(mapped.startingSocPct,55); assert.equal(mapped.peerOptIn,false);
  assert.ok(!('password' in mapped));
});
test('sample imports have 42 unique days per utility with explicit simulated provenance', () => {
  const rows = demoReadings(profile, new Date('2026-10-11T00:00:00Z'));
  assert.equal(rows.length,126);
  assert.equal(new Set(rows.map(r => `${r.date}/${r.utility}`)).size,126);
  assert.ok(rows.every(r => r.source==='simulated' && Number.isFinite(r.quantity) && r.quantity>=0));
  for (const utility of ['electricity','water','gas']) assert.equal(rows.filter(r=>r.utility===utility).length,42);
  const water = rows.filter(r=>r.utility==='water');
  const mean = list=>list.reduce((n,r)=>n+r.quantity,0)/list.length;
  assert.ok(Math.abs(mean(water.slice(0,7))/mean(water.slice(7,28))-1.5)<.00001);
  assert.equal(rows[0].date,'2026-10-11'); assert.equal(rows.at(-1).date,'2026-08-31');
});
