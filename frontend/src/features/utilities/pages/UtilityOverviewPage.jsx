import {useState} from 'react';
import {UTILITIES, utilityTotal, money, percent} from '../../../data/utilityData.js';
import {PageHead,DemoBadge,Panel,SectionTitle,UtilityCard,Segments,ActionLink,Icon} from '../components/UtilityUI.jsx';
import {useHouseholdProfile,getProfiledUtilities} from '../../../state/householdProfile.js';
import AllBillsLedger from '../../management/AllBillsLedger.jsx';
export default function UtilityOverviewPage({onNavigate}){
  const profile=useHouseholdProfile();
  const utilities=getProfiledUtilities(profile);
  const [filter,setFilter]=useState('all');
  const [sort,setSort]=useState('high');
  const shown=utilities.filter(item=>filter==='all'||item.kind===filter).slice().sort((a,b)=>a.monthly==null?1:b.monthly==null?-1:sort==='high'?b.monthly-a.monthly:sort==='low'?a.monthly-b.monthly:a.label.localeCompare(b.label));
  const total=utilities.every(u=>u.monthly!=null)?utilities.reduce((sum,item)=>sum+item.monthly,0):null;
  return <main className="u2-page"><PageHead crumb="UTILITIES" title="Utilities" subtitle="Track costs, explore consumption and keep services organized." action={<button type="button" className="u2-primary" onClick={()=>onNavigate('connect')}><Icon name="plus" size={16}/> Import readings</button>}/><DemoBadge/>
    <div className="u2-overview-hero"><div><span className="u2-eyebrow">HOUSEHOLD 30-DAY COST ESTIMATE</span><strong>{money(total)}</strong><p>Saved daily readings + sample service charges</p></div><div className="u2-overview-stats"><span>5 <small>services</small></span><span>0 <small>connected accounts</small></span></div></div>
    <SectionTitle title="Explore your services" detail="Choose a service to view its detailed dashboard" action={<div className="u2-overview-controls"><Segments ariaLabel="Filter service type" items={[{value:'all',label:'All'},{value:'metered',label:'Metered'},{value:'fixed',label:'Fixed'}]} value={filter} onChange={setFilter}/><select aria-label="Sort utilities" value={sort} onChange={e=>setSort(e.target.value)}><option value="high">Highest cost</option><option value="low">Lowest cost</option><option value="az">Name A–Z</option></select></div>}/>
    <div className="u2-utility-grid">{shown.map(item=><UtilityCard key={item.id} item={item} onNavigate={onNavigate}/>)}</div>
    <div className="u2-section-gap"><AllBillsLedger utilities={utilities} onNavigate={onNavigate}/></div>
    <div className="u2-home-lower u2-overview-bottom"><Panel><SectionTitle title="Spending by service" detail="Each utility's share of sample costs"/>{total!=null?<div className="u2-bars">{utilities.slice().sort((a,b)=>b.monthly-a.monthly).map(item=><div className="u2-bar-row" key={item.id}><span>{item.label}</span><div><i style={{width:`${item.monthly/total*100}%`,background:item.color}}/></div><strong>{percent(item.monthly,total)}%</strong></div>)}</div>:<p className="wp-empty">Complete cost comparisons need saved readings and rates for each metered service.</p>}</Panel><Panel><SectionTitle title="Use your own daily readings"/><p className="u2-overview-copy">Import electricity, water or gas consumption from a CSV to update this home's bill estimates, history and AI evidence.</p><ActionLink onClick={()=>onNavigate('connect')}>Import readings</ActionLink></Panel></div>
  </main>;
}
