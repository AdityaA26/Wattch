import {useState} from 'react';
import {Panel,SectionTitle,Segments,Note} from '../utilities/components/UtilityUI.jsx';
import {money} from '../../data/utilityData.js';
import {useHouseholds,useHouseholdProfile} from '../../state/householdProfile.js';
import {useServicePreferences,saveServicePreferences} from '../../state/servicePreferences.js';
import {billPrediction,downloadReport} from '../../data/usageAnalytics.js';
import './management.css';
const PLANS=[{id:'basic',label:'Basic',monthly:59.99,speed:'Up to 150 Mbps'},{id:'standard',label:'Everyday',monthly:79.99,speed:'Up to 500 Mbps'},{id:'gig',label:'Gigabit',monthly:109.99,speed:'Up to 1 Gbps'}];
const SUPPORT={'Spectrum':'https://www.spectrum.net/support','AT&T':'https://www.att.com/outages/','Xfinity':'https://www.xfinity.com/support/status'};
export default function InternetServicePage({item}){
 const {activeHomeId}=useHouseholds();const profile=useHouseholdProfile();const prefs=useServicePreferences();const current=prefs[activeHomeId]?.internet||{};
 const [plan,setPlan]=useState('standard'),[cable,setCable]=useState(false);
 const provider=current.provider||'Spectrum',equipmentFee=Number(current.equipmentFee??10),promoDate=current.promoDate||'',billReminder=current.billReminder||'';
 const selected=PLANS.find(p=>p.id===plan),projection=billPrediction(item);
 const write=patch=>saveServicePreferences(activeHomeId,'internet',patch);
 const criticalLoadKw=.08;const aboveReserveKwh=Math.max(0,profile.batteryCapacityKwh*(profile.startingSocPct-profile.backupReservePct)/100);const routerRuntime=aboveReserveKwh/criticalLoadKw;
 const hasPromo=promoDate && !Number.isNaN(Date.parse(promoDate));
 const daysLeft=hasPromo?Math.ceil((new Date(`${promoDate}T00:00:00`)-new Date())/86400000):null;
 return <div className="u3-stack"><div className="mg-layout">
 <Panel><SectionTitle title="Internet & cable service" detail="Billing and subscription planning, not a connected router monitor"/>
 <div className="mg-form"><label>Example provider<select value={provider} onChange={e=>write({provider:e.target.value})}>{Object.keys(SUPPORT).map(x=><option key={x}>{x}</option>)}</select></label><label>Equipment rental scenario ($ / month)<input type="number" min="0" max="150" step="1" value={equipmentFee} onChange={e=>write({equipmentFee:Math.max(0,Math.min(150,Number(e.target.value)||0))})}/></label><label>Promotional price expires (optional)<input type="date" value={promoDate} onChange={e=>write({promoDate:e.target.value})}/></label><label>Billing reminder date (visible in this app)<input type="date" value={billReminder} onChange={e=>write({billReminder:e.target.value})}/></label></div>
 <div className="mg-bill-summary"><div><small>Illustrative monthly charge</small><strong>{money(item.monthly)}</strong></div><div><small>Next bill model</small><strong>{money(projection.projected)}</strong></div><div><small>Rental scenario</small><strong>{money(equipmentFee)}</strong></div></div>
 {hasPromo&&<div className={`mg-insight-alert ${daysLeft<=45?'mg-flagged':''}`}><strong>{daysLeft>=0?`Sample promotion ends in ${daysLeft} day${daysLeft===1?'':'s'}`:'Selected promotion date has passed'}</strong><p>Your actual billing terms and post-promotion price must be verified with {provider}.</p></div>}
 {billReminder&&<p className="mg-confirm">In-app bill reminder set for {billReminder}. No email or push notification will be sent.</p>}
 </Panel>
 <Panel><SectionTitle title="Compare example plans" detail="These are hypothetical offers, not advertised provider rates"/><Segments items={PLANS.map(p=>({value:p.id,label:p.label}))} value={plan} onChange={setPlan} ariaLabel="Example plan tier"/><div className="mg-bill-summary"><div><small>Example speed</small><strong>{selected.speed}</strong></div><div><small>Plan + equipment</small><strong>{money(selected.monthly+equipmentFee)}</strong></div></div><label className="mg-check"><input type="checkbox" checked={cable} onChange={e=>setCable(e.target.checked)}/> I pay for cable channels I rarely watch</label>{cable&&<div className="mg-insight-alert"><strong>Consider reviewing your cable package</strong><p>You indicated you rarely watch some channels. Check whether removing or downgrading cable saves money.</p></div>}<Note title="Router not connected">Online/offline status, live upload/download activity, connected devices, unknown-device alerts and Wi-Fi signal are unavailable without an authorized router integration.</Note></Panel>
 </div>
 <Panel><SectionTitle title="Storm & internet continuity" detail="Battery-powered connectivity is possible when your equipment has a compatible backup circuit"/><div className="mg-insight-alert"><strong>Illustrative modem + router + phone charging backup: {routerRuntime.toFixed(1)} hours</strong><p>Assumes 80 watts continuously and only battery energy above your saved emergency reserve. Actual uptime depends on grid outages, ISP infrastructure, wiring and equipment.</p></div><p className="mg-sample-desc">Live outage detection and connected-device lists require authorized ISP or router access; weather advisories do not guarantee an internet outage.</p></Panel>
 <Panel><SectionTitle title="Service actions" detail="Open supported external services or adjust local demo settings"/><div className="mg-actions"><a className="mg-outline" href="https://fast.com/" target="_blank" rel="noopener noreferrer">Test internet speed ↗</a><a className="mg-outline" href={SUPPORT[provider]} target="_blank" rel="noopener noreferrer">Check outage / provider ↗</a><button type="button" className="mg-outline" onClick={()=>downloadReport([item])}>View sample bills (CSV) ↓</button><a className="mg-outline" href="https://www.fcc.gov/broadbandlabels" target="_blank" rel="noopener noreferrer">Compare plan terms ↗</a></div><button type="button" className="mg-outline" disabled title="Connect a supported router to unlock device management">Manage devices · requires router</button><p className="mg-sample-desc">Connected devices management is disabled until a supported router is connected. Actual plan prices and provider outages are not verified.</p></Panel>
 </div>;
}
