/** Pure math for the Wattch Vacation Mode *simulation*. No devices are controlled. */
export const clamp = (value, low, high) => Math.min(high, Math.max(low, Number(value)));
export function localDateISO(date = new Date()) {
  const two = x => String(x).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
export function addDays(isoDate, days) {
  const [y,m,d] = String(isoDate).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
export function dateSpan(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}
export function defaultVacationPlan(today = localDateISO()) {
  return { enabled: false, startDate: today, endDate: addDays(today, 6), awayUsagePct: 45, reservePct: 50, assumedRate: .18, criticalLoadKw: .5, preReturnHours: 4 };
}
export function normalizeVacationPlan(raw, today = localDateISO()) {
  const original = defaultVacationPlan(today);
  if (!raw || typeof raw !== 'object') return original;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const startDate = datePattern.test(raw.startDate) && !Number.isNaN(Date.parse(`${raw.startDate}T00:00:00Z`)) ? raw.startDate : original.startDate;
  const endDate = datePattern.test(raw.endDate) && !Number.isNaN(Date.parse(`${raw.endDate}T00:00:00Z`)) ? raw.endDate : original.endDate;
  const valid = (name, min, max, fallback) => Number.isFinite(Number(raw[name])) && raw[name] !== '' && raw[name] !== null ? clamp(raw[name], min, max) : fallback;
  return { enabled: !!raw.enabled, startDate, endDate,
    awayUsagePct: valid('awayUsagePct', 20, 95, original.awayUsagePct),
    reservePct: valid('reservePct', 20, 90, original.reservePct),
    assumedRate: valid('assumedRate', .01, 1, original.assumedRate),
    criticalLoadKw: valid('criticalLoadKw', .1, 10, original.criticalLoadKw),
    preReturnHours: valid('preReturnHours', 0, 12, original.preReturnHours)
  };
}
export function vacationStatus(plan, today = localDateISO()) {
  if (!plan?.enabled) return 'off';
  if (dateSpan(plan.startDate, plan.endDate) === 0) return 'invalid';
  if (today < plan.startDate) return 'scheduled';
  if (today > plan.endDate) return 'completed';
  return 'active';
}
/** Every number is an illustrative estimate, not a metered measurement or utility tariff. */
export function calculateVacation(profile = {}, rawPlan = defaultVacationPlan(), today = localDateISO()) {
  const plan = normalizeVacationPlan(rawPlan, today);
  const days = dateSpan(plan.startDate, plan.endDate);
  const baselineDailyKwh = clamp(profile.monthlyElectricKwh ?? 600, 0, 20000) / 30;
  const assumedRate = plan.assumedRate;
  const awayDailyKwh = baselineDailyKwh * plan.awayUsagePct / 100;
  const recoveryKwh = Math.min(12, plan.preReturnHours) / 24 * Math.max(0, baselineDailyKwh - awayDailyKwh);
  const baselineKwh = days * baselineDailyKwh;
  const projectedKwh = days * awayDailyKwh + (days ? recoveryKwh : 0);
  const avoidedKwh = Math.max(0, baselineKwh - projectedKwh);
  const capacity = clamp(profile.batteryCapacityKwh ?? 13.5, 0, 1000);
  const startingSoc = clamp(profile.startingSocPct ?? 55, 0, 100);
  const goalReserve=capacity?clamp((profile.backupGoalHours??8)*plan.criticalLoadKw/.9/capacity*100,0,100):100;
  const protectedReservePct = Math.max(clamp(profile.backupReservePct ?? 30, 0, 100), plan.reservePct,goalReserve);
  const protectedEnergyKwh = capacity * Math.min(startingSoc, protectedReservePct) / 100;
  const backupHours = plan.criticalLoadKw<=(profile.maxBatteryPowerKw??5)?protectedEnergyKwh*.9/plan.criticalLoadKw:0;
  return {
    status: vacationStatus(plan, today), days,
    baselineDailyKwh, awayDailyKwh, baselineKwh, projectedKwh, avoidedKwh,
    baselineCost: baselineKwh * assumedRate,
    projectedCost: projectedKwh * assumedRate,
    estimatedSavings: avoidedKwh * assumedRate,
    protectedReservePct, protectedEnergyKwh, backupHours,
    awayUsagePct: plan.awayUsagePct, preReturnHours: plan.preReturnHours
  };
}
