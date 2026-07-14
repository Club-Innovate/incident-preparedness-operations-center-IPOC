import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Form, ListGroup, ProgressBar, Row } from 'react-bootstrap';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import CopHandoffBanner from '../common/CopHandoffBanner';
import { exportIncidentAfterActionEvidenceJson, getIncidentAfterActionEvidencePackage, getUserReportPresets, upsertUserReportPreset } from '../../api';
import type { CopCommandHandoffContext, IncidentAfterActionEvidencePackage } from '../../types';
import type { NotifyHandler } from '../../notifications/types';
import { readCopCommandHandoffContext } from '../../utils/copHandoffContext';
import { resolveAfterActionModeFromCopHandoff } from '../../utils/copHandoffMode';
import { clearCopHandoffBannerContext, dismissCopHandoffBanner } from '../../utils/copHandoffNotifications';
import { canManageAfterActionModuleActions } from '../../security/authorization';
import ExecutionLaneBoard from './ExecutionLaneBoard';
import type { ExecutionDirective, ExecutionDirectiveStatus, ExecutionLaneSignalItem } from './ExecutionLaneBoard';
import {
  applyDirectivePatch,
  applyDirectivePatchBatch,
  countUnresolvedDependencies,
  resolveDependencyBlockers,
} from './executionDependencyUtils';

const NAV_AFTER_ACTION_AI_ENABLED = import.meta.env.VITE_IPOC_NAV_AFTER_ACTION_AI_ENABLED === 'true';

type AfterActionReadinessCardProps = {
  isAuthenticated: boolean;
  authRoles: string[];
  authScopes: string[];
  incidentCount: number;
  closedIncidentCount: number;
  selectedIncidentTimelineCount: number;
  selectedIncidentCommunicationCount: number;
  selectedIncidentResourceRequestCount: number;
  commandPostureRecommendations: string[];
  nimsComplianceGaps: string[];
  missionDependencyBlockers: string[];
  selectedIncidentId: number | null;
  onNotify: NotifyHandler;
};

type ReplayMode = 'evidence' | 'closure' | 'improvement';

type ReplayMoment = {
  id: string;
  label: string;
  summary: string;
  readiness: number;
  recommendedMode: ReplayMode;
};

function AfterActionReadinessCard({
  isAuthenticated,
  authRoles,
  authScopes,
  incidentCount,
  closedIncidentCount,
  selectedIncidentTimelineCount,
  selectedIncidentCommunicationCount,
  selectedIncidentResourceRequestCount,
  commandPostureRecommendations,
  nimsComplianceGaps,
  missionDependencyBlockers,
  selectedIncidentId,
  onNotify,
}: AfterActionReadinessCardProps) {
  const NAV_AFTER_ACTION_SCOPE = 'navigation-after-action';
  const NAV_AFTER_ACTION_PRESET = 'default';
  const [correctiveActionsLogged, setCorrectiveActionsLogged] = useState(0);
  const [afterActionMode, setAfterActionMode] = useState<'evidence' | 'closure' | 'improvement'>('evidence');
  const [executionDirectives, setExecutionDirectives] = useState<ExecutionDirective[]>([]);
  const [lastPromotedLessonsSignature, setLastPromotedLessonsSignature] = useState('');
  const [copHandoffContext, setCopHandoffContext] = useState<CopCommandHandoffContext | null>(null);
  const [copHandoffDismissed, setCopHandoffDismissed] = useState(false);
  const [afterActionEvidencePackage, setAfterActionEvidencePackage] = useState<IncidentAfterActionEvidencePackage | null>(null);
  const [afterActionEvidenceLoading, setAfterActionEvidenceLoading] = useState(false);

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
        const presets = await getUserReportPresets(NAV_AFTER_ACTION_SCOPE);
        const preset = presets.find((item) => item.presetName === NAV_AFTER_ACTION_PRESET) ?? presets[0] ?? null;
        if (!preset || !preset.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          correctiveActionsLogged?: number;
          executionDirectives?: unknown;
          lastPromotedLessonsSignature?: string;
        };

        const parsedCount = Number(parsed.correctiveActionsLogged ?? 0);
        if (Number.isFinite(parsedCount) && parsedCount >= 0) {
          setCorrectiveActionsLogged(parsedCount);
        }

        setExecutionDirectives(parseExecutionDirectives(parsed.executionDirectives));
        if (typeof parsed.lastPromotedLessonsSignature === 'string') {
          setLastPromotedLessonsSignature(parsed.lastPromotedLessonsSignature);
        }
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
      void upsertUserReportPreset(NAV_AFTER_ACTION_SCOPE, {
        presetName: NAV_AFTER_ACTION_PRESET,
        presetJson: JSON.stringify({
          correctiveActionsLogged,
          executionDirectives,
          lastPromotedLessonsSignature,
        }),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [NAV_AFTER_ACTION_PRESET, NAV_AFTER_ACTION_SCOPE, correctiveActionsLogged, executionDirectives, isAuthenticated, lastPromotedLessonsSignature]);

  useEffect(() => {
    const persisted = localStorage.getItem('ipoc.nav.afteraction.checkpoints');
    if (!persisted) {
      return;
    }

    try {
      const parsed = JSON.parse(persisted) as {
        correctiveActionsLogged?: number;
        executionDirectives?: unknown;
        lastPromotedLessonsSignature?: string;
      };

      const parsedCount = Number(parsed.correctiveActionsLogged ?? 0);
      if (Number.isFinite(parsedCount) && parsedCount >= 0) {
        setCorrectiveActionsLogged(parsedCount);
      }

      setExecutionDirectives(parseExecutionDirectives(parsed.executionDirectives));
      if (typeof parsed.lastPromotedLessonsSignature === 'string') {
        setLastPromotedLessonsSignature(parsed.lastPromotedLessonsSignature);
      }
    } catch {
      const parsedCount = Number(persisted);
      if (Number.isFinite(parsedCount) && parsedCount >= 0) {
        setCorrectiveActionsLogged(parsedCount);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ipoc.nav.afteraction.checkpoints', JSON.stringify({
      correctiveActionsLogged,
      executionDirectives,
      lastPromotedLessonsSignature,
    }));
  }, [correctiveActionsLogged, executionDirectives, lastPromotedLessonsSignature]);

  useEffect(() => {
    const parsed = readCopCommandHandoffContext('after-action');
    if (!parsed) {
      return;
    }

    setCopHandoffContext(parsed);
    setCopHandoffDismissed(false);

    setAfterActionMode(resolveAfterActionModeFromCopHandoff(parsed));
    onNotify('After Action workspace primed from COP command handoff context.', 'info');
  }, [onNotify]);
  const insightEvidenceBonus = commandPostureRecommendations.length + nimsComplianceGaps.length + missionDependencyBlockers.length;
  const evidenceSignals = selectedIncidentTimelineCount + selectedIncidentCommunicationCount + selectedIncidentResourceRequestCount + insightEvidenceBonus;
  const evidenceVariant = evidenceSignals > 0 ? 'success' : 'secondary';
  const closureCoveragePercent = incidentCount > 0
    ? Math.round((closedIncidentCount / incidentCount) * 100)
    : 0;

  const correctiveCoveragePercent = incidentCount > 0
    ? Math.min(100, Math.round((correctiveActionsLogged / incidentCount) * 100))
    : 0;

  const afterActionReadinessScore = Math.max(0,
    evidenceSignals
    + (closedIncidentCount * 2)
    + correctiveActionsLogged,
  );

  const afterActionChartData = useMemo(() => ([
    { bucket: 'Timeline', value: selectedIncidentTimelineCount },
    { bucket: 'Comms', value: selectedIncidentCommunicationCount },
    { bucket: 'Resources', value: selectedIncidentResourceRequestCount },
    { bucket: 'Corrective', value: correctiveActionsLogged },
    { bucket: 'NIMS Gaps', value: nimsComplianceGaps.length },
    { bucket: 'Dependency', value: missionDependencyBlockers.length },
  ]), [correctiveActionsLogged, missionDependencyBlockers.length, nimsComplianceGaps.length, selectedIncidentCommunicationCount, selectedIncidentResourceRequestCount, selectedIncidentTimelineCount]);

  const afterActionModeGuidance = afterActionMode === 'closure'
    ? 'Closure mode: prioritize converting active incidents into closure-ready evidence packages.'
    : afterActionMode === 'improvement'
      ? 'Improvement mode: prioritize corrective-action capture and assign owners for follow-through.'
      : 'Evidence mode: prioritize collection quality across timeline, communications, and resource records.';

  const retrospectiveReadinessSignal = evidenceSignals === 0
    ? 'Evidence baseline is limited. Capture timeline/communications/resource activity before AAR drafting.'
    : evidenceSignals < 10
      ? 'Evidence baseline is partial. Continue collecting timeline and communications artifacts.'
      : 'Evidence baseline is strong for corrective-action analysis.';

  const lessonsLearnedSuggestions = useMemo(() => {
    const items: string[] = [];

    if (nimsComplianceGaps.length > 0) {
      items.push(`Create compliance corrective actions for ${nimsComplianceGaps.length} NIMS gap(s).`);
    }

    if (missionDependencyBlockers.length > 0) {
      items.push(`Document dependency mitigation plan for ${missionDependencyBlockers.length} blocker(s).`);
    }

    if (commandPostureRecommendations.length > 0) {
      items.push(`Capture command posture outcomes for ${Math.min(commandPostureRecommendations.length, 3)} recommendation(s).`);
    }

    if (selectedIncidentCommunicationCount === 0) {
      items.push('Include communications chronology capture in the next operational cycle.');
    }

    if (selectedIncidentResourceRequestCount === 0) {
      items.push('Add resource request evidence linkage to support retrospective fulfillment analysis.');
    }

    return items;
  }, [commandPostureRecommendations.length, missionDependencyBlockers.length, nimsComplianceGaps.length, selectedIncidentCommunicationCount, selectedIncidentResourceRequestCount]);

  const lessonsLearnedSignature = useMemo(
    () => lessonsLearnedSuggestions.join('||'),
    [lessonsLearnedSuggestions],
  );
  const lessonsAlreadyPromoted = lessonsLearnedSignature.length > 0 && lessonsLearnedSignature === lastPromotedLessonsSignature;

  const closureSignal = incidentCount === 0
    ? 'No incidents currently available for AAR coverage assessment.'
    : `${closureCoveragePercent}% of incidents are in Closed status and ready for retrospective packaging.`;

  const canManageAfterActionControls = canManageAfterActionModuleActions(isAuthenticated, authRoles, authScopes);

  const replayMoments = useMemo<ReplayMoment[]>(() => {
    const timelineEvidence = selectedIncidentTimelineCount;
    const communicationEvidence = selectedIncidentCommunicationCount;
    const resourceEvidence = selectedIncidentResourceRequestCount;
    const checklistPassCount = afterActionEvidencePackage?.acceptanceChecklist.filter((item) => item.status === 'Pass').length ?? 0;
    const checklistTotal = afterActionEvidencePackage?.acceptanceChecklist.length ?? 0;

    return [
      {
        id: 'replay-capture-baseline',
        label: 'Evidence capture baseline',
        summary: `Timeline ${timelineEvidence}, communications ${communicationEvidence}, resources ${resourceEvidence}.`,
        readiness: Math.min(100, Math.round((evidenceSignals / Math.max(1, evidenceSignals + 4)) * 100)),
        recommendedMode: 'evidence',
      },
      {
        id: 'replay-closure-evaluation',
        label: 'Closure posture checkpoint',
        summary: `${closedIncidentCount} of ${Math.max(1, incidentCount)} incidents closed (${closureCoveragePercent}%).`,
        readiness: closureCoveragePercent,
        recommendedMode: 'closure',
      },
      {
        id: 'replay-corrective-readiness',
        label: 'Corrective pipeline checkpoint',
        summary: `${correctiveActionsLogged} corrective placeholder action(s) logged.`,
        readiness: correctiveCoveragePercent,
        recommendedMode: 'improvement',
      },
      {
        id: 'replay-governance-check',
        label: 'AAR/HVA governance gate',
        summary: checklistTotal > 0
          ? `${checklistPassCount}/${checklistTotal} evidence checklist items passing.`
          : 'Checklist not yet hydrated; refresh evidence package for governance detail.',
        readiness: checklistTotal > 0 ? Math.round((checklistPassCount / checklistTotal) * 100) : 0,
        recommendedMode: checklistTotal > 0 && checklistPassCount >= Math.ceil(checklistTotal * 0.7) ? 'closure' : 'evidence',
      },
      {
        id: 'replay-lessons-harvest',
        label: 'Lessons-learned harvest checkpoint',
        summary: `${lessonsLearnedSuggestions.length} automated lesson candidate(s) available for promotion.`,
        readiness: lessonsLearnedSuggestions.length > 0 ? 100 : 40,
        recommendedMode: lessonsLearnedSuggestions.length > 0 ? 'improvement' : 'evidence',
      },
    ];
  }, [
    afterActionEvidencePackage?.acceptanceChecklist,
    closureCoveragePercent,
    closedIncidentCount,
    correctiveActionsLogged,
    correctiveCoveragePercent,
    evidenceSignals,
    incidentCount,
    lessonsLearnedSuggestions.length,
    selectedIncidentCommunicationCount,
    selectedIncidentResourceRequestCount,
    selectedIncidentTimelineCount,
  ]);

  const [replayTimelineIndex, setReplayTimelineIndex] = useState(0);
  const [replayTimelinePlaying, setReplayTimelinePlaying] = useState(false);
  const [replayTimelineSpeed, setReplayTimelineSpeed] = useState<1 | 2 | 4>(1);

  useEffect(() => {
    if (replayTimelineIndex < replayMoments.length) {
      return;
    }

    setReplayTimelineIndex(Math.max(0, replayMoments.length - 1));
  }, [replayTimelineIndex, replayMoments.length]);

  useEffect(() => {
    if (!replayTimelinePlaying || replayMoments.length === 0) {
      return;
    }

    const intervalMs = Math.max(500, Math.floor(2200 / replayTimelineSpeed));
    const timerId = window.setInterval(() => {
      setReplayTimelineIndex((current) => {
        if (current >= replayMoments.length - 1) {
          setReplayTimelinePlaying(false);
          onNotify('Incident replay timeline reached final checkpoint.', 'info');
          return current;
        }

        return current + 1;
      });
    }, intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [onNotify, replayMoments.length, replayTimelinePlaying, replayTimelineSpeed]);

  const activeReplayMoment = replayMoments[Math.min(replayTimelineIndex, Math.max(0, replayMoments.length - 1))] ?? null;

  const applyReplayMomentContext = (moment: ReplayMoment | null = activeReplayMoment) => {
    if (!moment) {
      return;
    }

    setAfterActionMode(moment.recommendedMode);
    onNotify(`Replay checkpoint applied: ${moment.label} (${moment.recommendedMode} mode).`, 'info');
  };

  const moveReplayTimeline = (direction: -1 | 1) => {
    setReplayTimelinePlaying(false);
    setReplayTimelineIndex((current) => {
      const next = current + direction;
      return Math.min(Math.max(next, 0), Math.max(0, replayMoments.length - 1));
    });
  };

  const afterActionExecutionQueue = useMemo<ExecutionLaneSignalItem[]>(() => {
    const aarStatus = closureCoveragePercent >= 50
      ? 'in-progress'
      : 'at-risk';
    const correctiveStatus = correctiveActionsLogged > 0
      ? 'in-progress'
      : 'planned';
    const hvaStatus = incidentCount > 0 && evidenceSignals > 0
      ? 'planned'
      : 'backlog';
    const aiCopilotStatus = !NAV_AFTER_ACTION_AI_ENABLED
      ? 'backlog'
      : evidenceSignals >= 10
        ? 'planned'
        : 'backlog';

    return [
      {
        id: 'aar-package-readiness',
        capability: 'FEMA-compatible AAR/IP packaging readiness',
        rfpReference: 'C2/F5 AAR export parity',
        signalStatus: aarStatus,
        nextStep: aarStatus === 'at-risk'
          ? 'Increase closure coverage to stabilize AAR packaging readiness.'
          : 'Closure baseline is improving. Stage export evidence templates and approver flow.',
      },
      {
        id: 'aar-corrective-pipeline',
        capability: 'Corrective action ownership pipeline',
        rfpReference: 'After Action intake + improvement tracking',
        signalStatus: correctiveStatus,
        nextStep: correctiveStatus === 'planned'
          ? 'No corrective actions logged. Start owner-assigned corrective queue.'
          : `Track ${correctiveActionsLogged} corrective action item(s) through owner and due-date checkpoints.`,
      },
      {
        id: 'aar-hva-alignment',
        capability: 'HVA starter output alignment',
        rfpReference: 'C8/F5 HVA workflow parity',
        signalStatus: hvaStatus,
        nextStep: hvaStatus === 'backlog'
          ? 'Capture baseline incident evidence before generating HVA starter outputs.'
          : 'Build initial HVA profile from evidence mix and closure posture.',
      },
      {
        id: 'aar-ai-retrospective',
        capability: 'AI-assisted retrospective summarization',
        rfpReference: 'Phase D differentiation',
        signalStatus: aiCopilotStatus,
        nextStep: !NAV_AFTER_ACTION_AI_ENABLED
          ? 'AI retrospective controls are disabled by feature flag in this environment.'
          : aiCopilotStatus === 'backlog'
          ? 'Evidence volume is limited; collect additional timeline/comms/resource records first.'
          : 'Generate AI summary draft and route through explicit human approval with audit trail.',
      },
      {
        id: 'aar-auto-lessons-harvest',
        capability: 'Automated lessons-learned evidence harvesting',
        rfpReference: 'Differentiator: automated lessons learned',
        signalStatus: lessonsLearnedSuggestions.length > 0 ? 'in-progress' : 'planned',
        nextStep: lessonsLearnedSuggestions.length > 0
          ? `Auto-generated ${lessonsLearnedSuggestions.length} lessons-learned candidate(s) for AAR triage.`
          : 'Collect additional operational evidence to seed lessons-learned suggestions.',
      },
    ];
  }, [closureCoveragePercent, correctiveActionsLogged, evidenceSignals, incidentCount, lessonsLearnedSuggestions.length]);

  const handleDirectiveChange = (id: string, patch: Partial<ExecutionDirective>) => {
    setExecutionDirectives((current) => applyDirectivePatch(current, id, patch));
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  const runAarReadinessPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'aar-package-readiness', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'aar-corrective-pipeline', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'aar-package-readiness' } },
      { id: 'aar-hva-alignment', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'aar-corrective-pipeline' } },
      { id: 'aar-ai-retrospective', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'aar-hva-alignment' } },
      { id: 'aar-auto-lessons-harvest', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'aar-ai-retrospective' } },
    ]));
  };

  const runCorrectiveClosurePlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'aar-package-readiness', patch: { status: 'completed', blockedByDirectiveId: '' } },
      { id: 'aar-corrective-pipeline', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'aar-hva-alignment', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: 'aar-corrective-pipeline' } },
      { id: 'aar-ai-retrospective', patch: { status: 'planned', blockedByDirectiveId: 'aar-hva-alignment' } },
    ]));
  };

  const runRetrospectiveSummaryPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'aar-hva-alignment', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'aar-ai-retrospective', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'aar-hva-alignment' } },
    ]));
  };

  const unresolvedDependencyCount = useMemo(() => countUnresolvedDependencies(executionDirectives), [executionDirectives]);

  const canRunAarReadinessPlaybook = closureCoveragePercent > 0;
  const canRunCorrectiveClosurePlaybook = correctiveActionsLogged > 0;
  const canRunRetrospectiveSummaryPlaybook = evidenceSignals > 0;

  const notifyPlaybookBlocked = (gate: string) => {
    onNotify(`Playbook blocked: ${gate}.`, 'warning');
  };

  const refreshAfterActionEvidencePackage = async () => {
    if (!canManageAfterActionControls) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (selectedIncidentId === null || selectedIncidentId <= 0) {
      notifyPlaybookBlocked('select an incident first');
      return;
    }

    setAfterActionEvidenceLoading(true);
    try {
      const payload = await getIncidentAfterActionEvidencePackage(selectedIncidentId);
      setAfterActionEvidencePackage(payload);
      onNotify('After-action evidence package readiness refreshed.', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to refresh after-action evidence package.', 'danger');
    } finally {
      setAfterActionEvidenceLoading(false);
    }
  };

  const handleAarReadinessPlaybookClick = () => {
    if (!canManageAfterActionControls) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (!canRunAarReadinessPlaybook) {
      notifyPlaybookBlocked('establish closure baseline');
      return;
    }

    runAarReadinessPlaybook();
  };

  const handleCorrectiveClosurePlaybookClick = () => {
    if (!canManageAfterActionControls) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (!canRunCorrectiveClosurePlaybook) {
      notifyPlaybookBlocked('log corrective actions first');
      return;
    }

    runCorrectiveClosurePlaybook();
  };

  const handleRetrospectiveSummaryPlaybookClick = () => {
    if (!canManageAfterActionControls) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (!NAV_AFTER_ACTION_AI_ENABLED) {
      notifyPlaybookBlocked('AI retrospective feature flag is disabled');
      return;
    }

    if (!canRunRetrospectiveSummaryPlaybook) {
      notifyPlaybookBlocked('capture timeline, communications, or resource evidence signals');
      return;
    }

    runRetrospectiveSummaryPlaybook();
  };

  const runResolveBlockersAssist = () => {
    setExecutionDirectives((current) => resolveDependencyBlockers(current));
  };

  const promoteLessonsToCorrectiveActions = () => {
    if (!canManageAfterActionControls) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (lessonsLearnedSuggestions.length === 0) {
      notifyPlaybookBlocked('automated lessons-learned candidates are not available yet');
      return;
    }

    if (lessonsAlreadyPromoted) {
      notifyPlaybookBlocked('current lessons-learned candidates are already promoted');
      return;
    }

    setCorrectiveActionsLogged((current) => current + lessonsLearnedSuggestions.length);
    setLastPromotedLessonsSignature(lessonsLearnedSignature);
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'aar-auto-lessons-harvest', patch: { status: 'completed', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'aar-corrective-pipeline', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
    ]));
    onNotify(`Promoted ${lessonsLearnedSuggestions.length} lessons-learned candidate(s) into corrective action starters.`, 'success');
  };

  const handleExportAfterActionEvidenceJson = async () => {
    if (!canManageAfterActionControls) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (selectedIncidentId === null || selectedIncidentId <= 0) {
      notifyPlaybookBlocked('select an incident first');
      return;
    }

    try {
      const blob = await exportIncidentAfterActionEvidenceJson(selectedIncidentId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `incident-after-action-evidence-${selectedIncidentId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onNotify('After-action evidence export generated.', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to export after-action evidence.', 'danger');
    }
  };

  const dismissCopHandoffContext = () => {
    dismissCopHandoffBanner('After Action', setCopHandoffDismissed, onNotify);
  };

  const clearCopHandoffContext = () => {
    clearCopHandoffBannerContext(setCopHandoffContext, setCopHandoffDismissed, onNotify, true);
  };

  return (
    <Card className="shadow-sm ipoc-mission-cockpit ipoc-after-action-cockpit">
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <span className="pe-2">After Action Analytics Board</span>
        <span className="d-inline-flex gap-2">
          <IconActionButton
            iconClassName="bi bi-info-circle"
            tooltip="After Action workspace for retrospective evidence quality, closure readiness, corrective actions, and lessons-learned execution workflows."
            ariaLabel="After action workspace information"
            onClick={() => undefined}
            variant="outline-secondary"
            size="sm"
          />
          <Badge bg="secondary">Data Scope Hybrid</Badge>
          <Badge bg={evidenceVariant}>Evidence signals {evidenceSignals}</Badge>
        </span>
      </Card.Header>
      <Card.Body>
        {!canManageAfterActionControls && (
          <div className="small text-muted mb-2">After Action controls require admin/commander access.</div>
        )}
        {copHandoffContext && !copHandoffDismissed && (
          <CopHandoffBanner
            context={copHandoffContext}
            badgeLabel="After Action handoff"
            onDismiss={dismissCopHandoffContext}
            onClear={clearCopHandoffContext}
          />
        )}

        <Row className="g-3 mb-3">
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">AAR readiness score</div>
                <div className="fw-semibold fs-5">{afterActionReadinessScore}</div>
                <div className="small text-muted mt-1">Evidence + closure + corrective blend</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Closure coverage</div>
                <div className="fw-semibold fs-5">{closureCoveragePercent}%</div>
                <ProgressBar now={closureCoveragePercent} variant={closureCoveragePercent < 30 ? 'info' : closureCoveragePercent < 65 ? 'secondary' : 'success'} className="mt-2" style={{ height: '0.5rem' }} />
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Corrective coverage</div>
                <div className="fw-semibold fs-5">{correctiveCoveragePercent}%</div>
                <ProgressBar now={correctiveCoveragePercent} variant={correctiveCoveragePercent < 25 ? 'info' : correctiveCoveragePercent < 60 ? 'secondary' : 'success'} className="mt-2" style={{ height: '0.5rem' }} />
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">Evidence quality profile</div>
            <div className="small">
              {afterActionChartData.map((item, index) => {
                const maxValue = Math.max(1, ...afterActionChartData.map((point) => point.value));
                const widthPercent = Math.round((item.value / maxValue) * 100);
                return (
                  <div key={item.bucket} className="mb-2">
                    <div className="d-flex justify-content-between small text-muted">
                      <span>{item.bucket}</span>
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
              <span>After Action action playbooks</span>
              <Badge bg={unresolvedDependencyCount > 0 ? 'warning' : 'secondary'}>
                Open blockers {unresolvedDependencyCount}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-1 mb-2">
              <Badge bg={closureCoveragePercent > 0 ? 'success' : 'secondary'}>
                Closure baseline {closureCoveragePercent > 0 ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={correctiveActionsLogged > 0 ? 'success' : 'secondary'}>
                Corrective actions {correctiveActionsLogged > 0 ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={evidenceSignals > 0 ? 'success' : 'secondary'}>
                Evidence signals {evidenceSignals > 0 ? 'ready' : 'pending'}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-2">
              <IconActionButton
                iconClassName="bi bi-journal-check"
                tooltip="Run AAR readiness playbook"
                ariaLabel="Run AAR readiness playbook"
                onClick={handleAarReadinessPlaybookClick}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-check2-square"
                tooltip="Run corrective closure playbook"
                ariaLabel="Run corrective closure playbook"
                onClick={handleCorrectiveClosurePlaybookClick}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-file-text"
                tooltip="Run retrospective summary preparation playbook"
                ariaLabel="Run retrospective summary preparation playbook"
                onClick={handleRetrospectiveSummaryPlaybookClick}
                variant="outline-secondary"
                disabled={!canManageAfterActionControls || !NAV_AFTER_ACTION_AI_ENABLED}
              />
              <IconActionButton
                iconClassName="bi bi-unlock"
                tooltip="Resolve blockers assist: close blocker directives and release dependent directives"
                ariaLabel="Resolve blockers assist"
                onClick={runResolveBlockersAssist}
                variant="outline-secondary"
                disabled={!canManageAfterActionControls || unresolvedDependencyCount === 0}
              />
            </div>
            {!NAV_AFTER_ACTION_AI_ENABLED && (
              <div className="small text-muted mt-1">AI retrospective actions are disabled by feature flag for this environment.</div>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card" data-testid="after-action-replay-timeline-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>Incident replay timeline engine</span>
              <Badge bg={replayTimelinePlaying ? 'info' : 'secondary'}>
                {replayTimelinePlaying ? 'Playing' : 'Paused'}
              </Badge>
            </div>
            {activeReplayMoment ? (
              <>
                <div className="small d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-semibold" data-testid="after-action-replay-moment-label">{activeReplayMoment.label}</span>
                  <Badge bg={activeReplayMoment.readiness >= 70 ? 'success' : activeReplayMoment.readiness >= 40 ? 'warning' : 'secondary'}>
                    Readiness {activeReplayMoment.readiness}%
                  </Badge>
                </div>
                <div className="small text-muted mb-2" data-testid="after-action-replay-moment-summary">{activeReplayMoment.summary}</div>
                <Form.Range
                  min={0}
                  max={Math.max(0, replayMoments.length - 1)}
                  step={1}
                  value={replayTimelineIndex}
                  onChange={(event) => {
                    setReplayTimelinePlaying(false);
                    setReplayTimelineIndex(Number(event.target.value));
                  }}
                  data-testid="after-action-replay-scrubber"
                />
                <div className="d-inline-flex align-items-center gap-2 mt-2" data-testid="after-action-replay-controls">
                  <IconActionButton
                    iconClassName="bi bi-arrow-clockwise"
                    tooltip="Refresh after-action evidence package before replay"
                    ariaLabel="Refresh after-action evidence package"
                    onClick={() => { void refreshAfterActionEvidencePackage(); }}
                    variant={afterActionEvidenceLoading ? 'secondary' : 'outline-secondary'}
                    disabled={afterActionEvidenceLoading}
                    testId="after-action-replay-refresh-evidence"
                  />
                  <IconActionButton
                    iconClassName="bi bi-skip-backward"
                    tooltip="Replay previous checkpoint"
                    ariaLabel="Replay previous checkpoint"
                    onClick={() => moveReplayTimeline(-1)}
                    variant="outline-secondary"
                    disabled={replayTimelineIndex === 0}
                    testId="after-action-replay-prev"
                  />
                  <IconActionButton
                    iconClassName={replayTimelinePlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill'}
                    tooltip={replayTimelinePlaying ? 'Pause incident replay timeline' : 'Play incident replay timeline'}
                    ariaLabel={replayTimelinePlaying ? 'Pause incident replay timeline' : 'Play incident replay timeline'}
                    onClick={() => setReplayTimelinePlaying((current) => !current)}
                    variant="outline-secondary"
                    disabled={replayMoments.length <= 1}
                    testId="after-action-replay-toggle-play"
                  />
                  <IconActionButton
                    iconClassName="bi bi-skip-forward"
                    tooltip="Replay next checkpoint"
                    ariaLabel="Replay next checkpoint"
                    onClick={() => moveReplayTimeline(1)}
                    variant="outline-secondary"
                    disabled={replayTimelineIndex >= replayMoments.length - 1}
                    testId="after-action-replay-next"
                  />
                  <Form.Select
                    size="sm"
                    value={replayTimelineSpeed}
                    onChange={(event) => setReplayTimelineSpeed(Number(event.target.value) as 1 | 2 | 4)}
                    style={{ width: '7rem' }}
                    data-testid="after-action-replay-speed"
                  >
                    <option value={1}>1x speed</option>
                    <option value={2}>2x speed</option>
                    <option value={4}>4x speed</option>
                  </Form.Select>
                  <IconActionButton
                    iconClassName="bi bi-bullseye"
                    tooltip="Apply current replay checkpoint context to After Action mode"
                    ariaLabel="Apply replay checkpoint context"
                    onClick={() => applyReplayMomentContext()}
                    variant="outline-primary"
                    testId="after-action-replay-apply-context"
                  />
                </div>
              </>
            ) : (
              <div className="small text-muted">Replay timeline is unavailable until readiness signals are populated.</div>
            )}
          </Card.Body>
        </Card>

        <ExecutionLaneBoard
          title="After Action execution lane"
          items={afterActionExecutionQueue}
          directives={executionDirectives}
          onDirectiveChange={handleDirectiveChange}
          enableDependencySequencing
        />

        <Card className="border-0 bg-body-tertiary mt-3 mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>Automated lessons-learned candidates</span>
              <Badge bg={lessonsLearnedSuggestions.length > 0 ? 'success' : 'secondary'}>
                Candidates {lessonsLearnedSuggestions.length}
              </Badge>
            </div>
            {lessonsLearnedSuggestions.length === 0 ? (
              <div className="small text-muted">No candidate findings generated yet. Continue collecting evidence signals and incident command insights.</div>
            ) : (
              <ListGroup variant="flush">
                {lessonsLearnedSuggestions.map((item) => (
                  <ListGroup.Item key={item} className="px-0 py-1 small bg-transparent">
                    {item}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
            <div className="mt-2">
              <IconActionButton
                iconClassName="bi bi-arrow-up-right-square"
                tooltip="Promote lessons-learned candidates to corrective action starters"
                ariaLabel="Promote lessons-learned candidates to corrective action starters"
                onClick={promoteLessonsToCorrectiveActions}
                variant="outline-secondary"
                disabled={!canManageAfterActionControls || lessonsLearnedSuggestions.length === 0 || lessonsAlreadyPromoted}
              />
              <IconActionButton
                iconClassName="bi bi-filetype-json"
                tooltip="Export after-action evidence package (JSON)"
                ariaLabel="Export after-action evidence package JSON"
                onClick={handleExportAfterActionEvidenceJson}
                variant="outline-secondary"
                disabled={!canManageAfterActionControls || selectedIncidentId === null}
              />
            </div>
            {lessonsAlreadyPromoted && (
              <div className="small text-muted mt-1">Current lessons-learned candidates are already promoted to corrective action starters.</div>
            )}
          </Card.Body>
        </Card>

        {afterActionEvidencePackage && (
          <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
            <Card.Body className="py-2">
              <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
                <span>After-action evidence package preview</span>
                <Badge bg={afterActionEvidencePackage.readiness.replayReady && afterActionEvidencePackage.readiness.hvaReady ? 'success' : 'warning'}>
                  {afterActionEvidencePackage.readiness.replayReady && afterActionEvidencePackage.readiness.hvaReady ? 'Ready' : 'Needs evidence'}
                </Badge>
              </div>
              <div className="small text-muted mb-2">
                Generated {new Date(afterActionEvidencePackage.generatedUtc).toLocaleString()} · Timeline {afterActionEvidencePackage.evidenceSummary.timelineCount} · Comms {afterActionEvidencePackage.evidenceSummary.communicationCount} · Resources {afterActionEvidencePackage.evidenceSummary.resourceRequestCount} · SITREP {afterActionEvidencePackage.evidenceSummary.situationReportCount}
              </div>
              {afterActionEvidencePackage.blockedReasons.length > 0 ? (
                <ListGroup variant="flush" className="mb-2">
                  {afterActionEvidencePackage.blockedReasons.slice(0, 3).map((reason) => (
                    <ListGroup.Item key={reason} className="px-0 py-1 small bg-transparent text-muted">
                      {reason}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <div className="small text-muted mb-2">No readiness blockers currently detected.</div>
              )}
              <ListGroup variant="flush">
                {afterActionEvidencePackage.acceptanceChecklist.map((item) => (
                  <ListGroup.Item key={item.check} className="px-0 py-1 small d-flex align-items-center justify-content-between bg-transparent">
                    <span>{item.check}</span>
                    <Badge bg={item.status === 'Pass' ? 'success' : 'warning'}>{item.status}</Badge>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        )}

        <Row className="g-2 mb-2">
          <Col md={5}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="After Action command mode" info="Select the retrospective posture focus for this workspace: evidence quality, closure readiness, or improvement pipeline." /></Form.Label>
            <Form.Select size="sm" value={afterActionMode} onChange={(event) => setAfterActionMode(event.target.value as 'evidence' | 'closure' | 'improvement')}>
              <option value="evidence">Evidence Quality</option>
              <option value="closure">Closure Readiness</option>
              <option value="improvement">Improvement Pipeline</option>
            </Form.Select>
          </Col>
          <Col md={7} className="d-flex align-items-end">
            <div className="small text-muted">{afterActionModeGuidance}</div>
          </Col>
        </Row>

        <ListGroup variant="flush">
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Total incidents</span>
            <strong>{incidentCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Closed incidents</span>
            <strong>{closedIncidentCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident timeline records</span>
            <strong>{selectedIncidentTimelineCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident communications</span>
            <strong>{selectedIncidentCommunicationCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident resource records</span>
            <strong>{selectedIncidentResourceRequestCount}</strong>
          </ListGroup.Item>
        </ListGroup>

        <div className="small fw-semibold mt-3 mb-1">Corrective action starter controls</div>
        <div className="d-inline-flex gap-2">
          <IconActionButton
            iconClassName="bi bi-plus-square"
            tooltip="Log corrective action placeholder"
            ariaLabel="Log corrective action placeholder"
            onClick={() => setCorrectiveActionsLogged((current) => current + 1)}
            variant="outline-secondary"
            disabled={!canManageAfterActionControls}
          />
          <IconActionButton
            iconClassName="bi bi-dash-square"
            tooltip="Remove corrective action placeholder"
            ariaLabel="Remove corrective action placeholder"
            onClick={() => setCorrectiveActionsLogged((current) => Math.max(0, current - 1))}
            variant="outline-secondary"
            disabled={!canManageAfterActionControls || correctiveActionsLogged === 0}
          />
        </div>
        <div className="small text-muted mt-2">Corrective action placeholders logged: {correctiveActionsLogged}</div>

        <div className="small text-muted mt-3">{closureSignal}</div>
        <div className="small text-muted mt-1">{retrospectiveReadinessSignal}</div>
      </Card.Body>
    </Card>
  );
}

export default AfterActionReadinessCard;
