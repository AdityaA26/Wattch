/** Browser-only household member mockup. NOT real identity, invitations, or authorization. */
import {useSyncExternalStore} from 'react';
const KEY='wattch-member-directory-demo-v1';
const BASE={owner:{name:'Demo Owner',email:'owner@example.test'},membersByHome:{}};
function load(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return value&&typeof value==='object'?{
 owner:{name:String(value.owner?.name||BASE.owner.name).slice(0,60),email:String(value.owner?.email||BASE.owner.email).slice(0,120)},
 membersByHome:value.membersByHome&&typeof value.membersByHome==='object'?value.membersByHome:{}}:BASE;}catch{return BASE}}
let state=typeof window==='undefined'?BASE:load();
const listeners=new Set();
function publish(next){localStorage.setItem(KEY,JSON.stringify(next));state=next;for(const cb of listeners)cb();}
function subscribe(cb){listeners.add(cb);return()=>listeners.delete(cb)}
export function useHouseholdAccess(){return useSyncExternalStore(subscribe,()=>state,()=>BASE)}
export function changeAccountOwner(name,email){const n=String(name||'').trim(),e=String(email||'').trim().toLowerCase();if(!n||n.length>60||!/^\S+@\S+\.\S+$/.test(e))throw Error('Enter a valid owner name and email.');publish({...state,owner:{name:n,email:e}})}
export function addHouseholdMember(homeId,name,email,role='Member'){
 const n=String(name||'').trim(),e=String(email||'').trim().toLowerCase();
 if(!n||n.length>60||!/^\S+@\S+\.\S+$/.test(e))throw Error('Enter a name and valid email.');
 if(!['Member','Viewer','Manager'].includes(role))throw Error('Invalid demo role.');
 const previous=Array.isArray(state.membersByHome[homeId])?state.membersByHome[homeId]:[];
 if(previous.length>=20)throw Error('Maximum 20 sample members per home.');
 if(e===state.owner.email.toLowerCase()||previous.some(m=>m.email===e))throw Error('That email is already listed for this home.');
 const member={id:`member-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:n,email:e,role,status:'Example only — no invitation sent'};
 publish({...state,membersByHome:{...state.membersByHome,[homeId]:[...previous,member]}});
}
export function removeHouseholdMember(homeId,id){const prev=state.membersByHome[homeId]||[];publish({...state,membersByHome:{...state.membersByHome,[homeId]:prev.filter(m=>m.id!==id)}})}
export function changeHouseholdRole(homeId,id,role){if(!['Member','Viewer','Manager'].includes(role))throw Error('Invalid role');const prev=state.membersByHome[homeId]||[];publish({...state,membersByHome:{...state.membersByHome,[homeId]:prev.map(m=>m.id===id?{...m,role}:m)}})}
