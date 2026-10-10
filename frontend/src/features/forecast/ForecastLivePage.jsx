'use client';
import { useEffect, useMemo, useState } from 'react';
import { buildForecast, formatHour, summarizeForecast, WEATHER_SCENARIOS } from './forecastEngine';
import './forecast.css';
import './forecastLive.css';

const money = (n) => `${(Number(n) * 100).toFixed(1)}¢`;
const labelForISO = (iso) => {
  const match = /T(\d{2}):/.exec(iso || '');
  if (!match) return 'Unknown hour';
  return formatHour(Number(match[1]));
};
const weatherLabel = (code) => {
  if (code >= 95) return 'Thunderstorms';
  if (code >= 61) return 'Rain';
  if (code >= 51) return 'Drizzle';
  if (code >= 45) return 'Fog';
  if (code >= 3) return 'Overcast';
  if (code >= 1) return 'Partly cloudy';
  return 'Clear';
};
const shorten = (value, max = 240) => (value || '').length > max ? `${value.slice(0, max - 1)}…` : value || '';

function transformLiveHours(hours) {
  return hours.map((hour, index) => ({
    hour: index,
    label: labelForISO(hour.time),
    iso: hour.time,
    rate: Number(hour.price_usd_kwh),
    solarKw: Number(hour.solar_estimate_kw),
    demandKw: Number(hour.demand_estimate_kw),
    period: hour.price_tier === 'peak' ? 'Peak' : hour.price_tier === 'off-peak' ? 'Off-peak' : 'Standard',
    action: hour.battery_action,
    socPct: hour.battery_soc_pct,
    temperatureC: hour.temperature_c,
    precipPct: hour.precip_probability_pct,
    cloudPct: hour.cloud_cover_pct,
    windKmh: hour.wind_kmh,
    weatherCode: Number(hour.weather_code),
  }));
}

export default function ForecastLivePage() {
  const [mode, setMode] = useState('live');
  const [reservePercent, setReservePercent] = useState(30);
  const [selectedHour, setSelectedHour] = useState(0);
  const [dismissed, setDismissed] = useState([]);
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (mode !== 'live') return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ backup_reserve_pct: String(reservePercent) });
    fetch(`/api/forecast?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Forecast API returned HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.hours) || data.hours.length !== 24) throw new Error('API returned an invalid forecast');
        return data;
      })
      .then((data) => { if (!controller.signal.aborted) { setApiData(data); setSelectedHour(0); setDismissed([]); } })
      .catch((reason) => { if (!controller.signal.aborted) { setApiData(null); setError(reason.message || 'Unable to contact forecast API'); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [mode, reservePercent, refresh]);

  const live = mode === 'live' && !!apiData && !error;
  const demoMode = mode === 'live' ? 'clear' : mode;
  const demoForecast = useMemo(() => buildForecast(demoMode), [demoMode]);
  const forecast = useMemo(() => live ? transformLiveHours(apiData.hours) : demoForecast,
    [live, apiData, demoForecast]);
  const summary = useMemo(() => summarizeForecast(forecast, demoMode, reservePercent),
    [forecast, demoMode, reservePercent]);
  const selected = forecast[Math.min(selectedHour, forecast.length - 1)] || forecast[0];
  const currentWeather = live ? forecast[0] : null;
  const liveWeatherStatus = apiData?.data_sources?.weather;
  const liveAlertStatus = apiData?.data_sources?.weather_alerts;
  const nwsAlerts = live ? (apiData.nws_alerts || []).map((alert, index) => ({
    id: `nws-${index}`,
    severity: ['Severe', 'Extreme'].includes(alert.severity) ? 'high' : 'info',
    title: `NWS: ${alert.title}`,
    detail: shorten(alert.headline || alert.description || 'See the NWS advisory for details.'),
  })) : [];
  const modeledAlerts = live ? (apiData.alerts || []).map((alert, index) => ({
    id: `recommendation-${index}`, severity: alert.severity === 'warning' ? 'high' : 'info',
    title: alert.severity === 'warning' ? 'Resilience precaution' : 'Energy planning note', detail: alert.text,
  })) : summary.alerts;
  const visibleAlerts = [...nwsAlerts, ...modeledAlerts].filter((a) => !dismissed.includes(a.id));
  const weather = WEATHER_SCENARIOS[demoMode];
  const chartWidth = 850;
  const top = 20;
  const bottom = 185;
  const rates = forecast.map((item) => item.rate);
  const minRate = Math.min(...rates) - .02;
  const maxRate = Math.max(...rates) + .02;
  const xFor = (i) => 20 + (i / (forecast.length - 1)) * (chartWidth - 40);
  const yFor = (rate) => bottom - ((rate - minRate) / (maxRate - minRate)) * (bottom - top);
  const linePoints = forecast.map((point, i) => `${xFor(i)},${yFor(point.rate)}`).join(' ');
  const low = forecast.reduce((a, b) => b.rate < a.rate ? b : a);
  const high = forecast.reduce((a, b) => b.rate > a.rate ? b : a);
  const totalSolar = forecast.reduce((sum, p) => sum + p.solarKw, 0);
  const firstCharge = forecast.find((h) => h.action === 'CHARGE');
  const firstDischarge = forecast.find((h) => h.action === 'DISCHARGE');
  const risk = live ? apiData.weather_risk : summary.risk;
  const effectiveReserve = live ? apiData.effective_backup_reserve_pct : reservePercent;
  const weatherDescription = live ? weatherLabel(currentWeather.weatherCode) : weather.condition;
  const fahrenheit = live ? Math.round(currentWeather.temperatureC * 9 / 5 + 32) : weather.temperature;
  const peakAvg = forecast.filter((p) => p.period === 'Peak');
  const averagePeak = peakAvg.length ? peakAvg.reduce((sum, p) => sum + p.rate, 0) / peakAvg.length : null;

  return <section className="wf-page">
    <div className="wf-topline"><span className="wf-eyebrow">WATTCH / FORECAST & RESILIENCE</span>
      <span className="wf-demo">{live ? `${liveWeatherStatus === 'open-meteo' ? 'LIVE WEATHER' : 'FALLBACK WEATHER'} · MODELED RATES` : mode === 'live' ? (loading ? 'LOADING LIVE WEATHER' : 'API UNAVAILABLE · DEMO FALLBACK') : 'SCENARIO DEMO'}</span>
    </div>
    <div className="wf-header"><div><h1>Know when to use energy.</h1><p>Explore the next 24 hours, respond to weather warnings, and preserve backup power.</p></div>
      <label className="wf-select-label">Data mode
        <select value={mode} onChange={(event) => { setMode(event.target.value); setSelectedHour(0); setDismissed([]); }}>
          <option value="live">Live forecast</option>
          {Object.entries(WEATHER_SCENARIOS).map(([key, w]) => <option key={key} value={key}>Demo: {w.label}</option>)}
        </select>
      </label>
    </div>
    {mode === 'live' && <div className="wf-live-status" role="status">
      <div><b>{loading ? 'Loading live forecast…' : error ? 'Backend connection failed' : `Weather: ${liveWeatherStatus} · NWS alerts: ${liveAlertStatus}`}</b>
        <span>{error ? `Showing clearly labeled demo data. ${error}. Ask Person 1 to proxy /api to port 8000.` : live ? 'Location: Columbia, South Carolina · 24-hour horizon · Rates and savings are illustrative' : 'Connecting to the Python forecast API…'}</span></div>
      <button className="wf-quiet-button" onClick={() => setRefresh((n) => n + 1)} disabled={loading}>Refresh</button>
    </div>}
    <div className="wf-metrics">
      <div className="wf-card"><span>Cheapest projected hour</span><strong>{low.label}</strong><small>{money(low.rate)}/kWh · modeled tariff</small></div>
      <div className="wf-card"><span>Highest-price hour</span><strong>{high.label}</strong><small>{money(high.rate)}/kWh · modeled tariff</small></div>
      <div className="wf-card"><span>Estimated solar energy</span><strong>{totalSolar.toFixed(1)} kWh</strong><small>24-hour modeled total</small></div>
      <div className="wf-card"><span>Forecast weather risk</span><strong>{risk}</strong><small>{weatherDescription} · {fahrenheit}°F</small></div>
    </div>
    <div className="wf-two-col"><article className="wf-panel wf-chart-panel">
      <div className="wf-section-title"><div><h2>24-hour electricity pricing plan</h2><p>Modeled retail prices, weather-linked demand and solar forecast</p></div><span className="wf-unit">¢ / kWh</span></div>
      <svg className="wf-chart" viewBox="0 0 850 220" role="img" aria-label="Interactive 24-hour forecast chart">
        {[0,1,2,3].map((i) => <line key={i} x1="20" x2="830" y1={top + (bottom-top)*i/3} y2={top + (bottom-top)*i/3} className="wf-gridline" />)}
        {forecast.map((point, index) => point.period === 'Peak' ? <rect key={point.iso || index} x={Math.max(20, xFor(index)-9)} y="20" width="18" height="165" className="wf-peak-band"/> : null)}
        <polyline points={linePoints} className="wf-price-line"/>
        {forecast.map((point, index) => <circle key={point.iso || index} cx={xFor(index)} cy={yFor(point.rate)} r={selectedHour===index?7:4}
          className={selectedHour===index?'wf-point wf-selected':'wf-point'} onClick={() => setSelectedHour(index)}>
          <title>{point.label}: {money(point.rate)}/kWh</title>
        </circle>)}
        {[0,4,8,12,16,20,23].map((i) => <text key={i} x={xFor(i)} y="212" textAnchor="middle" className="wf-axis-label">{forecast[i].label}</text>)}
      </svg>
      <div className="wf-reading"><strong>{selected.label}</strong><span>{money(selected.rate)}/kWh</span><span>{selected.demandKw} kW demand</span><span>{selected.solarKw} kW solar</span><span>{selected.action || selected.period}</span></div>
      <div className="wf-legend"><span><i className="wf-dot-price"/> Assumed retail price</span><span><i className="wf-dot-peak"/> Modeled peak window</span></div>
    </article><article className="wf-panel wf-weather">
      <div className="wf-section-title"><div><h2>Weather & outage advisories</h2><p>{live ? 'Open-Meteo forecast and current NWS warnings' : 'Labeled demo scenario'}</p></div></div>
      <div className="wf-weather-now"><span className="wf-weather-symbol">{(live && currentWeather.weatherCode >= 95) || mode === 'storm' ? '⛈' : weatherDescription.toLowerCase().includes('cloud') || weatherDescription === 'Overcast' ? '☁' : '☀'}</span><div><strong>{fahrenheit}°F</strong><span>{weatherDescription}</span></div></div>
      <p className="wf-weather-copy">{live ? `${currentWeather.precipPct}% precipitation chance · ${currentWeather.cloudPct}% clouds · ${currentWeather.windKmh} km/h wind. ${nwsAlerts.length} active NWS advisory(s).` : 'Scenario-based guidance only; select Live forecast for current conditions.'}</p>
      <label className="wf-range-label"><span>Requested backup battery reserve</span><strong>{reservePercent}%</strong></label>
      <input className="wf-slider" type="range" min="10" max="80" step="5" value={reservePercent} onChange={(event) => { setReservePercent(Number(event.target.value)); setDismissed([]); }}/>
      <p className="wf-helper">{live ? `Effective recommendation: ${effectiveReserve}% battery reserve, incorporating modeled storm precautions.` : 'Demo reserve policy; backend simulation is available in Live forecast mode.'}</p>
      <div className="wf-brief"><b>Suggested action</b><span>{live ? risk === 'elevated' ? 'Increase reserves and review active NWS warnings.' : 'Charge off-peak and preserve reserve for potential outages.' : 'Try the Storm warning scenario, then switch back to Live forecast.'}</span></div>
    </article></div>
    <div className="wf-two-col wf-bottom"><article className="wf-panel"><div className="wf-section-title"><div><h2>Smart alerts</h2><p>{live ? 'Actual NWS advisories + modeled energy recommendations' : 'Simulation alerts'}</p></div><button className="wf-quiet-button" onClick={() => setDismissed([])}>Reset alerts</button></div>
      {visibleAlerts.length ? visibleAlerts.map((alert) => <div className="wf-alert" key={alert.id}><span className={alert.severity==='high'?'wf-alert-indicator wf-high':'wf-alert-indicator wf-info'}/><div><strong>{alert.title}</strong><p>{alert.detail}</p></div><button onClick={() => setDismissed((old) => [...old, alert.id])} aria-label={`Dismiss ${alert.title}`}>×</button></div>) : <p className="wf-empty">No visible advisories. Reset alerts to restore dismissed messages.</p>}
    </article><article className="wf-panel"><div className="wf-section-title"><div><h2>Battery Autopilot plan</h2><p>Recommendations only — no physical battery control</p></div></div>
      <div className="wf-plan-step"><span>01</span><div><strong>{live && firstCharge ? `Charge near ${firstCharge.label}` : `Plan to charge near ${low.label}`}</strong><p>Assumed low rate: {money(firstCharge?.rate ?? low.rate)}/kWh</p></div></div>
      <div className="wf-plan-step"><span>02</span><div><strong>{live && firstDischarge ? `Discharge near ${firstDischarge.label}` : 'Reduce grid draw during peak pricing'}</strong><p>{averagePeak == null ? 'No peak tier in the 24-hour horizon.' : `Modeled average peak rate: ${money(averagePeak)}/kWh`}</p></div></div>
      <div className="wf-plan-step"><span>03</span><div><strong>Protect {effectiveReserve}% minimum backup reserve</strong><p>Policy to coordinate with Person 3's battery module.</p></div></div>
    </article></div>
    <p className="wf-disclaimer">{live ? 'Open-Meteo weather + NWS alert data may be live. Rates, site demand, solar generation, savings and battery dispatch are simulated estimates. NWS advisories are not a substitute for official emergency guidance.' : 'DEMO SCENARIO — weather, electricity rates, and energy forecasts on this screen are simulated.'} Weather data attribution: Open-Meteo.com (CC BY 4.0).</p>
  </section>;
}
