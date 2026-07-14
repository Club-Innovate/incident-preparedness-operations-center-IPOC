import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, Col, Form, ListGroup, ProgressBar, Row } from 'react-bootstrap';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import CopHandoffBanner from '../common/CopHandoffBanner';
import { getUserReportPresets, upsertUserReportPreset } from '../../api';
import type { CopCommandHandoffContext, IncidentSummary, WeatherOperationalSignal } from '../../types';
import type { NotifyHandler } from '../../notifications/types';
import { readCopCommandHandoffContext } from '../../utils/copHandoffContext';
import { resolvePlanningCadenceModeFromCopHandoff } from '../../utils/copHandoffMode';
import { clearCopHandoffBannerContext, dismissCopHandoffBanner } from '../../utils/copHandoffNotifications';
import ExecutionLaneBoard from './ExecutionLaneBoard';
import type { ExecutionDirective, ExecutionDirectiveStatus, ExecutionLaneSignalItem } from './ExecutionLaneBoard';
import {
  applyDirectivePatch,
  applyDirectivePatchBatch,
  countUnresolvedDependencies,
  resolveDependencyBlockers,
} from './executionDependencyUtils';

const NAV_PLANNING_AI_ENABLED = import.meta.env.VITE_IPOC_NAV_PLANNING_AI_ENABLED === 'true';

type PlanningCycleCardProps = {
  isAuthenticated: boolean;
  selectedIncidentLabel: string;
  incidents: IncidentSummary[];
  selectedIncidentId: number | null;
  onSelectIncident: (incidentId: number) => void;
  operationalPeriodCount: number;
  objectiveCount: number;
  sitrepCount: number;
  staleSitrepHours: number | null;
  latestTimelineUtc: string | null;
  weatherOperationalSignal: WeatherOperationalSignal;
  onNavigate?: (view: 'incidents' | 'cop' | 'after-action') => void;
  onNotify: NotifyHandler;
};

function PlanningCycleCard({
  isAuthenticated,
  selectedIncidentLabel,
  incidents,
  selectedIncidentId,
  onSelectIncident,
  operationalPeriodCount,
  objectiveCount,
  sitrepCount,
  staleSitrepHours,
  latestTimelineUtc,
  weatherOperationalSignal,
  onNavigate,
  onNotify,
}: PlanningCycleCardProps) {
  const NAV_PLANNING_SCOPE = 'navigation-planning';
  const NAV_PLANNING_PRESET = 'default';
  const [planningCadenceMode, setPlanningCadenceMode] = useState<'standard' | 'compressed' | 'stabilization'>('standard');
  const [planningBriefComplete, setPlanningBriefComplete] = useState(false);
  const [objectiveReviewComplete, setObjectiveReviewComplete] = useState(false);
  const [sitrepCadenceReviewComplete, setSitrepCadenceReviewComplete] = useState(false);
  const [executionDirectives, setExecutionDirectives] = useState<ExecutionDirective[]>([]);
  const [aiDraftSummary, setAiDraftSummary] = useState('');
  const [aiDraftGeneratedAt, setAiDraftGeneratedAt] = useState<string | null>(null);
  const [aiApprovalStatus, setAiApprovalStatus] = useState<'not-started' | 'pending-review' | 'approved' | 'rejected'>('not-started');
  const [aiApprovalActor, setAiApprovalActor] = useState('');
  const [aiApprovalAt, setAiApprovalAt] = useState<string | null>(null);
  const [copHandoffContext, setCopHandoffContext] = useState<CopCommandHandoffContext | null>(null);
  const [copHandoffDismissed, setCopHandoffDismissed] = useState(false);
  const [planningIncidentTypeahead, setPlanningIncidentTypeahead] = useState('');
  const [planningIncidentComboboxOpen, setPlanningIncidentComboboxOpen] = useState(false);
  const [planningIncidentActiveOptionIndex, setPlanningIncidentActiveOptionIndex] = useState(-1);
  const [showWeatherRiskDayDetails, setShowWeatherRiskDayDetails] = useState(false);
  const planningIncidentComboboxRef = useRef<HTMLDivElement | null>(null);
  const weatherRiskLevelFilter = weatherOperationalSignal.highRiskDayCount > 0 ? 'high' : 'moderate';
  const weatherRiskDays = weatherOperationalSignal.days.filter((item) => item.riskLevel === weatherRiskLevelFilter);

  const parseAiApprovalStatus = (value: unknown): 'not-started' | 'pending-review' | 'approved' | 'rejected' => {
    if (value === 'pending-review' || value === 'approved' || value === 'rejected') {
      return value;
    }

    return 'not-started';
  };

  const parseExecutionDirectives = (value: unknown): ExecutionDirective[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const statuses: ExecutionDirectiveStatus[] = ['planned', 'in-progress', 'blocked', 'completed'];

    return value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const candidate = item as Partial<ExecutionDirective>;
        if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
          return null;
        }

        const status = typeof candidate.status === 'string' && statuses.includes(candidate.status as ExecutionDirectiveStatus)
          ? candidate.status as ExecutionDirectiveStatus
          : 'planned';

        return {
          id: candidate.id,
          status,
          owner: typeof candidate.owner === 'string' ? candidate.owner : '',
          dueDate: typeof candidate.dueDate === 'string' ? candidate.dueDate : '',
          blockedByDirectiveId: typeof candidate.blockedByDirectiveId === 'string' ? candidate.blockedByDirectiveId : '',
        } satisfies ExecutionDirective;
      })
      .filter((item): item is ExecutionDirective => item !== null);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadServerState = async () => {
      try {
        const presets = await getUserReportPresets(NAV_PLANNING_SCOPE);
        const preset = presets.find((item) => item.presetName === NAV_PLANNING_PRESET) ?? presets[0] ?? null;
        if (!preset || !preset.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          planningBriefComplete?: boolean;
          objectiveReviewComplete?: boolean;
          sitrepCadenceReviewComplete?: boolean;
          executionDirectives?: unknown;
          aiDraftSummary?: string;
          aiDraftGeneratedAt?: string | null;
          aiApprovalStatus?: string;
          aiApprovalActor?: string;
          aiApprovalAt?: string | null;
        };

        setPlanningBriefComplete(Boolean(parsed.planningBriefComplete));
        setObjectiveReviewComplete(Boolean(parsed.objectiveReviewComplete));
        setSitrepCadenceReviewComplete(Boolean(parsed.sitrepCadenceReviewComplete));
        setExecutionDirectives(parseExecutionDirectives(parsed.executionDirectives));
        setAiDraftSummary(typeof parsed.aiDraftSummary === 'string' ? parsed.aiDraftSummary : '');
        setAiDraftGeneratedAt(typeof parsed.aiDraftGeneratedAt === 'string' ? parsed.aiDraftGeneratedAt : null);
        setAiApprovalStatus(parseAiApprovalStatus(parsed.aiApprovalStatus));
        setAiApprovalActor(typeof parsed.aiApprovalActor === 'string' ? parsed.aiApprovalActor : '');
        setAiApprovalAt(typeof parsed.aiApprovalAt === 'string' ? parsed.aiApprovalAt : null);
      } catch {
        // fallback remains local storage
      }
    };

    void loadServerState();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void upsertUserReportPreset(NAV_PLANNING_SCOPE, {
        presetName: NAV_PLANNING_PRESET,
        presetJson: JSON.stringify({
          planningBriefComplete,
          objectiveReviewComplete,
          sitrepCadenceReviewComplete,
          executionDirectives,
          aiDraftSummary,
          aiDraftGeneratedAt,
          aiApprovalStatus,
          aiApprovalActor,
          aiApprovalAt,
        }),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [NAV_PLANNING_PRESET, NAV_PLANNING_SCOPE, aiApprovalActor, aiApprovalAt, aiApprovalStatus, aiDraftGeneratedAt, aiDraftSummary, executionDirectives, isAuthenticated, objectiveReviewComplete, planningBriefComplete, sitrepCadenceReviewComplete]);

  useEffect(() => {
    const persisted = localStorage.getItem('ipoc.nav.planning.checkpoints');
    if (!persisted) {
      return;
    }

    try {
      const parsed = JSON.parse(persisted) as {
        planningBriefComplete?: boolean;
        objectiveReviewComplete?: boolean;
        sitrepCadenceReviewComplete?: boolean;
        executionDirectives?: unknown;
        aiDraftSummary?: string;
        aiDraftGeneratedAt?: string | null;
        aiApprovalStatus?: string;
        aiApprovalActor?: string;
        aiApprovalAt?: string | null;
      };

      setPlanningBriefComplete(Boolean(parsed.planningBriefComplete));
      setObjectiveReviewComplete(Boolean(parsed.objectiveReviewComplete));
      setSitrepCadenceReviewComplete(Boolean(parsed.sitrepCadenceReviewComplete));
      setExecutionDirectives(parseExecutionDirectives(parsed.executionDirectives));
      setAiDraftSummary(typeof parsed.aiDraftSummary === 'string' ? parsed.aiDraftSummary : '');
      setAiDraftGeneratedAt(typeof parsed.aiDraftGeneratedAt === 'string' ? parsed.aiDraftGeneratedAt : null);
      setAiApprovalStatus(parseAiApprovalStatus(parsed.aiApprovalStatus));
      setAiApprovalActor(typeof parsed.aiApprovalActor === 'string' ? parsed.aiApprovalActor : '');
      setAiApprovalAt(typeof parsed.aiApprovalAt === 'string' ? parsed.aiApprovalAt : null);
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ipoc.nav.planning.checkpoints', JSON.stringify({
      planningBriefComplete,
      objectiveReviewComplete,
      sitrepCadenceReviewComplete,
      executionDirectives,
      aiDraftSummary,
      aiDraftGeneratedAt,
      aiApprovalStatus,
      aiApprovalActor,
      aiApprovalAt,
    }));
  }, [aiApprovalActor, aiApprovalAt, aiApprovalStatus, aiDraftGeneratedAt, aiDraftSummary, executionDirectives, objectiveReviewComplete, planningBriefComplete, sitrepCadenceReviewComplete]);

  useEffect(() => {
    const parsed = readCopCommandHandoffContext('planning');
    if (!parsed) {
      return;
    }

    setCopHandoffContext(parsed);
    setCopHandoffDismissed(false);

    setPlanningCadenceMode(resolvePlanningCadenceModeFromCopHandoff(parsed));
    onNotify('Planning workspace primed from COP command handoff context.', 'info');
  }, [onNotify]);

  const sitrepCadenceVariant = staleSitrepHours === null
    ? 'secondary'
    : staleSitrepHours > 24
      ? 'danger'
      : staleSitrepHours > 12
        ? 'info'
        : 'success';

  const planningReadinessScore = Math.max(0, (operationalPeriodCount * 4) + objectiveCount + sitrepCount);
  const checklistCompletionCount = [planningBriefComplete, objectiveReviewComplete, sitrepCadenceReviewComplete].filter(Boolean).length;
  const checklistCompletionPercent = Math.round((checklistCompletionCount / 3) * 100);
  const objectiveDensity = operationalPeriodCount > 0 ? Math.round((objectiveCount / operationalPeriodCount) * 10) / 10 : 0;
  const sitrepFreshnessScore = staleSitrepHours === null ? 0 : Math.max(0, 100 - Math.min(100, staleSitrepHours * 3));

  const planningTrendData = useMemo(() => ([
    { phase: 'Periods', value: operationalPeriodCount },
    { phase: 'Objectives', value: objectiveCount },
    { phase: 'SITREPs', value: sitrepCount },
    { phase: 'Freshness', value: sitrepFreshnessScore },
  ]), [objectiveCount, operationalPeriodCount, sitrepCount, sitrepFreshnessScore]);

  const governanceGapActions = useMemo(() => {
    const items: string[] = [];

    if (operationalPeriodCount === 0) {
      items.push('No operational periods detected. Establish period cadence and gate approvals.');
    }

    if (objectiveCount === 0) {
      items.push('No objectives recorded. Publish measurable objectives before next period handoff.');
    }

    if (sitrepCount === 0) {
      items.push('No SITREP baseline available. Generate and publish initial SITREP package.');
    } else if (staleSitrepHours !== null && staleSitrepHours > 24) {
      items.push(`SITREP is stale (${staleSitrepHours}h). Refresh command narrative and current actions.`);
    }

    if (items.length === 0) {
      items.push('Planning governance baseline is stable. Continue cadence checkpoints and approval discipline.');
    }

    return items.slice(0, 3);
  }, [objectiveCount, operationalPeriodCount, sitrepCount, staleSitrepHours]);

  const cadenceGuidance = planningCadenceMode === 'compressed'
    ? 'Compressed cadence mode: tighten planning cycle checkpoints and increase SITREP publication frequency.'
    : planningCadenceMode === 'stabilization'
      ? 'Stabilization cadence mode: emphasize objective completion and timeline validation over new intake.'
      : 'Standard cadence mode: maintain balanced planning-cycle progression across periods and objectives.';

  const planningExecutionQueue = useMemo<ExecutionLaneSignalItem[]>(() => {
    const periodLifecycleStatus = operationalPeriodCount > 0
      ? 'in-progress'
      : 'at-risk';
    const formsLibraryStatus = objectiveCount > 0 || sitrepCount > 0
      ? 'in-progress'
      : 'planned';
    const pCycleStatus = checklistCompletionCount >= 2
      ? 'ready'
      : checklistCompletionCount === 1
        ? 'in-progress'
        : 'at-risk';
    const aiSummaryStatus = !NAV_PLANNING_AI_ENABLED
      ? 'backlog'
      : sitrepCount > 0
        ? 'planned'
        : 'backlog';

    return [
      {
        id: 'planning-period-gating',
        capability: 'Operational period lifecycle gating',
        rfpReference: 'F1 operational period plan/approve/close',
        signalStatus: periodLifecycleStatus,
        nextStep: periodLifecycleStatus === 'at-risk'
          ? 'No operational periods detected. Start period 1 and set approval gate timestamps.'
          : 'Continue gate checks for planning meeting, approval, and closure milestones.',
      },
      {
        id: 'planning-ics-library',
        capability: 'ICS forms and IAP package progression',
        rfpReference: 'F1 ICS-201..215 maturity',
        signalStatus: formsLibraryStatus,
        nextStep: formsLibraryStatus === 'planned'
          ? 'Promote ICS forms package from scaffold to active plan package workflow.'
          : 'Objective/SITREP baselines exist. Expand toward full IAP packet readiness.',
      },
      {
        id: 'planning-pcycle-dashboard',
        capability: 'Digital Planning P-cycle dashboard',
        rfpReference: 'Intake planning-cycle timeline/reminders',
        signalStatus: pCycleStatus,
        nextStep: pCycleStatus === 'ready'
          ? 'Checklist cadence is stable. Enable reminder windows for next operational period.'
          : 'Advance checklist controls to achieve full cycle readiness.',
      },
      {
        id: 'planning-ai-summary',
        capability: 'AI-assisted planning summary pilot',
        rfpReference: 'Phase D differentiation',
        signalStatus: aiSummaryStatus,
        nextStep: !NAV_PLANNING_AI_ENABLED
          ? 'AI planning summary feature flag is disabled in this environment.'
          : aiSummaryStatus === 'backlog'
          ? 'Capture SITREP baseline first, then generate AI summary draft with human approval.'
          : 'Build summary draft + approval trail for planning brief handoff.',
      },
    ];
  }, [checklistCompletionCount, objectiveCount, operationalPeriodCount, sitrepCount]);

  const isFocusedIncidentSelected = selectedIncidentLabel.trim().length > 0 && selectedIncidentLabel !== 'No incident selected';

  const planningIncidentOptions = useMemo(() => {
    const activeIncidents = incidents.filter((incident) => incident.incidentStatusCode !== 'Closed');
    return activeIncidents.length > 0 ? activeIncidents : incidents;
  }, [incidents]);

  const filteredPlanningIncidentOptions = useMemo(() => {
    const normalizedSearch = planningIncidentTypeahead.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
      return planningIncidentOptions;
    }

    return planningIncidentOptions.filter((incident) => (
      incident.incidentNumber.toLowerCase().includes(normalizedSearch)
      || incident.incidentName.toLowerCase().includes(normalizedSearch)
      || incident.incidentTypeCode.toLowerCase().includes(normalizedSearch)
    ));
  }, [planningIncidentOptions, planningIncidentTypeahead]);

  const planningIncidentTypeaheadSummary = useMemo(() => {
    const normalizedSearch = planningIncidentTypeahead.trim();
    if (normalizedSearch.length === 0) {
      return 'Type while focused to live-filter and jump to matching incidents.';
    }

    const matchLabel = filteredPlanningIncidentOptions.length === 1 ? 'match' : 'matches';
    return `Typeahead "${normalizedSearch}" · ${filteredPlanningIncidentOptions.length} ${matchLabel}`;
  }, [filteredPlanningIncidentOptions.length, planningIncidentTypeahead]);

  const planningIncidentSelectedLabel = useMemo(() => {
    if (!selectedIncidentId) {
      return '';
    }

    const selected = planningIncidentOptions.find((incident) => incident.incidentId === selectedIncidentId);
    return selected
      ? `${selected.incidentNumber} - ${selected.incidentName} (${selected.incidentStatusCode})`
      : '';
  }, [planningIncidentOptions, selectedIncidentId]);

  useEffect(() => {
    if (!planningIncidentComboboxOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!planningIncidentComboboxRef.current) {
        return;
      }

      if (!planningIncidentComboboxRef.current.contains(event.target as Node)) {
        setPlanningIncidentComboboxOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [planningIncidentComboboxOpen]);

  const applyPlanningIncidentTypeahead = (nextTypeahead: string) => {
    setPlanningIncidentTypeahead(nextTypeahead);
    setPlanningIncidentComboboxOpen(true);
    setPlanningIncidentActiveOptionIndex(0);

    const normalizedSearch = nextTypeahead.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
      return;
    }

    const matchedIncident = planningIncidentOptions.find((incident) => (
      incident.incidentNumber.toLowerCase().includes(normalizedSearch)
      || incident.incidentName.toLowerCase().includes(normalizedSearch)
      || incident.incidentTypeCode.toLowerCase().includes(normalizedSearch)
    ));

    if (matchedIncident && matchedIncident.incidentId !== selectedIncidentId) {
      onSelectIncident(matchedIncident.incidentId);
    }
  };

  const selectPlanningIncident = (incidentId: number) => {
    onSelectIncident(incidentId);
    setPlanningIncidentTypeahead('');
    setPlanningIncidentComboboxOpen(false);
    setPlanningIncidentActiveOptionIndex(-1);
  };

  const handleDirectiveChange = (id: string, patch: Partial<ExecutionDirective>) => {
    setExecutionDirectives((current) => applyDirectivePatch(current, id, patch));
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  const runPcycleKickoffPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'planning-period-gating', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'planning-ics-library', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'planning-period-gating' } },
      { id: 'planning-pcycle-dashboard', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'planning-period-gating' } },
      { id: 'planning-ai-summary', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'planning-ics-library' } },
    ]));
  };

  const runIapPackagePlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'planning-period-gating', patch: { status: 'completed', blockedByDirectiveId: '' } },
      { id: 'planning-ics-library', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'planning-pcycle-dashboard', patch: { status: 'in-progress', blockedByDirectiveId: 'planning-ics-library' } },
      { id: 'planning-ai-summary', patch: { status: 'planned', blockedByDirectiveId: 'planning-pcycle-dashboard' } },
    ]));
  };

  const runAiSummaryPrepPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'planning-pcycle-dashboard', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'planning-ai-summary', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'planning-pcycle-dashboard' } },
    ]));
  };

  const unresolvedDependencyCount = useMemo(() => countUnresolvedDependencies(executionDirectives), [executionDirectives]);

  const canRunPcycleKickoffPlaybook = planningBriefComplete;
  const canRunIapPackagePlaybook = objectiveReviewComplete;
  const canRunAiSummaryPrepPlaybook = sitrepCadenceReviewComplete && sitrepCount > 0;
  const aiDraftReadyForApproval = aiApprovalStatus === 'pending-review' && aiDraftSummary.trim().length > 0;

  const notifyPlaybookBlocked = (gate: string) => {
    onNotify(`Playbook blocked: ${gate}.`, 'warning');
  };

  const handlePcycleKickoffPlaybookClick = () => {
    if (!canRunPcycleKickoffPlaybook) {
      notifyPlaybookBlocked('complete planning brief checkpoint');
      return;
    }

    runPcycleKickoffPlaybook();
  };

  const handleIapPackagePlaybookClick = () => {
    if (!canRunIapPackagePlaybook) {
      notifyPlaybookBlocked('complete objective review checkpoint');
      return;
    }

    runIapPackagePlaybook();
  };

  const handleAiSummaryPrepPlaybookClick = () => {
    if (!NAV_PLANNING_AI_ENABLED) {
      notifyPlaybookBlocked('AI planning summary feature flag is disabled');
      return;
    }

    if (!canRunAiSummaryPrepPlaybook) {
      notifyPlaybookBlocked('validate SITREP cadence and capture SITREP baseline');
      return;
    }

    runAiSummaryPrepPlaybook();
  };

  const runResolveBlockersAssist = () => {
    setExecutionDirectives((current) => resolveDependencyBlockers(current));
  };

  const generateAiDraftSummary = () => {
    if (!NAV_PLANNING_AI_ENABLED) {
      notifyPlaybookBlocked('AI planning summary feature flag is disabled');
      return;
    }

    if (!canRunAiSummaryPrepPlaybook) {
      notifyPlaybookBlocked('validate SITREP cadence and capture SITREP baseline before AI draft generation');
      return;
    }

    const generatedAt = new Date().toISOString();
    const draft = [
      `Planning AI Draft (${generatedAt})`,
      `Focused incident: ${selectedIncidentLabel}`,
      `Operational periods: ${operationalPeriodCount}`,
      `Objectives: ${objectiveCount}`,
      `SITREPs: ${sitrepCount}`,
      `Checklist completion: ${checklistCompletionCount}/3`,
      `Recommended next step: advance IAP package progression and validate next operational period gates.`,
    ].join('\n');

    setAiDraftSummary(draft);
    setAiDraftGeneratedAt(generatedAt);
    setAiApprovalStatus('pending-review');
    setAiApprovalAt(null);
    onNotify('AI planning summary draft generated. Human approval is required before operational use.', 'info');
  };

  const approveAiDraftSummary = () => {
    if (!aiDraftReadyForApproval) {
      onNotify('AI draft approval blocked: generate a pending-review draft first.', 'warning');
      return;
    }

    const approvedAt = new Date().toISOString();
    const actor = aiApprovalActor.trim().length > 0 ? aiApprovalActor.trim() : 'Planning operator';
    setAiApprovalActor(actor);
    setAiApprovalStatus('approved');
    setAiApprovalAt(approvedAt);
    onNotify(`AI planning summary approved by ${actor}.`, 'success');
  };

  const rejectAiDraftSummary = () => {
    if (!aiDraftReadyForApproval) {
      onNotify('AI draft rejection blocked: generate a pending-review draft first.', 'warning');
      return;
    }

    const rejectedAt = new Date().toISOString();
    const actor = aiApprovalActor.trim().length > 0 ? aiApprovalActor.trim() : 'Planning operator';
    setAiApprovalActor(actor);
    setAiApprovalStatus('rejected');
    setAiApprovalAt(rejectedAt);
    onNotify(`AI planning summary rejected by ${actor}.`, 'warning');
  };

  const clearAiDraftSummary = () => {
    setAiDraftSummary('');
    setAiDraftGeneratedAt(null);
    setAiApprovalStatus('not-started');
    setAiApprovalAt(null);
    onNotify('AI planning summary draft cleared.', 'info');
  };

  const dismissCopHandoffContext = () => {
    dismissCopHandoffBanner('Planning', setCopHandoffDismissed, onNotify);
  };

  const clearCopHandoffContext = () => {
    clearCopHandoffBannerContext(setCopHandoffContext, setCopHandoffDismissed, onNotify, true);
  };

  return (
    <Card className="shadow-sm ipoc-mission-cockpit ipoc-planning-cockpit">
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <span className="pe-2">Planning Cycle Command Board</span>
        <span className="d-inline-flex gap-2">
          <IconActionButton
            iconClassName="bi bi-info-circle"
            tooltip="Planning workspace for P-cycle cadence, focused-incident planning controls, objective/SITREP readiness, and governance playbooks."
            ariaLabel="Planning workspace information"
            onClick={() => undefined}
            variant="outline-secondary"
            size="sm"
          />
          <Badge bg="secondary">Data Scope Focused Incident</Badge>
          <Badge bg={sitrepCadenceVariant}>
            {staleSitrepHours === null ? 'No SITREP' : `SITREP ${staleSitrepHours}h old`}
          </Badge>
        </span>
      </Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3">
          <Col md={8}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Focused incident selector" info="Select and switch the active incident directly from Planning so cadence, SITREP freshness, and objective metrics stay scoped to the correct incident. Type while this selector is focused to filter by incident number, name, or type." /></Form.Label>
            <div className="position-relative" ref={planningIncidentComboboxRef}>
              <Form.Control
                size="sm"
                type="text"
                role="combobox"
                aria-expanded={planningIncidentComboboxOpen}
                aria-autocomplete="list"
                aria-controls="planning-focused-incident-options"
                value={planningIncidentTypeahead}
                placeholder={planningIncidentSelectedLabel || 'Select active incident'}
                onFocus={() => {
                  setPlanningIncidentComboboxOpen(true);
                  setPlanningIncidentActiveOptionIndex(0);
                }}
                onChange={(event) => applyPlanningIncidentTypeahead(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setPlanningIncidentComboboxOpen(true);
                    setPlanningIncidentActiveOptionIndex((current) => {
                      const maxIndex = Math.max(0, filteredPlanningIncidentOptions.length - 1);
                      return Math.min(maxIndex, current + 1);
                    });
                    return;
                  }

                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setPlanningIncidentComboboxOpen(true);
                    setPlanningIncidentActiveOptionIndex((current) => Math.max(0, current - 1));
                    return;
                  }

                  if (event.key === 'Enter') {
                    if (!planningIncidentComboboxOpen) {
                      return;
                    }

                    event.preventDefault();
                    const candidate = filteredPlanningIncidentOptions[planningIncidentActiveOptionIndex]
                      ?? filteredPlanningIncidentOptions[0];
                    if (candidate) {
                      selectPlanningIncident(candidate.incidentId);
                    }
                    return;
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setPlanningIncidentTypeahead('');
                    setPlanningIncidentComboboxOpen(false);
                    setPlanningIncidentActiveOptionIndex(-1);
                    return;
                  }

                  if (event.key === 'Tab') {
                    setPlanningIncidentComboboxOpen(false);
                  }
                }}
                autoComplete="off"
                data-testid="planning-focused-incident-typeahead-input"
                className="mb-1"
              />
              {planningIncidentComboboxOpen && (
                <div
                  id="planning-focused-incident-options"
                  role="listbox"
                  className="list-group position-absolute w-100 shadow-sm"
                  style={{ zIndex: 20, maxHeight: '14rem', overflowY: 'auto' }}
                  data-testid="planning-focused-incident-combobox-options"
                >
                  {filteredPlanningIncidentOptions.length === 0 ? (
                    <button
                      type="button"
                      className="list-group-item list-group-item-action disabled"
                      disabled
                    >
                      No incidents match current typeahead.
                    </button>
                  ) : filteredPlanningIncidentOptions.map((incident, index) => (
                    <button
                      key={incident.incidentId}
                      type="button"
                      role="option"
                      aria-selected={index === planningIncidentActiveOptionIndex}
                      className={`list-group-item list-group-item-action ${index === planningIncidentActiveOptionIndex ? 'active' : ''}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectPlanningIncident(incident.incidentId);
                      }}
                      onMouseEnter={() => setPlanningIncidentActiveOptionIndex(index)}
                      data-testid="planning-focused-incident-combobox-option"
                    >
                      {incident.incidentNumber} - {incident.incidentName} ({incident.incidentStatusCode})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="small text-muted mt-1" data-testid="planning-focused-incident-typeahead-summary">
              {planningIncidentTypeaheadSummary}
            </div>
          </Col>
          <Col md={4} className="d-flex align-items-end justify-content-start">
            <LabelWithInfo
              text="Focused incident context"
              info="Planning board metrics and command cadence state are scoped to the selected incident context."
              className="small text-muted"
            />
          </Col>
        </Row>
        {!isFocusedIncidentSelected && (
          <div className="small text-muted mb-2">No focused incident selected. Planning metrics remain at baseline until an incident is selected.</div>
        )}
        {copHandoffContext && !copHandoffDismissed && (
          <CopHandoffBanner
            context={copHandoffContext}
            badgeLabel="Planning handoff"
            onDismiss={dismissCopHandoffContext}
            onClear={clearCopHandoffContext}
          />
        )}

        <Row className="g-3 mb-3">
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Planning readiness score</div>
                <div className="fw-semibold fs-5">{planningReadinessScore}</div>
                <div className="small text-muted mt-1">Objective density {objectiveDensity}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">SITREP freshness score</div>
                <div className="fw-semibold fs-5">{sitrepFreshnessScore}</div>
                <ProgressBar now={sitrepFreshnessScore} variant={sitrepFreshnessScore < 45 ? 'danger' : sitrepFreshnessScore < 70 ? 'info' : 'success'} className="mt-2" style={{ height: '0.5rem' }} />
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Timeline recency</div>
                <div className="fw-semibold small">{latestTimelineUtc ? new Date(latestTimelineUtc).toLocaleString() : 'No timeline events'}</div>
                <div className="small text-muted mt-1">Planning signal anchor</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-1 d-flex align-items-center justify-content-between">
              <span>Weather trend signal</span>
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none"
                onClick={() => setShowWeatherRiskDayDetails((current) => !current)}
                disabled={weatherRiskDays.length === 0}
              >
                <Badge bg={weatherOperationalSignal.highRiskDayCount > 0 ? 'danger' : weatherOperationalSignal.moderateRiskDayCount > 0 ? 'warning' : 'secondary'}>
                  {weatherOperationalSignal.highRiskDayCount > 0
                    ? `${weatherOperationalSignal.highRiskDayCount} high-risk day(s)`
                    : weatherOperationalSignal.moderateRiskDayCount > 0
                      ? `${weatherOperationalSignal.moderateRiskDayCount} watch day(s)`
                      : 'Stable trend'}
                </Badge>
              </button>
            </div>
            <div className="small text-muted">
              {weatherOperationalSignal.locationLabel} · Avg {weatherOperationalSignal.averageTempF}°F · Spread {weatherOperationalSignal.temperatureSpread}°F
            </div>
            {!weatherOperationalSignal.hasData && (
              <div className="small text-muted mt-1">
                Live weather unavailable for focused incident context. Update incident location coordinates or Admin weather fallback settings.
              </div>
            )}
            <div className="small text-muted mt-1">{weatherOperationalSignal.immediateSummary}</div>
            {showWeatherRiskDayDetails && weatherRiskDays.length > 0 && (
              <ListGroup variant="flush" className="mt-2">
                {weatherRiskDays.map((item) => (
                  <ListGroup.Item key={`planning-weather-risk-${item.date}`} className="px-0 py-1 small bg-transparent">
                    <span className="fw-semibold">{new Date(item.date).toLocaleDateString()}</span>
                    <span className="text-muted"> · {item.temperatureF}°F / {item.temperatureC}°C · {item.summary}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>Planning cycle checklist</span>
              <Badge bg="secondary">{checklistCompletionCount}/3 complete</Badge>
            </div>
            <ProgressBar now={checklistCompletionPercent} variant={checklistCompletionPercent < 40 ? 'warning' : checklistCompletionPercent < 80 ? 'info' : 'success'} className="mb-2" style={{ height: '0.5rem' }} />
            <ListGroup variant="flush">
              <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
                <span>Planning brief prepared</span>
                <IconActionButton
                  iconClassName={planningBriefComplete ? 'bi bi-check2-square' : 'bi bi-square'}
                  tooltip={planningBriefComplete ? 'Mark planning brief as pending' : 'Mark planning brief as complete'}
                  ariaLabel={planningBriefComplete ? 'Mark planning brief as pending' : 'Mark planning brief as complete'}
                  onClick={() => setPlanningBriefComplete((current) => !current)}
                  variant="outline-secondary"
                />
              </ListGroup.Item>
              <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
                <span>Objective package reviewed</span>
                <IconActionButton
                  iconClassName={objectiveReviewComplete ? 'bi bi-check2-square' : 'bi bi-square'}
                  tooltip={objectiveReviewComplete ? 'Mark objective review as pending' : 'Mark objective review as complete'}
                  ariaLabel={objectiveReviewComplete ? 'Mark objective review as pending' : 'Mark objective review as complete'}
                  onClick={() => setObjectiveReviewComplete((current) => !current)}
                  variant="outline-secondary"
                />
              </ListGroup.Item>
              <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
                <span>SITREP cadence validated</span>
                <IconActionButton
                  iconClassName={sitrepCadenceReviewComplete ? 'bi bi-check2-square' : 'bi bi-square'}
                  tooltip={sitrepCadenceReviewComplete ? 'Mark SITREP cadence as pending' : 'Mark SITREP cadence as complete'}
                  ariaLabel={sitrepCadenceReviewComplete ? 'Mark SITREP cadence as pending' : 'Mark SITREP cadence as complete'}
                  onClick={() => setSitrepCadenceReviewComplete((current) => !current)}
                  variant="outline-secondary"
                />
              </ListGroup.Item>
            </ListGroup>
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">Planning cadence profile</div>
            <div className="small">
              {planningTrendData.map((item, index) => {
                const maxValue = Math.max(1, ...planningTrendData.map((point) => point.value));
                const widthPercent = Math.round((item.value / maxValue) * 100);
                return (
                  <div key={item.phase} className="mb-2">
                    <div className="d-flex justify-content-between small text-muted">
                      <span>{item.phase}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="analytics-track">
                      <div className={`analytics-bar analytics-bar-${index % 4}`} style={{ width: `${widthPercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>Planning action playbooks</span>
              <Badge bg={unresolvedDependencyCount > 0 ? 'warning' : 'secondary'}>
                Open blockers {unresolvedDependencyCount}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-1 mb-2">
              <Badge bg={planningBriefComplete ? 'success' : 'secondary'}>
                Planning brief {planningBriefComplete ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={objectiveReviewComplete ? 'success' : 'secondary'}>
                Objective review {objectiveReviewComplete ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={sitrepCadenceReviewComplete ? 'success' : 'secondary'}>
                SITREP cadence {sitrepCadenceReviewComplete ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={sitrepCount > 0 ? 'success' : 'secondary'}>
                SITREP baseline {sitrepCount > 0 ? 'ready' : 'pending'}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-2">
              <IconActionButton
                iconClassName="bi bi-play-circle"
                tooltip="Run P-cycle kickoff playbook"
                ariaLabel="Run P-cycle kickoff playbook"
                onClick={handlePcycleKickoffPlaybookClick}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-file-earmark-text"
                tooltip="Run IAP package progression playbook"
                ariaLabel="Run IAP package progression playbook"
                onClick={handleIapPackagePlaybookClick}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-stars"
                tooltip="Run AI summary preparation playbook"
                ariaLabel="Run AI summary preparation playbook"
                onClick={handleAiSummaryPrepPlaybookClick}
                variant="outline-secondary"
                disabled={!NAV_PLANNING_AI_ENABLED}
              />
              <IconActionButton
                iconClassName="bi bi-unlock"
                tooltip="Resolve blockers assist: close blocker directives and release dependent directives"
                ariaLabel="Resolve blockers assist"
                onClick={runResolveBlockersAssist}
                variant="outline-secondary"
                disabled={unresolvedDependencyCount === 0}
              />
            </div>
          </Card.Body>
        </Card>

        <ExecutionLaneBoard
          title="Planning execution lane"
          items={planningExecutionQueue}
          directives={executionDirectives}
          onDirectiveChange={handleDirectiveChange}
          enableDependencySequencing
        />

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">IAP governance closeout board</div>
            <ListGroup variant="flush" className="mb-2">
              {governanceGapActions.map((item) => (
                <ListGroup.Item key={item} className="px-0 py-1 small bg-transparent">
                  {item}
                </ListGroup.Item>
              ))}
            </ListGroup>
            <div className="d-inline-flex flex-wrap gap-2">
              <IconActionButton
                iconClassName="bi bi-shield-exclamation"
                tooltip="Open Incident workspace for operational period and objective execution"
                ariaLabel="Open Incident workspace"
                onClick={() => onNavigate?.('incidents')}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
              <IconActionButton
                iconClassName="bi bi-globe2"
                tooltip="Open COP workspace for command posture context"
                ariaLabel="Open COP workspace"
                onClick={() => onNavigate?.('cop')}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
              <IconActionButton
                iconClassName="bi bi-journal-check"
                tooltip="Open After Action workspace for corrective follow-through"
                ariaLabel="Open After Action workspace"
                onClick={() => onNavigate?.('after-action')}
                variant="outline-secondary"
                disabled={!onNavigate}
              />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>AI planning summary draft</span>
              <Badge bg={aiApprovalStatus === 'approved' ? 'success' : aiApprovalStatus === 'rejected' ? 'danger' : aiApprovalStatus === 'pending-review' ? 'warning' : 'secondary'}>
                {aiApprovalStatus === 'not-started' ? 'Not started' : aiApprovalStatus === 'pending-review' ? 'Pending review' : aiApprovalStatus === 'approved' ? 'Approved' : 'Rejected'}
              </Badge>
            </div>
            <div className="small text-muted mb-2">
              Human approval is required before AI draft content is used operationally.
            </div>
            <Form.Control
              size="sm"
              as="textarea"
              rows={6}
              value={aiDraftSummary}
              readOnly
              aria-label="AI planning summary draft"
              placeholder="Generate AI draft summary to review and approve."
            />
            <div className="row g-2 mt-1">
              <div className="col-md-6">
                <Form.Control
                  size="sm"
                  type="text"
                  value={aiApprovalActor}
                  placeholder="Approver name"
                  aria-label="AI draft approver"
                  onChange={(event) => setAiApprovalActor(event.target.value)}
                />
              </div>
              <div className="col-md-6 small text-muted d-flex align-items-center justify-content-md-end">
                {aiDraftGeneratedAt
                  ? `Generated ${new Date(aiDraftGeneratedAt).toLocaleString()}`
                  : 'No draft generated'}
              </div>
            </div>
            <div className="d-inline-flex flex-wrap gap-2 mt-2">
              <IconActionButton
                iconClassName="bi bi-stars"
                tooltip="Generate AI planning summary draft"
                ariaLabel="Generate AI planning summary draft"
                onClick={generateAiDraftSummary}
                variant="outline-secondary"
                disabled={!NAV_PLANNING_AI_ENABLED}
              />
              <IconActionButton
                iconClassName="bi bi-check2-circle"
                tooltip="Approve AI planning summary draft"
                ariaLabel="Approve AI planning summary draft"
                onClick={approveAiDraftSummary}
                variant="outline-secondary"
                disabled={!NAV_PLANNING_AI_ENABLED || !aiDraftReadyForApproval}
              />
              <IconActionButton
                iconClassName="bi bi-x-circle"
                tooltip="Reject AI planning summary draft"
                ariaLabel="Reject AI planning summary draft"
                onClick={rejectAiDraftSummary}
                variant="outline-secondary"
                disabled={!NAV_PLANNING_AI_ENABLED || !aiDraftReadyForApproval}
              />
              <IconActionButton
                iconClassName="bi bi-eraser"
                tooltip="Clear AI planning summary draft"
                ariaLabel="Clear AI planning summary draft"
                onClick={clearAiDraftSummary}
                variant="outline-secondary"
                disabled={!NAV_PLANNING_AI_ENABLED || (aiDraftSummary.trim().length === 0 && aiApprovalStatus === 'not-started')}
              />
            </div>
            {!NAV_PLANNING_AI_ENABLED && (
              <div className="small text-muted mt-2">AI planning summary controls are disabled by feature flag for this environment.</div>
            )}
            {aiApprovalAt && (
              <div className="small text-muted mt-2">
                Decision {aiApprovalStatus} by {aiApprovalActor.trim().length > 0 ? aiApprovalActor : 'Planning operator'} at {new Date(aiApprovalAt).toLocaleString()}
              </div>
            )}
          </Card.Body>
        </Card>

        <Row className="g-2 mb-2">
          <Col md={5}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Planning cadence mode" info="Adjust planning cycle tempo between standard, compressed, and stabilization modes to match operational pressure." /></Form.Label>
            <Form.Select size="sm" value={planningCadenceMode} onChange={(event) => setPlanningCadenceMode(event.target.value as 'standard' | 'compressed' | 'stabilization')}>
              <option value="standard">Standard</option>
              <option value="compressed">Compressed</option>
              <option value="stabilization">Stabilization</option>
            </Form.Select>
          </Col>
          <Col md={7} className="d-flex align-items-end">
            <div className="small text-muted">{cadenceGuidance}</div>
          </Col>
        </Row>

        <ListGroup variant="flush">
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident</span>
            <strong>{selectedIncidentLabel}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Operational periods</span>
            <strong>{operationalPeriodCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Objectives</span>
            <strong>{objectiveCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>SITREP count</span>
            <strong>{sitrepCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Latest timeline update</span>
            <strong>{latestTimelineUtc ? new Date(latestTimelineUtc).toLocaleString() : '—'}</strong>
          </ListGroup.Item>
        </ListGroup>
      </Card.Body>
    </Card>
  );
}

export default PlanningCycleCard;
