/** One browser-local vacation plan per Wattch household, shared reactively across pages. */
import { useSyncExternalStore } from 'react';
import { getHouseholds, useHouseholds } from './householdProfile.js';
import { defaultVacationPlan, normalizeVacationPlan, localDateISO, vacationStatus, calculateVacation } from './vacationCalculations.js';

export const VACATION_KEY = 'wattch-vacation-plans-v1';
const listeners = new Set();
function initialPlans() {
  if (typeof window === 'undefined') return {};
  try {
    const data = JSON.parse(window.localStorage.getItem(VACATION_KEY) || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}
let plans = initialPlans();
function readSnapshot() { return plans; }
function subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); }
function publish(next) {
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(VACATION_KEY, JSON.stringify(next)); }
    catch { throw new Error('Browser storage is unavailable. Vacation plan was not saved.'); }
  }
  plans = next;
  listeners.forEach(listener => listener());
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === VACATION_KEY || event.key === null) {
      plans = initialPlans();
      listeners.forEach(listener => listener());
    }
  });
}
export function useVacationMode() {
  const household = useHouseholds();
  const state = useSyncExternalStore(subscribe, readSnapshot, () => ({}));
  const plan = normalizeVacationPlan(state[household.activeHomeId]);
  const status = vacationStatus(plan);
  return { plan, status, activeHomeId: household.activeHomeId };
}
export function getVacationForHome(homeId = getHouseholds().activeHomeId) {
  return normalizeVacationPlan(plans[homeId]);
}
export function saveVacationPlan(patch, homeId = getHouseholds().activeHomeId) {
  const nextPlan = normalizeVacationPlan({ ...getVacationForHome(homeId), ...patch });
  if (nextPlan.endDate < nextPlan.startDate) throw new Error('Your return date must be on or after your departure date.');
  if ((Date.parse(`${nextPlan.endDate}T00:00:00Z`) - Date.parse(`${nextPlan.startDate}T00:00:00Z`)) / 86400000 > 89) throw new Error('Choose a trip of 90 days or fewer.');
  publish({ ...plans, [homeId]: nextPlan });
  return nextPlan;
}
export function toggleVacationMode(enabled, homeId = getHouseholds().activeHomeId) {
  let plan = getVacationForHome(homeId);
  const today = localDateISO();
  if (enabled && (vacationStatus({...plan,enabled:true}, today) === 'completed' || vacationStatus({...plan,enabled:true}, today) === 'invalid')) {
    plan = defaultVacationPlan(today);
  }
  return saveVacationPlan({...plan,enabled},homeId);
}
export {calculateVacation, vacationStatus};
