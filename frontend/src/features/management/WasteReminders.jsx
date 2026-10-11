import {Panel,SectionTitle,Note} from '../utilities/components/UtilityUI.jsx';
import {useHouseholds} from '../../state/householdProfile.js';
import {useServicePreferences,saveServicePreferences} from '../../state/servicePreferences.js';
import './management.css';
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const pickupNext=(day)=>{const now=new Date(),diff=(Number(day)-now.getDay()+7)%7;const result=new Date(now);result.setDate(now.getDate()+(diff===0?7:diff));return result.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})};
export default function WasteReminders(){
 const {activeHomeId}=useHouseholds(),prefs=useServicePreferences();const config=prefs[activeHomeId]?.waste||{};
 const day=Number(config.day??2),hour=config.hour||'07:00',types=config.types||'Trash + recycling',enabled=config.enabled??false;
 const write=patch=>saveServicePreferences(activeHomeId,'waste',patch);
 return <Panel><SectionTitle title="Waste pickup reminders" detail="Configure a schedule for this specific demo home"/>
 <div className="mg-layout mg-waste-cols"><div className="mg-form"><label>Example pickup weekday<select value={day} onChange={e=>write({day:Number(e.target.value)})}>{DAYS.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><label>Example pickup time<input type="time" value={hour} onChange={e=>write({hour:e.target.value})}/></label><label>Service<select value={types} onChange={e=>write({types:e.target.value})}><option>Trash + recycling</option><option>Trash only</option><option>Recycling only</option><option>Yard waste</option></select></label><label className="mg-check"><input type="checkbox" checked={enabled} onChange={e=>write({enabled:e.target.checked})}/> Show pickup reminders in Wattch</label></div>
 <div className="mg-pickup-card"><small>NEXT EXAMPLE PICKUP</small><strong>{pickupNext(day)}</strong><span>{hour} · {types}</span><p>{enabled?'Reminders are enabled inside the Waste page. Place bins out the night before your saved pickup day.':'Turn on reminders to display your saved collection schedule.'}</p></div></div>
 <Note title="Verify with your municipality">This calendar is user-configured, not a live municipal schedule. Holiday delays, bulk-item collections and weather changes must be verified with your provider. Background notifications are not enabled.</Note>
 </Panel>;
}
