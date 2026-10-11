/** Deterministic, labeled sample series. Nothing here is meter, neighbor, or provider data. */
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
export const PERIODS = ['halfHour','day','week','month','year'];
export const YEARS = [2026,2025,2024];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const sum = list => list.reduce((a,b)=>a+b,0);
export function historicalMonth(item, year, month, metric='usage') {
  const idx = month - 4; // May 2026 is index 0 in existing seeded six-month ledger
  const raw = metric==='cost' ? item.trend : item.activity;
  if(year===2026 && idx>=0 && idx<6) return Number(raw[idx].toFixed(2));
  const baseline = metric==='cost' ? item.monthly : item.usage;
  const season = item.id==='gas' ? 1+0.46*Math.cos((month-1)/12*2*Math.PI) :
    item.id==='electricity' ? 1+0.13*Math.sin((month+1)/12*2*Math.PI) :
    item.id==='water' ? 1+0.07*Math.sin((month-3)/12*2*Math.PI) : 1;
  const annual = 1 - (2026-year)*(item.kind==='fixed' ? .02 : .035);
  const variance = (rnd((year-2020)*43 + month*17 + item.id.length*13)-.5)*.06;
  return Number(Math.max(0,baseline*season*annual*(1+variance)).toFixed(2));
}
export function usageSeries(item, period='month', year=2026, metric='usage') {
  if(!PERIODS.includes(period)) throw Error('Unsupported usage period');
  if(!YEARS.includes(Number(year))) throw Error('Unsupported sample year');
  const y=Number(year);
  // The reference date is deliberately fixed to the seeded Oct 2026 sample, not today.
  const anchor = historicalMonth(item,y,9,metric);
  if(period==='year') return {labels:MONTH_NAMES, values:MONTH_NAMES.map((_,m)=>historicalMonth(item,y,m,metric))};
  const count = period==='halfHour'?48:period==='month' ? 30 : period==='week' ? 7 : 12;
  const labels = Array.from({length:count},(_,i)=>period==='halfHour'?`${String(Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`:period==='month'?String(i+1):period==='week'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]:`${String(i*2).padStart(2,'0')}:00`);
  const windowFraction = period==='month'?1:period==='week'?7/30:1/30;
  const base = anchor*windowFraction;
  const weights = labels.map((_,i)=>{
    const wave=period==='day'?1+0.4*Math.sin((i-3)/12*2*Math.PI):1+0.18*Math.sin((i+2)/count*2*Math.PI);
    return Math.max(.2,wave+(rnd(i*29 + y*7+item.id.length)-.5)*.32);
  });
  const total=sum(weights);
  return {labels,values:weights.map(w=>Number((base*w/total).toFixed(metric==='cost'?2:1)))};
}
export function compareYears(item,metric='usage') {
  return YEARS.map(year=>({year,total:Number(sum(usageSeries(item,'year',year,metric).values).toFixed(2))}));
}
export function billPrediction(item) {
  const current = Math.max(0,Number(item.monthly)||0);
  const historical = (item.trend||[]).slice(-3).map(Number);
  const momentum = historical.length ? (sum(historical)/historical.length-current)*.55 : 0;
  const projected = item.kind==='fixed' ? current : Math.max(0,current+momentum);
  const previous = item.trend?.at(-2) ?? current;
  return {projected:Number(projected.toFixed(2)),current,previous:Number(previous),changePct:previous>0?Number(((current/previous-1)*100).toFixed(1)):0,
    difference:Number((current-previous).toFixed(2)),assumption:item.kind==='fixed'?'Subscription charge unchanged':'Current sample charges adjusted toward last 3 months'};
}
export function anomalyInsight(item, {waterLeak=false,gasAway=false}={}) {
  if(item.id==='water'){
    const previous = sum(item.activity.slice(-4,-1))/3;
    const latest = item.usage*(waterLeak?1.6:1);
    const percent = previous>0?(latest/previous-1)*100:0;
    return {flag:percent>20,percent:Number(percent.toFixed(1)),headline:percent>20?'Unusually high water use in this scenario':'Water usage near its sample baseline',
      message:percent>20?'A sustained increase may indicate an open fixture or leak. Check taps, toilets and the meter; this is not a confirmed leak.':'A large spike may indicate an open fixture; connect a real meter to validate.'};
  }
  if(item.id==='gas'){
    const flag=Boolean(gasAway);
    return {flag,percent:0,headline:flag?'Gas consumption simulated while household is away':'Gas usage follows a seasonal sample pattern',message:flag?'Confirm appliances and heating settings. Wattch cannot detect gas leaks or read your meter.':'Heating use typically rises during cold periods; compare similar months year-over-year.'};
  }
  return {flag:false,percent:0,headline:'Usage comparison',message:'Connect utility readings for verified anomaly detection.'};
}
export function monthlyReportRows(items) {
  const header=['sample_year','sample_month','utility','usage','unit','estimated_cost_usd','next_month_projection_usd','data_source'];
  const rows=[header];
  for(const item of items)for(let m=4;m<10;m++)rows.push(['2026',MONTH_NAMES[m],item.label,historicalMonth(item,2026,m,'usage'),item.unit,
    historicalMonth(item,2026,m,'cost'),billPrediction(item).projected,'SIMULATED_SAMPLE']);
  return rows;
}
export function csvText(rows) {return rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';}
export function downloadReport(items) {
  const blob=new Blob([csvText(monthlyReportRows(items))],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='wattch-simulated-utility-report.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
