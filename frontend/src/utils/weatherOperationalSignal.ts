import type { WeatherForecast, WeatherOperationalSignal, WeatherOperationalSignalDay, WeatherRiskLevel } from '../types';

const HIGH_RISK_SUMMARY_TERMS = ['thunder', 'storm', 'blizzard', 'ice', 'tornado', 'hail'];
const MODERATE_RISK_SUMMARY_TERMS = ['rain', 'snow', 'wind', 'fog', 'sleet', 'drizzle'];

function classifyWeatherRisk(summary: string, temperatureF: number): WeatherRiskLevel {
  const normalizedSummary = summary.toLowerCase();

  if (
    temperatureF >= 95
    || temperatureF <= 15
    || HIGH_RISK_SUMMARY_TERMS.some((term) => normalizedSummary.includes(term))
  ) {
    return 'high';
  }

  if (
    temperatureF >= 85
    || temperatureF <= 25
    || MODERATE_RISK_SUMMARY_TERMS.some((term) => normalizedSummary.includes(term))
  ) {
    return 'moderate';
  }

  return 'low';
}

export function buildWeatherOperationalSignal(weather: WeatherForecast[]): WeatherOperationalSignal {
  if (weather.length === 0) {
    return {
      hasData: false,
      locationLabel: 'Context unresolved',
      sourceLabel: 'Unknown',
      immediateSummary: 'No weather feed available for current operational context.',
      averageTempF: 0,
      minTempF: 0,
      maxTempF: 0,
      temperatureSpread: 0,
      moderateRiskDayCount: 0,
      highRiskDayCount: 0,
      days: [],
    };
  }

  const days: WeatherOperationalSignalDay[] = weather.map((item) => ({
    date: item.date,
    temperatureC: item.temperatureC,
    temperatureF: item.temperatureF,
    summary: item.summary,
    riskLevel: classifyWeatherRisk(item.summary, item.temperatureF),
  }));

  const temperatures = days.map((item) => item.temperatureF);
  const averageTempF = Math.round(temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length);
  const minTempF = Math.min(...temperatures);
  const maxTempF = Math.max(...temperatures);
  const temperatureSpread = maxTempF - minTempF;
  const highRiskDayCount = days.filter((item) => item.riskLevel === 'high').length;
  const moderateRiskDayCount = days.filter((item) => item.riskLevel === 'moderate').length;

  const locationLabel = weather.find((item) => typeof item.locationLabel === 'string' && item.locationLabel.trim().length > 0)?.locationLabel?.trim() ?? 'Context unresolved';
  const sourceLabel = weather.find((item) => typeof item.source === 'string' && item.source.trim().length > 0)?.source?.trim() ?? 'Unknown';

  const immediateSummary = highRiskDayCount > 0
    ? `${highRiskDayCount} high-risk weather day(s) detected. Initiate weather contingency checks.`
    : moderateRiskDayCount > 0
      ? `${moderateRiskDayCount} watch-level weather day(s) detected. Monitor operational impacts.`
      : 'Weather trend is stable for current forecast horizon.';

  return {
    hasData: true,
    locationLabel,
    sourceLabel,
    immediateSummary,
    averageTempF,
    minTempF,
    maxTempF,
    temperatureSpread,
    moderateRiskDayCount,
    highRiskDayCount,
    days,
  };
}
