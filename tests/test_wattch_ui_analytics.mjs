import test from 'node:test';
import assert from 'node:assert/strict';
import {usageSeries,compareYears,billPrediction,anomalyInsight,csvText,monthlyReportRows} from '../frontend/src/data/usageAnalytics.js';
import {UTILITIES} from '../frontend/src/data/utilityData.js';
test('all five utilities have finite period data for every year',()=>{
 for (const item of UTILITIES)for(const year of [2024,2025,2026])for(const period of ['halfHour','day','week','month','year']){
  const {labels,values}=usageSeries(item,period,year);
  assert.equal(labels.length,values.length);assert.ok(values.length>0);
  assert.ok(values.every(v=>Number.isFinite(v)&&v>=0));
 }
});
test('bill forecast never negative, returns comparisons',()=>{for(const item of UTILITIES){const p=billPrediction(item);assert.ok(p.projected>=0);assert.ok(Number.isFinite(p.changePct))}});
test('year comparison returns three sample years',()=>{assert.equal(compareYears(UTILITIES[0]).length,3)});
test('water anomaly scenario triggers warning',()=>{assert.equal(anomalyInsight(UTILITIES[1],{waterLeak:true}).flag,true)});
test('gas while-away scenario triggers warning',()=>{assert.equal(anomalyInsight(UTILITIES[2],{gasAway:true}).flag,true)});
test('report explicitly labels modeled data',()=>{const csv=csvText(monthlyReportRows(UTILITIES));assert.match(csv,/SIMULATED_SAMPLE/);assert.equal(csv.split('\r\n').length,32)});
