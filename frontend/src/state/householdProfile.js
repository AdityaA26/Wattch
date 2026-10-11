/** Shared, browser-only Wattch demo households.
 * Household profiles and equipment are locally stored; no real device connection
 * or utility credentials. Legacy single-household settings are migrated on load.
 */
import {useSyncExternalStore} from 'react';
import {UTILITIES} from '../data/utilityData.js';
import {dashboardForHome} from './dashboardSnapshot.js';

export const PROFILE_KEY = 'wattch-household-profile-v1';
export const HOMES_KEY = 'wattch-homes-v2';
export const DEFAULT_PROFILE = Object.freeze({
  homeName:'Beach House',city:'Columbia',state:'South Carolina',zip:'29201',
  latitude:34.0007,longitude:-81.0348,timezone:'America/New_York',
  homeType:'Single-family',squareFeet:2100,occupants:3,
  monthlyBudgetUsd:400,monthlyElectricKwh:624,
  electricityProvider:'Not connected',waterProvider:'Not connected',
  gasProvider:'Not connected',internetProvider:'Not connected',wasteProvider:'Not connected',
  batteryCapacityKwh:13.5,startingSocPct:55,backupReservePct:30,
  solarCapacityKw:5,maxBatteryPowerKw:5,
  essentialLoadKw:.55,backupGoalHours:8,peerOptIn:false,
});
const limits={latitude:[-90,90],longitude:[-180,180],squareFeet:[200,20000],occupants:[1,20],monthlyBudgetUsd:[0,100000],monthlyElectricKwh:[0,20000],batteryCapacityKwh:[0.001,1000],startingSocPct:[0,100],backupReservePct:[0,100],solarCapacityKw:[0,1000],maxBatteryPowerKw:[0.1,500],essentialLoadKw:[.01,20],backupGoalHours:[0,72]};
const strings=['homeName','city','state','zip','timezone','homeType','electricityProvider','waterProvider','gasProvider','internetProvider','wasteProvider'];
const equipmentTypes=['battery','breaker','solar'];
const typeLimits={battery:[0,1000],breaker:[1,200],solar:[0,1000]};

function cleanProfile(value){
  const out={...DEFAULT_PROFILE};
  if(!value||typeof value!=='object')return out;
  for(const f of strings)if(typeof value[f]==='string')out[f]=value[f].trim().slice(0,80)||DEFAULT_PROFILE[f];
  for(const [f,[low,high]] of Object.entries(limits)){
    const x=Number(value[f]); if(value[f]!==''&&value[f]!=null&&Number.isFinite(x))out[f]=Math.max(low,Math.min(high,x));
  }
  out.peerOptIn=value.peerOptIn===true;
  out.occupants=Math.round(out.occupants);
  return out;
}
function exampleEquipment(profile){return [
  {id:'example-battery',type:'battery',name:'Home battery',manufacturer:'Wattch',model:'Battery concept',rating:profile.batteryCapacityKwh,status:'owned'},
  {id:'example-breaker',type:'breaker',name:'Smart circuit breaker panel',manufacturer:'Wattch',model:'Smart panel concept',rating:12,status:'owned'},
  {id:'example-solar',type:'solar',name:'Rooftop solar system',manufacturer:'Example system',model:'PV array',rating:profile.solarCapacityKw,status:'owned'},
]};
function sanitizeEquipment(device){
  const type=equipmentTypes.includes(device?.type)?device.type:'battery';
  const [min,max]=typeLimits[type];
  const value=Number(device?.rating);
  return {
    id:String(device?.id||makeId()).slice(0,100),type,
    name:String(device?.name||({battery:'Home battery',breaker:'Circuit breaker',solar:'Solar array'}[type])).slice(0,70),
    manufacturer:String(device?.manufacturer||'').slice(0,70),model:String(device?.model||'').slice(0,70),
    rating:Number.isFinite(value)?Math.max(min,Math.min(max,value)):min,
    status:device?.status==='planned'?'planned':'owned',
  };
}
function makeId(){return `home-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;}
function sanitizeHome(entry){
  const profile=cleanProfile(entry?.profile);
  const equipment=Array.isArray(entry?.equipment)?entry.equipment.slice(0,50).map(sanitizeEquipment):exampleEquipment(profile);
  const ids=new Set();
  return {id:String(entry?.id||makeId()).slice(0,100),profile,equipment:equipment.map(e=>{
    if(ids.has(e.id))e={...e,id:makeId()};ids.add(e.id);return e;
  })};
}
function readStore(){
  if(typeof window==='undefined')return {activeHomeId:'home-default',homes:[sanitizeHome({id:'home-default',profile:DEFAULT_PROFILE})]};
  try{
    const stored=JSON.parse(window.localStorage.getItem(HOMES_KEY)||'null');
    if(stored && Array.isArray(stored.homes)&&stored.homes.length){
      const homes=stored.homes.slice(0,8).map(sanitizeHome);
      const activeHomeId=homes.some(h=>h.id===stored.activeHomeId)?stored.activeHomeId:homes[0].id;
      return {activeHomeId,homes};
    }
  }catch{/* Fall back to legacy or demo defaults */}
  let legacy=null;
  try{legacy=JSON.parse(window.localStorage.getItem(PROFILE_KEY)||'null');}catch{}
  const profile=cleanProfile(legacy);
  return {activeHomeId:'home-default',homes:[sanitizeHome({id:'home-default',profile})]};
}
const listeners=new Set();
let snapshot=readStore();
let activeProfile=snapshot.homes.find(h=>h.id===snapshot.activeHomeId).profile;
const emit=()=>listeners.forEach(fn=>fn());
function persist(next){
  if(typeof window!=='undefined'){
    try{window.localStorage.setItem(HOMES_KEY,JSON.stringify(next));}
    catch{throw new Error('Browser storage is unavailable. Changes were not saved.');}
  }
  snapshot=next;activeProfile=next.homes.find(h=>h.id===next.activeHomeId).profile;emit();
  return activeProfile;
}
function onStorage(ev){if(ev.key===HOMES_KEY||ev.key===null){snapshot=readStore();activeProfile=snapshot.homes.find(h=>h.id===snapshot.activeHomeId).profile;emit();}}
function subscribe(listener){
  listeners.add(listener);
  return ()=>listeners.delete(listener);
}
if(typeof window!=='undefined')window.addEventListener('storage',onStorage);
export const useHouseholdProfile=()=>useSyncExternalStore(subscribe,()=>activeProfile,()=>DEFAULT_PROFILE);
export const getHouseholdProfile=()=>activeProfile;
export const useHouseholds=()=>useSyncExternalStore(subscribe,()=>snapshot,()=>snapshot);
export const getHouseholds=()=>snapshot;
export function saveHouseholdProfile(patch){
  const homes=snapshot.homes.map(h=>h.id===snapshot.activeHomeId?{...h,profile:cleanProfile({...h.profile,...patch})}:h);
  return persist({...snapshot,homes});
}
export function resetHouseholdProfile(){
  const profile={...DEFAULT_PROFILE};const homes=snapshot.homes.map(h=>h.id===snapshot.activeHomeId?{...h,profile,equipment:exampleEquipment(profile)}:h);
  return persist({...snapshot,homes});
}
export function addHousehold(){
  if(snapshot.homes.length>=8)throw new Error('This demo supports up to eight homes.');
  const idx=snapshot.homes.length+1;
  const profile={...DEFAULT_PROFILE,homeName:`New Home ${idx}`};
  const entry={id:makeId(),profile,equipment:exampleEquipment(profile)};
  persist({homes:[...snapshot.homes,entry],activeHomeId:entry.id});return entry.id;
}
export function selectHousehold(id){
  if(!snapshot.homes.some(h=>h.id===id))throw new Error('Home not found');
  return persist({...snapshot,activeHomeId:id});
}
export function deleteHousehold(id){
  if(snapshot.homes.length<2)throw new Error('Keep at least one home.');
  const homes=snapshot.homes.filter(h=>h.id!==id);
  if(homes.length===snapshot.homes.length)throw new Error('Home not found');
  persist({homes,activeHomeId:snapshot.activeHomeId===id?homes[0].id:snapshot.activeHomeId});
}
export function getActiveEquipment(){return snapshot.homes.find(h=>h.id===snapshot.activeHomeId)?.equipment||[];}
export function useActiveEquipment(){const homes=useHouseholds();return homes.homes.find(h=>h.id===homes.activeHomeId)?.equipment||[];}
function updateEquipmentList(fn){
  const homes=snapshot.homes.map(h=>{
    if(h.id!==snapshot.activeHomeId)return h;
    const equipment=fn(h.equipment);
    const active=equipment.filter(d=>d.status==='owned');
    const battery=active.filter(d=>d.type==='battery').reduce((n,d)=>n+d.rating,0);
    const solar=active.filter(d=>d.type==='solar').reduce((n,d)=>n+d.rating,0);
    const profile={...h.profile,batteryCapacityKwh:Math.max(0.001,Math.min(1000,battery)),solarCapacityKw:Math.min(1000,solar)};
    return {...h,equipment,profile};
  });
  return persist({...snapshot,homes});
}
export function addEquipment(fields){
  const item=sanitizeEquipment({...fields,id:makeId()});
  updateEquipmentList(list=>{if(list.length>=50)throw new Error('A home may have up to 50 listed devices.');return [...list,item]});
  return item;
}
export function editEquipment(id,fields){
  let found=false;
  updateEquipmentList(list=>list.map(item=>{if(item.id!==id)return item;found=true;return sanitizeEquipment({...item,...fields,id})}));
  if(!found)throw new Error('Equipment not found.');
}
export function removeEquipment(id){updateEquipmentList(list=>list.filter(item=>item.id!==id));}
/** Dynamic demo utility bill estimates for whichever home is active. */
export function getProfiledUtilities(profile=activeProfile){
  const shared=profile===activeProfile?dashboardForHome(snapshot.activeHomeId):null;
  return UTILITIES.map((u)=>{
    const label=profile[`${u.id}Provider`];
    const provider=label&&label!=='Not connected'?`${label} · demo only`:u.provider;
    const b=shared?.billing.find(x=>x.utility===u.id);
    if(b){
      const readingRows=shared.readings.filter(r=>r.utility===u.id);
      const variable=b.variableCostUsd;
      return {...u,provider,usage:b.quantity,monthly:b.totalCostUsd,
        billBreakdown:[[u.billBreakdown[0][0],variable],['Illustrative fixed fees',b.fixedCostUsd]],
        activity:b.bills.map(x=>x.quantity),trend:b.bills.map(x=>x.totalCostUsd),
        months:b.bills.map(x=>x.endDate.slice(5)),bills:b.bills,readings:readingRows,
        source:b.source,periodLabel:b.startDate?`${b.startDate} – ${b.endDate}`:'No imported history',daysAvailable:b.daysAvailable,
        unitRateUsd:b.quantity>0&&variable!=null?variable/b.quantity:null,
        insightReport:shared.report.utilities.find(x=>x.utility===u.id)};
    }
    if(u.id!=='electricity')return {...u,provider};
    const rate=u.billBreakdown[0][1]/u.usage;
    const variable=+(rate*profile.monthlyElectricKwh).toFixed(2);
    const fixed=+(u.monthly-u.billBreakdown[0][1]).toFixed(2);
    return {...u,usage:profile.monthlyElectricKwh,monthly:+(variable+fixed).toFixed(2),provider,
      billBreakdown:[[u.billBreakdown[0][0],variable],...u.billBreakdown.slice(1)],
      activity:u.activity.map(v=>Math.round(v*profile.monthlyElectricKwh/u.usage)),
      trend:u.trend.map(v=>+(Math.max(0,v-u.billBreakdown[0][1])+variable).toFixed(2))};
  });
}
export const getProfiledUtility=(profile,id)=>getProfiledUtilities(profile).find(u=>u.id===id);
