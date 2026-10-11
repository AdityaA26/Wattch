// A single snapshot, scoped to one active browser home. No credentials live here.
let snapshot={homeId:null,status:'loading',data:null,energy:null,energyStatus:'loading',error:'',energyError:''};
const listeners=new Set();
export const getDashboardSnapshot=()=>snapshot;
export const subscribeDashboard=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
export function setDashboardSnapshot(patch){snapshot={...snapshot,...patch};listeners.forEach(fn=>fn());}
export function dashboardForHome(id){return snapshot.homeId===id?snapshot.data:null;}
