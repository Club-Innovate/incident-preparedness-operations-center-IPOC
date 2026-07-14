import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent } from 'react';
import { Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { deleteUserReportPreset, getUserReportPresets, upsertUserReportPreset } from '../../api';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import { generateVisualizationSpec, parseVisualizationSpecJson } from './visualizationPrompt';

type DashboardSnapshotCardProps = {
  averageTempF: number;
  incidentCount: number;
  activeIncidentCount: number;
  selectedIncidentOpenTaskCount: number;
  selectedIncidentTimelineCount: number;
  readinessStatus: string;
  degradedModeEnabled: boolean;
  maturityLevel: 'Type5' | 'Type4' | 'Type3' | 'Type2' | 'Type1' | 'unknown';
  maturityScore: number | null;
  nimsComplianceLevel: 'compliant' | 'watch' | 'at-risk' | 'unknown';
  nimsComplianceScore: number | null;
  nimsComplianceGapCount: number;
  missionDependencyStatus: 'stable' | 'watch' | 'critical' | 'unknown';
  missionDependencyNodeCount: number | null;
  missionDependencyEdgeCount: number | null;
  missionDependencyBlockerCount: number;
  commandPostureRecommendations: string[];
  aarCandidateCount: number;
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

type DashboardTemplatePreset = {
  id: string;
  name: string;
  widgetIds: string[];
  userReportPresetId?: number;
  source?: 'local' | 'server';
  updatedUtc?: string;
};

const DASHBOARD_TEMPLATE_PRESET_SCOPE = 'dashboard-template-presets-v1';
const DASHBOARD_TEMPLATE_PRESET_LOCAL_KEY = 'ipoc.dashboard.templatePresets';
const DASHBOARD_GENERATED_SPECS_SCOPE = 'dashboard-generated-visualization-specs-v1';
const DASHBOARD_GENERATED_SPECS_LOCAL_KEY = 'ipoc.dashboard.generatedVisualizationSpecs';
const DASHBOARD_PALETTE_SCOPE = 'dashboard-visualization-palette-v1';
const DASHBOARD_PALETTE_LOCAL_KEY = 'ipoc.dashboard.visualizationPalette';
const DASHBOARD_PALETTE_PANE_OPEN_KEY = 'ipoc.dashboard.palettePaneExpanded';
const DASHBOARD_CANVAS_PANE_OPEN_KEY = 'ipoc.dashboard.canvasPaneExpanded';

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

const DASHBOARD_DEFAULT_PALETTE: VisualizationPalette = {
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

function DashboardSnapshotCard({
  averageTempF,
  incidentCount,
  activeIncidentCount,
  selectedIncidentOpenTaskCount,
  selectedIncidentTimelineCount,
  readinessStatus,
  degradedModeEnabled,
  maturityLevel,
  maturityScore,
  nimsComplianceLevel,
  nimsComplianceScore,
  nimsComplianceGapCount,
  missionDependencyStatus,
  missionDependencyNodeCount,
  missionDependencyEdgeCount,
  missionDependencyBlockerCount,
  commandPostureRecommendations,
  aarCandidateCount,
}: DashboardSnapshotCardProps) {
  const promptFocusTimerRef = useRef<number | null>(null);
  const DASHBOARD_WIDGETS_KEY = 'ipoc.dashboard.analytics.widgets';
  const DASHBOARD_DESIGN_MODE_KEY = 'ipoc.dashboard.designCanvasMode';
  const [templatePaneOpen, setTemplatePaneOpen] = useState<boolean>(() => {
    const persisted = localStorage.getItem('ipoc.dashboard.templatePaneExpanded');
    if (persisted === 'true') {
      return true;
    }
    if (persisted === 'false') {
      return false;
    }
    return true;
  });
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [designCanvasMode, setDesignCanvasMode] = useState<boolean>(() => {
    const persisted = localStorage.getItem(DASHBOARD_DESIGN_MODE_KEY);
    return persisted === 'true';
  });
  const [canvasPaneOpen, setCanvasPaneOpen] = useState<boolean>(() => {
    const persisted = localStorage.getItem(DASHBOARD_CANVAS_PANE_OPEN_KEY);
    if (persisted === 'true') {
      return true;
    }
    if (persisted === 'false') {
      return false;
    }
    return true;
  });
  const [palettePaneOpen, setPalettePaneOpen] = useState<boolean>(() => {
    const persisted = localStorage.getItem(DASHBOARD_PALETTE_PANE_OPEN_KEY);
    if (persisted === 'true') {
      return true;
    }
    if (persisted === 'false') {
      return false;
    }
    return true;
  });
  const [promptText, setPromptText] = useState('');
  const [promptApplyMode, setPromptApplyMode] = useState<'append' | 'replace'>('append');
  const [generatedPromptSpecs, setGeneratedPromptSpecs] = useState<GeneratedVisualizationSpecRecord[]>(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_GENERATED_SPECS_LOCAL_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as GeneratedVisualizationSpecRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [dashboardTemplatePresetName, setDashboardTemplatePresetName] = useState('');
  const [editingDashboardPresetId, setEditingDashboardPresetId] = useState<string | null>(null);
  const [editingDashboardPresetName, setEditingDashboardPresetName] = useState('');
  const [dashboardTemplatePresets, setDashboardTemplatePresets] = useState<DashboardTemplatePreset[]>(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_TEMPLATE_PRESET_LOCAL_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as DashboardTemplatePreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [widgetIds, setWidgetIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
      if (!stored) {
        return ['kpi-load', 'gauge-readiness', 'gauge-compliance', 'bar-posture'];
      }

      const parsed = JSON.parse(stored) as string[];
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : ['kpi-load', 'gauge-readiness', 'gauge-compliance', 'bar-posture'];
    } catch {
      return ['kpi-load', 'gauge-readiness', 'gauge-compliance', 'bar-posture'];
    }
  });
  const [dashboardPalette, setDashboardPalette] = useState<VisualizationPalette>(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_PALETTE_LOCAL_KEY);
      if (!stored) {
        return DASHBOARD_DEFAULT_PALETTE;
      }

      return normalizePalette(JSON.parse(stored), DASHBOARD_DEFAULT_PALETTE);
    } catch {
      return DASHBOARD_DEFAULT_PALETTE;
    }
  });
  const [dashboardPaletteServerPresetId, setDashboardPaletteServerPresetId] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(widgetIds));
  }, [widgetIds]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_DESIGN_MODE_KEY, designCanvasMode ? 'true' : 'false');
  }, [designCanvasMode]);

  useEffect(() => {
    if (!designCanvasMode) {
      setSelectedWidgetId(null);
      return;
    }

    if (selectedWidgetId && !widgetIds.includes(selectedWidgetId)) {
      setSelectedWidgetId(null);
    }
  }, [designCanvasMode, selectedWidgetId, widgetIds]);

  useEffect(() => {
    if (!designCanvasMode || !selectedWidgetId) {
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
      setWidgetIds((current) => current.filter((id) => id !== selectedWidgetId));
      setSelectedWidgetId(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [designCanvasMode, selectedWidgetId]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_TEMPLATE_PRESET_LOCAL_KEY, JSON.stringify(dashboardTemplatePresets));
  }, [dashboardTemplatePresets]);

  useEffect(() => {
    localStorage.setItem('ipoc.dashboard.templatePaneExpanded', templatePaneOpen ? 'true' : 'false');
  }, [templatePaneOpen]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_GENERATED_SPECS_LOCAL_KEY, JSON.stringify(generatedPromptSpecs));
  }, [generatedPromptSpecs]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(DASHBOARD_PALETTE_LOCAL_KEY, JSON.stringify(dashboardPalette));
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dashboardPalette]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_PALETTE_PANE_OPEN_KEY, palettePaneOpen ? 'true' : 'false');
  }, [palettePaneOpen]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_CANVAS_PANE_OPEN_KEY, canvasPaneOpen ? 'true' : 'false');
  }, [canvasPaneOpen]);

  useEffect(() => {
    const loadServerTemplatePresets = async () => {
      try {
        const serverPresets = await getUserReportPresets(DASHBOARD_TEMPLATE_PRESET_SCOPE);
        const mapped: DashboardTemplatePreset[] = [];

        serverPresets.forEach((preset) => {
          try {
            const parsed = JSON.parse(preset.presetJson) as Partial<DashboardTemplatePreset>;
            const presetWidgetIds = Array.isArray(parsed.widgetIds)
              ? parsed.widgetIds.filter((item): item is string => typeof item === 'string')
              : [];
            mapped.push({
              id: `server-${preset.userReportPresetId}`,
              name: preset.presetName,
              widgetIds: presetWidgetIds,
              userReportPresetId: preset.userReportPresetId,
              source: 'server',
              updatedUtc: preset.updatedUtc,
            });
          } catch {
            // Ignore malformed server preset payloads.
          }
        });

        if (mapped.length > 0) {
          setDashboardTemplatePresets(mapped);
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
        const serverPresets = await getUserReportPresets(DASHBOARD_GENERATED_SPECS_SCOPE);
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
          setGeneratedPromptSpecs((current) => {
            const existingIds = new Set(current.map((item) => item.id));
            const normalizedMapped = mapped
              .map((item) => {
                const normalized = parseVisualizationSpecJson(item.specJson, 'dashboard');
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
              const parsed = parseVisualizationSpecJson(item.specJson, 'dashboard');
              if (!parsed || item.source !== 'server' || !item.userReportPresetId) {
                return;
              }

              const parsedAsUnknown = JSON.parse(item.specJson) as Record<string, unknown>;
              const requiresMigration = !('schemaVersion' in parsedAsUnknown) || !('specVersion' in parsedAsUnknown);
              if (!requiresMigration) {
                return;
              }

              const presetName = item.name.trim().length > 0 ? item.name : `Prompt ${new Date(parsed.generatedUtc).toLocaleString()}`;
              void upsertUserReportPreset(DASHBOARD_GENERATED_SPECS_SCOPE, {
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
        const presets = await getUserReportPresets(DASHBOARD_PALETTE_SCOPE);
        if (presets.length === 0) {
          return;
        }

        const sorted = [...presets].sort((a, b) => Date.parse(b.updatedUtc) - Date.parse(a.updatedUtc));
        const latest = sorted[0];
        const parsed = JSON.parse(latest.presetJson);
        setDashboardPalette(normalizePalette(parsed, DASHBOARD_DEFAULT_PALETTE));
        setDashboardPaletteServerPresetId(latest.userReportPresetId);
      } catch {
        // Keep local palette when server persistence is unavailable.
      }
    };

    void loadServerPalette();
  }, []);

  const deleteGeneratedPromptSpec = async (record: GeneratedVisualizationSpecRecord) => {
    if (record.userReportPresetId) {
      try {
        await deleteUserReportPreset(DASHBOARD_GENERATED_SPECS_SCOPE, record.userReportPresetId);
      } catch {
        // Continue with local delete.
      }
    }

    setGeneratedPromptSpecs((current) => current.filter((item) => item.id !== record.id));
  };

  const applyGeneratedPromptSpec = (specJson: string) => {
    const parsed = parseVisualizationSpecJson(specJson, 'dashboard');
    if (!parsed) {
      return;
    }

    const normalizedWidgetIds = Array.from(new Set(parsed.widgetIds));
    setWidgetIds(normalizedWidgetIds);
    if (normalizedWidgetIds.length > 0) {
      if (promptFocusTimerRef.current !== null) {
        window.clearTimeout(promptFocusTimerRef.current);
      }

      promptFocusTimerRef.current = window.setTimeout(() => {
        const target = document.getElementById(`dashboard-widget-${normalizedWidgetIds[0]}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }
  };

  const readinessScore = useMemo(() => {
    const normalized = readinessStatus.trim().toLowerCase();
    if (normalized.includes('ready') || normalized.includes('healthy')) {
      return 92;
    }
    if (normalized.includes('warn') || normalized.includes('degraded')) {
      return 68;
    }
    if (normalized.includes('critical') || normalized.includes('down')) {
      return 34;
    }
    return 56;
  }, [readinessStatus]);

  const complianceScore = nimsComplianceScore ?? (nimsComplianceLevel === 'compliant' ? 90 : nimsComplianceLevel === 'watch' ? 70 : nimsComplianceLevel === 'at-risk' ? 40 : 55);
  const maturityGauge = maturityScore ?? (maturityLevel === 'Type1' ? 92 : maturityLevel === 'Type2' ? 84 : maturityLevel === 'Type3' ? 68 : maturityLevel === 'Type4' ? 48 : maturityLevel === 'Type5' ? 28 : 52);
  const postureBars = [
    { label: 'Task load', value: Math.min(100, Math.round((selectedIncidentOpenTaskCount / Math.max(1, incidentCount)) * 100)) },
    { label: 'Timeline activity', value: Math.min(100, Math.round((selectedIncidentTimelineCount / Math.max(1, incidentCount * 4)) * 100)) },
    { label: 'AAR pressure', value: Math.min(100, Math.round((aarCandidateCount / Math.max(1, incidentCount * 2)) * 100)) },
  ];

  const applyTemplate = (template: 'executive' | 'operations' | 'compliance') => {
    if (template === 'operations') {
      setWidgetIds(['kpi-load', 'bar-posture', 'gauge-readiness']);
      return;
    }

    if (template === 'compliance') {
      setWidgetIds(['gauge-compliance', 'gauge-maturity', 'bar-posture']);
      return;
    }

    setWidgetIds(['kpi-load', 'gauge-readiness', 'gauge-compliance', 'gauge-maturity', 'bar-posture']);
  };

  const applySmartTemplate = (template: 'briefing' | 'resilience' | 'recovery') => {
    if (template === 'briefing') {
      setWidgetIds(['kpi-load', 'gauge-readiness', 'gauge-compliance']);
      return;
    }

    if (template === 'resilience') {
      setWidgetIds(['gauge-maturity', 'gauge-compliance', 'bar-posture']);
      return;
    }

    setWidgetIds(['gauge-readiness', 'bar-posture', 'kpi-load']);
  };

  const moveWidget = (widgetId: string, direction: 'up' | 'down') => {
    setWidgetIds((current) => {
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

  const removeWidget = (widgetId: string) => {
    setWidgetIds((current) => current.filter((id) => id !== widgetId));
    setSelectedWidgetId((current) => (current === widgetId ? null : current));
  };

  const handleWidgetDragStart = (widgetId: string, event: ReactDragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/x-ipoc-dashboard-widget', widgetId);
    setDraggingWidgetId(widgetId);
    setSelectedWidgetId(widgetId);
  };

  const handleWidgetDragEnd = () => {
    setDraggingWidgetId(null);
  };

  const insertGeneratedSpecAtWidget = (specJson: string, targetWidgetId: string) => {
    const parsed = parseVisualizationSpecJson(specJson, 'dashboard');
    if (!parsed || parsed.widgetIds.length === 0) {
      return;
    }

    setWidgetIds((current) => {
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

  const handleWidgetDrop = (targetWidgetId: string) => {
    if (!designCanvasMode || !draggingWidgetId || draggingWidgetId === targetWidgetId) {
      return;
    }

    setWidgetIds((current) => {
      const sourceIndex = current.indexOf(draggingWidgetId);
      const targetIndex = current.indexOf(targetWidgetId);
      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDraggingWidgetId(null);
  };

  const widgetLabelMap: Record<string, string> = {
    'kpi-load': 'Operational load KPIs',
    'gauge-readiness': 'Readiness gauge',
    'gauge-compliance': 'NIMS compliance gauge',
    'gauge-maturity': 'Maturity gauge',
    'bar-posture': 'Posture bar plot',
  };

  const describeGeneratedDashboardSpec = (specJson: string): string | null => {
    const parsed = parseVisualizationSpecJson(specJson, 'dashboard');
    if (!parsed) {
      return null;
    }

    const widgetSet = new Set(parsed.widgetIds);
    const descriptorMap: Record<string, string> = {
      'kpi-load': 'Operational Load',
      'gauge-readiness': 'Readiness',
      'gauge-compliance': 'Compliance',
      'gauge-maturity': 'Maturity',
      'bar-posture': 'Resilience Posture',
    };

    const qualifierOrder = ['gauge-maturity', 'gauge-compliance', 'gauge-readiness', 'kpi-load'];
    const qualifiers = qualifierOrder
      .filter((widgetId) => widgetSet.has(widgetId))
      .map((widgetId) => descriptorMap[widgetId]);

    if (widgetSet.has('bar-posture')) {
      if (qualifiers.length === 0) {
        return 'Resilience Posture';
      }

      if (qualifiers.length === 1) {
        return `Resilience Posture with ${qualifiers[0]}`;
      }

      return `Resilience Posture with ${qualifiers.slice(0, -1).join(', ')} and ${qualifiers[qualifiers.length - 1]}`;
    }

    const ordered = parsed.widgetIds
      .map((widgetId) => descriptorMap[widgetId] ?? null)
      .filter((value): value is string => value !== null);

    if (ordered.length === 0) {
      return null;
    }

    if (ordered.length === 1) {
      return ordered[0];
    }

    return `${ordered.slice(0, -1).join(', ')} and ${ordered[ordered.length - 1]}`;
  };

  const dashboardPromptPreview = useMemo(() => {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) {
      return null;
    }

    const plannedSpec = generateVisualizationSpec('dashboard', trimmedPrompt);
    return plannedSpec.widgetIds.map((widgetId) => widgetLabelMap[widgetId] ?? widgetId).join(', ');
  }, [promptText]);

  const dashboardPaletteStyle = useMemo(() => ({
    '--ipoc-chart-series-1': dashboardPalette.series1,
    '--ipoc-chart-series-2': dashboardPalette.series2,
    '--ipoc-chart-series-3': dashboardPalette.series3,
    '--ipoc-chart-critical': dashboardPalette.critical,
    '--ipoc-chart-warning': dashboardPalette.warning,
    '--ipoc-chart-success': dashboardPalette.success,
    '--ipoc-chart-info': dashboardPalette.info,
    '--ipoc-chart-neutral': dashboardPalette.neutral,
  } as CSSProperties), [dashboardPalette]);

  const saveDashboardPalette = async () => {
    try {
      const userReportPresetId = await upsertUserReportPreset(DASHBOARD_PALETTE_SCOPE, {
        presetName: 'Dashboard Visual Palette',
        presetJson: JSON.stringify(dashboardPalette),
      });
      setDashboardPaletteServerPresetId(userReportPresetId);
    } catch {
      // Keep local palette when server persistence is unavailable.
    }
  };

  const generateFromPrompt = async () => {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) {
      return;
    }

    const spec = generateVisualizationSpec('dashboard', trimmedPrompt);
    const planned = spec.widgetIds;
    const focusWidgetId = promptApplyMode === 'replace'
      ? planned[0]
      : planned.find((widgetId) => !widgetIds.includes(widgetId)) ?? planned[0];

    if (promptApplyMode === 'replace') {
      setWidgetIds(planned);
    } else {
      setWidgetIds((current) => {
        const merged = [...current];
        planned.forEach((widgetId) => {
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
        const target = document.getElementById(`dashboard-widget-${focusWidgetId}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }

    const specName = `Prompt ${new Date(spec.generatedUtc).toLocaleString()}`;
    const specJson = JSON.stringify(spec);

    const localRecordId = `local-${Date.now()}`;
    const generatedUtc = new Date().toISOString();

    setGeneratedPromptSpecs((current) => {
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
      const userReportPresetId = await upsertUserReportPreset(DASHBOARD_GENERATED_SPECS_SCOPE, {
        presetName: specName,
        presetJson: specJson,
      });

      setGeneratedPromptSpecs((current) => current.map((item) => (
        item.id === localRecordId
          ? { ...item, id: `server-${userReportPresetId}` }
          : item
      )));
    } catch {
      // Keep local generated spec when server persistence is unavailable.
    }
  };

  const saveDashboardTemplatePreset = async () => {
    const normalizedName = dashboardTemplatePresetName.trim();
    if (!normalizedName) {
      return;
    }

    const duplicateExists = dashboardTemplatePresets.some((preset) => preset.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (duplicateExists) {
      return;
    }

    const localPreset: DashboardTemplatePreset = {
      id: `local-${Date.now()}`,
      name: normalizedName,
      widgetIds: [...widgetIds],
      source: 'local',
      updatedUtc: new Date().toISOString(),
    };

    const localNext = [localPreset, ...dashboardTemplatePresets].slice(0, 12);
    setDashboardTemplatePresets(localNext);

    try {
      const userReportPresetId = await upsertUserReportPreset(DASHBOARD_TEMPLATE_PRESET_SCOPE, {
        presetName: normalizedName,
        presetJson: JSON.stringify({ widgetIds }),
      });

      setDashboardTemplatePresets((current) => current.map((preset) => (
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

    setDashboardTemplatePresetName('');
  };

  const applyDashboardTemplatePreset = (preset: DashboardTemplatePreset) => {
    setWidgetIds(preset.widgetIds);
  };

  const deleteDashboardTemplatePreset = async (preset: DashboardTemplatePreset) => {
    if (preset.userReportPresetId) {
      try {
        await deleteUserReportPreset(DASHBOARD_TEMPLATE_PRESET_SCOPE, preset.userReportPresetId);
      } catch {
        // Continue with local delete.
      }
    }

    setDashboardTemplatePresets((current) => current.filter((item) => item.id !== preset.id));
  };

  const startRenameDashboardTemplatePreset = (preset: DashboardTemplatePreset) => {
    setEditingDashboardPresetId(preset.id);
    setEditingDashboardPresetName(preset.name);
  };

  const commitRenameDashboardTemplatePreset = async (preset: DashboardTemplatePreset) => {
    const normalizedName = editingDashboardPresetName.trim();
    if (!normalizedName) {
      return;
    }

    const duplicateExists = dashboardTemplatePresets.some((item) => item.id !== preset.id && item.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (duplicateExists) {
      return;
    }

    setDashboardTemplatePresets((current) => current.map((item) => (
      item.id === preset.id
        ? { ...item, name: normalizedName, updatedUtc: new Date().toISOString() }
        : item
    )));

    if (preset.userReportPresetId) {
      try {
        const userReportPresetId = await upsertUserReportPreset(DASHBOARD_TEMPLATE_PRESET_SCOPE, {
          presetName: normalizedName,
          presetJson: JSON.stringify({ widgetIds: preset.widgetIds }),
        });
        await deleteUserReportPreset(DASHBOARD_TEMPLATE_PRESET_SCOPE, preset.userReportPresetId);

        setDashboardTemplatePresets((current) => current.map((item) => (
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

    setEditingDashboardPresetId(null);
    setEditingDashboardPresetName('');
  };

  const dashboardPresetNameConflict = dashboardTemplatePresetName.trim().length > 0
    && dashboardTemplatePresets.some((preset) => preset.name.trim().toLowerCase() === dashboardTemplatePresetName.trim().toLowerCase());

  const renderWidget = (widgetId: string) => {
    const gaugeColor = (value: number) => {
      if (value >= 85) {
        return dashboardPalette.success;
      }
      if (value >= 60) {
        return dashboardPalette.warning;
      }
      return dashboardPalette.critical;
    };

    const postureColor = (value: number) => {
      if (value >= 85) {
        return dashboardPalette.critical;
      }
      if (value >= 60) {
        return dashboardPalette.warning;
      }
      return dashboardPalette.success;
    };

    if (widgetId === 'kpi-load') {
      return (
        <Card id={`dashboard-widget-${widgetId}`} key={widgetId} className="ipoc-mission-kpi-card h-100">
          <Card.Body className="py-2">
            <div className="small text-muted">Operational load KPIs</div>
            <div className="d-flex flex-wrap gap-2 mt-1">
              <Badge bg="secondary">Incidents {incidentCount}</Badge>
              <Badge bg="primary">Active {activeIncidentCount}</Badge>
              <Badge bg="danger">Open Tasks {selectedIncidentOpenTaskCount}</Badge>
              <Badge bg="info" text="dark">Timeline {selectedIncidentTimelineCount}</Badge>
            </div>
          </Card.Body>
        </Card>
      );
    }

    if (widgetId === 'gauge-readiness') {
      return (
        <Card id={`dashboard-widget-${widgetId}`} key={widgetId} className="ipoc-mission-kpi-card h-100">
          <Card.Body className="py-2">
            <div className="small text-muted d-flex justify-content-between"><span>Readiness gauge</span><strong>{readinessScore}%</strong></div>
            <div className="analytics-track">
              <div className="analytics-bar" style={{ width: `${readinessScore}%`, backgroundColor: gaugeColor(readinessScore) }} />
            </div>
          </Card.Body>
        </Card>
      );
    }

    if (widgetId === 'gauge-compliance') {
      return (
        <Card id={`dashboard-widget-${widgetId}`} key={widgetId} className="ipoc-mission-kpi-card h-100">
          <Card.Body className="py-2">
            <div className="small text-muted d-flex justify-content-between"><span>NIMS compliance gauge</span><strong>{complianceScore}%</strong></div>
            <div className="analytics-track">
              <div className="analytics-bar" style={{ width: `${complianceScore}%`, backgroundColor: gaugeColor(complianceScore) }} />
            </div>
          </Card.Body>
        </Card>
      );
    }

    if (widgetId === 'gauge-maturity') {
      return (
        <Card id={`dashboard-widget-${widgetId}`} key={widgetId} className="ipoc-mission-kpi-card h-100">
          <Card.Body className="py-2">
            <div className="small text-muted d-flex justify-content-between"><span>Maturity gauge</span><strong>{maturityGauge}%</strong></div>
            <div className="analytics-track">
              <div className="analytics-bar" style={{ width: `${maturityGauge}%`, backgroundColor: gaugeColor(maturityGauge) }} />
            </div>
          </Card.Body>
        </Card>
      );
    }

    if (widgetId === 'bar-posture') {
      return (
        <Card id={`dashboard-widget-${widgetId}`} key={widgetId} className="ipoc-mission-kpi-card h-100">
          <Card.Body className="py-2">
            <div className="small text-muted mb-1">Posture bar plot</div>
            {postureBars.map((bar) => (
              <div key={bar.label} className="mb-2">
                <div className="d-flex justify-content-between small text-muted"><span>{bar.label}</span><strong>{bar.value}%</strong></div>
                <div className="analytics-track">
                  <div className="analytics-bar" style={{ width: `${bar.value}%`, backgroundColor: postureColor(bar.value) }} />
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>
      );
    }

    return null;
  };

  return (
    <Card className="shadow-sm h-100" style={dashboardPaletteStyle}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="fw-semibold">Operational Snapshot</span>
          <Badge bg="secondary">{readinessStatus}</Badge>
        </div>

        <Row className="g-2">
          <Col lg={templatePaneOpen ? 8 : undefined} className={!templatePaneOpen ? 'pe-0' : 'pe-2'}>
            <div className="d-flex flex-wrap gap-2 mb-2">
              <Badge bg="secondary">Incidents: {incidentCount}</Badge>
              <Badge bg="primary">Active: {activeIncidentCount}</Badge>
              <Badge bg="danger">Open Tasks: {selectedIncidentOpenTaskCount}</Badge>
              <Badge bg="info" text="dark">Timeline Events: {selectedIncidentTimelineCount}</Badge>
              <Badge bg="secondary">Forecast Avg: {averageTempF}°F</Badge>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-2">
              <Badge bg={maturityLevel === 'Type1' ? 'success' : maturityLevel === 'Type2' ? 'info' : maturityLevel === 'Type3' ? 'secondary' : maturityLevel === 'Type4' ? 'warning' : maturityLevel === 'Type5' ? 'danger' : 'secondary'}>
                Maturity: {maturityLevel}{maturityScore !== null ? ` (${maturityScore})` : ''}
              </Badge>
              <Badge bg={nimsComplianceLevel === 'compliant' ? 'success' : nimsComplianceLevel === 'watch' ? 'warning' : nimsComplianceLevel === 'at-risk' ? 'danger' : 'secondary'}>
                NIMS: {nimsComplianceLevel.toUpperCase()}{nimsComplianceScore !== null ? ` (${nimsComplianceScore})` : ''}
              </Badge>
              <Badge bg={missionDependencyStatus === 'stable' ? 'success' : missionDependencyStatus === 'watch' ? 'warning' : missionDependencyStatus === 'critical' ? 'danger' : 'secondary'}>
                Dependency: {missionDependencyStatus.toUpperCase()}
                {missionDependencyNodeCount !== null && missionDependencyEdgeCount !== null
                  ? ` (${missionDependencyNodeCount}/${missionDependencyEdgeCount})`
                  : ''}
              </Badge>
              <Badge bg={aarCandidateCount > 0 ? 'warning' : 'secondary'}>
                AAR Candidates: {aarCandidateCount}
              </Badge>
            </div>

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
              {widgetIds.map((widgetId) => (
                <Col
                  key={widgetId}
                  md={6}
                  draggable={designCanvasMode}
                  className="pb-1"
                  style={{
                    cursor: designCanvasMode ? 'grab' : 'default',
                    opacity: draggingWidgetId === widgetId ? 0.7 : 1,
                    minWidth: 0,
                    outline: designCanvasMode && selectedWidgetId === widgetId ? '2px solid var(--bs-primary)' : undefined,
                    outlineOffset: designCanvasMode && selectedWidgetId === widgetId ? 1 : undefined,
                    borderRadius: designCanvasMode && selectedWidgetId === widgetId ? 6 : undefined,
                  }}
                  title={designCanvasMode ? 'Drag to reposition widget' : undefined}
                  onClick={() => {
                    if (designCanvasMode) {
                      setSelectedWidgetId(widgetId);
                    }
                  }}
                  onDragStart={(event: ReactDragEvent<HTMLDivElement>) => handleWidgetDragStart(widgetId, event)}
                  onDragEnd={handleWidgetDragEnd}
                  onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                    if (!designCanvasMode) {
                      return;
                    }
                    event.preventDefault();
                  }}
                  onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                    if (!designCanvasMode) {
                      return;
                    }
                    event.preventDefault();
                    const specJson = event.dataTransfer.getData('text/x-ipoc-dashboard-spec');
                    if (specJson) {
                      insertGeneratedSpecAtWidget(specJson, widgetId);
                      return;
                    }

                    handleWidgetDrop(widgetId);
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
                          removeWidget(widgetId);
                        }}
                      >
                        <i className="bi bi-x" aria-hidden="true" style={{ fontSize: '0.55rem', lineHeight: 1 }} />
                      </Button>
                    </div>
                  )}
                  {renderWidget(widgetId)}
                </Col>
              ))}
            </Row>

            <div className="mt-2">
              <div className="small text-muted mb-2">
                Risk gaps: NIMS {nimsComplianceGapCount} · Dependency blockers {missionDependencyBlockerCount}
              </div>

              {commandPostureRecommendations.length > 0 && (
                <div className="small mb-2">
                  <span className="fw-semibold">Executive posture:</span> {commandPostureRecommendations.slice(0, 2).join(' · ')}
                </div>
              )}

              <div className="text-muted small">
                {degradedModeEnabled ? 'Degraded data mode enabled' : 'Live operational data mode'}
              </div>
            </div>
          </Col>

          <Col
            lg={templatePaneOpen ? 4 : undefined}
            className={templatePaneOpen ? 'ps-2' : 'col-auto ipoc-nav-collapsed-col ms-auto ps-0 pe-0'}
          >
              <Card className={`border-0 bg-body-tertiary h-100 ipoc-analytics-pane-card nav-pane-card ${templatePaneOpen ? 'nav-pane-expanded' : 'nav-pane-collapsed'}`}>
                <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
                  <div className="nav-pane-header-block">
                    <span className={templatePaneOpen ? 'nav-pane-title' : 'visually-hidden'}>Dashboard</span>
                  </div>
                  <IconActionButton
                    iconClassName={`bi ${templatePaneOpen ? 'bi-chevron-right' : 'bi-chevron-left'}`}
                    tooltip={templatePaneOpen ? 'Collapse dashboard template rail' : 'Expand dashboard template rail'}
                    ariaLabel={templatePaneOpen ? 'Collapse dashboard template rail' : 'Expand dashboard template rail'}
                    onClick={() => setTemplatePaneOpen((current) => !current)}
                    ariaExpanded={templatePaneOpen}
                  />
                </Card.Header>
                <Card.Body className={`py-2 nav-pane-body ${templatePaneOpen ? 'expanded' : 'collapsed'}`}>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply executive template" onClick={() => applyTemplate('executive')}>
                    <i className="bi bi-stars" aria-hidden="true" />
                    <span>Executive template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply operations template" onClick={() => applyTemplate('operations')}>
                    <i className="bi bi-activity" aria-hidden="true" />
                    <span>Operations template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply compliance template" onClick={() => applyTemplate('compliance')}>
                    <i className="bi bi-shield-check" aria-hidden="true" />
                    <span>Compliance template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply briefing template" onClick={() => applySmartTemplate('briefing')}>
                    <i className="bi bi-easel2" aria-hidden="true" />
                    <span>Briefing template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply resilience template" onClick={() => applySmartTemplate('resilience')}>
                    <i className="bi bi-shield-fill-check" aria-hidden="true" />
                    <span>Resilience template</span>
                  </Button>
                  <Button variant="light" className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`} title="Apply recovery template" onClick={() => applySmartTemplate('recovery')}>
                    <i className="bi bi-arrow-repeat" aria-hidden="true" />
                    <span>Recovery template</span>
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
                          <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Primary" info="Set the primary visualization series color used across dashboard charts." /></Form.Label>
                          <Form.Control type="color" size="sm" value={dashboardPalette.series1} onChange={(event) => setDashboardPalette((current) => ({ ...current, series1: event.target.value }))} />
                        </Col>
                        <Col xs={6}>
                          <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Secondary" info="Set the secondary visualization series color used for comparative chart traces." /></Form.Label>
                          <Form.Control type="color" size="sm" value={dashboardPalette.series2} onChange={(event) => setDashboardPalette((current) => ({ ...current, series2: event.target.value }))} />
                        </Col>
                        <Col xs={6}>
                          <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Critical" info="Set color for highest-severity states and critical threshold indicators." /></Form.Label>
                          <Form.Control type="color" size="sm" value={dashboardPalette.critical} onChange={(event) => setDashboardPalette((current) => ({ ...current, critical: event.target.value }))} />
                        </Col>
                        <Col xs={6}>
                          <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Warning" info="Set color for warning-level conditions and elevated operational risk cues." /></Form.Label>
                          <Form.Control type="color" size="sm" value={dashboardPalette.warning} onChange={(event) => setDashboardPalette((current) => ({ ...current, warning: event.target.value }))} />
                        </Col>
                        <Col xs={6}>
                          <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Success" info="Set color for successful outcomes and healthy readiness posture indicators." /></Form.Label>
                          <Form.Control type="color" size="sm" value={dashboardPalette.success} onChange={(event) => setDashboardPalette((current) => ({ ...current, success: event.target.value }))} />
                        </Col>
                        <Col xs={6}>
                          <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Neutral" info="Set baseline neutral color for non-critical context and supporting chart elements." /></Form.Label>
                          <Form.Control type="color" size="sm" value={dashboardPalette.neutral} onChange={(event) => setDashboardPalette((current) => ({ ...current, neutral: event.target.value }))} />
                        </Col>
                      </Row>
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <IconActionButton
                          iconClassName="bi bi-cloud-arrow-up"
                          tooltip="Save visualization palette to your profile for this workspace."
                          ariaLabel="Save visualization palette"
                          onClick={() => { void saveDashboardPalette(); }}
                          variant="outline-primary"
                          size="sm"
                        />
                        <IconActionButton
                          iconClassName="bi bi-arrow-counterclockwise"
                          tooltip="Reset visualization palette to default pastel colors."
                          ariaLabel="Reset visualization palette to pastel defaults"
                          onClick={() => setDashboardPalette(DASHBOARD_DEFAULT_PALETTE)}
                          variant="outline-secondary"
                          size="sm"
                        />
                        <Badge
                          bg={dashboardPaletteServerPresetId ? 'primary' : 'secondary'}
                          title={dashboardPaletteServerPresetId ? 'Palette persisted to backend profile store.' : 'Palette is only local until saved successfully to backend.'}
                        >
                          {dashboardPaletteServerPresetId ? 'server sync' : 'local only'}
                        </Badge>
                      </div>
                    </>
                  )}

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
                      {widgetIds.map((widgetId, index) => (
                        <div key={`dashboard-widget-order-${widgetId}`} className="d-flex align-items-center justify-content-between small border rounded px-2 py-1 bg-body">
                          <span className="text-truncate pe-2">{widgetLabelMap[widgetId] ?? widgetId}</span>
                          <span className="d-inline-flex align-items-center gap-1">
                            <Button size="sm" variant="light" title="Move widget earlier" onClick={() => moveWidget(widgetId, 'up')} disabled={index === 0}><i className="bi bi-caret-up-fill" aria-hidden="true" /></Button>
                            <Button size="sm" variant="light" title="Move widget later" onClick={() => moveWidget(widgetId, 'down')} disabled={index === widgetIds.length - 1}><i className="bi bi-caret-down-fill" aria-hidden="true" /></Button>
                            <Button size="sm" variant="outline-danger" title="Remove widget from canvas" onClick={() => removeWidget(widgetId)}><i className="bi bi-x-lg" aria-hidden="true" /></Button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Favorite template name" info="Name this dashboard canvas layout so it can be saved, recalled, and reused by operators." /></Form.Label>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <Form.Control
                      size="sm"
                      placeholder="e.g., Executive readiness board"
                      value={dashboardTemplatePresetName}
                      onChange={(event) => setDashboardTemplatePresetName(event.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="light"
                      className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`}
                      title="Save current dashboard canvas as a favorite template"
                      onClick={() => {
                        void saveDashboardTemplatePreset();
                      }}
                      disabled={dashboardTemplatePresetName.trim().length === 0 || dashboardPresetNameConflict}
                    >
                      <i className="bi bi-bookmark-plus" aria-hidden="true" />
                      <span>Save favorite</span>
                    </Button>
                  </div>
                  {dashboardPresetNameConflict && (
                    <div className="small text-ipoc-warning mb-2">A favorite with this name already exists.</div>
                  )}

                  {dashboardTemplatePresets.length > 0 && (
                    <div className="d-flex flex-column gap-1 mb-2">
                      {dashboardTemplatePresets.map((preset) => (
                        <div key={preset.id} className="d-flex align-items-center justify-content-between small border rounded px-2 py-1 bg-body">
                          {editingDashboardPresetId === preset.id ? (
                            <>
                              <Form.Control
                                size="sm"
                                className="me-2"
                                value={editingDashboardPresetName}
                                onChange={(event) => setEditingDashboardPresetName(event.target.value)}
                              />
                              <span className="d-inline-flex align-items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline-success"
                                  title="Save template rename"
                                  onClick={() => {
                                    void commitRenameDashboardTemplatePreset(preset);
                                  }}
                                  disabled={editingDashboardPresetName.trim().length === 0 || dashboardTemplatePresets.some((item) => item.id !== preset.id && item.name.trim().toLowerCase() === editingDashboardPresetName.trim().toLowerCase())}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  title="Cancel template rename"
                                  onClick={() => {
                                    setEditingDashboardPresetId(null);
                                    setEditingDashboardPresetName('');
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
                                <Button size="sm" variant="outline-primary" title="Apply favorite dashboard template" onClick={() => applyDashboardTemplatePreset(preset)}>Apply</Button>
                                <Button size="sm" variant="outline-secondary" title="Rename favorite dashboard template" onClick={() => startRenameDashboardTemplatePreset(preset)}>Rename</Button>
                                <Button size="sm" variant="outline-danger" title="Delete favorite dashboard template" onClick={() => {
                                  void deleteDashboardTemplatePreset(preset);
                                }}>Delete</Button>
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Agent visualization prompt" info="Describe desired dashboard visuals; the assistant generates a visualization spec for append or replace mode." /></Form.Label>
                  <Form.Control
                    size="sm"
                    placeholder="e.g., add readiness gauge and posture bar plot"
                    value={promptText}
                    onChange={(event) => setPromptText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void generateFromPrompt();
                      }
                    }}
                  />
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <Form.Select
                      size="sm"
                      value={promptApplyMode}
                      onChange={(event) => setPromptApplyMode(event.target.value as 'append' | 'replace')}
                    >
                      <option value="append">Append widgets</option>
                      <option value="replace">Replace canvas</option>
                    </Form.Select>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      title="Reset dashboard canvas to default"
                      onClick={() => setWidgetIds(['kpi-load', 'gauge-readiness', 'gauge-compliance', 'bar-posture'])}
                    >
                      Reset
                    </Button>
                  </div>
                  {dashboardPromptPreview && (
                    <div className="small text-muted mt-2">Prompt plan: {dashboardPromptPreview}</div>
                  )}
                  {generatedPromptSpecs.length > 0 && (
                    <div className="d-flex flex-column gap-1 mt-2">
                      <div className="small text-muted">Generated specs: {generatedPromptSpecs.length}</div>
                      {generatedPromptSpecs.slice(0, 3).map((spec) => {
                        const createdDescription = describeGeneratedDashboardSpec(spec.specJson);

                        return (
                        <div
                          key={`dashboard-generated-spec-${spec.id}`}
                          className="border rounded px-2 py-1 bg-body"
                          draggable={designCanvasMode}
                          title={designCanvasMode ? 'Drag this generated spec into the canvas to insert at a position' : undefined}
                          onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
                            if (!designCanvasMode) {
                              return;
                            }

                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/x-ipoc-dashboard-spec', spec.specJson);
                          }}
                        >
                          <Button
                            size="sm"
                            variant="light"
                            className={`nav-pane-btn ${templatePaneOpen ? 'expanded' : 'collapsed'}`}
                            title="Apply generated dashboard visualization spec"
                            onClick={() => applyGeneratedPromptSpec(spec.specJson)}
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
                          {createdDescription && (
                            <div className="small text-muted mt-1">{createdDescription}</div>
                          )}
                          <div className="d-flex justify-content-end mt-1">
                            <Button
                              size="sm"
                              variant="outline-danger"
                              title="Delete generated dashboard visualization spec"
                              onClick={() => {
                                void deleteGeneratedPromptSpec(spec);
                              }}
                            >
                              <i className="bi bi-trash" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="d-flex justify-content-end mt-2">
                    <IconActionButton
                      iconClassName="bi bi-magic"
                      tooltip="Generate dashboard visualizations from prompt keywords and add to canvas."
                      ariaLabel="Generate dashboard visualizations from prompt"
                      onClick={generateFromPrompt}
                    />
                  </div>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

export default DashboardSnapshotCard;
