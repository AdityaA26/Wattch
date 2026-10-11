import {useState} from 'react';
import {UTILITIES, utilityTotal, money, percent} from '../../../data/utilityData.js';
import {PageHead,DemoBadge,Panel,SectionTitle,UtilityCard,Segments,ActionLink,Icon} from '../components/UtilityUI.jsx';
export default function UtilityOverviewPage({onNavigate}){
  const [filter,setFilter]=useState('all');
  const [sort,setSort]=useState('high');
  const shown=UTILITIES.filter(item=>filter==='all'||item.kind===filter).slice().sort((a,b)=>sort==='high'?b.monthly-a.monthly:sort==='low'?a.monthly-b.monthly:a.label.localeCompare(b.label));
  const total=utilityTotal();
  return <main className="u2-page"><PageHead crumb="UTILITIES" title="All your utilities." subtitle="Track costs, explore consumption and keep services organized." action={<button type="button" className="u2-primary" onClick={()=>onNavigate('connect')}><Icon name="plus" size={16}/> Connect utility</button>}/><DemoBadge/>
    <div className="u2-overview-hero"><div><span className="u2-eyebrow">COMBINED EXAMPLE MONTHLY SPENDING</span><strong>{money(total)}</strong><p>Across 5 categories · example bills, not provider records</p></div><div className="u2-overview-stats"><span>5 <small>services</small></span><span>0 <small>connected accounts</small></span></div></div>
    <SectionTitle title="Explore your services" detail="Choose a service to view its detailed dashboard" action={<div className="u2-overview-controls"><Segments ariaLabel="Filter service type" items={[{value:'all',label:'All'},{value:'metered',label:'Metered'},{value:'fixed',label:'Fixed'}]} value={filter} onChange={setFilter}/><select aria-label="Sort utilities" value={sort} onChange={e=>setSort(e.target.value)}><option value="high">Highest cost</option><option value="low">Lowest cost</option><option value="az">Name A–Z</option></select></div>}/>
    <div className="u2-utility-grid">{shown.map(item=><UtilityCard key={item.id} item={item} onNavigate={onNavigate}/>)}</div>
    <div className="u2-home-lower u2-overview-bottom"><Panel><SectionTitle title="Spending by service" detail="Each utility's share of sample costs"/><div className="u2-bars">{UTILITIES.slice().sort((a,b)=>b.monthly-a.monthly).map(item=><div className="u2-bar-row" key={item.id}><span>{item.label}</span><div><i style={{width:`${item.monthly/total*100}%`,background:item.color}}/></div><strong>{percent(item.monthly,total)}%</strong></div>)}</div></Panel><Panel><SectionTitle title="Ready for real bills?" detail="A clear separation between previews and live data"/><p className="u2-overview-copy">The dashboards can be connected to supported providers or user-authorized statement imports in a future release. For now, every bill, account, and consumption history is a labeled example.</p><ActionLink onClick={()=>onNavigate('connect')}>How connections will work</ActionLink></Panel></div>
  </main>;
}
