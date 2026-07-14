export type VisualizationTarget = 'dashboard' | 'reports';

export type VisualizationTimeGrain = 'hour' | 'day' | 'week' | 'month';

export type VisualizationGrouping = 'status' | 'type' | 'provider' | 'severity';

export type VisualizationSpec = {
  schemaVersion: number;
  specVersion: number;
  target: VisualizationTarget;
  promptText: string;
  normalizedPrompt: string;
  intent: string[];
  widgetIds: string[];
  chartTypes: string[];
  timeGrain: VisualizationTimeGrain;
  topN: number | null;
  grouping: VisualizationGrouping;
  thresholdPercent: number | null;
  generatedUtc: string;
};

const VALID_TARGETS: VisualizationTarget[] = ['dashboard', 'reports'];
const VALID_TIME_GRAINS: VisualizationTimeGrain[] = ['hour', 'day', 'week', 'month'];
const VALID_GROUPINGS: VisualizationGrouping[] = ['status', 'type', 'provider', 'severity'];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  return null;
}

export function parseVisualizationSpecJson(
  specJson: string,
  fallbackTarget: VisualizationTarget,
): VisualizationSpec | null {
  try {
    const parsed = JSON.parse(specJson) as Partial<VisualizationSpec>;

    const widgetIds = asStringArray(parsed.widgetIds);
    if (widgetIds.length === 0) {
      return null;
    }

    const target = typeof parsed.target === 'string' && VALID_TARGETS.includes(parsed.target as VisualizationTarget)
      ? parsed.target as VisualizationTarget
      : fallbackTarget;

    const timeGrain = typeof parsed.timeGrain === 'string' && VALID_TIME_GRAINS.includes(parsed.timeGrain as VisualizationTimeGrain)
      ? parsed.timeGrain as VisualizationTimeGrain
      : 'day';

    const grouping = typeof parsed.grouping === 'string' && VALID_GROUPINGS.includes(parsed.grouping as VisualizationGrouping)
      ? parsed.grouping as VisualizationGrouping
      : (target === 'dashboard' ? 'status' : 'provider');

    const generatedUtc = typeof parsed.generatedUtc === 'string' && !Number.isNaN(Date.parse(parsed.generatedUtc))
      ? parsed.generatedUtc
      : new Date().toISOString();

    const topN = typeof parsed.topN === 'number' && Number.isFinite(parsed.topN) && parsed.topN > 0
      ? Math.round(parsed.topN)
      : null;

    const thresholdPercent = typeof parsed.thresholdPercent === 'number'
      && Number.isFinite(parsed.thresholdPercent)
      && parsed.thresholdPercent >= 0
      && parsed.thresholdPercent <= 100
      ? Number(parsed.thresholdPercent.toFixed(2))
      : null;

    const promptText = typeof parsed.promptText === 'string' ? parsed.promptText : '';
    const normalizedPrompt = typeof parsed.normalizedPrompt === 'string'
      ? parsed.normalizedPrompt
      : promptText.trim().toLowerCase();

    return {
      schemaVersion: asPositiveInt(parsed.schemaVersion) ?? 1,
      specVersion: asPositiveInt(parsed.specVersion) ?? 1,
      target,
      promptText,
      normalizedPrompt,
      intent: asStringArray(parsed.intent).length > 0 ? asStringArray(parsed.intent) : ['general'],
      widgetIds,
      chartTypes: asStringArray(parsed.chartTypes).length > 0 ? asStringArray(parsed.chartTypes) : ['auto'],
      timeGrain,
      topN,
      grouping,
      thresholdPercent,
      generatedUtc,
    };
  } catch {
    return null;
  }
}

const DASHBOARD_WIDGET_KEYWORDS: Array<{ widgetId: string; terms: string[] }> = [
  { widgetId: 'kpi-load', terms: ['kpi', 'incident', 'task', 'load', 'volume'] },
  { widgetId: 'gauge-readiness', terms: ['readiness', 'ready', 'health', 'gauge'] },
  { widgetId: 'gauge-compliance', terms: ['compliance', 'nims', 'policy', 'audit'] },
  { widgetId: 'gauge-maturity', terms: ['maturity', 'type', 'capability'] },
  { widgetId: 'bar-posture', terms: ['bar', 'posture', 'distribution', 'compare'] },
];

const REPORT_WIDGET_KEYWORDS: Array<{ widgetId: string; terms: string[] }> = [
  { widgetId: 'kpi-governance-posture', terms: ['kpi', 'governance', 'overview', 'executive'] },
  { widgetId: 'line-volume', terms: ['line', 'volume', 'trend', 'temporal', 'time'] },
  { widgetId: 'line-success-vs-failure', terms: ['success', 'failure', 'compare', 'outcome'] },
  { widgetId: 'area-failure-trend', terms: ['area', 'failure', 'risk', 'rate', 'threshold'] },
  { widgetId: 'scatter-provider-risk', terms: ['scatter', 'provider', 'risk', 'correlat'] },
  { widgetId: 'bar-provider-failure-rate', terms: ['bar', 'rank', 'top', 'provider'] },
];

const INTENT_TERMS: Array<{ intent: string; terms: string[] }> = [
  { intent: 'executive-brief', terms: ['executive', 'brief', 'briefing'] },
  { intent: 'governance', terms: ['governance', 'audit', 'compliance'] },
  { intent: 'risk-surveillance', terms: ['risk', 'watch', 'surveillance', 'failure'] },
  { intent: 'capacity-throughput', terms: ['capacity', 'throughput', 'load', 'volume'] },
  { intent: 'trend-analysis', terms: ['trend', 'time', 'temporal', 'history'] },
];

function hasTerm(normalizedPrompt: string, term: string): boolean {
  return normalizedPrompt.includes(term);
}

function extractTopN(normalizedPrompt: string): number | null {
  const explicitTop = normalizedPrompt.match(/\btop\s+(\d{1,2})\b/);
  if (explicitTop) {
    const parsed = Number.parseInt(explicitTop[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const genericNumber = normalizedPrompt.match(/\b(\d{1,2})\b/);
  if (!genericNumber) {
    return null;
  }

  const parsed = Number.parseInt(genericNumber[1], 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 50 ? parsed : null;
}

function extractThresholdPercent(normalizedPrompt: string): number | null {
  const percent = normalizedPrompt.match(/\b(\d{1,3})\s*%\b/);
  if (percent) {
    const parsed = Number.parseInt(percent[1], 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }

  const threshold = normalizedPrompt.match(/\bthreshold\s+(\d{1,3})\b/);
  if (!threshold) {
    return null;
  }

  const parsed = Number.parseInt(threshold[1], 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function extractTimeGrain(normalizedPrompt: string): VisualizationTimeGrain {
  if (hasTerm(normalizedPrompt, 'hour') || hasTerm(normalizedPrompt, 'hourly')) {
    return 'hour';
  }
  if (hasTerm(normalizedPrompt, 'week') || hasTerm(normalizedPrompt, 'weekly')) {
    return 'week';
  }
  if (hasTerm(normalizedPrompt, 'month') || hasTerm(normalizedPrompt, 'monthly')) {
    return 'month';
  }
  return 'day';
}

function extractGrouping(normalizedPrompt: string, target: VisualizationTarget): VisualizationGrouping {
  if (hasTerm(normalizedPrompt, 'status')) {
    return 'status';
  }
  if (hasTerm(normalizedPrompt, 'type')) {
    return 'type';
  }
  if (hasTerm(normalizedPrompt, 'severity')) {
    return 'severity';
  }

  if (target === 'reports' || hasTerm(normalizedPrompt, 'provider')) {
    return 'provider';
  }

  return target === 'dashboard' ? 'status' : 'provider';
}

function extractIntent(normalizedPrompt: string): string[] {
  const intents = INTENT_TERMS
    .filter((entry) => entry.terms.some((term) => hasTerm(normalizedPrompt, term)))
    .map((entry) => entry.intent);

  return intents.length > 0 ? intents : ['general'];
}

function inferChartTypes(normalizedPrompt: string): string[] {
  const chartTypes = new Set<string>();

  if (hasTerm(normalizedPrompt, 'line')) {
    chartTypes.add('line');
  }
  if (hasTerm(normalizedPrompt, 'bar')) {
    chartTypes.add('bar');
  }
  if (hasTerm(normalizedPrompt, 'area')) {
    chartTypes.add('area');
  }
  if (hasTerm(normalizedPrompt, 'scatter')) {
    chartTypes.add('scatter');
  }
  if (hasTerm(normalizedPrompt, 'gauge')) {
    chartTypes.add('gauge');
  }
  if (hasTerm(normalizedPrompt, 'kpi')) {
    chartTypes.add('kpi');
  }

  return chartTypes.size > 0 ? Array.from(chartTypes) : ['auto'];
}

function deriveWidgetsFromKeywords(
  normalizedPrompt: string,
  keywords: Array<{ widgetId: string; terms: string[] }>,
  fallbackWidgetId: string,
): string[] {
  const matched = keywords
    .filter((entry) => entry.terms.some((term) => hasTerm(normalizedPrompt, term)))
    .map((entry) => entry.widgetId);

  if (matched.length === 0) {
    return [fallbackWidgetId];
  }

  return Array.from(new Set(matched));
}

export function generateVisualizationSpec(target: VisualizationTarget, promptText: string): VisualizationSpec {
  const normalizedPrompt = promptText.trim().toLowerCase();
  const isDashboard = target === 'dashboard';
  const keywordSet = isDashboard ? DASHBOARD_WIDGET_KEYWORDS : REPORT_WIDGET_KEYWORDS;
  const fallbackWidgetId = isDashboard ? 'kpi-load' : 'kpi-governance-posture';

  let widgetIds = deriveWidgetsFromKeywords(normalizedPrompt, keywordSet, fallbackWidgetId);

  if (isDashboard && normalizedPrompt.includes('executive')) {
    widgetIds = ['kpi-load', 'gauge-readiness', 'gauge-compliance'];
  } else if (isDashboard && normalizedPrompt.includes('resilience')) {
    widgetIds = ['gauge-maturity', 'gauge-compliance', 'bar-posture'];
  } else if (isDashboard && normalizedPrompt.includes('recovery')) {
    widgetIds = ['gauge-readiness', 'bar-posture', 'kpi-load'];
  } else if (!isDashboard && normalizedPrompt.includes('governance')) {
    widgetIds = ['kpi-governance-posture', 'line-success-vs-failure', 'area-failure-trend', 'bar-provider-failure-rate'];
  } else if (!isDashboard && (normalizedPrompt.includes('surveillance') || normalizedPrompt.includes('watch'))) {
    widgetIds = ['kpi-governance-posture', 'area-failure-trend', 'scatter-provider-risk'];
  } else if (!isDashboard && (normalizedPrompt.includes('capacity') || normalizedPrompt.includes('throughput'))) {
    widgetIds = ['kpi-governance-posture', 'line-volume', 'line-success-vs-failure', 'scatter-provider-risk'];
  }

  return {
    schemaVersion: 1,
    specVersion: 1,
    target,
    promptText,
    normalizedPrompt,
    intent: extractIntent(normalizedPrompt),
    widgetIds,
    chartTypes: inferChartTypes(normalizedPrompt),
    timeGrain: extractTimeGrain(normalizedPrompt),
    topN: extractTopN(normalizedPrompt),
    grouping: extractGrouping(normalizedPrompt, target),
    thresholdPercent: extractThresholdPercent(normalizedPrompt),
    generatedUtc: new Date().toISOString(),
  };
}
