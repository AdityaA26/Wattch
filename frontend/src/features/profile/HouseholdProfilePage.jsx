import {useEffect,useState} from 'react';
import {DEFAULT_PROFILE, useHouseholdProfile, useHouseholds, selectHousehold, addHousehold, deleteHousehold, saveHouseholdProfile, resetHouseholdProfile} from '../../state/householdProfile.js';
import './householdProfile.css';

const N = ({children}) => <span className="hp-help">{children}</span>;
const money = n => Number(n).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
function Field({label,help,children}){return <label className="hp-field"><span className="hp-field-label">{label}</span>{children}{help && <N>{help}</N>}</label>}
function Section({number,title,description,children}){return <section className="hp-card"><div className="hp-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div><div className="hp-fields">{children}</div></section>}
function TextField({draft,setDraft,name,...props}){return <input {...props} value={draft[name] ?? ''} onChange={e=>setDraft(p=>({...p,[name]:e.target.value}))}/>}
function NumberField({draft,setDraft,name,unit,...props}){return <div className="hp-input-unit"><input type="number" {...props} value={draft[name] ?? ''} onChange={e=>setDraft(p=>({...p,[name]:e.target.value}))}/>{unit && <span>{unit}</span>}</div>}

export default function HouseholdProfilePage({onNavigate}){
  const profile=useHouseholdProfile();
  const households=useHouseholds();
  const [draft,setDraft]=useState(profile);
  const [notice,setNotice]=useState('');
  const [locationQuery,setLocationQuery]=useState('');
  const [locationResults,setLocationResults]=useState([]);
  const [locating,setLocating]=useState(false);
  const [searched,setSearched]=useState(false);
  useEffect(()=>{setDraft(profile)},[profile]);
  const change=(name,value)=>setDraft(p=>({...p,[name]:value}));
  const dirty=JSON.stringify(draft)!==JSON.stringify(profile);
  const checkUnsaved=()=>!dirty||window.confirm('You have unsaved edits. Switch homes without saving?');
  function chooseHome(id){if(!checkUnsaved())return;selectHousehold(id);setNotice('Switched homes. The left sidebar and top-right label now reflect the selected home.');}
  function createHome(){if(!checkUnsaved())return;try{addHousehold();setNotice('New home created. Edit its name, city, and equipment.');}catch(err){setNotice(err.message)}}
  function removeHome(){if(households.homes.length<2)return;if(!window.confirm(`Delete ${profile.homeName} from this browser? This cannot be undone.`))return;try{deleteHousehold(households.activeHomeId);setNotice('Home removed. Switched to another home.')}catch(err){setNotice(err.message)}}
  async function lookupLocation(){
    if(!locationQuery.trim())return;
    setLocating(true);setSearched(true);setLocationResults([]);setNotice('');
    try{
      const url=`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({name:locationQuery.trim(),count:'10',language:'en',format:'json',countryCode:'US'})}`;
      const response=await fetch(url);if(!response.ok)throw new Error(`Location lookup returned ${response.status}`);
      const data=await response.json();setLocationResults((data.results||[]).filter(r=>Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)));
    }catch(err){setNotice(`Location lookup unavailable (${err.message}). You can update the coordinates manually below.`);}
    finally{setLocating(false)}
  }
  const chooseLocation=(place)=>{
    setDraft(p=>({...p,city:place.name,state:place.admin1||p.state,latitude:place.latitude,longitude:place.longitude,timezone:place.timezone||p.timezone}));
    setLocationResults([]);setSearched(false);setNotice(`Location set to ${place.name}, ${place.admin1||''}. Save changes to apply forecasts.`);
  };
  function save(e){
    e.preventDefault();
    if(!String(draft.homeName||'').trim() || !String(draft.city||'').trim()){setNotice('Enter a household name and a city.');return;}
    if(!Number.isFinite(Number(draft.latitude))||!Number.isFinite(Number(draft.longitude))||Number(draft.latitude)<-90||Number(draft.latitude)>90||Number(draft.longitude)<-180||Number(draft.longitude)>180){setNotice('Enter a valid forecast latitude and longitude.');return;}
    if(Object.entries(draft).some(([key,v])=>typeof DEFAULT_PROFILE[key]==='number' && (v===''||!Number.isFinite(Number(v))))){setNotice('Complete all numeric fields with valid numbers.');return;}
    try{saveHouseholdProfile(draft);setNotice('Saved! Home, Electricity and Weather now use this demo household configuration.');}
    catch(err){setNotice(err.message)}
  }
  function reset(){if(!window.confirm('Reset the demo home, location and energy settings to their defaults?'))return;try{resetHouseholdProfile();setLocationResults([]);setNotice('Demo household reset to defaults.')}catch(e){setNotice(e.message)}}
  const fmt=n=>Number(n||0);
  const monthlyKwh=fmt(draft.monthlyElectricKwh);
  const batteryKwh=fmt(draft.batteryCapacityKwh);
  const soc=fmt(draft.startingSocPct);
  const reserve=fmt(draft.backupReservePct);
  const solarKw=fmt(draft.solarCapacityKw);
  const usable=Math.max(0,batteryKwh*(soc-reserve)/100);
  const estimatedKwhDaily=monthlyKwh/30;
  const backupHours=estimatedKwhDaily?Math.max(0,(batteryKwh*soc/100))/Math.max(0.1,estimatedKwhDaily/24):0;
  return <main className="hp-page">
    <div className="hp-breadcrumb">YOUR HOME <span>/</span> MY HOME PROFILE</div>
    <div className="hp-heading"><div><h1>Your home, your energy.</h1><p>Manage multiple homes, customize their forecast settings, and track your Wattch equipment.</p></div><div className="hp-heading-actions"><button type="submit" form="hp-profile-form" className="hp-save">Save changes</button><button type="button" className="hp-link-button" onClick={()=>onNavigate('equipment')}>My equipment →</button></div></div>
    <section className="hp-homes-section" aria-label="Manage homes"><div className="hp-homes-heading"><div><strong>My homes</strong><p>Select a property to update its own settings, equipment and forecasts.</p></div><button className="hp-secondary" type="button" onClick={createHome}>+ Add home</button></div><div className="hp-homes-list">{households.homes.map(h=><button className={`hp-home-option ${h.id===households.activeHomeId?'hp-selected':''}`} key={h.id} type="button" onClick={()=>chooseHome(h.id)}><strong>{h.profile.homeName}</strong><small>{h.profile.city}, {h.profile.state}</small>{h.id===households.activeHomeId&&<span>ACTIVE</span>}</button>)}</div>{households.homes.length>1&&<button type="button" className="hp-danger-text" onClick={removeHome}>Remove selected home</button>}</section>
    {dirty&&<div className="hp-unsaved" role="status">You have unsaved edits. The household preview below updates immediately, but the sidebar and top-right name update after you click <strong>Save changes</strong>.</div>}
    <div className="hp-demo-notice"><span className="hp-notice-dot"/> <div><strong>Local demo profile</strong> · Saved in this browser only. No utility credentials, real meter access or real payments. For privacy, avoid entering a street address.</div></div>
    <div className="hp-layout">
      <form id="hp-profile-form" className="hp-main" onSubmit={save}>
        <Section number="01" title="Household" description="Information that changes energy planning assumptions.">
          <Field label="Household nickname"><TextField draft={draft} setDraft={setDraft} name="homeName" maxLength="55" required placeholder="Beach House"/></Field>
          <Field label="Home type"><select value={draft.homeType} onChange={e=>change('homeType',e.target.value)}><option>Single-family</option><option>Townhouse</option><option>Apartment</option><option>Small business</option></select></Field>
          <Field label="Floor area"><NumberField draft={draft} setDraft={setDraft} name="squareFeet" min="200" max="20000" step="50" unit="sq ft"/></Field>
          <Field label="Occupants"><NumberField draft={draft} setDraft={setDraft} name="occupants" min="1" max="25" step="1" unit="people"/></Field>
        </Section>
        <Section number="02" title="Weather location" description="Use a city lookup to choose coordinates for live weather and NWS alerts.">
          <div className="hp-full"><label className="hp-field-label" htmlFor="hp-location-search">Find a city in the United States</label><div className="hp-inline"><input id="hp-location-search" value={locationQuery} onChange={e=>setLocationQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();lookupLocation()}}} placeholder="Search Columbia, Lexington, Charlotte..."/><button type="button" className="hp-secondary" disabled={locating} onClick={lookupLocation}>{locating?'Searching…':'Find location'}</button></div>
          {locationResults.length>0&&<div className="hp-locations">{locationResults.map(place=><button key={`${place.id}-${place.latitude}`} type="button" onClick={()=>chooseLocation(place)}>{place.name}, {place.admin1} <small>{place.latitude.toFixed(3)}, {place.longitude.toFixed(3)}</small></button>)}</div>}
          {searched&&!locating&&!locationResults.length&&<N>If no city appears, use coordinates below. Location lookup uses Open-Meteo geocoding.</N>}</div>
          <Field label="City"><TextField draft={draft} setDraft={setDraft} name="city" required/></Field>
          <Field label="State"><TextField draft={draft} setDraft={setDraft} name="state"/></Field>
          <Field label="ZIP (display only)"><TextField draft={draft} setDraft={setDraft} name="zip" inputMode="numeric" maxLength="10"/></Field>
          <Field label="Timezone"><select value={draft.timezone} onChange={e=>change('timezone',e.target.value)}>{['America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'].map(z=><option key={z} value={z}>{z.replaceAll('_',' ')}</option>)}</select></Field>
          <Field label="Forecast latitude"><NumberField draft={draft} setDraft={setDraft} name="latitude" min="-90" max="90" step="0.0001"/></Field>
          <Field label="Forecast longitude"><NumberField draft={draft} setDraft={setDraft} name="longitude" min="-180" max="180" step="0.0001"/></Field>
          <div className="hp-full hp-note">Changing the city or ZIP text alone does not move the weather forecast. Use <strong>Find location</strong> or update latitude and longitude too. Columbia-specific water notices remain Columbia-specific.</div>
        </Section>
        <Section number="03" title="Energy setup" description="One configuration to inform Electricity, Weather and future Insights.">
          <Field label="Monthly electricity"><NumberField draft={draft} setDraft={setDraft} name="monthlyElectricKwh" min="0" max="20000" step="25" unit="kWh"/></Field>
          <Field label="Household budget"><NumberField draft={draft} setDraft={setDraft} name="monthlyBudgetUsd" min="0" max="100000" step="10" unit="USD/mo"/></Field>
          <Field label="Installed battery capacity"><div className="hp-readonly">{Number(draft.batteryCapacityKwh).toFixed(1)} kWh <small>Managed in My equipment</small></div></Field>
          <Field label="Current battery charge"><NumberField draft={draft} setDraft={setDraft} name="startingSocPct" min="0" max="100" step="1" unit="%"/></Field>
          <Field label="Backup reserve"><NumberField draft={draft} setDraft={setDraft} name="backupReservePct" min="0" max="100" step="5" unit="%"/></Field>
          <Field label="Installed solar capacity"><div className="hp-readonly">{Number(draft.solarCapacityKw).toFixed(1)} kW <small>Managed in My equipment</small></div></Field>
          <Field label="Max battery charge/discharge"><NumberField draft={draft} setDraft={setDraft} name="maxBatteryPowerKw" min="0.1" max="500" step="0.5" unit="kW"/></Field>
          <div className="hp-full hp-note">Battery and solar capacity comes from the devices listed under <button type="button" className="hp-inline-link" onClick={()=>onNavigate('equipment')}>My equipment</button>. Actual hardware is not connected; dispatch, tariffs and readings are demo simulations.</div>
        </Section>
        <Section number="04" title="Utility providers" description="Optional display labels only; no provider authentication or account linking.">
          {['electricity','water','gas','internet','waste'].map(type=><Field key={type} label={`${type[0].toUpperCase()+type.slice(1)} provider`}><TextField draft={draft} setDraft={setDraft} name={`${type}Provider`} maxLength="65" placeholder="Not connected"/></Field>)}
        </Section>
        <div className="hp-actions"><button type="submit" className="hp-save">Save household profile</button><button type="button" className="hp-secondary" onClick={()=>onNavigate('equipment')}>Manage equipment</button><button type="button" className="hp-secondary" onClick={reset}>Reset selected home</button></div>
        {notice&&<p role="status" className="hp-feedback">{notice}</p>}
      </form>
      <aside className="hp-summary"><div className="hp-summary-hero"><span>HOUSEHOLD PREVIEW {dirty?'· UNSAVED':''}</span><h2>{draft.homeName||'My home'}</h2><p>{draft.city||'City'}, {draft.state||'State'}</p><div className="hp-summary-divider"/><div className="hp-mini-row"><span>Monthly electricity</span><b>{monthlyKwh.toLocaleString()} kWh</b></div><div className="hp-mini-row"><span>Solar capacity</span><b>{solarKw.toFixed(1)} kW</b></div><div className="hp-mini-row"><span>Battery capacity</span><b>{batteryKwh.toFixed(1)} kWh</b></div></div>
        <div className="hp-summary-card"><span>Usable battery energy above reserve</span><strong>{usable.toFixed(1)} kWh</strong><p>Based on starting charge of {soc}% and protected reserve of {reserve}%.</p><div className="hp-meter"><span style={{width:`${Math.max(0,Math.min(100,soc))}%`}}/></div></div>
        <div className="hp-summary-card"><span>Illustrative backup duration</span><strong>{backupHours.toFixed(1)} hours</strong><p>Rough whole-home average demand estimate. Real emergency loads and inverter limits may differ significantly.</p></div>
        <div className="hp-summary-card"><span>Budget target</span><strong>{money(draft.monthlyBudgetUsd)}</strong><p>Used by your Home dashboard budget comparison.</p></div>
        <div className="hp-summary-links"><button type="button" onClick={()=>onNavigate('electricity')}>Open Electricity ↗</button><button type="button" onClick={()=>onNavigate('weather')}>Open Weather ↗</button></div>
      </aside>
    </div>
  </main>;
}
