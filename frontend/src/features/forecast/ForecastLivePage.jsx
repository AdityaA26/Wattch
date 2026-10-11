'use client';
import { useEffect, useMemo, useState } from 'react';
import { buildForecast, formatHour, WEATHER_SCENARIOS } from './forecastEngine';
import './forecastLive.css';
import {useHouseholdProfile} from '../../state/householdProfile.js';
import {useVacationMode} from '../../state/vacationMode.js';

// Wattch / Weather — a feature page only. Person 1 owns the app shell/sidebar.
// Live inputs: Open-Meteo and NWS, served by components.forecast_api on /api/forecast.
// Modeled inputs: electricity prices, demand, solar output, battery dispatch, savings.

const cents = (value) => `${(Number(value || 0) * 100).toFixed(0)}¢`;
const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const shorten = (value, max = 180) => String(value || '').trim().slice(0, max) + (String(value || '').trim().length > max ? '…' : '');
const titleCase = (value) => String(value || 'normal').replace(/\b\w/g, (letter) => letter.toUpperCase());
const friendlyHour = (iso) => {
  const found = /T(\d\d):/.exec(iso || '');
  return found ? formatHour(Number(found[1])) : '—';
};
const weatherCondition = (code) => {
  if (code >= 95) return 'Thunderstorms';
  if (code >= 71) return 'Snow';
  if (code >= 61) return 'Rain';
  if (code >= 51) return 'Drizzle';
  if (code >= 45) return 'Fog';
  if (code >= 3) return 'Cloudy';
  if (code >= 1) return 'Partly cloudy';
  return 'Clear skies';
};

const toLiveHours = (hours = []) => hours.map((h, index) => ({
  id: h.time || index,
  label: friendlyHour(h.time),
  rate: numeric(h.price_usd_kwh),
  demandKw: numeric(h.demand_estimate_kw),
  solarKw: numeric(h.solar_estimate_kw),
  tempC: numeric(h.temperature_c),
  precipPct: numeric(h.precip_probability_pct),
  cloudsPct: numeric(h.cloud_cover_pct),
  windKmh: numeric(h.wind_kmh),
  weatherCode: numeric(h.weather_code),
  action: h.battery_action || 'HOLD',
  socPct: numeric(h.battery_soc_pct),
  tier: h.price_tier || 'shoulder',
}));

const toDemoHours = (scenario) => buildForecast(scenario).map((h, index) => ({
  ...h, id: `demo-${index}`, tier: h.period === 'Peak' ? 'peak' : h.period === 'Off-peak' ? 'off-peak' : 'shoulder',
  action: h.period === 'Peak' ? 'DISCHARGE' : h.period === 'Off-peak' ? 'CHARGE' : 'HOLD',
  tempC: ((WEATHER_SCENARIOS[scenario]?.temperature ?? 72) - 32) * 5 / 9,
  precipPct: scenario === 'storm' ? 90 : scenario === 'cloudy' ? 35 : 10,
  cloudsPct: scenario === 'storm' ? 98 : scenario === 'cloudy' ? 85 : 15,
  windKmh: scenario === 'storm' ? 42 : 12,
  weatherCode: scenario === 'storm' ? 95 : scenario === 'cloudy' ? 3 : 0,
  socPct: null,
}));

function Icon({ name, size = 18, stroke = 1.8, className = '' }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', className, 'aria-hidden': true };
  switch (name) {
    case 'refresh': return <svg {...common}><path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4"/></svg>;
    case 'arrow': return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6"/></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'shield': return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>;
    case 'bolt': return <svg {...common}><path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/></svg>;
    case 'battery': return <svg {...common}><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4M6 12h8"/></svg>;
    case 'sun': return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>;
    case 'cloud': return <svg {...common}><path d="M20 16.8a4.6 4.6 0 0 0-2.4-8.5A6.5 6.5 0 0 0 5 11a4 4 0 0 0 1 8h13a4 4 0 0 0 1-2.2Z"/></svg>;
    case 'rain': return <svg {...common}><path d="M20 15a5 5 0 0 0-2.5-9.4A6.5 6.5 0 0 0 5 10a4 4 0 0 0 .3 8"/><path d="m8 18-1 3m6-3-1 3m6-3-1 3"/></svg>;
    case 'storm': return <svg {...common}><path d="M20 15a5 5 0 0 0-2.5-9.4A6.5 6.5 0 0 0 5 10a4 4 0 0 0 .3 8"/><path d="m13 14-4 5h4l-2 4 6-7h-4l2-2"/></svg>;
    case 'check': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>;
    case 'alert': return <svg {...common}><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

function WeatherIcon({ code = 0, size = 34 }) {
  return <Icon name={code >= 95 ? 'storm' : code >= 51 ? 'rain' : code >= 3 ? 'cloud' : code >= 1 ? 'cloud' : 'sun'} size={size} stroke={1.6}/>;
}

function TrendChart({ data, metric, selected, onSelect }) {
  const config = {
    price: { accessor: 'rate', label: 'Electricity rate', unit: '¢/kWh', format: (v) => cents(v), convert: (v) => v * 100 },
    demand: { accessor: 'demandKw', label: 'Demand', unit: 'kW', format: (v) => `${Number(v).toFixed(1)} kW`, convert: (v) => v },
    solar: { accessor: 'solarKw', label: 'Solar output', unit: 'kW', format: (v) => `${Number(v).toFixed(1)} kW`, convert: (v) => v },
  }[metric];
  const values = data.map((p) => config.convert(p[config.accessor]));
  const topValue = Math.max(1, ...values) * 1.14;
  const W = 800, H = 258, left = 40, right = 782, top = 23, bottom = 208;
  const x = (i) => left + (right - left) * i / Math.max(1, data.length - 1);
  const y = (v) => bottom - (Math.max(0, v) / topValue) * (bottom - top);
  const path = data.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(values[i]).toFixed(1)}`).join(' ');
  const area = `${path} L ${x(data.length - 1)} ${bottom} L ${left} ${bottom} Z`;
  return <>
    <div className="ww-plot-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="ww-plot" role="group" aria-label={`${config.label}, interactive hourly chart`}>
        <defs><linearGradient id="ww-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#658773" stopOpacity=".18"/><stop offset="1" stopColor="#658773" stopOpacity="0"/></linearGradient></defs>
        {[0, 1, 2, 3].map((v) => {
          const value = topValue * (3 - v) / 3;
          return <g key={v}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e8ebe6" strokeDasharray="3 5"/><text x={left-12} y={y(value)+4} fontSize="11" fill="#9ba59c" textAnchor="end">{Math.round(value)}</text></g>;
        })}
        <path d={area} fill="url(#ww-chart-fill)"/>
        <path d={path} stroke="#55745d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {data.map((p, i) => <g key={p.id}>
          <circle cx={x(i)} cy={y(values[i])} r="13" fill="transparent" style={{cursor:'pointer'}} role="button" tabIndex="0"
            aria-label={`${p.label}: ${config.format(p[config.accessor])}`}
            onClick={() => onSelect(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); onSelect(i);} }} />
          {(selected === i || i % 3 === 0 || i === data.length-1) && <circle cx={x(i)} cy={y(values[i])} r={selected === i ? 6 : 3} fill={selected === i ? '#fff' : '#55745d'} stroke="#55745d" strokeWidth={selected === i ? 2.5 : 0} style={{pointerEvents:'none'}}/>}
        </g>)}
        {data.map((p, i) => i % 4 === 0 || i === data.length - 1 ? <text key={p.id} x={x(i)} y="244" fontSize="12" fill="#8a948e" textAnchor="middle">{p.label}</text> : null)}
      </svg>
    </div>
    <div className="ww-chart-detail">
      <span className="ww-chart-detail-time"><Icon name="clock" size={15}/>{data[selected]?.label || '—'}</span>
      <strong>{config.format(data[selected]?.[config.accessor])}</strong>
      <span>{numeric(data[selected]?.demandKw).toFixed(1)} kW demand</span>
      <span>{numeric(data[selected]?.solarKw).toFixed(1)} kW solar</span>
      <span className="ww-action-chip">{titleCase(data[selected]?.action || 'HOLD')}</span>
    </div>
  </>;
}

export default function ForecastLivePage() {
  const profile=useHouseholdProfile();
  const [mode, setMode] = useState('live');
  const [reserve, setReserve] = useState(profile.backupReservePct);
  const [appliedReserve, setAppliedReserve] = useState(30);
  const vacation = useVacationMode();
  const vacationReserve = vacation.status === 'active' ? Math.max(appliedReserve, vacation.plan.reservePct) : appliedReserve;
  const [selected, setSelected] = useState(0);
  const [metric, setMetric] = useState('price');
  const [refreshCount, setRefreshCount] = useState(0);
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedTime, setLoadedTime] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(()=>setReserve(profile.backupReservePct),[profile.backupReservePct]);
  // Debounce reserve edits to avoid sending a live API request for every slider pixel.
  useEffect(() => { const id = setTimeout(() => setAppliedReserve(reserve), 360); return () => clearTimeout(id); }, [reserve]);
  useEffect(() => {
    if (mode !== 'live') return;
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/forecast?${new URLSearchParams({backup_reserve_pct:String(vacationReserve),battery_capacity_kwh:String(profile.batteryCapacityKwh),starting_soc_pct:String(profile.startingSocPct),solar_capacity_kw:String(profile.solarCapacityKw),base_load_kw:String(Math.max(0.1,profile.monthlyElectricKwh/720 * (vacation.status === 'active' ? vacation.plan.awayUsagePct / 100 : 1))),max_battery_power_kw:String(profile.maxBatteryPowerKw),latitude:String(profile.latitude),longitude:String(profile.longitude),timezone:profile.timezone})}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`API returned ${response.status}`); return response.json(); })
      .then((result) => { if (!Array.isArray(result.hours) || result.hours.length !== 24) throw new Error('API forecast has an invalid format'); if (!controller.signal.aborted) { setApiData(result); setLoadedTime(new Date()); setSelected(0); } })
      .catch((reason) => { if (!controller.signal.aborted) { setError(reason.message || 'Backend unavailable'); setApiData(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [mode, vacationReserve, vacation.status, vacation.plan.awayUsagePct, refreshCount, profile.batteryCapacityKwh, profile.startingSocPct, profile.solarCapacityKw, profile.monthlyElectricKwh, profile.maxBatteryPowerKw, profile.latitude, profile.longitude, profile.timezone]);

  const apiReady = mode === 'live' && !!apiData && !error;
  const demoScenario = mode === 'live' ? 'clear' : mode;
  const demoHours = useMemo(() => toDemoHours(demoScenario), [demoScenario]);
  const hours = useMemo(() => apiReady ? toLiveHours(apiData.hours) : demoHours, [apiReady, apiData, demoHours]);
  const spot = hours[0];
  const selectedIndex = Math.min(selected, hours.length - 1);
  const minHour = hours.reduce((best, item) => item.rate < best.rate ? item : best, hours[0]);
  const maxHour = hours.reduce((best, item) => item.rate > best.rate ? item : best, hours[0]);
  const solarTotal = hours.reduce((sum, item) => sum + item.solarKw, 0);
  const nwsAlerts = apiReady ? (apiData.nws_alerts || []) : [];
  const hasNwsAlerts = nwsAlerts.length > 0;
  const elevated = apiReady ? apiData.weather_risk === 'elevated' : mode === 'storm';
  const riskLabel = elevated ? 'Elevated' : hasNwsAlerts ? 'Advisory active' : 'Good';
  const effectiveReserve = Math.max(vacation.status === 'active' ? vacation.plan.reservePct : 0, apiReady ? numeric(apiData.effective_backup_reserve_pct, reserve) : Math.max(reserve, mode === 'storm' ? 50 : reserve));
  const weatherCode = apiReady ? spot.weatherCode : mode === 'storm' ? 95 : mode === 'cloudy' ? 3 : 0;
  const condition = apiReady ? weatherCondition(weatherCode) : WEATHER_SCENARIOS[demoScenario].condition;
  const tempF = apiReady ? Math.round(spot.tempC * 9 / 5 + 32) : WEATHER_SCENARIOS[demoScenario].temperature;
  const weatherSource = apiReady ? apiData.data_sources?.weather : null;
  const nwsSource = apiReady ? apiData.data_sources?.weather_alerts : null;
  const trulyLive = apiReady && weatherSource === 'open-meteo';
  const firstCharge = hours.find((h) => h.action === 'CHARGE');
  const firstDischarge = hours.find((h) => h.action === 'DISCHARGE');
  const forecastSubtitle = mode === 'live' ? (trulyLive ? 'Live weather & advisories · modeled energy prices' : 'Weather fallback · modeled energy prices') : 'Illustrative scenario · no live weather data';
  const currentStatus = mode !== 'live' ? 'DEMO SCENARIO' : loading ? 'UPDATING FORECAST' : error ? 'OFFLINE DEMO' : trulyLive ? 'LIVE WEATHER' : 'FALLBACK WEATHER';
  const advisories = apiReady ? nwsAlerts.map((alert, idx) => ({id:`nws-${idx}`, title:alert.title || 'NWS weather advisory', severity:alert.severity || 'Unknown', detail:shorten(alert.headline || alert.description, 260), source:'National Weather Service'})) : mode === 'storm' ? [{id:'demo-storm',title:'Storm warning scenario',severity:'Demo',detail:'Simulated severe weather. Battery reserve automatically increases to 50%.',source:'Demonstration'}] : [];
  const showAdvisories = expanded ? advisories : advisories.slice(0, 2);
  const reserveMessage = elevated ? 'Severe conditions trigger a higher minimum reserve in the model.' : hasNwsAlerts ? 'A local advisory is active. Review your site-specific backup needs.' : 'Current settings preserve capacity for unexpected disruptions.';
  const reliabilityNote = mode === 'live' && !apiReady && !loading ? `Showing a simulated fallback because the API could not be reached: ${error}` : null;

  return <main className="ww-weather">
    <div className="ww-shell">
      <div className="ww-overline"><span>YOUR HOME</span><span className="ww-overline-sep">/</span><span>WEATHER</span></div>
      <header className="ww-page-header">
        <div><h1>Weather & energy resilience</h1><p>Plan ahead for changing conditions, electricity costs, and outages.</p></div>
        <div className="ww-header-tools">
          <select aria-label="Forecast data mode" className="ww-select" value={mode} onChange={(e) => {setMode(e.target.value);setSelected(0);setExpanded(false);}}>
            <option value="live">Live forecast</option>
            {Object.entries(WEATHER_SCENARIOS).map(([key, value]) => <option key={key} value={key}>Demo · {value.label}</option>)}
          </select>
          <button className="ww-icon-button" aria-label="Refresh forecast" title="Refresh forecast" disabled={mode !== 'live' || loading} onClick={() => setRefreshCount((n) => n + 1)}><Icon name="refresh" size={17}/></button>
        </div>
      </header>
      {reliabilityNote && <div className="ww-error" role="status"><Icon name="alert" size={18}/>{reliabilityNote}</div>}
      <div className="ww-hero-grid">
        <section className="ww-hero">
          <div className="ww-hero-decoration" aria-hidden="true"/>
          <div className="ww-hero-top"><span className="ww-inverse-label">{profile.city.toUpperCase()}, {profile.state.toUpperCase()}</span><span className="ww-hero-source"><span className="ww-live-dot"/>{currentStatus}</span></div>
          <div className="ww-hero-content"><div className="ww-hero-icon"><WeatherIcon code={weatherCode} size={47}/></div><div><div className="ww-hero-temp">{tempF}°<span>F</span></div><div className="ww-hero-condition">{condition}</div></div></div>
          <div className="ww-hero-bottom">
            <div><small>Rain chance</small><strong>{spot.precipPct.toFixed(0)}%</strong></div>
            <div><small>Cloud cover</small><strong>{spot.cloudsPct.toFixed(0)}%</strong></div>
            <div><small>Wind</small><strong>{spot.windKmh.toFixed(1)} km/h</strong></div>
          </div>
        </section>
        <section className="ww-health ww-card">
          <div className="ww-card-title-row"><span className="ww-subtle-label">RESILIENCE STATUS</span><span className={`ww-health-icon ${elevated ? 'ww-state-alert' : hasNwsAlerts ? 'ww-state-advisory' : ''}`}><Icon name={elevated || hasNwsAlerts ? 'alert' : 'shield'} size={19}/></span></div>
          <h2>{riskLabel}</h2>
          <p>{elevated ? 'Severe weather precautions are active.' : hasNwsAlerts ? `${nwsAlerts.length} active local NWS advisory${nwsAlerts.length !== 1 ? 'ies' : ''} to review.` : 'No elevated weather risk detected by the current model.'}</p>
          <div className={`ww-status-note ${elevated || hasNwsAlerts ? 'ww-status-note-amber' : ''}`}>
            <Icon name={elevated || hasNwsAlerts ? 'alert' : 'check'} size={16}/>
            <span>{elevated ? `Minimum battery reserve raised to ${effectiveReserve}%.` : hasNwsAlerts ? 'Check advisories and maintain emergency backup.' : 'Battery backup plan is ready for routine conditions.'}</span>
          </div>
          <div className="ww-card-footer"><span>{forecastSubtitle}</span></div>
        </section>
      </div>

      <div className="ww-section-head"><div><h2>Energy outlook</h2><p>Next 24 hours at a glance</p></div><span className="ww-small-note">Pricing & savings are modeled</span></div>
      <div className="ww-metrics">
        <article className="ww-card ww-metric"><span className="ww-metric-icon ww-metric-yellow"><Icon name="clock" size={17}/></span><span className="ww-metric-label">Cheapest hour</span><strong>{minHour.label}</strong><small>{cents(minHour.rate)}/kWh · assumed rate</small></article>
        <article className="ww-card ww-metric"><span className="ww-metric-icon ww-metric-peach"><Icon name="bolt" size={17}/></span><span className="ww-metric-label">Peak-price hour</span><strong>{maxHour.label}</strong><small>{cents(maxHour.rate)}/kWh · assumed rate</small></article>
        <article className="ww-card ww-metric"><span className="ww-metric-icon ww-metric-blue"><Icon name="sun" size={17}/></span><span className="ww-metric-label">Estimated solar</span><strong>{solarTotal.toFixed(1)} <em>kWh</em></strong><small>24-hour modeled output</small></article>
        <article className="ww-card ww-metric"><span className="ww-metric-icon ww-metric-green"><Icon name="battery" size={17}/></span><span className="ww-metric-label">Backup reserve</span><strong>{effectiveReserve}%</strong><small>{effectiveReserve > reserve ? 'Storm precaution applied' : 'Minimum protected charge'}</small></article>
      </div>

      <div className="ww-main-grid">
        <section className="ww-card ww-chart-card">
          <div className="ww-card-heading"><div><h2>Forecasted energy conditions</h2><p>Explore estimated costs, demand, and solar output by hour.</p></div><div className="ww-tabs" role="group" aria-label="Chart data">
            {[['price','Price'],['demand','Demand'],['solar','Solar']].map(([key,label]) => <button key={key} type="button" className={metric === key ? 'ww-tab ww-tab-active' : 'ww-tab'} aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</button>)}
          </div></div>
          <TrendChart data={hours} metric={metric} selected={selectedIndex} onSelect={setSelected}/>
          <div className="ww-chart-foot"><span><i className="ww-legend-dot"/> {metric === 'price' ? 'Illustrative retail rates' : metric === 'solar' ? 'Modeled solar generation' : 'Modeled site demand'}</span><span>Click an hour to inspect</span></div>
        </section>
        <section className="ww-card ww-advisories">
          <div className="ww-card-heading"><div><h2>Weather advisories</h2><p>{apiReady && nwsSource === 'live' ? 'From the National Weather Service' : mode !== 'live' ? 'Scenario demonstration' : 'Forecast warnings and precautions'}</p></div><span className="ww-counter">{mode === 'live' && (!apiReady || nwsSource !== 'live') ? '—' : advisories.length}</span></div>
          {advisories.length ? <div className="ww-alert-list">{showAdvisories.map((alert) => <div className="ww-advisory" key={alert.id}><div className="ww-advisory-title"><span className="ww-alert-symbol"><Icon name="alert" size={17}/></span><div><strong>{alert.title}</strong><small>{alert.source} · {alert.severity}</small></div></div><p>{alert.detail || 'Review this active advisory and prepare accordingly.'}</p></div>)}</div> : <div className="ww-no-alerts"><span><Icon name="check" size={24}/></span><strong>{mode === 'live' && (!apiReady || nwsSource !== 'live') ? 'Alert feed unavailable' : 'No active advisories'}</strong><p>{apiReady && nwsSource === 'live' ? 'There are no active NWS warnings for this location.' : mode !== 'live' ? 'No alerts in this demo scenario.' : 'The NWS status is not currently confirmed. Check again shortly.'}</p></div>}
          {advisories.length > 2 && <button className="ww-text-link" type="button" onClick={() => setExpanded((v)=>!v)}>{expanded ? 'Show fewer' : `Show all ${advisories.length} advisories`} <Icon name="arrow" size={14}/></button>}
          <div className="ww-advisory-foot"><Icon name="shield" size={16}/><span>{hasNwsAlerts ? 'Review official advisories before making safety decisions.' : 'Official NWS alerts are used when live data is available.'}</span></div>
        </section>
      </div>

      <div className="ww-bottom-grid">
        <section className="ww-card ww-reserve-card"><div className="ww-card-heading"><div><h2>Battery reserve planning</h2><p>Keep energy available when you need it most.</p></div><span className="ww-muted-badge"><Icon name="shield" size={13}/> Resilience</span></div>
          <div className="ww-reserve-numbers"><div><small>Requested reserve</small><strong>{reserve}%</strong></div><div><small>Effective reserve</small><strong className="ww-green-text">{effectiveReserve}%</strong></div></div>
          <label className="ww-slider-label" htmlFor="ww-backup-reserve">Set minimum battery reserve</label>
          <input id="ww-backup-reserve" className="ww-range" type="range" min="10" max="80" step="5" value={reserve} onChange={(e)=>setReserve(Number(e.target.value))} style={{'--ww-progress':`${(reserve-10)/70*100}%`}}/>
          <div className="ww-slider-scale"><span>10%</span><span>80%</span></div>
          <div className="ww-reserve-note"><Icon name="shield" size={17}/><span>{reserveMessage}{loading && mode === 'live' ? ' Updating…' : ''}</span></div>
        </section>
        <section className="ww-card ww-action-card"><div className="ww-card-heading"><div><h2>Recommended energy plan</h2><p>Suggested next steps based on your forecast.</p></div><span className="ww-muted-badge">24 hours</span></div>
          <div className="ww-action-row"><span className="ww-action-icon ww-action-charge"><Icon name="bolt" size={17}/></span><div><strong>{firstCharge ? `Charge around ${firstCharge.label}` : `Consider charging near ${minHour.label}`}</strong><p>Lower assumed rate · {cents(firstCharge?.rate ?? minHour.rate)}/kWh</p></div><span className="ww-action-num">01</span></div>
          <div className="ww-action-row"><span className="ww-action-icon ww-action-discharge"><Icon name="arrow" size={17}/></span><div><strong>{firstDischarge ? `Discharge around ${firstDischarge.label}` : `Prepare for ${maxHour.label} peak`}</strong><p>Use stored energy during the highest-priced window.</p></div><span className="ww-action-num">02</span></div>
          <div className="ww-action-row"><span className="ww-action-icon ww-action-reserve"><Icon name="shield" size={17}/></span><div><strong>Preserve {effectiveReserve}% backup power</strong><p>Reserve recommendations, not physical battery control.</p></div><span className="ww-action-num">03</span></div>
        </section>
      </div>

      <footer className="ww-footnote"><span><Icon name="check" size={14}/> {mode !== 'live' ? 'Demo scenario' : trulyLive ? 'Weather: Open-Meteo' : 'Weather: simulated fallback'} · {mode === 'live' ? `NWS: ${nwsSource || 'unavailable'}` : 'NWS not queried'} {loadedTime && mode === 'live' ? `· Updated ${loadedTime.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}` : ''}</span><span>Energy rates, building demand, solar production and dispatch are estimates—not metered data or battery control. Weather data: Open-Meteo (CC BY 4.0).</span></footer>
    </div>
  </main>;
}
