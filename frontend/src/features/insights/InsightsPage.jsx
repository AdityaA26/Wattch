import {useEffect, useRef, useState} from 'react';
import {useHouseholdProfile, useHouseholds} from '../../state/householdProfile.js';
import {api, backendProfile, demoReadings, homeId} from './insightsApi.js';
import samplePlan from './sample_plan.json';
import flatPlan from './flat_plan.json';
import sampleCommunity from './sample_community.json';
import './insights.css';

const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : '—';
const usd = n => Number.isFinite(n) ? Math.abs(n) < .005 ? '$0.00' : `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}` : '—';
const labels = {electricity: 'Electricity', water: 'Water', gas: 'Gas'};
const statusLabel = {no_data: 'No readings', insufficient_comparable_data: 'More data needed',
  possible_unusual_increase: 'Unusual increase', no_large_increase_detected: 'No large daily increase'};

function Panel({title, note, children, className = ''}) {
  return <section className={`wi-panel ${className}`}><h2>{title}</h2>{note && <p className="wi-muted">{note}</p>}{children}</section>;
}
function Metric({label, value, note}) {
  return <div className="wi-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function UsageCard({item}) {
  const flag = item.status === 'possible_unusual_increase';
  const peer = item.peerComparison;
  return <article className={`wi-usage ${flag ? 'wi-usage-flag' : ''}`}>
    <div className="wi-card-head"><h3>{labels[item.utility]}</h3><span className="wi-chip">{item.source || 'No data'}</span></div>
    <strong className="wi-usage-value">{item.changePct == null ? '—' : `${item.changePct > 0 ? '+' : ''}${fmt(item.changePct)}%`}</strong>
    <p>{statusLabel[item.status] || item.status}</p>
    {item.recentDailyAverage != null && <dl><div><dt>Last 7 days · daily average</dt><dd>{fmt(item.recentDailyAverage)} {item.unit}</dd></div><div><dt>Previous 21 days · daily average</dt><dd>{fmt(item.baselineDailyAverage)} {item.unit}</dd></div></dl>}
    {item.endDate && <small>Window ending {item.endDate}</small>}
    {item.costInsights?.differenceUsd != null && <div className="wi-cost"><span>Variable cost change · 7 days</span><b>{usd(item.costInsights.differenceUsd)}</b><small>Supplied rates; excludes fixed fees and taxes.</small></div>}
    {item.explanation && <p className="wi-muted">{item.explanation}</p>}
    {peer?.status === 'available' && <p className="wi-peer">Participating sample: {fmt(peer.peerDailyAverage)} {item.unit}/day across {peer.sampleSize} other homes. This is not a verified neighborhood average.</p>}
    {(item.habitSuggestions || []).slice(0, 1).map(text => <p className="wi-tip" key={text}>{text}</p>)}
  </article>;
}

function HouseholdInsights({profile, activeHomeId}) {
  const [scope, setScope] = useState('sample');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [importing, setImporting] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);
  const [includeWeather, setIncludeWeather] = useState(false);
  const chatRequest = useRef(null);
  const weatherRequest = useRef(null);
  const householdId = scope === 'sample' ? 'demo-home' : homeId(activeHomeId);
  const profileKey = JSON.stringify(backendProfile(profile, activeHomeId));
  const hasReadings = report?.utilities.some(u => u.status !== 'no_data');

  useEffect(() => {
    const controller = new AbortController();
    chatRequest.current?.abort(); weatherRequest.current?.abort();
    setMessages([]); setAsking(false); setWeather(null); setWeatherError(''); setWeatherLoading(false);
    setLoading(true); setReport(null); setError('');
    (async () => {
      if (scope === 'home') await api('/api/household/profile', {body: JSON.parse(profileKey), signal: controller.signal});
      const result = await api(`/api/household/report?householdId=${encodeURIComponent(householdId)}`, {signal: controller.signal});
      if (!controller.signal.aborted) setReport(result);
    })().catch(e => {if (!controller.signal.aborted) setError(e.message);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => {controller.abort(); chatRequest.current?.abort(); weatherRequest.current?.abort();};
  }, [householdId, profileKey, reload, scope]);

  async function loadSample() {
    setImporting(true); setError('');
    try {
      await api('/api/household/readings', {body: {householdId, readings: demoReadings(profile)}});
      setReload(n => n + 1);
    } catch (e) {setError(e.message);}
    finally {setImporting(false);}
  }
  async function loadWeather() {
    const controller = new AbortController(); weatherRequest.current?.abort(); weatherRequest.current = controller;
    setWeatherLoading(true); setWeatherError('');
    try {
      const result = await api(`/api/household/weather?householdId=${encodeURIComponent(householdId)}`, {signal: controller.signal});
      if (!controller.signal.aborted) setWeather(result);
    } catch (e) {if (!controller.signal.aborted) setWeatherError(e.message);}
    finally {if (!controller.signal.aborted) setWeatherLoading(false);}
  }
  async function ask(text) {
    const query = text.trim(); if (!query || asking || !report) return;
    const controller = new AbortController(); chatRequest.current = controller;
    setQuestion(''); setAsking(true);
    setMessages(m => [...m, {role: 'user', text: query}]);
    try {
      const result = await api('/api/household/chat', {body: {householdId, question: query, includeWeather}, signal: controller.signal});
      if (!controller.signal.aborted) setMessages(m => [...m, {role: 'assistant', text: result.answer, provider: result.provider, model: result.model, warning: result.warning}]);
    } catch (e) {if (!controller.signal.aborted) setMessages(m => [...m, {role: 'error', text: e.message}]);}
    finally {if (!controller.signal.aborted) setAsking(false);}
  }
  return <>
    <div className="wi-toolbar"><div className="wi-segments" aria-label="Household evidence"><button type="button" className={scope === 'sample' ? 'active' : ''} onClick={() => setScope('sample')}>Seeded demo household</button><button type="button" className={scope === 'home' ? 'active' : ''} onClick={() => setScope('home')}>Selected home</button></div><button className="wi-button" type="button" onClick={() => setReload(n => n + 1)} disabled={loading || importing}>Refresh readings</button></div>
    <div className="wi-notice"><strong>{scope === 'sample' ? 'Synthetic household history' : profile.homeName}</strong><span>{scope === 'sample' ? 'This seeded scenario is separate from your selected home and its sample bills. It demonstrates electricity and water usage increases.' : 'Analysis uses daily readings stored for this home. Profile settings update the backend; editing them does not manufacture a usage history.'}</span><small>{report ? `Stored in ${report.storage === 'tigerdata' ? 'Tiger Data' : 'SQLite'}` : 'Connecting to household history'} · No utility account or smart meter connected</small></div>
    {error && <div className="wi-error" role="alert">{error}{scope === 'sample' && <p>If the demo history is unavailable, select your home and load synthetic readings below.</p>}</div>}
    {loading && <p role="status" className="wi-muted">Loading household evidence…</p>}
    {report && <>
      {scope === 'home' && !hasReadings && <Panel title="Start with a sample history" note="Load 42 days of clearly labeled synthetic readings. Electricity follows your monthly usage setting; the last week includes a demonstration increase. Sample rates are illustrative."><button type="button" className="wi-button wi-primary" disabled={importing} onClick={loadSample}>{importing ? 'Saving sample…' : 'Load synthetic readings'}</button></Panel>}
      <div className="wi-usage-grid">{report.utilities.map(item => <UsageCard item={item} key={item.utility}/>)}</div>
      <div className="wi-two-column">
        <Panel title="Ask Wattch" note="Answers explain the same household evidence shown above.">
          <div className="wi-prompts">{['Why did my water usage rise?', 'Explain my electricity usage change.', 'What should I check first?'].map(q => <button type="button" disabled={asking || !hasReadings} onClick={() => ask(q)} key={q}>{q}</button>)}</div>
          <div className="wi-messages" aria-live="polite">{!messages.length && <p className="wi-muted">Ask about a change, its cost, or a practical next step.</p>}{messages.map((m, i) => <article className={`wi-message wi-message-${m.role}`} key={i}><span>{m.role === 'user' ? 'YOU' : m.role === 'error' ? 'REQUEST FAILED' : m.provider === 'gemini' ? `GEMINI · ${m.model}` : 'LOCAL RULES · FALLBACK'}</span><p>{m.text.replace(/\*\*/g, '')}</p>{m.warning && <small>{m.warning}</small>}</article>)}{asking && <p role="status" className="wi-muted">Preparing your answer…</p>}</div>
          <form onSubmit={e => {e.preventDefault(); ask(question);}}><label className="wi-field">Your question<textarea rows={3} maxLength={1500} value={question} onChange={e => setQuestion(e.target.value)} placeholder="What changed, and what can I do?" disabled={asking}/></label><div className="wi-chat-footer"><label className="wi-check"><input type="checkbox" checked={includeWeather} onChange={e => setIncludeWeather(e.target.checked)}/> Include weather and backup context</label><button className="wi-button wi-primary" disabled={asking || !hasReadings || !question.trim()}>{asking ? 'Thinking…' : 'Ask Wattch'}</button></div></form>
        </Panel>
        <Panel title="Weather & backup" note={scope === 'sample' ? 'Uses the seeded demo household’s location and battery settings.' : 'Uses this home’s saved location and equipment; assumes 0.55 kW essential load and an 8-hour backup goal.'}>
          <button type="button" className="wi-button" disabled={weatherLoading} onClick={loadWeather}>{weatherLoading ? 'Checking weather…' : 'Check weather & backup'}</button>
          {weatherError && <p className="wi-error" role="alert">{weatherError}</p>}
          {weather && <><p className="wi-weather-status">{weather.weather.status === 'live_data_incomplete' ? 'Live weather data incomplete' : weather.weather.status === 'elevated_weather_risk' ? 'Elevated weather signal' : 'No elevated weather signal detected'}</p><dl className="wi-detail-list"><div><dt>Suggested battery target</dt><dd>{fmt(weather.battery.suggestedTargetSocPct)}%</dd></div><div><dt>Minimum modeled charge time</dt><dd>{fmt(weather.battery.minimumChargeTimeHours)} hours</dd></div><div><dt>Essential backup at current charge</dt><dd>{fmt(weather.battery.currentEssentialBackupHours)} hours</dd></div></dl>{!weather.battery.backupGoalFeasible && <p className="wi-error">The supplied backup goal exceeds this battery’s energy or power capability.</p>}<p className="wi-muted">Weather: {weather.weather.source} · Alerts: {weather.weather.alertStatus}. A weather signal does not confirm an outage. Suggestions do not control devices.</p></>}
        </Panel>
      </div>
    </>}
  </>;
}

function SavingsInsights() {
  const [scenario, setScenario] = useState('shift');
  const reference = scenario === 'flat' ? flatPlan : scenario === 'wear' ? {...samplePlan, config: {...samplePlan.config, wearUsdPerKwh: .5}} : samplePlan;
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState(null);
  const [asking, setAsking] = useState(false);
  const chatRequest = useRef(null);
  useEffect(() => {
    const controller = new AbortController(); chatRequest.current?.abort();
    setPlan(null); setError(''); setLoading(true); setExplanation(null); setAsking(false);
    api('/api/insights/evaluate', {body: reference, signal: controller.signal})
      .then(result => {if (!controller.signal.aborted) setPlan(result);})
      .catch(e => {if (!controller.signal.aborted) setError(e.message);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => {controller.abort(); chatRequest.current?.abort();};
  }, [scenario]);
  async function explainPlan() {
    const controller = new AbortController(); chatRequest.current = controller;
    setAsking(true); setError('');
    try {
      const result = await api('/api/insights/chat', {body: {planId: plan.planId, question: 'Explain the cost difference, battery wear and protected backup in this supplied plan.'}, signal: controller.signal});
      if (!controller.signal.aborted) setExplanation(result);
    } catch (e) {if (!controller.signal.aborted) setError(e.message);}
    finally {if (!controller.signal.aborted) setAsking(false);}
  }
  return <>
    <div className="wi-toolbar"><div className="wi-segments"><button type="button" className={scenario === 'shift' ? 'active' : ''} onClick={() => setScenario('shift')}>Peak-shifting reference</button><button type="button" className={scenario === 'flat' ? 'active' : ''} onClick={() => setScenario('flat')}>Flat-price reference</button><button type="button" className={scenario === 'wear' ? 'active' : ''} onClick={() => setScenario('wear')}>High-wear reference</button></div></div>
    <div className="wi-notice"><strong>Validated reference scenarios</strong><span>These fixed sample plans are separate from your selected home and the rolling weather forecast. The Python evaluator checks energy balance, reserve limits and equal ending battery energy.</span></div>
    {scenario === 'wear' && <p className="wi-muted">Stress test: a supplied wear allowance of $0.50 per discharged kWh outweighs energy-price savings. It is illustrative, not measured battery degradation.</p>}
    {error && <p className="wi-error" role="alert">{error}</p>}{loading && <p role="status">Evaluating sample plan…</p>}
    {plan && <>
      <div className="wi-metrics"><Metric label="Baseline battery cost" value={usd(plan.metrics.baselineCostUsd)} note="Same demand, solar and tariff"/><Metric label="Planned battery cost" value={usd(plan.metrics.plannedCostUsd)} note={`Includes ${usd(plan.metrics.estimatedWearUsd)} wear`}/><Metric label="Projected daily difference" value={usd(plan.metrics.savingsVsBaselineUsd)} note="Negative differences remain visible"/><Metric label="Protected backup" value={`${fmt(plan.metrics.reservedBackupHours)} h`} note={plan.metrics.backupGoalFeasible ? 'Constant essential-load estimate' : 'Backup goal not feasible'}/></div>
      <div className="wi-two-column"><Panel title="A fair comparison" note="Both battery cases end with the same stored energy."><dl className="wi-detail-list"><div><dt>Starting stored energy</dt><dd>{fmt(plan.metrics.startingStoredKwh, 2)} kWh</dd></div><div><dt>Ending stored energy</dt><dd>{fmt(plan.metrics.endingStoredKwh, 2)} kWh</dd></div><div><dt>Protected reserve</dt><dd>{fmt(plan.metrics.reservePct)}%</dd></div><div><dt>Grid-only energy cost</dt><dd>{usd(plan.metrics.gridOnlyCostUsd)}</dd></div></dl><p className="wi-muted">Fixed fees, taxes, battery purchase costs and incentives are excluded. Synthetic rates are not a verified utility tariff.</p></Panel>
      <Panel title="Repeat-day projection" note="An illustration, not a seasonal forecast."><strong className="wi-large">{usd(plan.repeatDayProjection.monthlyUsd)}</strong><p>30 identical days</p><p className="wi-muted">{plan.repeatDayProjection.assumption}</p><button type="button" className="wi-button wi-primary" disabled={asking} onClick={explainPlan}>{asking ? 'Preparing explanation…' : 'Explain this plan'}</button>{explanation && <article className="wi-message wi-message-assistant"><span>{explanation.provider === 'gemini' ? `GEMINI · ${explanation.model}` : 'LOCAL RULES · FALLBACK'}</span><p>{explanation.answer.replace(/\*\*/g, '')}</p>{explanation.warning && <small>{explanation.warning}</small>}</article>}</Panel></div>
      <Panel title="Hourly plan" note="Power values apply to one-hour intervals; stored energy is measured at the end of each hour."><div className="wi-table-scroll"><table><thead><tr><th>Hour</th><th>Price / kWh</th><th>Baseline grid</th><th>Planned grid</th><th>Stored energy</th><th>Event</th></tr></thead><tbody>{plan.schedule.map((row, i) => <tr key={row.hour}><td>{String(row.hour).padStart(2, '0')}:00</td><td>{usd(row.priceUsdPerKwh)}</td><td>{fmt(reference.baseline[i].gridKw)} kW</td><td>{fmt(row.gridKw)} kW</td><td>{fmt(row.storedKwh, 2)} kWh</td><td>{row.gridEvent ? 'Peak event' : '—'}</td></tr>)}</tbody></table></div></Panel>
    </>}
  </>;
}

function GridInsights() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api('/api/insights/community', {body: sampleCommunity, signal: controller.signal})
      .then(data => {if (!controller.signal.aborted) setResult(data);})
      .catch(e => {if (!controller.signal.aborted) setError(e.message);});
    return () => controller.abort();
  }, []);
  return <>
    <div className="wi-notice"><strong>A community peak, calculated together</strong><span>Two synthetic reference homes, aligned by date and hour. We add demand at each shared hour before finding the community peak. These are sample assets, not connected homes.</span></div>
    {error && <p className="wi-error" role="alert">{error}</p>}{!result && !error && <p role="status">Calculating community impact…</p>}
    {result && <><div className="wi-metrics"><Metric label="Baseline coincident peak" value={`${fmt(result.baselineCoincidentPeakKw)} kW`} note={`${result.assetsRepresented} supplied assets`}/><Metric label="Planned coincident peak" value={`${fmt(result.plannedCoincidentPeakKw)} kW`} note="Includes off-peak battery charging"/><Metric label="Event energy avoided" value={`${fmt(result.eventEnergyAvoidedKwh)} kWh`} note="Compared with baseline battery plans"/><Metric label="Reserve ready at end" value={`${result.backupGoalsMetAtEnd}/${result.assetsRepresented}`} note="At supplied essential backup goals"/></div>
    <Panel title="Demand at the shared peak hour" note={`At ${result.baselinePeakHour}:00, baseline demand was ${fmt(result.baselineCoincidentPeakKw)} kW; planned demand at that same hour was ${fmt(result.plannedKwAtBaselinePeakHour)} kW.`}><div className="wi-demand-bars"><div><span>Baseline community</span><div><i style={{width: '100%'}}/></div><b>{fmt(result.baselineCoincidentPeakKw)} kW</b></div><div><span>Planned community</span><div><i style={{width: `${Math.min(100, result.plannedKwAtBaselinePeakHour / Math.max(.001, result.baselineCoincidentPeakKw) * 100)}%`}}/></div><b>{fmt(result.plannedKwAtBaselinePeakHour)} kW</b></div></div><p className="wi-muted">The planned community’s maximum may occur at a different hour. Energy shifting does not establish a carbon reduction.</p></Panel>
    <Panel title="Community hourly demand" note="Baseline and planned grid power, summed across both reference homes."><div className="wi-table-scroll"><table><thead><tr><th>Hour</th><th>Baseline grid</th><th>Planned grid</th><th>Difference</th></tr></thead><tbody>{result.hourly.map(row => <tr key={row.hour}><td>{String(row.hour).padStart(2,'0')}:00</td><td>{fmt(row.baselineGridKw)} kW</td><td>{fmt(row.plannedGridKw)} kW</td><td>{fmt(row.baselineGridKw - row.plannedGridKw)} kW</td></tr>)}</tbody></table></div></Panel></>}
  </>;
}

export default function InsightsPage() {
  const profile = useHouseholdProfile();
  const households = useHouseholds();
  const [tab, setTab] = useState('household');
  return <main className="wi-page"><header className="wi-heading"><span>YOUR HOME / INSIGHTS</span><h1>Understand the change. Choose your next step.</h1><p>Household evidence, useful explanations, and transparent energy comparisons.</p></header><nav className="wi-tabs" aria-label="Insights sections">{[['household','Usage & AI'],['savings','Savings simulator'],['grid','Grid impact']].map(([id,label]) => <button type="button" key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}</nav>{tab === 'household' ? <HouseholdInsights key={households.activeHomeId} profile={profile} activeHomeId={households.activeHomeId}/> : tab === 'savings' ? <SavingsInsights/> : <GridInsights/>}<footer className="wi-footer">Daily readings are simulated or supplied observations, not verified telemetry. Costs and battery plans are estimates. Wattch provides suggestions; it does not control hardware.</footer></main>;
}
