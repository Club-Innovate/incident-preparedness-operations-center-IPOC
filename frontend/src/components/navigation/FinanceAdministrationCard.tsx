import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Form, ListGroup, ProgressBar, Row } from 'react-bootstrap';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import { getUserReportPresets, upsertUserReportPreset } from '../../api';
import type { NotifyHandler } from '../../notifications/types';
import { canManageFinanceModuleActions } from '../../security/authorization';
import ExecutionLaneBoard from './ExecutionLaneBoard';
import type { ExecutionDirective, ExecutionDirectiveStatus, ExecutionLaneSignalItem } from './ExecutionLaneBoard';
import {
  applyDirectivePatch,
  applyDirectivePatchBatch,
  countUnresolvedDependencies,
  resolveDependencyBlockers,
} from './executionDependencyUtils';

const NAV_FINANCE_PREDICTIVE_ENABLED = import.meta.env.VITE_IPOC_NAV_FINANCE_PREDICTIVE_ENABLED === 'true';

type FinanceAdministrationCardProps = {
  isAuthenticated: boolean;
  authRoles: string[];
  authScopes: string[];
  incidentCount: number;
  activeIncidentCount: number;
  selectedIncidentResourceRequestCount: number;
  selectedIncidentOpenTaskCount: number;
  onNotify: NotifyHandler;
};

function FinanceAdministrationCard({
  isAuthenticated,
  authRoles,
  authScopes,
  incidentCount,
  activeIncidentCount,
  selectedIncidentResourceRequestCount,
  selectedIncidentOpenTaskCount,
  onNotify,
}: FinanceAdministrationCardProps) {
  const NAV_FINANCE_SCOPE = 'navigation-finance-admin';
  const NAV_FINANCE_PRESET = 'default';
  const [costPacketReviewComplete, setCostPacketReviewComplete] = useState(false);
  const [procurementReviewComplete, setProcurementReviewComplete] = useState(false);
  const [adminFollowupComplete, setAdminFollowupComplete] = useState(false);
  const [financeCommandMode, setFinanceCommandMode] = useState<'cost-recovery' | 'procurement' | 'balanced'>('balanced');
  const [executionDirectives, setExecutionDirectives] = useState<ExecutionDirective[]>([]);

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
        const presets = await getUserReportPresets(NAV_FINANCE_SCOPE);
        const preset = presets.find((item) => item.presetName === NAV_FINANCE_PRESET) ?? presets[0] ?? null;
        if (!preset || !preset.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          costPacketReviewComplete?: boolean;
          procurementReviewComplete?: boolean;
          adminFollowupComplete?: boolean;
          executionDirectives?: unknown;
        };

        setCostPacketReviewComplete(Boolean(parsed.costPacketReviewComplete));
        setProcurementReviewComplete(Boolean(parsed.procurementReviewComplete));
        setAdminFollowupComplete(Boolean(parsed.adminFollowupComplete));
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
      void upsertUserReportPreset(NAV_FINANCE_SCOPE, {
        presetName: NAV_FINANCE_PRESET,
        presetJson: JSON.stringify({
          costPacketReviewComplete,
          procurementReviewComplete,
          adminFollowupComplete,
          executionDirectives,
        }),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [NAV_FINANCE_PRESET, NAV_FINANCE_SCOPE, adminFollowupComplete, costPacketReviewComplete, executionDirectives, isAuthenticated, procurementReviewComplete]);

  useEffect(() => {
    const persisted = localStorage.getItem('ipoc.nav.finance.checkpoints');
    if (!persisted) {
      return;
    }

    try {
      const parsed = JSON.parse(persisted) as {
        costPacketReviewComplete?: boolean;
        procurementReviewComplete?: boolean;
        adminFollowupComplete?: boolean;
        executionDirectives?: unknown;
      };

      setCostPacketReviewComplete(Boolean(parsed.costPacketReviewComplete));
      setProcurementReviewComplete(Boolean(parsed.procurementReviewComplete));
      setAdminFollowupComplete(Boolean(parsed.adminFollowupComplete));
      setExecutionDirectives(parseExecutionDirectives(parsed.executionDirectives));
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ipoc.nav.finance.checkpoints', JSON.stringify({
      costPacketReviewComplete,
      procurementReviewComplete,
      adminFollowupComplete,
      executionDirectives,
    }));
  }, [adminFollowupComplete, costPacketReviewComplete, executionDirectives, procurementReviewComplete]);

  const reimbursementReadinessScore = Math.max(0,
    (activeIncidentCount * 2)
    + selectedIncidentResourceRequestCount
    + Math.floor(selectedIncidentOpenTaskCount / 2),
  );

  const readinessVariant = reimbursementReadinessScore > 20
    ? 'info'
    : reimbursementReadinessScore > 8
      ? 'secondary'
      : 'success';

  const checklistCompletionCount = [costPacketReviewComplete, procurementReviewComplete, adminFollowupComplete]
    .filter((item) => item)
    .length;

  const checklistProgressPercent = Math.round((checklistCompletionCount / 3) * 100);
  const commandLoadScore = reimbursementReadinessScore + (checklistCompletionCount * 2);

  const workloadChartData = useMemo(() => ([
    { area: 'Active Incidents', value: activeIncidentCount },
    { area: 'Resource Requests', value: selectedIncidentResourceRequestCount },
    { area: 'Open Tasks', value: selectedIncidentOpenTaskCount },
    { area: 'Checklist Done', value: checklistCompletionCount },
  ]), [activeIncidentCount, checklistCompletionCount, selectedIncidentOpenTaskCount, selectedIncidentResourceRequestCount]);

  const financeExecutionQueue = useMemo<ExecutionLaneSignalItem[]>(() => {
    const reimbursementStatus = activeIncidentCount > 0
      ? 'in-progress'
      : 'planned';
    const procurementStatus = selectedIncidentResourceRequestCount > 0
      ? 'at-risk'
      : 'ready';
    const adminGovernanceStatus = checklistCompletionCount >= 2
      ? 'in-progress'
      : 'at-risk';
    const predictiveStatus = !NAV_FINANCE_PREDICTIVE_ENABLED
      ? 'backlog'
      : commandLoadScore >= 20
        ? 'planned'
        : 'backlog';

    return [
      {
        id: 'finance-fema-readiness',
        capability: 'FEMA reimbursement readiness lane',
        capabilityInfo: 'Tracks reimbursement packet readiness, supporting documentation traceability, and export-grade evidence posture for FEMA-aligned submissions.',
        rfpReference: 'Finance/Admin intake + F5 reporting evidence',
        signalStatus: reimbursementStatus,
        nextStep: reimbursementStatus === 'planned'
          ? 'No active incident finance load. Keep reimbursement templates staged for rapid activation.'
          : 'Continue packet traceability and maintain export-ready reimbursement evidence.',
      },
      {
        id: 'finance-procurement-orchestration',
        capability: 'Procurement packet orchestration',
        capabilityInfo: 'Coordinates high-priority procurement packets, supplier documentation flow, and request-to-contract alignment for focused incident demand.',
        rfpReference: 'F2/F9 resource packet and configurable views parity',
        signalStatus: procurementStatus,
        nextStep: procurementStatus === 'at-risk'
          ? `Map ${selectedIncidentResourceRequestCount} focused request(s) to procurement packet checkpoints.`
          : 'Procurement queue is clear. Run quality checks on supplier/documentation metadata.',
      },
      {
        id: 'finance-governance-audit',
        capability: 'Admin governance and audit checkpoints',
        capabilityInfo: 'Monitors finance and administrative control gates so approvals, checklist progression, and audit evidence remain defensible and complete.',
        rfpReference: 'B9/E9 durable audit + admin controls',
        signalStatus: adminGovernanceStatus,
        nextStep: adminGovernanceStatus === 'at-risk'
          ? 'Advance finance/admin checklist gates to strengthen audit evidence posture.'
          : 'Checklist progression is healthy. Expand to role-based approval evidence.',
      },
      {
        id: 'finance-predictive-pressure',
        capability: 'Predictive cost-pressure signal pilot',
        rfpReference: 'Phase D differentiation',
        signalStatus: predictiveStatus,
        nextStep: !NAV_FINANCE_PREDICTIVE_ENABLED
          ? 'Predictive cost-pressure controls are disabled by feature flag in this environment.'
          : predictiveStatus === 'backlog'
          ? 'Command load is low; keep predictive cost model in backlog discovery.'
          : 'Promote cost-pressure forecasting with confidence markers and approval routing.',
      },
    ];
  }, [activeIncidentCount, checklistCompletionCount, commandLoadScore, selectedIncidentResourceRequestCount]);

  const handleDirectiveChange = (id: string, patch: Partial<ExecutionDirective>) => {
    setExecutionDirectives((current) => applyDirectivePatch(current, id, patch));
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  const runCostRecoveryPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'finance-fema-readiness', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'finance-procurement-orchestration', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'finance-fema-readiness' } },
      { id: 'finance-governance-audit', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'finance-procurement-orchestration' } },
      { id: 'finance-predictive-pressure', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'finance-governance-audit' } },
    ]));
  };

  const runProcurementAccelerationPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'finance-fema-readiness', patch: { status: 'completed', blockedByDirectiveId: '' } },
      { id: 'finance-procurement-orchestration', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'finance-governance-audit', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: 'finance-procurement-orchestration' } },
      { id: 'finance-predictive-pressure', patch: { status: 'planned', blockedByDirectiveId: 'finance-governance-audit' } },
    ]));
  };

  const runForecastPrepPlaybook = () => {
    setExecutionDirectives((current) => applyDirectivePatchBatch(current, [
      { id: 'finance-governance-audit', patch: { status: 'in-progress', dueDate: todayIso, blockedByDirectiveId: '' } },
      { id: 'finance-predictive-pressure', patch: { status: 'planned', dueDate: todayIso, blockedByDirectiveId: 'finance-governance-audit' } },
    ]));
  };

  const unresolvedDependencyCount = useMemo(() => countUnresolvedDependencies(executionDirectives), [executionDirectives]);

  const canRunCostRecoveryPlaybook = costPacketReviewComplete;
  const canRunProcurementAccelerationPlaybook = procurementReviewComplete;
  const canRunForecastPrepPlaybook = adminFollowupComplete;

  const notifyPlaybookBlocked = (gate: string) => {
    onNotify(`Playbook blocked: ${gate}.`, 'warning');
  };

  const handleCostRecoveryPlaybookClick = () => {
    if (!canManageFinanceActions) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (!canRunCostRecoveryPlaybook) {
      notifyPlaybookBlocked('complete cost packet review checkpoint');
      return;
    }

    runCostRecoveryPlaybook();
  };

  const handleProcurementAccelerationPlaybookClick = () => {
    if (!canManageFinanceActions) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (!canRunProcurementAccelerationPlaybook) {
      notifyPlaybookBlocked('complete procurement checkpoint');
      return;
    }

    runProcurementAccelerationPlaybook();
  };

  const handleForecastPrepPlaybookClick = () => {
    if (!canManageFinanceActions) {
      notifyPlaybookBlocked('admin or commander access is required');
      return;
    }

    if (!NAV_FINANCE_PREDICTIVE_ENABLED) {
      notifyPlaybookBlocked('predictive cost-pressure feature flag is disabled');
      return;
    }

    if (!canRunForecastPrepPlaybook) {
      notifyPlaybookBlocked('complete administrative follow-up checkpoint');
      return;
    }

    runForecastPrepPlaybook();
  };

  const runResolveBlockersAssist = () => {
    setExecutionDirectives((current) => resolveDependencyBlockers(current));
  };

  const canManageFinanceActions = canManageFinanceModuleActions(isAuthenticated, authRoles, authScopes);

  return (
    <Card className="shadow-sm ipoc-mission-cockpit ipoc-finance-cockpit">
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <span className="pe-2">Finance & Administration Command Board</span>
        <span className="d-inline-flex gap-2">
          <IconActionButton
            iconClassName="bi bi-info-circle"
            tooltip="Finance/Admin workspace for reimbursement readiness, procurement cadence, governance checkpoints, and audit posture controls."
            ariaLabel="Finance and administration workspace information"
            onClick={() => undefined}
            variant="outline-secondary"
            size="sm"
          />
          <Badge bg="secondary">Data Scope Hybrid</Badge>
          <Badge bg={readinessVariant}>Workload {reimbursementReadinessScore}</Badge>
        </span>
      </Card.Header>
      <Card.Body>
        {!canManageFinanceActions && (
          <div className="small text-muted mb-2">Finance/Admin action controls require admin/commander access.</div>
        )}

        <Row className="g-3 mb-3">
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Checklist completion</div>
                <div className="fw-semibold fs-5">{checklistCompletionCount}/3</div>
                <ProgressBar now={checklistProgressPercent} variant={checklistProgressPercent < 40 ? 'info' : checklistProgressPercent < 80 ? 'secondary' : 'success'} className="mt-2" style={{ height: '0.5rem' }} />
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Command load score</div>
                <div className="fw-semibold fs-5">{commandLoadScore}</div>
                <div className="small text-muted mt-1">Reimbursement baseline {reimbursementReadinessScore}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 bg-body-tertiary ipoc-mission-kpi-card">
              <Card.Body className="py-2">
                <div className="small text-muted">Coverage posture</div>
                <div className="fw-semibold fs-5">{incidentCount === 0 ? 'No load' : `${Math.round((activeIncidentCount / Math.max(1, incidentCount)) * 100)}% active`}</div>
                <div className="small text-muted mt-1">Across monitored incidents</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card className="border-0 bg-body-tertiary mb-3 ipoc-mission-analytics-card">
          <Card.Body className="py-2">
            <div className="small fw-semibold mb-2">Finance/Admin workload profile</div>
            <div className="small">
              {workloadChartData.map((item, index) => {
                const maxValue = Math.max(1, ...workloadChartData.map((point) => point.value));
                const widthPercent = Math.round((item.value / maxValue) * 100);
                return (
                  <div key={item.area} className="mb-2">
                    <div className="d-flex justify-content-between small text-muted">
                      <span>{item.area}</span>
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
              <span>Finance/Admin action playbooks</span>
              <Badge bg={unresolvedDependencyCount > 0 ? 'warning' : 'secondary'}>
                Open blockers {unresolvedDependencyCount}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-1 mb-2">
              <Badge bg={costPacketReviewComplete ? 'success' : 'secondary'}>
                Cost packet {costPacketReviewComplete ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={procurementReviewComplete ? 'success' : 'secondary'}>
                Procurement checkpoint {procurementReviewComplete ? 'ready' : 'pending'}
              </Badge>
              <Badge bg={adminFollowupComplete ? 'success' : 'secondary'}>
                Admin follow-up {adminFollowupComplete ? 'ready' : 'pending'}
              </Badge>
            </div>
            <div className="d-inline-flex flex-wrap gap-2">
              <IconActionButton
                iconClassName="bi bi-receipt"
                tooltip="Run cost-recovery readiness playbook"
                ariaLabel="Run cost-recovery readiness playbook"
                onClick={handleCostRecoveryPlaybookClick}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-box-seam"
                tooltip="Run procurement acceleration playbook"
                ariaLabel="Run procurement acceleration playbook"
                onClick={handleProcurementAccelerationPlaybookClick}
                variant="outline-secondary"
              />
              <IconActionButton
                iconClassName="bi bi-graph-up-arrow"
                tooltip="Run predictive pressure preparation playbook"
                ariaLabel="Run predictive pressure preparation playbook"
                onClick={handleForecastPrepPlaybookClick}
                variant="outline-secondary"
                disabled={!canManageFinanceActions || !NAV_FINANCE_PREDICTIVE_ENABLED}
              />
              <IconActionButton
                iconClassName="bi bi-unlock"
                tooltip="Resolve blockers assist: close blocker directives and release dependent directives"
                ariaLabel="Resolve blockers assist"
                onClick={runResolveBlockersAssist}
                variant="outline-secondary"
                disabled={!canManageFinanceActions || unresolvedDependencyCount === 0}
              />
            </div>
            {!NAV_FINANCE_PREDICTIVE_ENABLED && (
              <div className="small text-muted mt-1">Predictive cost-pressure actions are disabled by feature flag for this environment.</div>
            )}
          </Card.Body>
        </Card>

        <ExecutionLaneBoard
          title="Finance execution lane"
          titleInfo="Command lane for sequencing FEMA readiness, procurement orchestration, governance checkpoints, and predictive pressure work in one dependency-aware board."
          items={financeExecutionQueue}
          directives={executionDirectives}
          onDirectiveChange={handleDirectiveChange}
          enableDependencySequencing
        />

        <Row className="g-2 mb-2">
          <Col md={5}>
            <Form.Label className="small text-muted mb-1"><LabelWithInfo text="Finance command mode" info="Set the finance/admin priority lane to balanced, cost-recovery, or procurement-focused execution." /></Form.Label>
            <Form.Select size="sm" value={financeCommandMode} onChange={(event) => setFinanceCommandMode(event.target.value as 'cost-recovery' | 'procurement' | 'balanced')}>
              <option value="balanced">Balanced</option>
              <option value="cost-recovery">Cost Recovery</option>
              <option value="procurement">Procurement Focus</option>
            </Form.Select>
          </Col>
        </Row>

        <ListGroup variant="flush">
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Total incidents</span>
            <strong>{incidentCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Active incidents</span>
            <strong>{activeIncidentCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident resource requests</span>
            <strong>{selectedIncidentResourceRequestCount}</strong>
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
            <span>Focused incident open tasks</span>
            <strong>{selectedIncidentOpenTaskCount}</strong>
          </ListGroup.Item>
        </ListGroup>

        <div className="small fw-semibold mt-3 mb-1">
          <LabelWithInfo
            text="Finance/Admin checkpoint actions"
            info="Operational checkpoint toggles used to unlock playbook gates and validate readiness across cost recovery, procurement packet review, and administrative follow-up."
          />
        </div>
        <ListGroup variant="flush">
          <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
            <span>Cost packet review checkpoint</span>
            <IconActionButton
              iconClassName={costPacketReviewComplete ? 'bi bi-check2-square' : 'bi bi-square'}
              tooltip={costPacketReviewComplete ? 'Mark cost packet review as pending' : 'Mark cost packet review as complete'}
              ariaLabel={costPacketReviewComplete ? 'Mark cost packet review as pending' : 'Mark cost packet review as complete'}
              onClick={() => setCostPacketReviewComplete((current) => !current)}
              variant="outline-secondary"
              disabled={!canManageFinanceActions}
            />
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
            <span>Procurement packet review checkpoint</span>
            <IconActionButton
              iconClassName={procurementReviewComplete ? 'bi bi-check2-square' : 'bi bi-square'}
              tooltip={procurementReviewComplete ? 'Mark procurement review as pending' : 'Mark procurement review as complete'}
              ariaLabel={procurementReviewComplete ? 'Mark procurement review as pending' : 'Mark procurement review as complete'}
              onClick={() => setProcurementReviewComplete((current) => !current)}
              variant="outline-secondary"
              disabled={!canManageFinanceActions}
            />
          </ListGroup.Item>
          <ListGroup.Item className="px-0 py-1 small d-flex align-items-center justify-content-between">
            <span>Administrative follow-up checkpoint</span>
            <IconActionButton
              iconClassName={adminFollowupComplete ? 'bi bi-check2-square' : 'bi bi-square'}
              tooltip={adminFollowupComplete ? 'Mark administrative follow-up as pending' : 'Mark administrative follow-up as complete'}
              ariaLabel={adminFollowupComplete ? 'Mark administrative follow-up as pending' : 'Mark administrative follow-up as complete'}
              onClick={() => setAdminFollowupComplete((current) => !current)}
              variant="outline-secondary"
              disabled={!canManageFinanceActions}
            />
          </ListGroup.Item>
        </ListGroup>
      </Card.Body>
    </Card>
  );
}

export default FinanceAdministrationCard;
