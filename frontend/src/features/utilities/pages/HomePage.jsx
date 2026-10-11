import {useState} from 'react';
import {MONTHS, UTILITIES, utilityTotal, monthlyTotals, money, number, percent} from '../../../data/utilityData.js';
import {PageHead, DemoBadge, SectionTitle, Panel, UtilityCard, TrendChart, Segments, ActionLink, Icon} from '../components/UtilityUI.jsx';
import {useHouseholdProfile,getProfiledUtilities} from '../../../state/householdProfile.js';
import {EnergyHomeStatus} from '../../energy/EnergyOptimizationPage.jsx';

export default function HomePage({onNavigate,paidBills={}}){
  const profile=useHouseholdProfile();
  const utilities=getProfiledUtilities(profile);
  const [windowSize,setWindowSize]=useState(6);
  const total=utilities.reduce((sum,item)=>sum+item.monthly,0);
  const series=MONTHS.map((_,i)=>Number(utilities.reduce((sum,item)=>sum+item.trend[i],0).toFixed(2)));
  const shown=series.slice(-windowSize);
  const labels=MONTHS.slice(-windowSize);
  const budget=profile.monthlyBudgetUsd;
  const used=percent(total,budget);
  const due=utilities.filter(item=>['water','internet','electricity'].includes(item.id));
  return <main className="u2-page">
    <PageHead crumb="HOME" title="Your home, in one place." subtitle={`Utility costs for ${profile.homeName} · ${profile.city}, ${profile.state}`} action={<span className="u2-period-pill"><Icon name="calendar" size={15}/> October · sample period</span>}/>
    <DemoBadge/>
    <div className="u2-home-lead">
      <section className="u2-home-hero"><span className="u2-eyebrow">TOTAL HOUSEHOLD OPERATING COST</span><strong>{money(total)}</strong><p>Illustrative total for October</p><div className="u2-hero-stats"><div><span>Compared with May</span><b>{money(total-series[0])}</b></div><div><span>Example monthly budget</span><b>{money(budget)}</b></div><div><span>Budget remaining</span><b>{money(Math.max(0,budget-total))}</b></div></div></section>
      <Panel className="u2-home-health"><div className="u2-panel-title"><div><span className="u2-eyebrow u2-eyebrow-muted">HOUSEHOLD SNAPSHOT</span><h2>Accounts not connected</h2><p>All five utilities currently use demo readings.</p></div><span className="u2-health-icon"><Icon name="shield" size={26}/></span></div><div className="u2-home-health-note"><Icon name="info" size={18}/><span>Start with the interactive utility pages. Real account linking can come later.</span></div><ActionLink onClick={()=>onNavigate('connect')}>Explore account connection</ActionLink></Panel>
    </div>
    <SectionTitle title="Your utilities" detail="Five example services, one dashboard" action={<ActionLink onClick={()=>onNavigate('utilities')}>View all</ActionLink>}/>
    <div className="u2-utility-grid">{utilities.map(item=><UtilityCard key={item.id} item={item} onNavigate={onNavigate}/>)}</div>
    <div className="u2-home-lower">
      <Panel><div className="u2-panel-title"><div><h2>Household spending trend</h2><p>Combined utility costs over time · example values</p></div><Segments ariaLabel="Spending trend period" items={[{value:3,label:'3 months'},{value:6,label:'6 months'}]} value={windowSize} onChange={setWindowSize}/></div><TrendChart key={windowSize} values={shown} months={labels}/></Panel>
      <Panel><SectionTitle title="Bills due soon" detail="Sample dates and amounts, not real statements"/><div className="u2-due-list">{due.map(item=><button type="button" key={item.id} onClick={()=>onNavigate(item.id)}><span className="u2-icon" style={{background:item.tint,color:item.color}}><Icon name={item.icon} size={17}/></span><span><strong>{item.label}</strong><small>{paidBills[item.id]?"Demo payment recorded":`Example due ${item.due}`}</small></span><b>{paidBills[item.id]?"PAID · DEMO":money(item.monthly)}</b></button>)}</div><ActionLink onClick={()=>onNavigate('utilities')}>Manage utility overview</ActionLink></Panel>
    </div>
    <div className="u2-home-lower u2-last-row">
      <Panel><SectionTitle title="Where your money goes" detail="Breakdown of the example monthly total"/><div className="u2-split-track" aria-label="Utility spending breakdown">{utilities.map(item=><span key={item.id} style={{width:`${item.monthly/total*100}%`,background:item.color}} title={`${item.label}: ${money(item.monthly)}`}/>)}</div><div className="u2-split-list">{utilities.map(item=><div key={item.id}><span className="u2-dot" style={{background:item.color}}/>{item.label}<strong>{percent(item.monthly,total)}%</strong></div>)}</div></Panel>
      <EnergyHomeStatus onNavigate={onNavigate}/>
    </div>
  </main>;
}
