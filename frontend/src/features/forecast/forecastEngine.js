// Offline, deterministic 24-hour demo forecast. Replace with a documented API later.
export const WEATHER_SCENARIOS = {
  clear: { label: 'Clear skies', temperature: 79, condition: 'Sunny', solarFactor: 1, priceOffset: 0 },
  cloudy: { label: 'Cloudy', temperature: 71, condition: 'Overcast', solarFactor: 0.45, priceOffset: 0.015 },
  storm: { label: 'Storm warning', temperature: 68, condition: 'Thunderstorms', solarFactor: 0.12, priceOffset: 0.04 },
};

export function formatHour(hour) {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelveHour = hour % 12 || 12;
  return `${twelveHour} ${suffix}`;
}

export function buildForecast(scenario = 'clear') {
  const weather = WEATHER_SCENARIOS[scenario] || WEATHER_SCENARIOS.clear;
  return Array.from({ length: 24 }, (_, hour) => {
    const peak = hour >= 16 && hour <= 21;
    const offPeak = hour <= 6;
    const daylight = hour >= 7 && hour <= 18;
    const heatDemand = hour >= 12 && hour <= 18 ? 0.016 : 0;
    const rate = 0.135 + (peak ? 0.155 : 0) - (offPeak ? 0.053 : 0)
      + heatDemand + weather.priceOffset + 0.012 * Math.sin(hour * 1.2);
    const solarKw = daylight
      ? Math.max(0, Math.round(Math.sin(((hour - 7) / 11) * Math.PI) * 85 * weather.solarFactor))
      : 0;
    const demandKw = Math.round(64 + (peak ? 42 : 0) + (hour >= 9 && hour <= 17 ? 18 : 0)
      + (scenario === 'storm' ? 8 : 0));
    return {
      hour,
      label: formatHour(hour),
      rate: Number(rate.toFixed(3)),
      solarKw,
      demandKw,
      period: peak ? 'Peak' : offPeak ? 'Off-peak' : 'Standard',
    };
  });
}

export function summarizeForecast(points, scenario, reservePercent) {
  const lowest = [...points].sort((a, b) => a.rate - b.rate)[0];
  const highest = [...points].sort((a, b) => b.rate - a.rate)[0];
  const peakPoints = points.filter((point) => point.period === 'Peak');
  const average = points.reduce((sum, point) => sum + point.rate, 0) / points.length;
  const storm = scenario === 'storm';
  const alerts = [
    {
      id: 'price',
      severity: 'high',
      title: 'High-price window predicted',
      detail: `Rates reach ${(highest.rate * 100).toFixed(1)}¢/kWh around ${highest.label}. Shift flexible usage out of 4–9 PM.`,
    },
    {
      id: 'charge',
      severity: 'info',
      title: 'Recommended charging window',
      detail: `Charge your battery near ${lowest.label}, when forecast pricing is ${(lowest.rate * 100).toFixed(1)}¢/kWh.`,
    },
  ];
  if (storm) {
    alerts.unshift({
      id: 'weather', severity: 'high', title: 'Potential outage conditions',
      detail: 'Storm scenario selected. Preserve extra battery reserve and confirm local utility advisories.',
    });
  } else if (scenario === 'cloudy') {
    alerts.push({
      id: 'solar', severity: 'info', title: 'Reduced solar generation',
      detail: 'Cloud cover lowers modeled solar production. Consider pre-charging during off-peak hours.',
    });
  }
  if (reservePercent < 25) {
    alerts.push({
      id: 'reserve', severity: 'high', title: 'Low resilience reserve setting',
      detail: 'Increase your minimum battery reserve to at least 25% when outage risk matters.',
    });
  }
  return {
    lowest, highest, average, peakAverage: peakPoints.reduce((sum, p) => sum + p.rate, 0) / peakPoints.length,
    totalSolarKwh: points.reduce((sum, p) => sum + p.solarKw, 0),
    alerts,
    risk: storm ? 'Elevated (demo)' : 'Low (demo)',
  };
}
