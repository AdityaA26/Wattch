import { useEffect, useState } from 'react';
import ForecastLivePage from '../features/forecast/ForecastLivePage.jsx';
import './wattchApp.css';
import { UTILITIES } from '../data/utilityData.js';
import { HomePage, UtilityOverviewPage, UtilityDetailPage, ConnectUtilityPage } from '../features/utilities/UtilityPages.jsx';
import HouseholdProfilePage from '../features/profile/HouseholdProfilePage.jsx';
import {useHouseholdProfile,useHouseholds,selectHousehold,addHousehold} from '../state/householdProfile.js';
import EquipmentPage from '../features/profile/EquipmentPage.jsx';
import VacationPage, { VacationSummaryStrip } from '../features/vacation/VacationPage.jsx';
import { useVacationMode, toggleVacationMode, calculateVacation } from '../state/vacationMode.js';

// One shared app shell: sidebar, topbar, and navigable pages.
// The Weather feature keeps its own page and existing live API connection.
const MAIN_PAGES = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'utilities', label: 'Utilities', icon: 'grid' },
  { id: 'insights', label: 'Insights', icon: 'sparkle' },
  { id: 'weather', label: 'Weather', icon: 'cloud' },
  { id: 'equipment', label: 'My equipment', icon: 'bolt' },
];
const UTILITY_PAGES = UTILITIES;
const ALL_IDS = new Set([...MAIN_PAGES, ...UTILITY_PAGES, { id: 'connect' }, { id: 'settings' }, { id: 'vacation' }].map((p) => p.id));
function pageFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(2));
  return ALL_IDS.has(id) ? id : 'home';
}

function Icon({ name, size = 17 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const icons = {
    home: <><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></>,
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
    sparkle: <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z"/></>,
    cloud: <path d="M19.5 18H6.7A4.7 4.7 0 0 1 6 8.7 7 7 0 0 1 19.4 10a4 4 0 0 1 .1 8Z"/>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>,
    droplet: <path d="M12 2c-2.5 4.2-7 9.3-7 13a7 7 0 0 0 14 0c0-3.7-4.5-8.8-7-13Z"/>,
    flame: <path d="M12 22a8 8 0 0 0 8-8c0-4-2-6.5-5-9-.1 3-1.5 4-2.5 4.4-.2-3-2-5.6-3.5-7.4C9 8 4 10.4 4 15a8 8 0 0 0 8 7Z"/>,
    wifi: <><path d="M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m4 0-.7 14H5.7L5 7M10 11v6m4-6v6"/></>,
    plus: <path d="M12 4v16M4 12h16"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    search: <><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    close: <path d="M5 5l14 14M19 5 5 19"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></>,
    leaf: <><path d="M5 20c-2-7.5 3-14 14-16 0 11-5 18-14 16Z"/><path d="M6 19c2-5 6-8 10-11"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg {...props}>{icons[name] || icons.grid}</svg>;
}

function FuturePage({ page, onNavigate }) {
  const isInsights = page === 'insights';
  return <main className="wapp-placeholder">
    <div className="wapp-crumb">YOUR HOME <span>/</span> {isInsights ? 'INSIGHTS' : 'SETTINGS'}</div>
    <div className="wapp-placeholder-head"><h1>{isInsights ? 'Insights, made useful.' : 'Your preferences.'}</h1>
      <p>{isInsights ? 'Savings, forecasts and helpful explanations in one place.' : 'Manage your Wattch experience.'}</p></div>
    <div className="wapp-empty-card">
      <span className="wapp-empty-icon"><Icon name={isInsights ? 'sparkle' : 'settings'} size={27}/></span>
      <div className="wapp-eyebrow">TEAM INTEGRATION</div>
      <h2>{isInsights ? 'Savings & AI is being built.' : 'Settings will be configured later.'}</h2>
      <p>{isInsights ? 'The Person 4 feature will go here after their branch is merged. No chatbot or savings data has been connected to this page yet.' : 'Account preferences and authentication have not been implemented in this demo.'}</p>
      <button type="button" onClick={() => onNavigate('utilities')}>Explore utilities <Icon name="arrow" size={16}/></button>
    </div>
  </main>;
}

export default function WattchApp() {
  const profile = useHouseholdProfile();
  const households=useHouseholds();
  const [propertyOpen,setPropertyOpen]=useState(false);
  const [propertyMessage,setPropertyMessage]=useState('');
  const [active, setActive] = useState(pageFromHash);
  const [paymentsByHome,setPaymentsByHome]=useState(()=>{
    try{const stored=JSON.parse(window.localStorage.getItem('wattch-demo-payments-by-home-v1')||'null');
      if(stored&&typeof stored==='object')return stored;
      const legacy=JSON.parse(window.localStorage.getItem('wattch-demo-payments-v1')||'{}');
      return {'home-default':legacy};
    }catch{return {}}
  });
  const paidBills=paymentsByHome[households.activeHomeId]||{};
  const onDemoPay=(id)=>setPaymentsByHome(prev=>{
    const next={...prev,[households.activeHomeId]:{...(prev[households.activeHomeId]||{}),[id]:true}};
    try{window.localStorage.setItem('wattch-demo-payments-by-home-v1',JSON.stringify(next))}catch{}
    return next;
  });
  const chooseHome=(id)=>{selectHousehold(id);setPropertyOpen(false);setPropertyMessage('');};
  const createHome=()=>{try{addHousehold();setPropertyOpen(false);navigate('settings');setPropertyMessage('');}catch(e){setPropertyMessage(e.message)}};
  useEffect(() => { const sync = () => setActive(pageFromHash()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const vacation = useVacationMode();
  const vacationEstimate = calculateVacation(profile, vacation.plan);
  const navigate = (id) => { if (!ALL_IDS.has(id)) return; window.location.hash = `/${id}`; setActive(id); setMobileOpen(false); setSearchOpen(false); setPropertyOpen(false); setSearch(''); window.scrollTo({top:0,behavior:'auto'}); };
  const pageOptions = [...MAIN_PAGES,...UTILITY_PAGES,{id:'connect',label:'Connect utility',icon:'plus'},{id:'settings',label:'Settings',icon:'settings'},{id:'vacation',label:'Vacation Mode',icon:'leaf'}];
  const searchItems = pageOptions.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="wapp-root">
    {mobileOpen && <button type="button" className="wapp-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}
    <aside className={`wapp-sidebar ${mobileOpen ? 'wapp-sidebar-open' : ''}`} aria-label="Main navigation">
      <div className="wapp-brand"><span className="wapp-brand-mark"><Icon name="leaf" size={16}/></span><span>WATTCH</span><button type="button" className="wapp-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><Icon name="close" size={18}/></button></div>
      <div className="wapp-property-wrap"><button type="button" className="wapp-property" aria-expanded={propertyOpen} aria-label="Choose household" onClick={()=>setPropertyOpen(v=>!v)}><span className="wapp-property-icon"><Icon name="home" size={17}/></span><span><strong>{profile.homeName}</strong><small>{profile.city}, {profile.state}</small></span><Icon name="chevron" size={15}/></button>
      {propertyOpen&&<div className="wapp-house-menu"><span className="wapp-house-menu-label">YOUR HOMES</span>{households.homes.map(h=><button key={h.id} type="button" onClick={()=>chooseHome(h.id)} className={h.id===households.activeHomeId?'selected':''}><Icon name="home" size={15}/><span><b>{h.profile.homeName}</b><small>{h.profile.city}, {h.profile.state}</small></span>{h.id===households.activeHomeId&&<Icon name="check" size={15}/>}</button>)}<div className="wapp-house-menu-footer"><button type="button" onClick={createHome}><Icon name="plus" size={15}/> Add another home</button><button type="button" onClick={()=>navigate('settings')}><Icon name="settings" size={15}/> Manage homes</button></div>{propertyMessage&&<small className="wapp-property-error">{propertyMessage}</small>}</div>}</div>
      <nav className="wapp-nav" aria-label="Pages">
        {MAIN_PAGES.map((item) => <button key={item.id} type="button" className={`wapp-nav-link ${active === item.id ? 'wapp-is-active' : ''}`} aria-current={active === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon} size={16}/><span>{item.label}</span></button>)}
      </nav>
      <div className="wapp-sidebar-label">YOUR UTILITIES</div>
      <nav className="wapp-utility-nav" aria-label="Utility categories">
        {UTILITY_PAGES.map((item) => <button key={item.id} type="button" className={`wapp-utility-link ${active === item.id ? 'wapp-utility-active' : ''}`} aria-current={active === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><span className="wapp-utility-dot" style={{backgroundColor:item.color}}/><span>{item.label}</span></button>)}
        <button type="button" className={`wapp-connect ${active === 'connect' ? 'wapp-utility-active' : ''}`} onClick={() => navigate('connect')}><Icon name="plus" size={15}/>Connect utility</button>
      </nav>
      <div className="wapp-sidebar-bottom">

        <div className="wapp-vacation">
          <div className="wapp-vacation-top"><span className="wapp-vacation-symbol"><Icon name="leaf" size={14}/></span>
            <button type="button" role="switch" aria-checked={vacation.plan.enabled && ['active','scheduled'].includes(vacation.status)}
              className={`wapp-switch ${vacation.plan.enabled && ['active','scheduled'].includes(vacation.status) ? 'wapp-switch-on' : ''}`}
              onClick={() => { try { toggleVacationMode(!(vacation.plan.enabled && ['active','scheduled'].includes(vacation.status))); } catch (e) { window.alert(e.message); } }}
              aria-label="Toggle simulated Vacation Mode"><span/></button></div>
          <strong>Vacation mode</strong>
          <small>{vacation.status === 'active' ? `${vacationEstimate.protectedReservePct}% reserve · ${vacationEstimate.avoidedKwh.toFixed(0)} kWh less energy (demo)` : vacation.status === 'scheduled' ? `Scheduled for ${vacation.plan.startDate}` : 'Plan energy use while you’re away.'}</small>
          <button type="button" className="wapp-vacation-plan" onClick={() => navigate('vacation')}>Plan trip →</button>
        </div>
        <button className={`wapp-settings ${active === 'settings' ? 'wapp-settings-active' : ''}`} onClick={() => navigate('settings')} type="button"><Icon name="settings" size={16}/>Settings</button>
      </div>
    </aside>
    <div className="wapp-workspace">
      <header className="wapp-topbar">
        <div className="wapp-topbar-left"><button type="button" className="wapp-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Icon name="menu" size={20}/></button><span className="wapp-weather-mini"><Icon name="sun" size={16}/> {profile.city}, {profile.state} <span className="wapp-separator">·</span> Energy planning</span></div>
        <div className="wapp-topbar-right">
          {searchOpen && <div className="wapp-search-popover"><input aria-label="Search Wattch pages" value={search} onChange={e=>setSearch(e.target.value)} autoFocus placeholder="Find a page..."/><div className="wapp-search-results">{searchItems.length ? searchItems.map(item=><button type="button" key={item.id} onClick={()=>navigate(item.id)}><Icon name={item.icon} size={15}/>{item.label}</button>) : <p>No matching pages</p>}</div></div>}
          <button type="button" className="wapp-top-icon" aria-label="Search pages" aria-expanded={searchOpen} onClick={() => {setSearchOpen(x=>!x);setSearch('')}}><Icon name="search" size={17}/></button>
          <div className="wapp-profile"><span className="wapp-avatar">{profile.homeName.slice(0,2).toUpperCase()}</span><span><strong>{profile.homeName}</strong><small>Demo household</small></span></div>
        </div>
      </header>
      <div className="wapp-view" id="wattch-main">{active !== 'vacation' && <VacationSummaryStrip onNavigate={navigate}/>} {active === 'vacation' ? <VacationPage key={households.activeHomeId} onNavigate={navigate}/> : active === 'weather' ? <ForecastLivePage key={households.activeHomeId}/> : active === 'home' ? <HomePage key={households.activeHomeId} onNavigate={navigate} paidBills={paidBills}/> : active === 'utilities' ? <UtilityOverviewPage key={households.activeHomeId} onNavigate={navigate}/> : UTILITY_PAGES.some(item=>item.id===active) ? <UtilityDetailPage key={`${households.activeHomeId}-${active}`} utilityId={active} onNavigate={navigate} paidBills={paidBills} onDemoPay={onDemoPay}/> : active === 'connect' ? <ConnectUtilityPage onNavigate={navigate}/> : active === 'settings' ? <HouseholdProfilePage onNavigate={navigate}/> : active === 'equipment' ? <EquipmentPage onNavigate={navigate}/> : <FuturePage page={active} onNavigate={navigate}/>}</div>
    </div>
  </div>;
}
