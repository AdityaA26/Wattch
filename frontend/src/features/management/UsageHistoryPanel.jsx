import {useState} from 'react';
import {Panel,SectionTitle,Segments,Note} from '../utilities/components/UtilityUI.jsx';
import {money,number} from '../../data/utilityData.js';
import {usageSeries,compareYears,billPrediction,anomalyInsight,downloadReport,YEARS} from '../../data/usageAnalytics.js';
import {useVacationMode} from '../../state/vacationMode.js';
import './management.css';
const PERIODS=[{value:'day',label:'Day'},{value:'week',label:'Week'},{value:'month',label:'Month'},{value:'year',label:'Year'}];
function HistoryPlot({series,unit,color}){
 const {labels,values}=series;
 const [selected,setSelected]=useState(values.length-1);
 const max=Math.max(1,...values)*1.1;
 const x=i=>35+i*610/Math.max(1,values.length-1),y=n=>190-n/max*157;
 const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
 const skip=Math.ceil(labels.length/6);
 return <div className="mg-history-plot"><div className="mg-history-selected"><span>{labels[selected]} · selected sample</span><strong>{unit==='USD'?money(values[selected]):`${number(values[selected])} ${unit}`}</strong></div><svg viewBox="0 0 690 230" role="group" aria-label={`Modeled ${unit} history; select points to inspect readings`}>
 {[0,1,2,3].map(i=><line key={i} x1="35" y1={33+i*52} x2="645" y2={33+i*52} stroke="#e8eee5" strokeDasharray="3 6"/>)}
 <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
 {values.map((value,i)=><g key={i}>{(i%skip===0||i===values.length-1)&&<text x={x(i)} y="219" fontSize="11" textAnchor="middle" fill="#8ba08f">{labels[i]}</text>}<circle cx={x(i)} cy={y(value)} r="8" opacity="0" tabIndex={0} role="button" aria-label={`${labels[i]}: ${unit==='USD'?money(value):`${number(value)} ${unit}`}`} onClick={()=>setSelected(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(i)}}}/><circle cx={x(i)} cy={y(value)} r={i===selected?5:2.5} fill={i===selected?'white':color} stroke={color} strokeWidth="2" pointerEvents="none"/></g>)}
 </svg></div>;
}
export default function UsageHistoryPanel({item}){
 const [period,setPeriod]=useState('month'),[year,setYear]=useState(2026),[metric,setMetric]=useState(item.kind==='fixed'?'cost':'usage'),[leak,setLeak]=useState(false);
 const vacation=useVacationMode();
 const s=usageSeries(item,period,year,metric);const oldYear=compareYears(item,metric);const pred=billPrediction(item);
 const anomaly=anomalyInsight(item,{waterLeak:leak,gasAway:vacation.status==='active'});
 const isMeter=item.kind==='metered';
 return <div className="mg-history-block">
 <Panel><div className="mg-head-inline"><SectionTitle title="Usage & cost history" detail="Sample readings across time windows and previous years"/><span className="mg-tag">Simulated data</span></div>
 <div className="mg-toolbar"><Segments items={item.id==='gas'?[{value:'halfHour',label:'30 min'},...PERIODS]:PERIODS} ariaLabel="History period" value={period} onChange={setPeriod}/><div className="mg-compact-controls"><label>Sample year<select aria-label="Usage history year" value={year} onChange={e=>setYear(Number(e.target.value))}>{YEARS.map(y=><option key={y} value={y}>{y}</option>)}</select></label>{isMeter?<label>Display<select aria-label="Usage history metric" value={metric} onChange={e=>setMetric(e.target.value)}><option value="usage">Usage</option><option value="cost">Cost</option></select></label>:<span className="mg-tag">Cost history</span>}</div></div>
 <HistoryPlot key={`${item.id}-${period}-${year}-${metric}`} series={s} unit={metric==='cost'?'USD':item.unit} color={item.color}/>
 <div className="mg-sample-desc">{period==='halfHour'?'Simulated 30-minute gas intervals (not smart-meter updates).':period==='day'?'An illustrative 24-hour pattern for an October day.':period==='week'?'Illustrative seven-day pattern.':period==='month'?'Illustrative 30-day October pattern.':'Twelve simulated monthly totals.'} Historical years are generated from a fixed sample model, not provider records.</div>
 <div className="mg-year-compare">{oldYear.map(row=><div key={row.year}><small>{row.year} modeled total</small><strong>{metric==='cost'?money(row.total):`${number(row.total)} ${item.unit}`}</strong></div>)}</div>
 </Panel>
 <div className="mg-layout">
 <Panel><SectionTitle title="Previous bills & prediction" detail="Six previous sample statements and a simple cost projection"/><div className="mg-bill-summary"><div><small>Current example bill</small><strong>{money(pred.current)}</strong></div><div><small>Projected next bill</small><strong>{money(pred.projected)}</strong></div><div><small>vs prior month</small><strong>{pred.changePct>0?'+':''}{pred.changePct}%</strong></div></div><div className="mg-bill-history">{['May','Jun','Jul','Aug','Sep','Oct'].map((m,i)=><div key={m}><span>{m} 2026 · sample</span><b>{money(item.trend[i])}</b></div>)}</div><p className="mg-sample-desc">Projection method: {pred.assumption}. It is not an AI forecast or live provider statement.</p><button type="button" className="mg-outline" onClick={()=>downloadReport([item])}>Download sample bill CSV ↓</button></Panel>
 <Panel><SectionTitle title={item.id==='water'?'Water usage & potential leaks':item.id==='gas'?'Heating, absence & safety':item.id==='electricity'?'Electricity usage insights':'Service and billing notes'} detail="Rules-based example insights, not verified device diagnostics"/>
 {item.id==='water'&&<label className="mg-check"><input type="checkbox" checked={leak} onChange={e=>setLeak(e.target.checked)}/> Simulate an unusually high water-use month</label>}
 <div className={`mg-insight-alert ${anomaly.flag?'mg-flagged':''}`}><strong>{anomaly.headline}</strong><p>{anomaly.message}</p></div>
 {item.id==='water'&&<div className="mg-micro-stats"><div><small>Gallons this month</small><b>{number(item.usage)} gal</b></div><div><small>Modeled area comparison</small><b>3,600–5,800 gal</b></div></div>}
 {item.id==='gas'&&<><div className="mg-micro-stats"><div><small>Illustrative rate</small><b>{money(item.billBreakdown[0][1]/Math.max(item.usage,1))}/therm</b></div><div><small>Current gas use</small><b>{number(item.usage)} therms</b></div></div><Note tone="amber" title="Gas safety">Wattch cannot identify a gas leak, carbon monoxide, or an unsafe appliance. If you suspect a gas leak, leave the area and contact the gas emergency service.</Note></>}
 {!isMeter&&<p className="mg-sample-desc">{item.insight}</p>}
 {item.id==='electricity'&&<p className="mg-sample-desc">Run laundry, EV charging and discretionary loads during forecast off-peak periods in Energy Optimization. Smart breaker controls remain a simulation.</p>}
 <p className="mg-sample-desc">{isMeter?'Actual diagnosis requires meter readings and property-specific reference data.':'Only illustrative costs are displayed.'}</p>
 </Panel>
 </div></div>;
}
