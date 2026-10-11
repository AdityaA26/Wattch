/** Same-origin calls through Vite. Credentials stay on the Python server. */
export async function api(path, {body, signal} = {}) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', signal,
    ...(body === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

export function homeId(id) {
  // A readable prefix plus a hash keeps long browser IDs distinct within the API limit.
  const value = String(id);
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return `ui-${value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 43)}-${hash.toString(16)}`;
}

export function backendProfile(profile, id) {
  return {
    householdId: homeId(id), occupants: profile.occupants,
    floorAreaSqft: profile.squareFeet, latitude: profile.latitude,
    longitude: profile.longitude, timezone: profile.timezone,
    region: `${profile.city}, ${profile.state}`.slice(0, 80), peerOptIn: profile.peerOptIn===true,
    batteryCapacityKwh: Math.max(.01, profile.batteryCapacityKwh),
    startingSocPct: profile.startingSocPct, reservePct: profile.backupReservePct,
    maxBatteryPowerKw: profile.maxBatteryPowerKw, solarCapacityKw: profile.solarCapacityKw,
    essentialLoadKw: profile.essentialLoadKw ?? .55, backupGoalHours: profile.backupGoalHours ?? 8,
  };
}

export function demoReadings(profile, end = new Date()) {
  const rows = [];
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  for (let age = 0; age < 42; age++) {
    const day = new Date(last); day.setUTCDate(day.getUTCDate() - age);
    for (const [utility, unit, base, unitRateUsd] of [
      ['electricity', 'kWh', profile.monthlyElectricKwh / 30, .18],
      ['water', 'gal', 145, .006], ['gas', 'therms', 1.2, 1.4],
    ]) {
      const increase = age < 7 ? (utility === 'water' ? 1.5 : utility === 'electricity' ? 1.35 : 1) : 1;
      rows.push({date: day.toISOString().slice(0, 10), utility, unit,
        quantity: +(base * (1 + ((age % 7) - 3) * .015) * increase).toFixed(4),
        unitRateUsd, source: 'simulated'});
    }
  }
  return rows;
}
