import {useEffect,useState} from 'react';
export function readRoute(){
  try{return decodeURIComponent(window.location.hash.replace(/^#\/?/,'' )).split('/').filter(Boolean)}catch{return []}
}
export function useSection(page,allowed,fallback){
  const read=()=>{const r=readRoute();return r[0]===page&&allowed.includes(r[1])?r[1]:fallback};
  const [section,setSection]=useState(read);
  useEffect(()=>{const sync=()=>setSection(read());window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[page,allowed.join('|'),fallback]);
  const choose=id=>{if(allowed.includes(id)){setSection(id);window.location.hash=`/${page}/${id}`}};
  return [section,choose];
}
