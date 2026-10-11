import {Panel,SectionTitle} from '../utilities/components/UtilityUI.jsx';
import {money} from '../../data/utilityData.js';
import {billPrediction,downloadReport} from '../../data/usageAnalytics.js';
import './management.css';
export default function AllBillsLedger({utilities,onNavigate}){
 const current=utilities.every(i=>i.monthly!=null)?utilities.reduce((s,i)=>s+i.monthly,0):null,projected=utilities.every(i=>billPrediction(i).projected!=null)?utilities.reduce((s,i)=>s+billPrediction(i).projected,0):null;
 return <Panel><div className="mg-head-inline"><SectionTitle title="All bills & projections" detail="Five utility categories, past bill comparisons, and predicted next costs"/><button type="button" className="mg-outline" onClick={()=>downloadReport(utilities)}>Download sample report ↓</button></div>
 <div className="mg-bill-summary"><div><small>Sample current total</small><strong>{money(current)}</strong></div><div><small>Projected next total</small><strong>{money(projected)}</strong></div><div><small>Change</small><strong>{money(projected==null||current==null?null:projected-current)}</strong></div></div>
 <div className="mg-bill-ledger" role="table" aria-label="Simulated utility billing summary"><div className="mg-ledger-header" role="row"><span role="columnheader">Service</span><span role="columnheader">Prior bill</span><span role="columnheader">Current</span><span role="columnheader">Next projection</span><span role="columnheader">Due (example)</span></div>{utilities.map(item=>{const info=billPrediction(item);return <button type="button" role="row" key={item.id} onClick={()=>onNavigate(item.id)}><span role="cell"><b>{item.label}</b></span><span role="cell">{money(info.previous)}</span><span role="cell">{money(info.current)}</span><span role="cell"><b>{money(info.projected)}</b></span><span role="cell">{item.due} →</span></button>})}</div>
 <p className="mg-sample-desc">Metered estimates use saved readings and illustrative fixed fees. Service charges and due dates are examples; projections repeat the latest 7 saved days for 30 days.</p></Panel>;
}
