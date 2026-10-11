import {useState} from 'react';
import {useHouseholdProfile,useActiveEquipment,addEquipment,editEquipment,removeEquipment} from '../../state/householdProfile.js';
import './equipmentPage.css';

const labels={battery:'Battery',breaker:'Smart breaker panel',solar:'Solar system'};
const units={battery:'kWh',breaker:'circuits',solar:'kW'};
const fresh={type:'battery',name:'',manufacturer:'Wattch',model:'',rating:13.5,status:'owned'};
const fmt=(number)=>Number(number||0).toLocaleString('en-US',{maximumFractionDigits:1});
export default function EquipmentPage({onNavigate}){
  const profile=useHouseholdProfile();
  const equipment=useActiveEquipment();
  const [form,setForm]=useState(null);
  const [message,setMessage]=useState('');
  const battery=equipment.filter(x=>x.type==='battery'&&x.status==='owned').reduce((n,x)=>n+x.rating,0);
  const solar=equipment.filter(x=>x.type==='solar'&&x.status==='owned').reduce((n,x)=>n+x.rating,0);
  const panels=equipment.filter(x=>x.type==='breaker'&&x.status==='owned').length;
  const openAdd=(type='battery')=>{setForm({...fresh,type,rating:type==='breaker'?12:type==='solar'?5:13.5});setMessage('');};
  function submit(e){
    e.preventDefault();
    if(!form?.name?.trim()){setMessage('Please enter a device name.');return;}
    if(!Number.isFinite(Number(form.rating))||Number(form.rating)<0){setMessage('Enter a nonnegative capacity or circuit count.');return;}
    try{
      if(form.id)editEquipment(form.id,{...form,rating:Number(form.rating)});
      else addEquipment({...form,rating:Number(form.rating)});
      setForm(null);setMessage('Equipment saved. Wattch planning totals are updated.');
    }catch(error){setMessage(error.message);}
  }
  function remove(device){
    if(!window.confirm(`Remove ${device.name} from ${profile.homeName}?`))return;
    try{removeEquipment(device.id);setForm(null);setMessage('Equipment removed from this household only.');}
    catch(error){setMessage(error.message)}
  }
  return <main className="eq-page">
    <div className="eq-kicker">YOUR HOME <span>/</span> EQUIPMENT</div>
    <div className="eq-head"><div><h1>Equipment in your home.</h1><p>Manage the devices used in your Wattch energy simulations for <strong>{profile.homeName}</strong>.</p></div><button type="button" className="eq-secondary" onClick={()=>onNavigate('settings')}>← My Home Profile</button></div>
    <div className="eq-notice">Device details are <strong>self-reported demo information</strong>. Nothing is connected to physical batteries, solar inverters, or electrical panels.</div>
    <div className="eq-stats">
      <div><span>Installed batteries</span><strong>{fmt(battery)} kWh</strong><small>Modeled storage capacity</small></div>
      <div><span>Installed solar</span><strong>{fmt(solar)} kW</strong><small>Modeled solar array</small></div>
      <div><span>Smart breaker panels</span><strong>{panels}</strong><small>Demo inventory only</small></div>
    </div>
    <div className="eq-section-head"><div><h2>My devices</h2><p>{equipment.length} equipment item{equipment.length===1?'':'s'} at this home</p></div><button type="button" className="eq-primary" onClick={()=>openAdd()}>+ Add equipment</button></div>
    {equipment.length===0?<div className="eq-empty"><h3>No devices listed</h3><p>Add your first battery, solar system, or smart breaker panel to personalize the simulation.</p><button className="eq-primary" type="button" onClick={()=>openAdd()}>Add equipment</button></div>:<div className="eq-grid">{equipment.map(item=><article key={item.id} className="eq-card">
      <div className="eq-item-top"><span className={`eq-category eq-${item.type}`}>{item.type==='battery'?'▣':item.type==='solar'?'☼':'⚡'}</span><span className="eq-status">{item.status==='owned'?'Owned · not connected':'Planned'}</span></div>
      <h3>{item.name}</h3><p>{item.manufacturer||'Manufacturer not entered'}{item.model?` · ${item.model}`:''}</p>
      <div className="eq-rating"><strong>{fmt(item.rating)}</strong><span>{units[item.type]}</span></div>
      <div className="eq-card-actions"><button type="button" onClick={()=>{setForm({...item});setMessage('');}}>Edit</button><button type="button" onClick={()=>remove(item)}>Remove</button></div>
    </article>)}</div>}
    <div className="eq-info"><strong>Built for future Wattch hardware</strong><p>Battery capacity and solar size here feed the active household's Weather and Electricity simulations. A real product integration would require authenticated hardware APIs, compatible devices, and safety controls. The breaker panel is an inventory entry—not remote electrical control.</p></div>
    {message&&<p role="status" className="eq-feedback">{message}</p>}
    {form&&<div className="eq-modal-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setForm(null)}}><div className="eq-modal" role="dialog" aria-modal="true" aria-label={form.id?'Edit equipment':'Add equipment'}>
      <div className="eq-modal-title"><div><h2>{form.id?'Edit equipment':'Add equipment'}</h2><p>Saved to {profile.homeName}, in this browser only</p></div><button type="button" className="eq-icon-button" onClick={()=>setForm(null)} aria-label="Close">×</button></div>
      <form onSubmit={submit} className="eq-form">
        <label>Equipment type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value,rating:e.target.value==='breaker'?12:e.target.value==='solar'?5:13.5})}>{Object.entries(labels).map(([type,label])=><option key={type} value={type}>{label}</option>)}</select></label>
        <label>Device name<input required maxLength={70} placeholder="e.g., Garage battery" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>Manufacturer<input maxLength={70} placeholder="e.g., Wattch" value={form.manufacturer} onChange={e=>setForm({...form,manufacturer:e.target.value})}/></label>
        <label>Model<input maxLength={70} placeholder="Optional" value={form.model} onChange={e=>setForm({...form,model:e.target.value})}/></label>
        <label>{form.type==='breaker'?'Number of circuits':`Rated capacity (${units[form.type]})`}<input type="number" min={form.type==='breaker'?'1':'0'} max={form.type==='breaker'?'200':'1000'} step={form.type==='breaker'?'1':'0.1'} required value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})}/></label>
        <label>Installation status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="owned">Owned (not connected to Wattch)</option><option value="planned">Planned / considering</option></select></label>
        <div className="eq-form-actions"><button type="button" className="eq-secondary" onClick={()=>setForm(null)}>Cancel</button><button type="submit" className="eq-primary">Save equipment</button></div>
      </form>
    </div></div>}
  </main>;
}
