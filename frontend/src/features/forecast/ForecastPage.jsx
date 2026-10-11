'use client';
import { useMemo, useState } from 'react';
import { buildForecast, formatHour, summarizeForecast, WEATHER_SCENARIOS } from './forecastEngine';
import './forecast.css';

const fmtRate = (rate) => `${(rate * 100).toFixed(1)}¢`;

export default function ForecastPage() {
  const [scenario, setScenario] = useState('clear');
  const [reservePercent, setReservePercent] = useState(30);
  const [selectedHour, setSelectedHour] = useState(17);
  const [dismissed, setDismissed] = useState([]);
  const forecast = useMemo(() => buildForecast(scenario), [scenario]);
  const summary = useMemo(
    () => summarizeForecast(forecast, scenario, reservePercent),
    [forecast, scenario, reservePercent]
  );
  const weather = WEATHER_SCENARIOS[scenario];
  const selected = forecast[selectedHour];
  const chartWidth = 850;
  const chartHeight = 220;
  const top = 20;
  const bottom = 185;
  const min = Math.min(...forecast.map((p) => p.rate)) - 0.02;
  const max = Math.max(...forecast.map((p) => p.rate)) + 0.02;
  const xFor = (i) => 20 + (i / 23) * (chartWidth - 40);
  const yFor = (rate) => bottom - ((rate - min) / (max - min)) * (bottom - top);
  const linePoints = forecast.map((point, i) => `${xFor(i)},${yFor(point.rate)}`).join(' ');
  const visibleAlerts = summary.alerts.filter((alert) => !dismissed.includes(alert.id));

  return (
    <section className="wf-page">
      <div className="wf-topline"><span className="wf-eyebrow">WATTCH / FORECAST & RESILIENCE</span><span className="wf-demo">SIMULATED DATA</span></div>
      <div className="wf-header">
        <div><h1>Know when to use energy.</h1><p>Predict tomorrow's rates, prepare for storms, and protect your battery reserve.</p></div>
        <label className="wf-select-label">Weather scenario
          <select value={scenario} onChange={(event) => { setScenario(event.target.value); setDismissed([]); }}>
            {Object.entries(WEATHER_SCENARIOS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
      </div>

      <div className="wf-metrics">
        <div className="wf-card"><span>Cheapest hour</span><strong>{summary.lowest.label}</strong><small>{fmtRate(summary.lowest.rate)}/kWh</small></div>
        <div className="wf-card"><span>Highest-price hour</span><strong>{summary.highest.label}</strong><small>{fmtRate(summary.highest.rate)}/kWh</small></div>
        <div className="wf-card"><span>Modeled solar output</span><strong>{summary.totalSolarKwh} kWh</strong><small>24-hour total (demo)</small></div>
        <div className="wf-card"><span>Outage conditions</span><strong>{summary.risk}</strong><small>{weather.condition} · {weather.temperature}°F</small></div>
      </div>

      <div className="wf-two-col">
        <article className="wf-panel wf-chart-panel">
          <div className="wf-section-title"><div><h2>24-hour electricity price forecast</h2><p>Click a point to inspect its rate, demand, and solar output.</p></div><span className="wf-unit">¢ / kWh</span></div>
          <svg className="wf-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Interactive forecast of 24 hourly electricity rates">
            {[0, 1, 2, 3].map((i) => {
              const y = top + ((bottom - top) * i) / 3;
              return <line key={i} x1="20" y1={y} x2="830" y2={y} className="wf-gridline" />;
            })}
            <rect x={xFor(16)} y="20" width={xFor(21) - xFor(16)} height="165" className="wf-peak-band" />
            <polyline points={linePoints} className="wf-price-line" />
            {forecast.map((point, index) => <circle key={point.hour} cx={xFor(index)} cy={yFor(point.rate)}
              r={selectedHour === index ? 7 : 4} className={selectedHour === index ? 'wf-point wf-selected' : 'wf-point'}
              onClick={() => setSelectedHour(index)}>
              <title>{point.label}: {fmtRate(point.rate)}/kWh</title>
            </circle>)}
            {[0, 4, 8, 12, 16, 20, 23].map((hour) => <text key={hour} x={xFor(hour)} y="212" textAnchor="middle" className="wf-axis-label">{formatHour(hour)}</text>)}
          </svg>
          <div className="wf-reading"><strong>{selected.label}</strong><span>{fmtRate(selected.rate)}/kWh</span><span>{selected.demandKw} kW demand</span><span>{selected.solarKw} kW solar</span><span>{selected.period}</span></div>
          <div className="wf-legend"><span><i className="wf-dot-price"/> Forecast price</span><span><i className="wf-dot-peak"/> Peak window (4–9 PM)</span></div>
        </article>
        <article className="wf-panel wf-weather">
          <div className="wf-section-title"><div><h2>Weather & outage advisory</h2><p>Scenario-based resilience guidance.</p></div></div>
          <div className="wf-weather-now"><span className="wf-weather-symbol">{scenario === 'storm' ? '⛈' : scenario === 'cloudy' ? '☁' : '☀'}</span><div><strong>{weather.temperature}°F</strong><span>{weather.condition}</span></div></div>
          <p className="wf-weather-copy">{scenario === 'storm' ? 'Storm conditions can interrupt grid power. Avoid fully discharging your battery.' : scenario === 'cloudy' ? 'Lower solar production may raise your need for grid electricity.' : 'Strong modeled solar output is available during daylight hours.'}</p>
          <label className="wf-range-label"><span>Minimum backup battery reserve</span><strong>{reservePercent}%</strong></label>
          <input className="wf-slider" type="range" min="10" max="80" step="5" value={reservePercent} onChange={(event) => { setReservePercent(Number(event.target.value)); setDismissed([]); }} />
          <p className="wf-helper">Recommendation: preserve {scenario === 'storm' ? '50% or more during a storm scenario' : 'at least 25% as a starting demo setting'}.</p>
          <div className="wf-brief"><b>Suggested action</b><span>{scenario === 'storm' ? 'Enable backup-first mode and review utility alerts.' : 'Charge off-peak; preserve reserve for unexpected outages.'}</span></div>
        </article>
      </div>

      <div className="wf-two-col wf-bottom">
        <article className="wf-panel"><div className="wf-section-title"><div><h2>Smart alerts</h2><p>Warnings generated from simulated forecast inputs.</p></div><button className="wf-quiet-button" onClick={() => setDismissed([])}>Reset alerts</button></div>
          {visibleAlerts.length ? visibleAlerts.map((alert) => <div className="wf-alert" key={alert.id}><span className={alert.severity === 'high' ? 'wf-alert-indicator wf-high' : 'wf-alert-indicator wf-info'}/><div><strong>{alert.title}</strong><p>{alert.detail}</p></div><button onClick={() => setDismissed((old) => [...old, alert.id])} aria-label={`Dismiss ${alert.title}`}>×</button></div>) : <p className="wf-empty">All alerts dismissed. Click “Reset alerts” to show them again.</p>}
        </article>
        <article className="wf-panel"><div className="wf-section-title"><div><h2>Autopilot recommendation</h2><p>Hand-off suggestion for the battery control screen.</p></div></div>
          <div className="wf-plan-step"><span>01</span><div><strong>Charge near {summary.lowest.label}</strong><p>Modeled low rate: {fmtRate(summary.lowest.rate)}/kWh</p></div></div>
          <div className="wf-plan-step"><span>02</span><div><strong>Reduce grid demand during 4–9 PM</strong><p>Average peak-window rate: {fmtRate(summary.peakAverage)}/kWh</p></div></div>
          <div className="wf-plan-step"><span>03</span><div><strong>Keep {reservePercent}% in reserve</strong><p>Resilience floor to share with Battery Autopilot.</p></div></div>
        </article>
      </div>
      <p className="wf-disclaimer">Hackathon demonstration: rates, weather, outage conditions, and forecasts are modeled sample data, not live utility or emergency information.</p>
    </section>
  );
}
