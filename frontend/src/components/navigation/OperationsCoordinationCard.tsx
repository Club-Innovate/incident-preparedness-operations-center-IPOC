import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, Col, Form, ListGroup, ProgressBar, Row } from 'react-bootstrap';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import CopHandoffBanner from '../common/CopHandoffBanner';
import { getUserReportPresets, upsertUserReportPreset } from '../../api';
import type { CopCommandHandoffContext, IncidentSummary } from '../../types';
import type { NotifyHandler } from '../../notifications/types';
import { readCopCommandHandoffContext } from '../../utils/copHandoffContext';
import { resolveOperationsModeFromCopHandoff } from '../../utils/copHandoffMode';
import { clearCopHandoffBannerContext, dismissCopHandoffBanner } from '../../utils/copHandoffNotifications';
import ExecutionLaneBoard from './ExecutionLaneBoard';
import type { ExecutionDirective, ExecutionDirectiveStatus, ExecutionLaneSignalItem } from './ExecutionLaneBoard';
import {
  applyDirectivePatch,
  applyDirectivePatchBatch,
  countUnresolvedDependencies,
  resolveDependencyBlockers,
} from './executionDependencyUtils';

type OperationsCoordinationCardProps = {
  isAuthenticated: boolean;
  activeIncidentCount: number;
  selectedIncidentLabel: string;
  selectedIncidentOpenTaskCount: number;
  selectedIncidentTimelineCount: number;
  selectedIncidentResourceRequestCount: number;
  selectedIncidentCommunicationCount: number;
  incidents: IncidentSummary[];
  selectedIncidentId: number | null;
  onSelectIncident: (incidentId: number) => void;
  attentionLevel: 'low' | 'moderate' | 'high' | 'unknown';
  needsAttentionReasonCount: number;
  onNotify: NotifyHandler;
};

function OperationsCoordinationCard({
  isAuthenticated,
  activeIncidentCount,
  selectedIncidentLabel,
  selectedIncidentOpenTaskCount,
  selectedIncidentTimelineCount,
  selectedIncidentResourceRequestCount,
  selectedIncidentCommunicationCount,
  incidents,
  selectedIncidentId,
  onSelectIncident,
  attentionLevel,
  needsAttentionReasonCount,
  onNotify,
}: OperationsCoordinationCardProps) {
  const NAV_OPERATIONS_SCOPE = 'navigation-operations';
  const NAV_OPERATIONS_PRESET = 'default';
  const [operationsMode, setOperationsMode] = useState<'balanced' | 'surge' | 'communications'>('balanced');
  const [operationalBriefComplete, setOperationalBriefComplete] = useState(false);
  const [resourceSyncComplete, setResourceSyncComplete] = useState(false);
  const [commsCadenceComplete, setCommsCadenceComplete] = useState(false);
  const [operationsIncidentTypeahead, setOperationsIncidentTypeahead] = useState('');
  const [operationsIncidentComboboxOpen, setOperationsIncidentComboboxOpen] = useState(false);
  const [operationsIncidentActiveOptionIndex, setOperationsIncidentActiveOptionIndex] = useState(-1);
  const operationsIncidentComboboxRef = useRef<HTMLDivElement | null>(null);
  const [executionDirectives, setExecutionDirectives] = useState<ExecutionDirective[]>([]);
  const [copHandoffContext, setCopHandoffContext] = useState<CopCommandHandoffContext | null>(null);
  const [copHandoffDismissed, setCopHandoffDismissed] = useState(false);

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
        const presets = await getUserReportPresets(NAV_OPERATIONS_SCOPE);
        const preset = presets.find((item) => item.presetName === NAV_OPERATIONS_PRESET) ?? presets[0] ?? null;
        if (!preset || !preset.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          operationalBriefComplete?: boolean;
          resourceSyncComplete?: boolean;
          commsCadenceComplete?: boolean;
          executionDirectives?: unknown;
        };

        setOperationalBriefComplete(Boolean(parsed.operationalBriefComplete));
        setResourceSyncComplete(Boolean(parsed.resourceSyncComplete));
        setCommsCadenceComplete(Boolean(parsed.commsCadenceComplete));
        setExecutionDirectives(parseExecutionDirectives(parsed.executionDirectives));
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
      void upsertUserReportPreset(NAV_OPERATIONS_SCOPE, {
        presetName: NAV_OPERATIONS_PRESET,
        presetJson: JSON.stringify({
          operationalBriefComplete,
          resourceSyncComplete,
          commsCadenceComplete,
          executionDirectives,
        }),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [NAV_OPERATIONS_PRESET, NAV_OPERATIONS_SCOPE, commsCadenceComplete, executionDirectives, isAuthenticated, operationalBriefComplete, resourceSyncComplete]);

  useEffect(() => {
    const persisted = localStorage.getItem('ipoc.nav.operations.checkpoints');
    if (!persisted) {
      return;
    }

    try {
      const parsed = JSON.parse(persisted) as {
        operationalBriefComplete?: boolean;
        resourceSyncComplete?: boolean;
        commsCadenceComplete?: boolean;
        executionDirectives?: unknown;
      };

      setOperationalBriefComplete(Boolean(parsed.operationalBriefComplete));
      setResourceSyncComplete(Boolean(parsed.resourceSyncComplete));
      setCommsCadenceComplete(Boolean(parsed.commsCadenceComplete));
      setExecutionDirectives(parseExecutionDirectives(parsed.executionDirectives));
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ipoc.nav.operations.checkpoints', JSON.stringify({
      operationalBriefComplete,
      resourceSyncComplete,
      commsCadenceComplete,
      executionDirectives,
    }));
  }, [commsCadenceComplete, executionDirectives, operationalBriefComplete, resourceSyncComplete]);

  useEffect(() => {
    const parsed = readCopCommandHandoffContext('operations');
    if (!parsed) {
      return;
    }

    setCopHandoffContext(parsed);
    setCopHandoffDismissed(false);

    setOperationsMode(resolveOperationsModeFromCopHandoff(parsed));
    onNotify('Operations workspace primed from COP command handoff context.', 'info');
  }, [onNotify]);

  const attentionVariant = attentionLevel === 'high'
    ? 'danger'
    : attentionLevel === 'moderate'
      ? 'info'
      : attentionLevel === 'low'
        ? 'secondary'
        : 'secondary';

  const openLoadScore = selectedIncidentOpenTaskCount + selectedIncidentResourceRequestCount + selectedIncidentCommunicationCount;
  const activityDensityScore = selectedIncidentTimelineCount + selectedIncidentCommunicationCount;
  const checklistCompletionCount = [operationalBriefComplete, resourceSyncComplete, commsCadenceComplete].filter(Boolean).length;
  const checklistCompletionPercent = Math.round((checklistCompletionCount / 3) * 100);
  const commandPressureScore = (needsAttentionReasonCount * 3) + openLoadScore + checklistCompletionCount;

  const openLoadPercent = Math.min(100, Math.round((openLoadScore / Math.max(1, (activeIncidentCount * 12))) * 100));
  const attentionPercent = Math.min(100, Math.round((needsAttentionReasonCount / Math.max(1, activeIncidentCount * 4)) * 100));

  const operationsTrendData = useMemo(() => ([
    { metric: 'Open Tasks', value: selectedIncidentOpenTaskCount },
    { metric: 'Resource Requests', value: selectedIncidentResourceRequestCount },
    { metric: 'Communications', value: selectedIncidentCommunicationCount },
    { metric: 'Timeline Events', value: selectedIncidentTimelineCount },
  ]), [selectedIncidentCommunicationCount, selectedIncidentOpenTaskCount, selectedIncidentResourceRequestCount, selectedIncidentTimelineCount]);

  const operationsGuidance = operationsMode === 'surge'
    ? 'Surge mode prioritizes rapid task closure and immediate resource-routing decisions.'
    : operationsMode === 'communications'
      ? 'Communications mode prioritizes outbound updates, acknowledgments, and signal continuity.'
      : 'Balanced mode keeps operations, resource routing, and communications in coordinated cadence.';

  const operationsIncidentOptions = useMemo(() => {
    const activeIncidents = incidents.filter((incident) => incident.incidentStatusCode !== 'Closed');
    return activeIncidents.length > 0 ? activeIncidents : incidents;
  }, [incidents]);

  const filteredOperationsIncidentOptions = useMemo(() => {
    const normalizedSearch = operationsIncidentTypeahead.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
      return operationsIncidentOptions;
    }

    return operationsIncidentOptions.filter((incident) => (
      incident.incidentNumber.toLowerCase().includes(normalizedSearch)
      || incident.incidentName.toLowerCase().includes(normalizedSearch)
      || incident.incidentTypeCode.toLowerCase().includes(normalizedSearch)
    ));
  }, [operationsIncidentOptions, operationsIncidentTypeahead]);

  const operationsIncidentTypeaheadSummary = useMemo(() => {
    const normalizedSearch = operationsIncidentTypeahead.trim();
    if (normalizedSearch.length === 0) {
      return 'Type while focused to live-filter and jump to matching incidents.';
    }

    const matchLabel = filteredOperationsIncidentOptions.length === 1 ? 'match' : 'matches';
    return `Typeahead "${normalizedSearch}" · ${filteredOperationsIncidentOptions.length} ${matchLabel}`;
  }, [filteredOperationsIncidentOptions.length, operationsIncidentTypeahead]);

  const operationsIncidentSelectedLabel = useMemo(() => {
    if (!selectedIncidentId) {
      return '';
    }

    const selected = operationsIncidentOptions.find((incident) => incident.incidentId === selectedIncidentId);
    return selected
      ? `${selected.incidentNumber} - ${selected.incidentName} (${selected.incidentStatusCode})`
      : '';
  }, [operationsIncidentOptions, selectedIncidentId]);

  useEffect(() => {
    if (!operationsIncidentComboboxOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!operationsIncidentComboboxRef.current) {
        return;
      }

      if (!operationsIncidentComboboxRef.current.contains(event.target as Node)) {
        setOperationsIncidentComboboxOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [operationsIncidentComboboxOpen]);

  const applyOperationsIncidentTypeahead = (nextTypeahead: string) => {
    setOperationsIncidentTypeahead(nextTypeahead);
    setOperationsIncidentComboboxOpen(true);
    setOperationsIncidentActiveOptionIndex(0);

    const normalizedSearch = nextTypeahead.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
      return;
    }

    const matchedIncident = operationsIncidentOptions.find((incident) => (
      incident.incidentNumber.toLowerCase().includes(normalizedSearch)
      || incident.incidentName.toLowerCase().includes(normalizedSearch)
      || incident.incidentTypeCode.toLowerCase().includes(normalizedSearch)
    ));

    if (matchedIncident && matchedIncident.incidentId !== selectedIncidentId) {
      onSelectIncident(matchedIncident.incidentId);
    }
  };

  const selectOperationsIncident = (incidentId: number) => {
    onSelectIncident(incidentId);
    setOperationsIncidentTypeahead('');
    setOperationsIncidentComboboxOpen(false);
    setOperationsIncidentActiveOptionIndex(-1);
  };

  const operationsExecutionQueue = useMemo<ExecutionLaneSignalItem[]>(() => {
    const assignmentStatus = selectedIncidentOpenTaskCount > 0
      ? 'in-progress'
      : 'ready';
    const routingStatus = selectedIncidentResourceRequestCount > 0
      ? 'at-risk'
      : 'ready';
    const communicationsStatus = selectedIncidentCommunicationCount === 0
      ? 'at-risk'
      : commsCadenceComplete
        ? 'ready'
        : 'in-progress';
    const dependencyGraphStatus = commandPressureScore >= 12
      ? 'in-progress'
      : 'planned';

    return [
      {
        id: 'ops-assignment-cadence',
        capability: 'Cross-incident assignment board cadence',
        rfpReference: 'F1/F6 Operations tasking parity',
        signalStatus: assignmentStatus,
        nextStep: assignmentStatus === 'in-progress'
          ? 'Prioritize open-task bundles and dependency ordering for strike-team throughput.'
          : 'Assignment pressure is stable. Use this window to validate dependency chains.',
      },
      {
        id: 'ops-resource-routing',
        capability: 'Resource request routing lifecycle',
        rfpReference: 'F2 request → routing → assignment',
        signalStatus: routingStatus,
        nextStep: routingStatus === 'at-risk'
          ? `Route ${selectedIncidentResourceRequestCount} pending request(s) into assignment or escalation lanes.`
          : 'No pending focused requests. Validate cross-facility handoff readiness.',
      },
      {
        id: 'ops-communications-escalation',
        capability: 'Communications escalation posture',
        rfpReference: 'F3 acknowledgment + escalation chain',
        signalStatus: communicationsStatus,
        nextStep: communicationsStatus === 'at-risk'
          ? 'No communication activity detected. Trigger channel-check and delivery audit review.'
          : communicationsStatus === 'in-progress'
            ? 'Confirm cadence checkpoint and close the comms readiness gate.'
            : 'Escalation posture is stable for the current incident focus.',
      },
      {
        id: 'ops-dependency-graph',
        capability: 'Mission dependency graph pilot',
        rfpReference: 'Phase D differentiation',
        signalStatus: dependencyGraphStatus,
        nextStep: dependencyGraphStatus === 'planned'
          ? 'Pressure is low. Keep dependency graph in design validation mode.'
          : 'Pressure is elevated. Promote dependency-aware sequencing as command default.',
      },
    ];
  }, [
    commandPressureScore,
    commsCadenceComplete,
    selectedIncidentCommunicationCount,
    selectedIncidentOpenTaskCount,
    selectedIncidentResourceRequestCount,
  ]);

  const isFocusedIncidentSelected = selectedIncidentLabel.trim().length > 0 && selectedIncidentLabel !== 'No incident selected';

  const handleDirectiveChange = (id: string, patch: Partial<ExecutionDirective>) => {
    setExecutionDirectives((current) => applyDirectivePatch(current, id, patch));
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  const runSurgePlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'ops-assignment-cadence', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'ops-resource-routing', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'ops-communications-escalation', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'ops-dependency-graph', patch: { status: 'planned', blockedByDirectiveId: 'ops-assignment-cadence' } },
    ]));
  };

  const runCommsStabilizationPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'ops-communications-escalation', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'ops-assignment-cadence', patch: { status: 'planned', blockedByDirectiveId: '' } },
      { id: 'ops-resource-routing', patch: { status: 'planned', blockedByDirectiveId: 'ops-assignment-cadence' } },
      { id: 'ops-dependency-graph', patch: { status: 'planned', blockedByDirectiveId: 'ops-communications-escalation' } },
    ]));
  };

  const runDependencyFocusPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'ops-assignment-cadence', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'ops-resource-routing', patch: { status: 'blocked', dueDate: todayIso, blockedByDirectiveId: 'ops-assignment-cadence' } },
      { id: 'ops-communications-escalation', patch: { status: 'blocked', dueDate: todayIso, blockedByDirectiveId: 'ops-resource-routing' } },
      { id: 'ops-dependency-graph', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: 'ops-assignment-cadence' } },
    ]));
  };

  const unresolvedDependencyCount = useMemo(() => countUnresolvedDependencies(executionDirectives), [executionDirectives]);

  const canRunSurgePlaybook = operationalBriefComplete && resourceSyncComplete;
  const canRunCommsPlaybook = commsCadenceComplete;
  const canRunDependencyFocusPlaybook = operationalBriefComplete;

  const notifyPlaybookBlocked = (gate: string) => {
    onNotify(`Playbook blocked: ${gate}.`, 'warning');
  };

  const handleSurgePlaybookClick = () => {
    if (!canRunSurgePlaybook) {
      notifyPlaybookBlocked('complete command brief and resource sync checkpoints');
      return;
    }

    runSurgePlaybook();
  };

  const handleCommsPlaybookClick = () => {
    if (!canRunCommsPlaybook) {
      notifyPlaybookBlocked('confirm communications cadence checkpoint');
      return;
    }

    runCommsStabilizationPlaybook();
  };

  const handleDependencyFocusPlaybookClick = () => {
    if (!canRunDependencyFocusPlaybook) {
      notifyPlaybookBlocked('complete command brief checkpoint');
      return;
    }

    runDependencyFocusPlaybook();
  };

  const runResolveBlockersAssist = () => {
    setExecutionDirectives((current) => resolveDependencyBlockers(current));
  };

  const dismissCopHandoffContext = () => {
    dismissCopHandoffBanner('Operations', setCopHandoffDismissed, onNotify);
  };

  const clearCopHandoffContext = () => {
    clearCopHandoffBannerContext(setCopHandoffContext, setCopHandoffDismissed, onNotify, true);
  };

  return (
    <Card className="shadow-sm ipoc-mission-cockpit ipoc-operations-cockpit">
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <span className="pe-2">Operations Coordination Cockpit</span>
        <span className="d-inline-flex gap-2">
          <IconActionButton
            iconClassName="bi bi-info-circle"
            tooltip="Operations workspace for cross-incident command tempo, focused-incident workload controls, and execution playbooks."
            ariaLabel="Operations workspace information"
            onClick={() => undefined}
            variant="outline-secondary"
            size="sm"
          />
          <Badge bg="secondary">Data Scope Hybrid</Badge>
          <Badge bg={attentionVariant}>Attention {attentionLevel.toUpperCase()}</Badge>
        </span>
      </Card.Header>
      <Card.Body>
        {!isFocusedIncidentSelected && (
          <div className="small text-muted mb-2">No focused incident is selected. Cross-incident posture still renders.</div>
        )}
        <Row className="g-2 mb-3">
          <Col md={8}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Focused incident selector" info="Select and switch the active incident directly from Operations to manage command playbooks without leaving this workspace. Type while this selector is focused to filter by incident number, name, or type." /></Form.Label>
            <div className="position-relative" ref={operationsIncidentComboboxRef}>
              <Form.Control
                size="sm"
                type="text"
                role="combobox"
                aria-expanded={operationsIncidentComboboxOpen}
                aria-autocomplete="list"
                aria-controls="operations-focused-incident-options"
                value={operationsIncidentTypeahead}
                placeholder={operationsIncidentSelectedLabel || 'Select active incident'}
                onFocus={() => {
                  setOperationsIncidentComboboxOpen(true);
                  setOperationsIncidentActiveOptionIndex(0);
                }}
                onChange={(event) => applyOperationsIncidentTypeahead(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setOperationsIncidentComboboxOpen(true);
                    setOperationsIncidentActiveOptionIndex((current) => {
                      const maxIndex = Math.max(0, filteredOperationsIncidentOptions.length - 1);
                      return Math.min(maxIndex, current + 1);
                    });
                    return;
                  }

                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setOperationsIncidentComboboxOpen(true);
                    setOperationsIncidentActiveOptionIndex((current) => Math.max(0, current - 1));
                    return;
                  }

                  if (event.key === 'Enter') {
                    if (!operationsIncidentComboboxOpen) {
                      return;
                    }

                    event.preventDefault();
                    const candidate = filteredOperationsIncidentOptions[operationsIncidentActiveOptionIndex]
                      ?? filteredOperationsIncidentOptions[0];
                    if (candidate) {
                      selectOperationsIncident(candidate.incidentId);
                    }
                    return;
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setOperationsIncidentTypeahead('');
                    setOperationsIncidentComboboxOpen(false);
                    setOperationsIncidentActiveOptionIndex(-1);
                    return;
                  }

                  if (event.key === 'Tab') {
                    setOperationsIncidentComboboxOpen(false);
                  }
                }}
                autoComplete="off"
                data-testid="operations-focused-incident-typeahead-input"
                className="mb-1"
              />
              {operationsIncidentComboboxOpen && (
                <div
                  id="operations-focused-incident-options"
                  role="listbox"
                  className="list-group position-absolute w-100 shadow-sm"
                  style={{ zIndex: 20, maxHeight: '14rem', overflowY: 'auto' }}
                  data-testid="operations-focused-incident-combobox-options"
                >
                  {filteredOperationsIncidentOptions.length === 0 ? (
                    <button
                      type="button"
                      className="list-group-item list-group-item-action disabled"
                      disabled
                    >
                      No incidents match current typeahead.
                    </button>
                  ) : filteredOperationsIncidentOptions.map((incident, index) => (
                    <button
                      key={incident.incidentId}
                      type="button"
                      role="option"
                      aria-selected={index === operationsIncidentActiveOptionIndex}
                      className={`list-group-item list-group-item-action ${index === operationsIncidentActiveOptionIndex ? 'active' : ''}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectOperationsIncident(incident.incidentId);
                      }}
                      onMouseEnter={() => setOperationsIncidentActiveOptionIndex(index)}
                      data-testid="operations-focused-incident-combobox-option"
                    >
                      {incident.incidentNumber} - {incident.incidentName} ({incident.incidentStatusCode})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="small text-muted mt-1" data-testid="operations-focused-incident-typeahead-summary">
              {operationsIncidentTypeaheadSummary}
            </div>
          </Col>
          <Col md={4} className="d-flex align-items-end justify-content-start">
            <LabelWithInfo
              text="Focused incident context"
              info={filteredOperationsIncidentOptions.length > 0
                ? 'Active incident focus updates command load metrics and playbook context immediately.'
                : 'No incidents currently match typed selector keys. Pause for a moment or change keys to clear typeahead filtering.'}
              className="small text-muted"
            />
          </Col>
        </Row>
        {copHandoffContext && !copHandoffDismissed && (
          <CopHandoffBanner
            context={copHandoffContext}
            badgeLabel="Operations handoff"
            onDismiss={dismissCopHandoffContext}
            onClear={clearCopHandoffContext}
          />
        )}

        <Row className="g-3 mb-3">
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Open load score</div>
                <div className="fw-semibold fs-5">{openLoadScore}</div>
                <ProgressBar now={openLoadPercent} variant={openLoadPercent > 60 ? 'info' : 'secondary'} className="mt-2" style={{ height: '0.5rem' }} />
                <div className="small text-muted mt-1">{openLoadPercent}% relative load</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Attention signal density</div>
                <div className="fw-semibold fs-5">{needsAttentionReasonCount}</div>
                <ProgressBar now={attentionPercent} variant={attentionPercent > 55 ? 'danger' : 'secondary'} className="mt-2" style={{ height: '0.5rem' }} />
                <div className="small text-muted mt-1">{attentionPercent}% attention saturation</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Command pressure score</div>
                <div className="fw-semibold fs-5">{commandPressureScore}</div>
                <div className="small text-muted mt-1">Activity density {activityDensityScore}</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2 d-flex align-items-center justify-content-between">
              <span>Operations command checklist</span>
              <Badge bg="secondary">{checklistCompletionCount}/3 complete</Badge>
            </div>
            <ProgressBar now={checklistCompletionPercent} variant={checklistCompletionPercent < 40 ? 'warning' : checklistCompletionPercent < 80 ? 'info' : 'success'} className="mb-2" style={{ height: '0.5rem' }} />
            <ListGroup variant="flush">
              <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
                <span>Command brief confirmed</span>
                <IconActionButton
                  iconClassName={operationalBriefComplete ? 'bi bi-check2-square' : 'bi bi-square'}
                  tooltip={operationalBriefComplete ? 'Mark command brief as pending' : 'Mark command brief as complete'}
                  ariaLabel={operationalBriefComplete ? 'Mark command brief as pending' : 'Mark command brief as complete'}
                  onClick={() => setOperationalBriefComplete((current) => !current)}
                  variant="outline-secondary"
                />
              </ListGroup.Item>
              <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
                <span>Resource routing synchronized</span>
                <IconActionButton
                  iconClassName={resourceSyncComplete ? 'bi bi-check2-square' : 'bi bi-square'}
                  tooltip={resourceSyncComplete ? 'Mark resource routing sync as pending' : 'Mark resource routing sync as complete'}
                  ariaLabel={resourceSyncComplete ? 'Mark resource routing sync as pending' : 'Mark resource routing sync as complete'}
                  onClick={() => setResourceSyncComplete((current) => !current)}
                  variant="outline-secondary"
                />
              </ListGroup.Item>
              <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
                <span>Communications cadence confirmed</span>
                <IconActionButton
                  iconClassName={commsCadenceComplete ? 'bi bi-check2-square' : 'bi bi-square'}
                  tooltip={commsCadenceComplete ? 'Mark communications cadence as pending' : 'Mark communications cadence as complete'}
                  ariaLabel={commsCadenceComplete ? 'Mark communications cadence as pending' : 'Mark communications cadence as complete'}
                  onClick={() => setCommsCadenceComplete((current) => !current)}
                  variant="outline-secondary"
                />
              </ListGroup.Item>
            </ListGroup>
          </Card.Body>
        </Card>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">Operations workload profile</div>
            <div className="small">
              {operationsTrendData.map((item, index) => {
                const maxValue = Math.max(1, ...operationsTrendData.map((point) => point.value));
                const widthPercent = Math.round((item.value / maxValue) * 100);
                return (
                  <div key={item.metric} className="mb-2">
                    <div className="d-flex justify-content-between small text-muted">
                      <span>{item.metric}</span>
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
              <span>Operations command playbooks</span>
              <Badge bg={unresolvedDependencyCount > 0 ? 'warning' : 'secondary'}>
                Open blockers {unresolvedDependencyCount}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-1 mb-2">
              <Badge bg={operationalBriefComplete ? 'success' : 'secondary'}>
                Command brief {operationalBriefComplete ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={resourceSyncComplete ? 'success' : 'secondary'}>
                Resource sync {resourceSyncComplete ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={commsCadenceComplete ? 'success' : 'secondary'}>
                Comms cadence {commsCadenceComplete ? 'ready' : 'pending'}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-2">
              <IconActionButton
                iconClassName="bi bi-lightning"
                tooltip="Run surge playbook: activate assignment, routing, and communications directives"
                ariaLabel="Run surge playbook"
                onClick={handleSurgePlaybookClick}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-broadcast"
                tooltip="Run communications stabilization playbook"
                ariaLabel="Run communications stabilization playbook"
                onClick={handleCommsPlaybookClick}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-diagram-3"
                tooltip="Run dependency-focus playbook"
                ariaLabel="Run dependency-focus playbook"
                onClick={handleDependencyFocusPlaybookClick}
                variant="outline-secondary"
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
          title="Operations execution lane"
          items={operationsExecutionQueue}
          directives={executionDirectives}
          onDirectiveChange={handleDirectiveChange}
          enableDependencySequencing
        />

        <Row className="g-2 mb-2">
          <Col md={5}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Operations command mode" info="Choose whether operations execution is balanced, surge-prioritized, or communications-prioritized for the current incident tempo." /></Form.Label>
            <Form.Select size="sm" value={operationsMode} onChange={(event) => setOperationsMode(event.target.value as 'balanced' | 'surge' | 'communications')}>
              <option value="balanced">Balanced</option>
              <option value="surge">Surge Prioritized</option>
              <option value="communications">Communications Prioritized</option>
            </Form.Select>
          </Col>
          <Col md={7} className="d-flex align-items-end">
            <div className="small text-muted">{operationsGuidance}</div>
          </Col>
        </Row>

        <ListGroup variant="flush">
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Active incidents in operation</span>
            <strong>{activeIncidentCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident</span>
            <strong>{selectedIncidentLabel}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident open tasks</span>
            <strong>{selectedIncidentOpenTaskCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident resource requests</span>
            <strong>{selectedIncidentResourceRequestCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident communication entries</span>
            <strong>{selectedIncidentCommunicationCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident timeline events</span>
            <strong>{selectedIncidentTimelineCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Needs-attention signals</span>
            <strong>{needsAttentionReasonCount}</strong>
          </ListGroup.Item>
        </ListGroup>
      </Card.Body>
    </Card>
  );
}

export default OperationsCoordinationCard;
