import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row } from 'react-bootstrap';
import type { ColDef } from 'ag-grid-community';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import IpocDataGrid from '../common/IpocDataGrid';
import {
  deleteUserReportPreset,
  exportExternalProviderHealthExecutivePacketZip,
  exportExternalProviderHealthGovernanceCsv,
  exportExternalProviderHealthScorecardCsv,
  getAgentPredictiveDemandSupply,
  getExternalProviderHealthFederationSummary,
  getExternalProviderHealthTrends,
  getUserReportPresets,
  upsertUserReportPreset,
} from '../../api';
import { generateVisualizationSpec, parseVisualizationSpecJson } from './visualizationPrompt';
import type {
  DashboardSummary,
  AgentPredictiveDemandSupplyResponse,
  ExternalProviderHealthFederationSummary,
  ExternalProviderHealthTrends,
  IncidentSummary,
  LookupValue,
} from '../../types';
import { writeCopCommandHandoffContext } from '../../utils/copHandoffContext';

type ReportingWorkspaceCardProps = {
  incidents: IncidentSummary[];
  incidentStatusLookups: LookupValue[];
  incidentTypeLookups: LookupValue[];
  dashboardSummary: DashboardSummary | null;
  reportWindowDays: number;
  reportGroupBy: 'status' | 'type';
  reportStatusFilter: string;
  reportTypeFilter: string;
  setReportWindowDays: (value: number) => void;
  setReportGroupBy: (value: 'status' | 'type') => void;
  setReportStatusFilter: (value: string) => void;
  setReportTypeFilter: (value: string) => void;
  reportOperatorDisplayName?: string;
  onNavigateToView?: (view: 'incidents' | 'planning' | 'operations' | 'after-action') => void;
  onNotify?: (message: string, variant: 'success' | 'danger' | 'warning' | 'info') => void;
};

type GeneratedVisualizationSpecRecord = {
  id: string;
  name: string;
  specJson: string;
  userReportPresetId?: number;
  source?: 'local' | 'server';
  updatedUtc?: string;
  createdBy?: string;
};

type ReportTemplatePreset = {
  id: string;
  name: string;
  widgetIds: string[];
  userReportPresetId?: number;
  source?: 'local' | 'server';
  updatedUtc?: string;
};

const REPORT_TEMPLATE_PRESET_SCOPE = 'reports-template-presets-v1';
const REPORT_TEMPLATE_PRESET_LOCAL_KEY = 'ipoc.reports.templatePresets';
const REPORT_GENERATED_SPECS_SCOPE = 'reports-generated-visualization-specs-v1';
const REPORT_GENERATED_SPECS_LOCAL_KEY = 'ipoc.reports.generatedVisualizationSpecs';
const REPORT_PALETTE_SCOPE = 'reports-visualization-palette-v1';
const REPORT_PALETTE_LOCAL_KEY = 'ipoc.reports.visualizationPalette';
const REPORT_PALETTE_PANE_OPEN_KEY = 'ipoc.reports.palettePaneExpanded';
const REPORT_CANVAS_PANE_OPEN_KEY = 'ipoc.reports.canvasPaneExpanded';
const REPORT_FILTER_PRESET_SCOPE = 'reports-linked-filter-presets-v1';
const REPORT_APPROVAL_DECISIONS_SCOPE = 'reports-pending-approval-decisions-v1';
const REPORT_DECISION_HISTORY_SCOPE = 'reports-pending-approval-decision-history-v1';
const REPORT_ASSISTANT_PREFILL_PROMPT_KEY = 'ipoc.agent.prefillPrompt';
const REPORT_EXECUTIVE_BRIEF_CACHE_LOCAL_KEY = 'ipoc.reports.executiveDecisionBriefCache.v1';
const REPORT_EXECUTIVE_BRIEF_STALE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type ReportFilterPreset = {
  id: string;
  name: string;
  windowDays: number;
  groupBy: 'status' | 'type';
  statusFilter: string;
  typeFilter: string;
  drilldownGroup?: string | null;
  drilldownSeverity?: string | null;
  userReportPresetId?: number;
  source?: 'local' | 'server';
};

type VisualizationPalette = {
  series1: string;
  series2: string;
  series3: string;
  critical: string;
  warning: string;
  success: string;
  info: string;
  neutral: string;
};

type ReportPendingApprovalDecision = {
  incidentId: number;
  decision: 'Approved' | 'Deferred' | 'Rejected';
  decidedAtUtc: string;
  decidedByDisplayName?: string;
  rationale?: string;
};

type ExecutiveDeltaSummary = {
  volumeDelta: number;
  severityDelta: number;
  activityDelta: number;
};

type ExecutiveDecisionBriefPackage = {
  narrative: string;
  recommendationCount: number;
  generatedUtc: string;
  hasBaseline: boolean;
  hasDecisionHistory: boolean;
};

type ResolvedExecutiveDecisionBrief = {
  briefPackage: ExecutiveDecisionBriefPackage;
  source: 'live' | 'cache';
};

type ExecutiveDecisionBriefCache = {
  narrative: string;
  generatedUtc: string;
  recommendationCount: number;
  hasBaseline: boolean;
  hasDecisionHistory: boolean;
};

type ReportDecisionHistoryEntry = {
  incidentId: number;
  incidentNumber: string;
  incidentName: string;
  recommendation: string;
  confidencePercent: number;
  decision: 'Approved' | 'Deferred' | 'Rejected';
  decidedAtUtc: string;
  decidedByDisplayName?: string;
  rationale?: string;
};

const REPORT_DEFAULT_PALETTE: VisualizationPalette = {
  series1: '#8fb8ed',
  series2: '#8fd9c4',
  series3: '#b7c0cc',
  critical: '#e8a3ad',
  warning: '#f2c29f',
  success: '#9fd6b6',
  info: '#9ed9e8',
  neutral: '#b9c0ca',
};

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function formatDurationFromMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 'Unknown age';
  }

  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function csvEscape(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function normalizePalette(candidate: unknown, fallback: VisualizationPalette): VisualizationPalette {
  if (!candidate || typeof candidate !== 'object') {
    return fallback;
  }

  const palette = candidate as Partial<VisualizationPalette>;
  return {
    series1: isHexColor(palette.series1) ? palette.series1 : fallback.series1,
    series2: isHexColor(palette.series2) ? palette.series2 : fallback.series2,
    series3: isHexColor(palette.series3) ? palette.series3 : fallback.series3,
    critical: isHexColor(palette.critical) ? palette.critical : fallback.critical,
    warning: isHexColor(palette.warning) ? palette.warning : fallback.warning,
    success: isHexColor(palette.success) ? palette.success : fallback.success,
    info: isHexColor(palette.info) ? palette.info : fallback.info,
    neutral: isHexColor(palette.neutral) ? palette.neutral : fallback.neutral,
  };
}

function ReportingWorkspaceCard({
  incidents,
  incidentStatusLookups,
  incidentTypeLookups,
  dashboardSummary,
  reportWindowDays,
  reportGroupBy,
  reportStatusFilter,
  reportTypeFilter,
  setReportWindowDays,
  setReportGroupBy,
  setReportStatusFilter,
  setReportTypeFilter,
  reportOperatorDisplayName,
  onNavigateToView,
  onNotify,
}: ReportingWorkspaceCardProps) {
  const promptFocusTimerRef = useRef<number | null>(null);
  const [chartDrilldownGroup, setChartDrilldownGroup] = useState<string | null>(null);
  const [chartDrilldownSeverity, setChartDrilldownSeverity] = useState<string | null>(null);
  const [comparisonLeftGroup, setComparisonLeftGroup] = useState<string>('');
  const [comparisonRightGroup, setComparisonRightGroup] = useState<string>('');
  const [externalProviderTrendWindowHours, setExternalProviderTrendWindowHours] = useState<'24' | '168' | '720'>('168');
  const [predictiveHorizonHours, setPredictiveHorizonHours] = useState<24 | 48 | 72>(24);
  const [externalProviderTrendProvider, setExternalProviderTrendProvider] = useState('');
  const [predictiveDemandSupplyInsight, setPredictiveDemandSupplyInsight] = useState<AgentPredictiveDemandSupplyResponse | null>(null);
  const [predictiveDemandSupplyLoading, setPredictiveDemandSupplyLoading] = useState(false);
  const [predictiveDemandSupplyError, setPredictiveDemandSupplyError] = useState<string | null>(null);
  const [predictiveRefreshNonce, setPredictiveRefreshNonce] = useState(0);
  const [externalProviderHealthTrends, setExternalProviderHealthTrends] = useState<ExternalProviderHealthTrends | null>(null);
  const [externalProviderHealthFederationSummary, setExternalProviderHealthFederationSummary] = useState<ExternalProviderHealthFederationSummary | null>(null);
  const [externalProviderDashboardLoading, setExternalProviderDashboardLoading] = useState(false);
  const [externalProviderDashboardError, setExternalProviderDashboardError] = useState<string | null>(null);
  const [externalProviderGovernanceExportLoading, setExternalProviderGovernanceExportLoading] = useState(false);
  const [externalProviderScorecardExportLoading, setExternalProviderScorecardExportLoading] = useState(false);
  const [externalProviderExecutivePacketExportLoading, setExternalProviderExecutivePacketExportLoading] = useState(false);
  const [pendingApprovalExecutiveSummaryExportLoading, setPendingApprovalExecutiveSummaryExportLoading] = useState(false);
  const [pendingApprovalExportMode, setPendingApprovalExportMode] = useState<'decided' | 'recommended'>('decided');
  const [pendingApprovalExportIncludeEmptyRationale, setPendingApprovalExportIncludeEmptyRationale] = useState(true);
  const [pendingApprovalConfidenceFloor, setPendingApprovalConfidenceFloor] = useState<55 | 70 | 85>(55);
  const [pendingApprovalSelection, setPendingApprovalSelection] = useState<Record<number, boolean>>({});
  const [pendingApprovalDecisions, setPendingApprovalDecisions] = useState<Record<number, ReportPendingApprovalDecision>>({});
  const [pendingApprovalRationales, setPendingApprovalRationales] = useState<Record<number, string>>({});
  const [pendingApprovalDecisionHistory, setPendingApprovalDecisionHistory] = useState<ReportDecisionHistoryEntry[]>([]);
  const [executiveDeltaReferenceDateUtc, setExecutiveDeltaReferenceDateUtc] = useState<string | null>(null);
  const [executiveBriefPreviewOpen, setExecutiveBriefPreviewOpen] = useState(false);
  const [executiveBriefPreviewMarkdown, setExecutiveBriefPreviewMarkdown] = useState('');
  const [executiveBriefPreviewGeneratedUtc, setExecutiveBriefPreviewGeneratedUtc] = useState<string | null>(null);
  const [executiveBriefPreviewRecommendationCount, setExecutiveBriefPreviewRecommendationCount] = useState(0);
  const [executiveBriefPreviewHasBaseline, setExecutiveBriefPreviewHasBaseline] = useState(false);
  const [executiveBriefPreviewHasDecisionHistory, setExecutiveBriefPreviewHasDecisionHistory] = useState(false);
  const [executiveBriefPreviewLastCacheRestored, setExecutiveBriefPreviewLastCacheRestored] = useState(false);
  const [reportFilterPresetName, setReportFilterPresetName] = useState('');
  const [reportFilterPresets, setReportFilterPresets] = useState<ReportFilterPreset[]>(() => {
    try {
      const stored = localStorage.getItem('ipoc.reports.filterPresets');
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as ReportFilterPreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [templatePaneOpen, setTemplatePaneOpen] = useState<boolean>(() => {
    const persisted = localStorage.getItem('ipoc.reports.templatePaneExpanded');
    if (persisted === 'true') {
      return true;
    }
    if (persisted === 'false') {
      return false;
    }
    return true;
  });
  const [draggingAdvancedWidgetId, setDraggingAdvancedWidgetId] = useState<string | null>(null);
  const [selectedAdvancedWidgetId, setSelectedAdvancedWidgetId] = useState<string | null>(null);
  const [designCanvasMode, setDesignCanvasMode] = useState<boolean>(() => {
    const persisted = localStorage.getItem('ipoc.reports.designCanvasMode');
    return persisted === 'true';
  });
  const [canvasPaneOpen, setCanvasPaneOpen] = useState<boolean>(() => {
    const persisted = localStorage.getItem(REPORT_CANVAS_PANE_OPEN_KEY);
    if (persisted === 'true') {
      return true;
    }
    if (persisted === 'false') {
      return false;
    }
    return true;
  });
  const [palettePaneOpen, setPalettePaneOpen] = useState<boolean>(() => {
    const persisted = localStorage.getItem(REPORT_PALETTE_PANE_OPEN_KEY);
    if (persisted === 'true') {
      return true;
    }
    if (persisted === 'false') {
      return false;
    }
    return true;
  });
  const [reportPromptText, setReportPromptText] = useState('');
  const [reportPromptApplyMode, setReportPromptApplyMode] = useState<'append' | 'replace'>('append');
  const [reportGeneratedSpecs, setReportGeneratedSpecs] = useState<GeneratedVisualizationSpecRecord[]>(() => {
    try {
      const stored = localStorage.getItem(REPORT_GENERATED_SPECS_LOCAL_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as GeneratedVisualizationSpecRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [reportTemplatePresetName, setReportTemplatePresetName] = useState('');
  const [editingReportPresetId, setEditingReportPresetId] = useState<string | null>(null);
  const [editingReportPresetName, setEditingReportPresetName] = useState('');
  const [reportTemplatePresets, setReportTemplatePresets] = useState<ReportTemplatePreset[]>(() => {
    try {
      const stored = localStorage.getItem(REPORT_TEMPLATE_PRESET_LOCAL_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as ReportTemplatePreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [advancedWidgetIds, setAdvancedWidgetIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ipoc.reports.analytics.widgets');
      if (!stored) {
        return ['kpi-governance-posture', 'line-volume', 'area-failure-trend', 'scatter-provider-risk'];
      }

      const parsed = JSON.parse(stored) as string[];
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : ['kpi-governance-posture', 'line-volume', 'area-failure-trend', 'scatter-provider-risk'];
    } catch {
      return ['kpi-governance-posture', 'line-volume', 'area-failure-trend', 'scatter-provider-risk'];
    }
  });
  const [reportPalette, setReportPalette] = useState<VisualizationPalette>(() => {
    try {
      const stored = localStorage.getItem(REPORT_PALETTE_LOCAL_KEY);
      if (!stored) {
        return REPORT_DEFAULT_PALETTE;
      }

      return normalizePalette(JSON.parse(stored), REPORT_DEFAULT_PALETTE);
    } catch {
      return REPORT_DEFAULT_PALETTE;
    }
  });
  const [reportPaletteServerPresetId, setReportPaletteServerPresetId] = useState<number | null>(null);
  const nowMs = Date.now();
  const windowMs = reportWindowDays * 24 * 60 * 60 * 1000;

  const loadExternalProviderGovernanceDashboard = async () => {
    try {
      setExternalProviderDashboardLoading(true);
      setExternalProviderDashboardError(null);
      const trendWindowHours = Number.parseInt(externalProviderTrendWindowHours, 10);
      const [trends, federationSummary] = await Promise.all([
        getExternalProviderHealthTrends(externalProviderTrendProvider.trim() || undefined, trendWindowHours, 60),
        getExternalProviderHealthFederationSummary(Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30),
      ]);
      setExternalProviderHealthTrends(trends);
      setExternalProviderHealthFederationSummary(federationSummary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load external provider governance dashboard.';
      setExternalProviderDashboardError(message);
    } finally {
      setExternalProviderDashboardLoading(false);
    }
  };

  const exportPendingApprovalExecutiveSummaryCsv = () => {
    const rows = pendingApprovalRows
      .map((row) => {
        const savedDecision = pendingApprovalDecisions[row.incidentId];
        if (pendingApprovalExportMode === 'decided' && !savedDecision) {
          return null;
        }

        const decisionValue = savedDecision?.decision ?? 'Pending';
        const decisionTimestamp = savedDecision?.decidedAtUtc ?? '';
        const rationaleValue = savedDecision?.rationale ?? pendingApprovalRationales[row.incidentId] ?? '';
        if (!pendingApprovalExportIncludeEmptyRationale && rationaleValue.trim().length === 0) {
          return null;
        }

        return [
          csvEscape(row.incidentId),
          csvEscape(row.incidentNumber),
          csvEscape(row.incidentName),
          csvEscape(row.recommendation.action),
          csvEscape(Math.round(row.recommendation.confidence * 100)),
          csvEscape(decisionValue),
          csvEscape(decisionTimestamp),
          csvEscape(rationaleValue),
        ].join(',');
      })
      .filter((row): row is string => Boolean(row));

    if (rows.length === 0) {
      onNotify?.('No pending approval decisions available to export for the selected report scope.', 'warning');
      return;
    }

    setPendingApprovalExecutiveSummaryExportLoading(true);
    try {
      const generatedUtc = new Date().toISOString();
      const metadata = [
        ['GeneratedUtc', generatedUtc],
        ['ReportWindowDays', reportWindowDays],
        ['ReportGroupBy', reportGroupBy],
        ['StatusFilter', reportStatusFilter],
        ['TypeFilter', reportTypeFilter],
        ['ExportMode', pendingApprovalExportMode],
        ['IncludeEmptyRationale', pendingApprovalExportIncludeEmptyRationale ? 'true' : 'false'],
      ].map(([key, value]) => `# ${csvEscape(key)},${csvEscape(value)}`);
      const header = ['IncidentId', 'IncidentNumber', 'IncidentName', 'Recommendation', 'ConfidencePercent', 'Decision', 'DecidedAtUtc', 'Rationale'].join(',');
      const content = [...metadata, header, ...rows].join('\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, 'reports-pending-approval-executive-summary', 'csv');
      onNotify?.('Pending approval executive summary CSV exported.', 'success');
    } finally {
      setPendingApprovalExecutiveSummaryExportLoading(false);
    }
  };

  const describeGeneratedReportSpec = (specJson: string): string | null => {
    const parsed = parseVisualizationSpecJson(specJson, 'reports');
    if (!parsed) {
      return null;
    }

    const descriptorMap: Record<string, string> = {
      'kpi-governance-posture': 'Governance Posture',
      'line-volume': 'Volume Trend',
      'line-success-vs-failure': 'Success vs Failure',
      'area-failure-trend': 'Failure Trend',
      'scatter-provider-risk': 'Provider Risk',
      'bar-provider-failure-rate': 'Provider Failure Ranking',
    };

    const ordered = parsed.widgetIds
      .map((widgetId) => descriptorMap[widgetId] ?? null)
      .filter((value): value is string => value !== null);

    if (ordered.length === 0) {
      return null;
    }

    if (ordered.length === 1) {
      return ordered[0];
    }

    if (ordered.length === 2) {
      return `${ordered[0]} with ${ordered[1]}`;
    }

    return `${ordered[0]} with ${ordered.slice(1, -1).join(', ')} and ${ordered[ordered.length - 1]}`;
  };

  useEffect(() => {
    void loadExternalProviderGovernanceDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('ipoc.reports.filterPresets', JSON.stringify(reportFilterPresets));
  }, [reportFilterPresets]);

  useEffect(() => {
    let cancelled = false;

    const loadPendingApprovalDecisions = async () => {
      try {
        const serverPresets = await getUserReportPresets(REPORT_APPROVAL_DECISIONS_SCOPE);
        if (cancelled) {
          return;
        }

        const mapped: Record<number, ReportPendingApprovalDecision> = {};
        const rationaleDrafts: Record<number, string> = {};
        serverPresets.forEach((preset) => {
          try {
            const parsed = JSON.parse(preset.presetJson) as ReportPendingApprovalDecision;
            if (Number.isFinite(parsed.incidentId) && typeof parsed.decision === 'string' && typeof parsed.decidedAtUtc === 'string') {
              mapped[parsed.incidentId] = parsed;
              if (typeof parsed.rationale === 'string') {
                rationaleDrafts[parsed.incidentId] = parsed.rationale;
              }
            }
          } catch {
            // Ignore malformed decisions.
          }
        });

        setPendingApprovalDecisions(mapped);
        setPendingApprovalRationales(rationaleDrafts);
      } catch {
        // Keep local fallback decision state.
      }
    };

    if (window.navigator.onLine) {
      void loadPendingApprovalDecisions();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDecisionHistory = async () => {
      try {
        const serverPresets = await getUserReportPresets(REPORT_DECISION_HISTORY_SCOPE);
        if (cancelled) {
          return;
        }

        const entries = serverPresets
          .map((preset) => {
            try {
              const parsed = JSON.parse(preset.presetJson) as ReportDecisionHistoryEntry;
              if (!Number.isFinite(parsed.incidentId) || typeof parsed.decision !== 'string' || typeof parsed.decidedAtUtc !== 'string') {
                return null;
              }
              return parsed;
            } catch {
              return null;
            }
          })
          .filter((entry): entry is ReportDecisionHistoryEntry => Boolean(entry))
          .sort((left, right) => Date.parse(right.decidedAtUtc) - Date.parse(left.decidedAtUtc))
          .slice(0, 50);

        setPendingApprovalDecisionHistory(entries);
      } catch {
        // Keep local-only history when server retrieval is unavailable.
      }
    };

    if (window.navigator.onLine) {
      void loadDecisionHistory();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!reportFilterPresets.some((preset) => preset.source === 'local')) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setReportFilterPresets((current) => current.filter((preset) => preset.source !== 'local'));
    }, 15000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reportFilterPresets]);

  useEffect(() => {
    if (!window.navigator.onLine) {
      return;
    }

    let cancelled = false;

    const loadFilterPresets = async () => {
      try {
        const serverPresets = await getUserReportPresets(REPORT_FILTER_PRESET_SCOPE);
        if (cancelled) {
          return;
        }

        const mapped: ReportFilterPreset[] = [];
        serverPresets.forEach((preset) => {
          try {
            const parsed = JSON.parse(preset.presetJson) as Partial<ReportFilterPreset>;
            mapped.push({
              id: `server-${preset.userReportPresetId}`,
              name: preset.presetName,
              windowDays: Number.isFinite(parsed.windowDays) ? Number(parsed.windowDays) : 30,
              groupBy: parsed.groupBy === 'type' ? 'type' : 'status',
              statusFilter: typeof parsed.statusFilter === 'string' ? parsed.statusFilter : 'All',
              typeFilter: typeof parsed.typeFilter === 'string' ? parsed.typeFilter : 'All',
              drilldownGroup: typeof parsed.drilldownGroup === 'string' ? parsed.drilldownGroup : null,
              drilldownSeverity: typeof parsed.drilldownSeverity === 'string' ? parsed.drilldownSeverity : null,
              userReportPresetId: preset.userReportPresetId,
              source: 'server',
            });
          } catch {
            // Ignore malformed presets.
          }
        });

        setReportFilterPresets(mapped);
      } catch {
        // Local fallback remains active.
      }
    };

    void loadFilterPresets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('ipoc.reports.analytics.widgets', JSON.stringify(advancedWidgetIds));
  }, [advancedWidgetIds]);

  useEffect(() => {
    localStorage.setItem('ipoc.reports.designCanvasMode', designCanvasMode ? 'true' : 'false');
  }, [designCanvasMode]);

  useEffect(() => {
    if (!designCanvasMode) {
      setSelectedAdvancedWidgetId(null);
      return;
    }

    if (selectedAdvancedWidgetId && !advancedWidgetIds.includes(selectedAdvancedWidgetId)) {
      setSelectedAdvancedWidgetId(null);
    }
  }, [designCanvasMode, selectedAdvancedWidgetId, advancedWidgetIds]);

  useEffect(() => {
    if (!designCanvasMode || !selectedAdvancedWidgetId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
          return;
        }
      }

      event.preventDefault();
      setAdvancedWidgetIds((current) => current.filter((id) => id !== selectedAdvancedWidgetId));
      setSelectedAdvancedWidgetId(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [designCanvasMode, selectedAdvancedWidgetId]);

  useEffect(() => {
    localStorage.setItem(REPORT_TEMPLATE_PRESET_LOCAL_KEY, JSON.stringify(reportTemplatePresets));
  }, [reportTemplatePresets]);

  useEffect(() => {
    localStorage.setItem('ipoc.reports.templatePaneExpanded', templatePaneOpen ? 'true' : 'false');
  }, [templatePaneOpen]);

  useEffect(() => {
    localStorage.setItem(REPORT_GENERATED_SPECS_LOCAL_KEY, JSON.stringify(reportGeneratedSpecs));
  }, [reportGeneratedSpecs]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(REPORT_PALETTE_LOCAL_KEY, JSON.stringify(reportPalette));
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reportPalette]);

  useEffect(() => {
    localStorage.setItem(REPORT_PALETTE_PANE_OPEN_KEY, palettePaneOpen ? 'true' : 'false');
  }, [palettePaneOpen]);

  useEffect(() => {
    localStorage.setItem(REPORT_CANVAS_PANE_OPEN_KEY, canvasPaneOpen ? 'true' : 'false');
  }, [canvasPaneOpen]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(REPORT_EXECUTIVE_BRIEF_CACHE_LOCAL_KEY);
      if (!cached) {
        return;
      }

      const parsed = JSON.parse(cached) as Partial<ExecutiveDecisionBriefCache>;
      if (typeof parsed.narrative !== 'string' || parsed.narrative.trim().length === 0) {
        return;
      }

      setExecutiveBriefPreviewMarkdown(parsed.narrative);
      setExecutiveBriefPreviewGeneratedUtc(typeof parsed.generatedUtc === 'string' ? parsed.generatedUtc : null);
      setExecutiveBriefPreviewRecommendationCount(Number.isFinite(parsed.recommendationCount) ? Number(parsed.recommendationCount) : 0);
      setExecutiveBriefPreviewHasBaseline(parsed.hasBaseline === true);
      setExecutiveBriefPreviewHasDecisionHistory(parsed.hasDecisionHistory === true);
      setExecutiveBriefPreviewLastCacheRestored(true);
    } catch {
      // Ignore malformed local brief cache payloads.
    }
  }, []);

  useEffect(() => {
    if (executiveBriefPreviewMarkdown.trim().length === 0) {
      localStorage.removeItem(REPORT_EXECUTIVE_BRIEF_CACHE_LOCAL_KEY);
      return;
    }

    const cachePayload: ExecutiveDecisionBriefCache = {
      narrative: executiveBriefPreviewMarkdown,
      generatedUtc: executiveBriefPreviewGeneratedUtc ?? new Date().toISOString(),
      recommendationCount: executiveBriefPreviewRecommendationCount,
      hasBaseline: executiveBriefPreviewHasBaseline,
      hasDecisionHistory: executiveBriefPreviewHasDecisionHistory,
    };

    localStorage.setItem(REPORT_EXECUTIVE_BRIEF_CACHE_LOCAL_KEY, JSON.stringify(cachePayload));
  }, [
    executiveBriefPreviewMarkdown,
    executiveBriefPreviewGeneratedUtc,
    executiveBriefPreviewRecommendationCount,
    executiveBriefPreviewHasBaseline,
    executiveBriefPreviewHasDecisionHistory,
  ]);

  useEffect(() => {
    const loadServerTemplatePresets = async () => {
      try {
        const serverPresets = await getUserReportPresets(REPORT_TEMPLATE_PRESET_SCOPE);
        const mapped: ReportTemplatePreset[] = [];

        serverPresets.forEach((preset) => {
          try {
            const parsed = JSON.parse(preset.presetJson) as Partial<ReportTemplatePreset>;
            const widgetIds = Array.isArray(parsed.widgetIds)
              ? parsed.widgetIds.filter((item): item is string => typeof item === 'string')
              : [];
            mapped.push({
              id: `server-${preset.userReportPresetId}`,
              name: preset.presetName,
              widgetIds: widgetIds.length > 0 ? widgetIds : ['line-volume'],
              userReportPresetId: preset.userReportPresetId,
              source: 'server',
              updatedUtc: preset.updatedUtc,
            });
          } catch {
            // Ignore malformed server preset payloads.
          }
        });

        if (mapped.length > 0) {
          setReportTemplatePresets(mapped);
        }
      } catch {
        // Keep local fallback presets when server persistence is unavailable.
      }
    };

    void loadServerTemplatePresets();
  }, []);

  useEffect(() => {
    const loadServerGeneratedSpecs = async () => {
      try {
        const serverPresets = await getUserReportPresets(REPORT_GENERATED_SPECS_SCOPE);
        const mapped: GeneratedVisualizationSpecRecord[] = serverPresets.map((preset) => ({
          id: `server-${preset.userReportPresetId}`,
          name: preset.presetName,
          specJson: preset.presetJson,
          userReportPresetId: preset.userReportPresetId,
          source: 'server',
          updatedUtc: preset.updatedUtc,
          createdBy: 'Agent prompt',
        }));

        if (mapped.length > 0) {
          setReportGeneratedSpecs((current) => {
            const existingIds = new Set(current.map((item) => item.id));
            const normalizedMapped = mapped
              .map((item) => {
                const normalized = parseVisualizationSpecJson(item.specJson, 'reports');
                if (!normalized) {
                  return null;
                }

                return {
                  ...item,
                  specJson: JSON.stringify(normalized),
                };
              })
              .filter((item): item is GeneratedVisualizationSpecRecord => item !== null);

            normalizedMapped.forEach((item) => {
              const parsed = parseVisualizationSpecJson(item.specJson, 'reports');
              if (!parsed || item.source !== 'server' || !item.userReportPresetId) {
                return;
              }

              const parsedAsUnknown = JSON.parse(item.specJson) as Record<string, unknown>;
              const requiresMigration = !('schemaVersion' in parsedAsUnknown) || !('specVersion' in parsedAsUnknown);
              if (!requiresMigration) {
                return;
              }

              const presetName = item.name.trim().length > 0 ? item.name : `Prompt ${new Date(parsed.generatedUtc).toLocaleString()}`;
              void upsertUserReportPreset(REPORT_GENERATED_SPECS_SCOPE, {
                presetName,
                presetJson: JSON.stringify(parsed),
              });
            });

            const merged = [...normalizedMapped.filter((item) => !existingIds.has(item.id)), ...current];
            return merged.slice(0, 12);
          });
        }
      } catch {
        // Keep local generated specs when server persistence is unavailable.
      }
    };

    void loadServerGeneratedSpecs();
  }, []);

  useEffect(() => {
    const loadServerPalette = async () => {
      try {
        const presets = await getUserReportPresets(REPORT_PALETTE_SCOPE);
        if (presets.length === 0) {
          return;
        }

        const sorted = [...presets].sort((a, b) => Date.parse(b.updatedUtc) - Date.parse(a.updatedUtc));
        const latest = sorted[0];
        const parsed = JSON.parse(latest.presetJson);
        setReportPalette(normalizePalette(parsed, REPORT_DEFAULT_PALETTE));
        setReportPaletteServerPresetId(latest.userReportPresetId);
      } catch {
        // Keep local palette when server persistence is unavailable.
      }
    };

    void loadServerPalette();
  }, []);

  const deleteGeneratedReportSpec = async (record: GeneratedVisualizationSpecRecord) => {
    if (record.userReportPresetId) {
      try {
        await deleteUserReportPreset(REPORT_GENERATED_SPECS_SCOPE, record.userReportPresetId);
      } catch {
        // Continue with local delete.
      }
    }

    setReportGeneratedSpecs((current) => current.filter((item) => item.id !== record.id));
  };

  const applyGeneratedReportSpec = (specJson: string) => {
    const parsed = parseVisualizationSpecJson(specJson, 'reports');
    if (!parsed) {
      return;
    }

    const normalizedWidgetIds = Array.from(new Set(parsed.widgetIds));
    setAdvancedWidgetIds(normalizedWidgetIds);
    if (normalizedWidgetIds.length > 0) {
      if (promptFocusTimerRef.current !== null) {
        window.clearTimeout(promptFocusTimerRef.current);
      }

      promptFocusTimerRef.current = window.setTimeout(() => {
        const target = document.getElementById(`reports-widget-${normalizedWidgetIds[0]}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }
  };

  const downloadBlob = (blob: Blob, filenamePrefix: string, extension: 'csv' | 'zip' | 'md') => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filenamePrefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportExternalProviderGovernanceCsv = async () => {
    try {
      setExternalProviderGovernanceExportLoading(true);
      const trendWindowHours = Number.parseInt(externalProviderTrendWindowHours, 10);
      const blob = await exportExternalProviderHealthGovernanceCsv(
        externalProviderTrendProvider.trim() || undefined,
        Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30,
        60,
      );
      downloadBlob(blob, 'external-provider-governance', 'csv');
    } finally {
      setExternalProviderGovernanceExportLoading(false);
    }
  };

  const saveReportTemplatePreset = async () => {
    const normalizedName = reportTemplatePresetName.trim();
    if (!normalizedName) {
      return;
    }

    const duplicateExists = reportTemplatePresets.some((preset) => preset.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (duplicateExists) {
      return;
    }

    const localPreset: ReportTemplatePreset = {
      id: `local-${Date.now()}`,
      name: normalizedName,
      widgetIds: [...advancedWidgetIds],
      source: 'local',
      updatedUtc: new Date().toISOString(),
    };

    const localNext = [localPreset, ...reportTemplatePresets].slice(0, 12);
    setReportTemplatePresets(localNext);

    try {
      const userReportPresetId = await upsertUserReportPreset(REPORT_TEMPLATE_PRESET_SCOPE, {
        presetName: normalizedName,
        presetJson: JSON.stringify({ widgetIds: advancedWidgetIds }),
      });

      setReportTemplatePresets((current) => current.map((preset) => (
        preset.id === localPreset.id
          ? {
            ...preset,
            id: `server-${userReportPresetId}`,
            userReportPresetId,
            source: 'server',
            updatedUtc: new Date().toISOString(),
          }
          : preset
      )));
    } catch {
      // Keep local preset when server persistence is unavailable.
    }

    setReportTemplatePresetName('');
  };

  const applyReportTemplatePreset = (preset: ReportTemplatePreset) => {
    setAdvancedWidgetIds(preset.widgetIds);
  };

  const deleteReportTemplatePreset = async (preset: ReportTemplatePreset) => {
    if (preset.userReportPresetId) {
      try {
        await deleteUserReportPreset(REPORT_TEMPLATE_PRESET_SCOPE, preset.userReportPresetId);
      } catch {
        // Continue with local delete.
      }
    }

    setReportTemplatePresets((current) => current.filter((item) => item.id !== preset.id));
  };

  const startRenameReportTemplatePreset = (preset: ReportTemplatePreset) => {
    setEditingReportPresetId(preset.id);
    setEditingReportPresetName(preset.name);
  };

  const commitRenameReportTemplatePreset = async (preset: ReportTemplatePreset) => {
    const normalizedName = editingReportPresetName.trim();
    if (!normalizedName) {
      return;
    }

    const duplicateExists = reportTemplatePresets.some((item) => item.id !== preset.id && item.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (duplicateExists) {
      return;
    }

    setReportTemplatePresets((current) => current.map((item) => (
      item.id === preset.id
        ? { ...item, name: normalizedName, updatedUtc: new Date().toISOString() }
        : item
    )));

    if (preset.userReportPresetId) {
      try {
        const userReportPresetId = await upsertUserReportPreset(REPORT_TEMPLATE_PRESET_SCOPE, {
          presetName: normalizedName,
          presetJson: JSON.stringify({ widgetIds: preset.widgetIds }),
        });
        await deleteUserReportPreset(REPORT_TEMPLATE_PRESET_SCOPE, preset.userReportPresetId);

        setReportTemplatePresets((current) => current.map((item) => (
          item.id === preset.id
            ? {
              ...item,
              id: `server-${userReportPresetId}`,
              userReportPresetId,
              source: 'server',
              updatedUtc: new Date().toISOString(),
            }
            : item
        )));
      } catch {
        // Keep local rename if server rename flow is unavailable.
      }
    }

    setEditingReportPresetId(null);
    setEditingReportPresetName('');
  };

  const reportPresetNameConflict = reportTemplatePresetName.trim().length > 0
    && reportTemplatePresets.some((preset) => preset.name.trim().toLowerCase() === reportTemplatePresetName.trim().toLowerCase());

  const handleExportExternalProviderScorecardCsv = async () => {
    try {
      setExternalProviderScorecardExportLoading(true);
      const rollingDays = Math.max(1, Math.round((Number.parseInt(externalProviderTrendWindowHours, 10) || 24) / 24));
      const blob = await exportExternalProviderHealthScorecardCsv(externalProviderTrendProvider.trim() || undefined, rollingDays);
      downloadBlob(blob, 'external-provider-scorecard', 'csv');
    } finally {
      setExternalProviderScorecardExportLoading(false);
    }
  };

  const handleExportExternalProviderExecutivePacket = async () => {
    try {
      setExternalProviderExecutivePacketExportLoading(true);
      const trendWindowHours = Number.parseInt(externalProviderTrendWindowHours, 10);
      const blob = await exportExternalProviderHealthExecutivePacketZip(
        externalProviderTrendProvider.trim() || undefined,
        Number.isFinite(trendWindowHours) ? trendWindowHours : 24 * 30,
        60,
      );
      downloadBlob(blob, 'external-provider-executive-packet', 'zip');
    } finally {
      setExternalProviderExecutivePacketExportLoading(false);
    }
  };

  const filtered = incidents.filter((incident) => {
    const createdMs = Date.parse(incident.createdUtc);
    const inWindow = Number.isFinite(createdMs) ? (nowMs - createdMs <= windowMs) : false;
    const statusOk = reportStatusFilter === 'All' || incident.incidentStatusCode === reportStatusFilter;
    const typeOk = reportTypeFilter === 'All' || incident.incidentTypeCode === reportTypeFilter;

    return inWindow && statusOk && typeOk;
  });

  const groupedMap = new Map<string, number>();
  filtered.forEach((incident) => {
    const key = reportGroupBy === 'status' ? incident.incidentStatusCode : incident.incidentTypeCode;
    groupedMap.set(key, (groupedMap.get(key) ?? 0) + 1);
  });

  const groupedRows = Array.from(groupedMap.entries())
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));

  const statusLabelMap = new Map(incidentStatusLookups.map((item) => [item.code, item.displayName]));
  const typeLabelMap = new Map(incidentTypeLookups.map((item) => [item.code, item.displayName]));

  const resolveGroupLabel = (group: string) => {
    if (reportGroupBy === 'status') {
      return statusLabelMap.get(group) ?? group;
    }

    return typeLabelMap.get(group) ?? group;
  };

  const powerBiEmbedUrl = import.meta.env.VITE_POWERBI_EMBED_URL;
  const hasPowerBiEmbed = typeof powerBiEmbedUrl === 'string' && powerBiEmbedUrl.trim().length > 0;

  const groupedChartData = groupedRows.map((row) => ({
    group: resolveGroupLabel(row.group),
    rawGroup: row.group,
    count: row.count,
  }));

  const severityBreakdown = filtered.reduce(
    (accumulator, incident) => {
      const severity = (incident.severityCode ?? 'Unspecified').trim();
      if (severity === 'Critical') {
        accumulator.critical += 1;
      } else if (severity === 'High') {
        accumulator.high += 1;
      } else if (severity === 'Moderate') {
        accumulator.moderate += 1;
      } else if (severity === 'Low') {
        accumulator.low += 1;
      } else {
        accumulator.unspecified += 1;
      }

      return accumulator;
    },
    { critical: 0, high: 0, moderate: 0, low: 0, unspecified: 0 },
  );

  const severityChartData = [
    { name: 'Critical', value: severityBreakdown.critical, fill: reportPalette.critical },
    { name: 'High', value: severityBreakdown.high, fill: reportPalette.warning },
    { name: 'Moderate', value: severityBreakdown.moderate, fill: reportPalette.series1 },
    { name: 'Low', value: severityBreakdown.low, fill: reportPalette.success },
    { name: 'Unspecified', value: severityBreakdown.unspecified, fill: reportPalette.neutral },
  ].filter((item) => item.value > 0);

  const volumeHealthScore = groupedRows.length === 0
    ? 0
    : Math.max(0, Math.min(100, Math.round((Math.min(filtered.length, 250) / 250) * 100)));
  const severityRiskScore = filtered.length === 0
    ? 0
    : Math.round((((severityBreakdown.critical * 3) + (severityBreakdown.high * 2) + severityBreakdown.moderate) / (filtered.length * 3)) * 100);
  const reportingCompletenessScore = dashboardSummary
    ? Math.max(0, Math.min(100, Math.round((((dashboardSummary.openTaskCount - dashboardSummary.overdueTaskCount) + dashboardSummary.openObjectiveCount) / Math.max(1, dashboardSummary.openTaskCount + dashboardSummary.openObjectiveCount)) * 100)))
    : 0;

  const tableRows = groupedRows.filter((row) => {
    if (chartDrilldownGroup && row.group !== chartDrilldownGroup) {
      return false;
    }

    if (!chartDrilldownSeverity) {
      return true;
    }

    if (chartDrilldownSeverity === 'Unspecified') {
      return filtered.some((incident) => (incident.severityCode ?? 'Unspecified') === 'Unspecified' && (reportGroupBy === 'status' ? incident.incidentStatusCode : incident.incidentTypeCode) === row.group);
    }

    return filtered.some((incident) => (incident.severityCode ?? 'Unspecified') === chartDrilldownSeverity && (reportGroupBy === 'status' ? incident.incidentStatusCode : incident.incidentTypeCode) === row.group);
  });

  const activeDrilldownLabel = [
    chartDrilldownGroup ? `Group ${resolveGroupLabel(chartDrilldownGroup)}` : null,
    chartDrilldownSeverity ? `Severity ${chartDrilldownSeverity}` : null,
  ].filter((item): item is string => item !== null).join(' · ');

  const comparisonOptions = groupedRows.map((row) => ({
    value: row.group,
    label: resolveGroupLabel(row.group),
    count: row.count,
  }));

  const comparisonLeftValue = comparisonLeftGroup || comparisonOptions[0]?.value || '';
  const comparisonRightValue = comparisonRightGroup || comparisonOptions[1]?.value || comparisonOptions[0]?.value || '';

  const buildGroupComparisonMetrics = (groupCode: string) => {
    const groupIncidents = filtered.filter((incident) => {
      const groupValue = reportGroupBy === 'status' ? incident.incidentStatusCode : incident.incidentTypeCode;
      return groupValue === groupCode;
    });

    const total = groupIncidents.length;
    const criticalOrHigh = groupIncidents.filter((incident) => {
      const severity = (incident.severityCode ?? 'Unspecified').trim();
      return severity === 'Critical' || severity === 'High';
    }).length;
    const activated = groupIncidents.filter((incident) => incident.activatedUtc).length;
    const activeStatus = groupIncidents.filter((incident) => incident.incidentStatusCode === 'Active').length;

    const recentHours = 72;
    const recentMs = recentHours * 60 * 60 * 1000;
    const recentCreated = groupIncidents.filter((incident) => {
      const createdMs = Date.parse(incident.createdUtc);
      return Number.isFinite(createdMs) && (nowMs - createdMs) <= recentMs;
    }).length;

    return {
      total,
      criticalOrHigh,
      criticalOrHighPercent: total > 0 ? Math.round((criticalOrHigh / total) * 100) : 0,
      activated,
      activatedPercent: total > 0 ? Math.round((activated / total) * 100) : 0,
      activeStatus,
      activeStatusPercent: total > 0 ? Math.round((activeStatus / total) * 100) : 0,
      recentCreated,
      recentCreatedPercent: total > 0 ? Math.round((recentCreated / total) * 100) : 0,
    };
  };

  const leftComparisonMetrics = comparisonLeftValue ? buildGroupComparisonMetrics(comparisonLeftValue) : null;
  const rightComparisonMetrics = comparisonRightValue ? buildGroupComparisonMetrics(comparisonRightValue) : null;

  const leftComparisonLabel = comparisonOptions.find((option) => option.value === comparisonLeftValue)?.label ?? comparisonLeftValue;
  const rightComparisonLabel = comparisonOptions.find((option) => option.value === comparisonRightValue)?.label ?? comparisonRightValue;

  const comparisonNarrative = (() => {
    if (!leftComparisonMetrics || !rightComparisonMetrics || !comparisonLeftValue || !comparisonRightValue) {
      return 'Select two groups to generate comparative executive posture guidance.';
    }

    if (comparisonLeftValue === comparisonRightValue) {
      return 'Choose distinct groups to compare regional/facility posture and triage pressure.';
    }

    const volumeDelta = leftComparisonMetrics.total - rightComparisonMetrics.total;
    const severityDelta = leftComparisonMetrics.criticalOrHighPercent - rightComparisonMetrics.criticalOrHighPercent;
    const activityDelta = leftComparisonMetrics.recentCreatedPercent - rightComparisonMetrics.recentCreatedPercent;

    const volumeText = volumeDelta === 0
      ? 'incident volume is balanced'
      : volumeDelta > 0
        ? `${leftComparisonLabel} carries ${Math.abs(volumeDelta)} more incidents`
        : `${rightComparisonLabel} carries ${Math.abs(volumeDelta)} more incidents`;
    const severityText = severityDelta === 0
      ? 'severity pressure is aligned'
      : severityDelta > 0
        ? `${leftComparisonLabel} has ${Math.abs(severityDelta)}% higher critical/high concentration`
        : `${rightComparisonLabel} has ${Math.abs(severityDelta)}% higher critical/high concentration`;
    const activityText = activityDelta === 0
      ? 'new-incident momentum is similar'
      : activityDelta > 0
        ? `${leftComparisonLabel} is seeing faster 72h intake`
        : `${rightComparisonLabel} is seeing faster 72h intake`;

    return `Comparative posture: ${volumeText}; ${severityText}; ${activityText}.`;
  })();

  const executiveDeltaSummary: ExecutiveDeltaSummary = {
    volumeDelta: leftComparisonMetrics && rightComparisonMetrics ? leftComparisonMetrics.total - rightComparisonMetrics.total : 0,
    severityDelta: leftComparisonMetrics && rightComparisonMetrics ? leftComparisonMetrics.criticalOrHighPercent - rightComparisonMetrics.criticalOrHighPercent : 0,
    activityDelta: leftComparisonMetrics && rightComparisonMetrics ? leftComparisonMetrics.recentCreatedPercent - rightComparisonMetrics.recentCreatedPercent : 0,
  };

  const executiveBriefPreviewGeneratedMs = executiveBriefPreviewGeneratedUtc ? Date.parse(executiveBriefPreviewGeneratedUtc) : Number.NaN;
  const executiveBriefPreviewAgeMs = Number.isFinite(executiveBriefPreviewGeneratedMs) ? Math.max(0, nowMs - executiveBriefPreviewGeneratedMs) : Number.NaN;
  const executiveBriefPreviewIsStale = Number.isFinite(executiveBriefPreviewAgeMs)
    ? executiveBriefPreviewAgeMs > REPORT_EXECUTIVE_BRIEF_STALE_MAX_AGE_MS
    : false;
  const executiveBriefPreviewAgeText = Number.isFinite(executiveBriefPreviewAgeMs) ? formatDurationFromMs(executiveBriefPreviewAgeMs) : 'Unknown age';

  const swapComparisonSides = () => {
    if (!comparisonLeftValue && !comparisonRightValue) {
      return;
    }

    setComparisonLeftGroup(comparisonRightValue);
    setComparisonRightGroup(comparisonLeftValue);
  };

  const buildExecutiveDecisionBriefPackage = (): ExecutiveDecisionBriefPackage | null => {
    if (pendingApprovalRows.length === 0) {
      onNotify?.('No recommendation rows available for executive decision brief export.', 'warning');
      return null;
    }

    const generatedUtc = new Date().toISOString();
    const decisionActor = reportOperatorDisplayName?.trim() || 'Authenticated User';
    const recommendationBundleRows = selectedPendingApprovalRows.length > 0
      ? selectedPendingApprovalRows
      : pendingApprovalRows.slice(0, 5);
    const recommendationBundle = recommendationBundleRows.map((row, index) => {
      const savedDecision = pendingApprovalDecisions[row.incidentId];
      const rationale = (savedDecision?.rationale ?? pendingApprovalRationales[row.incidentId] ?? '').trim();
      return {
        index: index + 1,
        incidentNumber: row.incidentNumber,
        incidentName: row.incidentName,
        recommendationAction: row.recommendation.action,
        confidencePercent: Math.round(row.recommendation.confidence * 100),
        decision: savedDecision?.decision ?? 'Pending review',
        decidedByDisplayName: savedDecision?.decidedByDisplayName,
        decidedAtUtc: savedDecision?.decidedAtUtc,
        rationale,
      };
    });

    const narrative = [
      '# Executive Decision Brief',
      '',
      `Generated UTC: ${generatedUtc}`,
      `Generated by: ${decisionActor}`,
      `Reference baseline UTC: ${executiveDeltaReferenceDateUtc ?? 'Not set'}`,
      `Report scope: ${reportWindowDays}d window · GroupBy ${reportGroupBy} · Status ${reportStatusFilter} · Type ${reportTypeFilter}`,
      `Recommendation bundle source: ${selectedPendingApprovalRows.length > 0 ? 'Selected pending approvals' : 'Top pending recommendations'}`,
      '',
      '## Trend Delta Summary',
      `- Volume delta: ${executiveDeltaSummary.volumeDelta > 0 ? '+' : ''}${executiveDeltaSummary.volumeDelta}`,
      `- Critical/High concentration delta: ${executiveDeltaSummary.severityDelta > 0 ? '+' : ''}${executiveDeltaSummary.severityDelta}%`,
      `- 72h intake activity delta: ${executiveDeltaSummary.activityDelta > 0 ? '+' : ''}${executiveDeltaSummary.activityDelta}%`,
      '',
      '## Recommended Actions',
      ...recommendationBundle.map((item) => `${item.index}. ${item.incidentNumber} (${item.incidentName}) - ${item.recommendationAction} [${item.confidencePercent}% confidence]`),
      '',
      '## Recommendation Bundle Decision State',
      ...recommendationBundle.map((item) => {
        const decisionLine = item.decidedAtUtc
          ? `${item.decision} at ${item.decidedAtUtc}`
          : item.decision;
        const actorLine = item.decidedByDisplayName ? ` by ${item.decidedByDisplayName}` : '';
        const rationaleLine = item.rationale.length > 0 ? `; Rationale: ${item.rationale}` : '';
        return `- ${item.incidentNumber}: ${decisionLine}${actorLine}${rationaleLine}`;
      }),
      '',
      '## Decision Log Appendix',
      ...pendingApprovalDecisionHistoryRows.length > 0
        ? pendingApprovalDecisionHistoryRows.map((entry, index) => {
          const actor = entry.decidedByDisplayName?.trim() || 'Authenticated User';
          const rationale = entry.rationale && entry.rationale.trim().length > 0 ? `; Rationale: ${entry.rationale.trim()}` : '';
          return `${index + 1}. ${entry.decidedAtUtc} - ${entry.incidentNumber} (${entry.incidentName}) - ${entry.decision} by ${actor}${rationale}`;
        })
        : ['1. No recorded decision history entries available within the current report scope.'],
      '',
      '## Decision Support Notes',
      `- Comparative posture: ${comparisonNarrative}`,
      '- Validate recommendations against current command directives before execution.',
      '- Capture final decisions in pending approval workflow for auditability.',
    ].join('\n');

    return {
      narrative,
      recommendationCount: recommendationBundle.length,
      generatedUtc,
      hasBaseline: Boolean(executiveDeltaReferenceDateUtc),
      hasDecisionHistory: pendingApprovalDecisionHistoryRows.length > 0,
    };
  };

  const applyExecutiveBriefPreviewPackage = (briefPackage: ExecutiveDecisionBriefPackage) => {
    setExecutiveBriefPreviewMarkdown(briefPackage.narrative);
    setExecutiveBriefPreviewGeneratedUtc(briefPackage.generatedUtc);
    setExecutiveBriefPreviewRecommendationCount(briefPackage.recommendationCount);
    setExecutiveBriefPreviewHasBaseline(briefPackage.hasBaseline);
    setExecutiveBriefPreviewHasDecisionHistory(briefPackage.hasDecisionHistory);
  };

  const resolveExecutiveDecisionBriefForAction = (allowCachedFallback: boolean): ResolvedExecutiveDecisionBrief | null => {
    const liveBriefPackage = buildExecutiveDecisionBriefPackage();
    if (liveBriefPackage) {
      setExecutiveBriefPreviewLastCacheRestored(false);
      return {
        briefPackage: liveBriefPackage,
        source: 'live',
      };
    }

    if (!allowCachedFallback) {
      return null;
    }

    if (executiveBriefPreviewMarkdown.trim().length === 0) {
      onNotify?.('No executive brief is available yet. Generate a brief from pending recommendations first.', 'warning');
      return null;
    }

    const fallbackGeneratedUtc = executiveBriefPreviewGeneratedUtc ?? new Date().toISOString();
    const cachedBriefPackage: ExecutiveDecisionBriefPackage = {
      narrative: executiveBriefPreviewMarkdown,
      generatedUtc: fallbackGeneratedUtc,
      recommendationCount: executiveBriefPreviewRecommendationCount,
      hasBaseline: executiveBriefPreviewHasBaseline,
      hasDecisionHistory: executiveBriefPreviewHasDecisionHistory,
    };

    setExecutiveBriefPreviewGeneratedUtc(fallbackGeneratedUtc);
    setExecutiveBriefPreviewLastCacheRestored(true);
    onNotify?.('No current recommendation rows available. Using the last generated executive brief from cache.', 'info');
    return {
      briefPackage: cachedBriefPackage,
      source: 'cache',
    };
  };

  const exportExecutiveDecisionBrief = () => {
    const resolved = resolveExecutiveDecisionBriefForAction(true);
    if (!resolved) {
      return;
    }

    const { briefPackage, source } = resolved;

    applyExecutiveBriefPreviewPackage(briefPackage);
    const blob = new Blob([briefPackage.narrative], { type: 'text/markdown;charset=utf-8;' });
    downloadBlob(blob, 'reports-executive-decision-brief', 'md');
    onNotify?.(
      source === 'cache'
        ? `Executive decision brief exported from cache with ${briefPackage.recommendationCount} recommendation bundle item(s).`
        : `Executive decision brief exported with ${briefPackage.recommendationCount} recommendation bundle item(s).`,
      'success',
    );
  };

  const previewExecutiveDecisionBrief = () => {
    const resolved = resolveExecutiveDecisionBriefForAction(true);
    if (!resolved) {
      return;
    }

    const { briefPackage } = resolved;
    applyExecutiveBriefPreviewPackage(briefPackage);
    setExecutiveBriefPreviewOpen(true);
  };

  const copyExecutiveDecisionBriefToClipboard = async () => {
    const resolved = resolveExecutiveDecisionBriefForAction(true);
    if (!resolved) {
      return;
    }

    const { briefPackage, source } = resolved;

    applyExecutiveBriefPreviewPackage(briefPackage);
    if (!window.navigator.clipboard || typeof window.navigator.clipboard.writeText !== 'function') {
      onNotify?.('Clipboard copy is unavailable in this browser context. Export the markdown brief instead.', 'warning');
      return;
    }

    try {
      await window.navigator.clipboard.writeText(briefPackage.narrative);
      onNotify?.(source === 'cache' ? 'Executive decision brief copied to clipboard from cache.' : 'Executive decision brief copied to clipboard.', 'success');
    } catch {
      onNotify?.('Unable to copy executive decision brief to clipboard.', 'danger');
    }
  };

  const stageExecutiveDecisionBriefForAssistant = () => {
    const resolved = resolveExecutiveDecisionBriefForAction(true);
    if (!resolved) {
      return;
    }

    const { briefPackage, source } = resolved;

    applyExecutiveBriefPreviewPackage(briefPackage);
    const assistantPrompt = [
      'Use this executive decision brief to produce an AI Incident Co-Pilot command summary, priority actions, and an ICS-ready objective draft.',
      '',
      briefPackage.narrative,
    ].join('\n');

    localStorage.setItem(REPORT_ASSISTANT_PREFILL_PROMPT_KEY, assistantPrompt);
    onNotify?.(
      source === 'cache'
        ? 'Cached executive decision brief staged for AI Incident Co-Pilot. Open Assistant and submit when ready.'
        : 'Executive decision brief staged for AI Incident Co-Pilot. Open Assistant and submit when ready.',
      'info',
    );
  };

  const clearExecutiveDecisionBriefCache = () => {
    setExecutiveBriefPreviewMarkdown('');
    setExecutiveBriefPreviewGeneratedUtc(null);
    setExecutiveBriefPreviewRecommendationCount(0);
    setExecutiveBriefPreviewHasBaseline(false);
    setExecutiveBriefPreviewHasDecisionHistory(false);
    setExecutiveBriefPreviewLastCacheRestored(false);
    setExecutiveBriefPreviewOpen(false);
    localStorage.removeItem(REPORT_EXECUTIVE_BRIEF_CACHE_LOCAL_KEY);
    onNotify?.('Executive decision brief cache cleared.', 'info');
  };

  const regenerateExecutiveDecisionBriefFromLiveData = () => {
    const liveBriefPackage = buildExecutiveDecisionBriefPackage();
    if (!liveBriefPackage) {
      return;
    }

    applyExecutiveBriefPreviewPackage(liveBriefPackage);
    setExecutiveBriefPreviewLastCacheRestored(false);
    onNotify?.('Executive decision brief regenerated from current recommendation data.', 'success');
  };

  const stampExecutiveDeltaBaseline = () => {
    setExecutiveDeltaReferenceDateUtc(new Date().toISOString());
    onNotify?.('Executive trend baseline timestamp captured for delta reporting.', 'info');
  };

  const autoPickTopComparisonGroups = () => {
    const left = comparisonOptions[0]?.value ?? '';
    const right = comparisonOptions[1]?.value ?? left;
    setComparisonLeftGroup(left);
    setComparisonRightGroup(right);
  };

  const applyComparisonGroupDrilldown = (groupCode: string) => {
    if (!groupCode) {
      return;
    }

    setChartDrilldownGroup(groupCode);
    setChartDrilldownSeverity(null);
  };

  const applyComparisonRiskDrilldown = (groupCode: string) => {
    if (!groupCode) {
      return;
    }

    setChartDrilldownGroup(groupCode);
    setChartDrilldownSeverity('High');
  };

  const publishDecisionQueueHandoff = (
    target: 'incidents' | 'planning' | 'operations' | 'after-action',
    row: {
      incidentId: number;
      incidentNumber: string;
      incidentName: string;
      groupCode: string;
      severityCode: string;
    },
  ) => {
    writeCopCommandHandoffContext({
      target,
      incidentId: row.incidentId,
      incidentNumber: row.incidentNumber,
      incidentName: row.incidentName,
      sourceAction: `reports-executive-decision-queue-${target}`,
      regionFilter: reportGroupBy === 'type' ? row.groupCode : undefined,
      geoOverlayStressFilter: row.severityCode === 'Critical' || row.severityCode === 'High' ? 'high' : 'watch',
      geoOverlayLayer: 'incident',
      generatedUtc: new Date().toISOString(),
    });
  };

  const publishDecisionQueueHandoffAndNavigate = (
    target: 'incidents' | 'planning' | 'operations' | 'after-action',
    row: {
      incidentId: number;
      incidentNumber: string;
      incidentName: string;
      groupCode: string;
      severityCode: string;
    },
  ) => {
    publishDecisionQueueHandoff(target, row);
    onNavigateToView?.(target);
    onNotify?.(`Executive queue context sent for ${row.incidentNumber}; opening ${target} workspace.`, 'info');
  };

  const riskWeightForSeverity = (severityCode: string | null) => {
    const normalized = (severityCode ?? 'Unspecified').trim();
    if (normalized === 'Critical') {
      return 4;
    }
    if (normalized === 'High') {
      return 3;
    }
    if (normalized === 'Moderate') {
      return 2;
    }
    if (normalized === 'Low') {
      return 1;
    }
    return 1;
  };

  const decisionQueueRows = filtered
    .map((incident) => {
      const severityWeight = riskWeightForSeverity(incident.severityCode);
      const isActive = incident.incidentStatusCode === 'Active';
      const ageHours = Math.max(0, Math.floor((nowMs - Date.parse(incident.createdUtc)) / (60 * 60 * 1000)));
      const freshnessPressure = ageHours <= 72 ? 20 : ageHours <= 168 ? 10 : 0;
      const riskScore = Math.min(100, (severityWeight * 18) + (isActive ? 22 : 8) + freshnessPressure);
      const groupCode = reportGroupBy === 'status' ? incident.incidentStatusCode : incident.incidentTypeCode;

      return {
        incidentId: incident.incidentId,
        incidentNumber: incident.incidentNumber,
        incidentName: incident.incidentName,
        groupCode,
        groupLabel: resolveGroupLabel(groupCode),
        severityCode: (incident.severityCode ?? 'Unspecified').trim(),
        incidentStatusCode: incident.incidentStatusCode,
        riskScore,
      };
    })
    .sort((left, right) => right.riskScore - left.riskScore || left.incidentNumber.localeCompare(right.incidentNumber))
    .slice(0, 8);

  const predictiveCandidateIncidentId = decisionQueueRows.find((row) => row.incidentStatusCode === 'Active')?.incidentId
    ?? decisionQueueRows[0]?.incidentId
    ?? null;

  useEffect(() => {
    if (!predictiveCandidateIncidentId) {
      setPredictiveDemandSupplyInsight(null);
      setPredictiveDemandSupplyError(null);
      return;
    }

    let isCanceled = false;
    setPredictiveDemandSupplyLoading(true);
    setPredictiveDemandSupplyError(null);

    void getAgentPredictiveDemandSupply(predictiveCandidateIncidentId, predictiveHorizonHours)
      .then((result) => {
        if (isCanceled) {
          return;
        }

        setPredictiveDemandSupplyInsight(result);
      })
      .catch(() => {
        if (isCanceled) {
          return;
        }

        setPredictiveDemandSupplyInsight(null);
        setPredictiveDemandSupplyError('Predictive risk insight is currently unavailable for this report scope.');
      })
      .finally(() => {
        if (isCanceled) {
          return;
        }

        setPredictiveDemandSupplyLoading(false);
      });

    return () => {
      isCanceled = true;
    };
  }, [predictiveCandidateIncidentId, predictiveHorizonHours, predictiveRefreshNonce]);

  const resolveRecommendation = (riskScore: number) => {
    if (riskScore >= 85) {
      return { action: 'Immediate command escalation', confidence: 0.92, variant: 'danger' as const };
    }

    if (riskScore >= 70) {
      return { action: 'Approve surge coordination package', confidence: 0.84, variant: 'warning' as const };
    }

    if (riskScore >= 55) {
      return { action: 'Monitor with scheduled command brief', confidence: 0.76, variant: 'info' as const };
    }

    return { action: 'Routine watch posture', confidence: 0.68, variant: 'secondary' as const };
  };

  const pendingApprovalRows = decisionQueueRows
    .map((row) => {
      const recommendation = resolveRecommendation(row.riskScore);
      return {
        ...row,
        recommendation,
      };
    })
    .filter((row) => row.riskScore >= pendingApprovalConfidenceFloor || row.incidentStatusCode === 'Active' || Boolean(pendingApprovalSelection[row.incidentId]))
    .slice(0, 6);

  const selectedPendingApprovalRows = pendingApprovalRows.filter((row) => pendingApprovalSelection[row.incidentId]);

  const selectedPendingApprovalSummary = selectedPendingApprovalRows.reduce((summary, row) => {
    summary.total += 1;
    summary.averageConfidence += Math.round(row.recommendation.confidence * 100);
    const decision = pendingApprovalDecisions[row.incidentId]?.decision;
    if (decision === 'Approved') {
      summary.approved += 1;
    } else if (decision === 'Deferred') {
      summary.deferred += 1;
    } else if (decision === 'Rejected') {
      summary.rejected += 1;
    } else {
      summary.pending += 1;
    }
    return summary;
  }, { total: 0, approved: 0, deferred: 0, rejected: 0, pending: 0, averageConfidence: 0 });

  if (selectedPendingApprovalSummary.total > 0) {
    selectedPendingApprovalSummary.averageConfidence = Math.round(selectedPendingApprovalSummary.averageConfidence / selectedPendingApprovalSummary.total);
  }

  const togglePendingApprovalSelection = (incidentId: number, selected: boolean) => {
    setPendingApprovalSelection((current) => {
      const next = { ...current };
      if (selected) {
        next[incidentId] = true;
      } else {
        delete next[incidentId];
      }
      return next;
    });
  };

  const selectAllPendingApprovals = () => {
    const next: Record<number, boolean> = {};
    pendingApprovalRows.forEach((row) => {
      next[row.incidentId] = true;
    });
    setPendingApprovalSelection(next);
  };

  const clearAllPendingApprovals = () => {
    setPendingApprovalSelection({});
  };

  const stageDecisionQueueRowForPendingApproval = (row: { incidentId: number; incidentNumber: string; riskScore: number }) => {
    const requiredFloor: 55 | 70 | 85 = row.riskScore >= 85 ? 85 : row.riskScore >= 70 ? 70 : 55;
    setPendingApprovalConfidenceFloor((current) => (current > requiredFloor ? requiredFloor : current));
    togglePendingApprovalSelection(row.incidentId, true);
    onNotify?.(`Staged ${row.incidentNumber} for pending-approval triage.`, 'info');
  };

  const stageTopDecisionQueueForPendingApproval = () => {
    const topRows = decisionQueueRows.slice(0, 3);
    if (topRows.length === 0) {
      onNotify?.('No executive queue rows are available to stage.', 'warning');
      return;
    }

    const next: Record<number, boolean> = {};
    topRows.forEach((row) => {
      next[row.incidentId] = true;
    });
    setPendingApprovalConfidenceFloor(55);
    setPendingApprovalSelection((current) => ({ ...current, ...next }));
    onNotify?.(`Staged top ${topRows.length} executive queue incidents for pending approvals.`, 'info');
  };

  useEffect(() => {
    const allowedIds = new Set(decisionQueueRows.map((row) => row.incidentId));
    setPendingApprovalSelection((current) => {
      const filteredEntries = Object.entries(current).filter(([key, selected]) => selected && allowedIds.has(Number(key)));
      if (filteredEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(filteredEntries.map(([key]) => [Number(key), true])) as Record<number, boolean>;
    });
  }, [decisionQueueRows]);

  const pendingApprovalDecisionTrendRows = useMemo(() => {
    const scopedIncidentIds = new Set(filtered.map((incident) => incident.incidentId));
    const buckets = new Map<string, { date: string; approved: number; deferred: number; rejected: number; total: number }>();

    Object.values(pendingApprovalDecisions).forEach((decision) => {
      if (!scopedIncidentIds.has(decision.incidentId)) {
        return;
      }

      const parsedMs = Date.parse(decision.decidedAtUtc);
      if (!Number.isFinite(parsedMs)) {
        return;
      }

      const bucketKey = new Date(parsedMs).toLocaleDateString();
      const bucket = buckets.get(bucketKey) ?? {
        date: bucketKey,
        approved: 0,
        deferred: 0,
        rejected: 0,
        total: 0,
      };

      if (decision.decision === 'Approved') {
        bucket.approved += 1;
      } else if (decision.decision === 'Deferred') {
        bucket.deferred += 1;
      } else {
        bucket.rejected += 1;
      }

      bucket.total += 1;
      buckets.set(bucketKey, bucket);
    });

    return Array.from(buckets.values()).sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  }, [filtered, pendingApprovalDecisions]);

  const pendingApprovalDecisionHistoryRows = useMemo(() => {
    const scopedIncidentIds = new Set(filtered.map((incident) => incident.incidentId));
    return pendingApprovalDecisionHistory
      .filter((entry) => scopedIncidentIds.has(entry.incidentId))
      .sort((left, right) => Date.parse(right.decidedAtUtc) - Date.parse(left.decidedAtUtc))
      .slice(0, 12);
  }, [filtered, pendingApprovalDecisionHistory]);

  const setPendingApprovalDecision = async (
    row: { incidentId: number; incidentNumber: string; incidentName?: string; recommendation?: { action: string; confidence: number } },
    decision: 'Approved' | 'Deferred' | 'Rejected',
    options?: { silent?: boolean },
  ) => {
    const decisionActor = reportOperatorDisplayName?.trim() || 'Authenticated User';
    const rationale = (pendingApprovalRationales[row.incidentId] ?? '').trim();
    const nextDecision: ReportPendingApprovalDecision = {
      incidentId: row.incidentId,
      decision,
      decidedAtUtc: new Date().toISOString(),
      decidedByDisplayName: decisionActor,
      rationale: rationale.length > 0 ? rationale : undefined,
    };

    setPendingApprovalDecisions((current) => ({
      ...current,
      [row.incidentId]: nextDecision,
    }));

    const historyEntry: ReportDecisionHistoryEntry = {
      incidentId: row.incidentId,
      incidentNumber: row.incidentNumber,
      incidentName: row.incidentName ?? '',
      recommendation: row.recommendation?.action ?? 'Recommendation not captured',
      confidencePercent: Math.round((row.recommendation?.confidence ?? 0) * 100),
      decision,
      decidedAtUtc: nextDecision.decidedAtUtc,
      decidedByDisplayName: decisionActor,
      rationale: nextDecision.rationale,
    };

    setPendingApprovalDecisionHistory((current) => [historyEntry, ...current].slice(0, 50));

    if (!options?.silent) {
      onNotify?.(`Pending approval marked ${decision} for ${row.incidentNumber}.`, decision === 'Rejected' ? 'warning' : 'success');
    }

    try {
      await upsertUserReportPreset(REPORT_APPROVAL_DECISIONS_SCOPE, {
        presetName: `incident-${row.incidentId}`,
        presetJson: JSON.stringify(nextDecision),
      });

      await upsertUserReportPreset(REPORT_DECISION_HISTORY_SCOPE, {
        presetName: `history-${row.incidentId}-${nextDecision.decidedAtUtc}`,
        presetJson: JSON.stringify(historyEntry),
      });
    } catch {
      onNotify?.('Pending approval decision was saved locally; server sync is unavailable.', 'warning');
    }
  };

  const applyBatchPendingApprovalDecision = async (decision: 'Approved' | 'Deferred' | 'Rejected') => {
    if (selectedPendingApprovalRows.length === 0) {
      onNotify?.('Select at least one pending approval row to apply a batch decision.', 'warning');
      return;
    }

    for (const row of selectedPendingApprovalRows) {
      // eslint-disable-next-line no-await-in-loop
      await setPendingApprovalDecision(row, decision, { silent: true });
    }

    onNotify?.(
      `Batch decision ${decision} applied to ${selectedPendingApprovalRows.length} pending approvals (avg confidence ${selectedPendingApprovalSummary.averageConfidence}%).`,
      decision === 'Rejected' ? 'warning' : 'success',
    );
  };

  const riskTimelineRows = Array.from(filtered.reduce((accumulator, incident) => {
    const bucket = new Date(incident.createdUtc).toLocaleDateString();
    const current = accumulator.get(bucket) ?? { date: bucket, riskScore: 0, incidents: 0, activeIncidents: 0 };
    current.riskScore += riskWeightForSeverity(incident.severityCode);
    current.incidents += 1;
    if (incident.incidentStatusCode === 'Active') {
      current.activeIncidents += 1;
    }
    accumulator.set(bucket, current);
    return accumulator;
  }, new Map<string, { date: string; riskScore: number; incidents: number; activeIncidents: number }>()).values())
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));

  const gridRows = tableRows.map((row) => ({
    id: `${reportGroupBy}-${row.group}`,
    group: resolveGroupLabel(row.group),
    count: row.count,
  }));

  const providerScatterRows = (externalProviderHealthTrends?.providerSummary ?? [])
    .map((item) => ({
      provider: item.provider,
      failureRatePercent: Number((item.failureRate * 100).toFixed(2)),
      totalEvents: item.total,
    }))
    .sort((a, b) => b.failureRatePercent - a.failureRatePercent || b.totalEvents - a.totalEvents)
    .slice(0, 20);

  const trendLineRows = (externalProviderHealthTrends?.buckets ?? []).map((bucket) => ({
    label: new Date(bucket.bucketStartUtc).toLocaleDateString(),
    total: bucket.total,
    failureRatePercent: Number((bucket.failureRate * 100).toFixed(2)),
    successCount: bucket.successCount,
    failureCount: Math.max(0, bucket.total - bucket.successCount),
  }));

  const providerFailureRankRows = (externalProviderHealthTrends?.providerSummary ?? [])
    .map((item) => ({
      provider: item.provider,
      failureRatePercent: Number((item.failureRate * 100).toFixed(2)),
      total: item.total,
    }))
    .sort((a, b) => b.failureRatePercent - a.failureRatePercent || b.total - a.total)
    .slice(0, 10);

  const governanceScorecardRows = (externalProviderHealthTrends?.providerSummary ?? [])
    .map((item) => {
      const failureRatePercent = Number((item.failureRate * 100).toFixed(2));
      const reliabilityScore = Math.max(0, Math.min(100, Number((100 - failureRatePercent).toFixed(2))));
      const tier = failureRatePercent >= 25
        ? 'At-Risk'
        : failureRatePercent >= 10
          ? 'Watch'
          : 'Stable';

      return {
        provider: item.provider,
        failureRatePercent,
        reliabilityScore,
        total: item.total,
        tier,
      };
    })
    .sort((a, b) => a.reliabilityScore - b.reliabilityScore || b.total - a.total)
    .slice(0, 8);

  const governancePosture = {
    totalEvents: externalProviderHealthTrends?.totals.events ?? 0,
    failureRatePercent: Number(((externalProviderHealthTrends?.totals.failureRate ?? 0) * 100).toFixed(2)),
    providersObserved: externalProviderHealthTrends?.providerSummary.length ?? 0,
    federationEnvironments: externalProviderHealthFederationSummary?.environmentCount ?? 0,
  };

  const hvaSnapshotRows = [
    {
      hazard: 'Public health surge escalation',
      probability: severityRiskScore >= 70 ? 'High' : severityRiskScore >= 45 ? 'Moderate' : 'Low',
      impact: volumeHealthScore >= 75 ? 'High' : volumeHealthScore >= 45 ? 'Moderate' : 'Low',
      mitigation: 'Elevate cross-agency command watch, verify surge staffing posture, and pre-stage critical supply channels.',
    },
    {
      hazard: 'Command delivery degradation',
      probability: governancePosture.failureRatePercent >= 10 ? 'Moderate' : 'Low',
      impact: reportingCompletenessScore < 60 ? 'High' : 'Moderate',
      mitigation: 'Activate external provider governance drill, route to Operations for corrective dispatch sequencing, and confirm acknowledgments.',
    },
    {
      hazard: 'Decision latency due to unresolved recommendations',
      probability: pendingApprovalRows.length > 0 ? 'Moderate' : 'Low',
      impact: selectedPendingApprovalSummary.pending > 0 ? 'High' : 'Moderate',
      mitigation: 'Run pending approval batch triage and publish executive brief with attributed decision history before shift handoff.',
    },
  ];

  const exportHvaReadinessSnapshotCsv = () => {
    const generatedUtc = new Date().toISOString();
    const metadata = [
      ['GeneratedUtc', generatedUtc],
      ['ReportWindowDays', reportWindowDays],
      ['ReportGroupBy', reportGroupBy],
      ['StatusFilter', reportStatusFilter],
      ['TypeFilter', reportTypeFilter],
      ['VolumeHealthScore', volumeHealthScore],
      ['SeverityRiskScore', severityRiskScore],
      ['ReportingCompletenessScore', reportingCompletenessScore],
      ['GovernanceFailureRatePercent', governancePosture.failureRatePercent],
      ['PendingApprovalRows', pendingApprovalRows.length],
    ].map(([key, value]) => `# ${csvEscape(key)},${csvEscape(value)}`);

    const header = ['Hazard', 'Probability', 'Impact', 'Mitigation'].join(',');
    const rows = hvaSnapshotRows.map((row) => [
      csvEscape(row.hazard),
      csvEscape(row.probability),
      csvEscape(row.impact),
      csvEscape(row.mitigation),
    ].join(','));

    const content = [...metadata, header, ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'reports-hva-readiness-snapshot', 'csv');
    onNotify?.('HVA readiness snapshot CSV exported for RFP evidence workflows.', 'success');
  };

  const exportFemaCompatibleAarCsv = () => {
    const generatedUtc = new Date().toISOString();
    const metadata = [
      ['GeneratedUtc', generatedUtc],
      ['Format', 'FEMA-Compatible AAR/IP Baseline'],
      ['ReportWindowDays', reportWindowDays],
      ['ReportGroupBy', reportGroupBy],
      ['StatusFilter', reportStatusFilter],
      ['TypeFilter', reportTypeFilter],
      ['IncidentRows', filtered.length],
      ['PendingApprovalRows', pendingApprovalRows.length],
      ['DecisionHistoryRows', pendingApprovalDecisionHistoryRows.length],
      ['VolumeHealthScore', volumeHealthScore],
      ['SeverityRiskScore', severityRiskScore],
      ['ReportingCompletenessScore', reportingCompletenessScore],
    ].map(([key, value]) => `# ${csvEscape(key)},${csvEscape(value)}`);

    const summaryHeader = ['Section', 'Metric', 'Value'].join(',');
    const summaryRows = [
      ['Operational summary', 'Comparative posture narrative', comparisonNarrative],
      ['Operational summary', 'Executive baseline UTC', executiveDeltaReferenceDateUtc ?? 'Not captured'],
      ['Operational summary', 'Governance failure rate percent', governancePosture.failureRatePercent],
      ['Operational summary', 'Top queue incidents in scope', decisionQueueRows.length],
    ].map((row) => row.map((value) => csvEscape(value)).join(','));

    const decisionHeader = ['Section', 'DecidedAtUtc', 'IncidentNumber', 'IncidentName', 'Decision', 'DecidedBy', 'Rationale'].join(',');
    const decisionRows = (pendingApprovalDecisionHistoryRows.length > 0
      ? pendingApprovalDecisionHistoryRows
      : [{
        decidedAtUtc: generatedUtc,
        incidentNumber: 'N/A',
        incidentName: 'No decision history entries in current report scope',
        decision: 'N/A',
        decidedByDisplayName: '',
        rationale: '',
      }]
    ).map((entry) => [
      csvEscape('Decision history'),
      csvEscape(entry.decidedAtUtc),
      csvEscape(entry.incidentNumber),
      csvEscape(entry.incidentName),
      csvEscape(entry.decision),
      csvEscape(entry.decidedByDisplayName ?? ''),
      csvEscape(entry.rationale ?? ''),
    ].join(','));

    const timelineHeader = ['Section', 'TimelineDate', 'RiskScore', 'ActiveIncidents', 'Incidents'].join(',');
    const timelineRows = (riskTimelineRows.length > 0
      ? riskTimelineRows
      : [{ date: 'N/A', riskScore: 0, activeIncidents: 0, incidents: 0 }]
    ).map((row) => [
      csvEscape('Risk timeline'),
      csvEscape(row.date),
      csvEscape(row.riskScore),
      csvEscape(row.activeIncidents),
      csvEscape(row.incidents),
    ].join(','));

    const hazardHeader = ['Section', 'Hazard', 'Probability', 'Impact', 'Mitigation'].join(',');
    const hazardRows = hvaSnapshotRows.map((row) => [
      csvEscape('HVA readiness'),
      csvEscape(row.hazard),
      csvEscape(row.probability),
      csvEscape(row.impact),
      csvEscape(row.mitigation),
    ].join(','));

    const content = [
      ...metadata,
      summaryHeader,
      ...summaryRows,
      decisionHeader,
      ...decisionRows,
      timelineHeader,
      ...timelineRows,
      hazardHeader,
      ...hazardRows,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'reports-fema-compatible-aar', 'csv');
    onNotify?.('FEMA-compatible AAR/IP baseline CSV exported.', 'success');
  };

  const exportRiskTimelineReplayCsv = () => {
    const generatedUtc = new Date().toISOString();
    const metadata = [
      ['GeneratedUtc', generatedUtc],
      ['ReportWindowDays', reportWindowDays],
      ['ReportGroupBy', reportGroupBy],
      ['StatusFilter', reportStatusFilter],
      ['TypeFilter', reportTypeFilter],
      ['IncidentRows', filtered.length],
      ['TimelineRows', riskTimelineRows.length],
    ].map(([key, value]) => `# ${csvEscape(key)},${csvEscape(value)}`);

    const timelineHeader = ['TimelineDate', 'RiskScore', 'ActiveIncidents', 'Incidents'].join(',');
    const timelineRows = (riskTimelineRows.length > 0
      ? riskTimelineRows
      : [{ date: 'N/A', riskScore: 0, activeIncidents: 0, incidents: 0 }]
    ).map((row) => [
      csvEscape(row.date),
      csvEscape(row.riskScore),
      csvEscape(row.activeIncidents),
      csvEscape(row.incidents),
    ].join(','));

    const replayHeader = ['IncidentNumber', 'IncidentName', 'CreatedUtc', 'Status', 'Severity'].join(',');
    const replayRows = (filtered.length > 0
      ? [...filtered]
        .sort((left, right) => Date.parse(left.createdUtc) - Date.parse(right.createdUtc))
        .slice(0, 200)
      : [{ incidentNumber: 'N/A', incidentName: 'No incidents in current report scope', createdUtc: generatedUtc, incidentStatusCode: 'N/A', severityCode: 'N/A' }]
    ).map((incident) => [
      csvEscape(incident.incidentNumber),
      csvEscape(incident.incidentName),
      csvEscape(incident.createdUtc),
      csvEscape(incident.incidentStatusCode),
      csvEscape(incident.severityCode ?? 'Unspecified'),
    ].join(','));

    const content = [
      ...metadata,
      timelineHeader,
      ...timelineRows,
      replayHeader,
      ...replayRows,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'reports-risk-timeline-replay', 'csv');
    onNotify?.('Risk timeline replay CSV exported.', 'success');
  };

  const aarImprovementPlanRows = [
    {
      capabilityGap: 'Decision closure latency',
      observedSignal: `${selectedPendingApprovalSummary.pending} pending recommendation decisions`,
      correctiveAction: 'Run batch decision workflow and publish executive brief with attributed decision log before next command update.',
      ownerLane: 'Operations',
      targetWindow: 'Next operational period',
    },
    {
      capabilityGap: 'Reporting completeness drift',
      observedSignal: `Reporting completeness score at ${reportingCompletenessScore}%`,
      correctiveAction: 'Assign overdue objective/task triage owner and execute mid-shift reporting integrity checkpoint.',
      ownerLane: 'Planning',
      targetWindow: 'Within 24 hours',
    },
    {
      capabilityGap: 'Risk stabilization pressure',
      observedSignal: `Severity risk index ${severityRiskScore}% with ${decisionQueueRows.length} queue incidents in scope`,
      correctiveAction: 'Prioritize high-risk queue incidents for command routing and verify cross-workspace mitigation handoff completion.',
      ownerLane: 'Incident Command',
      targetWindow: 'Immediate',
    },
  ];

  const exportAarImprovementPlanCsv = () => {
    const generatedUtc = new Date().toISOString();
    const metadata = [
      ['GeneratedUtc', generatedUtc],
      ['Format', 'AAR Improvement Plan Baseline'],
      ['ReportWindowDays', reportWindowDays],
      ['ReportGroupBy', reportGroupBy],
      ['StatusFilter', reportStatusFilter],
      ['TypeFilter', reportTypeFilter],
      ['IncidentRows', filtered.length],
      ['DecisionQueueRows', decisionQueueRows.length],
      ['PendingApprovalRows', pendingApprovalRows.length],
      ['ReportingCompletenessScore', reportingCompletenessScore],
      ['SeverityRiskScore', severityRiskScore],
    ].map(([key, value]) => `# ${csvEscape(key)},${csvEscape(value)}`);

    const header = ['CapabilityGap', 'ObservedSignal', 'CorrectiveAction', 'OwnerLane', 'TargetWindow'].join(',');
    const rows = aarImprovementPlanRows.map((row) => [
      csvEscape(row.capabilityGap),
      csvEscape(row.observedSignal),
      csvEscape(row.correctiveAction),
      csvEscape(row.ownerLane),
      csvEscape(row.targetWindow),
    ].join(','));

    const content = [...metadata, header, ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'reports-aar-improvement-plan', 'csv');
    onNotify?.('AAR improvement plan baseline CSV exported.', 'success');
  };

  const applyReportTemplate = (template: 'executive' | 'risk' | 'volume') => {
    if (template === 'risk') {
      setAdvancedWidgetIds(['kpi-governance-posture', 'area-failure-trend', 'scatter-provider-risk']);
      return;
    }

    if (template === 'volume') {
      setAdvancedWidgetIds(['kpi-governance-posture', 'line-volume', 'line-success-vs-failure']);
      return;
    }

    setAdvancedWidgetIds(['kpi-governance-posture', 'line-volume', 'line-success-vs-failure', 'area-failure-trend', 'scatter-provider-risk', 'bar-provider-failure-rate']);
  };

  const applyAdvancedInsightTemplate = (template: 'governance' | 'surveillance' | 'capacity') => {
    if (template === 'governance') {
      setAdvancedWidgetIds(['kpi-governance-posture', 'line-success-vs-failure', 'area-failure-trend', 'bar-provider-failure-rate']);
      return;
    }

    if (template === 'surveillance') {
      setAdvancedWidgetIds(['kpi-governance-posture', 'area-failure-trend', 'scatter-provider-risk']);
      return;
    }

    setAdvancedWidgetIds(['kpi-governance-posture', 'line-volume', 'line-success-vs-failure', 'scatter-provider-risk']);
  };

  const moveAdvancedWidget = (widgetId: string, direction: 'up' | 'down') => {
    setAdvancedWidgetIds((current) => {
      const index = current.indexOf(widgetId);
      if (index < 0) {
        return current;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const removeAdvancedWidget = (widgetId: string) => {
    setAdvancedWidgetIds((current) => current.filter((id) => id !== widgetId));
    setSelectedAdvancedWidgetId((current) => (current === widgetId ? null : current));
  };

  const handleAdvancedWidgetDragStart = (widgetId: string, event: ReactDragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/x-ipoc-reports-widget', widgetId);
    setDraggingAdvancedWidgetId(widgetId);
    setSelectedAdvancedWidgetId(widgetId);
  };

  const handleAdvancedWidgetDragEnd = () => {
    setDraggingAdvancedWidgetId(null);
  };

  const insertGeneratedReportSpecAtWidget = (specJson: string, targetWidgetId: string) => {
    const parsed = parseVisualizationSpecJson(specJson, 'reports');
    if (!parsed || parsed.widgetIds.length === 0) {
      return;
    }

    setAdvancedWidgetIds((current) => {
      const targetIndex = current.indexOf(targetWidgetId);
      if (targetIndex < 0) {
        return current;
      }

      const incoming = Array.from(new Set(parsed.widgetIds));
      const currentWithoutIncoming = current.filter((widgetId) => !incoming.includes(widgetId));
      const safeInsertIndex = Math.max(0, Math.min(targetIndex, currentWithoutIncoming.length));

      return [
        ...currentWithoutIncoming.slice(0, safeInsertIndex),
        ...incoming,
        ...currentWithoutIncoming.slice(safeInsertIndex),
      ];
    });
  };

  const handleAdvancedWidgetDrop = (targetWidgetId: string) => {
    if (!designCanvasMode || !draggingAdvancedWidgetId || draggingAdvancedWidgetId === targetWidgetId) {
      return;
    }

    setAdvancedWidgetIds((current) => {
      const sourceIndex = current.indexOf(draggingAdvancedWidgetId);
      const targetIndex = current.indexOf(targetWidgetId);
      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDraggingAdvancedWidgetId(null);
  };

  const reportWidgetLabelMap: Record<string, string> = {
    'kpi-governance-posture': 'Governance posture KPI',
    'line-volume': 'Temporal incident volume line chart',
    'line-success-vs-failure': 'Success vs failure trend line chart',
    'area-failure-trend': 'Failure-rate area trend',
    'scatter-provider-risk': 'Provider risk scatter plot',
    'bar-provider-failure-rate': 'Provider failure-rate bar ranking',
  };

  const reportWidgetOrderMap = useMemo(() => {
    const orderMap = new Map<string, number>();
    advancedWidgetIds.forEach((widgetId, index) => {
      orderMap.set(widgetId, index);
    });
    return orderMap;
  }, [advancedWidgetIds]);

  const getReportWidgetOrderStyle = (widgetId: string): CSSProperties => {
    const order = reportWidgetOrderMap.get(widgetId);
    return {
      order: typeof order === 'number' ? order : 100,
      cursor: designCanvasMode ? 'grab' : 'default',
      opacity: draggingAdvancedWidgetId === widgetId ? 0.7 : 1,
      minWidth: 0,
      outline: designCanvasMode && selectedAdvancedWidgetId === widgetId ? '2px solid var(--bs-primary)' : undefined,
      outlineOffset: designCanvasMode && selectedAdvancedWidgetId === widgetId ? 1 : undefined,
      borderRadius: designCanvasMode && selectedAdvancedWidgetId === widgetId ? 6 : undefined,
    };
  };

  const reportPromptPreview = useMemo(() => {
    const trimmedPrompt = reportPromptText.trim();
    if (!trimmedPrompt) {
      return null;
    }

    const plannedSpec = generateVisualizationSpec('reports', trimmedPrompt);
    const metadata = [
      `time grain: ${plannedSpec.timeGrain}`,
      `grouping: ${plannedSpec.grouping}`,
      plannedSpec.topN !== null ? `top ${plannedSpec.topN}` : null,
      plannedSpec.thresholdPercent !== null ? `threshold ${plannedSpec.thresholdPercent}%` : null,
    ].filter((item): item is string => item !== null).join(' · ');

    const widgetSummary = plannedSpec.widgetIds.map((widgetId) => reportWidgetLabelMap[widgetId] ?? widgetId).join(', ');
    return metadata.length > 0 ? `${widgetSummary} (${metadata})` : widgetSummary;
  }, [reportPromptText]);

  const reportPaletteStyle = useMemo(() => ({
    '--ipoc-chart-series-1': reportPalette.series1,
    '--ipoc-chart-series-2': reportPalette.series2,
    '--ipoc-chart-series-3': reportPalette.series3,
    '--ipoc-chart-critical': reportPalette.critical,
    '--ipoc-chart-warning': reportPalette.warning,
    '--ipoc-chart-success': reportPalette.success,
    '--ipoc-chart-info': reportPalette.info,
    '--ipoc-chart-neutral': reportPalette.neutral,
  } as CSSProperties), [reportPalette]);

  const saveReportPalette = async () => {
    try {
      const userReportPresetId = await upsertUserReportPreset(REPORT_PALETTE_SCOPE, {
        presetName: 'Reports Visual Palette',
        presetJson: JSON.stringify(reportPalette),
      });
      setReportPaletteServerPresetId(userReportPresetId);
    } catch {
      // Keep local palette when server persistence is unavailable.
    }
  };

  const generateAdvancedReportWidgets = async () => {
    const trimmedPrompt = reportPromptText.trim();
    if (!trimmedPrompt) {
      return;
    }

    const spec = generateVisualizationSpec('reports', trimmedPrompt);
    const plannedList = spec.widgetIds;
    const focusWidgetId = reportPromptApplyMode === 'replace'
      ? plannedList[0]
      : plannedList.find((widgetId) => !advancedWidgetIds.includes(widgetId)) ?? plannedList[0];

    if (reportPromptApplyMode === 'replace') {
      setAdvancedWidgetIds(plannedList);
    } else {
      setAdvancedWidgetIds((current) => {
        const merged = [...current];
        plannedList.forEach((widgetId) => {
          if (!merged.includes(widgetId)) {
            merged.push(widgetId);
          }
        });
        return merged;
      });
    }

    if (focusWidgetId) {
      if (promptFocusTimerRef.current !== null) {
        window.clearTimeout(promptFocusTimerRef.current);
      }

      promptFocusTimerRef.current = window.setTimeout(() => {
        const target = document.getElementById(`reports-widget-${focusWidgetId}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }

    const specName = `Prompt ${new Date(spec.generatedUtc).toLocaleString()}`;
    const specJson = JSON.stringify(spec);

    const localRecordId = `local-${Date.now()}`;
    const generatedUtc = new Date().toISOString();

    setReportGeneratedSpecs((current) => {
      const next: GeneratedVisualizationSpecRecord[] = [{
        id: localRecordId,
        name: specName,
        specJson,
        source: 'local' as const,
        updatedUtc: generatedUtc,
        createdBy: 'Agent prompt',
      }, ...current].slice(0, 12);
      return next;
    });

    try {
      const userReportPresetId = await upsertUserReportPreset(REPORT_GENERATED_SPECS_SCOPE, {
        presetName: specName,
        presetJson: specJson,
      });

      setReportGeneratedSpecs((current) => current.map((item) => (
        item.id === localRecordId
          ? {
            ...item,
            id: `server-${userReportPresetId}`,
            userReportPresetId,
            source: 'server',
            updatedUtc: new Date().toISOString(),
          }
          : item
      )));
    } catch {
      // Keep local generated spec when server persistence is unavailable.
    }
  };

  const gridColumnDefs: ColDef<{ id: string; group: string; count: number }>[] = [
    {
      field: 'group',
      headerName: 'Group',
      flex: 2,
      minWidth: 180,
    },
    {
      field: 'count',
      headerName: 'Count',
      flex: 1,
      minWidth: 120,
      sort: 'desc',
      type: 'numericColumn',
      cellClass: 'text-end fw-semibold',
    },
  ];

  const severityDistributionTotal = severityChartData.reduce((sum, item) => sum + item.value, 0);

  const executiveNarrative = useMemo(() => {
    const attentionItems: string[] = [];

    if (severityRiskScore >= 65) {
      attentionItems.push(`severity pressure remains elevated at ${severityRiskScore}%`);
    }

    if ((dashboardSummary?.overdueTaskCount ?? 0) > 0) {
      attentionItems.push(`${dashboardSummary?.overdueTaskCount ?? 0} overdue tasks require command triage`);
    }

    if (reportingCompletenessScore < 70) {
      attentionItems.push(`reporting completeness is at ${reportingCompletenessScore}%`);
    }

    const statusLine = attentionItems.length > 0
      ? `Executive watch: ${attentionItems.join('; ')}.`
      : 'Executive watch: operational posture is stable for the active report scope.';

    return `${statusLine} Window includes ${filtered.length} incidents with ${dashboardSummary?.openObjectiveCount ?? 0} open objectives and ${dashboardSummary?.openTaskCount ?? 0} open tasks.`;
  }, [dashboardSummary?.openObjectiveCount, dashboardSummary?.openTaskCount, dashboardSummary?.overdueTaskCount, filtered.length, reportingCompletenessScore, severityRiskScore]);

  const saveReportFilterPreset = async () => {
    const name = reportFilterPresetName.trim();
    if (!name) {
      return;
    }

    const nextPreset: ReportFilterPreset = {
      id: `local-${Date.now()}`,
      name,
      windowDays: reportWindowDays,
      groupBy: reportGroupBy,
      statusFilter: reportStatusFilter,
      typeFilter: reportTypeFilter,
      drilldownGroup: chartDrilldownGroup,
      drilldownSeverity: chartDrilldownSeverity,
      source: 'local',
    };

    setReportFilterPresets((current) => [nextPreset, ...current].slice(0, 12));
    setReportFilterPresetName('');

    try {
      const userReportPresetId = await upsertUserReportPreset(REPORT_FILTER_PRESET_SCOPE, {
        presetName: name,
        presetJson: JSON.stringify({
          windowDays: nextPreset.windowDays,
          groupBy: nextPreset.groupBy,
          statusFilter: nextPreset.statusFilter,
          typeFilter: nextPreset.typeFilter,
          drilldownGroup: nextPreset.drilldownGroup ?? null,
          drilldownSeverity: nextPreset.drilldownSeverity ?? null,
        }),
      });

      setReportFilterPresets((current) => current.map((preset) => (
        preset.id === nextPreset.id
          ? {
            ...preset,
            id: `server-${userReportPresetId}`,
            userReportPresetId,
            source: 'server',
          }
          : preset
      )));
    } catch {
      // Keep local fallback preset.
    }
  };

  const applyReportFilterPreset = (preset: ReportFilterPreset) => {
    setReportWindowDays(preset.windowDays);
    setReportGroupBy(preset.groupBy);
    setReportStatusFilter(preset.statusFilter);
    setReportTypeFilter(preset.typeFilter);
    setChartDrilldownGroup(preset.drilldownGroup ?? null);
    setChartDrilldownSeverity(preset.drilldownSeverity ?? null);
  };

  const deleteReportFilterPreset = async (preset: ReportFilterPreset) => {
    if (preset.userReportPresetId) {
      try {
        await deleteUserReportPreset(REPORT_FILTER_PRESET_SCOPE, preset.userReportPresetId);
      } catch {
        // Continue local removal.
      }
    }

    setReportFilterPresets((current) => current.filter((item) => item.id !== preset.id));
  };

  return (
    <Card className="shadow-sm mb-3" style={reportPaletteStyle}>
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <span>Reports and Ad-Hoc Analytics Workspace</span>
        <Badge bg="secondary">Beta</Badge>
      </Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3">
          <Col md={3}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Time window" info="Filter report rows by incident creation date window." /></Form.Label>
            <Form.Select value={reportWindowDays} onChange={(e) => setReportWindowDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 365 days</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Group by" info="Choose whether report counts are grouped by status or incident type." /></Form.Label>
            <Form.Select value={reportGroupBy} onChange={(e) => setReportGroupBy(e.target.value as 'status' | 'type')}>
              <option value="status">Incident Status</option>
              <option value="type">Incident Type</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Status filter" info="Restrict report rows to a specific status." /></Form.Label>
            <Form.Select value={reportStatusFilter} onChange={(e) => setReportStatusFilter(e.target.value)}>
              <option value="All">All statuses</option>
              {incidentStatusLookups.map((item) => (
                <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Type filter" info="Restrict report rows to a specific incident type." /></Form.Label>
            <Form.Select value={reportTypeFilter} onChange={(e) => setReportTypeFilter(e.target.value)}>
              <option value="All">All types</option>
              {incidentTypeLookups.map((item) => (
                <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>

        <Row className="g-2 mb-3">
          <Col md={2}><Badge bg="primary">Rows: {filtered.length}</Badge></Col>
          <Col md={2}><Badge bg="secondary">Open Tasks: {dashboardSummary?.openTaskCount ?? 0}</Badge></Col>
          <Col md={2}><Badge bg="danger">Overdue Tasks: {dashboardSummary?.overdueTaskCount ?? 0}</Badge></Col>
          <Col md={3}><Badge bg="info" text="dark">Open Objectives: {dashboardSummary?.openObjectiveCount ?? 0}</Badge></Col>
          <Col md={3} className="text-md-end">
            <IconActionButton
              iconClassName="bi bi-bar-chart-line"
              tooltip={hasPowerBiEmbed ? 'Power BI embedded panel available below.' : 'Set VITE_POWERBI_EMBED_URL to enable Power BI embedded panel.'}
              ariaLabel={hasPowerBiEmbed ? 'Power BI embedded available' : 'Power BI embedded planned'}
              onClick={() => {}}
              variant="outline-secondary"
              disabled={!hasPowerBiEmbed}
            />
          </Col>
        </Row>

        <Row className="g-2 mb-3">
          <Col md={4}>
            <Card className="ipoc-mission-kpi-card h-100">
              <Card.Body className="py-2">
                <div className="small text-muted">Reporting volume health</div>
                <div className="fw-semibold fs-5">{volumeHealthScore}%</div>
                <div className="small text-muted">Window rows normalized for dashboard posture.</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="ipoc-mission-kpi-card h-100">
              <Card.Body className="py-2">
                <div className="small text-muted">Severity risk index</div>
                <div className="fw-semibold fs-5">{severityRiskScore}%</div>
                <div className="small text-muted">Weighted by critical/high/moderate incident composition.</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="ipoc-mission-kpi-card h-100">
              <Card.Body className="py-2">
                <div className="small text-muted">Reporting completeness</div>
                <div className="fw-semibold fs-5">{reportingCompletenessScore}%</div>
                <div className="small text-muted">Derived from open vs overdue tasks and open objectives.</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-2 mb-3">
          <Col md={12}>
            <Card className="border-0 bg-body-tertiary">
              <Card.Body className="py-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                  <div className="small fw-semibold">Executive decision brief package</div>
                  <div className="small text-muted">
                    Baseline: {executiveDeltaReferenceDateUtc ? new Date(executiveDeltaReferenceDateUtc).toLocaleString() : 'Not captured'}
                  </div>
                </div>
                <div className="d-inline-flex align-items-center gap-2">
                  <IconActionButton
                    iconClassName="bi bi-journal-richtext"
                    tooltip="Export FEMA-compatible AAR/IP baseline CSV for after-action readiness evidence"
                    ariaLabel="Export FEMA-compatible AAR IP baseline CSV"
                    onClick={exportFemaCompatibleAarCsv}
                    variant="outline-dark"
                    testId="reports-fema-aar-export"
                  />
                  <IconActionButton
                    iconClassName="bi bi-clipboard2-check"
                    tooltip="Export AAR improvement plan baseline CSV with corrective actions and owner lanes"
                    ariaLabel="Export AAR improvement plan baseline CSV"
                    onClick={exportAarImprovementPlanCsv}
                    variant="outline-secondary"
                    testId="reports-aar-improvement-plan-export"
                  />
                  <IconActionButton
                    iconClassName="bi bi-clock-history"
                    tooltip="Capture trend delta baseline timestamp"
                    ariaLabel="Capture trend delta baseline timestamp"
                    onClick={stampExecutiveDeltaBaseline}
                    variant="outline-secondary"
                    testId="reports-executive-brief-stamp-baseline"
                  />
                  <IconActionButton
                    iconClassName="bi bi-file-earmark-arrow-down"
                    tooltip="Export executive decision brief with trend deltas and top recommendations"
                    ariaLabel="Export executive decision brief package"
                    onClick={exportExecutiveDecisionBrief}
                    variant="outline-primary"
                    testId="reports-executive-brief-export"
                  />
                  <IconActionButton
                    iconClassName="bi bi-eye"
                    tooltip="Preview executive decision brief markdown before export"
                    ariaLabel="Preview executive decision brief package"
                    onClick={previewExecutiveDecisionBrief}
                    variant="outline-secondary"
                    testId="reports-executive-brief-preview"
                  />
                  <IconActionButton
                    iconClassName="bi bi-clipboard"
                    tooltip="Copy executive decision brief markdown content to clipboard"
                    ariaLabel="Copy executive decision brief to clipboard"
                    onClick={() => { void copyExecutiveDecisionBriefToClipboard(); }}
                    variant="outline-secondary"
                    testId="reports-executive-brief-copy"
                  />
                  <IconActionButton
                    iconClassName="bi bi-robot"
                    tooltip="Stage executive decision brief as a prefilled prompt for AI Incident Co-Pilot"
                    ariaLabel="Stage executive decision brief for AI Incident Co-Pilot"
                    onClick={stageExecutiveDecisionBriefForAssistant}
                    variant="outline-info"
                    testId="reports-executive-brief-stage-assistant"
                  />
                  <IconActionButton
                    iconClassName="bi bi-trash"
                    tooltip="Clear cached executive brief preview content"
                    ariaLabel="Clear cached executive decision brief preview"
                    onClick={clearExecutiveDecisionBriefCache}
                    variant="outline-secondary"
                    disabled={executiveBriefPreviewMarkdown.trim().length === 0}
                    testId="reports-executive-brief-clear-cache"
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-2 mb-3">
          <Col md={12}>
            <Card className="border-0 bg-body-tertiary" data-testid="reports-hva-readiness-card">
              <Card.Body className="py-2">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <div>
                    <div className="small fw-semibold">HVA readiness snapshot</div>
                    <div className="small text-muted">Command-ready hazard probability/impact baseline derived from current report scope.</div>
                  </div>
                  <div className="d-inline-flex align-items-center gap-2">
                    <IconActionButton
                      iconClassName="bi bi-file-earmark-spreadsheet"
                      tooltip="Export HVA readiness snapshot as CSV for bid and operational evidence workflows"
                      ariaLabel="Export HVA readiness snapshot CSV"
                      onClick={exportHvaReadinessSnapshotCsv}
                      variant="outline-primary"
                      testId="reports-hva-readiness-export"
                    />
                  </div>
                </div>
                <div className="table-responsive" data-testid="reports-hva-readiness-table">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Hazard</th>
                        <th className="text-end">Probability</th>
                        <th className="text-end">Impact</th>
                        <th>Mitigation baseline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hvaSnapshotRows.map((row) => (
                        <tr key={row.hazard}>
                          <td><strong>{row.hazard}</strong></td>
                          <td className="text-end">{row.probability}</td>
                          <td className="text-end">{row.impact}</td>
                          <td className="small text-muted">{row.mitigation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Modal show={executiveBriefPreviewOpen} onHide={() => setExecutiveBriefPreviewOpen(false)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title className="small fw-semibold">Executive decision brief preview</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="small text-muted mb-2" data-testid="reports-executive-brief-preview-meta">
              Generated: {executiveBriefPreviewGeneratedUtc ? new Date(executiveBriefPreviewGeneratedUtc).toLocaleString() : 'Unknown'} · Recommendations: {executiveBriefPreviewRecommendationCount}
            </div>
            {executiveBriefPreviewGeneratedUtc ? (
              <div className="small text-muted mb-2" data-testid="reports-executive-brief-preview-generated-utc">
                Generated UTC (exact): {executiveBriefPreviewGeneratedUtc}
              </div>
            ) : null}
            <div className="small mb-2" data-testid="reports-executive-brief-preview-quality-checklist">
              <div className="fw-semibold">Brief quality checklist</div>
              <div className="d-inline-flex flex-wrap gap-1 mt-1">
                <Badge bg={executiveBriefPreviewHasBaseline ? 'success' : 'warning'}>
                  Baseline {executiveBriefPreviewHasBaseline ? 'captured' : 'missing'}
                </Badge>
                <Badge bg={executiveBriefPreviewRecommendationCount > 0 ? 'success' : 'warning'}>
                  Recommendations {executiveBriefPreviewRecommendationCount > 0 ? 'included' : 'missing'}
                </Badge>
                <Badge bg={executiveBriefPreviewHasDecisionHistory ? 'success' : 'warning'}>
                  Decision history {executiveBriefPreviewHasDecisionHistory ? 'included' : 'missing'}
                </Badge>
                <Badge bg={executiveBriefPreviewIsStale ? 'warning' : 'success'} data-testid="reports-executive-brief-preview-freshness">
                  Freshness {executiveBriefPreviewIsStale ? `stale (${executiveBriefPreviewAgeText})` : `current (${executiveBriefPreviewAgeText})`}
                </Badge>
                {executiveBriefPreviewLastCacheRestored ? (
                  <Badge bg="info" data-testid="reports-executive-brief-preview-cache-source">
                    Source cache-restored
                  </Badge>
                ) : null}
              </div>
            </div>
            <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap' }} data-testid="reports-executive-brief-preview-content">{executiveBriefPreviewMarkdown}</pre>
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" variant="outline-secondary" onClick={() => setExecutiveBriefPreviewOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              variant="outline-warning"
              onClick={regenerateExecutiveDecisionBriefFromLiveData}
              disabled={pendingApprovalRows.length === 0}
              data-testid="reports-executive-brief-preview-regenerate"
            >
              Regenerate now
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => { void copyExecutiveDecisionBriefToClipboard(); }}
              data-testid="reports-executive-brief-preview-copy"
            >
              Copy brief
            </Button>
            <Button
              size="sm"
              variant="outline-info"
              onClick={() => {
                stageExecutiveDecisionBriefForAssistant();
                setExecutiveBriefPreviewOpen(false);
              }}
              data-testid="reports-executive-brief-preview-stage-assistant"
            >
              Stage to assistant
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                exportExecutiveDecisionBrief();
                setExecutiveBriefPreviewOpen(false);
              }}
              data-testid="reports-executive-brief-preview-export"
            >
              Export brief
            </Button>
          </Modal.Footer>
        </Modal>

        <Row className="g-2 mb-3">
          <Col md={12}>
            <Card className="ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <div>
                    <div className="small text-muted">Predictive risk analytics</div>
                    <div className="fw-semibold">Demand/Supply forecast signal</div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Select
                      size="sm"
                      value={predictiveHorizonHours}
                      onChange={(event) => setPredictiveHorizonHours(Number(event.target.value) as 24 | 48 | 72)}
                      style={{ maxWidth: 170 }}
                    >
                      <option value={24}>24-hour horizon</option>
                      <option value={48}>48-hour horizon</option>
                      <option value={72}>72-hour horizon</option>
                    </Form.Select>
                    <IconActionButton
                      iconClassName="bi bi-arrow-clockwise"
                      tooltip="Refresh predictive risk analytics signal"
                      ariaLabel="Refresh predictive risk analytics signal"
                      onClick={() => setPredictiveRefreshNonce((current) => current + 1)}
                      variant="outline-secondary"
                      disabled={predictiveDemandSupplyLoading || !predictiveCandidateIncidentId}
                    />
                  </div>
                </div>

                {predictiveDemandSupplyLoading && (
                  <div className="small text-muted">Loading predictive demand/supply risk signal…</div>
                )}

                {!predictiveDemandSupplyLoading && predictiveDemandSupplyError && (
                  <div className="small text-muted">{predictiveDemandSupplyError}</div>
                )}

                {!predictiveDemandSupplyLoading && !predictiveDemandSupplyError && predictiveDemandSupplyInsight && (
                  <>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <Badge bg={predictiveDemandSupplyInsight.riskLevel === 'High' ? 'danger' : predictiveDemandSupplyInsight.riskLevel === 'Moderate' ? 'secondary' : 'success'}>
                        Risk {predictiveDemandSupplyInsight.riskLevel}
                      </Badge>
                      <Badge bg="secondary">Demand pressure {predictiveDemandSupplyInsight.demandPressureIndex}</Badge>
                      <Badge bg="info" text="dark">Supply readiness {predictiveDemandSupplyInsight.supplyReadinessIndex}</Badge>
                      <Badge bg="secondary">Shortfall {predictiveDemandSupplyInsight.predictedShortfallQuantity.toFixed(1)}</Badge>
                    </div>
                    <div className="small text-muted">
                      Incident {predictiveDemandSupplyInsight.incidentNumber} · horizon {predictiveDemandSupplyInsight.horizonHours}h · model {predictiveDemandSupplyInsight.modelId} {predictiveDemandSupplyInsight.modelVersion}
                    </div>
                    <div className="small text-muted mt-1">
                      Top recommendation: {predictiveDemandSupplyInsight.recommendations[0] ?? 'Maintain current operational tempo and monitor demand/supply cadence.'}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-2 mb-3">
          <Col lg={3}>
            <Card className="border-0 bg-body-tertiary h-100" data-testid="reports-pending-approvals-trend-card">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">Pending approval decision trend</div>
                {pendingApprovalDecisionTrendRows.length === 0 ? (
                  <div className="small text-muted">No pending approval decisions captured for the selected report scope.</div>
                ) : (
                  <div style={{ width: '100%', height: 230 }} data-testid="reports-pending-approvals-trend-chart">
                    <ResponsiveContainer>
                      <LineChart data={pendingApprovalDecisionTrendRows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="approved" stroke={reportPalette.success} strokeWidth={2} name="Approved" />
                        <Line type="monotone" dataKey="deferred" stroke={reportPalette.warning} strokeWidth={2} name="Deferred" />
                        <Line type="monotone" dataKey="rejected" stroke={reportPalette.critical} strokeWidth={2} name="Rejected" />
                        <Line type="monotone" dataKey="total" stroke={reportPalette.series1} strokeWidth={2} name="Total decisions" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
          <Col lg={6}>
            <Card className="border-0 bg-body-tertiary" data-testid="reports-pending-approvals-card">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <span>Pending approvals with confidence recommendations</span>
                  <div className="d-inline-flex align-items-center gap-1">
                    <Form.Select
                      size="sm"
                      value={pendingApprovalConfidenceFloor}
                      onChange={(event) => setPendingApprovalConfidenceFloor(Number(event.target.value) as 55 | 70 | 85)}
                      data-testid="reports-pending-approvals-confidence-floor"
                    >
                      <option value={55}>Confidence floor 55%</option>
                      <option value={70}>Confidence floor 70%</option>
                      <option value={85}>Confidence floor 85%</option>
                    </Form.Select>
                    <Form.Select
                      size="sm"
                      value={pendingApprovalExportMode}
                      onChange={(event) => setPendingApprovalExportMode(event.target.value as 'decided' | 'recommended')}
                      data-testid="reports-pending-approvals-export-mode"
                    >
                      <option value="decided">Export decided only</option>
                      <option value="recommended">Export all recommendations</option>
                    </Form.Select>
                    <Form.Check
                      type="switch"
                      id="reports-pending-approvals-export-empty-rationale"
                      checked={pendingApprovalExportIncludeEmptyRationale}
                      onChange={(event) => setPendingApprovalExportIncludeEmptyRationale(event.target.checked)}
                      label="Include empty rationale"
                      data-testid="reports-pending-approvals-export-empty-rationale"
                    />
                    <IconActionButton
                      iconClassName="bi bi-download"
                      tooltip="Export pending approval executive summary (decision + rationale) as CSV."
                      ariaLabel="Export pending approval executive summary as CSV"
                      onClick={exportPendingApprovalExecutiveSummaryCsv}
                      disabled={pendingApprovalExecutiveSummaryExportLoading}
                      variant={pendingApprovalExecutiveSummaryExportLoading ? 'secondary' : 'outline-primary'}
                      testId="reports-pending-approvals-export-summary"
                    />
                  </div>
                </div>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2" data-testid="reports-pending-approvals-batch-toolbar">
                  <Badge bg="secondary">Selected: {selectedPendingApprovalSummary.total}</Badge>
                  <Badge bg="info" text="dark">Avg confidence: {selectedPendingApprovalSummary.averageConfidence}%</Badge>
                  <Badge bg="success">Approved: {selectedPendingApprovalSummary.approved}</Badge>
                  <Badge bg="primary">Deferred: {selectedPendingApprovalSummary.deferred}</Badge>
                  <Badge bg="danger">Rejected: {selectedPendingApprovalSummary.rejected}</Badge>
                  <Badge bg="light" text="dark">Pending: {selectedPendingApprovalSummary.pending}</Badge>
                  <div className="d-inline-flex flex-nowrap align-items-center gap-1 reports-pending-approvals-batch-actions" data-testid="reports-pending-approvals-batch-actions-row" role="toolbar" aria-label="Pending approvals batch action rail">
                    <IconActionButton
                      iconClassName="bi bi-check2-square"
                      tooltip="Select every pending approval row in the current report scope for batch action triage."
                      ariaLabel="Select all pending approval rows"
                      onClick={selectAllPendingApprovals}
                      variant="outline-secondary"
                      className="reports-batch-action-select"
                      testId="reports-pending-approvals-select-all"
                    />
                    <IconActionButton
                      iconClassName="bi bi-x-circle"
                      tooltip="Clear all selected rows from the pending approvals batch action set."
                      ariaLabel="Clear pending approval batch selection"
                      onClick={clearAllPendingApprovals}
                      variant="outline-secondary"
                      className="reports-batch-action-clear"
                      testId="reports-pending-approvals-clear-all"
                    />
                    <IconActionButton
                      iconClassName="bi bi-check2-circle"
                      tooltip="Batch approve all selected pending recommendations and persist operator rationale context."
                      ariaLabel="Batch approve selected pending recommendations"
                      onClick={() => { void applyBatchPendingApprovalDecision('Approved'); }}
                      variant="outline-success"
                      className="reports-batch-action-approve"
                      testId="reports-pending-approvals-batch-approve"
                    />
                    <IconActionButton
                      iconClassName="bi bi-clock-history"
                      tooltip="Batch defer all selected pending recommendations for follow-up review without immediate acceptance or rejection."
                      ariaLabel="Batch defer selected pending recommendations"
                      onClick={() => { void applyBatchPendingApprovalDecision('Deferred'); }}
                      variant="outline-primary"
                      className="reports-batch-action-defer"
                      testId="reports-pending-approvals-batch-defer"
                    />
                    <IconActionButton
                      iconClassName="bi bi-x-octagon"
                      tooltip="Batch reject all selected pending recommendations and route them to decision history for audit traceability."
                      ariaLabel="Batch reject selected pending recommendations"
                      onClick={() => { void applyBatchPendingApprovalDecision('Rejected'); }}
                      variant="outline-danger"
                      className="reports-batch-action-reject"
                      testId="reports-pending-approvals-batch-reject"
                    />
                  </div>
                </div>
                {pendingApprovalRows.length === 0 ? (
                  <div className="small text-muted">No approvals currently recommended for selected report scope.</div>
                ) : (
                  <div className="table-responsive" data-testid="reports-pending-approvals-table">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th className="text-center">Select</th>
                          <th>Incident</th>
                          <th>Recommendation</th>
                          <th className="text-end">Confidence</th>
                          <th className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingApprovalRows.map((row) => (
                          <tr key={`reports-pending-approval-${row.incidentId}`}>
                            <td className="text-center">
                              <Form.Check
                                type="checkbox"
                                checked={Boolean(pendingApprovalSelection[row.incidentId])}
                                onChange={(event) => togglePendingApprovalSelection(row.incidentId, event.target.checked)}
                                data-testid="reports-pending-approvals-row-select"
                              />
                            </td>
                            <td>
                              <div className="small fw-semibold">{row.incidentNumber}</div>
                              <div className="small text-muted">{row.incidentName}</div>
                            </td>
                            <td>
                              <Badge bg={row.recommendation.variant}>{row.recommendation.action}</Badge>
                            </td>
                            <td className="text-end">{Math.round(row.recommendation.confidence * 100)}%</td>
                            <td className="text-end">
                              <div className="d-inline-flex gap-1 align-items-center">
                                <IconActionButton
                                  iconClassName="bi bi-check2-circle"
                                  tooltip="Apply recommendation drill-through (group + severity focus)"
                                  ariaLabel="Apply recommendation drill-through"
                                  onClick={() => {
                                    setChartDrilldownGroup(row.groupCode);
                                    setChartDrilldownSeverity(row.severityCode === 'Unspecified' ? null : row.severityCode);
                                    onNotify?.(`Recommendation focus applied for ${row.incidentNumber}.`, 'info');
                                  }}
                                  variant="outline-secondary"
                                  testId="reports-pending-approvals-apply"
                                />
                                <IconActionButton
                                  iconClassName="bi bi-check2"
                                  tooltip="Mark recommendation as approved"
                                  ariaLabel="Mark recommendation as approved"
                                  onClick={() => { void setPendingApprovalDecision(row, 'Approved'); }}
                                  variant="outline-success"
                                  testId="reports-pending-approvals-approve"
                                />
                                <IconActionButton
                                  iconClassName="bi bi-clock-history"
                                  tooltip="Mark recommendation as deferred"
                                  ariaLabel="Mark recommendation as deferred"
                                  onClick={() => { void setPendingApprovalDecision(row, 'Deferred'); }}
                                  variant="outline-warning"
                                  testId="reports-pending-approvals-defer"
                                />
                                <IconActionButton
                                  iconClassName="bi bi-x-octagon"
                                  tooltip="Mark recommendation as rejected"
                                  ariaLabel="Mark recommendation as rejected"
                                  onClick={() => { void setPendingApprovalDecision(row, 'Rejected'); }}
                                  variant="outline-danger"
                                  testId="reports-pending-approvals-reject"
                                />
                                {pendingApprovalDecisions[row.incidentId] && (
                                  <Badge bg={pendingApprovalDecisions[row.incidentId].decision === 'Approved' ? 'success' : pendingApprovalDecisions[row.incidentId].decision === 'Rejected' ? 'danger' : 'warning'}>
                                    {pendingApprovalDecisions[row.incidentId].decision}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1">
                                <Form.Control
                                  size="sm"
                                  placeholder="Decision rationale (optional)"
                                  value={pendingApprovalRationales[row.incidentId] ?? ''}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setPendingApprovalRationales((current) => ({
                                      ...current,
                                      [row.incidentId]: nextValue,
                                    }));
                                  }}
                                  data-testid="reports-pending-approvals-rationale-input"
                                />
                              </div>
                              {pendingApprovalDecisions[row.incidentId]?.rationale && (
                                <div className="small text-muted mt-1" data-testid="reports-pending-approvals-rationale-text">
                                  Rationale: {pendingApprovalDecisions[row.incidentId].rationale}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3}>
            <Card className="border-0 bg-body-tertiary h-100" data-testid="reports-pending-approvals-history-card">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">Decision history replay</div>
                {pendingApprovalDecisionHistoryRows.length === 0 ? (
                  <div className="small text-muted">No pending-approval decision history captured for selected report scope.</div>
                ) : (
                  <div className="d-flex flex-column gap-2" data-testid="reports-pending-approvals-history-list">
                    {pendingApprovalDecisionHistoryRows.map((entry, index) => (
                      <div key={`reports-pending-approval-history-${entry.incidentId}-${entry.decidedAtUtc}-${index}`} className="border rounded px-2 py-1 bg-body">
                        <div className="small fw-semibold">{entry.incidentNumber}</div>
                        <div className="small text-muted text-truncate">{entry.incidentName || 'Incident context unavailable'}</div>
                        <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
                          <Badge bg={entry.decision === 'Approved' ? 'success' : entry.decision === 'Rejected' ? 'danger' : 'warning'}>{entry.decision}</Badge>
                          <span className="small text-muted">{entry.confidencePercent}%</span>
                        </div>
                        <div className="small text-muted mt-1">{new Date(entry.decidedAtUtc).toLocaleString()}</div>
                        {entry.rationale && (
                          <div className="small text-muted mt-1 text-start" data-testid="reports-pending-approvals-history-rationale">Rationale: {entry.rationale}</div>
                        )}
                        <div className="d-flex justify-content-end mt-1">
                          <IconActionButton
                            iconClassName="bi bi-filter-circle"
                            tooltip="Replay this decision context by applying incident recommendation drill-through."
                            ariaLabel="Replay decision context"
                            onClick={() => {
                              const matchingRow = pendingApprovalRows.find((row) => row.incidentId === entry.incidentId);
                              if (!matchingRow) {
                                onNotify?.('Replay context is outside the current report filter scope.', 'warning');
                                return;
                              }

                              setChartDrilldownGroup(matchingRow.groupCode);
                              setChartDrilldownSeverity(matchingRow.severityCode === 'Unspecified' ? null : matchingRow.severityCode);
                              onNotify?.(`Decision replay context applied for ${entry.incidentNumber}.`, 'info');
                            }}
                            variant="outline-secondary"
                            testId="reports-pending-approvals-history-replay"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card className="border-0 bg-body-tertiary mb-3">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-1">Executive KPI narrative</div>
            <div className="small text-muted">{executiveNarrative}</div>
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">Linked filter presets</div>
            <Row className="g-2 align-items-end mb-2">
              <Col md={8}>
                <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Preset name" info="Provide a name for the current linked report filter and drilldown context." /></Form.Label>
                <Form.Control
                  size="sm"
                  value={reportFilterPresetName}
                  placeholder="Save current linked filter and drill state"
                  onChange={(event) => setReportFilterPresetName(event.target.value)}
                />
              </Col>
              <Col md={4} className="d-flex justify-content-md-end gap-2">
                <IconActionButton
                  iconClassName="bi bi-save"
                  tooltip="Save current report linked filter preset"
                  ariaLabel="Save report filter preset"
                  onClick={() => {
                    void saveReportFilterPreset();
                  }}
                  disabled={reportFilterPresetName.trim().length === 0}
                  variant="outline-secondary"
                />
                <IconActionButton
                  iconClassName="bi bi-x-circle"
                  tooltip="Clear drill-through filters"
                  ariaLabel="Clear drill-through filters"
                  onClick={() => {
                    setChartDrilldownGroup(null);
                    setChartDrilldownSeverity(null);
                  }}
                  variant="outline-secondary"
                />
              </Col>
            </Row>
            {reportFilterPresets.length === 0 ? (
              <div className="small text-muted">No linked filter presets saved yet.</div>
            ) : (
              <div className="d-flex flex-wrap gap-2">
                {reportFilterPresets.map((preset) => (
                  <span key={preset.id} className="d-inline-flex align-items-center gap-1">
                    <Badge bg="secondary">{preset.name}</Badge>
                    <IconActionButton
                      iconClassName="bi bi-check2-circle"
                      tooltip="Apply linked filter preset"
                      ariaLabel="Apply linked filter preset"
                      onClick={() => applyReportFilterPreset(preset)}
                      variant="outline-secondary"
                      size="sm"
                    />
                    <IconActionButton
                      iconClassName="bi bi-trash"
                      tooltip="Delete linked filter preset"
                      ariaLabel="Delete linked filter preset"
                      onClick={() => {
                        void deleteReportFilterPreset(preset);
                      }}
                      variant="outline-secondary"
                      size="sm"
                    />
                  </span>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3" data-testid="reports-comparative-drillthrough-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>Comparative regional/facility lens</span>
              <span className="d-inline-flex align-items-center gap-2">
                <IconActionButton
                  iconClassName="bi bi-arrow-left-right"
                  tooltip="Swap left/right comparison sides"
                  ariaLabel="Swap comparison sides"
                  onClick={swapComparisonSides}
                  disabled={!comparisonLeftValue && !comparisonRightValue}
                  variant="outline-secondary"
                  testId="reports-comparison-swap"
                />
                <IconActionButton
                  iconClassName="bi bi-stars"
                  tooltip="Auto-pick top two groups by current report volume"
                  ariaLabel="Auto pick top two groups"
                  onClick={autoPickTopComparisonGroups}
                  disabled={comparisonOptions.length === 0}
                  variant="outline-secondary"
                  testId="reports-comparison-auto-top2"
                />
              </span>
            </div>
            <Row className="g-2 mb-2">
              <Col md={6}>
                <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Compare left" info="Select the left-side comparison cohort used for side-by-side executive posture analysis." /></Form.Label>
                <Form.Select
                  size="sm"
                  value={comparisonLeftValue}
                  onChange={(event) => setComparisonLeftGroup(event.target.value)}
                  disabled={comparisonOptions.length === 0}
                  data-testid="reports-comparison-left-select"
                >
                  {comparisonOptions.length === 0 && (
                    <option value="">No groups in scope</option>
                  )}
                  {comparisonOptions.map((option) => (
                    <option key={`reports-comparison-left-${option.value}`} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6}>
                <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Compare right" info="Select the right-side comparison cohort used for side-by-side executive posture analysis." /></Form.Label>
                <Form.Select
                  size="sm"
                  value={comparisonRightValue}
                  onChange={(event) => setComparisonRightGroup(event.target.value)}
                  disabled={comparisonOptions.length === 0}
                  data-testid="reports-comparison-right-select"
                >
                  {comparisonOptions.length === 0 && (
                    <option value="">No groups in scope</option>
                  )}
                  {comparisonOptions.map((option) => (
                    <option key={`reports-comparison-right-${option.value}`} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            <div className="small text-muted mb-2" data-testid="reports-comparison-narrative">{comparisonNarrative}</div>

            <div className="d-flex flex-wrap justify-content-end gap-2 mb-2">
              <IconActionButton
                iconClassName="bi bi-filter-circle"
                tooltip={`Apply drill-through for ${leftComparisonLabel}`}
                ariaLabel={`Apply drill-through for ${leftComparisonLabel}`}
                onClick={() => applyComparisonGroupDrilldown(comparisonLeftValue)}
                disabled={!comparisonLeftValue}
                variant="outline-secondary"
                testId="reports-comparison-apply-left"
              />
              <IconActionButton
                iconClassName="bi bi-exclamation-circle"
                tooltip={`Apply high-severity drill-through for ${leftComparisonLabel}`}
                ariaLabel={`Apply high-severity drill-through for ${leftComparisonLabel}`}
                onClick={() => applyComparisonRiskDrilldown(comparisonLeftValue)}
                disabled={!comparisonLeftValue}
                variant="outline-warning"
                testId="reports-comparison-apply-left-risk"
              />
              <IconActionButton
                iconClassName="bi bi-filter-circle"
                tooltip={`Apply drill-through for ${rightComparisonLabel}`}
                ariaLabel={`Apply drill-through for ${rightComparisonLabel}`}
                onClick={() => applyComparisonGroupDrilldown(comparisonRightValue)}
                disabled={!comparisonRightValue}
                variant="outline-secondary"
                testId="reports-comparison-apply-right"
              />
              <IconActionButton
                iconClassName="bi bi-exclamation-circle"
                tooltip={`Apply high-severity drill-through for ${rightComparisonLabel}`}
                ariaLabel={`Apply high-severity drill-through for ${rightComparisonLabel}`}
                onClick={() => applyComparisonRiskDrilldown(comparisonRightValue)}
                disabled={!comparisonRightValue}
                variant="outline-warning"
                testId="reports-comparison-apply-right-risk"
              />
            </div>

            {leftComparisonMetrics && rightComparisonMetrics && comparisonLeftValue && comparisonRightValue && (
              <div className="table-responsive" data-testid="reports-comparison-metrics-table">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th className="text-end">{leftComparisonLabel}</th>
                      <th className="text-end">{rightComparisonLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Total incidents</td>
                      <td className="text-end">{leftComparisonMetrics.total}</td>
                      <td className="text-end">{rightComparisonMetrics.total}</td>
                    </tr>
                    <tr>
                      <td>Critical/High concentration</td>
                      <td className="text-end">{leftComparisonMetrics.criticalOrHighPercent}%</td>
                      <td className="text-end">{rightComparisonMetrics.criticalOrHighPercent}%</td>
                    </tr>
                    <tr>
                      <td>Activated posture</td>
                      <td className="text-end">{leftComparisonMetrics.activatedPercent}%</td>
                      <td className="text-end">{rightComparisonMetrics.activatedPercent}%</td>
                    </tr>
                    <tr>
                      <td>Active status concentration</td>
                      <td className="text-end">{leftComparisonMetrics.activeStatusPercent}%</td>
                      <td className="text-end">{rightComparisonMetrics.activeStatusPercent}%</td>
                    </tr>
                    <tr>
                      <td>72h intake momentum</td>
                      <td className="text-end">{leftComparisonMetrics.recentCreatedPercent}%</td>
                      <td className="text-end">{rightComparisonMetrics.recentCreatedPercent}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex justify-content-between align-items-center">
              <span>External Provider Governance Dashboard</span>
              <IconActionButton
                iconClassName="bi bi-arrow-clockwise"
                tooltip="Refresh governance trends and federation diagnostics for current filters."
                ariaLabel="Refresh governance trends"
                onClick={() => {
                  void loadExternalProviderGovernanceDashboard();
                }}
                disabled={externalProviderDashboardLoading}
                variant={externalProviderDashboardLoading ? 'secondary' : 'outline-secondary'}
              />
            </div>

            <Row className="g-2 mb-2">
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Trend window" info="Choose the historical time range used for external provider governance trend analytics." /></Form.Label>
                  <Form.Select
                    size="sm"
                    value={externalProviderTrendWindowHours}
                    onChange={(event) => setExternalProviderTrendWindowHours(event.target.value as '24' | '168' | '720')}
                  >
                    <option value="24">24 hours</option>
                    <option value="168">7 days</option>
                    <option value="720">30 days</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={8}>
                <Form.Group>
                  <Form.Label className="small mb-1"><LabelWithInfo text="Provider filter (optional)" info="Optionally limit governance analytics to one provider identifier." /></Form.Label>
                  <Form.Control
                    size="sm"
                    value={externalProviderTrendProvider}
                    onChange={(event) => setExternalProviderTrendProvider(event.target.value)}
                    placeholder="e.g., OPEN_METEO"
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex flex-wrap justify-content-end gap-2 mb-2">
              <IconActionButton
                iconClassName="bi bi-file-earmark-spreadsheet"
                tooltip="Export governance analytics as CSV for audit and executive review."
                ariaLabel="Export governance CSV"
                onClick={() => {
                  void handleExportExternalProviderGovernanceCsv();
                }}
                disabled={externalProviderGovernanceExportLoading}
                variant={externalProviderGovernanceExportLoading ? 'secondary' : 'outline-primary'}
              />
              <IconActionButton
                iconClassName="bi bi-clipboard-data"
                tooltip="Export executive scorecard as CSV for reliability trend briefings."
                ariaLabel="Export scorecard CSV"
                onClick={() => {
                  void handleExportExternalProviderScorecardCsv();
                }}
                disabled={externalProviderScorecardExportLoading}
                variant={externalProviderScorecardExportLoading ? 'secondary' : 'outline-success'}
              />
              <IconActionButton
                iconClassName="bi bi-file-earmark-zip"
                tooltip="Package governance + scorecard artifacts into executive ZIP packet."
                ariaLabel="Export executive packet ZIP"
                onClick={() => {
                  void handleExportExternalProviderExecutivePacket();
                }}
                disabled={externalProviderExecutivePacketExportLoading}
                variant={externalProviderExecutivePacketExportLoading ? 'secondary' : 'outline-dark'}
              />
            </div>

            {externalProviderDashboardError ? (
              <div className="small text-danger">{externalProviderDashboardError}</div>
            ) : null}

            {externalProviderHealthTrends ? (
              <div className="small text-muted">
                <div className="analytics-shell mb-2">
                  <div className="small fw-semibold mb-2">Executive governance summary</div>
                  <div className="d-flex flex-wrap gap-2">
                    <Badge bg="secondary">Window {externalProviderHealthTrends.window.hours}h</Badge>
                    <Badge bg="secondary">Bucket {externalProviderHealthTrends.window.bucketMinutes}m</Badge>
                    <Badge bg="info">Events {externalProviderHealthTrends.totals.events}</Badge>
                    <Badge bg="success">Success {externalProviderHealthTrends.totals.success}</Badge>
                    <Badge bg={externalProviderHealthTrends.totals.failureRate >= 0.25 ? 'danger' : 'secondary'} className={externalProviderHealthTrends.totals.failureRate >= 0.10 && externalProviderHealthTrends.totals.failureRate < 0.25 ? 'ipoc-warning-badge' : undefined}>
                      Failure {(externalProviderHealthTrends.totals.failureRate * 100).toFixed(2)}%
                    </Badge>
                    <Badge bg="secondary">Bypass {externalProviderHealthTrends.totals.bypass}</Badge>
                    {externalProviderHealthFederationSummary ? (
                      <Badge bg="primary">Environments {externalProviderHealthFederationSummary.environmentCount}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-2">Checked: <strong>{new Date(externalProviderHealthTrends.checkedUtc).toLocaleString()}</strong></div>
                </div>

                <div className="fw-semibold mb-1">Provider performance</div>
                {externalProviderHealthTrends.providerSummary.length > 0 ? (
                  <div className="table-responsive" style={{ maxHeight: 180 }}>
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Provider</th>
                          <th className="text-end">Total</th>
                          <th className="text-end">Failure %</th>
                          <th className="text-end">Last Event</th>
                        </tr>
                      </thead>
                      <tbody>
                        {externalProviderHealthTrends.providerSummary.map((item) => (
                          <tr key={item.provider}>
                            <td><strong>{item.provider}</strong></td>
                            <td className="text-end">{item.total}</td>
                            <td className="text-end">{(item.failureRate * 100).toFixed(2)}%</td>
                            <td className="text-end">{new Date(item.lastEventUtc).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>No provider trend data in selected window.</div>
                )}

                <div className="fw-semibold mt-2 mb-1">Scorecard snapshot</div>
                {governanceScorecardRows.length > 0 ? (
                  <div className="table-responsive" style={{ maxHeight: 180 }}>
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Provider</th>
                          <th className="text-end">Reliability</th>
                          <th className="text-end">Failure %</th>
                          <th className="text-end">Tier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {governanceScorecardRows.map((item) => (
                          <tr key={`scorecard-${item.provider}`}>
                            <td><strong>{item.provider}</strong></td>
                            <td className="text-end">{item.reliabilityScore.toFixed(2)}%</td>
                            <td className="text-end">{item.failureRatePercent.toFixed(2)}%</td>
                            <td className="text-end">
                              <Badge
                                bg={item.tier === 'At-Risk' ? 'danger' : item.tier === 'Watch' ? 'secondary' : 'success'}
                                className={item.tier === 'Watch' ? 'ipoc-warning-badge' : undefined}
                              >
                                {item.tier}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>No provider scorecard snapshot data in selected window.</div>
                )}
              </div>
            ) : (
              <div className="small text-muted">No provider trend telemetry loaded yet.</div>
            )}

            {externalProviderHealthFederationSummary ? (
              <div className="small text-muted mt-2 pt-2 border-top">
                <div className="fw-semibold mb-1">Cross-environment federation summary</div>
                <div>
                  Window: <strong>{externalProviderHealthFederationSummary.windowHours}</strong>h · environments: <strong>{externalProviderHealthFederationSummary.environmentCount}</strong>
                </div>
                <div>Checked: <strong>{new Date(externalProviderHealthFederationSummary.checkedUtc).toLocaleString()}</strong></div>
                {externalProviderHealthFederationSummary.environments.length > 0 ? (
                  <div className="table-responsive mt-1" style={{ maxHeight: 180 }}>
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Environment</th>
                          <th className="text-end">Total</th>
                          <th className="text-end">Failure %</th>
                          <th className="text-end">Providers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {externalProviderHealthFederationSummary.environments.map((environment) => (
                          <tr key={environment.environment}>
                            <td><strong>{environment.environment}</strong></td>
                            <td className="text-end">{environment.totalCount}</td>
                            <td className="text-end">{(environment.failureRate * 100).toFixed(2)}%</td>
                            <td className="text-end">{environment.providerCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-1">No warehouse telemetry events in selected federation window.</div>
                )}
              </div>
            ) : null}
          </Card.Body>
        </Card>

        <Row className="g-2 mb-3">
          <Col lg={templatePaneOpen ? 8 : undefined} className={!templatePaneOpen ? 'pe-0' : 'pe-2'}>
            <Card className="border-0 bg-body-tertiary">
              <Card.Body className="py-2">
                <div className="small fw-semibold mb-2">Advanced analytics canvas</div>
                <div className="d-flex justify-content-end mb-2">
                  <Button
                    size="sm"
                    variant={designCanvasMode ? 'primary' : 'outline-secondary'}
                    onClick={() => setDesignCanvasMode((current) => !current)}
                    title={designCanvasMode ? 'Disable design canvas mode' : 'Enable design canvas mode'}
                  >
                    <i className="bi bi-grid-3x3-gap me-1" aria-hidden="true" />
                    {designCanvasMode ? 'Design mode on' : 'Design mode off'}
                  </Button>
                </div>
                <Row className="g-2 mb-3 mx-0 align-items-start">
                  {advancedWidgetIds.includes('kpi-governance-posture') && (
                    <Col
                      md={12}
                      draggable={designCanvasMode}
                      className="pb-1"
                      title={designCanvasMode ? 'Drag to reposition widget' : undefined}
                      style={getReportWidgetOrderStyle('kpi-governance-posture')}
                      onClick={() => {
                        if (designCanvasMode) {
                          setSelectedAdvancedWidgetId('kpi-governance-posture');
                        }
                      }}
                      onDragStart={(event: ReactDragEvent<HTMLDivElement>) => handleAdvancedWidgetDragStart('kpi-governance-posture', event)}
                      onDragEnd={handleAdvancedWidgetDragEnd}
                      onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                      }}
                      onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        const specJson = event.dataTransfer.getData('text/x-ipoc-reports-spec');
                        if (specJson) {
                          insertGeneratedReportSpecAtWidget(specJson, 'kpi-governance-posture');
                          return;
                        }

                        handleAdvancedWidgetDrop('kpi-governance-posture');
                      }}
                    >
                      {designCanvasMode && (
                        <div className="small text-muted d-flex align-items-center justify-content-between px-2 py-1 mb-2 rounded bg-body-tertiary" title="Drag handle">
                          <i className="bi bi-grip-vertical" aria-hidden="true" />
                          <Button
                            size="sm"
                            variant="outline-danger"
                            className="rounded-circle d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: 16, height: 16 }}
                            title="Remove widget from canvas"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAdvancedWidget('kpi-governance-posture');
                            }}
                          >
                            <i className="bi bi-x" aria-hidden="true" style={{ fontSize: '0.55rem', lineHeight: 1 }} />
                          </Button>
                        </div>
                      )}
                      <Card id="reports-widget-kpi-governance-posture" className="ipoc-mission-kpi-card h-100">
                        <Card.Body className="py-2">
                          <div className="small text-muted mb-2">Governance posture overview</div>
                          <div className="d-flex flex-wrap gap-2">
                            <Badge bg="secondary">Events {governancePosture.totalEvents}</Badge>
                            <Badge bg={governancePosture.failureRatePercent >= 25 ? 'danger' : governancePosture.failureRatePercent >= 10 ? 'secondary' : 'success'} className={governancePosture.failureRatePercent >= 10 && governancePosture.failureRatePercent < 25 ? 'ipoc-warning-badge' : undefined}>
                              Failure {governancePosture.failureRatePercent}%
                            </Badge>
                            <Badge bg="info" text="dark">Providers {governancePosture.providersObserved}</Badge>
                            <Badge bg="primary">Environments {governancePosture.federationEnvironments}</Badge>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  )}

                  {advancedWidgetIds.includes('line-volume') && (
                    <Col
                      md={12}
                      draggable={designCanvasMode}
                      className="pb-1"
                      title={designCanvasMode ? 'Drag to reposition widget' : undefined}
                      style={getReportWidgetOrderStyle('line-volume')}
                      onClick={() => {
                        if (designCanvasMode) {
                          setSelectedAdvancedWidgetId('line-volume');
                        }
                      }}
                      onDragStart={(event: ReactDragEvent<HTMLDivElement>) => handleAdvancedWidgetDragStart('line-volume', event)}
                      onDragEnd={handleAdvancedWidgetDragEnd}
                      onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                      }}
                      onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        const specJson = event.dataTransfer.getData('text/x-ipoc-reports-spec');
                        if (specJson) {
                          insertGeneratedReportSpecAtWidget(specJson, 'line-volume');
                          return;
                        }

                        handleAdvancedWidgetDrop('line-volume');
                      }}
                    >
                      {designCanvasMode && (
                        <div className="small text-muted d-flex align-items-center justify-content-between px-2 py-1 mb-2 rounded bg-body-tertiary" title="Drag handle">
                          <i className="bi bi-grip-vertical" aria-hidden="true" />
                          <Button
                            size="sm"
                            variant="outline-danger"
                            className="rounded-circle d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: 16, height: 16 }}
                            title="Remove widget from canvas"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAdvancedWidget('line-volume');
                            }}
                          >
                            <i className="bi bi-x" aria-hidden="true" style={{ fontSize: '0.55rem', lineHeight: 1 }} />
                          </Button>
                        </div>
                      )}
                      <Card id="reports-widget-line-volume" className="ipoc-mission-kpi-card h-100">
                        <Card.Body className="py-2">
                          <div className="small text-muted mb-2">Temporal incident volume line chart</div>
                          {trendLineRows.length > 0 ? (
                            <div style={{ width: '100%', height: 220 }}>
                              <ResponsiveContainer>
                                <LineChart data={trendLineRows}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="label" />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Legend />
                                  <Line type="monotone" dataKey="total" stroke={reportPalette.series1} strokeWidth={2} name="Total events" />
                                  <Line type="monotone" dataKey="successCount" stroke={reportPalette.success} strokeWidth={2} name="Success" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="small text-muted">No temporal trend data for current filters.</div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  )}

                  {advancedWidgetIds.includes('line-success-vs-failure') && (
                    <Col
                      md={12}
                      draggable={designCanvasMode}
                      className="pb-1"
                      title={designCanvasMode ? 'Drag to reposition widget' : undefined}
                      style={getReportWidgetOrderStyle('line-success-vs-failure')}
                      onClick={() => {
                        if (designCanvasMode) {
                          setSelectedAdvancedWidgetId('line-success-vs-failure');
                        }
                      }}
                      onDragStart={(event: ReactDragEvent<HTMLDivElement>) => handleAdvancedWidgetDragStart('line-success-vs-failure', event)}
                      onDragEnd={handleAdvancedWidgetDragEnd}
                      onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                      }}
                      onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        const specJson = event.dataTransfer.getData('text/x-ipoc-reports-spec');
                        if (specJson) {
                          insertGeneratedReportSpecAtWidget(specJson, 'line-success-vs-failure');
                          return;
                        }

                        handleAdvancedWidgetDrop('line-success-vs-failure');
                      }}
                    >
                      {designCanvasMode && (
                        <div className="small text-muted d-flex align-items-center justify-content-between px-2 py-1 mb-2 rounded bg-body-tertiary" title="Drag handle">
                          <i className="bi bi-grip-vertical" aria-hidden="true" />
                          <Button
                            size="sm"
                            variant="outline-danger"
                            className="rounded-circle d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: 16, height: 16 }}
                            title="Remove widget from canvas"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAdvancedWidget('line-success-vs-failure');
                            }}
                          >
                            <i className="bi bi-x" aria-hidden="true" style={{ fontSize: '0.55rem', lineHeight: 1 }} />
                          </Button>
                        </div>
                      )}
                      <Card id="reports-widget-line-success-vs-failure" className="ipoc-mission-kpi-card h-100">
                        <Card.Body className="py-2">
                          <div className="small text-muted mb-2">Success vs failure trend line chart</div>
                          {trendLineRows.length > 0 ? (
                            <div style={{ width: '100%', height: 220 }}>
                              <ResponsiveContainer>
                                <LineChart data={trendLineRows}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="label" />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Legend />
                                  <Line type="monotone" dataKey="successCount" stroke={reportPalette.success} strokeWidth={2} name="Success" />
                                  <Line type="monotone" dataKey="failureCount" stroke={reportPalette.critical} strokeWidth={2} name="Failure" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="small text-muted">No success/failure trend data for current filters.</div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  )}

                  {advancedWidgetIds.includes('area-failure-trend') && (
                    <Col
                      md={6}
                      draggable={designCanvasMode}
                      className="pb-1"
                      title={designCanvasMode ? 'Drag to reposition widget' : undefined}
                      style={getReportWidgetOrderStyle('area-failure-trend')}
                      onClick={() => {
                        if (designCanvasMode) {
                          setSelectedAdvancedWidgetId('area-failure-trend');
                        }
                      }}
                      onDragStart={(event: ReactDragEvent<HTMLDivElement>) => handleAdvancedWidgetDragStart('area-failure-trend', event)}
                      onDragEnd={handleAdvancedWidgetDragEnd}
                      onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                      }}
                      onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        const specJson = event.dataTransfer.getData('text/x-ipoc-reports-spec');
                        if (specJson) {
                          insertGeneratedReportSpecAtWidget(specJson, 'area-failure-trend');
                          return;
                        }

                        handleAdvancedWidgetDrop('area-failure-trend');
                      }}
                    >
                      {designCanvasMode && (
                        <div className="small text-muted d-flex align-items-center justify-content-between px-2 py-1 mb-2 rounded bg-body-tertiary" title="Drag handle">
                          <i className="bi bi-grip-vertical" aria-hidden="true" />
                          <Button
                            size="sm"
                            variant="outline-danger"
                            className="rounded-circle d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: 16, height: 16 }}
                            title="Remove widget from canvas"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAdvancedWidget('area-failure-trend');
                            }}
                          >
                            <i className="bi bi-x" aria-hidden="true" style={{ fontSize: '0.55rem', lineHeight: 1 }} />
                          </Button>
                        </div>
                      )}
                      <Card id="reports-widget-area-failure-trend" className="ipoc-mission-kpi-card h-100">
                        <Card.Body className="py-2">
                          <div className="small text-muted mb-2">Failure-rate area trend</div>
                          {trendLineRows.length > 0 ? (
                            <div style={{ width: '100%', height: 220 }}>
                              <ResponsiveContainer>
                                <AreaChart data={trendLineRows}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="label" />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Area type="monotone" dataKey="failureRatePercent" stroke={reportPalette.warning} fill={reportPalette.warning} fillOpacity={0.3} name="Failure %" />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="small text-muted">No failure trend data for current filters.</div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  )}

                  {advancedWidgetIds.includes('scatter-provider-risk') && (
                    <Col
                      md={6}
                      draggable={designCanvasMode}
                      className="pb-1"
                      title={designCanvasMode ? 'Drag to reposition widget' : undefined}
                      style={getReportWidgetOrderStyle('scatter-provider-risk')}
                      onClick={() => {
                        if (designCanvasMode) {
                          setSelectedAdvancedWidgetId('scatter-provider-risk');
                        }
                      }}
                      onDragStart={(event: ReactDragEvent<HTMLDivElement>) => handleAdvancedWidgetDragStart('scatter-provider-risk', event)}
                      onDragEnd={handleAdvancedWidgetDragEnd}
                      onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                      }}
                      onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        const specJson = event.dataTransfer.getData('text/x-ipoc-reports-spec');
                        if (specJson) {
                          insertGeneratedReportSpecAtWidget(specJson, 'scatter-provider-risk');
                          return;
                        }

                        handleAdvancedWidgetDrop('scatter-provider-risk');
                      }}
                    >
                      {designCanvasMode && (
                        <div className="small text-muted d-flex align-items-center justify-content-between px-2 py-1 mb-2 rounded bg-body-tertiary" title="Drag handle">
                          <i className="bi bi-grip-vertical" aria-hidden="true" />
                          <Button
                            size="sm"
                            variant="outline-danger"
                            className="rounded-circle d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: 16, height: 16 }}
                            title="Remove widget from canvas"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAdvancedWidget('scatter-provider-risk');
                            }}
                          >
                            <i className="bi bi-x" aria-hidden="true" style={{ fontSize: '0.55rem', lineHeight: 1 }} />
                          </Button>
                        </div>
                      )}
                      <Card id="reports-widget-scatter-provider-risk" className="ipoc-mission-kpi-card h-100">
                        <Card.Body className="py-2">
                          <div className="small text-muted mb-2">Provider risk scatter plot</div>
                          {providerScatterRows.length > 0 ? (
                            <div style={{ width: '100%', height: 220 }}>
                              <ResponsiveContainer>
                                <ScatterChart>
                                  <CartesianGrid />
                                  <XAxis type="number" dataKey="totalEvents" name="Total events" />
                                  <YAxis type="number" dataKey="failureRatePercent" name="Failure %" />
                                  <ZAxis type="number" range={[60, 160]} />
                                  <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    formatter={(value, name) => [String(value ?? ''), String(name ?? '')]}
                                  />
                                  <Scatter data={providerScatterRows} fill={reportPalette.series1} name="Provider risk" />
                                </ScatterChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="small text-muted">No provider risk scatter data for current filters.</div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  )}

                  {advancedWidgetIds.includes('bar-provider-failure-rate') && (
                    <Col
                      md={12}
                      draggable={designCanvasMode}
                      className="pb-1"
                      title={designCanvasMode ? 'Drag to reposition widget' : undefined}
                      style={getReportWidgetOrderStyle('bar-provider-failure-rate')}
                      onClick={() => {
                        if (designCanvasMode) {
                          setSelectedAdvancedWidgetId('bar-provider-failure-rate');
                        }
                      }}
                      onDragStart={(event: ReactDragEvent<HTMLDivElement>) => handleAdvancedWidgetDragStart('bar-provider-failure-rate', event)}
                      onDragEnd={handleAdvancedWidgetDragEnd}
                      onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                      }}
                      onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        const specJson = event.dataTransfer.getData('text/x-ipoc-reports-spec');
                        if (specJson) {
                          insertGeneratedReportSpecAtWidget(specJson, 'bar-provider-failure-rate');
                          return;
                        }

                        handleAdvancedWidgetDrop('bar-provider-failure-rate');
                      }}
                    >
                      {designCanvasMode && (
                        <div className="small text-muted d-flex align-items-center justify-content-between px-2 py-1 mb-2 rounded bg-body-tertiary" title="Drag handle">
                          <i className="bi bi-grip-vertical" aria-hidden="true" />
                          <Button
                            size="sm"
                            variant="outline-danger"
                            className="rounded-circle d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: 16, height: 16 }}
                            title="Remove widget from canvas"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAdvancedWidget('bar-provider-failure-rate');
                            }}
                          >
                            <i className="bi bi-x" aria-hidden="true" style={{ fontSize: '0.55rem', lineHeight: 1 }} />
                          </Button>
                        </div>
                      )}
                      <Card id="reports-widget-bar-provider-failure-rate" className="ipoc-mission-kpi-card h-100">
                        <Card.Body className="py-2">
                          <div className="small text-muted mb-2">Provider failure-rate bar ranking</div>
                          {providerFailureRankRows.length > 0 ? (
                            <div style={{ width: '100%', height: 240 }}>
                              <ResponsiveContainer>
                                <BarChart data={providerFailureRankRows} layout="vertical" margin={{ left: 24, right: 8, top: 8, bottom: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" />
                                  <YAxis dataKey="provider" type="category" width={140} />
                                  <Tooltip />
                                  <Bar dataKey="failureRatePercent" name="Failure %" fill={reportPalette.warning} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="small text-muted">No provider ranking data for current filters.</div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  )}
                </Row>
              </Card.Body>
            </Card>
          </Col>

            <Col
              lg={templatePaneOpen ? 4 : undefined}
              className={templatePaneOpen ? 'ps-2' : 'col-auto ipoc-nav-collapsed-col ms-auto ps-0 pe-0'}
            >
              <Card className={`border-0 bg-body-tertiary h-100 ipoc-analytics-pane-card nav-pane-card ${templatePaneOpen ? 'nav-pane-expanded' : 'nav-pane-collapsed'}`}>
                <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
                  <div className="nav-pane-header-block">
                    <span className={templatePaneOpen ? 'nav-pane-title' : 'visually-hidden'}>Reports</span>
                  </div>
                  <IconActionButton
                    iconClassName={`bi ${templatePaneOpen ? 'bi-chevron-right' : 'bi-chevron-left'}`}
                    tooltip={templatePaneOpen ? 'Collapse report template rail' : 'Expand report template rail'}
                    ariaLabel={templatePaneOpen ? 'Collapse report template rail' : 'Expand report template rail'}
                    onClick={() => setTemplatePaneOpen((current) => !current)}
                    ariaExpanded={templatePaneOpen}
                  />
                </Card.Header>
                <Card.Body className={`py-2 nav-pane-body ${templatePaneOpen ? 'expanded' : 'collapsed'}`}>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply executive report template" onClick={() => applyReportTemplate('executive')}>
                    <i className="bi bi-stars" aria-hidden="true" />
                    <span>Executive template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply risk report template" onClick={() => applyReportTemplate('risk')}>
                    <i className="bi bi-exclamation-triangle" aria-hidden="true" />
                    <span>Risk template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply volume report template" onClick={() => applyReportTemplate('volume')}>
                    <i className="bi bi-graph-up" aria-hidden="true" />
                    <span>Volume template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply governance report template" onClick={() => applyAdvancedInsightTemplate('governance')}>
                    <i className="bi bi-journal-check" aria-hidden="true" />
                    <span>Governance template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply surveillance report template" onClick={() => applyAdvancedInsightTemplate('surveillance')}>
                    <i className="bi bi-radar" aria-hidden="true" />
                    <span>Surveillance template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply capacity report template" onClick={() => applyAdvancedInsightTemplate('capacity')}>
                    <i className="bi bi-speedometer2" aria-hidden="true" />
                    <span>Capacity template</span>
                  </Button>

                  {templatePaneOpen && (
                    <>
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <div className="small fw-semibold">Visualization palette</div>
                        <IconActionButton
                          iconClassName={`bi ${palettePaneOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`}
                          tooltip={palettePaneOpen ? 'Collapse visualization palette' : 'Expand visualization palette'}
                          ariaLabel={palettePaneOpen ? 'Collapse visualization palette' : 'Expand visualization palette'}
                          onClick={() => setPalettePaneOpen((current) => !current)}
                          variant="outline-secondary"
                          size="sm"
                          ariaExpanded={palettePaneOpen}
                        />
                      </div>
                      {palettePaneOpen && (
                        <>
                          <Row className="g-1 mb-2">
                            <Col xs={6}>
                              <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Primary" info="Set primary chart color used across report visualizations." /></Form.Label>
                              <Form.Control type="color" size="sm" value={reportPalette.series1} onChange={(event) => setReportPalette((current) => ({ ...current, series1: event.target.value }))} />
                            </Col>
                            <Col xs={6}>
                              <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Secondary" info="Set secondary chart color used across report visualizations." /></Form.Label>
                              <Form.Control type="color" size="sm" value={reportPalette.series2} onChange={(event) => setReportPalette((current) => ({ ...current, series2: event.target.value }))} />
                            </Col>
                            <Col xs={6}>
                              <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Critical" info="Set color used to represent critical-risk or highest-severity values." /></Form.Label>
                              <Form.Control type="color" size="sm" value={reportPalette.critical} onChange={(event) => setReportPalette((current) => ({ ...current, critical: event.target.value }))} />
                            </Col>
                            <Col xs={6}>
                              <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Warning" info="Set color used for warning-level or elevated-risk values." /></Form.Label>
                              <Form.Control type="color" size="sm" value={reportPalette.warning} onChange={(event) => setReportPalette((current) => ({ ...current, warning: event.target.value }))} />
                            </Col>
                            <Col xs={6}>
                              <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Success" info="Set color used for positive or successful report status indicators." /></Form.Label>
                              <Form.Control type="color" size="sm" value={reportPalette.success} onChange={(event) => setReportPalette((current) => ({ ...current, success: event.target.value }))} />
                            </Col>
                            <Col xs={6}>
                              <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Neutral" info="Set neutral color used for baseline context and low-priority series." /></Form.Label>
                              <Form.Control type="color" size="sm" value={reportPalette.neutral} onChange={(event) => setReportPalette((current) => ({ ...current, neutral: event.target.value }))} />
                            </Col>
                          </Row>
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <IconActionButton
                              iconClassName="bi bi-cloud-arrow-up"
                              tooltip="Save visualization palette to your profile for this workspace."
                              ariaLabel="Save visualization palette"
                              onClick={() => { void saveReportPalette(); }}
                              variant="outline-primary"
                              size="sm"
                            />
                            <IconActionButton
                              iconClassName="bi bi-arrow-counterclockwise"
                              tooltip="Reset visualization palette to default pastel colors."
                              ariaLabel="Reset visualization palette to pastel defaults"
                              onClick={() => setReportPalette(REPORT_DEFAULT_PALETTE)}
                              variant="outline-secondary"
                              size="sm"
                            />
                            <Badge
                              bg={reportPaletteServerPresetId ? 'primary' : 'secondary'}
                              title={reportPaletteServerPresetId ? 'Palette persisted to backend profile store.' : 'Palette is only local until saved successfully to backend.'}
                            >
                              {reportPaletteServerPresetId ? 'server sync' : 'local only'}
                            </Badge>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {templatePaneOpen && (
                    <>

                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <div className="small fw-semibold">Canvas order</div>
                    <IconActionButton
                      iconClassName={`bi ${canvasPaneOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`}
                      tooltip={canvasPaneOpen ? 'Collapse canvas order' : 'Expand canvas order'}
                      ariaLabel={canvasPaneOpen ? 'Collapse canvas order' : 'Expand canvas order'}
                      onClick={() => setCanvasPaneOpen((current) => !current)}
                      variant="outline-secondary"
                      size="sm"
                      ariaExpanded={canvasPaneOpen}
                    />
                  </div>
                  {canvasPaneOpen && (
                    <div className="d-flex flex-column gap-1 mb-2">
                      {advancedWidgetIds.map((widgetId, index) => (
                        <div key={`report-widget-order-${widgetId}`} className="d-flex align-items-center justify-content-between small border rounded px-2 py-1 bg-body">
                          <span className="text-truncate pe-2">{reportWidgetLabelMap[widgetId] ?? widgetId}</span>
                          <span className="d-inline-flex align-items-center gap-1">
                            <Button size="sm" variant="light" title="Move widget earlier" onClick={() => moveAdvancedWidget(widgetId, 'up')} disabled={index === 0}><i className="bi bi-caret-up-fill" aria-hidden="true" /></Button>
                            <Button size="sm" variant="light" title="Move widget later" onClick={() => moveAdvancedWidget(widgetId, 'down')} disabled={index === advancedWidgetIds.length - 1}><i className="bi bi-caret-down-fill" aria-hidden="true" /></Button>
                            <Button size="sm" variant="outline-danger" title="Remove widget from canvas" onClick={() => removeAdvancedWidget(widgetId)}><i className="bi bi-x-lg" aria-hidden="true" /></Button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Favorite template name" info="Name this report-canvas layout so operators can save and quickly reapply it during recurring briefings." /></Form.Label>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <Form.Control
                      size="sm"
                      placeholder="e.g., Governance briefing"
                      value={reportTemplatePresetName}
                      onChange={(event) => setReportTemplatePresetName(event.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="light"
                      className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`}
                      title="Save current report canvas as a favorite template"
                      onClick={() => {
                        void saveReportTemplatePreset();
                      }}
                      disabled={reportTemplatePresetName.trim().length === 0 || reportPresetNameConflict}
                    >
                      <i className="bi bi-bookmark-plus" aria-hidden="true" />
                      <span>Save favorite</span>
                    </Button>
                  </div>
                  {reportPresetNameConflict && (
                    <div className="small text-ipoc-warning mb-2">A favorite with this name already exists.</div>
                  )}

                  {reportTemplatePresets.length > 0 && (
                    <div className="d-flex flex-column gap-1 mb-2">
                      {reportTemplatePresets.map((preset) => (
                        <div key={preset.id} className="d-flex align-items-center justify-content-between small border rounded px-2 py-1 bg-body">
                          {editingReportPresetId === preset.id ? (
                            <>
                              <Form.Control
                                size="sm"
                                className="me-2"
                                value={editingReportPresetName}
                                onChange={(event) => setEditingReportPresetName(event.target.value)}
                              />
                              <span className="d-inline-flex align-items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline-success"
                                  title="Save template rename"
                                  onClick={() => {
                                    void commitRenameReportTemplatePreset(preset);
                                  }}
                                  disabled={editingReportPresetName.trim().length === 0 || reportTemplatePresets.some((item) => item.id !== preset.id && item.name.trim().toLowerCase() === editingReportPresetName.trim().toLowerCase())}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  title="Cancel template rename"
                                  onClick={() => {
                                    setEditingReportPresetId(null);
                                    setEditingReportPresetName('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-truncate pe-2 d-flex flex-column">
                                <span>{preset.name}</span>
                                <span className="d-inline-flex align-items-center gap-1 mt-1">
                                  <Badge bg={(preset.source ?? (preset.userReportPresetId ? 'server' : 'local')) === 'server' ? 'primary' : 'secondary'}>
                                    {(preset.source ?? (preset.userReportPresetId ? 'server' : 'local')) === 'server' ? 'server' : 'local'}
                                  </Badge>
                                  {preset.updatedUtc && (
                                    <Badge bg="light" text="dark">
                                      {new Date(preset.updatedUtc).toLocaleString()}
                                    </Badge>
                                  )}
                                </span>
                              </span>
                              <span className="d-inline-flex align-items-center gap-1">
                                <IconActionButton
                                  iconClassName="bi bi-check2-circle"
                                  tooltip="Apply this favorite report template to load its widget composition and layout onto the canvas."
                                  ariaLabel={`Apply favorite report template ${preset.name}`}
                                  onClick={() => applyReportTemplatePreset(preset)}
                                  variant="outline-primary"
                                  testId="reports-template-preset-apply"
                                />
                                <IconActionButton
                                  iconClassName="bi bi-pencil-square"
                                  tooltip="Rename this favorite report template while retaining saved widget composition and source metadata."
                                  ariaLabel={`Rename favorite report template ${preset.name}`}
                                  onClick={() => startRenameReportTemplatePreset(preset)}
                                  variant="outline-secondary"
                                  testId="reports-template-preset-rename"
                                />
                                <IconActionButton
                                  iconClassName="bi bi-trash3"
                                  tooltip="Delete this favorite report template from local and synchronized preset storage."
                                  ariaLabel={`Delete favorite report template ${preset.name}`}
                                  onClick={() => {
                                    void deleteReportTemplatePreset(preset);
                                  }}
                                  variant="outline-danger"
                                  testId="reports-template-preset-delete"
                                />
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Agent visualization prompt" info="Describe the chart composition you want; the assistant generates a visualization spec for append or replace mode." /></Form.Label>
                  <Form.Control
                    size="sm"
                    placeholder="e.g., add scatter plot for provider risk"
                    value={reportPromptText}
                    onChange={(event) => setReportPromptText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void generateAdvancedReportWidgets();
                      }
                    }}
                  />
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <Form.Select
                      size="sm"
                      value={reportPromptApplyMode}
                      onChange={(event) => setReportPromptApplyMode(event.target.value as 'append' | 'replace')}
                    >
                      <option value="append">Append widgets</option>
                      <option value="replace">Replace canvas</option>
                    </Form.Select>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      title="Reset report canvas to default"
                      onClick={() => setAdvancedWidgetIds(['kpi-governance-posture', 'line-volume', 'area-failure-trend', 'scatter-provider-risk'])}
                    >
                      Reset
                    </Button>
                  </div>
                  {reportPromptPreview && (
                    <div className="small text-muted mt-2">Prompt plan: {reportPromptPreview}</div>
                  )}
                  {reportGeneratedSpecs.length > 0 && (
                    <div className="d-flex flex-column gap-1 mt-2">
                      <div className="small text-muted">Generated specs: {reportGeneratedSpecs.length}</div>
                      {reportGeneratedSpecs.slice(0, 3).map((spec) => (
                        <div
                          key={`report-generated-spec-${spec.id}`}
                          className="border rounded px-2 py-1 bg-body"
                          draggable={designCanvasMode}
                          title={designCanvasMode ? 'Drag this generated spec into the canvas to insert at a position' : undefined}
                          onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
                            if (!designCanvasMode) {
                              return;
                            }

                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/x-ipoc-reports-spec', spec.specJson);
                          }}
                        >
                          <Button
                            size="sm"
                            variant="light"
                            className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`}
                            title="Apply generated report visualization spec"
                            onClick={() => applyGeneratedReportSpec(spec.specJson)}
                          >
                            <i className="bi bi-diagram-3" aria-hidden="true" />
                            <span>{spec.name}</span>
                          </Button>
                          <div className="d-inline-flex align-items-center gap-1 mt-1">
                            <Badge bg={(spec.source ?? 'local') === 'server' ? 'primary' : 'secondary'}>
                              {(spec.source ?? 'local') === 'server' ? 'server' : 'local'}
                            </Badge>
                            <Badge bg="light" text="dark">{spec.createdBy ?? 'Agent prompt'}</Badge>
                            {spec.updatedUtc && (
                              <Badge bg="light" text="dark">{new Date(spec.updatedUtc).toLocaleString()}</Badge>
                            )}
                          </div>
                          {describeGeneratedReportSpec(spec.specJson) && (
                            <div className="small text-muted mt-1">{describeGeneratedReportSpec(spec.specJson)}</div>
                          )}
                          <div className="d-flex justify-content-end mt-1">
                            <Button
                              size="sm"
                              variant="outline-danger"
                              title="Delete generated report visualization spec"
                              onClick={() => {
                                void deleteGeneratedReportSpec(spec);
                              }}
                            >
                              <i className="bi bi-trash" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="d-flex justify-content-end mt-2">
                    <IconActionButton
                      iconClassName="bi bi-magic"
                      tooltip="Generate report visualizations from prompt keywords and add to analytics canvas."
                      ariaLabel="Generate report visualizations from prompt"
                      onClick={generateAdvancedReportWidgets}
                    />
                  </div>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
        </Row>

        <Card className="border-0 bg-body-tertiary mb-3">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">Report distribution profile (native analytics)</div>
            {groupedChartData.length === 0 ? (
              <div className="small text-muted">No grouped report data to visualize.</div>
            ) : (
              <div style={{ width: '100%', height: 210 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={groupedChartData}
                    onClick={(state) => {
                      const selectedGroup = (state as { activePayload?: Array<{ payload?: { rawGroup?: string } }> } | undefined)?.activePayload?.[0]?.payload?.rawGroup;
                      if (!selectedGroup) {
                        return;
                      }

                      setChartDrilldownGroup(selectedGroup);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Incident count" fill={reportPalette.series1} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">Severity distribution profile</div>
            {severityChartData.length === 0 ? (
              <div className="small text-muted">No severity data available for selected filters.</div>
            ) : (
              <div className="small">
                {severityChartData.map((entry, index) => {
                  const widthPercent = severityDistributionTotal > 0
                    ? Math.round((entry.value / severityDistributionTotal) * 100)
                    : 0;

                  return (
                    <div
                      key={entry.name}
                      className="mb-2"
                      role="button"
                      onClick={() => setChartDrilldownSeverity(entry.name)}
                    >
                      <div className="d-flex justify-content-between small text-muted">
                        <span>{entry.name}</span>
                        <strong>{entry.value}</strong>
                      </div>
                      <div className="analytics-track">
                        <div className={`analytics-bar analytics-bar-${index % 4}`} style={{ width: `${widthPercent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3">
          <Card.Body className="py-2" data-testid="reports-executive-decision-queue-card">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between gap-2 flex-wrap">
              <span>Executive decision queue</span>
              <Button
                size="sm"
                variant="outline-primary"
                onClick={stageTopDecisionQueueForPendingApproval}
                data-testid="reports-decision-queue-stage-top3"
              >
                Stage top 3 to pending triage
              </Button>
            </div>
            {decisionQueueRows.length === 0 ? (
              <div className="small text-muted">No incidents in scope for executive queue prioritization.</div>
            ) : (
              <div className="table-responsive" data-testid="reports-executive-decision-queue-table">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Incident</th>
                      <th>Group</th>
                      <th className="text-end">Severity</th>
                      <th className="text-end">Status</th>
                      <th className="text-end">Risk score</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisionQueueRows.map((row) => (
                      <tr key={`reports-decision-queue-${row.incidentId}`}>
                        <td>
                          <div className="small fw-semibold">{row.incidentNumber}</div>
                          <div className="small text-muted">{row.incidentName}</div>
                        </td>
                        <td>{row.groupLabel}</td>
                        <td className="text-end">{row.severityCode}</td>
                        <td className="text-end">{row.incidentStatusCode}</td>
                        <td className="text-end fw-semibold">{row.riskScore}</td>
                        <td className="text-end">
                          <div className="d-inline-flex gap-1">
                            <IconActionButton
                              iconClassName="bi bi-list-check"
                              tooltip="Stage this incident into pending approvals triage controls"
                              ariaLabel="Stage incident into pending approvals triage"
                              onClick={() => stageDecisionQueueRowForPendingApproval(row)}
                              variant="outline-primary"
                              testId="reports-decision-queue-stage-pending"
                            />
                            <IconActionButton
                              iconClassName="bi bi-shuffle"
                              tooltip="Send context and navigate to Incident workspace"
                              ariaLabel="Send context and navigate to Incident workspace"
                              onClick={() => publishDecisionQueueHandoffAndNavigate('incidents', row)}
                              variant="outline-secondary"
                              testId="reports-decision-queue-handoff-incidents"
                            />
                            <IconActionButton
                              iconClassName="bi bi-diagram-3"
                              tooltip="Send context and navigate to Operations workspace"
                              ariaLabel="Send context and navigate to Operations workspace"
                              onClick={() => publishDecisionQueueHandoffAndNavigate('operations', row)}
                              variant="outline-secondary"
                              testId="reports-decision-queue-handoff-operations"
                            />
                            <IconActionButton
                              iconClassName="bi bi-calendar2-week"
                              tooltip="Send context and navigate to Planning workspace"
                              ariaLabel="Send context and navigate to Planning workspace"
                              onClick={() => publishDecisionQueueHandoffAndNavigate('planning', row)}
                              variant="outline-secondary"
                              testId="reports-decision-queue-handoff-planning"
                            />
                            <IconActionButton
                              iconClassName="bi bi-journal-check"
                              tooltip="Send context and navigate to After Action workspace"
                              ariaLabel="Send context and navigate to After Action workspace"
                              onClick={() => publishDecisionQueueHandoffAndNavigate('after-action', row)}
                              variant="outline-secondary"
                              testId="reports-decision-queue-handoff-after-action"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3" data-testid="reports-risk-timeline-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between gap-2 flex-wrap">
              <span>Risk-change timeline</span>
              <IconActionButton
                iconClassName="bi bi-clock-history"
                tooltip="Export risk-change timeline replay CSV for after-action evidence workflows"
                ariaLabel="Export risk-change timeline replay CSV"
                onClick={exportRiskTimelineReplayCsv}
                variant="outline-secondary"
                testId="reports-risk-timeline-export"
              />
            </div>
            {riskTimelineRows.length === 0 ? (
              <div className="small text-muted">No timeline risk data for selected filters and date window.</div>
            ) : (
              <div style={{ width: '100%', height: 230 }} data-testid="reports-risk-timeline-chart">
                <ResponsiveContainer>
                  <LineChart data={riskTimelineRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="riskScore" stroke={reportPalette.critical} strokeWidth={2} name="Risk score" />
                    <Line type="monotone" dataKey="activeIncidents" stroke={reportPalette.series1} strokeWidth={2} name="Active incidents" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>Power BI Embedded Panel</span>
              <Badge bg={hasPowerBiEmbed ? 'success' : 'secondary'}>{hasPowerBiEmbed ? 'Configured' : 'Not configured'}</Badge>
            </div>
            <div className="small text-muted mb-2">
              {hasPowerBiEmbed
                ? 'Power BI is active for enterprise analytics. Native charting remains available above as a resilient fallback.'
                : 'Native Recharts analytics are active. Configure VITE_POWERBI_EMBED_URL to enable enterprise embedded reporting.'}
            </div>
            {hasPowerBiEmbed ? (
              <div className="ratio ratio-16x9 rounded border overflow-hidden">
                <iframe
                  title="Power BI Embedded Reporting"
                  src={powerBiEmbedUrl}
                  style={{ border: 0 }}
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="small text-muted">
                Power BI embed is optional. Set <code>VITE_POWERBI_EMBED_URL</code> in frontend environment configuration to enable this panel.
              </div>
            )}
          </Card.Body>
        </Card>

        {(chartDrilldownGroup || chartDrilldownSeverity) && (
          <div className="small text-muted d-flex align-items-center justify-content-between mb-2">
            <span>Reports drill-down active: {activeDrilldownLabel}</span>
            <IconActionButton
              iconClassName="bi bi-x-circle"
              tooltip="Clear active report drill-down filters and return to base cross-incident reporting context."
              ariaLabel="Clear report drill-down filters"
              onClick={() => {
                setChartDrilldownGroup(null);
                setChartDrilldownSeverity(null);
              }}
              variant="outline-secondary"
              testId="reports-clear-drilldown"
            />
          </div>
        )}

        <IpocDataGrid
          gridId="reporting-workspace-grouped"
          rowData={gridRows}
          columnDefs={gridColumnDefs}
          emptyMessage="No report data for selected filters and date window."
          pageSize={25}
        />
      </Card.Body>
    </Card>
  );
}

export default ReportingWorkspaceCard;
