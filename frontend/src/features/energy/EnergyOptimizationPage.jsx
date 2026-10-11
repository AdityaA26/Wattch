import { useEffect, useMemo, useState } from 'react';
import { useHouseholdProfile } from '../../state/householdProfile.js';
import ForecastLivePage from '../forecast/ForecastLivePage.jsx';
import './energyOptimization.css';

/*
 * Energy Optimization is Wattch's cross-system planning screen.
 * Hourly weather and NWS advisories come from the existing Python API.
 * Energy prices, grid readings, battery dispatch and savings remain simulations.
 * There is no physical breaker, battery or solar-inverter connection.
 */
const SECTIONS = [
  {id: 'overview', name: 'Overview'},
  {id: 'battery', name: 'Battery'},
  {id: 'solar', name: 'Solar'},
  {id: 'resilience', name: 'Resilience'},
];
const number = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const cash = (v) => `$${number(v).toFixed(2)}`;
const hourName = (time) => {
  const match = String(time || '').match(/T(\d{2}):/);
  if (!match) return '—';
  const h = Number(match[1]);
  return `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
};
const percent = (v) => `${Math.round(number(v))}%`;
const kw = (v) => `${number(v).toFixed(1)} kW`;
const batteryAction = (action) => {
  const value = String(action || 'HOLD').toUpperCase();
  return value === 'CHARGE' ? 'Charge' : value === 'DISCHARGE' ? 'Use battery' : 'Preserve';
};

function forecastParams(profile, reserve) {
  return new URLSearchParams({
    battery_capacity_kwh: String(profile.batteryCapacityKwh),
    starting_soc_pct: String(profile.startingSocPct),
    backup_reserve_pct: String(reserve),
    solar_capacity_kw: String(profile.solarCapacityKw),
    max_battery_power_kw: String(profile.maxBatteryPowerKw),
    base_load_kw: String(Math.max(0.1, number(profile.monthlyElectricKwh, 720) / 720)),
    latitude: String(profile.latitude),
    longitude: String(profile.longitude),
    timezone: profile.timezone || 'America/New_York',
  });
}

function useEnergyForecast(profile, reserve) {
  const [result, setResult] = useState({data: null, error: '', loading: true});
  const [reload, setReload] = useState(0);
  const profileKey = [profile.latitude, profile.longitude, profile.timezone, profile.batteryCapacityKwh,
    profile.startingSocPct, profile.solarCapacityKw, profile.maxBatteryPowerKw,
    profile.monthlyElectricKwh, reserve, reload].join('|');
  useEffect(() => {
    const controller = new AbortController();
    setResult({data: null, error: '', loading: true});
    fetch(`/api/forecast?${forecastParams(profile, reserve)}`, {signal: controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error(`Forecast service returned ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data.hours) || !data.hours.length) throw new Error('Forecast response is missing hourly data');
        if (!controller.signal.aborted) setResult({data, error: '', loading: false});
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({data: null, error: error.message || 'Forecast unavailable', loading: false});
      });
    return () => controller.abort();
  }, [profileKey]);
  return {...result, refresh: () => setReload(n => n + 1)};
}

function Panel({eyebrow, title, text, children, className = ''}) {
  return <section className={`eo-panel ${className}`}>
    {eyebrow && <span className="eo-eyebrow">{eyebrow}</span>}
    {title && <h2>{title}</h2>}
    {text && <p className="eo-description">{text}</p>}
    {children}
  </section>;
}

function Value({label, value, note}) {
  return <div className="eo-value"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function HourStrip({hours, metric = 'price', selected, onSelect}) {
  const values = hours.map(item => metric === 'price' ? number(item.price_usd_kwh) * 100 : metric === 'solar' ? number(item.solar_estimate_kw) : number(item.grid_after_storage_kw));
  const maximum = Math.max(1, ...values);
  return <div className="eo-hourly">
    <div className="eo-hour-chart" role="group" aria-label={`${metric} hourly forecast`}>{hours.map((h,i) => <button type="button" key={`${h.time}-${i}`}
      className={`eo-hour ${selected === i ? 'selected' : ''}`} title={`${hourName(h.time)} · ${values[i].toFixed(1)}`}
      onClick={() => onSelect(i)} aria-label={`View ${hourName(h.time)}`} aria-pressed={selected === i}>
      <span className="eo-hour-track"><span style={{height: `${Math.max(4, values[i] / maximum * 100)}%`}} /></span>
      <small>{i % 4 === 0 || i === hours.length-1 ? hourName(h.time) : ''}</small>
    </button>)}</div>
    <div className="eo-hour-detail"><b>{hourName(hours[selected]?.time)}</b>
      <span>{(number(hours[selected]?.price_usd_kwh) * 100).toFixed(0)}¢/kWh modeled</span>
      <span>{kw(hours[selected]?.grid_after_storage_kw)} net grid load</span>
      <span className="eo-pill">{batteryAction(hours[selected]?.battery_action)}</span>
    </div>
  </div>;
}

function AlertFeed({forecast, onResilience}) {
  const nws = forecast?.nws_alerts || [];
  const sourceOk = forecast?.data_sources?.weather_alerts === 'live';
  return <Panel eyebrow="LOCAL RISK" title="Weather & outage readiness" text="National Weather Service notices inform battery planning. An advisory does not confirm a power outage.">
    {sourceOk ? <div className={`eo-risk ${nws.length ? 'eo-risk-notice' : ''}`}>
      <span className="eo-risk-dot"/><strong>{nws.length ? `${nws.length} active NWS notice${nws.length === 1 ? '' : 's'}` : 'No active NWS notices'}</strong>
      <small>Live alert feed</small>
    </div> : <div className="eo-risk"><strong>Alert feed unavailable</strong><small>Check official local alerts separately</small></div>}
    {nws.slice(0, 2).map((a,i) => <div className="eo-alert" key={i}><strong>{a.title || 'Weather advisory'}</strong><span>{a.severity || 'Advisory'} · National Weather Service</span></div>)}
    <button type="button" className="eo-link" onClick={onResilience}>View storm plan <span aria-hidden="true">→</span></button>
  </Panel>;
}

export function EnergyHomeStatus({onNavigate}) {
  const profile = useHouseholdProfile();
  const {data, error, loading} = useEnergyForecast(profile, number(profile.backupReservePct, 30));
  const count = (data?.nws_alerts || []).length;
  return <Panel className="eo-home-mini" eyebrow="ENERGY & RESILIENCE" title="Ready for what's next." text="Live local weather context, modeled battery planning, and the next 24 hours.">
    <div className="eo-mini-status"><span className={count ? 'eo-dot-amber' : 'eo-dot-green'}/><strong>{loading ? 'Checking local advisories…' : error || data?.data_sources?.weather_alerts !== 'live' ? 'Local alerts unavailable' : count ? `${count} active advisory${count === 1 ? '' : 'ies'}` : 'No active NWS advisories'}</strong></div>
    <button type="button" className="eo-link" onClick={() => onNavigate('energy')}>Open Energy Optimization <span aria-hidden="true">→</span></button>
    <small className="eo-smallprint">Weather: Open-Meteo + NWS when connected. Electricity costs are modeled.</small>
  </Panel>;
}

export default function EnergyOptimizationPage({onNavigate}) {
  const profile = useHouseholdProfile();
  const [section, setSection] = useState('overview');
  const [reserve, setReserve] = useState(number(profile.backupReservePct, 30));
  const [selected, setSelected] = useState(0);
  useEffect(() => setReserve(number(profile.backupReservePct,30)), [profile.backupReservePct]);
  const {data, error, loading, refresh} = useEnergyForecast(profile, reserve);
  const hours = data?.hours || [];
  const low = hours.reduce((best, h) => !best || number(h.price_usd_kwh) < number(best.price_usd_kwh) ? h : best, null);
  const high = hours.reduce((best, h) => !best || number(h.price_usd_kwh) > number(best.price_usd_kwh) ? h : best, null);
  const totalSolarKwh = hours.reduce((n,h) => n + number(h.solar_estimate_kw), 0);
  const peakShiftKwh = hours.filter(h => h.price_tier === 'peak').reduce((n,h) => n + Math.max(0,number(h.grid_before_storage_kw) - number(h.grid_after_storage_kw)), 0);
  const peakBefore = Math.max(0, ...hours.map(h => number(h.grid_before_storage_kw)));
  const peakAfter = Math.max(0, ...hours.map(h => number(h.grid_after_storage_kw)));
  const batteryHours = hours.filter(h => ['CHARGE','DISCHARGE'].includes(String(h.battery_action || '').toUpperCase()));
  const protectedEnergy = number(profile.batteryCapacityKwh) * number(data?.effective_backup_reserve_pct, reserve) / 100;
  const solarBest = hours.reduce((best,h) => !best || number(h.solar_estimate_kw) > number(best.solar_estimate_kw) ? h : best, null);
  const loadedLiveWeather = data?.data_sources?.weather === 'open-meteo';
  return <main className="eo-page">
    <div className="eo-heading"><div><span className="eo-eyebrow">SMART HOME / ENERGY</span><h1>Energy Optimization</h1><p>One plan for lower costs, smarter storage, and a more resilient home.</p></div>
      <button type="button" className="eo-refresh" onClick={refresh} disabled={loading}>{loading ? 'Updating…' : '↻ Refresh forecast'}</button></div>
    <div className="eo-tabs" role="tablist" aria-label="Energy Optimization sections">{SECTIONS.map(s => <button type="button" key={s.id} role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)} className={section === s.id ? 'active' : ''}>{s.name}</button>)}</div>
    {section === 'resilience' ? <div className="eo-resilience"><div className="eo-resilience-note"><strong>Weather powers energy decisions.</strong> Review local alerts and simulate battery reserves here. Power outages are not predicted or confirmed by this page.</div><ForecastLivePage /></div> : <>
      <div className="eo-data-status" role="status"><span className={loadedLiveWeather ? 'eo-dot-green' : 'eo-dot-amber'}/>{loading ? 'Loading energy outlook…' : error ? `Forecast not available: ${error}` : loadedLiveWeather ? 'Live weather connected · Modeled electricity and battery data' : 'Weather fallback · Modeled electricity and battery data'}</div>
      {section === 'overview' && <>
        <div className="eo-top-grid"><Panel className="eo-hero" eyebrow="NEXT 24 HOURS" title="Make every watt work harder." text="Wattch looks ahead for affordable charging windows, protects backup power, and shows where household demand could shift.">
          <div className="eo-hero-stats"><div><small>Best modeled charge hour</small><b>{low ? hourName(low.time) : '—'}</b></div><div><small>Peak-price hour</small><b>{high ? hourName(high.time) : '—'}</b></div><div><small>Reserve target</small><b>{percent(data?.effective_backup_reserve_pct ?? reserve)}</b></div></div>
        </Panel><AlertFeed forecast={data} onResilience={() => setSection('resilience')}/></div>
        <div className="eo-metrics"><Value label="Modeled savings · 24h" value={data ? cash(data.summary?.estimated_savings_usd) : '—'} note="Not a utility bill"/><Value label="Energy shifted from peak" value={data ? `${peakShiftKwh.toFixed(1)} kWh` : '—'} note="Hourly battery model"/><Value label="Projected solar output" value={data ? `${totalSolarKwh.toFixed(1)} kWh` : '—'} note="Weather-derived estimate"/><Value label="Grid load peak" value={data ? kw(peakAfter) : '—'} note="With modeled battery dispatch"/></div>
        <div className="eo-columns"><Panel eyebrow="PRICE & DEMAND" title="Tomorrow's energy rhythm" text="Hourly modeled rates with real weather inputs. Select an hour to inspect Wattch's planned action.">{hours.length ? <HourStrip hours={hours} selected={selected} onSelect={setSelected}/> : <p className="eo-description">Start the Python forecast server to show hourly data.</p>}</Panel>
          <Panel eyebrow="GRID MODERNIZATION" title="What changes with Wattch" text="Illustrative impact of battery dispatch on the household's peak hourly grid draw.">
            <div className="eo-compare"><div><span>Grid-only peak</span><b>{hours.length ? kw(peakBefore) : '—'}</b><div className="eo-meter"><i style={{width:'100%'}}/></div></div><div><span>With battery plan</span><b>{hours.length ? kw(peakAfter) : '—'}</b><div className="eo-meter"><i style={{width: `${peakBefore > 0 ? Math.min(100,peakAfter/peakBefore*100) : 0}%`}}/></div></div></div>
            <p className="eo-smallprint">Peak demand depends on the simulation and can rise during charging. This comparison is not a measured grid outcome.</p>
            <button type="button" className="eo-link" onClick={() => setSection('battery')}>Review battery strategy →</button>
          </Panel></div>
      </>}
      {section === 'battery' && <>
        <div className="eo-metrics"><Value label="Battery size" value={`${number(profile.batteryCapacityKwh).toFixed(1)} kWh`} note="My Equipment profile"/><Value label="Starting charge" value={percent(profile.startingSocPct)} note="Demo household"/><Value label="Protected energy" value={`${protectedEnergy.toFixed(1)} kWh`} note="At effective reserve"/><Value label="Suggested dispatch events" value={`${batteryHours.length}`} note="24-hour simulation"/></div>
        <div className="eo-columns"><Panel eyebrow="BACKUP PLANNING" title="Keep power in reserve" text="Explore how a higher emergency reserve changes the simulated charge/discharge plan.">
          <label className="eo-slider-label" htmlFor="eo-reserve">Emergency reserve <strong>{percent(reserve)}</strong></label><input id="eo-reserve" type="range" min="10" max="90" step="5" value={reserve} onChange={e=>setReserve(Number(e.target.value))}/>
          <p className="eo-smallprint">The reserve here is exploratory. Save your default reserve in My Home Profile. No physical battery is controlled.</p>
          <button type="button" className="eo-link" onClick={() => onNavigate('electricity')}>Open Electricity's battery simulator →</button>
        </Panel><Panel eyebrow="AUTOPILOT PREVIEW" title="Planned battery activity" text="Based on the illustrative time-of-use rates, forecast demand, and reserve requirement.">
          {batteryHours.length ? <div className="eo-events">{batteryHours.slice(0,7).map((h,i) => <div key={`${h.time}-${i}`}><span>{hourName(h.time)}</span><strong>{batteryAction(h.battery_action)}</strong><small>{percent(h.battery_soc_pct)} projected charge</small></div>)}</div> : <p className="eo-description">No charge/discharge recommendations in the current scenario.</p>}
          <p className="eo-smallprint">Actual Battery Autopilot, manual override, and health monitoring require Person 3's module and compatible hardware.</p>
        </Panel></div>
      </>}
      {section === 'solar' && <>
        <div className="eo-metrics"><Value label="Installed solar size" value={`${number(profile.solarCapacityKw).toFixed(1)} kW`} note="Household profile"/><Value label="Forecast production · 24h" value={hours.length ? `${totalSolarKwh.toFixed(1)} kWh` : '—'} note="Modeled from sunlight"/><Value label="Strongest solar hour" value={solarBest ? hourName(solarBest.time) : '—'} note="Solar production estimate"/><Value label="Weather feed" value={loadedLiveWeather ? 'Live' : 'Demo / offline'} note="Open-Meteo if available"/></div>
        <Panel eyebrow="SOLAR OUTLOOK" title="Solar production over the next 24 hours" text="Hourly output is estimated from forecast radiation and the system size saved in My Equipment.">{hours.length ? <HourStrip hours={hours} metric="solar" selected={selected} onSelect={setSelected}/> : <p className="eo-description">Start the forecast API to view estimated generation.</p>}</Panel>
        <Panel eyebrow="NEXT STEP" title="Solar equipment & usage" text="Your installed array size comes from the active household. Open the Electricity page to explore a monthly output scenario, or My Equipment to edit panels."><div className="eo-actions"><button type="button" onClick={() => onNavigate('electricity')}>Electricity →</button><button type="button" onClick={() => onNavigate('equipment')}>My Equipment →</button></div></Panel>
      </>}
    </>}
    <footer className="eo-footer">Weather data: Open-Meteo and National Weather Service when available. Energy forecasts, grid outcomes, savings, and battery actions are illustrative—not metered readings or physical device control.</footer>
  </main>;
}
