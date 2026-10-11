import { useState } from 'react';
import { MONTHS, UTILITIES, money, number } from '../../../data/utilityData.js';

export function Icon({name, size=19}) {
  const props = {width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
  const paths={
    bolt:<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>,
    droplet:<path d="M12 2c-2.5 4.2-7 9.3-7 13a7 7 0 0 0 14 0c0-3.7-4.5-8.8-7-13Z"/>,
    flame:<path d="M12 22a8 8 0 0 0 8-8c0-4-2-6.5-5-9-.1 3-1.5 4-2.5 4.4-.2-3-2-5.6-3.5-7.4C9 8 4 10.4 4 15a8 8 0 0 0 8 7Z"/>,
    wifi:<><path d="M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/></>,
    trash:<><path d="M4 7h16M9 7V4h6v3m4 0-.7 14H5.7L5 7M10 11v6m4-6v6"/></>,
    arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    shield:<><path d="m12 2 8 4v5c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V6l8-4Z"/><path d="m8.8 12 2.3 2.3 4.3-4.6"/></>,
    check:<path d="m5 12 4 4L19 6"/>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9v.5"/></>,
    leaf:<><path d="M5 20c-2-7.5 3-14 14-16 0 11-5 18-14 16Z"/><path d="M6 19c2-5 6-8 10-11"/></>,
    chart:<><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></>,
    plus:<path d="M12 4v16M4 12h16"/>,
  };
  return <svg {...props}>{paths[name]||paths.info}</svg>;
}
export function PageHead({crumb,title,subtitle,action}) {return <header className="u2-pagehead"><div><div className="u2-breadcrumb">YOUR HOME <span>/</span> {crumb}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="u2-head-actions">{action}</div>}</header>}
export function DemoBadge(){return <div className="u2-demo"><span className="u2-demo-dot"/> PREVIEW DATA <span className="u2-demo-sep">·</span> Example household, not connected utility accounts</div>}
export function SectionTitle({title,detail,action}) {return <div className="u2-section-title"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>}
export function Panel({children,className=''}) {return <section className={`u2-panel ${className}`}>{children}</section>}
export function ActionLink({children,onClick}){return <button type="button" className="u2-action-link" onClick={onClick}>{children}<Icon name="arrow" size={15}/></button>}
export function UtilityCard({item,onNavigate}){return <button className="u2-util-card" type="button" onClick={()=>onNavigate(item.id)}><span className="u2-icon" style={{color:item.color,background:item.tint}}><Icon name={item.icon} size={18}/></span><span className="u2-util-label">{item.label}</span><strong>{money(item.monthly)}</strong><small>{item.id==='internet'?'Monthly subscription':`${number(item.usage)} ${item.unit} this month`}</small><span className="u2-card-foot">View details <Icon name="arrow" size={15}/></span></button>}
export function Segments({items,value,onChange,ariaLabel}){return <div className="u2-segments" role="group" aria-label={ariaLabel}>{items.map(item=><button type="button" key={item.value} aria-pressed={value===item.value} className={value===item.value?'is-selected':''} onClick={()=>onChange(item.value)}>{item.label}</button>)}</div>}
export function Metric({label,value,detail,icon,color,tint}){return <div className="u2-metric">{icon && <span className="u2-icon" style={{color,background:tint}}><Icon name={icon}/></span>}<span className="u2-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>}
export function RangeControl({label,value,setValue,min,max,step=1,unit='',help}){return <label className="u2-range"><span className="u2-range-head"><strong>{label}</strong><b>{number(value)}{unit}</b></span><input type="range" value={value} min={min} max={max} step={step} onChange={e=>setValue(Number(e.target.value))}/>{help && <span className="u2-range-help">{help}</span>}</label>}
export function TrendChart({values,color='#42694c',unit='USD',months=MONTHS}) {
  const [selected,setSelected]=useState(values.length-1);
  const high = Math.max(...values,1)*1.12;
  const low = Math.min(0,...values);
  const x=i=>44+(i*(602/Math.max(1,values.length-1)));
  const y=v=>183-(v-low)/(high-low||1)*150;
  const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
  const fmt=v=>unit==='USD'?money(v):`${number(v)} ${unit}`;
  return <div className="u2-chart-wrap"><div className="u2-chart-selected"><span>{months[selected]} · selected period</span><strong>{fmt(values[selected])}</strong></div><svg className="u2-chart" viewBox="0 0 696 227" role="group" aria-label={`Sample six-month ${unit} trend; select a month to inspect its value`}>
    {[0,1,2,3].map(i=><line key={i} x1="44" y1={33+i*50} x2="646" y2={33+i*50} stroke="#e7ebe5" strokeDasharray="3 6"/>)}
    <polyline fill="none" points={points} stroke={color} strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round"/>
    {values.map((v,i)=><g key={i}><circle cx={x(i)} cy={y(v)} r="13" fill="transparent" role="button" tabIndex={0} aria-label={`${months[i]}: ${fmt(v)}`} onClick={()=>setSelected(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(i)}}}/><circle cx={x(i)} cy={y(v)} r={selected===i?5:3.7} stroke={color} strokeWidth="2" fill="white" pointerEvents="none"/><text x={x(i)} y="216" textAnchor="middle" fontSize="12" fill="#9aa69c">{months[i]}</text></g>)}
  </svg></div>;
}
export function BillBreakdown({item}){return <Panel><SectionTitle title="Bill breakdown" detail="Illustrative charges for this example account"/><div className="u2-bill-lines">{item.billBreakdown.map(([label,value])=><div key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}<div className="u2-bill-total"><span>Monthly total</span><strong>{money(item.monthly)}</strong></div></div></Panel>}
export function ItemOverview({item}){return <div className="u2-metric-grid"><Metric label="Monthly cost" value={money(item.monthly)} detail="Example billing period" icon={item.icon} color={item.color} tint={item.tint}/><Metric label="Consumption" value={`${number(item.usage)} ${item.unit}`} detail="Example monthly reading" icon="chart" color="#3e7655" tint="#eef4ed"/><Metric label="Account" value="Demo" detail="No provider login connected" icon="shield" color="#7e9480" tint="#eff2ee"/></div>}
export function TrendPanel({item,metric,setMetric}){return <Panel><div className="u2-panel-title"><div><h2>{metric==='cost'?'Cost history':'Usage history'}</h2><p>Last six sample months</p></div><Segments ariaLabel="Chart metric" items={[{value:'usage',label:'Usage'},{value:'cost',label:'Cost'}]} value={metric} onChange={setMetric}/></div><TrendChart key={`${item.id}-${metric}`} values={metric==='cost'?item.trend:item.activity} unit={metric==='cost'?'USD':item.unit} color={item.color}/></Panel>}
export function Note({title,children,tone='green'}){return <div className={`u2-note u2-note-${tone}`}><Icon name={tone==='amber'?'info':'leaf'} size={18}/><div><strong>{title}</strong><p>{children}</p></div></div>}
export function ServiceTile({item}){return <div className="u2-service-tile"><span className="u2-icon" style={{color:item.color,background:item.tint}}><Icon name={item.icon}/></span><span><strong>{item.provider}</strong><small>Demo provider · Not connected</small></span></div>}
