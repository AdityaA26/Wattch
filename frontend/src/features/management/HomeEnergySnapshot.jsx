import {useEffect,useState} from 'react';
import {SectionTitle,Panel} from '../utilities/components/UtilityUI.jsx';
import {getProfiledUtility} from '../../state/householdProfile.js';
import {money} from '../../data/utilityData.js';
import './management.css';
const fmtHour=t=>{const n=Number(String(t||'').match(/T(\d\d):/)?.[1]);return Number.isFinite(n)?`${n%12||12} ${n>=12?'PM':'AM'}`:'Unavailable'};
export default function HomeEnergySnapshot({profile,onNavigate}){
 const [result,setResult]=useState({data:null,error:''});
 const power=getProfiledUtility(profile,'electricity');
 const params=new URLSearchParams({latitude:String(profile.latitude),longitude:String(profile.longitude),timezone:profile.timezone||'America/New_York',
 battery_capacity_kwh:String(profile.batteryCapacityKwh),starting_soc_pct:String(profile.startingSocPct),backup_reserve_pct:String(profile.backupReservePct),solar_capacity_kw:String(profile.solarCapacityKw),max_battery_power_kw:String(profile.maxBatteryPowerKw),base_load_kw:String(Math.max(.1,profile.monthlyElectricKwh/720))});
 const key=params.toString();
 useEffect(()=>{const ctrl=new AbortController();setResult({data:null,error:''});fetch(`/api/forecast?${key}`,{signal:ctrl.signal}).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(data=>{if(!ctrl.signal.aborted)setResult({data,error:''})}).catch(()=>{if(!ctrl.signal.aborted)setResult({data:null,error:'Energy forecast API unavailable'})});return()=>ctrl.abort()},[key]);
 const hours=result.data?.hours||[];
 const peak=hours.find(h=>h.price_tier==='peak');
 const saved24=Number(result.data?.summary?.estimated_savings_usd)||0;
 const available=Math.max(0,profile.batteryCapacityKwh*(profile.startingSocPct-profile.backupReservePct)/100);
 const backupHours=available/.5; // chosen assumed critical home load
 const advisoryCount=(result.data?.nws_alerts||[]).length;
 const peakDemand=hours.length?Math.max(0,...hours.map(h=>Number(h.grid_before_storage_kw)||0)):null;
 return <section className="mg-energy-home"><div className="mg-head-inline"><SectionTitle title="Today's energy picture" detail="Modeled household energy · weather context when API is running"/><button type="button" className="mg-outline" onClick={()=>onNavigate('energy')}>Optimize energy →</button></div>
 <div className="mg-energy-metrics"><Panel><small>Estimated average draw</small><strong>{(profile.monthlyElectricKwh/720).toFixed(2)} kW</strong><span>From your monthly usage setting</span></Panel>
 <Panel><small>Today's modeled electricity cost</small><strong>{money(power.monthly/30)}</strong><span>Monthly bill ÷ 30 days</span></Panel>
 <Panel><small>Battery charge · backup</small><strong>{Math.round(profile.startingSocPct)}% <em>· {backupHours.toFixed(1)}h</em></strong><span>0.5 kW assumed critical load, above reserve</span></Panel>
 <Panel><small>Estimated savings this month</small><strong>{hours.length?money(saved24*30):'—'}</strong><span>24h dispatch model × 30, not actual savings</span></Panel>
 <Panel><small>Next modeled peak price</small><strong>{peak?fmtHour(peak.time):hours.length?'None shown':'—'}</strong><span>Time-of-use price scenario</span></Panel>
 <Panel><small>Grid & outage context</small><strong>{hours.length?(advisoryCount?'Weather notice':peakDemand>2.5?'Higher demand':'Normal scenario'):'Unavailable'}</strong><span>Simulated grid; live NWS notices if available</span></Panel></div>
 {result.error&&<p className="mg-sample-desc">Forecast API unavailable. Household estimates still use the saved demo profile; weather-linked recommendations need the Python server.</p>}
 </section>;
}
