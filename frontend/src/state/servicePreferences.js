/** Per-home local demo preferences; reminders appear only inside the app. */
import {useSyncExternalStore} from 'react';
const KEY='wattch-service-preferences-v1';
let state=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}})();
const listeners=new Set();
const SERVER_SNAPSHOT=Object.freeze({});
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
export const useServicePreferences=()=>useSyncExternalStore(subscribe,()=>state,()=>SERVER_SNAPSHOT);
export function saveServicePreferences(homeId,key,patch){const before=state[homeId]||{};state={...state,[homeId]:{...before,[key]:{...(before[key]||{}),...patch}}};localStorage.setItem(KEY,JSON.stringify(state));listeners.forEach(fn=>fn())}
