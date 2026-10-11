import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReadingsCSV} from '../frontend/src/data/importReadings.js';
import {usageSeries,billPrediction,monthlyReportRows} from '../frontend/src/data/usageAnalytics.js';
const item={id:'electricity',label:'Electricity',kind:'metered',unit:'kWh',monthly:32,billBreakdown:[['Energy',6],['Fixed',26]],readings:[{date:'2026-10-10',quantity:10,unitRateUsd:.2,source:'observed'},{date:'2026-10-08',quantity:20,unitRateUsd:.2,source:'observed'}],bills:[{startDate:'2026-09-11',endDate:'2026-10-10',quantity:30,totalCostUsd:null,source:'observed',complete:false}]};
test('a missing daily reading remains missing rather than zero',()=>{
 const s=usageSeries(item,'week',2026,'usage');assert.equal(s.values.at(-2),null);assert.equal(s.values.at(-1),10);assert.equal(s.values.at(-3),20);
});
test('unknown rates remain unknown in cost history and projections',()=>{
 const missing={...item,readings:item.readings.map(r=>({...r,unitRateUsd:null}))};assert.equal(usageSeries(missing,'day',2026,'cost').values[0],null);assert.equal(billPrediction(missing).projected,null);
});
test('CSV import labels readings as user-supplied and preserves unknown rates',()=>{
 const r=parseReadingsCSV('date,quantity,unitRateUsd\n2026-10-10,21.5,\n2026-10-09,18,.18','electricity');assert.equal(r[0].source,'observed');assert.equal(r[0].unitRateUsd,null);assert.equal(r[1].quantity,18);
});
test('duplicate dates, invalid dates, and cumulative negative quantities are rejected before import',()=>{
 for(const rows of ['2026-02-30,1,.18','2026-10-10,-1,.18','2026-10-10,1,.18\n2026-10-10,2,.18'])assert.throws(()=>parseReadingsCSV('date,quantity,unitRateUsd\n'+rows,'electricity'));
});
test('bill export preserves each window source and completeness',()=>{
 const row=monthlyReportRows([item])[1];assert.equal(row[7],'observed');assert.equal(row[8],false);assert.equal(row[5],'');
});
