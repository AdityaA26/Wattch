import { useEffect, useMemo, useState } from 'react';
import { useHouseholdProfile } from '../../state/householdProfile.js';
import { useVacationMode, saveVacationPlan, toggleVacationMode, calculateVacation } from '../../state/vacationMode.js';
import { localDateISO, addDays } from '../../state/vacationCalculations.js';
import './vacation.css';

const usd = n => Number(n).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const rounded = n => Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
const statusLabels = { active:'Active · demo', scheduled:'Scheduled · demo', completed:'Trip ended', off:'Off', invalid:'Dates need attention' };
const prettyDate = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';

export function VacationSummaryStrip({onNavigate}) {
  const profile = useHouseholdProfile();
  const {plan,status} = useVacationMode();
  if (status !== 'active' && status !== 'scheduled') return null;
  const r=calculateVacation(profile,plan);
  return <div className="vac-banner" role="status">
    <span className="vac-banner-icon" aria-hidden="true">✦</span>
    <div><strong>Vacation plan {status === 'scheduled'?'scheduled':'active'} · {profile.homeName}</strong>
      <small>{prettyDate(plan.startDate)}–{prettyDate(plan.endDate)} · {rounded(r.avoidedKwh)} kWh less grid demand (modeled) · {r.protectedReservePct}% backup target</small></div>
    <button type="button" onClick={()=>onNavigate('vacation')}>Manage plan <span aria-hidden="true">→</span></button>
  </div>;
}

export default function VacationPage({onNavigate}) {
  const profile=useHouseholdProfile();
  const vacation=useVacationMode();
  const {plan,status,activeHomeId}=vacation;
  const [draft,setDraft]=useState(plan);
  const [message,setMessage]=useState('');
  useEffect(()=>{setDraft(plan);setMessage('');},[activeHomeId,JSON.stringify(plan)]);
  const stats=useMemo(()=>calculateVacation(profile,draft),[profile,draft]);
  const dirty=JSON.stringify(draft)!==JSON.stringify(plan);
  const today=localDateISO();
  const dateAllowed=draft.startDate>=today || (plan.enabled && plan.startDate===draft.startDate && status==='active');
  const valid=stats.days>0&&stats.days<=90&&dateAllowed&&draft.endDate>=draft.startDate;
  const set=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
  function save(e){e.preventDefault();if(!valid){setMessage('Choose valid upcoming dates, with a trip between 1 and 90 days.');return;}
    try{saveVacationPlan({...draft,enabled:true});setMessage('Saved. Your trip plan is now '+(draft.startDate>today?'scheduled.':'active.')+' Changes are saved for this home only.');}
    catch(error){setMessage(error.message);}}
  function switchOff(){try{toggleVacationMode(false);setMessage('Vacation Mode disabled for this home. No real devices were controlled.');}catch(e){setMessage(e.message);}}
  function quickWeek(){setDraft(previous=>({...previous,startDate:today,endDate:addDays(today,6)}));}
  return <main className="vac-page">
    <div className="vac-breadcrumb">YOUR HOME <span>/</span> VACATION MODE</div>
    <div className="vac-heading"><div><h1>Make time away work for you.</h1><p>Plan lower household electricity use and preserve backup power while you're away.</p></div>
      <button type="button" className="vac-text-button" onClick={()=>onNavigate('settings')}>Home settings ↗</button></div>
    <div className="vac-intro-grid">
      <div className="vac-hero"><div className="vac-hero-top"><span>VACATION MODE</span><span className="vac-status">{statusLabels[status]}</span></div><h2>{profile.homeName}</h2><p>{plan.enabled ? `Current plan: ${prettyDate(plan.startDate)} – ${prettyDate(plan.endDate)}` : 'Schedule your next trip and see what your home could save.'}</p><div className="vac-hero-foot"><div><span>Protected battery target</span><strong>{stats.protectedReservePct}%</strong></div><div><span>Expected usage while away</span><strong>{draft.awayUsagePct}%</strong></div></div></div>
      <div className="vac-intro-card"><span className="vac-overline">YOUR PROJECTED SAVINGS</span><strong>{usd(stats.estimatedSavings)}</strong><p>Estimated variable electricity savings across {stats.days} day{stats.days===1?'':'s'}</p><div className="vac-progress"><span style={{width:`${stats.baselineKwh ? 100*stats.avoidedKwh/stats.baselineKwh : 0}%`}}/></div><small>Based on your demo electricity profile and a {Math.round(draft.assumedRate*100)}¢/kWh example rate.</small></div>
    </div>
    <div className="vac-stats">
      <div><span>Baseline usage</span><strong>{rounded(stats.baselineKwh)} kWh</strong><small>At-home estimate</small></div>
      <div><span>Vacation usage</span><strong>{rounded(stats.projectedKwh)} kWh</strong><small>Essential + modeled away loads</small></div>
      <div><span>Modeled energy avoided</span><strong>{rounded(stats.avoidedKwh)} kWh</strong><small>Projected load reduction, not metered</small></div>
      <div><span>Backup runtime</span><strong>{rounded(stats.backupHours)} hours</strong><small>Protected energy at {draft.criticalLoadKw} kW critical load</small></div>
    </div>
    <form onSubmit={save} className="vac-layout">
      <section className="vac-card"><div className="vac-card-head"><span className="vac-label">01 / YOUR TRIP</span><h2>Travel schedule</h2><p>Wattch only runs this as a household simulation.</p></div>
        <div className="vac-dates"><label>Leaving on<input required type="date" min={plan.enabled && plan.startDate<today ? plan.startDate : today} value={draft.startDate} onChange={e=>{const startDate=e.target.value;setDraft(p=>({...p,startDate,endDate:p.endDate<startDate?startDate:p.endDate}));}}/></label>
        <label>Returning on<input required type="date" min={draft.startDate} value={draft.endDate} onChange={e=>set('endDate',e.target.value)}/></label></div>
        <button type="button" className="vac-link" onClick={quickWeek}>Use a 7-day example →</button>
        <div className="vac-divider"/>
        <div className="vac-card-head"><span className="vac-label">02 / ENERGY PLAN</span><h2>How much stays on?</h2><p>Set the estimated share of normal electricity use while away.</p></div>
        <div className="vac-slider-title"><label htmlFor="vac-usage">Remaining household load</label><strong>{draft.awayUsagePct}%</strong></div>
        <input id="vac-usage" className="vac-slider" type="range" min="20" max="95" step="5" value={draft.awayUsagePct} onChange={e=>set('awayUsagePct',Number(e.target.value))}/>
        <div className="vac-range-labels"><span>20% · lower usage</span><span>95% · near normal</span></div>
        <div className="vac-slider-title"><label htmlFor="vac-rate">Assumed electricity rate</label><strong>{Math.round(draft.assumedRate*100)}¢/kWh</strong></div>
        <input id="vac-rate" className="vac-slider" type="range" min="0.08" max="0.4" step="0.01" value={draft.assumedRate} onChange={e=>set('assumedRate',Number(e.target.value))}/>
        <div className="vac-range-labels"><span>8¢</span><span>40¢</span></div>
      </section>
      <section className="vac-card"><div className="vac-card-head"><span className="vac-label">03 / ENERGY RESILIENCE</span><h2>Leave the essentials protected.</h2><p>Model what your battery can hold for a potential grid outage.</p></div>
        <div className="vac-slider-title"><label htmlFor="vac-reserve">Vacation battery reserve</label><strong>{draft.reservePct}%</strong></div>
        <input id="vac-reserve" className="vac-slider" type="range" min="20" max="90" step="5" value={draft.reservePct} onChange={e=>set('reservePct',Number(e.target.value))}/>
        <div className="vac-range-labels"><span>20%</span><span>90%</span></div>
        <div className="vac-protection"><span>▣</span><p><strong>{stats.protectedReservePct}% effective backup target</strong><small>Never below the {profile.backupReservePct}% minimum set for this home. Actual available charge may be lower.</small></p></div>
        <div className="vac-slider-title"><label htmlFor="vac-critical">Essential backup load (kW)</label><strong>{draft.criticalLoadKw.toFixed(1)} kW</strong></div>
        <input id="vac-critical" className="vac-slider" type="range" min="0.1" max="3" step="0.1" value={draft.criticalLoadKw} onChange={e=>set('criticalLoadKw',Number(e.target.value))}/>
        <div className="vac-slider-title"><label htmlFor="vac-return">Pre-return recovery</label><strong>{draft.preReturnHours} hours</strong></div>
        <input id="vac-return" className="vac-slider" type="range" min="0" max="12" step="1" value={draft.preReturnHours} onChange={e=>set('preReturnHours',Number(e.target.value))}/>
        <small className="vac-helper">Models a gradual return to normal electricity consumption before you arrive.</small>
      </section>
      <section className="vac-card vac-breakdown"><div className="vac-card-head"><span className="vac-label">04 / PLAN SUMMARY</span><h2>See the difference.</h2><p>Variable electricity expenses during this trip, excluding fixed charges.</p></div>
        <div className="vac-bars"><div><span>Without Vacation Mode</span><strong>{usd(stats.baselineCost)}</strong></div><div className="vac-bar"><i style={{width:'100%',background:'#cad7ca'}}/></div><div><span>With Vacation Mode</span><strong>{usd(stats.projectedCost)}</strong></div><div className="vac-bar"><i style={{width:`${stats.baselineCost ? 100*stats.projectedCost/stats.baselineCost : 0}%`,background:'#477651'}}/></div></div>
        <div className="vac-summary"><span>Estimated reduction</span><strong>{usd(stats.estimatedSavings)}</strong></div>
        <p className="vac-disclaimer">Demo calculations only. Does not read your meter, schedule HVAC, contact your utility, or operate breakers/batteries. Neither savings nor outage-runtime figures are guaranteed.</p>
        <div className="vac-actions"><button type="submit" className="vac-primary" disabled={!valid}>{dirty||!plan.enabled?'Save & activate plan':'Save updated plan'}</button>{plan.enabled&&<button type="button" className="vac-secondary" onClick={switchOff}>Turn off Vacation Mode</button>}</div>
        {message&&<p role="status" className="vac-message">{message}</p>}
      </section>
    </form>
  </main>;
}
