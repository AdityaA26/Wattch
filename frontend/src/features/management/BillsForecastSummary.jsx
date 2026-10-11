import {useState} from 'react';
import {Panel,SectionTitle,ActionLink,Icon} from '../utilities/components/UtilityUI.jsx';
import {money} from '../../data/utilityData.js';
import {billPrediction,downloadReport} from '../../data/usageAnalytics.js';
import './management.css';
export default function BillsForecastSummary({utilities,paidBills={},onNavigate}){
 const [future,setFuture]=useState(false);
 const due=utilities.filter(u=>['water','internet','electricity'].includes(u.id));
 const monthly=utilities.reduce((v,u)=>v+u.monthly,0),predicted=utilities.reduce((v,u)=>v+billPrediction(u).projected,0);
 return <Panel><div className="mg-head-inline"><SectionTitle title="Bills due & cost outlook" detail="Due dates and projected charges · simulated"/><button type="button" className="mg-tiny" onClick={()=>setFuture(x=>!x)}>{future?'Current bills':'Next forecast'}</button></div>
 <div className="mg-topline"><div><small>{future?'Next modeled total':'Combined sample monthly cost'}</small><strong>{money(future?predicted:monthly)}</strong></div><span className="mg-tag">No utility feeds</span></div>
 <div className="u2-due-list">{due.map(item=><button type="button" key={item.id} onClick={()=>onNavigate(item.id)}><span className="u2-icon" style={{background:item.tint,color:item.color}}><Icon name={item.icon} size={17}/></span><span><strong>{item.label}</strong><small>{paidBills[item.id]?'Demo payment recorded':`Example due ${item.due}`}</small></span><b>{paidBills[item.id]?'PAID · DEMO':money(future?billPrediction(item).projected:item.monthly)}</b></button>)}</div>
 <div className="mg-actions"><button type="button" className="mg-outline" onClick={()=>downloadReport(utilities)}>Download monthly report ↓</button><ActionLink onClick={()=>onNavigate('utilities')}>All bills</ActionLink></div>
 <p className="mg-sample-desc">Predicted costs use sample spending history, not a live bill feed or an AI model.</p></Panel>;
}
