import {useEffect,useState,useSyncExternalStore} from 'react';
import {useHouseholdProfile,useHouseholds} from './householdProfile.js';
import {api,backendProfile} from '../features/insights/insightsApi.js';
import {getVacationForHome,vacationStatus} from './vacationMode.js';
import {getDashboardSnapshot,subscribeDashboard,setDashboardSnapshot} from './dashboardSnapshot.js';

export const useHouseholdData=()=>useSyncExternalStore(subscribeDashboard,getDashboardSnapshot,getDashboardSnapshot);
let planSequence=0;
export async function refreshEnergy(options={}){
  const snap=getDashboardSnapshot();
  if(!snap.data)return;
  const seq=++planSequence;
  const trip=getVacationForHome(snap.homeId),away=vacationStatus(trip)==='active'?{awayUsagePct:trip.awayUsagePct,vacationReservePct:trip.reservePct}:{};
  setDashboardSnapshot({energyStatus:'loading',energyError:''});
  try{
    const result=await api('/api/household/plan',{body:{householdId:snap.data.householdId,profile:snap.data.profile,...options,...away}});
    if(seq===planSequence&&getDashboardSnapshot().homeId===snap.homeId)setDashboardSnapshot({energy:result,energyStatus:'ready'});
  }catch(err){
    if(seq===planSequence&&getDashboardSnapshot().homeId===snap.homeId)setDashboardSnapshot({energy:null,energyStatus:'error',energyError:err.message});
  }
}
export default function HouseholdDataProvider({children}){
  const profile=useHouseholdProfile(),households=useHouseholds();
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const update=()=>refreshEnergy();window.addEventListener('wattch-vacation-change',update);return()=>window.removeEventListener('wattch-vacation-change',update)},[]);
  useEffect(()=>{const reload=()=>setRevision(v=>v+1);window.addEventListener('wattch-refresh-data',reload);return()=>window.removeEventListener('wattch-refresh-data',reload)},[]);
  useEffect(()=>{
    const controller=new AbortController();
    ++planSequence;
    setDashboardSnapshot({homeId:households.activeHomeId,status:'loading',data:null,energy:null,energyStatus:'loading',error:'',energyError:''});
    api('/api/household/dashboard',{body:{profile:backendProfile(profile,households.activeHomeId),monthlyElectricKwh:profile.monthlyElectricKwh,initializeDemo:true},signal:controller.signal})
      .then(data=>{if(controller.signal.aborted)return;setDashboardSnapshot({data,status:'ready'});refreshEnergy();})
      .catch(err=>{if(!controller.signal.aborted)setDashboardSnapshot({status:'error',error:err.message});});
    return()=>controller.abort();
  },[profile,households.activeHomeId,revision]);
  return children;
}
