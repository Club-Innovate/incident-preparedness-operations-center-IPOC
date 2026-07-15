import { useState, useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
  Accordion,
  Badge,
  Card,
  Col,
  Form,
  Nav,
  Row,
  Spinner,
} from 'react-bootstrap';
import type {
  ActiveContact,
  ActiveUser,
  CommunicationRecipientRequest,
  Ics201Data,
  Ics202Data,
  Ics203Data,
  Ics204Data,
  Ics205Data,
  Ics209Data,
  Ics214Data,
  Ics215Data,
  IcsPosition,
  IncidentCommunication,
  IncidentResourceRequest,
  IncidentResourceLifecycleSummary,
  IncidentResourceLifecycleEvidencePackage,
  IncidentIapGovernanceEvidencePackage,
  ResourceRegionalRollupItem,
  IncidentCommandAssignment,
  IncidentDetail,
  IncidentTask,
  IncidentTimelineEvent,
  IncidentOperationalPeriod,
  IncidentObjective,
  IncidentOperationalInsight,
  UserReportPreset,
  NotificationRecipient,
  UpdateRecipientDeliveryStatusRequest,
  UpdateIncidentObjectiveRequest,
  UpdateIncidentOperationalPeriodRequest,
  LocationLookupValue,
  LookupValue,
  SituationReport,
  IncidentCommunicationLifecycleSummary,
  IncidentCommandTransferLogEntry,
} from '../../types';
import LabelWithInfo from '../common/LabelWithInfo';
import IconActionButton from '../common/IconActionButton';
import IpocDataGrid from '../common/IpocDataGrid';
import UserPickerModal from '../common/UserPickerModal';
import { ApiValidationError } from '../../api';

type IncidentCommandPaneCardProps = {
  isAuthenticated: boolean;
  selectedIncidentId: number | null;
  incidentDetail: IncidentDetail | null;
  incidentDetailLoading: boolean;
  incidentDetailError: string | null;
  incidentActionLoading: boolean;
  incidentEditName: string;
  incidentEditTypeCode: string;
  incidentEditSeverity: string;
  incidentEditPrimaryLocationId: string;
  incidentEditInitialSummary: string;
  incidentEditSituationSummary: string;
  incidentEditPlanned: boolean;
  locationLookups: LocationLookupValue[];
  incidentTypeLookups: LookupValue[];
  incidentSeverityLookups: LookupValue[];
  icsPositions: IcsPosition[];
  icsPositionsLoading: boolean;
  incidentCommandAssignments: IncidentCommandAssignment[];
  incidentCommandAssignmentsLoading: boolean;
  incidentTasks: IncidentTask[];
  incidentTasksLoading: boolean;
  taskTitleInput: string;
  taskDescriptionInput: string;
  taskPriorityInput: string;
  taskAssignedToUserIdInput: string;
  taskDueInput: string;
  taskPriorityLookups: LookupValue[];
  taskStatusLookups: LookupValue[];
  incidentTimelineEvents: IncidentTimelineEvent[];
  incidentTimelineLoading: boolean;
  timelineTypeInput: string;
  timelineTitleInput: string;
  timelineDescriptionInput: string;
  timelineEventUtcInput: string;
  timelineEventTypeLookups: LookupValue[];
  resourceTypeLookups: LookupValue[];
  incidentOperationalPeriods: IncidentOperationalPeriod[];
  incidentOperationalPeriodsLoading: boolean;
  operationalPeriodNumberInput: string;
  operationalPeriodNameInput: string;
  operationalPeriodStartInput: string;
  operationalPeriodEndInput: string;
  operationalPeriodStatusInput: string;
  operationalPeriodPlanningMeetingInput: string;
  incidentObjectives: IncidentObjective[];
  incidentObjectivesLoading: boolean;
  objectiveOperationalPeriodIdInput: string;
  objectiveNumberInput: string;
  objectiveTextInput: string;
  objectivePriorityInput: string;
  objectiveStatusInput: string;
  objectiveOwnerUserIdInput: string;
  objectiveDueInput: string;
  operationalInsight?: IncidentOperationalInsight;
  setIncidentEditName: (value: string) => void;
  setIncidentEditTypeCode: (value: string) => void;
  setIncidentEditSeverity: (value: string) => void;
  setIncidentEditPrimaryLocationId: (value: string) => void;
  setIncidentEditInitialSummary: (value: string) => void;
  setIncidentEditSituationSummary: (value: string) => void;
  setIncidentEditPlanned: (value: boolean) => void;
  setTaskTitleInput: (value: string) => void;
  setTaskDescriptionInput: (value: string) => void;
  setTaskPriorityInput: (value: string) => void;
  setTaskAssignedToUserIdInput: (value: string) => void;
  setTaskDueInput: (value: string) => void;
  setTimelineTypeInput: (value: string) => void;
  setTimelineTitleInput: (value: string) => void;
  setTimelineDescriptionInput: (value: string) => void;
  setTimelineEventUtcInput: (value: string) => void;
  setOperationalPeriodNumberInput: (value: string) => void;
  setOperationalPeriodNameInput: (value: string) => void;
  setOperationalPeriodStartInput: (value: string) => void;
  setOperationalPeriodEndInput: (value: string) => void;
  setOperationalPeriodStatusInput: (value: string) => void;
  setOperationalPeriodPlanningMeetingInput: (value: string) => void;
  setObjectiveOperationalPeriodIdInput: (value: string) => void;
  setObjectiveNumberInput: (value: string) => void;
  setObjectiveTextInput: (value: string) => void;
  setObjectivePriorityInput: (value: string) => void;
  setObjectiveStatusInput: (value: string) => void;
  setObjectiveOwnerUserIdInput: (value: string) => void;
  setObjectiveDueInput: (value: string) => void;
  onSaveIncidentMetadata: () => void;
  onCreateIncidentTask: () => void;
  onUpdateIncidentTaskStatus: (incidentTaskId: number, statusCode: string) => void;
  onUpdateIncidentTaskAssignment: (incidentTaskId: number, assignedToUserId: number | null) => void;
  onCreateIncidentTimelineEvent: () => void;
  onCreateOperationalPeriod: () => void;
  onApproveOperationalPeriod: (operationalPeriodId: number) => Promise<boolean>;
  onReopenOperationalPeriod: (operationalPeriodId: number) => Promise<boolean>;
  onCreateObjective: () => void;
  onUpdateOperationalPeriod: (operationalPeriodId: number, request: UpdateIncidentOperationalPeriodRequest) => Promise<boolean>;
  onUpdateObjective: (incidentObjectiveId: number, request: UpdateIncidentObjectiveRequest) => Promise<boolean>;
  onActivateIncident: () => void;
  onCloseIncident: () => void;
  onAssignCommandPosition: (icsPositionId: number, assignedUserId: number | null) => Promise<boolean>;
  onRemoveCommandAssignment: (icsPositionId: number) => void;
  onRefreshIcsPositions: () => void;
  onRefreshIncidentCommandAssignments: () => void;
  onOperationalDataChanged?: () => void;
  onNotify?: (message: string, variant: 'success' | 'danger' | 'warning' | 'info') => void;
};

type TransferQuickRangeKey = 'today' | 'last24h' | 'last7d';

type TransferFilterPreset = {
  id: string;
  name: string;
  statusFilter: string;
  sectionFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  userReportPresetId?: number;
};

const transferFilterPresetScope = 'incident-command-transfer-filter-presets-v1';
const transferFilterPresetLocalStorageKey = 'ipoc.incident.commandTransferFilterPresets.v1';

function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseTransferFilterPreset(record: UserReportPreset): TransferFilterPreset | null {
  try {
    const parsed = JSON.parse(record.presetJson) as {
      statusFilter?: string;
      sectionFilter?: string;
      dateFromFilter?: string;
      dateToFilter?: string;
    };

    return {
      id: `server-${record.userReportPresetId}`,
      name: record.presetName,
      statusFilter: parsed.statusFilter?.trim() || 'All',
      sectionFilter: parsed.sectionFilter?.trim() || 'All',
      dateFromFilter: parsed.dateFromFilter?.trim() || '',
      dateToFilter: parsed.dateToFilter?.trim() || '',
      userReportPresetId: record.userReportPresetId,
    };
  } catch {
    return null;
  }
}

type IncidentCommandTransferLogGridRow = {
  id: string;
  transferUtc: string;
  icsSection: string;
  positionName: string;
  assignedTo: string;
  commandPost: string;
  transferSummary: string;
  statusCode: string;
  transferDateUtc: string;
};

type IapCycleStatusRow = {
  id: string;
  stage: string;
  status: 'Complete' | 'In Progress' | 'Pending';
  evidence: string;
};

type TabKey = 'overview' | 'tasks' | 'timeline' | 'periods' | 'resources' | 'communications' | 'sitrep';
type RemediationIntent = 'resource-open-unassigned' | 'resource-transition-coverage' | 'iap-approve-period' | 'iap-build-packet' | null;

type IcsCommandStructureGridRow = {
  id: string;
  icsPositionId: number;
  positionName: string;
  positionCode: string;
  icsSection: string;
  assignmentStatus: 'Assigned' | 'Vacant';
  assignedTo: string;
  assignedInitials: string;
  avatarBgColor: string;
  avatarTextColor: string;
  roleColorLegend: string;
  agency: string;
  notes: string;
};

function getInitialsFromDisplayName(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 'NA';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

function resolveIcsRoleAvatarColors(positionCode: string): { bgColor: string; textColor: string; legend: string } {
  const normalized = normalizePositionKey(positionCode);
  if (normalized === 'IC') {
    return { bgColor: '#9fd6b6', textColor: '#1f3d2b', legend: 'Incident Commander (green)' };
  }

  if (normalized.startsWith('SO')) {
    return { bgColor: '#e8a3ad', textColor: '#4a1d24', legend: 'Safety Officer (red)' };
  }

  if (normalized.startsWith('OPS')) {
    return { bgColor: '#f2c29f', textColor: '#5a3418', legend: 'Operations Section Chief (orange)' };
  }

  if (normalized.startsWith('PLN')) {
    return { bgColor: '#9ed9e8', textColor: '#1d3e49', legend: 'Planning Section Chief (blue)' };
  }

  if (normalized.startsWith('LOG')) {
    return { bgColor: '#cbb6f2', textColor: '#372257', legend: 'Logistics Section Chief (violet)' };
  }

  if (normalized.startsWith('FIN') || normalized.startsWith('ADM')) {
    return { bgColor: '#d7dbe2', textColor: '#333840', legend: 'Finance/Admin Section Chief (gray)' };
  }

  return { bgColor: '#c6d0dc', textColor: '#253241', legend: 'General ICS assignment' };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function normalizePositionKey(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

function priorityVariant(code: string): string {
  switch (code.toLowerCase()) {
    case 'critical': return 'danger';
    case 'high': return 'danger';
    case 'normal': return 'primary';
    case 'low': return 'secondary';
    default: return 'secondary';
  }
}

function toDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const local = new Date(parsed.getTime() - (parsed.getTimezoneOffset() * 60_000));
  return local.toISOString().slice(0, 16);
}

function statusVariant(code: string): string {
  switch (code.toLowerCase()) {
    case 'active': return 'success';
    case 'planned': return 'primary';
    case 'inprogress': return 'info';
    case 'completed': return 'success';
    case 'closed': return 'secondary';
    case 'cancelled': return 'danger';
    case 'needsfollowup': return 'warning';
    case 'escalated': return 'danger';
    case 'draft': return 'light';
    default: return 'secondary';
  }
}

function severityVariant(code: string): string {
  switch (code.toLowerCase()) {
    case 'catastrophic': return 'danger';
    case 'critical': return 'danger';
    case 'major': return 'danger';
    case 'moderate': return 'info';
    case 'minor': return 'info';
    default: return 'secondary';
  }
}

function IncidentCommandPaneCard({
  isAuthenticated,
  selectedIncidentId,
  incidentDetail,
  incidentDetailLoading,
  incidentDetailError,
  incidentActionLoading,
  incidentEditName,
  incidentEditTypeCode,
  incidentEditSeverity,
  incidentEditPrimaryLocationId,
  incidentEditInitialSummary,
  incidentEditSituationSummary,
  incidentEditPlanned,
  locationLookups,
  incidentTypeLookups,
  incidentSeverityLookups,
  icsPositions,
  icsPositionsLoading,
  incidentCommandAssignments,
  incidentCommandAssignmentsLoading,
  incidentTasks,
  incidentTasksLoading,
  taskTitleInput,
  taskDescriptionInput,
  taskPriorityInput,
  taskAssignedToUserIdInput,
  taskDueInput,
  taskPriorityLookups,
  taskStatusLookups,
  incidentTimelineEvents,
  incidentTimelineLoading,
  timelineTypeInput,
  timelineTitleInput,
  timelineDescriptionInput,
  timelineEventUtcInput,
  timelineEventTypeLookups,
  resourceTypeLookups,
  incidentOperationalPeriods,
  incidentOperationalPeriodsLoading,
  operationalPeriodNumberInput,
  operationalPeriodNameInput,
  operationalPeriodStartInput,
  operationalPeriodEndInput,
  operationalPeriodStatusInput,
  operationalPeriodPlanningMeetingInput,
  incidentObjectives,
  incidentObjectivesLoading,
  objectiveOperationalPeriodIdInput,
  objectiveNumberInput,
  objectiveTextInput,
  objectivePriorityInput,
  objectiveStatusInput,
  objectiveOwnerUserIdInput,
  objectiveDueInput,
  operationalInsight,
  setIncidentEditName,
  setIncidentEditTypeCode,
  setIncidentEditSeverity,
  setIncidentEditPrimaryLocationId,
  setIncidentEditInitialSummary,
  setIncidentEditSituationSummary,
  setIncidentEditPlanned,
  setTaskTitleInput,
  setTaskDescriptionInput,
  setTaskPriorityInput,
  setTaskAssignedToUserIdInput,
  setTaskDueInput,
  setTimelineTypeInput,
  setTimelineTitleInput,
  setTimelineDescriptionInput,
  setTimelineEventUtcInput,
  setOperationalPeriodNumberInput,
  setOperationalPeriodNameInput,
  setOperationalPeriodStartInput,
  setOperationalPeriodEndInput,
  setOperationalPeriodStatusInput,
  setOperationalPeriodPlanningMeetingInput,
  setObjectiveOperationalPeriodIdInput,
  setObjectiveNumberInput,
  setObjectiveTextInput,
  setObjectivePriorityInput,
  setObjectiveStatusInput,
  setObjectiveOwnerUserIdInput,
  setObjectiveDueInput,
  onSaveIncidentMetadata,
  onCreateIncidentTask,
  onUpdateIncidentTaskStatus,
  onUpdateIncidentTaskAssignment,
  onCreateIncidentTimelineEvent,
  onCreateOperationalPeriod,
  onApproveOperationalPeriod,
  onReopenOperationalPeriod,
  onCreateObjective,
  onUpdateOperationalPeriod,
  onUpdateObjective,
  onActivateIncident,
  onCloseIncident,
  onAssignCommandPosition,
  onRemoveCommandAssignment,
  onRefreshIcsPositions,
  onRefreshIncidentCommandAssignments,
  onOperationalDataChanged,
  onNotify,
}: IncidentCommandPaneCardProps) {
  const formatDelta = (value: number) => (value > 0 ? `+${value}` : `${value}`);

  const isTaskTitleValid = taskTitleInput.trim().length > 0;
  const isTimelineTypeValid = timelineTypeInput.trim().length > 0;
  const isTimelineTitleValid = timelineTitleInput.trim().length > 0;
  const isOperationalPeriodNumberValid =
    operationalPeriodNumberInput.trim().length > 0
    && !Number.isNaN(Number(operationalPeriodNumberInput))
    && Number(operationalPeriodNumberInput) > 0;
  const hasOperationalPeriodWindow =
    operationalPeriodStartInput.trim().length > 0 && operationalPeriodEndInput.trim().length > 0;
  const isOperationalPeriodWindowOrderValid = hasOperationalPeriodWindow
    ? new Date(operationalPeriodEndInput).getTime() > new Date(operationalPeriodStartInput).getTime()
    : true;
  const isOperationalPeriodStatusValid = operationalPeriodStatusInput.trim().length > 0;
  const isObjectiveNumberValid =
    objectiveNumberInput.trim().length > 0
    && !Number.isNaN(Number(objectiveNumberInput))
    && Number(objectiveNumberInput) > 0;
  const isObjectiveTextValid = objectiveTextInput.trim().length > 0;
  const isObjectivePriorityValid = objectivePriorityInput.trim().length > 0;
  const isObjectiveStatusValid = objectiveStatusInput.trim().length > 0;
  const operationalPeriodActionTooltip = incidentActionLoading
    ? 'Saving operational period...'
    : !isOperationalPeriodNumberValid
      ? 'Period # is required and must be greater than zero.'
      : !hasOperationalPeriodWindow
        ? 'Start and End are required.'
        : !isOperationalPeriodWindowOrderValid
          ? 'End must be later than Start.'
          : !isOperationalPeriodStatusValid
            ? 'Status is required.'
            : 'Create operational period using period number, start/end window, and status.';
  const objectiveActionTooltip = incidentActionLoading
    ? 'Saving objective...'
    : !isObjectiveNumberValid
      ? 'Objective # is required and must be greater than zero.'
      : !isObjectiveTextValid
        ? 'Objective Text is required.'
        : !isObjectivePriorityValid
          ? 'Priority is required.'
          : !isObjectiveStatusValid
            ? 'Status is required.'
            : 'Create objective with period linkage, priority, owner, and execution status.';
  const operationalPeriodValidationHint = !isOperationalPeriodNumberValid
    ? 'Period # must be greater than zero.'
    : !hasOperationalPeriodWindow
      ? 'Start and End are required.'
      : !isOperationalPeriodWindowOrderValid
        ? 'End must be later than Start.'
        : !isOperationalPeriodStatusValid
          ? 'Status is required.'
          : null;

  const objectiveValidationHint = !isObjectiveNumberValid
    ? 'Objective # must be greater than zero.'
    : !isObjectiveTextValid
      ? 'Objective Text is required.'
      : !isObjectivePriorityValid
        ? 'Priority is required.'
        : !isObjectiveStatusValid
          ? 'Status is required.'
          : null;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [activeRemediationIntent, setActiveRemediationIntent] = useState<RemediationIntent>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [selectedPositionForAssignment, setSelectedPositionForAssignment] = useState<number | null>(null);
  const [optimisticAssignedUsers, setOptimisticAssignedUsers] = useState<Record<number, string>>({});
  const [taskAssignableUsers, setTaskAssignableUsers] = useState<ActiveUser[]>([]);
  const [activeContacts, setActiveContacts] = useState<ActiveContact[]>([]);
  const [taskAssignableUsersLoading, setTaskAssignableUsersLoading] = useState(false);
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [icsAutoRefreshAttempted, setIcsAutoRefreshAttempted] = useState(false);
  const [assignmentAutoRefreshAttempted, setAssignmentAutoRefreshAttempted] = useState(false);
  const [isIcsCommandStructureExpanded, setIsIcsCommandStructureExpanded] = useState(true);
  const [commandTransferLogRows, setCommandTransferLogRows] = useState<IncidentCommandTransferLogEntry[]>([]);
  const [commandTransferLogLoading, setCommandTransferLogLoading] = useState(false);
  const [transferPositionIdInput, setTransferPositionIdInput] = useState('');
  const [transferAssignedUserIdInput, setTransferAssignedUserIdInput] = useState('');
  const [transferSummaryInput, setTransferSummaryInput] = useState('');
  const [transferCommandPostLocationInput, setTransferCommandPostLocationInput] = useState('');
  const [transferStatusFilter, setTransferStatusFilter] = useState('All');
  const [transferSectionFilter, setTransferSectionFilter] = useState('All');
  const [transferDateFromFilter, setTransferDateFromFilter] = useState('');
  const [transferDateToFilter, setTransferDateToFilter] = useState('');
  const [transferFilterPresetNameInput, setTransferFilterPresetNameInput] = useState('');
  const [transferFilterPresets, setTransferFilterPresets] = useState<TransferFilterPreset[]>(() => {
    const raw = localStorage.getItem(transferFilterPresetLocalStorageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as TransferFilterPreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [editingOperationalPeriodId, setEditingOperationalPeriodId] = useState<number | null>(null);
  const [editingOperationalPeriodNumberInput, setEditingOperationalPeriodNumberInput] = useState('');
  const [editingOperationalPeriodNameInput, setEditingOperationalPeriodNameInput] = useState('');
  const [editingOperationalPeriodStartInput, setEditingOperationalPeriodStartInput] = useState('');
  const [editingOperationalPeriodEndInput, setEditingOperationalPeriodEndInput] = useState('');
  const [editingOperationalPeriodStatusInput, setEditingOperationalPeriodStatusInput] = useState('Planned');
  const [editingOperationalPeriodPlanningMeetingInput, setEditingOperationalPeriodPlanningMeetingInput] = useState('');
  const [editingOperationalPeriodApprovedByUserIdInput, setEditingOperationalPeriodApprovedByUserIdInput] = useState('');
  const [editingOperationalPeriodApprovedUtcInput, setEditingOperationalPeriodApprovedUtcInput] = useState('');
  const [operationalPeriodEditValidationError, setOperationalPeriodEditValidationError] = useState<string | null>(null);
  const [savingOperationalPeriodEdit, setSavingOperationalPeriodEdit] = useState(false);
  const [editingObjectiveId, setEditingObjectiveId] = useState<number | null>(null);
  const [editingObjectivePeriodIdInput, setEditingObjectivePeriodIdInput] = useState('');
  const [editingObjectiveNumberInput, setEditingObjectiveNumberInput] = useState('');
  const [editingObjectiveTextInput, setEditingObjectiveTextInput] = useState('');
  const [editingObjectivePriorityInput, setEditingObjectivePriorityInput] = useState('Normal');
  const [editingObjectiveStatusInput, setEditingObjectiveStatusInput] = useState('Open');
  const [editingObjectiveOwnerUserIdInput, setEditingObjectiveOwnerUserIdInput] = useState('');
  const [editingObjectiveDueInput, setEditingObjectiveDueInput] = useState('');
  const [objectiveEditValidationError, setObjectiveEditValidationError] = useState<string | null>(null);
  const [savingObjectiveEdit, setSavingObjectiveEdit] = useState(false);

  const loadCommandTransferLog = async () => {
    if (!selectedIncidentId) {
      setCommandTransferLogRows([]);
      return;
    }

    setCommandTransferLogLoading(true);
    try {
      const api = await import('../../api');
      const rows = await api.getIncidentCommandTransferLog(selectedIncidentId);
      setCommandTransferLogRows(rows);
    } catch (error) {
      console.error('Failed to load command transfer log:', error);
      onNotify?.(error instanceof Error ? error.message : 'Failed to load command transfer log.', 'danger');
    } finally {
      setCommandTransferLogLoading(false);
    }
  };

  const transferPositionOptions = useMemo(() => (
    icsPositions
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((position) => ({
        value: String(position.icsPositionId),
        label: `${position.positionCode} · ${position.positionName}`,
      }))
  ), [icsPositions]);

  const transferUserOptions = useMemo(() => (
    taskAssignableUsers
      .slice()
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((user) => ({
        value: String(user.userId),
        label: user.organizationName ? `${user.displayName} (${user.organizationName})` : user.displayName,
      }))
  ), [taskAssignableUsers]);

  const handleCreateCommandTransferLog = async () => {
    if (!selectedIncidentId) {
      onNotify?.('Select an incident before logging command transfer.', 'warning');
      return;
    }

    const positionId = Number(transferPositionIdInput);
    const userId = Number(transferAssignedUserIdInput);

    if (!Number.isFinite(positionId) || positionId <= 0) {
      onNotify?.('ICS position is required for transfer logging.', 'warning');
      return;
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      onNotify?.('Assigned user is required for transfer logging.', 'warning');
      return;
    }

    try {
      const api = await import('../../api');
      await api.createIncidentCommandTransferLog(selectedIncidentId, {
        icsPositionId: positionId,
        assignedUserId: userId,
        transferSummary: transferSummaryInput.trim() || undefined,
        commandPostLocation: transferCommandPostLocationInput.trim() || undefined,
      });

      setTransferSummaryInput('');
      setTransferCommandPostLocationInput('');
      await Promise.all([loadCommandTransferLog(), onRefreshIncidentCommandAssignments()]);
      onNotify?.('Command transfer log entry added.', 'success');
    } catch (error) {
      console.error('Failed to create command transfer log entry:', error);
      onNotify?.(error instanceof Error ? error.message : 'Failed to create command transfer log entry.', 'danger');
    }
  };

  const beginOperationalPeriodEdit = (period: IncidentOperationalPeriod) => {
    setOperationalPeriodEditValidationError(null);
    setEditingOperationalPeriodId(period.operationalPeriodId);
    setEditingOperationalPeriodNumberInput(String(period.periodNumber));
    setEditingOperationalPeriodNameInput(period.periodName ?? '');
    setEditingOperationalPeriodStartInput(toDateTimeLocalInput(period.startUtc));
    setEditingOperationalPeriodEndInput(toDateTimeLocalInput(period.endUtc));
    setEditingOperationalPeriodStatusInput(period.statusCode);
    setEditingOperationalPeriodPlanningMeetingInput(toDateTimeLocalInput(period.planningMeetingUtc));
    setEditingOperationalPeriodApprovedByUserIdInput(period.approvedByUserId ? String(period.approvedByUserId) : '');
    setEditingOperationalPeriodApprovedUtcInput(toDateTimeLocalInput(period.approvedUtc));
  };

  const handleSetCommunicationCoordinationStatus = (item: IncidentCommunication, statusCode: 'NeedsFollowUp' | 'Escalated') => {
    if (!selectedIncidentId) {
      return;
    }

    setCommunicationsLoading(true);
    import('../../api')
      .then((api) => api.updateIncidentCommunication(selectedIncidentId, item.incidentCommunicationId, {
        channelCode: item.channelCode,
        directionCode: item.directionCode,
        subject: item.subject,
        message: item.message,
        statusCode,
      }))
      .then(() => Promise.all([reloadCommunications(), reloadCommunicationLifecycleSummary()]))
      .then(() => {
        onNotify?.(`Communication marked as ${statusCode}.`, statusCode === 'Escalated' ? 'warning' : 'info');
      })
      .catch((error) => {
        console.error(`Failed to set communication status ${statusCode}:`, error);
        onNotify?.(error instanceof Error ? error.message : `Failed to set communication status ${statusCode}.`, 'danger');
        setCommunicationsLoading(false);
      });
  };

  const handleExportResourceLifecycleEvidenceJson = () => {
    if (!selectedIncidentId) {
      return;
    }

    import('../../api')
      .then((api) => api.exportIncidentResourceLifecycleEvidenceJson(selectedIncidentId))
      .then((blob) => {
        downloadBlob(`incident-${selectedIncidentId}-resource-lifecycle-evidence.json`, blob);
        onNotify?.('Resource lifecycle evidence JSON exported.', 'success');
      })
      .catch((error) => {
        console.error('Failed to export resource lifecycle evidence JSON:', error);
        onNotify?.(error instanceof Error ? error.message : 'Failed to export resource lifecycle evidence JSON.', 'danger');
      });
  };

  const cancelOperationalPeriodEdit = () => {
    setOperationalPeriodEditValidationError(null);
    setEditingOperationalPeriodId(null);
    setEditingOperationalPeriodNumberInput('');
    setEditingOperationalPeriodNameInput('');
    setEditingOperationalPeriodStartInput('');
    setEditingOperationalPeriodEndInput('');
    setEditingOperationalPeriodStatusInput('Planned');
    setEditingOperationalPeriodPlanningMeetingInput('');
    setEditingOperationalPeriodApprovedByUserIdInput('');
    setEditingOperationalPeriodApprovedUtcInput('');
  };

  const saveOperationalPeriodEdit = async () => {
    if (savingOperationalPeriodEdit) {
      return;
    }

    if (editingOperationalPeriodId === null) {
      setOperationalPeriodEditValidationError('Select an operational period to edit.');
      return;
    }

    if (editingOperationalPeriodNumberInput.trim().length === 0
      || Number.isNaN(Number(editingOperationalPeriodNumberInput))
      || Number(editingOperationalPeriodNumberInput) <= 0) {
      setOperationalPeriodEditValidationError('Operational period number must be greater than zero.');
      return;
    }

    if (editingOperationalPeriodStartInput.trim().length === 0 || editingOperationalPeriodEndInput.trim().length === 0) {
      setOperationalPeriodEditValidationError('Operational period start and end are required.');
      return;
    }

    if (new Date(editingOperationalPeriodEndInput).getTime() <= new Date(editingOperationalPeriodStartInput).getTime()) {
      setOperationalPeriodEditValidationError('Operational period end must be later than start.');
      return;
    }

    if (editingOperationalPeriodStatusInput.trim().length === 0) {
      setOperationalPeriodEditValidationError('Operational period status is required.');
      return;
    }

    if (editingOperationalPeriodApprovedByUserIdInput.trim().length > 0 && Number.isNaN(Number(editingOperationalPeriodApprovedByUserIdInput))) {
      setOperationalPeriodEditValidationError('Approved User is invalid. Choose a valid user.');
      return;
    }

    const hasApprovedByUser = editingOperationalPeriodApprovedByUserIdInput.trim().length > 0;
    const hasApprovedUtc = editingOperationalPeriodApprovedUtcInput.trim().length > 0;
    const isApprovedStatus = editingOperationalPeriodStatusInput.trim().localeCompare('Approved', undefined, { sensitivity: 'accent' }) === 0;

    if (isApprovedStatus && (!hasApprovedByUser || !hasApprovedUtc)) {
      setOperationalPeriodEditValidationError('Approved status requires both Approved user and Approved UTC.');
      return;
    }

    if (!isApprovedStatus && (hasApprovedByUser || hasApprovedUtc)) {
      setOperationalPeriodEditValidationError('Approved user/UTC can only be set when status is Approved.');
      return;
    }

    setOperationalPeriodEditValidationError(null);

    try {
      setSavingOperationalPeriodEdit(true);
      const didSave = await onUpdateOperationalPeriod(editingOperationalPeriodId, {
        periodNumber: Number(editingOperationalPeriodNumberInput),
        periodName: editingOperationalPeriodNameInput.trim().length > 0 ? editingOperationalPeriodNameInput.trim() : undefined,
        startUtc: new Date(editingOperationalPeriodStartInput).toISOString(),
        endUtc: new Date(editingOperationalPeriodEndInput).toISOString(),
        statusCode: editingOperationalPeriodStatusInput,
        planningMeetingUtc: editingOperationalPeriodPlanningMeetingInput.trim().length > 0 ? new Date(editingOperationalPeriodPlanningMeetingInput).toISOString() : undefined,
        approvedByUserId: editingOperationalPeriodApprovedByUserIdInput.trim().length > 0 ? Number(editingOperationalPeriodApprovedByUserIdInput) : undefined,
        approvedUtc: editingOperationalPeriodApprovedUtcInput.trim().length > 0 ? new Date(editingOperationalPeriodApprovedUtcInput).toISOString() : undefined,
      });

      if (didSave) {
        cancelOperationalPeriodEdit();
      }
    } finally {
      setSavingOperationalPeriodEdit(false);
    }
  };

  const beginObjectiveEdit = (objective: IncidentObjective) => {
    setObjectiveEditValidationError(null);
    setEditingObjectiveId(objective.incidentObjectiveId);
    setEditingObjectivePeriodIdInput(objective.operationalPeriodId ? String(objective.operationalPeriodId) : '');
    setEditingObjectiveNumberInput(String(objective.objectiveNumber));
    setEditingObjectiveTextInput(objective.objectiveText);
    setEditingObjectivePriorityInput(objective.priorityCode);
    setEditingObjectiveStatusInput(objective.statusCode);
    setEditingObjectiveOwnerUserIdInput(objective.ownerUserId ? String(objective.ownerUserId) : '');
    setEditingObjectiveDueInput(toDateTimeLocalInput(objective.dueUtc));
  };

  const cancelObjectiveEdit = () => {
    setObjectiveEditValidationError(null);
    setEditingObjectiveId(null);
    setEditingObjectivePeriodIdInput('');
    setEditingObjectiveNumberInput('');
    setEditingObjectiveTextInput('');
    setEditingObjectivePriorityInput('Normal');
    setEditingObjectiveStatusInput('Open');
    setEditingObjectiveOwnerUserIdInput('');
    setEditingObjectiveDueInput('');
  };

  const saveObjectiveEdit = async () => {
    if (savingObjectiveEdit) {
      return;
    }

    if (editingObjectiveId === null) {
      setObjectiveEditValidationError('Select an objective to edit.');
      return;
    }

    if (editingObjectiveNumberInput.trim().length === 0
      || Number.isNaN(Number(editingObjectiveNumberInput))
      || Number(editingObjectiveNumberInput) <= 0) {
      setObjectiveEditValidationError('Objective number must be greater than zero.');
      return;
    }

    if (editingObjectiveTextInput.trim().length === 0
      || editingObjectivePriorityInput.trim().length === 0
      || editingObjectiveStatusInput.trim().length === 0) {
      setObjectiveEditValidationError('Objective text, priority, and status are required.');
      return;
    }

    if (editingObjectiveOwnerUserIdInput.trim().length > 0 && Number.isNaN(Number(editingObjectiveOwnerUserIdInput))) {
      setObjectiveEditValidationError('Objective owner is invalid. Choose a valid user.');
      return;
    }

    setObjectiveEditValidationError(null);

    try {
      setSavingObjectiveEdit(true);
      const didSave = await onUpdateObjective(editingObjectiveId, {
        operationalPeriodId: editingObjectivePeriodIdInput.trim().length > 0 ? Number(editingObjectivePeriodIdInput) : undefined,
        objectiveNumber: Number(editingObjectiveNumberInput),
        objectiveText: editingObjectiveTextInput.trim(),
        priorityCode: editingObjectivePriorityInput,
        statusCode: editingObjectiveStatusInput,
        ownerUserId: editingObjectiveOwnerUserIdInput.trim().length > 0 ? Number(editingObjectiveOwnerUserIdInput) : undefined,
        dueUtc: editingObjectiveDueInput.trim().length > 0 ? new Date(editingObjectiveDueInput).toISOString() : undefined,
      });

      if (didSave) {
        cancelObjectiveEdit();
      }
    } finally {
      setSavingObjectiveEdit(false);
    }
  };

  // SITREP / ICS-201 state
  const [ics201Data, setIcs201Data] = useState<Ics201Data | null>(null);
  const [ics201Loading, setIcs201Loading] = useState(false);
  const [ics201LoadAttempted, setIcs201LoadAttempted] = useState(false);
  const [ics201LoadError, setIcs201LoadError] = useState<string | null>(null);
  const [ics202Data, setIcs202Data] = useState<Ics202Data | null>(null);
  const [ics202Loading, setIcs202Loading] = useState(false);
  const [ics202LoadAttempted, setIcs202LoadAttempted] = useState(false);
  const [ics202LoadError, setIcs202LoadError] = useState<string | null>(null);
  const [ics203Data, setIcs203Data] = useState<Ics203Data | null>(null);
  const [ics203Loading, setIcs203Loading] = useState(false);
  const [ics203LoadAttempted, setIcs203LoadAttempted] = useState(false);
  const [ics203LoadError, setIcs203LoadError] = useState<string | null>(null);
  const [ics204Data, setIcs204Data] = useState<Ics204Data | null>(null);
  const [ics204Loading, setIcs204Loading] = useState(false);
  const [ics204LoadAttempted, setIcs204LoadAttempted] = useState(false);
  const [ics204LoadError, setIcs204LoadError] = useState<string | null>(null);
  const [ics205Data, setIcs205Data] = useState<Ics205Data | null>(null);
  const [ics205Loading, setIcs205Loading] = useState(false);
  const [ics205LoadAttempted, setIcs205LoadAttempted] = useState(false);
  const [ics205LoadError, setIcs205LoadError] = useState<string | null>(null);
  const [ics214Data, setIcs214Data] = useState<Ics214Data | null>(null);
  const [ics214Loading, setIcs214Loading] = useState(false);
  const [ics214LoadAttempted, setIcs214LoadAttempted] = useState(false);
  const [ics214LoadError, setIcs214LoadError] = useState<string | null>(null);
  const [ics215Data, setIcs215Data] = useState<Ics215Data | null>(null);
  const [ics215Loading, setIcs215Loading] = useState(false);
  const [ics215LoadAttempted, setIcs215LoadAttempted] = useState(false);
  const [ics215LoadError, setIcs215LoadError] = useState<string | null>(null);
  const [ics209Data, setIcs209Data] = useState<Ics209Data | null>(null);
  const [ics209Loading, setIcs209Loading] = useState(false);
  const [ics209LoadAttempted, setIcs209LoadAttempted] = useState(false);
  const [ics209LoadError, setIcs209LoadError] = useState<string | null>(null);
  const [situationReports, setSituationReports] = useState<SituationReport[]>([]);
  const [situationReportsLoading, setSituationReportsLoading] = useState(false);
  const [situationReportsLoadAttempted, setSituationReportsLoadAttempted] = useState(false);
  const [situationReportsLoadError, setSituationReportsLoadError] = useState<string | null>(null);
  const [showSitrepForm, setShowSitrepForm] = useState(false);
  const [sitrepSummary, setSitrepSummary] = useState('');
  const [sitrepCurrentActions, setSitrepCurrentActions] = useState('');
  const [sitrepPlannedActions, setSitrepPlannedActions] = useState('');
  const [sitrepUnmetNeeds, setSitrepUnmetNeeds] = useState('');
  const [sitrepOperationalPeriodId, setSitrepOperationalPeriodId] = useState<number | null>(null);
  const [iapGovernanceEvidencePackage, setIapGovernanceEvidencePackage] = useState<IncidentIapGovernanceEvidencePackage | null>(null);
  const [iapGovernanceEvidenceLoading, setIapGovernanceEvidenceLoading] = useState(false);
  const [iapGovernanceEvidenceError, setIapGovernanceEvidenceError] = useState<string | null>(null);

  const jumpToOperationalPeriodGovernance = () => {
    setActiveTab('periods');
    setOperationalPeriodStatusInput('Active');
    setActiveRemediationIntent('iap-approve-period');
    onNotify?.('Navigate: resolve IAP governance blockers in Operational Periods.', 'info');
  };

  const jumpToResourceRouting = (intent: Exclude<RemediationIntent, 'iap-approve-period' | 'iap-build-packet' | null>) => {
    setActiveTab('resources');
    setResourceQueueFocusOnly(true);
    setResourceQueueSortModeInput('LargestGap');
    setActiveRemediationIntent(intent);
    onNotify?.('Navigate: resolve lifecycle blockers in Resource routing lanes.', 'info');
  };

  const jumpToSituationReporting = () => {
    setActiveTab('sitrep');
    setShowSitrepForm(true);
    setActiveRemediationIntent('iap-build-packet');
    onNotify?.('Navigate: add SITREP evidence to clear retrospective blockers.', 'info');
  };

  const clearRemediationIntent = () => {
    setActiveRemediationIntent(null);
  };

  const [communications, setCommunications] = useState<IncidentCommunication[]>([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(false);
  const [communicationsLoadAttempted, setCommunicationsLoadAttempted] = useState(false);
  const [communicationsLoadError, setCommunicationsLoadError] = useState<string | null>(null);
  const [communicationChannelCode, setCommunicationChannelCode] = useState('Phone');
  const [communicationDirectionCode, setCommunicationDirectionCode] = useState('Inbound');
  const [communicationSubject, setCommunicationSubject] = useState('');
  const [communicationMessage, setCommunicationMessage] = useState('');
  const [editingCommunicationId, setEditingCommunicationId] = useState<number | null>(null);
  const [communicationNotifyEnabled, setCommunicationNotifyEnabled] = useState(true);
  const [notificationTypeCodeInput, setNotificationTypeCodeInput] = useState('INCIDENT_NOTIFICATION');
  const [notificationPriorityCodeInput, setNotificationPriorityCodeInput] = useState<'Low' | 'Normal' | 'High' | 'Critical'>('Normal');
  const [notificationChannelCodeInput, setNotificationChannelCodeInput] = useState<'EMAIL' | 'SMS' | 'VOICE' | 'PUSH'>('EMAIL');
  const [notificationDestinationAddressInput, setNotificationDestinationAddressInput] = useState('');
  const [notificationRecipientUserIdInput, setNotificationRecipientUserIdInput] = useState('');
  const [notificationRecipientContactIdInput, setNotificationRecipientContactIdInput] = useState('');
  const [notificationRecipientLocationIdInput, setNotificationRecipientLocationIdInput] = useState('');
  const [notificationBroadcastLocationIdsInput, setNotificationBroadcastLocationIdsInput] = useState<string[]>([]);
  const [notificationRecipientsDraft, setNotificationRecipientsDraft] = useState<CommunicationRecipientRequest[]>([]);
  const [communicationDispatchLoading, setCommunicationDispatchLoading] = useState(false);
  const [lastDispatchedNotificationId, setLastDispatchedNotificationId] = useState<number | null>(null);
  const [notificationRecipients, setNotificationRecipients] = useState<NotificationRecipient[]>([]);
  const [notificationRecipientsLoading, setNotificationRecipientsLoading] = useState(false);
  const [notificationRecipientStatusSelection, setNotificationRecipientStatusSelection] = useState<Record<number, UpdateRecipientDeliveryStatusRequest['deliveryStatusCode']>>({});
  const [notificationRecipientFailureReasonInput, setNotificationRecipientFailureReasonInput] = useState<Record<number, string>>({});
  const [notificationRecipientAckNoteInput, setNotificationRecipientAckNoteInput] = useState<Record<number, string>>({});
  const [escalationReasonInput, setEscalationReasonInput] = useState('');
  const [escalationChannelCodeInput, setEscalationChannelCodeInput] = useState<'EMAIL' | 'SMS' | 'VOICE' | 'PUSH'>('EMAIL');
  const [escalationDestinationAddressInput, setEscalationDestinationAddressInput] = useState('');
  const [communicationEscalationLoading, setCommunicationEscalationLoading] = useState(false);
  const [communicationStatusFilter, setCommunicationStatusFilter] = useState('All');
  const [communicationChannelFilter, setCommunicationChannelFilter] = useState('All');
  const [communicationDateFromFilter, setCommunicationDateFromFilter] = useState('');
  const [communicationDateToFilter, setCommunicationDateToFilter] = useState('');
  const [communicationLifecycleSummary, setCommunicationLifecycleSummary] = useState<IncidentCommunicationLifecycleSummary | null>(null);
  const [communicationLifecycleSummaryLoading, setCommunicationLifecycleSummaryLoading] = useState(false);
  const [communicationLifecycleSummaryError, setCommunicationLifecycleSummaryError] = useState<string | null>(null);

  const parsedNotificationRecipientUserId = Number.parseInt(notificationRecipientUserIdInput, 10);
  const parsedNotificationRecipientContactId = Number.parseInt(notificationRecipientContactIdInput, 10);
  const parsedNotificationRecipientLocationId = Number.parseInt(notificationRecipientLocationIdInput, 10);
  const hasNotificationRecipientUserId = Number.isFinite(parsedNotificationRecipientUserId) && parsedNotificationRecipientUserId > 0;
  const hasNotificationRecipientContactId = Number.isFinite(parsedNotificationRecipientContactId) && parsedNotificationRecipientContactId > 0;
  const hasNotificationRecipientLocationId = Number.isFinite(parsedNotificationRecipientLocationId) && parsedNotificationRecipientLocationId > 0;
  const isNotificationPrincipalSelected = hasNotificationRecipientUserId || hasNotificationRecipientContactId || hasNotificationRecipientLocationId;
  const isNotificationDraftRecipientValid = notificationDestinationAddressInput.trim().length > 0 && isNotificationPrincipalSelected;
  const effectiveNotificationRecipientCount = notificationRecipientsDraft.length + (isNotificationDraftRecipientValid ? 1 : 0);
  const requiresNotificationDispatchInputs = communicationNotifyEnabled && !editingCommunicationId;
  const isNotificationDispatchInputValid = !requiresNotificationDispatchInputs
    || (
      notificationTypeCodeInput.trim().length > 0
      && effectiveNotificationRecipientCount > 0
    );
  const communicationActionTooltip = incidentActionLoading
    ? 'Saving communication...'
    : communicationSubject.trim().length === 0
      ? 'Subject is required.'
      : communicationMessage.trim().length === 0
        ? 'Message is required.'
        : !isNotificationDispatchInputValid
          ? 'When Dispatch notification is enabled, provide Notification Type and at least one recipient with destination and principal (User, Contact, or Location).'
          : editingCommunicationId
            ? 'Save communication entry changes'
            : 'Add communication entry';

  const notificationDestinationPlaceholder = useMemo(() => {
    if (notificationChannelCodeInput === 'EMAIL') {
      return 'user@example.org';
    }

    if (notificationChannelCodeInput === 'SMS' || notificationChannelCodeInput === 'VOICE') {
      return '+15551234567';
    }

    return 'https://push.endpoint.example/device-token';
  }, [notificationChannelCodeInput]);

  const escalationDestinationPlaceholder = useMemo(() => {
    if (escalationChannelCodeInput === 'EMAIL') {
      return 'escalation@example.org';
    }

    if (escalationChannelCodeInput === 'SMS' || escalationChannelCodeInput === 'VOICE') {
      return '+15557654321';
    }

    return 'https://push.endpoint.example/device-token';
  }, [escalationChannelCodeInput]);

  const notificationLifecycleSummary = useMemo(() => {
    const summary = {
      total: 0,
      queued: 0,
      sent: 0,
      failed: 0,
      suppressed: 0,
      cancelled: 0,
      acknowledged: 0,
    };

    notificationRecipients.forEach((recipient) => {
      summary.total += 1;
      if (recipient.deliveryStatusCode === 'Queued') {
        summary.queued += 1;
      } else if (recipient.deliveryStatusCode === 'Sent') {
        summary.sent += 1;
      } else if (recipient.deliveryStatusCode === 'Failed') {
        summary.failed += 1;
      } else if (recipient.deliveryStatusCode === 'Suppressed') {
        summary.suppressed += 1;
      } else if (recipient.deliveryStatusCode === 'Cancelled') {
        summary.cancelled += 1;
      }

      if (recipient.acknowledgedUtc) {
        summary.acknowledged += 1;
      }
    });

    return summary;
  }, [notificationRecipients]);

  const communicationChannelLifecycle = useMemo(() => {
    if (!communicationLifecycleSummary) {
      return [] as Array<{
        code: 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH';
        recipients: number;
        sent: number;
        failed: number;
        successRateLabel: string;
      }>;
    }

    const channels: Array<{
      code: 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH';
      recipients: number;
      sent: number;
      failed: number;
    }> = [
      {
        code: 'EMAIL',
        recipients: communicationLifecycleSummary.emailRecipients,
        sent: communicationLifecycleSummary.emailSentRecipients,
        failed: communicationLifecycleSummary.emailFailedRecipients,
      },
      {
        code: 'SMS',
        recipients: communicationLifecycleSummary.smsRecipients,
        sent: communicationLifecycleSummary.smsSentRecipients,
        failed: communicationLifecycleSummary.smsFailedRecipients,
      },
      {
        code: 'VOICE',
        recipients: communicationLifecycleSummary.voiceRecipients,
        sent: communicationLifecycleSummary.voiceSentRecipients,
        failed: communicationLifecycleSummary.voiceFailedRecipients,
      },
      {
        code: 'PUSH',
        recipients: communicationLifecycleSummary.pushRecipients,
        sent: communicationLifecycleSummary.pushSentRecipients,
        failed: communicationLifecycleSummary.pushFailedRecipients,
      },
    ];

    return channels.map((channel) => {
      const successRateLabel = channel.recipients > 0
        ? `${Math.round((channel.sent / channel.recipients) * 100)}%`
        : 'N/A';

      return {
        ...channel,
        successRateLabel,
      };
    });
  }, [communicationLifecycleSummary]);

  const communicationSummaryFromUtcIso = useMemo(() => {
    if (!communicationDateFromFilter) {
      return undefined;
    }

    return `${communicationDateFromFilter}T00:00:00Z`;
  }, [communicationDateFromFilter]);

  const communicationSummaryToUtcIso = useMemo(() => {
    if (!communicationDateToFilter) {
      return undefined;
    }

    return `${communicationDateToFilter}T23:59:59.999Z`;
  }, [communicationDateToFilter]);

  const communicationStatusFilterOptions = useMemo(() => {
    const statuses = new Set<string>();
    communications.forEach((item) => statuses.add(item.statusCode));
    return ['All', ...Array.from(statuses).sort((a, b) => a.localeCompare(b))];
  }, [communications]);

  const communicationChannelFilterOptions = useMemo(() => {
    const channels = new Set<string>();
    communications.forEach((item) => channels.add(item.channelCode));
    return ['All', ...Array.from(channels).sort((a, b) => a.localeCompare(b))];
  }, [communications]);

  const filteredCommunications = useMemo(() => {
    const fromUtc = communicationDateFromFilter ? new Date(`${communicationDateFromFilter}T00:00:00`) : null;
    const toUtc = communicationDateToFilter ? new Date(`${communicationDateToFilter}T23:59:59.999`) : null;

    return communications.filter((item) => {
      const matchesStatus = communicationStatusFilter === 'All' || item.statusCode === communicationStatusFilter;
      const matchesChannel = communicationChannelFilter === 'All' || item.channelCode === communicationChannelFilter;
      const loggedUtc = new Date(item.loggedUtc);
      const matchesFrom = !fromUtc || loggedUtc >= fromUtc;
      const matchesTo = !toUtc || loggedUtc <= toUtc;
      return matchesStatus && matchesChannel && matchesFrom && matchesTo;
    });
  }, [communications, communicationStatusFilter, communicationChannelFilter, communicationDateFromFilter, communicationDateToFilter]);

  const [resourceRequests, setResourceRequests] = useState<IncidentResourceRequest[]>([]);
  const [resourceRequestsLoading, setResourceRequestsLoading] = useState(false);
  const [resourceRequestsLoadAttempted, setResourceRequestsLoadAttempted] = useState(false);
  const [resourceRequestsLoadError, setResourceRequestsLoadError] = useState<string | null>(null);
  const [resourceLifecycleSummary, setResourceLifecycleSummary] = useState<IncidentResourceLifecycleSummary | null>(null);
  const [resourceLifecycleSummaryLoading, setResourceLifecycleSummaryLoading] = useState(false);
  const [resourceLifecycleSummaryError, setResourceLifecycleSummaryError] = useState<string | null>(null);
  const [resourceLifecycleEvidencePackage, setResourceLifecycleEvidencePackage] = useState<IncidentResourceLifecycleEvidencePackage | null>(null);
  const [resourceLifecycleEvidenceLoading, setResourceLifecycleEvidenceLoading] = useState(false);
  const [resourceLifecycleEvidenceError, setResourceLifecycleEvidenceError] = useState<string | null>(null);
  const [resourceRegionalRollups, setResourceRegionalRollups] = useState<ResourceRegionalRollupItem[]>([]);
  const [resourceRollupLoading, setResourceRollupLoading] = useState(false);
  const [resourceRollupError, setResourceRollupError] = useState<string | null>(null);
  const [resourceTypeCodeInput, setResourceTypeCodeInput] = useState('General');
  const [resourceTypeNameInput, setResourceTypeNameInput] = useState('General Resource');
  const [resourceRequestedQuantityInput, setResourceRequestedQuantityInput] = useState('1');
  const [resourceAssignedQuantityInput, setResourceAssignedQuantityInput] = useState('');
  const [resourceUnitOfMeasureCodeInput, setResourceUnitOfMeasureCodeInput] = useState('Units');
  const [resourcePriorityCodeInput, setResourcePriorityCodeInput] = useState('Normal');
  const [resourceStatusCodeInput, setResourceStatusCodeInput] = useState('Requested');
  const [resourceNotesInput, setResourceNotesInput] = useState('');
  const [editingResourceRequestId, setEditingResourceRequestId] = useState<number | null>(null);
  const [resourceStatusFilter, setResourceStatusFilter] = useState('All');
  const [resourceQueueFocusOnly, setResourceQueueFocusOnly] = useState(false);
  const [resourceQueueSortModeInput, setResourceQueueSortModeInput] = useState('StatusPriorityAge');
  const [selectedResourceRequestIds, setSelectedResourceRequestIds] = useState<number[]>([]);
  const [resourceBulkStatusCodeInput, setResourceBulkStatusCodeInput] = useState('Approved');
  const [resourceBulkAssignmentModeInput, setResourceBulkAssignmentModeInput] = useState('AssignFull');
  const [resourceRowAssignedQuantityDrafts, setResourceRowAssignedQuantityDrafts] = useState<Record<number, string>>({});
  const [resourceRollupRegionFilter, setResourceRollupRegionFilter] = useState('All');
  const [resourceRollupRegionIdFilter, setResourceRollupRegionIdFilter] = useState('');
  const [resourceTypeSearchSuggestions, setResourceTypeSearchSuggestions] = useState<LookupValue[]>([]);
  const [resourceTypeSearchLoading, setResourceTypeSearchLoading] = useState(false);
  const [resourceTypeDropdownOpen, setResourceTypeDropdownOpen] = useState(false);
  const [resourceTypeHighlightedIndex, setResourceTypeHighlightedIndex] = useState(-1);
  const resourceTypeDropdownContainerRef = useRef<HTMLDivElement | null>(null);
  const resourceTypeDropdownItemRefs = useRef<Array<HTMLElement | null>>([]);

  const regionResourceRollups = useMemo(() => {
    return [...resourceRegionalRollups].sort((left, right) => left.regionName.localeCompare(right.regionName));
  }, [resourceRegionalRollups]);

  const availableRollupRegions = useMemo(() => {
    return ['All', ...Array.from(new Set(regionResourceRollups.map((item) => item.regionName))).sort((left, right) => left.localeCompare(right))];
  }, [regionResourceRollups]);

  const availableRollupRegionIds = useMemo(() => {
    const regions = new Map<string, string>();
    locationLookups.forEach((location) => {
      if (location.regionId && location.regionName) {
        regions.set(String(location.regionId), location.regionName);
      }
    });

    return Array.from(regions.entries())
      .map(([regionId, regionName]) => ({ regionId, regionName }))
      .sort((left, right) => left.regionName.localeCompare(right.regionName));
  }, [locationLookups]);

  const statewideResourceRollup = useMemo(() => {
    return regionResourceRollups.reduce((current, rollup) => ({
      resourceAvailable: current.resourceAvailable + rollup.resourceAvailable,
      resourceCommitted: current.resourceCommitted + rollup.resourceCommitted,
      resourceOutOfService: current.resourceOutOfService + rollup.resourceOutOfService,
      bedsAvailable: current.bedsAvailable + rollup.bedsAvailable,
      bedsOccupied: current.bedsOccupied + rollup.bedsOccupied,
      bedsUnavailable: current.bedsUnavailable + rollup.bedsUnavailable,
    }), {
      resourceAvailable: 0,
      resourceCommitted: 0,
      resourceOutOfService: 0,
      bedsAvailable: 0,
      bedsOccupied: 0,
      bedsUnavailable: 0,
    });
  }, [regionResourceRollups]);

  const resourceStatusTransitionMap = useMemo(() => ({
    Requested: ['Requested', 'Approved', 'Denied', 'Cancelled', 'Archived'],
    Approved: ['Approved', 'PartiallyFulfilled', 'Fulfilled', 'Denied', 'Cancelled', 'Archived'],
    PartiallyFulfilled: ['PartiallyFulfilled', 'Fulfilled', 'Cancelled', 'Archived'],
    Fulfilled: ['Fulfilled', 'Archived'],
    Denied: ['Denied', 'Archived'],
    Cancelled: ['Cancelled', 'Archived'],
    Archived: ['Archived', 'Requested'],
  }), []);

  const allowedResourceStatusOptions = useMemo(() => {
    if (!editingResourceRequestId) {
      return ['Requested', 'Approved', 'PartiallyFulfilled', 'Fulfilled', 'Denied', 'Cancelled', 'Archived'];
    }

    const currentStatus = resourceRequests.find((item) => item.incidentResourceRequestId === editingResourceRequestId)?.statusCode;
    if (!currentStatus) {
      return ['Requested', 'Approved', 'PartiallyFulfilled', 'Fulfilled', 'Denied', 'Cancelled', 'Archived'];
    }

    return resourceStatusTransitionMap[currentStatus as keyof typeof resourceStatusTransitionMap]
      ?? ['Requested', 'Approved', 'PartiallyFulfilled', 'Fulfilled', 'Denied', 'Cancelled', 'Archived'];
  }, [editingResourceRequestId, resourceRequests, resourceStatusTransitionMap]);

  const downloadCsv = (filename: string, csv: string): void => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reloadResourceRollups = () => {
    setResourceRollupLoading(true);
    setResourceRollupError(null);
    const parsedRegionId = Number.parseInt(resourceRollupRegionIdFilter, 10);
    const hasRegionIdFilter = Number.isFinite(parsedRegionId) && parsedRegionId > 0;
    const regionNameFilter = resourceRollupRegionFilter === 'All' ? undefined : resourceRollupRegionFilter;

    return import('../../api')
      .then((api) => api.getResourceRegionalRollups(hasRegionIdFilter ? parsedRegionId : undefined, hasRegionIdFilter ? undefined : regionNameFilter))
      .then((regionalRollups) => {
        setResourceRegionalRollups(regionalRollups);
        setResourceRollupLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load statewide/regional resource rollups:', error);
        setResourceRollupError(error instanceof Error ? error.message : 'Failed to load statewide/regional resource rollups.');
        setResourceRollupLoading(false);
      });
  };

  const handleRefreshResourceLifecycleEvidencePackage = () => {
    if (!selectedIncidentId) {
      return;
    }

    setResourceLifecycleEvidenceLoading(true);
    setResourceLifecycleEvidenceError(null);

    import('../../api')
      .then((api) => api.getIncidentResourceLifecycleEvidencePackage(selectedIncidentId))
      .then((payload) => {
        setResourceLifecycleEvidencePackage(payload);
        setResourceLifecycleEvidenceLoading(false);
        onNotify?.('Resource lifecycle evidence package refreshed.', 'success');
      })
      .catch((error) => {
        setResourceLifecycleEvidenceError(error instanceof Error ? error.message : 'Failed to load resource lifecycle evidence package.');
        setResourceLifecycleEvidenceLoading(false);
      });
  };

  const handleExportRegionalRollupsCsv = () => {
    const parsedRegionId = Number.parseInt(resourceRollupRegionIdFilter, 10);
    const hasRegionIdFilter = Number.isFinite(parsedRegionId) && parsedRegionId > 0;
    const regionNameFilter = resourceRollupRegionFilter === 'All' ? undefined : resourceRollupRegionFilter;

    import('../../api')
      .then((api) => api.exportResourceRegionalRollupsCsv(hasRegionIdFilter ? parsedRegionId : undefined, hasRegionIdFilter ? undefined : regionNameFilter))
      .then((blob) => {
        downloadBlob('resource-regional-rollup.csv', blob);
        onNotify?.('Regional rollup CSV exported.', 'success');
      })
      .catch((error) => {
        console.error('Failed to export regional rollup CSV:', error);
        onNotify?.(error instanceof Error ? error.message : 'Failed to export regional rollup CSV.', 'danger');
      });
  };

  const handleRefreshIapGovernanceEvidencePackage = () => {
    if (!selectedIncidentId) {
      return;
    }

    setIapGovernanceEvidenceLoading(true);
    setIapGovernanceEvidenceError(null);

    import('../../api')
      .then((api) => api.getIncidentIapGovernanceEvidencePackage(selectedIncidentId))
      .then((payload) => {
        setIapGovernanceEvidencePackage(payload);
        setIapGovernanceEvidenceLoading(false);
        onNotify?.('IAP governance evidence package refreshed.', 'success');
      })
      .catch((error) => {
        if (error instanceof ApiValidationError) {
          const firstValidationError = Object.values(error.validationErrors).flat()[0];
          setIapGovernanceEvidenceError(firstValidationError ?? error.message);
          setIapGovernanceEvidenceLoading(false);
          return;
        }

        setIapGovernanceEvidenceError(error instanceof Error ? error.message : 'Unable to refresh IAP governance evidence package.');
        setIapGovernanceEvidenceLoading(false);
      });
  };

  const toCsvCell = (value: string | number | null | undefined): string => {
    const normalizedValue = value === null || value === undefined ? '' : String(value);
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  };

  const downloadBlob = (filename: string, blob: Blob): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reloadResourceLifecycleSummary = () => {
    if (!selectedIncidentId) {
      setResourceLifecycleSummary(null);
      setResourceLifecycleSummaryLoading(false);
      setResourceLifecycleSummaryError(null);
      return Promise.resolve();
    }

    setResourceLifecycleSummaryLoading(true);
    setResourceLifecycleSummaryError(null);
    return import('../../api')
      .then((api) => api.getIncidentResourceLifecycleSummary(selectedIncidentId))
      .then((summary) => {
        setResourceLifecycleSummary(summary);
        setResourceLifecycleSummaryLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load incident resource lifecycle summary:', error);
        setResourceLifecycleSummaryError(error instanceof Error ? error.message : 'Failed to load incident resource lifecycle summary.');
        setResourceLifecycleSummaryLoading(false);
      });
  };

  const buildNotificationRecipientDraft = (): CommunicationRecipientRequest | null => {
    const destinationAddress = notificationDestinationAddressInput.trim();
    if (destinationAddress.length === 0 || !isNotificationPrincipalSelected) {
      return null;
    }

    return {
      userId: hasNotificationRecipientUserId ? parsedNotificationRecipientUserId : undefined,
      contactId: hasNotificationRecipientContactId ? parsedNotificationRecipientContactId : undefined,
      locationId: hasNotificationRecipientLocationId ? parsedNotificationRecipientLocationId : undefined,
      channelCode: notificationChannelCodeInput,
      destinationAddress,
    };
  };

  const clearNotificationRecipientDraftInputs = () => {
    setNotificationDestinationAddressInput('');
    setNotificationRecipientUserIdInput('');
    setNotificationRecipientContactIdInput('');
    setNotificationRecipientLocationIdInput('');
    setNotificationBroadcastLocationIdsInput([]);
  };

  const handleAddNotificationRecipient = () => {
    const draft = buildNotificationRecipientDraft();
    if (!draft) {
      return;
    }

    setNotificationRecipientsDraft((current) => [...current, draft]);
    clearNotificationRecipientDraftInputs();
  };

  const handleRemoveNotificationRecipient = (index: number) => {
    setNotificationRecipientsDraft((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleStageGeoBroadcastRecipients = () => {
    const destinationAddress = notificationDestinationAddressInput.trim();
    if (destinationAddress.length === 0) {
      return;
    }

    const locationIds = notificationBroadcastLocationIdsInput
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (locationIds.length === 0) {
      return;
    }

    setNotificationRecipientsDraft((current) => {
      const additions = locationIds
        .filter((locationId) => !current.some((recipient) =>
          recipient.locationId === locationId
          && recipient.channelCode === notificationChannelCodeInput
          && recipient.destinationAddress.localeCompare(destinationAddress, undefined, { sensitivity: 'accent' }) === 0))
        .map((locationId) => ({
          locationId,
          channelCode: notificationChannelCodeInput,
          destinationAddress,
        } satisfies CommunicationRecipientRequest));

      return additions.length > 0 ? [...current, ...additions] : current;
    });

    setNotificationBroadcastLocationIdsInput([]);
    onNotify?.(`Staged ${locationIds.length} geo-targeted recipient(s).`, 'info');
  };

  const reloadCommunicationLifecycleSummary = () => {
    if (!selectedIncidentId) {
      setCommunicationLifecycleSummary(null);
      setCommunicationLifecycleSummaryLoading(false);
      setCommunicationLifecycleSummaryError(null);
      return Promise.resolve();
    }

    setCommunicationLifecycleSummaryLoading(true);
    setCommunicationLifecycleSummaryError(null);
    return import('../../api')
      .then((api) => api.getIncidentCommunicationLifecycleSummary(selectedIncidentId, communicationSummaryFromUtcIso, communicationSummaryToUtcIso))
      .then((summary) => {
        setCommunicationLifecycleSummary(summary);
        setCommunicationLifecycleSummaryLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load communication lifecycle summary:', error);
        setCommunicationLifecycleSummaryError(error instanceof Error ? error.message : 'Failed to load communication lifecycle summary.');
        setCommunicationLifecycleSummaryLoading(false);
      });
  };

  const communicationsCsv = useMemo(() => {
    const lines = ['LoggedUtc,Channel,Direction,Subject,Message,Status,NotificationId,CreatedBy,CreatedUtc,UpdatedUtc'];
    filteredCommunications.forEach((item) => {
      lines.push(
        [
          toCsvCell(item.loggedUtc),
          toCsvCell(item.channelCode),
          toCsvCell(item.directionCode),
          toCsvCell(item.subject),
          toCsvCell(item.message),
          toCsvCell(item.statusCode),
          toCsvCell(item.notificationId ?? ''),
          toCsvCell(item.createdByUserDisplayName),
          toCsvCell(item.createdUtc),
          toCsvCell(item.updatedUtc ?? ''),
        ].join(','),
      );
    });

    return lines.join('\n');
  }, [filteredCommunications]);

  const handleExportResourceEvidenceCsv = () => {
    if (!selectedIncidentId) {
      return;
    }

    import('../../api')
      .then((api) => api.exportIncidentResourceEvidenceCsv(selectedIncidentId, resourceStatusFilter))
      .then((blob) => {
        downloadBlob(`incident-${selectedIncidentId}-resource-evidence.csv`, blob);
        onNotify?.('Resource evidence CSV exported.', 'success');
      })
      .catch((error) => {
        console.error('Failed to export resource evidence CSV:', error);
        onNotify?.(error instanceof Error ? error.message : 'Failed to export resource evidence CSV.', 'danger');
      });
  };

  const handleExportCommunicationEvidenceCsv = () => {
    if (!selectedIncidentId) {
      return;
    }

    import('../../api')
      .then((api) => api.exportIncidentCommunicationEvidenceCsv(selectedIncidentId, communicationSummaryFromUtcIso, communicationSummaryToUtcIso))
      .then((blob) => {
        downloadBlob(`incident-${selectedIncidentId}-communication-evidence.csv`, blob);
        onNotify?.('Communication evidence CSV exported.', 'success');
      })
      .catch((error) => {
        console.error('Failed to export communication evidence CSV:', error);
        onNotify?.(error instanceof Error ? error.message : 'Failed to export communication evidence CSV.', 'danger');
      });
  };

  const ics201RequestRef = useRef<AbortController | null>(null);
  const ics202RequestRef = useRef<AbortController | null>(null);
  const ics203RequestRef = useRef<AbortController | null>(null);
  const ics204RequestRef = useRef<AbortController | null>(null);
  const ics205RequestRef = useRef<AbortController | null>(null);
  const ics214RequestRef = useRef<AbortController | null>(null);
  const ics215RequestRef = useRef<AbortController | null>(null);
  const ics209RequestRef = useRef<AbortController | null>(null);
  const situationReportsRequestRef = useRef<AbortController | null>(null);
  const resourceRequestsRequestRef = useRef<AbortController | null>(null);
  const communicationsRequestRef = useRef<AbortController | null>(null);

  // Persist incident workspace tab per incident between refreshes.
  useEffect(() => {
    if (!selectedIncidentId) {
      setActiveTab('overview');
      return;
    }

    const key = `ipoc.incidentWorkspaceTab.${selectedIncidentId}`;
    const persistedTab = localStorage.getItem(key);
    if (persistedTab === 'overview' || persistedTab === 'tasks' || persistedTab === 'timeline' || persistedTab === 'periods' || persistedTab === 'resources' || persistedTab === 'communications' || persistedTab === 'sitrep') {
      setActiveTab(persistedTab);
      return;
    }

    setActiveTab('overview');
  }, [selectedIncidentId]);

  useEffect(() => {
    if (!selectedIncidentId) {
      return;
    }

    localStorage.setItem(`ipoc.incidentWorkspaceTab.${selectedIncidentId}`, activeTab);
  }, [activeTab, selectedIncidentId]);

  // Load ICS-201 data when SITREP tab is active
  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !ics201Loading && !ics201LoadAttempted) {
      ics201RequestRef.current?.abort();
      const controller = new AbortController();
      ics201RequestRef.current = controller;
      setIcs201LoadError(null);
      setIcs201Loading(true);
      import('../../api')
        .then((api) => api.getIcs201Data(selectedIncidentId, controller.signal))
        .then((data) => {
          if (ics201RequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setIcs201Data(data);
          setIcs201LoadAttempted(true);
          setIcs201Loading(false);
          ics201RequestRef.current = null;
        })
        .catch((err) => {
          if (ics201RequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setIcs201Loading(false);
            return;
          }

          console.error('Failed to load ICS-201 data:', err);
          setIcs201LoadError(err instanceof Error ? err.message : 'Failed to load ICS-201 data.');
          setIcs201LoadAttempted(true);
          setIcs201Loading(false);
          ics201RequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, ics201Loading, ics201LoadAttempted]);

  useEffect(() => {
    if (activeTab !== 'overview' || !isAuthenticated || icsPositionsLoading || icsAutoRefreshAttempted || icsPositions.length > 0) {
      return;
    }

    setIcsAutoRefreshAttempted(true);
    onRefreshIcsPositions();
  }, [activeTab, isAuthenticated, icsPositionsLoading, icsAutoRefreshAttempted, icsPositions.length, onRefreshIcsPositions]);

  useEffect(() => {
    if ((activeTab !== 'overview' && activeTab !== 'sitrep') || !isAuthenticated || incidentCommandAssignmentsLoading || assignmentAutoRefreshAttempted || incidentCommandAssignments.length > 0) {
      return;
    }

    setAssignmentAutoRefreshAttempted(true);
    onRefreshIncidentCommandAssignments();
  }, [
    activeTab,
    isAuthenticated,
    incidentCommandAssignmentsLoading,
    assignmentAutoRefreshAttempted,
    incidentCommandAssignments.length,
    onRefreshIncidentCommandAssignments,
  ]);

  useEffect(() => {
    if ((activeTab !== 'overview' && activeTab !== 'sitrep') || !isAuthenticated || commandTransferLogLoading || commandTransferLogRows.length > 0) {
      return;
    }

    void loadCommandTransferLog();
  }, [activeTab, isAuthenticated, commandTransferLogLoading, commandTransferLogRows.length, selectedIncidentId]);

  useEffect(() => {
    localStorage.setItem(transferFilterPresetLocalStorageKey, JSON.stringify(transferFilterPresets));
  }, [transferFilterPresets]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isMounted = true;
    import('../../api')
      .then((api) => api.getUserReportPresets(transferFilterPresetScope))
      .then((presets) => {
        if (!isMounted) {
          return;
        }

        const mapped = presets
          .map((preset) => parseTransferFilterPreset(preset))
          .filter((preset): preset is TransferFilterPreset => preset !== null)
          .slice(0, 12);

        if (mapped.length > 0) {
          setTransferFilterPresets(mapped);
        }
      })
      .catch((error) => {
        console.error('Failed to load transfer filter presets:', error);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!import.meta.env.DEV || activeTab !== 'overview') {
      return;
    }

    const directIcsPositionMatches = icsPositions.filter((position) => (
      incidentCommandAssignments.some((assignment) => assignment.icsPositionId === position.icsPositionId)
    )).length;

    console.debug('[ICS] tile render snapshot.', {
      selectedIncidentId,
      icsPositionCount: icsPositions.length,
      assignmentCount: incidentCommandAssignments.length,
      directIcsPositionMatches,
      assignmentLoading: incidentCommandAssignmentsLoading,
      positionsLoading: icsPositionsLoading,
    });
  }, [
    activeTab,
    selectedIncidentId,
    icsPositions,
    incidentCommandAssignments,
    incidentCommandAssignmentsLoading,
    icsPositionsLoading,
  ]);

  useEffect(() => {
    setIcsAutoRefreshAttempted(false);
    setAssignmentAutoRefreshAttempted(false);
    setOptimisticAssignedUsers({});
    setCommandTransferLogRows([]);
    setTransferPositionIdInput('');
    setTransferAssignedUserIdInput('');
    setTransferSummaryInput('');
    setTransferCommandPostLocationInput('');
    setTransferStatusFilter('All');
    setTransferSectionFilter('All');
    setTransferDateFromFilter('');
    setTransferDateToFilter('');
  }, [selectedIncidentId]);

  useEffect(() => {
    if ((activeTab !== 'overview' && activeTab !== 'tasks' && activeTab !== 'periods' && activeTab !== 'communications') || !isAuthenticated || taskAssignableUsersLoading || taskAssignableUsers.length > 0) {
      return;
    }

    setTaskAssignableUsersLoading(true);
    import('../../api')
      .then((api) => api.getActiveUsers())
      .then((users) => {
        setTaskAssignableUsers(users);
      })
      .catch((err) => {
        console.error('Failed to load active users for task assignment:', err);
      })
      .finally(() => {
        setTaskAssignableUsersLoading(false);
      });
  }, [activeTab, isAuthenticated, taskAssignableUsers.length, taskAssignableUsersLoading]);

  useEffect(() => {
    if (activeTab !== 'communications' || !isAuthenticated || activeContacts.length > 0) {
      return;
    }

    import('../../api')
      .then((api) => api.getActiveContacts())
      .then((items) => {
        setActiveContacts(items);
      })
      .catch((err) => {
        console.error('Failed to load active contacts for notification recipients:', err);
      });
  }, [activeTab, isAuthenticated, activeContacts.length]);

  // Load situation reports when SITREP tab is active
  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !situationReportsLoading && !situationReportsLoadAttempted) {
      situationReportsRequestRef.current?.abort();
      const controller = new AbortController();
      situationReportsRequestRef.current = controller;
      setSituationReportsLoadError(null);
      setSituationReportsLoading(true);
      import('../../api')
        .then((api) => api.getSituationReports(selectedIncidentId, controller.signal))
        .then((reports) => {
          if (situationReportsRequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setSituationReports(reports);
          setSituationReportsLoadAttempted(true);
          setSituationReportsLoading(false);
        onOperationalDataChanged?.();
          situationReportsRequestRef.current = null;
        })
        .catch((err) => {
          if (situationReportsRequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setSituationReportsLoading(false);
            return;
          }

          console.error('Failed to load situation reports:', err);
          setSituationReportsLoadError(err instanceof Error ? err.message : 'Failed to load situation reports.');
          setSituationReportsLoadAttempted(true);
          setSituationReportsLoading(false);
          situationReportsRequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, situationReportsLoading, situationReportsLoadAttempted]);

  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !ics202Loading && !ics202LoadAttempted) {
      ics202RequestRef.current?.abort();
      const controller = new AbortController();
      ics202RequestRef.current = controller;
      setIcs202LoadError(null);
      setIcs202Loading(true);
      import('../../api')
        .then((api) => api.getIcs202Data(selectedIncidentId, controller.signal))
        .then((data) => {
          if (ics202RequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setIcs202Data(data);
          setIcs202LoadAttempted(true);
          setIcs202Loading(false);
          ics202RequestRef.current = null;
        })
        .catch((err) => {
          if (ics202RequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setIcs202Loading(false);
            return;
          }

          setIcs202LoadError(err instanceof Error ? err.message : 'Failed to load ICS-202 data.');
          setIcs202LoadAttempted(true);
          setIcs202Loading(false);
          ics202RequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, ics202Loading, ics202LoadAttempted]);

  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !ics203Loading && !ics203LoadAttempted) {
      ics203RequestRef.current?.abort();
      const controller = new AbortController();
      ics203RequestRef.current = controller;
      setIcs203LoadError(null);
      setIcs203Loading(true);
      import('../../api')
        .then((api) => api.getIcs203Data(selectedIncidentId, controller.signal))
        .then((data) => {
          if (ics203RequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setIcs203Data(data);
          setIcs203LoadAttempted(true);
          setIcs203Loading(false);
          ics203RequestRef.current = null;
        })
        .catch((err) => {
          if (ics203RequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setIcs203Loading(false);
            return;
          }

          setIcs203LoadError(err instanceof Error ? err.message : 'Failed to load ICS-203 data.');
          setIcs203LoadAttempted(true);
          setIcs203Loading(false);
          ics203RequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, ics203Loading, ics203LoadAttempted]);

  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !ics204Loading && !ics204LoadAttempted) {
      ics204RequestRef.current?.abort();
      const controller = new AbortController();
      ics204RequestRef.current = controller;
      setIcs204LoadError(null);
      setIcs204Loading(true);
      import('../../api')
        .then((api) => api.getIcs204Data(selectedIncidentId, controller.signal))
        .then((data) => {
          if (ics204RequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setIcs204Data(data);
          setIcs204LoadAttempted(true);
          setIcs204Loading(false);
          ics204RequestRef.current = null;
        })
        .catch((err) => {
          if (ics204RequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setIcs204Loading(false);
            return;
          }

          setIcs204LoadError(err instanceof Error ? err.message : 'Failed to load ICS-204 data.');
          setIcs204LoadAttempted(true);
          setIcs204Loading(false);
          ics204RequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, ics204Loading, ics204LoadAttempted]);

  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !ics205Loading && !ics205LoadAttempted) {
      ics205RequestRef.current?.abort();
      const controller = new AbortController();
      ics205RequestRef.current = controller;
      setIcs205LoadError(null);
      setIcs205Loading(true);
      import('../../api')
        .then((api) => api.getIcs205Data(selectedIncidentId, controller.signal))
        .then((data) => {
          if (ics205RequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setIcs205Data(data);
          setIcs205LoadAttempted(true);
          setIcs205Loading(false);
          ics205RequestRef.current = null;
        })
        .catch((err) => {
          if (ics205RequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setIcs205Loading(false);
            return;
          }

          setIcs205LoadError(err instanceof Error ? err.message : 'Failed to load ICS-205 data.');
          setIcs205LoadAttempted(true);
          setIcs205Loading(false);
          ics205RequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, ics205Loading, ics205LoadAttempted]);

  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !ics214Loading && !ics214LoadAttempted) {
      ics214RequestRef.current?.abort();
      const controller = new AbortController();
      ics214RequestRef.current = controller;
      setIcs214LoadError(null);
      setIcs214Loading(true);
      import('../../api')
        .then((api) => api.getIcs214Data(selectedIncidentId, controller.signal))
        .then((data) => {
          if (ics214RequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setIcs214Data(data);
          setIcs214LoadAttempted(true);
          setIcs214Loading(false);
          ics214RequestRef.current = null;
        })
        .catch((err) => {
          if (ics214RequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setIcs214Loading(false);
            return;
          }

          setIcs214LoadError(err instanceof Error ? err.message : 'Failed to load ICS-214 data.');
          setIcs214LoadAttempted(true);
          setIcs214Loading(false);
          ics214RequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, ics214Loading, ics214LoadAttempted]);

  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !ics215Loading && !ics215LoadAttempted) {
      ics215RequestRef.current?.abort();
      const controller = new AbortController();
      ics215RequestRef.current = controller;
      setIcs215LoadError(null);
      setIcs215Loading(true);
      import('../../api')
        .then((api) => api.getIcs215Data(selectedIncidentId, controller.signal))
        .then((data) => {
          if (ics215RequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setIcs215Data(data);
          setIcs215LoadAttempted(true);
          setIcs215Loading(false);
          ics215RequestRef.current = null;
        })
        .catch((err) => {
          if (ics215RequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setIcs215Loading(false);
            return;
          }

          setIcs215LoadError(err instanceof Error ? err.message : 'Failed to load ICS-215 data.');
          setIcs215LoadAttempted(true);
          setIcs215Loading(false);
          ics215RequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, ics215Loading, ics215LoadAttempted]);

  useEffect(() => {
    if (activeTab === 'sitrep' && selectedIncidentId && !ics209Loading && !ics209LoadAttempted) {
      ics209RequestRef.current?.abort();
      const controller = new AbortController();
      ics209RequestRef.current = controller;
      setIcs209LoadError(null);
      setIcs209Loading(true);
      import('../../api')
        .then((api) => api.getIcs209Data(selectedIncidentId, controller.signal))
        .then((data) => {
          if (ics209RequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setIcs209Data(data);
          setIcs209LoadAttempted(true);
          setIcs209Loading(false);
          ics209RequestRef.current = null;
        })
        .catch((err) => {
          if (ics209RequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setIcs209Loading(false);
            return;
          }

          setIcs209LoadError(err instanceof Error ? err.message : 'Failed to load ICS-209 data.');
          setIcs209LoadAttempted(true);
          setIcs209Loading(false);
          ics209RequestRef.current = null;
        });
    }
  }, [activeTab, selectedIncidentId, ics209Loading, ics209LoadAttempted]);

  useEffect(() => {
    if (activeTab === 'resources' && selectedIncidentId && !resourceRequestsLoading && !resourceRequestsLoadAttempted) {
      resourceRequestsRequestRef.current?.abort();
      const controller = new AbortController();
      resourceRequestsRequestRef.current = controller;
      setResourceRequestsLoadError(null);
      setResourceRequestsLoading(true);
      import('../../api')
        .then((api) => api.getIncidentResourceRequests(selectedIncidentId, controller.signal))
        .then((items) => {
          if (resourceRequestsRequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setResourceRequests(items);
          setResourceRequestsLoadAttempted(true);
          setResourceRequestsLoading(false);
          resourceRequestsRequestRef.current = null;
        })
        .catch((err) => {
          if (resourceRequestsRequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setResourceRequestsLoading(false);
            return;
          }

          console.error('Failed to load incident resource requests:', err);
          setResourceRequestsLoadError(err instanceof Error ? err.message : 'Failed to load incident resource requests.');
          setResourceRequestsLoadAttempted(true);
          setResourceRequestsLoading(false);
          resourceRequestsRequestRef.current = null;
        });
    }
  }, [activeTab, resourceRequestsLoading, resourceRequestsLoadAttempted, selectedIncidentId]);

  useEffect(() => {
    if (activeTab !== 'resources' || !selectedIncidentId || resourceRequestsLoading || !resourceRequestsLoadAttempted) {
      return;
    }

    void reloadResourceLifecycleSummary();
    void reloadResourceRollups();
  }, [activeTab, selectedIncidentId, resourceRequestsLoading, resourceRequestsLoadAttempted, resourceRollupRegionFilter, resourceRollupRegionIdFilter]);

  useEffect(() => {
    if (activeTab === 'communications' && selectedIncidentId && !communicationsLoading && !communicationsLoadAttempted) {
      communicationsRequestRef.current?.abort();
      const controller = new AbortController();
      communicationsRequestRef.current = controller;
      setCommunicationsLoadError(null);
    setCommunicationsLoading(true);
      import('../../api')
        .then((api) => api.getIncidentCommunications(selectedIncidentId, controller.signal))
        .then((items) => {
          if (communicationsRequestRef.current !== controller || controller.signal.aborted) {
            return;
          }

          setCommunications(items);
          setCommunicationsLoadAttempted(true);
          setCommunicationsLoading(false);
          communicationsRequestRef.current = null;
        })
        .catch((err) => {
          if (communicationsRequestRef.current !== controller) {
            return;
          }

          if (isAbortError(err)) {
            setCommunicationsLoading(false);
            return;
          }

          console.error('Failed to load incident communications:', err);
          setCommunicationsLoadError(err instanceof Error ? err.message : 'Failed to load incident communications.');
          setCommunicationsLoadAttempted(true);
          setCommunicationsLoading(false);
          communicationsRequestRef.current = null;
        });
    }
  }, [activeTab, communicationsLoading, communicationsLoadAttempted, selectedIncidentId]);

  useEffect(() => {
    if (activeTab !== 'communications' || !selectedIncidentId || communicationsLoading || !communicationsLoadAttempted) {
      return;
    }

    void reloadCommunicationLifecycleSummary();
  }, [
    activeTab,
    selectedIncidentId,
    communicationsLoading,
    communicationsLoadAttempted,
    communicationSummaryFromUtcIso,
    communicationSummaryToUtcIso,
  ]);

  // Reset ICS-201 and SITREP data when incident changes
  useEffect(() => {
    ics201RequestRef.current?.abort();
    ics202RequestRef.current?.abort();
    ics203RequestRef.current?.abort();
    ics204RequestRef.current?.abort();
    ics205RequestRef.current?.abort();
    ics214RequestRef.current?.abort();
    ics215RequestRef.current?.abort();
    ics209RequestRef.current?.abort();
    situationReportsRequestRef.current?.abort();
    resourceRequestsRequestRef.current?.abort();
    communicationsRequestRef.current?.abort();

    setIcs201Data(null);
    setIcs201LoadAttempted(false);
    setIcs201LoadError(null);
    setIcs202Data(null);
    setIcs202LoadAttempted(false);
    setIcs202LoadError(null);
    setIcs203Data(null);
    setIcs203LoadAttempted(false);
    setIcs203LoadError(null);
    setIcs204Data(null);
    setIcs204LoadAttempted(false);
    setIcs204LoadError(null);
    setIcs205Data(null);
    setIcs205LoadAttempted(false);
    setIcs205LoadError(null);
    setIcs214Data(null);
    setIcs214LoadAttempted(false);
    setIcs214LoadError(null);
    setIcs215Data(null);
    setIcs215LoadAttempted(false);
    setIcs215LoadError(null);
    setIcs209Data(null);
    setIcs209LoadAttempted(false);
    setIcs209LoadError(null);
    setSituationReports([]);
    setSituationReportsLoadAttempted(false);
    setSituationReportsLoadError(null);
    setShowSitrepForm(false);
    setSitrepSummary('');
    setSitrepCurrentActions('');
    setSitrepPlannedActions('');
    setSitrepUnmetNeeds('');
    setSitrepOperationalPeriodId(null);
    setCommunications([]);
    setCommunicationsLoadAttempted(false);
    setCommunicationsLoadError(null);
    setEditingCommunicationId(null);
    setCommunicationChannelCode('Phone');
    setCommunicationDirectionCode('Inbound');
    setCommunicationSubject('');
    setCommunicationMessage('');
    setCommunicationStatusFilter('All');
    setCommunicationChannelFilter('All');
    setCommunicationDateFromFilter('');
    setCommunicationDateToFilter('');
    setCommunicationLifecycleSummary(null);
    setCommunicationLifecycleSummaryLoading(false);
    setCommunicationLifecycleSummaryError(null);
    setLastDispatchedNotificationId(null);
    setNotificationRecipients([]);
    setNotificationRecipientStatusSelection({});
    setNotificationRecipientFailureReasonInput({});
    setNotificationRecipientAckNoteInput({});
    setResourceRequests([]);
    setResourceRequestsLoadAttempted(false);
    setResourceRequestsLoadError(null);
    setResourceLifecycleSummary(null);
    setResourceLifecycleSummaryLoading(false);
    setResourceLifecycleSummaryError(null);
    setResourceRegionalRollups([]);
    setResourceRollupLoading(false);
    setResourceRollupError(null);
    setEditingResourceRequestId(null);
    setResourceTypeCodeInput('General');
    setResourceTypeNameInput('General Resource');
    setResourceRequestedQuantityInput('1');
    setResourceAssignedQuantityInput('');
    setResourceUnitOfMeasureCodeInput('Units');
    setResourcePriorityCodeInput('Normal');
    setResourceStatusCodeInput('Requested');
    setResourceNotesInput('');
    setResourceRollupRegionFilter('All');
    setResourceRollupRegionIdFilter('');
  }, [selectedIncidentId]);

  useEffect(() => {
    return () => {
      ics201RequestRef.current?.abort();
      ics202RequestRef.current?.abort();
      ics203RequestRef.current?.abort();
      ics204RequestRef.current?.abort();
      ics205RequestRef.current?.abort();
      ics214RequestRef.current?.abort();
      ics215RequestRef.current?.abort();
      ics209RequestRef.current?.abort();
      situationReportsRequestRef.current?.abort();
      resourceRequestsRequestRef.current?.abort();
      communicationsRequestRef.current?.abort();
    };
  }, []);

  const resetResourceRequestForm = () => {
    setEditingResourceRequestId(null);
    setResourceTypeCodeInput('General');
    setResourceTypeNameInput('General Resource');
    setResourceRequestedQuantityInput('1');
    setResourceAssignedQuantityInput('');
    setResourceUnitOfMeasureCodeInput('Units');
    setResourcePriorityCodeInput('Normal');
    setResourceStatusCodeInput('Requested');
    setResourceNotesInput('');
    setResourceTypeDropdownOpen(false);
  };

  const requestedQuantityNumber = Number(resourceRequestedQuantityInput);
  const assignedQuantityNumber = resourceAssignedQuantityInput.trim().length === 0 ? null : Number(resourceAssignedQuantityInput);
  const isRequestedQuantityInvalid = !Number.isFinite(requestedQuantityNumber) || requestedQuantityNumber <= 0;
  const isAssignedQuantityInvalid = assignedQuantityNumber !== null && (!Number.isFinite(assignedQuantityNumber) || assignedQuantityNumber < 0);

  const validateResourceLifecycleCombination = (
    requestedQuantity: number,
    assignedQuantity: number | null | undefined,
    statusCode: string,
  ): string | null => {
    const normalizedStatus = statusCode.trim().toLowerCase();
    const assigned = assignedQuantity ?? 0;

    if (assigned > requestedQuantity) {
      return 'Assigned quantity cannot exceed requested quantity.';
    }

    if ((normalizedStatus === 'requested' || normalizedStatus === 'denied' || normalizedStatus === 'cancelled' || normalizedStatus === 'archived') && assigned > 0) {
      return `Assigned quantity must be empty or zero when status is ${statusCode}.`;
    }

    if (normalizedStatus === 'partiallyfulfilled' && (assigned <= 0 || assigned >= requestedQuantity)) {
      return 'Partially Fulfilled requires assigned quantity greater than zero and less than requested quantity.';
    }

    if (normalizedStatus === 'fulfilled' && assigned !== requestedQuantity) {
      return 'Fulfilled requires assigned quantity equal to requested quantity.';
    }

    return null;
  };

  const exactResourceTypeMatch = useMemo(() => {
    const normalizedName = resourceTypeNameInput.trim();
    if (normalizedName.length === 0) {
      return undefined;
    }

    return resourceTypeLookups.find((item) => item.displayName.localeCompare(normalizedName, undefined, { sensitivity: 'accent' }) === 0);
  }, [resourceTypeLookups, resourceTypeNameInput]);

  const fuzzyResourceTypeSuggestions = useMemo(() => {
    const query = resourceTypeNameInput.trim().toLowerCase();
    if (query.length < 2) {
      return [];
    }

    const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const scoreSuggestion = (candidate: string): number => {
      const normalizedCandidate = normalizeText(candidate);
      const normalizedQuery = normalizeText(query);
      if (normalizedCandidate.length === 0 || normalizedQuery.length === 0) {
        return 0;
      }

      if (normalizedCandidate === normalizedQuery) {
        return 100;
      }

      if (normalizedCandidate.startsWith(normalizedQuery)) {
        return 90;
      }

      if (normalizedCandidate.includes(normalizedQuery)) {
        return 75;
      }

      const queryTokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
      const candidateTokens = normalizedCandidate.split(' ').filter((token) => token.length > 0);
      if (queryTokens.length === 0 || candidateTokens.length === 0) {
        return 0;
      }

      let tokenMatches = 0;
      queryTokens.forEach((queryToken) => {
        if (candidateTokens.some((candidateToken) => candidateToken.startsWith(queryToken) || candidateToken.includes(queryToken))) {
          tokenMatches += 1;
        }
      });

      if (tokenMatches === 0) {
        return 0;
      }

      return Math.round((tokenMatches / queryTokens.length) * 60);
    };

    const seen = new Set<string>();
    return resourceTypeLookups
      .map((item) => ({ item, score: scoreSuggestion(item.displayName) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.item.displayName.localeCompare(b.item.displayName);
      })
      .map((candidate) => candidate.item)
      .filter((item) => {
        const key = item.displayName.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [resourceTypeLookups, resourceTypeNameInput]);

  const suggestedResourceTypeOptions = useMemo(() => {
    const query = resourceTypeNameInput.trim();
    const byCodeValueId = new Map<number, LookupValue>();

    resourceTypeSearchSuggestions.forEach((item) => {
      byCodeValueId.set(item.codeValueId, item);
    });

    fuzzyResourceTypeSuggestions.forEach((item) => {
      if (!byCodeValueId.has(item.codeValueId)) {
        byCodeValueId.set(item.codeValueId, item);
      }
    });

    if (query.length < 2) {
      resourceTypeLookups
        .slice()
        .sort((left, right) => left.displayName.localeCompare(right.displayName))
        .forEach((item) => {
          if (!byCodeValueId.has(item.codeValueId)) {
            byCodeValueId.set(item.codeValueId, item);
          }
        });
    }

    return Array.from(byCodeValueId.values())
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [resourceTypeLookups, resourceTypeSearchSuggestions, fuzzyResourceTypeSuggestions, resourceTypeNameInput]);

  const canCreateResourceTypeOption = useMemo(() => {
    const typedValue = resourceTypeNameInput.trim();
    if (typedValue.length < 2) {
      return false;
    }

    return !resourceTypeLookups.some((item) => item.displayName.localeCompare(typedValue, undefined, { sensitivity: 'accent' }) === 0);
  }, [resourceTypeLookups, resourceTypeNameInput]);

  const normalizeLookupCodeFromName = (name: string): string => (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80)
  );

  useEffect(() => {
    if (!exactResourceTypeMatch) {
      return;
    }

    if (resourceTypeCodeInput.trim().localeCompare(exactResourceTypeMatch.code, undefined, { sensitivity: 'accent' }) !== 0) {
      setResourceTypeCodeInput(exactResourceTypeMatch.code);
    }
  }, [exactResourceTypeMatch, resourceTypeCodeInput]);

  useEffect(() => {
    const query = resourceTypeNameInput.trim();
    if (query.length < 2) {
      setResourceTypeSearchSuggestions([]);
      setResourceTypeSearchLoading(false);
      return;
    }

    let isCancelled = false;
    setResourceTypeSearchLoading(true);

    const timeoutId = window.setTimeout(() => {
      import('../../api')
        .then((api) => api.searchLookupValues('ResourceType', query, 8))
        .then((results) => {
          if (isCancelled) {
            return;
          }

          setResourceTypeSearchSuggestions(results);
          setResourceTypeSearchLoading(false);
        })
        .catch(() => {
          if (isCancelled) {
            return;
          }

          setResourceTypeSearchLoading(false);
        });
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [resourceTypeNameInput]);

  const resourceStatusFilterOptions = useMemo(() => {
    const statuses = new Set<string>();
    resourceRequests.forEach((item) => statuses.add(item.statusCode));
    return ['All', ...Array.from(statuses).sort((a, b) => a.localeCompare(b))];
  }, [resourceRequests]);

  const taskStatusFilterOptions = useMemo(() => {
    const statuses = new Set<string>();
    incidentTasks.forEach((task) => statuses.add(task.statusCode));
    return ['all', ...Array.from(statuses).sort((a, b) => a.localeCompare(b))];
  }, [incidentTasks]);

  const filteredIncidentTasks = useMemo(() => {
    return incidentTasks.filter((task) => {
      const matchesAssignee = taskAssigneeFilter === 'all'
        ? true
        : taskAssigneeFilter === 'unassigned'
          ? !task.assignedToUserId
          : task.assignedToUserId === Number(taskAssigneeFilter);

      const matchesStatus = taskStatusFilter === 'all'
        ? true
        : task.statusCode === taskStatusFilter;

      return matchesAssignee && matchesStatus;
    });
  }, [incidentTasks, taskAssigneeFilter, taskStatusFilter]);

  const filteredIncidentTasksGridRows = useMemo(() => filteredIncidentTasks.map((task) => ({
    id: task.incidentTaskId,
    taskTitle: task.taskTitle,
    taskDescription: task.taskDescription,
    assignedToUserDisplayName: task.assignedToUserDisplayName ?? (task.assignedToUserId ? `User #${task.assignedToUserId}` : '—'),
    priorityCode: task.priorityCode,
    statusCode: task.statusCode,
    dueUtc: task.dueUtc,
    assignedToUserId: task.assignedToUserId,
    task,
  })), [filteredIncidentTasks]);

  const filteredIncidentTasksGridColumnDefs: ColDef<(typeof filteredIncidentTasksGridRows)[number]>[] = useMemo(() => [
    {
      field: 'taskTitle',
      headerName: 'Title',
      minWidth: 240,
      flex: 1.6,
      cellRenderer: (params: { data?: (typeof filteredIncidentTasksGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div>
            <div className="fw-semibold">{row.taskTitle}</div>
            {row.taskDescription && <div className="small text-muted">{row.taskDescription}</div>}
          </div>
        );
      },
    },
    { field: 'assignedToUserDisplayName', headerName: 'Assigned To', minWidth: 170, flex: 1.1 },
    {
      field: 'priorityCode',
      headerName: 'Priority',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { value?: string }) => (
        <Badge bg={priorityVariant(params.value ?? '')}>{params.value ?? '—'}</Badge>
      ),
    },
    {
      field: 'statusCode',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { value?: string }) => (
        <Badge bg={statusVariant(params.value ?? '')}>{params.value ?? '—'}</Badge>
      ),
    },
    {
      field: 'dueUtc',
      headerName: 'Due',
      minWidth: 170,
      flex: 1,
      valueFormatter: (params) => (params.value ? new Date(String(params.value)).toLocaleString() : '—'),
    },
    {
      field: 'assignedToUserId',
      headerName: 'Assignment',
      minWidth: 170,
      flex: 1,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: (typeof filteredIncidentTasksGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <Form.Select
            size="sm"
            value={row.assignedToUserId?.toString() ?? ''}
            onChange={(event) => {
              const raw = event.target.value.trim();
              if (raw.length === 0) {
                void onUpdateIncidentTaskAssignment(row.id, null);
                return;
              }

              const parsedUserId = Number(raw);
              if (!Number.isNaN(parsedUserId) && parsedUserId > 0) {
                void onUpdateIncidentTaskAssignment(row.id, parsedUserId);
              }
            }}
          >
            <option value="">Unassigned</option>
            {taskAssignableUsers.map((user) => (
              <option key={user.userId} value={user.userId}>{user.displayName}</option>
            ))}
          </Form.Select>
        );
      },
    },
    {
      field: 'statusCode',
      headerName: 'Status',
      minWidth: 150,
      flex: 1,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: (typeof filteredIncidentTasksGridRows)[number] }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <Form.Select
            size="sm"
            value={row.statusCode}
            onChange={(event) => {
              const nextStatus = event.target.value;
              if (nextStatus !== row.statusCode) {
                void onUpdateIncidentTaskStatus(row.id, nextStatus);
              }
            }}
          >
            {taskStatusLookups.map((item) => (
              <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
            ))}
          </Form.Select>
        );
      },
    },
  ], [onUpdateIncidentTaskAssignment, onUpdateIncidentTaskStatus, taskAssignableUsers, taskStatusLookups]);

  const ics204GridRows = useMemo(() => (ics204Data?.assignments ?? []).map((assignment) => ({
    id: assignment.incidentTaskId,
    taskLabel: `${assignment.taskNumber ? `${assignment.taskNumber} — ` : ''}${assignment.taskTitle}`,
    priorityCode: assignment.priorityCode,
    statusCode: assignment.statusCode,
    assignedToUserDisplayName: assignment.assignedToUserDisplayName || '—',
    dueUtc: assignment.dueUtc,
  })), [ics204Data]);

  const ics204GridColumnDefs: ColDef<(typeof ics204GridRows)[number]>[] = useMemo(() => [
    { field: 'taskLabel', headerName: 'Task', minWidth: 240, flex: 1.7 },
    { field: 'priorityCode', headerName: 'Priority', minWidth: 120, flex: 0.8, cellRenderer: (params: { value?: string }) => <Badge bg={priorityVariant(params.value ?? '')}>{params.value ?? '—'}</Badge> },
    { field: 'statusCode', headerName: 'Status', minWidth: 120, flex: 0.8, cellRenderer: (params: { value?: string }) => <Badge bg={statusVariant(params.value ?? '')}>{params.value ?? '—'}</Badge> },
    { field: 'assignedToUserDisplayName', headerName: 'Assigned To', minWidth: 170, flex: 1 },
    { field: 'dueUtc', headerName: 'Due', minWidth: 170, flex: 1, valueFormatter: (params) => (params.value ? new Date(String(params.value)).toLocaleString() : '—') },
  ], []);

  const iapCycleStatusRows = useMemo<IapCycleStatusRow[]>(() => {
    const approvedPeriods = incidentOperationalPeriods.filter((period) => period.statusCode.toLowerCase() === 'approved').length;
    const hasObjectives = incidentObjectives.length > 0;
    const hasAssignments = incidentCommandAssignments.length > 0;
    const openTasks = incidentTasks.filter((task) => task.statusCode.toLowerCase() !== 'completed').length;
    const hasSitrep = (situationReports.length > 0) || !!ics201Data;

    const stageStatus = (isComplete: boolean, inProgress: boolean): IapCycleStatusRow['status'] => {
      if (isComplete) {
        return 'Complete';
      }

      if (inProgress) {
        return 'In Progress';
      }

      return 'Pending';
    };

    return [
      {
        id: 'iap-stage-understand',
        stage: '1. Understand situation',
        status: stageStatus(hasSitrep, !!incidentDetail),
        evidence: hasSitrep ? 'SITREP / ICS-201 available' : 'Awaiting SITREP capture',
      },
      {
        id: 'iap-stage-objectives',
        stage: '2. Establish objectives',
        status: stageStatus(hasObjectives, incidentOperationalPeriods.length > 0),
        evidence: hasObjectives ? `${incidentObjectives.length} objective(s)` : 'No objectives recorded',
      },
      {
        id: 'iap-stage-develop',
        stage: '3. Develop plan',
        status: stageStatus(hasAssignments && hasObjectives, hasAssignments || hasObjectives),
        evidence: hasAssignments ? `${incidentCommandAssignments.length} assignment(s)` : 'Command assignments pending',
      },
      {
        id: 'iap-stage-approve',
        stage: '4. Approve and disseminate',
        status: stageStatus(approvedPeriods > 0, incidentOperationalPeriods.length > 0),
        evidence: approvedPeriods > 0 ? `${approvedPeriods} approved period(s)` : 'No approved operational periods',
      },
      {
        id: 'iap-stage-execute',
        stage: '5. Execute plan',
        status: stageStatus(openTasks === 0 && incidentTasks.length > 0, incidentTasks.length > 0),
        evidence: incidentTasks.length > 0 ? `${openTasks} open task(s)` : 'No execution tasks',
      },
      {
        id: 'iap-stage-evaluate',
        stage: '6. Evaluate and revise',
        status: stageStatus(commandTransferLogRows.length > 0, hasSitrep || incidentTimelineEvents.length > 0),
        evidence: commandTransferLogRows.length > 0 ? `${commandTransferLogRows.length} transfer log row(s)` : 'No transfer/evaluation logs yet',
      },
    ];
  }, [incidentOperationalPeriods, incidentObjectives, incidentCommandAssignments, incidentTasks, situationReports, ics201Data, incidentDetail, commandTransferLogRows.length, incidentTimelineEvents.length]);

  const iapCycleStatusColumnDefs: ColDef<IapCycleStatusRow>[] = useMemo(() => [
    { field: 'stage', headerName: 'IAP Stage', minWidth: 240, flex: 1.3 },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 140,
      flex: 0.8,
      cellRenderer: (params: { value?: IapCycleStatusRow['status'] }) => {
        const status = params.value ?? 'Pending';
        const bg = status === 'Complete' ? 'success' : status === 'In Progress' ? 'info' : 'secondary';
        return <Badge bg={bg}>{status}</Badge>;
      },
    },
    { field: 'evidence', headerName: 'Evidence', minWidth: 240, flex: 1.4 },
  ], []);

  const ics214GridRows = useMemo(() => (ics214Data?.entries ?? []).slice(0, 50).map((entry, index) => ({
    id: `${entry.activityUtc}-${entry.activityType}-${index}`,
    activityUtc: entry.activityUtc,
    activityType: entry.activityType,
    summary: entry.summary,
    actorDisplayName: entry.actorDisplayName ?? '—',
  })), [ics214Data]);

  const ics214GridColumnDefs: ColDef<(typeof ics214GridRows)[number]>[] = useMemo(() => [
    { field: 'activityUtc', headerName: 'Time', minWidth: 170, flex: 1, sort: 'desc', valueFormatter: (params) => new Date(String(params.value)).toLocaleString() },
    { field: 'activityType', headerName: 'Type', minWidth: 130, flex: 0.9 },
    { field: 'summary', headerName: 'Summary', minWidth: 260, flex: 1.8 },
    { field: 'actorDisplayName', headerName: 'Actor', minWidth: 160, flex: 1 },
  ], []);

  const ics215GridRows = useMemo(() => (ics215Data?.safetyItems ?? []).map((item, index) => ({
    id: `${item.hazardCategory}-${index}`,
    hazardCategory: item.hazardCategory,
    hazardDescription: item.hazardDescription,
    riskLevel: item.riskLevel,
    mitigationAction: item.mitigationAction,
    owner: item.owner ?? '—',
  })), [ics215Data]);

  const ics215GridColumnDefs: ColDef<(typeof ics215GridRows)[number]>[] = useMemo(() => [
    { field: 'hazardCategory', headerName: 'Category', minWidth: 140, flex: 1 },
    { field: 'hazardDescription', headerName: 'Hazard', minWidth: 220, flex: 1.5 },
    { field: 'riskLevel', headerName: 'Risk', minWidth: 110, flex: 0.8, cellRenderer: (params: { value?: string }) => <Badge bg={priorityVariant(params.value ?? '')}>{params.value ?? '—'}</Badge> },
    { field: 'mitigationAction', headerName: 'Mitigation', minWidth: 220, flex: 1.5 },
    { field: 'owner', headerName: 'Owner', minWidth: 150, flex: 1 },
  ], []);

  const incidentTimelineGridRows = useMemo(() => incidentTimelineEvents.map((timelineEvent) => ({
    id: timelineEvent.incidentTimelineEventId,
    eventUtc: timelineEvent.eventUtc,
    eventTypeCode: timelineEvent.eventTypeCode,
    eventTitle: timelineEvent.eventTitle,
    eventDescription: timelineEvent.eventDescription ?? '—',
  })), [incidentTimelineEvents]);

  const incidentTimelineGridColumnDefs: ColDef<(typeof incidentTimelineGridRows)[number]>[] = useMemo(() => [
    {
      field: 'eventUtc',
      headerName: 'Event Time',
      minWidth: 170,
      flex: 1,
      sort: 'desc',
      valueFormatter: (params) => new Date(String(params.value)).toLocaleString(),
    },
    {
      field: 'eventTypeCode',
      headerName: 'Type',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { value?: string }) => <Badge bg="secondary">{params.value ?? '—'}</Badge>,
    },
    { field: 'eventTitle', headerName: 'Title', minWidth: 220, flex: 1.4 },
    { field: 'eventDescription', headerName: 'Description', minWidth: 260, flex: 1.8 },
  ], []);

  const operationalPeriodsGridRows = useMemo(() => incidentOperationalPeriods.map((period) => ({
    id: period.operationalPeriodId,
    period,
  })), [incidentOperationalPeriods]);

  const hasApprovedOperationalPeriod = useMemo(
    () => incidentOperationalPeriods.some((period) => period.statusCode.localeCompare('Approved', undefined, { sensitivity: 'accent' }) === 0),
    [incidentOperationalPeriods],
  );

  const iapExportBlockedReason = useMemo(() => {
    if (incidentOperationalPeriodsLoading) {
      return 'Operational periods are still loading.';
    }

    if (!hasApprovedOperationalPeriod) {
      return 'At least one Approved operational period is required before IAP export/print.';
    }

    return null;
  }, [hasApprovedOperationalPeriod, incidentOperationalPeriodsLoading]);

  const operationalPeriodsGridColumnDefs: ColDef<(typeof operationalPeriodsGridRows)[number]>[] = useMemo(() => [
    {
      headerName: '#',
      minWidth: 90,
      flex: 0.6,
      cellRenderer: (params: { data?: (typeof operationalPeriodsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingOperationalPeriodId !== row.id) {
          return row.period.periodNumber;
        }

        return (
          <Form.Control
            size="sm"
            type="number"
            min={1}
            value={editingOperationalPeriodNumberInput}
            onChange={(event) => setEditingOperationalPeriodNumberInput(event.target.value)}
          />
        );
      },
    },
    {
      headerName: 'Name',
      minWidth: 180,
      flex: 1.1,
      cellRenderer: (params: { data?: (typeof operationalPeriodsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingOperationalPeriodId !== row.id) {
          return row.period.periodName ?? '—';
        }

        return (
          <Form.Control
            size="sm"
            value={editingOperationalPeriodNameInput}
            onChange={(event) => setEditingOperationalPeriodNameInput(event.target.value)}
            placeholder="Name"
          />
        );
      },
    },
    {
      headerName: 'Window',
      minWidth: 320,
      flex: 2,
      cellRenderer: (params: { data?: (typeof operationalPeriodsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingOperationalPeriodId !== row.id) {
          return <span className="small">{new Date(row.period.startUtc).toLocaleString()} — {new Date(row.period.endUtc).toLocaleString()}</span>;
        }

        return (
          <div className="d-flex flex-column gap-1">
            <Form.Control
              size="sm"
              type="datetime-local"
              value={editingOperationalPeriodStartInput}
              onChange={(event) => setEditingOperationalPeriodStartInput(event.target.value)}
            />
            <Form.Control
              size="sm"
              type="datetime-local"
              value={editingOperationalPeriodEndInput}
              onChange={(event) => setEditingOperationalPeriodEndInput(event.target.value)}
            />
            <Form.Control
              size="sm"
              type="datetime-local"
              value={editingOperationalPeriodPlanningMeetingInput}
              onChange={(event) => setEditingOperationalPeriodPlanningMeetingInput(event.target.value)}
              placeholder="Planning meeting"
            />
            <Form.Select
              size="sm"
              value={editingOperationalPeriodApprovedByUserIdInput}
              onChange={(event) => setEditingOperationalPeriodApprovedByUserIdInput(event.target.value)}
            >
              <option value="">Approved user (optional)</option>
              {taskAssignableUsers.map((user) => (
                <option key={user.userId} value={user.userId}>{user.displayName}</option>
              ))}
            </Form.Select>
            <Form.Control
              size="sm"
              type="datetime-local"
              value={editingOperationalPeriodApprovedUtcInput}
              onChange={(event) => setEditingOperationalPeriodApprovedUtcInput(event.target.value)}
              placeholder="Approved UTC"
            />
          </div>
        );
      },
    },
    {
      headerName: 'Status',
      minWidth: 130,
      flex: 0.8,
      cellRenderer: (params: { data?: (typeof operationalPeriodsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingOperationalPeriodId !== row.id) {
          return <Badge bg={statusVariant(row.period.statusCode)}>{row.period.statusCode}</Badge>;
        }

        return (
          <Form.Select
            size="sm"
            value={editingOperationalPeriodStatusInput}
            onChange={(event) => setEditingOperationalPeriodStatusInput(event.target.value)}
          >
            <option value="Planned">Planned</option>
            <option value="Active">Active</option>
          </Form.Select>
        );
      },
    },
    {
      headerName: 'Actions',
      minWidth: 150,
      maxWidth: 210,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof operationalPeriodsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;

        if (editingOperationalPeriodId === row.id) {
          return (
            <div className="d-inline-flex gap-1">
              <IconActionButton
                iconClassName={savingOperationalPeriodEdit ? 'bi bi-arrow-repeat' : 'bi bi-check2'}
                tooltip={savingOperationalPeriodEdit ? 'Saving operational period...' : 'Save operational period updates'}
                ariaLabel="Save operational period"
                onClick={saveOperationalPeriodEdit}
                variant="outline-success"
                className="incident-form-action-btn"
                disabled={savingOperationalPeriodEdit || incidentActionLoading || !isAuthenticated}
              />
              <IconActionButton
                iconClassName="bi bi-x"
                tooltip="Cancel edit"
                ariaLabel="Cancel operational period edit"
                onClick={cancelOperationalPeriodEdit}
                variant="outline-secondary"
                className="incident-form-action-btn"
                disabled={savingOperationalPeriodEdit || incidentActionLoading}
              />
            </div>
          );
        }

        return (
          <div className="d-inline-flex gap-1">
            <IconActionButton
              iconClassName="bi bi-arrow-counterclockwise"
              tooltip="Reopen operational period for planning updates"
              ariaLabel="Reopen operational period"
              onClick={() => {
                void onReopenOperationalPeriod(row.id);
              }}
              variant="outline-warning"
              className="incident-form-action-btn"
              disabled={incidentActionLoading || !isAuthenticated || row.period.statusCode !== 'Approved'}
            />
            <IconActionButton
              iconClassName="bi bi-check2-square"
              tooltip="Approve operational period"
              ariaLabel="Approve operational period"
              onClick={() => {
                void onApproveOperationalPeriod(row.id);
              }}
              variant="outline-success"
              className="incident-form-action-btn"
              disabled={incidentActionLoading || !isAuthenticated || row.period.statusCode === 'Approved' || row.period.statusCode === 'Closed' || row.period.statusCode === 'Cancelled'}
            />
            <IconActionButton
              iconClassName="bi bi-pencil"
              tooltip="Edit operational period"
              ariaLabel="Edit operational period"
              onClick={() => beginOperationalPeriodEdit(row.period)}
              variant="outline-primary"
              className="incident-form-action-btn"
              disabled={incidentActionLoading || !isAuthenticated}
            />
          </div>
        );
      },
    },
  ], [beginOperationalPeriodEdit, cancelOperationalPeriodEdit, editingOperationalPeriodApprovedByUserIdInput, editingOperationalPeriodApprovedUtcInput, editingOperationalPeriodEndInput, editingOperationalPeriodId, editingOperationalPeriodNameInput, editingOperationalPeriodNumberInput, editingOperationalPeriodPlanningMeetingInput, editingOperationalPeriodStartInput, editingOperationalPeriodStatusInput, incidentActionLoading, isAuthenticated, onApproveOperationalPeriod, onReopenOperationalPeriod, saveOperationalPeriodEdit, savingOperationalPeriodEdit, taskAssignableUsers]);

  const objectivesGridRows = useMemo(() => incidentObjectives.map((objective) => ({
    id: objective.incidentObjectiveId,
    objective,
  })), [incidentObjectives]);

  const objectivesGridColumnDefs: ColDef<(typeof objectivesGridRows)[number]>[] = useMemo(() => [
    {
      headerName: '#',
      minWidth: 90,
      flex: 0.6,
      cellRenderer: (params: { data?: (typeof objectivesGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingObjectiveId !== row.id) {
          return row.objective.objectiveNumber;
        }

        return (
          <Form.Control
            size="sm"
            type="number"
            min={1}
            value={editingObjectiveNumberInput}
            onChange={(event) => setEditingObjectiveNumberInput(event.target.value)}
          />
        );
      },
    },
    {
      headerName: 'Objective',
      minWidth: 300,
      flex: 2,
      cellRenderer: (params: { data?: (typeof objectivesGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingObjectiveId !== row.id) {
          return row.objective.objectiveText;
        }

        return (
          <div className="d-flex flex-column gap-1">
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              value={editingObjectiveTextInput}
              onChange={(event) => setEditingObjectiveTextInput(event.target.value)}
            />
            <Form.Select
              size="sm"
              value={editingObjectivePeriodIdInput}
              onChange={(event) => setEditingObjectivePeriodIdInput(event.target.value)}
            >
              <option value="">No period link</option>
              {incidentOperationalPeriods.map((period) => (
                <option key={period.operationalPeriodId} value={period.operationalPeriodId}>
                  #{period.periodNumber} {period.periodName?.trim() ? `— ${period.periodName}` : ''}
                </option>
              ))}
            </Form.Select>
            <Form.Select
              size="sm"
              value={editingObjectiveOwnerUserIdInput}
              onChange={(event) => setEditingObjectiveOwnerUserIdInput(event.target.value)}
            >
              <option value="">Owner unassigned</option>
              {taskAssignableUsers.map((user) => (
                <option key={user.userId} value={user.userId}>{user.displayName}</option>
              ))}
            </Form.Select>
          </div>
        );
      },
    },
    {
      headerName: 'Priority',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { data?: (typeof objectivesGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingObjectiveId !== row.id) {
          return <Badge bg={priorityVariant(row.objective.priorityCode)}>{row.objective.priorityCode}</Badge>;
        }

        return (
          <Form.Select
            size="sm"
            value={editingObjectivePriorityInput}
            onChange={(event) => setEditingObjectivePriorityInput(event.target.value)}
          >
            <option value="Low">Low</option>
            <option value="Normal">Normal</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </Form.Select>
        );
      },
    },
    {
      headerName: 'Status',
      minWidth: 130,
      flex: 0.8,
      cellRenderer: (params: { data?: (typeof objectivesGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingObjectiveId !== row.id) {
          return <Badge bg={statusVariant(row.objective.statusCode)}>{row.objective.statusCode}</Badge>;
        }

        return (
          <Form.Select
            size="sm"
            value={editingObjectiveStatusInput}
            onChange={(event) => setEditingObjectiveStatusInput(event.target.value)}
          >
            <option value="Open">Open</option>
            <option value="InProgress">InProgress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </Form.Select>
        );
      },
    },
    {
      headerName: 'Due',
      minWidth: 170,
      flex: 1,
      cellRenderer: (params: { data?: (typeof objectivesGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (editingObjectiveId !== row.id) {
          return row.objective.dueUtc ? new Date(row.objective.dueUtc).toLocaleString() : '—';
        }

        return (
          <Form.Control
            size="sm"
            type="datetime-local"
            value={editingObjectiveDueInput}
            onChange={(event) => setEditingObjectiveDueInput(event.target.value)}
          />
        );
      },
    },
    {
      headerName: 'Actions',
      minWidth: 130,
      maxWidth: 180,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof objectivesGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;

        if (editingObjectiveId === row.id) {
          return (
            <div className="d-inline-flex gap-1">
              <IconActionButton
                iconClassName={savingObjectiveEdit ? 'bi bi-arrow-repeat' : 'bi bi-check2'}
                tooltip={savingObjectiveEdit ? 'Saving objective...' : 'Save objective updates'}
                ariaLabel="Save objective"
                onClick={saveObjectiveEdit}
                variant="outline-success"
                className="incident-form-action-btn"
                disabled={savingObjectiveEdit || incidentActionLoading || !isAuthenticated}
              />
              <IconActionButton
                iconClassName="bi bi-x"
                tooltip="Cancel edit"
                ariaLabel="Cancel objective edit"
                onClick={cancelObjectiveEdit}
                variant="outline-secondary"
                className="incident-form-action-btn"
                disabled={savingObjectiveEdit || incidentActionLoading}
              />
            </div>
          );
        }

        return (
          <IconActionButton
            iconClassName="bi bi-pencil"
            tooltip="Edit objective"
            ariaLabel="Edit objective"
            onClick={() => beginObjectiveEdit(row.objective)}
            variant="outline-primary"
            className="incident-form-action-btn"
            disabled={incidentActionLoading || !isAuthenticated}
          />
        );
      },
    },
  ], [beginObjectiveEdit, cancelObjectiveEdit, editingObjectiveDueInput, editingObjectiveId, editingObjectiveNumberInput, editingObjectiveOwnerUserIdInput, editingObjectivePeriodIdInput, editingObjectivePriorityInput, editingObjectiveStatusInput, editingObjectiveTextInput, incidentActionLoading, incidentOperationalPeriods, isAuthenticated, saveObjectiveEdit, savingObjectiveEdit, taskAssignableUsers]);

  const filteredResourceRequests = useMemo(() => {
    const source = resourceStatusFilter === 'All'
      ? resourceRequests
      : resourceRequests.filter((item) => item.statusCode === resourceStatusFilter);

    if (!resourceQueueFocusOnly || resourceStatusFilter !== 'All') {
      return source;
    }

    return source.filter((item) => item.statusCode === 'Requested' || item.statusCode === 'Approved' || item.statusCode === 'PartiallyFulfilled');
  }, [resourceRequests, resourceStatusFilter, resourceQueueFocusOnly]);

  const isGapTriagePresetActive = useMemo(() => (
    resourceStatusFilter === 'All'
    && resourceQueueFocusOnly
    && resourceQueueSortModeInput === 'LargestGap'
  ), [resourceStatusFilter, resourceQueueFocusOnly, resourceQueueSortModeInput]);

  const handleToggleGapTriagePreset = (enabled: boolean) => {
    if (enabled) {
      setResourceStatusFilter('All');
      setResourceQueueFocusOnly(true);
      setResourceQueueSortModeInput('LargestGap');
      return;
    }

    setResourceQueueFocusOnly(false);
    setResourceQueueSortModeInput('StatusPriorityAge');
  };

  const resourceQueueSummary = useMemo(() => {
    return filteredResourceRequests.reduce((current, item) => {
      const priorityCode = item.priorityCode.toLowerCase();
      const assignedQuantity = item.assignedQuantity ?? 0;
      const assignmentGap = Math.max(item.requestedQuantity - assignedQuantity, 0);
      if (item.statusCode === 'Requested' || item.statusCode === 'Approved' || item.statusCode === 'PartiallyFulfilled') {
        current.open += 1;
        current.totalRequestedOpen += item.requestedQuantity;
        current.totalAssignedOpen += assignedQuantity;
        current.totalGapOpen += assignmentGap;
        if (priorityCode === 'critical' || priorityCode === 'high') {
          current.highPriorityOpen += 1;
        }
      }
      else if (item.statusCode === 'Denied' || item.statusCode === 'Cancelled') {
        current.blocked += 1;
      }
      else if (item.statusCode === 'Fulfilled' || item.statusCode === 'Archived') {
        current.completed += 1;
      }

      return current;
    }, {
      open: 0,
      blocked: 0,
      completed: 0,
      highPriorityOpen: 0,
      totalRequestedOpen: 0,
      totalAssignedOpen: 0,
      totalGapOpen: 0,
    });
  }, [filteredResourceRequests]);

  const prioritizedResourceRequests = useMemo(() => {
    const statusRank = (statusCode: string) => {
      switch (statusCode) {
        case 'Requested': return 1;
        case 'Approved': return 2;
        case 'PartiallyFulfilled': return 3;
        case 'Fulfilled': return 4;
        case 'Denied': return 5;
        case 'Cancelled': return 6;
        case 'Archived': return 7;
        default: return 99;
      }
    };

    const priorityRank = (priorityCode: string) => {
      switch (priorityCode.toLowerCase()) {
        case 'critical': return 1;
        case 'high': return 2;
        case 'normal': return 3;
        case 'low': return 4;
        default: return 99;
      }
    };

    return [...filteredResourceRequests].sort((left, right) => {
      if (resourceQueueSortModeInput === 'LargestGap') {
        const leftGap = Math.max(left.requestedQuantity - (left.assignedQuantity ?? 0), 0);
        const rightGap = Math.max(right.requestedQuantity - (right.assignedQuantity ?? 0), 0);
        if (rightGap !== leftGap) {
          return rightGap - leftGap;
        }
      }

      const statusDelta = statusRank(left.statusCode) - statusRank(right.statusCode);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      const priorityDelta = priorityRank(left.priorityCode) - priorityRank(right.priorityCode);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return new Date(left.requestedUtc).getTime() - new Date(right.requestedUtc).getTime();
    });
  }, [filteredResourceRequests, resourceQueueSortModeInput]);

  const selectedResourceRequestIdSet = useMemo(() => new Set(selectedResourceRequestIds), [selectedResourceRequestIds]);

  const isAllVisibleResourceRequestsSelected = useMemo(() => {
    if (prioritizedResourceRequests.length === 0) {
      return false;
    }

    return prioritizedResourceRequests.every((item) => selectedResourceRequestIdSet.has(item.incidentResourceRequestId));
  }, [prioritizedResourceRequests, selectedResourceRequestIdSet]);

  const resourceQueueSections = useMemo(() => {
    const orderedStatuses = [
      'Requested',
      'Approved',
      'PartiallyFulfilled',
      'Fulfilled',
      'Denied',
      'Cancelled',
      'Archived',
    ];

    const displayName = (statusCode: string) => {
      switch (statusCode) {
        case 'PartiallyFulfilled':
          return 'Partially Fulfilled';
        default:
          return statusCode;
      }
    };

    const grouped = new Map<string, IncidentResourceRequest[]>();
    prioritizedResourceRequests.forEach((item) => {
      const current = grouped.get(item.statusCode);
      if (current) {
        current.push(item);
      } else {
        grouped.set(item.statusCode, [item]);
      }
    });

    const sections = orderedStatuses
      .filter((statusCode) => grouped.has(statusCode))
      .map((statusCode) => ({
        statusCode,
        label: displayName(statusCode),
        items: grouped.get(statusCode) ?? [],
      }));

    grouped.forEach((items, statusCode) => {
      if (orderedStatuses.includes(statusCode)) {
        return;
      }

      sections.push({
        statusCode,
        label: statusCode,
        items,
      });
    });

    return sections;
  }, [prioritizedResourceRequests]);

  const resourceRoutingLaneSummary = useMemo(() => {
    const findLaneCount = (statusCode: string) => resourceQueueSections.find((section) => section.statusCode === statusCode)?.items.length ?? 0;
    return {
      requested: findLaneCount('Requested'),
      approved: findLaneCount('Approved'),
      partiallyFulfilled: findLaneCount('PartiallyFulfilled'),
    };
  }, [resourceQueueSections]);

  const resourceLaneSelectionSummary = useMemo(() => {
    const summary = new Map<string, { total: number; selected: number }>();
    resourceQueueSections.forEach((section) => {
      summary.set(section.statusCode, {
        total: section.items.length,
        selected: section.items.filter((item) => selectedResourceRequestIdSet.has(item.incidentResourceRequestId)).length,
      });
    });

    return summary;
  }, [resourceQueueSections, selectedResourceRequestIdSet]);

  const regionResourceRollupGridRows = useMemo(() => regionResourceRollups.map((rollup) => ({
    id: rollup.regionName,
    regionName: rollup.regionName,
    resourceAvailable: rollup.resourceAvailable,
    resourceCommitted: rollup.resourceCommitted,
    resourceOutOfService: rollup.resourceOutOfService,
    bedsAvailable: rollup.bedsAvailable,
    bedsOccupied: rollup.bedsOccupied,
    bedsUnavailable: rollup.bedsUnavailable,
  })), [regionResourceRollups]);

  const regionResourceRollupColumnDefs: ColDef<(typeof regionResourceRollupGridRows)[number]>[] = useMemo(() => [
    { field: 'regionName', headerName: 'Region', minWidth: 160, flex: 1.2 },
    { field: 'resourceAvailable', headerName: 'Res Available', minWidth: 130, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'resourceCommitted', headerName: 'Res Committed', minWidth: 130, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'resourceOutOfService', headerName: 'Res OOS', minWidth: 110, flex: 0.9, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'bedsAvailable', headerName: 'Beds Available', minWidth: 130, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'bedsOccupied', headerName: 'Beds Occupied', minWidth: 130, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
    { field: 'bedsUnavailable', headerName: 'Beds Unavailable', minWidth: 140, flex: 1, type: 'numericColumn', cellClass: 'text-end' },
  ], []);

  const prioritizedResourceRequestsGridRows = useMemo(() => prioritizedResourceRequests.map((item) => ({
    id: item.incidentResourceRequestId,
    item,
  })), [prioritizedResourceRequests]);

  const prioritizedResourceRequestsGridColumnDefs: ColDef<(typeof prioritizedResourceRequestsGridRows)[number]>[] = useMemo(() => [
    {
      headerName: '',
      minWidth: 56,
      maxWidth: 72,
      sortable: false,
      filter: false,
      suppressMovable: true,
      pinned: 'left',
      cellRenderer: (params: { data?: (typeof prioritizedResourceRequestsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <Form.Check
            type="checkbox"
            id={`resource-row-select-${row.id}`}
            checked={selectedResourceRequestIdSet.has(row.id)}
            onChange={() => handleToggleResourceRowSelection(row.id)}
            aria-label={`Select resource request ${row.id}`}
          />
        );
      },
    },
    {
      headerName: 'Requested',
      minWidth: 170,
      flex: 1,
      valueGetter: (params) => params.data?.item.requestedUtc,
      valueFormatter: (params) => new Date(String(params.value)).toLocaleString(),
    },
    {
      headerName: 'Resource',
      minWidth: 200,
      flex: 1.3,
      cellRenderer: (params: { data?: (typeof prioritizedResourceRequestsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div>
            <div className="fw-semibold">{row.item.resourceTypeName}</div>
            <div className="small text-muted">{row.item.resourceTypeCode}</div>
          </div>
        );
      },
    },
    { headerName: 'Req Qty', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end', valueGetter: (params) => params.data?.item.requestedQuantity },
    { headerName: 'Asg Qty', minWidth: 100, flex: 0.8, type: 'numericColumn', cellClass: 'text-end', valueGetter: (params) => params.data?.item.assignedQuantity ?? '—' },
    {
      headerName: 'Gap',
      minWidth: 96,
      flex: 0.8,
      cellRenderer: (params: { data?: (typeof prioritizedResourceRequestsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        const gap = Math.max(row.item.requestedQuantity - (row.item.assignedQuantity ?? 0), 0);
        return <Badge bg={gap > 0 ? 'secondary' : 'success'}>{gap}</Badge>;
      },
    },
    {
      headerName: 'Asg Update',
      minWidth: 180,
      flex: 1.1,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: (typeof prioritizedResourceRequestsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div className="d-flex gap-1 align-items-center">
            <Form.Control
              size="sm"
              value={resourceRowAssignedQuantityDrafts[row.id] ?? (row.item.assignedQuantity === null ? '' : String(row.item.assignedQuantity))}
              onChange={(event) => handleResourceRowAssignedQuantityDraftChange(row.id, event.target.value)}
              placeholder="qty"
            />
            <IconActionButton
              iconClassName="bi bi-check2"
              tooltip="Apply assigned quantity update"
              ariaLabel="Apply assigned quantity update"
              onClick={() => handleApplyResourceRowAssignedQuantity(row.item)}
              variant="outline-primary"
              className="incident-form-action-btn"
              disabled={resourceRequestsLoading}
            />
          </div>
        );
      },
    },
    { headerName: 'UOM', minWidth: 96, flex: 0.8, valueGetter: (params) => params.data?.item.unitOfMeasureCode },
    {
      headerName: 'Priority',
      minWidth: 110,
      flex: 0.8,
      cellRenderer: (params: { data?: (typeof prioritizedResourceRequestsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return <Badge bg={priorityVariant(row.item.priorityCode)}>{row.item.priorityCode}</Badge>;
      },
    },
    {
      headerName: 'Status',
      minWidth: 120,
      flex: 0.9,
      cellRenderer: (params: { data?: (typeof prioritizedResourceRequestsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return <Badge bg={row.item.statusCode === 'Archived' ? 'danger' : statusVariant(row.item.statusCode)}>{row.item.statusCode}</Badge>;
      },
    },
    {
      headerName: 'Routing',
      minWidth: 280,
      flex: 2,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: (typeof prioritizedResourceRequestsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        const item = row.item;
        return (
          <div className="d-flex flex-wrap gap-1">
            {(item.statusCode === 'Requested' || item.statusCode === 'Approved' || item.statusCode === 'PartiallyFulfilled') && (
              <>
                <IconActionButton iconClassName="bi bi-plus-slash-minus" tooltip="Set assigned quantity to requested quantity" ariaLabel="Set assigned quantity to requested quantity" onClick={() => handleUpdateResourceAssignedQuantity(item, item.requestedQuantity)} variant="outline-primary" disabled={resourceRequestsLoading || item.assignedQuantity === item.requestedQuantity} />
                <IconActionButton iconClassName="bi bi-eraser" tooltip="Clear assigned quantity" ariaLabel="Clear assigned quantity" onClick={() => handleUpdateResourceAssignedQuantity(item, null)} variant="outline-secondary" disabled={resourceRequestsLoading || item.assignedQuantity === null} />
              </>
            )}
            {item.statusCode === 'Requested' && (
              <>
                <IconActionButton iconClassName="bi bi-check2-square" tooltip="Approve resource request" ariaLabel="Approve resource request" onClick={() => handleTransitionResourceRequestStatus(item, 'Approved')} variant="outline-success" disabled={resourceRequestsLoading} />
                <IconActionButton iconClassName="bi bi-x-octagon" tooltip="Deny resource request" ariaLabel="Deny resource request" onClick={() => handleTransitionResourceRequestStatus(item, 'Denied')} variant="outline-danger" disabled={resourceRequestsLoading} />
              </>
            )}
            {item.statusCode === 'Approved' && (
              <>
                <IconActionButton iconClassName="bi bi-hourglass-split" tooltip="Mark partially fulfilled" ariaLabel="Mark resource request partially fulfilled" onClick={() => handleTransitionResourceRequestStatus(item, 'PartiallyFulfilled')} variant="outline-primary" disabled={resourceRequestsLoading} />
                <IconActionButton iconClassName="bi bi-check2-all" tooltip="Mark fulfilled" ariaLabel="Mark resource request fulfilled" onClick={() => handleTransitionResourceRequestStatus(item, 'Fulfilled')} variant="outline-success" disabled={resourceRequestsLoading} />
              </>
            )}
            {item.statusCode === 'PartiallyFulfilled' && (
              <IconActionButton iconClassName="bi bi-check2-all" tooltip="Mark fulfilled" ariaLabel="Mark resource request fulfilled" onClick={() => handleTransitionResourceRequestStatus(item, 'Fulfilled')} variant="outline-success" disabled={resourceRequestsLoading} />
            )}
            {(item.statusCode === 'Requested' || item.statusCode === 'Approved' || item.statusCode === 'PartiallyFulfilled') && (
              <IconActionButton iconClassName="bi bi-x-circle" tooltip="Cancel resource request" ariaLabel="Cancel resource request" onClick={() => handleTransitionResourceRequestStatus(item, 'Cancelled')} variant="outline-warning" disabled={resourceRequestsLoading} />
            )}
            {(item.statusCode === 'Fulfilled' || item.statusCode === 'Denied' || item.statusCode === 'Cancelled') && (
              <IconActionButton iconClassName="bi bi-archive" tooltip="Archive resource request" ariaLabel="Archive resource request" onClick={() => handleTransitionResourceRequestStatus(item, 'Archived')} variant="outline-secondary" disabled={resourceRequestsLoading} />
            )}
          </div>
        );
      },
    },
    {
      headerName: '',
      minWidth: 110,
      maxWidth: 140,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof prioritizedResourceRequestsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div className="text-end d-flex gap-2 justify-content-end">
            <IconActionButton iconClassName="bi bi-pencil" tooltip="Edit resource request" ariaLabel="Edit resource request" onClick={() => handleEditResourceRequest(row.item)} variant="outline-secondary" />
            <IconActionButton iconClassName={row.item.statusCode === 'Archived' ? 'bi bi-arrow-counterclockwise' : 'bi bi-archive'} tooltip={row.item.statusCode === 'Archived' ? 'Unarchive resource request' : 'Archive resource request'} ariaLabel={row.item.statusCode === 'Archived' ? 'Unarchive resource request' : 'Archive resource request'} onClick={() => handleArchiveResourceRequest(row.item)} variant="outline-secondary" />
          </div>
        );
      },
    },
  ], [resourceRequestsLoading, selectedResourceRequestIdSet, resourceRowAssignedQuantityDrafts]);

  const notificationRecipientsDraftGridRows = useMemo(() => notificationRecipientsDraft.map((recipient, index) => ({
    id: `${index}-${recipient.channelCode}-${recipient.destinationAddress}`,
    index,
    channelCode: recipient.channelCode,
    destinationAddress: recipient.destinationAddress,
    principalLabel: `U:${recipient.userId ?? '—'} C:${recipient.contactId ?? '—'} L:${recipient.locationId ?? '—'}`,
  })), [notificationRecipientsDraft]);

  const notificationRecipientsDraftGridColumnDefs: ColDef<(typeof notificationRecipientsDraftGridRows)[number]>[] = useMemo(() => [
    { field: 'channelCode', headerName: 'Channel', minWidth: 120, flex: 0.8 },
    { field: 'destinationAddress', headerName: 'Destination', minWidth: 260, flex: 1.4, cellClass: 'small text-muted' },
    { field: 'principalLabel', headerName: 'Principal', minWidth: 220, flex: 1.3, cellClass: 'small text-muted' },
    {
      headerName: 'Actions',
      minWidth: 100,
      maxWidth: 130,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof notificationRecipientsDraftGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div className="text-end">
            <IconActionButton
              iconClassName="bi bi-trash"
              tooltip="Remove staged recipient"
              ariaLabel="Remove staged recipient"
              onClick={() => handleRemoveNotificationRecipient(row.index)}
              variant="outline-danger"
            />
          </div>
        );
      },
    },
  ], []);

  const filteredCommunicationsGridRows = useMemo(() => filteredCommunications.map((item) => ({
    id: item.incidentCommunicationId,
    item,
    notificationId: getNotificationIdForCommunication(item.incidentCommunicationId),
  })), [filteredCommunications, communications]);

  const filteredCommunicationsGridColumnDefs: ColDef<(typeof filteredCommunicationsGridRows)[number]>[] = useMemo(() => [
    {
      headerName: 'Logged',
      minWidth: 170,
      flex: 1,
      valueGetter: (params) => params.data?.item.loggedUtc,
      valueFormatter: (params) => new Date(String(params.value)).toLocaleString(),
    },
    {
      headerName: 'Channel',
      minWidth: 110,
      flex: 0.8,
      cellRenderer: (params: { data?: (typeof filteredCommunicationsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return <Badge bg="secondary">{row.item.channelCode}</Badge>;
      },
    },
    { headerName: 'Direction', minWidth: 110, flex: 0.8, valueGetter: (params) => params.data?.item.directionCode },
    { headerName: 'Subject', minWidth: 180, flex: 1.2, valueGetter: (params) => params.data?.item.subject },
    { headerName: 'Message', minWidth: 250, flex: 1.7, valueGetter: (params) => params.data?.item.message, cellClass: 'small text-muted' },
    {
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { data?: (typeof filteredCommunicationsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return <Badge bg={statusVariant(row.item.statusCode)}>{row.item.statusCode}</Badge>;
      },
    },
    {
      headerName: 'Notification',
      minWidth: 170,
      flex: 1,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: (typeof filteredCommunicationsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        if (!row.notificationId) {
          return <span className="small text-muted">—</span>;
        }
        return (
          <div className="d-flex align-items-center gap-2">
            <Badge bg="info">#{row.notificationId}</Badge>
            <IconActionButton
              iconClassName="bi bi-people"
              tooltip="Load recipients for this communication notification"
              ariaLabel={`Load recipients for notification ${row.notificationId}`}
              onClick={() => {
                void loadNotificationRecipientsByNotificationId(row.notificationId as number);
              }}
              variant="outline-secondary"
              disabled={notificationRecipientsLoading}
            />
          </div>
        );
      },
    },
    {
      headerName: 'Actions',
      minWidth: 120,
      maxWidth: 150,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof filteredCommunicationsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div className="text-end d-flex gap-2 justify-content-end">
            <IconActionButton
              iconClassName="bi bi-flag"
              tooltip="Mark communication as needs follow-up"
              ariaLabel="Mark communication as needs follow-up"
              onClick={() => handleSetCommunicationCoordinationStatus(row.item, 'NeedsFollowUp')}
              variant="outline-warning"
              disabled={communicationsLoading || row.item.statusCode === 'NeedsFollowUp'}
            />
            <IconActionButton
              iconClassName="bi bi-exclamation-octagon"
              tooltip="Mark communication as escalated"
              ariaLabel="Mark communication as escalated"
              onClick={() => handleSetCommunicationCoordinationStatus(row.item, 'Escalated')}
              variant="outline-danger"
              disabled={communicationsLoading || row.item.statusCode === 'Escalated'}
            />
            <IconActionButton
              iconClassName="bi bi-pencil"
              tooltip="Edit communication entry"
              ariaLabel="Edit communication entry"
              onClick={() => handleEditCommunication(row.item)}
              variant="outline-secondary"
            />
            <IconActionButton
              iconClassName={row.item.statusCode === 'Archived' ? 'bi bi-arrow-counterclockwise' : 'bi bi-archive'}
              tooltip={row.item.statusCode === 'Archived' ? 'Unarchive communication entry' : 'Archive communication entry'}
              ariaLabel={row.item.statusCode === 'Archived' ? 'Unarchive communication entry' : 'Archive communication entry'}
              onClick={() => handleArchiveCommunication(row.item)}
              variant="outline-secondary"
            />
          </div>
        );
      },
    },
  ], [notificationRecipientsLoading, communicationsLoading]);

  const notificationRecipientsGridRows = useMemo(() => notificationRecipients.map((recipient) => ({
    id: recipient.notificationRecipientId,
    recipient,
  })), [notificationRecipients]);

  const notificationRecipientsGridColumnDefs: ColDef<(typeof notificationRecipientsGridRows)[number]>[] = useMemo(() => [
    {
      headerName: 'Recipient',
      minWidth: 250,
      flex: 1.6,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div>
            <div className="small">{row.recipient.destinationAddress}</div>
            <div className="small text-muted">U:{row.recipient.userId ?? '—'} C:{row.recipient.contactId ?? '—'} L:{row.recipient.locationId ?? '—'}</div>
          </div>
        );
      },
    },
    { headerName: 'Channel', minWidth: 110, flex: 0.8, valueGetter: (params) => params.data?.recipient.channelCode },
    {
      headerName: 'Status',
      minWidth: 140,
      flex: 1,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <Form.Select
            size="sm"
            value={notificationRecipientStatusSelection[row.id] ?? row.recipient.deliveryStatusCode}
            onChange={(event) => setNotificationRecipientStatusSelection((current) => ({
              ...current,
              [row.id]: event.target.value as UpdateRecipientDeliveryStatusRequest['deliveryStatusCode'],
            }))}
          >
            <option value="Queued">Queued</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
            <option value="Suppressed">Suppressed</option>
            <option value="Cancelled">Cancelled</option>
          </Form.Select>
        );
      },
    },
    {
      headerName: 'Failure Reason',
      minWidth: 180,
      flex: 1.2,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <Form.Control
            size="sm"
            value={notificationRecipientFailureReasonInput[row.id] ?? ''}
            onChange={(event) => setNotificationRecipientFailureReasonInput((current) => ({
              ...current,
              [row.id]: event.target.value,
            }))}
            placeholder="Optional for Failed"
          />
        );
      },
    },
    {
      headerName: 'Ack Note',
      minWidth: 160,
      flex: 1.1,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <Form.Control
            size="sm"
            value={notificationRecipientAckNoteInput[row.id] ?? ''}
            onChange={(event) => setNotificationRecipientAckNoteInput((current) => ({
              ...current,
              [row.id]: event.target.value,
            }))}
            placeholder="Ack note"
          />
        );
      },
    },
    {
      headerName: 'Actions',
      minWidth: 140,
      maxWidth: 180,
      sortable: false,
      filter: false,
      pinned: 'right',
      suppressMovable: true,
      cellRenderer: (params: { data?: (typeof notificationRecipientsGridRows)[number] }) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div className="d-flex justify-content-end gap-2">
            <IconActionButton
              iconClassName="bi bi-check2-square"
              tooltip="Update recipient status"
              ariaLabel={`Update recipient status ${row.id}`}
              onClick={() => handleUpdateNotificationRecipientStatus(row.recipient)}
              variant="outline-primary"
              disabled={notificationRecipientsLoading}
            />
            <IconActionButton
              iconClassName="bi bi-check2-circle"
              tooltip="Acknowledge recipient"
              ariaLabel={`Acknowledge recipient ${row.id}`}
              onClick={() => handleAcknowledgeNotificationRecipient(row.recipient)}
              variant="outline-success"
              disabled={notificationRecipientsLoading}
            />
          </div>
        );
      },
    },
  ], [notificationRecipientAckNoteInput, notificationRecipientFailureReasonInput, notificationRecipientStatusSelection, notificationRecipientsLoading]);

  const ics201CommandAssignmentsRows = useMemo(() => {
    const source = (ics201Data?.commandAssignments?.length ?? 0) > 0
      ? (ics201Data?.commandAssignments ?? [])
      : incidentCommandAssignments;

    return source.map((assignment) => ({
      id: assignment.incidentCommandAssignmentId,
      positionName: assignment.positionName,
      icsSection: assignment.icsSection,
      assignedTo: assignment.assignedUserDisplayName || assignment.assignedContactName || (assignment.assignedUserId ? `User #${assignment.assignedUserId}` : '—'),
      assignmentStatusCode: assignment.assignmentStatusCode,
    }));
  }, [ics201Data, incidentCommandAssignments]);

  const ics201CommandAssignmentsColumnDefs: ColDef<(typeof ics201CommandAssignmentsRows)[number]>[] = useMemo(() => [
    { field: 'positionName', headerName: 'Position', minWidth: 170, flex: 1.2 },
    { field: 'icsSection', headerName: 'Section', minWidth: 150, flex: 1 },
    { field: 'assignedTo', headerName: 'Assigned To', minWidth: 190, flex: 1.3 },
    {
      field: 'assignmentStatusCode',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { value?: string }) => <Badge bg={statusVariant(params.value ?? '')}>{params.value ?? '—'}</Badge>,
    },
  ], []);

  const ics203AssignmentsRows = useMemo(() => (ics203Data?.assignments ?? []).map((assignment) => ({
    id: assignment.incidentCommandAssignmentId,
    icsSection: assignment.icsSection,
    positionName: assignment.positionName,
    assignedTo: assignment.assignedUserDisplayName || assignment.assignedContactName || '—',
  })), [ics203Data]);

  const ics203AssignmentsColumnDefs: ColDef<(typeof ics203AssignmentsRows)[number]>[] = useMemo(() => [
    { field: 'icsSection', headerName: 'Section', minWidth: 150, flex: 1 },
    { field: 'positionName', headerName: 'Position', minWidth: 180, flex: 1.2 },
    { field: 'assignedTo', headerName: 'Assigned To', minWidth: 200, flex: 1.3 },
  ], []);

  const liveCommandAssignmentsRows = useMemo(() => incidentCommandAssignments.map((assignment) => ({
    id: `live-${assignment.incidentCommandAssignmentId}-${assignment.icsPositionId}`,
    icsSection: assignment.icsSection,
    positionName: assignment.positionName,
    assignedTo: assignment.assignedUserDisplayName || assignment.assignedContactName || '—',
  })), [incidentCommandAssignments]);

  const liveCommandAssignmentsColumnDefs: ColDef<(typeof liveCommandAssignmentsRows)[number]>[] = useMemo(() => [
    { field: 'icsSection', headerName: 'Section', minWidth: 150, flex: 1 },
    { field: 'positionName', headerName: 'Position', minWidth: 180, flex: 1.2 },
    { field: 'assignedTo', headerName: 'Assigned To', minWidth: 200, flex: 1.3 },
  ], []);

  const icsCommandStructureRows = useMemo<IcsCommandStructureGridRow[]>(() => icsPositions.map((position) => {
    const normalizedPositionCode = normalizePositionKey(position.positionCode);
    const normalizedPositionName = normalizePositionKey(position.positionName);
    const assignment = incidentCommandAssignments.find((item) => item.icsPositionId === position.icsPositionId)
      ?? incidentCommandAssignments.find((item) => normalizePositionKey(item.positionCode) === normalizedPositionCode)
      ?? incidentCommandAssignments.find((item) => normalizePositionKey(item.positionName) === normalizedPositionName);
    const optimisticAssignedDisplayName = optimisticAssignedUsers[position.icsPositionId] ?? null;
    const isAssigned = assignment !== undefined || optimisticAssignedDisplayName !== null;
    const assignedTo = assignment?.assignedUserDisplayName
      ?? assignment?.assignedContactName
      ?? (assignment?.assignedUserId ? `User #${assignment.assignedUserId}` : null)
      ?? optimisticAssignedDisplayName
      ?? '—';
    const avatarRoleColors = resolveIcsRoleAvatarColors(position.positionCode);
    const assignedInitials = assignedTo === '—' ? 'VA' : getInitialsFromDisplayName(assignedTo);

    return {
      id: `ics-position-${position.icsPositionId}`,
      icsPositionId: position.icsPositionId,
      positionName: position.positionName,
      positionCode: position.positionCode,
      icsSection: position.icsSection,
      assignmentStatus: isAssigned ? 'Assigned' : 'Vacant',
      assignedTo,
      assignedInitials,
      avatarBgColor: avatarRoleColors.bgColor,
      avatarTextColor: avatarRoleColors.textColor,
      roleColorLegend: avatarRoleColors.legend,
      agency: assignment?.agencyOrganizationName ?? '—',
      notes: assignment?.notes ?? '—',
    };
  }), [icsPositions, incidentCommandAssignments, optimisticAssignedUsers]);

  const icsCommandStructureColumnDefs: ColDef<IcsCommandStructureGridRow>[] = useMemo(() => [
    { field: 'icsSection', headerName: 'Section', minWidth: 150, flex: 1 },
    { field: 'positionCode', headerName: 'Code', minWidth: 120, flex: 0.7, cellClass: 'text-uppercase' },
    { field: 'positionName', headerName: 'Position', minWidth: 210, flex: 1.3 },
    {
      field: 'assignmentStatus',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { value?: IcsCommandStructureGridRow['assignmentStatus'] }) => {
        const value = params.value ?? 'Vacant';
        return <Badge bg={value === 'Assigned' ? 'success' : 'secondary'}>{value}</Badge>;
      },
    },
    {
      field: 'assignedTo',
      headerName: 'Assigned To',
      minWidth: 260,
      flex: 1.5,
      cellRenderer: (params: { data?: IcsCommandStructureGridRow }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        return (
          <div className="d-flex align-items-center gap-2">
            <span
              className="rounded-circle d-inline-flex align-items-center justify-content-center fw-semibold"
              title={row.roleColorLegend}
              style={{
                width: 28,
                height: 28,
                backgroundColor: row.avatarBgColor,
                color: row.avatarTextColor,
                fontSize: '0.72rem',
                border: `1px solid ${row.avatarTextColor}`,
              }}
            >
              {row.assignedInitials}
            </span>
            <div className="d-flex flex-column">
              <span>{row.assignedTo}</span>
              <small className="text-muted">{row.roleColorLegend}</small>
            </div>
          </div>
        );
      },
    },
    { field: 'agency', headerName: 'Agency', minWidth: 180, flex: 1.1 },
    { field: 'notes', headerName: 'Notes', minWidth: 220, flex: 1.4, cellClass: 'text-truncate' },
    {
      colId: 'actions',
      headerName: 'Actions',
      minWidth: 140,
      maxWidth: 170,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: IcsCommandStructureGridRow }) => {
        const row = params.data;
        if (!row) {
          return null;
        }

        if (row.assignmentStatus === 'Assigned') {
          return (
            <div className="d-flex justify-content-end">
              <IconActionButton
                iconClassName="bi bi-person-dash"
                tooltip={`Unassign ${row.positionName}`}
                ariaLabel={`Unassign ${row.positionName}`}
                onClick={() => {
                  setOptimisticAssignedUsers((current) => {
                    if (!(row.icsPositionId in current)) {
                      return current;
                    }

                    const next = { ...current };
                    delete next[row.icsPositionId];
                    return next;
                  });
                  onRemoveCommandAssignment(row.icsPositionId);
                }}
                variant="outline-danger"
                disabled={!isAuthenticated || incidentActionLoading}
              />
            </div>
          );
        }

        return (
          <div className="d-flex justify-content-end">
            <IconActionButton
              iconClassName="bi bi-person-plus"
              tooltip={`Assign user to ${row.positionName}`}
              ariaLabel={`Assign user to ${row.positionName}`}
              onClick={() => {
                setSelectedPositionForAssignment(row.icsPositionId);
                setShowUserPicker(true);
              }}
              variant="outline-primary"
              disabled={!isAuthenticated || incidentActionLoading}
            />
          </div>
        );
      },
    },
  ], [incidentActionLoading, isAuthenticated, onRemoveCommandAssignment]);

  const incidentCommandTransferLogRows = useMemo<IncidentCommandTransferLogGridRow[]>(() => commandTransferLogRows.map((row, index) => {
    const raw = row as unknown as Record<string, unknown>;
    const notes = typeof raw.notes === 'string' ? raw.notes : '';
    const commandPostMatch = notes.match(/CommandPost:\s*([^|]+)/i);
    const transferSummaryMatch = notes.match(/Transfer:\s*([^|]+)/i);

    const idValue = raw.incidentCommandTransferLogEntryId ?? raw.incidentCommandAssignmentId ?? index;
    const transferUtcValue = raw.transferUtc ?? raw.assignedFromUtc ?? raw.createdUtc ?? '';
    const sectionValue = typeof raw.icsSection === 'string' ? raw.icsSection : '—';
    const positionValue = typeof raw.positionName === 'string' ? raw.positionName : '—';
    const assignedUserDisplayName = typeof raw.assignedUserDisplayName === 'string' ? raw.assignedUserDisplayName : '';
    const assignedContactName = typeof raw.assignedContactName === 'string' ? raw.assignedContactName : '';
    const commandPostLocation = typeof raw.commandPostLocation === 'string' ? raw.commandPostLocation : '';
    const transferSummary = typeof raw.transferSummary === 'string' ? raw.transferSummary : '';
    const statusCodeValue = typeof raw.statusCode === 'string'
      ? raw.statusCode
      : typeof raw.assignmentStatusCode === 'string'
        ? raw.assignmentStatusCode
        : 'Unknown';

    return {
      id: `command-transfer-${String(idValue)}`,
      transferUtc: String(transferUtcValue),
      icsSection: sectionValue,
      positionName: positionValue,
      assignedTo: assignedUserDisplayName || assignedContactName || '—',
      commandPost: commandPostLocation || commandPostMatch?.[1]?.trim() || '—',
      transferSummary: transferSummary || transferSummaryMatch?.[1]?.trim() || '—',
      statusCode: statusCodeValue,
      transferDateUtc: String(transferUtcValue),
    };
  }), [commandTransferLogRows]);

  const transferStatusFilterOptions = useMemo(() => {
    const options = Array.from(new Set(incidentCommandTransferLogRows.map((row) => row.statusCode).filter((value) => value && value !== '—')))
      .sort((left, right) => left.localeCompare(right));
    return ['All', ...options];
  }, [incidentCommandTransferLogRows]);

  const transferSectionFilterOptions = useMemo(() => {
    const options = Array.from(new Set(incidentCommandTransferLogRows.map((row) => row.icsSection).filter((value) => value && value !== '—')))
      .sort((left, right) => left.localeCompare(right));
    return ['All', ...options];
  }, [incidentCommandTransferLogRows]);

  const filteredIncidentCommandTransferLogRows = useMemo(() => {
    const fromUtc = transferDateFromFilter.trim().length > 0 ? new Date(transferDateFromFilter).getTime() : null;
    const toUtc = transferDateToFilter.trim().length > 0 ? new Date(`${transferDateToFilter}T23:59:59.999`).getTime() : null;

    return incidentCommandTransferLogRows.filter((row) => {
      if (transferStatusFilter !== 'All' && row.statusCode !== transferStatusFilter) {
        return false;
      }

      if (transferSectionFilter !== 'All' && row.icsSection !== transferSectionFilter) {
        return false;
      }

      if (fromUtc !== null || toUtc !== null) {
        const rowUtc = new Date(row.transferDateUtc).getTime();
        if (Number.isNaN(rowUtc)) {
          return false;
        }

        if (fromUtc !== null && rowUtc < fromUtc) {
          return false;
        }

        if (toUtc !== null && rowUtc > toUtc) {
          return false;
        }
      }

      return true;
    });
  }, [incidentCommandTransferLogRows, transferStatusFilter, transferSectionFilter, transferDateFromFilter, transferDateToFilter]);

  const handleClearTransferFilters = () => {
    setTransferStatusFilter('All');
    setTransferSectionFilter('All');
    setTransferDateFromFilter('');
    setTransferDateToFilter('');
  };

  const handleApplyTransferQuickRange = (range: TransferQuickRangeKey) => {
    const now = new Date();

    if (range === 'today') {
      const today = toDateInputValue(now);
      setTransferDateFromFilter(today);
      setTransferDateToFilter(today);
      return;
    }

    if (range === 'last24h') {
      const previous = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      setTransferDateFromFilter(toDateInputValue(previous));
      setTransferDateToFilter(toDateInputValue(now));
      return;
    }

    const previous = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    setTransferDateFromFilter(toDateInputValue(previous));
    setTransferDateToFilter(toDateInputValue(now));
  };

  const handleApplyTransferFilterPreset = (preset: TransferFilterPreset) => {
    setTransferStatusFilter(preset.statusFilter || 'All');
    setTransferSectionFilter(preset.sectionFilter || 'All');
    setTransferDateFromFilter(preset.dateFromFilter || '');
    setTransferDateToFilter(preset.dateToFilter || '');
    onNotify?.(`Applied transfer filter preset: ${preset.name}`, 'info');
  };

  const handleSaveTransferFilterPreset = async () => {
    const normalizedName = transferFilterPresetNameInput.trim();
    if (!normalizedName) {
      onNotify?.('Preset name is required before saving transfer filters.', 'warning');
      return;
    }

    const nextPreset: TransferFilterPreset = {
      id: `local-${Date.now()}`,
      name: normalizedName,
      statusFilter: transferStatusFilter,
      sectionFilter: transferSectionFilter,
      dateFromFilter: transferDateFromFilter,
      dateToFilter: transferDateToFilter,
    };

    const existing = transferFilterPresets.filter((preset) => preset.name.toLowerCase() !== normalizedName.toLowerCase());
    const localNext = [nextPreset, ...existing].slice(0, 12);

    try {
      if (isAuthenticated) {
        const api = await import('../../api');
        const userReportPresetId = await api.upsertUserReportPreset(transferFilterPresetScope, {
          presetName: normalizedName,
          presetJson: JSON.stringify({
            statusFilter: transferStatusFilter,
            sectionFilter: transferSectionFilter,
            dateFromFilter: transferDateFromFilter,
            dateToFilter: transferDateToFilter,
          }),
        });

        const merged = localNext.map((preset) => (
          preset.id === nextPreset.id
            ? { ...preset, id: `server-${userReportPresetId}`, userReportPresetId }
            : preset
        ));
        setTransferFilterPresets(merged);
        localStorage.setItem(transferFilterPresetLocalStorageKey, JSON.stringify(merged));
        setTransferFilterPresetNameInput('');
        onNotify?.('Transfer filter preset saved.', 'success');
        return;
      }
    } catch (error) {
      console.error('Failed to save transfer filter preset to server; using local fallback.', error);
    }

    setTransferFilterPresets(localNext);
    localStorage.setItem(transferFilterPresetLocalStorageKey, JSON.stringify(localNext));
    setTransferFilterPresetNameInput('');
    onNotify?.('Transfer filter preset saved locally.', 'success');
  };

  const handleDeleteTransferFilterPreset = async (preset: TransferFilterPreset) => {
    try {
      if (isAuthenticated && preset.userReportPresetId) {
        const api = await import('../../api');
        await api.deleteUserReportPreset(transferFilterPresetScope, preset.userReportPresetId);
      }
    } catch (error) {
      console.error('Failed to delete transfer filter preset from server; removing locally.', error);
    }

    const next = transferFilterPresets.filter((item) => item.id !== preset.id);
    setTransferFilterPresets(next);
    localStorage.setItem(transferFilterPresetLocalStorageKey, JSON.stringify(next));
    onNotify?.('Transfer filter preset removed.', 'info');
  };

  const handleExportTransferLedgerCsv = () => {
    if (filteredIncidentCommandTransferLogRows.length === 0) {
      onNotify?.('No transfer rows available for export in the current filter scope.', 'warning');
      return;
    }

    const csvRows = [
      ['TransferUtc', 'Section', 'Position', 'AssignedTo', 'CommandPost', 'TransferSummary', 'Status'],
      ...filteredIncidentCommandTransferLogRows.map((row) => [
        row.transferUtc,
        row.icsSection,
        row.positionName,
        row.assignedTo,
        row.commandPost,
        row.transferSummary,
        row.statusCode,
      ]),
    ];

    const csv = csvRows
      .map((row) => row.map((value) => toCsvCell(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(`incident-${selectedIncidentId ?? 'transfer'}-command-transfer-ledger.csv`, blob);
    onNotify?.('Command transfer ledger CSV exported.', 'success');
  };

  const handleExportTransferLedgerJson = () => {
    if (filteredIncidentCommandTransferLogRows.length === 0) {
      onNotify?.('No transfer rows available for JSON export in the current filter scope.', 'warning');
      return;
    }

    const payload = {
      generatedUtc: new Date().toISOString(),
      incidentId: selectedIncidentId,
      filters: {
        status: transferStatusFilter,
        section: transferSectionFilter,
        dateFromUtc: transferDateFromFilter || null,
        dateToUtc: transferDateToFilter || null,
      },
      rowCount: filteredIncidentCommandTransferLogRows.length,
      rows: filteredIncidentCommandTransferLogRows,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    downloadBlob(`incident-${selectedIncidentId ?? 'transfer'}-command-transfer-ledger.json`, blob);
    onNotify?.('Command transfer ledger JSON exported.', 'success');
  };

  const handleOpenIcsWorkflowGuide = () => {
    const helpUrl = new URL(window.location.pathname, window.location.origin);
    helpUrl.searchParams.set('help', '1');
    helpUrl.searchParams.set('view', 'incidents');
    helpUrl.hash = 'topic=incidents-command-workspace&link=incidents-ics-workflow-context-diagram';
    window.open(helpUrl.toString(), '_blank');
  };

  const transferLedgerSummary = useMemo(() => {
    const latestTransferUtc = filteredIncidentCommandTransferLogRows.length > 0
      ? filteredIncidentCommandTransferLogRows
        .map((row) => new Date(row.transferDateUtc).getTime())
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => right - left)[0] ?? null
      : null;

    const sectionCount = new Set(filteredIncidentCommandTransferLogRows.map((row) => row.icsSection)).size;

    return {
      totalRows: incidentCommandTransferLogRows.length,
      inScopeRows: filteredIncidentCommandTransferLogRows.length,
      sectionCount,
      latestTransferUtc: latestTransferUtc ? new Date(latestTransferUtc).toLocaleString() : '—',
    };
  }, [filteredIncidentCommandTransferLogRows, incidentCommandTransferLogRows.length]);

  const transferInsightSignal = useMemo(() => {
    const latestUtcMillis = incidentCommandTransferLogRows
      .map((row) => new Date(row.transferDateUtc).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => right - left)[0] ?? null;

    if (latestUtcMillis === null) {
      return {
        label: 'Transfer signal NO LOG',
        variant: 'warning' as const,
        detail: 'No command transfer entries logged',
      };
    }

    const hoursSinceLatest = Math.floor((Date.now() - latestUtcMillis) / (60 * 60 * 1000));
    if (hoursSinceLatest > 24) {
      return {
        label: 'Transfer signal WATCH',
        variant: 'warning' as const,
        detail: `Latest transfer ${hoursSinceLatest}h ago`,
      };
    }

    return {
      label: 'Transfer signal STABLE',
      variant: 'success' as const,
      detail: `Latest transfer ${hoursSinceLatest}h ago`,
    };
  }, [incidentCommandTransferLogRows]);

  const incidentCommandTransferLogColumnDefs: ColDef<IncidentCommandTransferLogGridRow>[] = useMemo(() => [
    {
      field: 'transferUtc',
      headerName: 'Transfer UTC',
      minWidth: 170,
      flex: 1,
      valueFormatter: (params) => (params.value ? new Date(String(params.value)).toLocaleString() : '—'),
    },
    { field: 'icsSection', headerName: 'Section', minWidth: 140, flex: 1 },
    { field: 'positionName', headerName: 'Position', minWidth: 180, flex: 1.1 },
    { field: 'assignedTo', headerName: 'Assigned To', minWidth: 180, flex: 1.2 },
    { field: 'commandPost', headerName: 'Command Post', minWidth: 180, flex: 1.2 },
    { field: 'transferSummary', headerName: 'Transfer Summary', minWidth: 220, flex: 1.4, cellClass: 'text-truncate' },
    {
      field: 'statusCode',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { value?: string }) => {
        const status = params.value ?? 'Unknown';
        const statusNormalized = status.toLowerCase();
        const bg = statusNormalized === 'assigned' || statusNormalized === 'accepted'
          ? 'success'
          : statusNormalized === 'released'
            ? 'secondary'
            : 'info';
        return <Badge bg={bg}>{status}</Badge>;
      },
    },
  ], []);

  const ics205CommunicationsRows = useMemo(() => (ics205Data?.activeCommunications ?? []).slice(0, 25).map((communication) => ({
    id: communication.incidentCommunicationId,
    loggedUtc: communication.loggedUtc,
    channelCode: communication.channelCode,
    directionCode: communication.directionCode,
    subject: communication.subject,
  })), [ics205Data]);

  const ics205CommunicationsColumnDefs: ColDef<(typeof ics205CommunicationsRows)[number]>[] = useMemo(() => [
    { field: 'loggedUtc', headerName: 'Logged', minWidth: 170, flex: 1, sort: 'desc', valueFormatter: (params) => new Date(String(params.value)).toLocaleString() },
    { field: 'channelCode', headerName: 'Channel', minWidth: 120, flex: 0.8 },
    { field: 'directionCode', headerName: 'Direction', minWidth: 120, flex: 0.8 },
    { field: 'subject', headerName: 'Subject', minWidth: 220, flex: 1.5 },
  ], []);

  const situationReportsRows = useMemo(() => situationReports.map((report) => ({
    id: report.situationReportId,
    reportNumber: report.reportNumber,
    reportedUtc: report.reportedUtc,
    reportedByUserDisplayName: report.reportedByUserDisplayName,
    summary: report.summary,
    statusCode: report.statusCode,
  })), [situationReports]);

  const situationReportsColumnDefs: ColDef<(typeof situationReportsRows)[number]>[] = useMemo(() => [
    {
      field: 'reportNumber',
      headerName: 'Report #',
      minWidth: 100,
      flex: 0.7,
      type: 'numericColumn',
      cellClass: 'fw-semibold',
      valueFormatter: (params) => `#${params.value ?? ''}`,
    },
    { field: 'reportedUtc', headerName: 'Reported', minWidth: 170, flex: 1, sort: 'desc', valueFormatter: (params) => new Date(String(params.value)).toLocaleString() },
    { field: 'reportedByUserDisplayName', headerName: 'Reported By', minWidth: 160, flex: 1 },
    { field: 'summary', headerName: 'Summary', minWidth: 260, flex: 2, cellClass: 'text-truncate' },
    {
      field: 'statusCode',
      headerName: 'Status',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: (params: { value?: string }) => <Badge bg={statusVariant(params.value ?? '')}>{params.value ?? '—'}</Badge>,
    },
  ], []);

  const resourceRequestsCsv = useMemo(() => {
    const lines = ['RequestedUtc,ResourceTypeCode,ResourceTypeName,RequestedQuantity,AssignedQuantity,UnitOfMeasureCode,PriorityCode,StatusCode,RequestedBy,Notes'];
    filteredResourceRequests.forEach((item) => {
      const safeTypeCode = item.resourceTypeCode.replace(/"/g, '""');
      const safeTypeName = item.resourceTypeName.replace(/"/g, '""');
      const safeUom = item.unitOfMeasureCode.replace(/"/g, '""');
      const safeRequester = item.requestedByUserDisplayName.replace(/"/g, '""');
      const safeNotes = (item.notes ?? '').replace(/"/g, '""');
      lines.push(
        `"${item.requestedUtc}","${safeTypeCode}","${safeTypeName}",${item.requestedQuantity},${item.assignedQuantity ?? ''},"${safeUom}","${item.priorityCode}","${item.statusCode}","${safeRequester}","${safeNotes}"`,
      );
    });

    return lines.join('\n');
  }, [filteredResourceRequests]);

  const reloadResourceRequests = () => {
    if (!selectedIncidentId) {
      return Promise.resolve();
    }

    resourceRequestsRequestRef.current?.abort();
    const controller = new AbortController();
    resourceRequestsRequestRef.current = controller;
    setResourceRequestsLoading(true);
    setResourceRequestsLoadError(null);
    return import('../../api')
      .then((api) => api.getIncidentResourceRequests(selectedIncidentId, controller.signal))
      .then((items) => {
        if (resourceRequestsRequestRef.current !== controller || controller.signal.aborted) {
          return;
        }

        setResourceRequests(items);
        setResourceRequestsLoadAttempted(true);
        setResourceRequestsLoading(false);
        resourceRequestsRequestRef.current = null;
      })
      .catch((err) => {
        if (resourceRequestsRequestRef.current !== controller) {
          return;
        }

        if (isAbortError(err)) {
          setResourceRequestsLoading(false);
          return;
        }

        console.error('Failed to reload incident resource requests:', err);
        setResourceRequestsLoadError(err instanceof Error ? err.message : 'Failed to reload incident resource requests.');
        setResourceRequestsLoadAttempted(true);
        setResourceRequestsLoading(false);
        resourceRequestsRequestRef.current = null;
      });
  };

  const handleToggleResourceRowSelection = (incidentResourceRequestId: number) => {
    setSelectedResourceRequestIds((current) => (
      current.includes(incidentResourceRequestId)
        ? current.filter((id) => id !== incidentResourceRequestId)
        : [...current, incidentResourceRequestId]
    ));
  };

  const handleToggleSelectAllVisibleResources = (selected: boolean) => {
    if (!selected) {
      setSelectedResourceRequestIds([]);
      return;
    }

    setSelectedResourceRequestIds(prioritizedResourceRequests.map((item) => item.incidentResourceRequestId));
  };

  const applyBulkResourceStatusTransition = (sourceItems: IncidentResourceRequest[]) => {
    if (!selectedIncidentId || sourceItems.length === 0) {
      return;
    }

    const transitionEligibleItems = sourceItems.filter((item) => {
      const allowedStatuses = resourceStatusTransitionMap[item.statusCode as keyof typeof resourceStatusTransitionMap] ?? [];
      return allowedStatuses.includes(resourceBulkStatusCodeInput);
    });

    const updatableItems = transitionEligibleItems.filter((item) => {
      let assignedQuantity = item.assignedQuantity ?? undefined;
      if (resourceBulkStatusCodeInput === 'Fulfilled') {
        assignedQuantity = item.requestedQuantity;
      }

      if (resourceBulkStatusCodeInput === 'Requested' || resourceBulkStatusCodeInput === 'Denied' || resourceBulkStatusCodeInput === 'Cancelled' || resourceBulkStatusCodeInput === 'Archived') {
        assignedQuantity = undefined;
      }

      return validateResourceLifecycleCombination(item.requestedQuantity, assignedQuantity, resourceBulkStatusCodeInput) === null;
    });

    if (updatableItems.length === 0) {
      onNotify?.('No selected requests support that status transition.', 'warning');
      return;
    }

    const skippedCount = sourceItems.length - updatableItems.length;

    setResourceRequestsLoading(true);
    import('../../api')
      .then((api) => Promise.allSettled(updatableItems.map((item) => {
        let assignedQuantity = item.assignedQuantity ?? undefined;
        if (resourceBulkStatusCodeInput === 'Fulfilled' && (!assignedQuantity || assignedQuantity <= 0)) {
          assignedQuantity = item.requestedQuantity;
        }

        if (resourceBulkStatusCodeInput === 'Requested' || resourceBulkStatusCodeInput === 'Denied' || resourceBulkStatusCodeInput === 'Cancelled' || resourceBulkStatusCodeInput === 'Archived') {
          assignedQuantity = undefined;
        }

        return api.updateIncidentResourceRequest(selectedIncidentId, item.incidentResourceRequestId, {
          resourceTypeCode: item.resourceTypeCode,
          resourceTypeName: item.resourceTypeName,
          requestedQuantity: item.requestedQuantity,
          assignedQuantity,
          unitOfMeasureCode: item.unitOfMeasureCode,
          priorityCode: item.priorityCode,
          statusCode: resourceBulkStatusCodeInput,
          notes: item.notes ?? undefined,
        });
      })))
      .then((results) => {
        const successCount = results.filter((result) => result.status === 'fulfilled').length;
        const failureCount = results.length - successCount;
        return Promise.all([reloadResourceRequests(), reloadResourceLifecycleSummary()])
          .then(() => {
            setSelectedResourceRequestIds([]);
            if (failureCount > 0) {
              onNotify?.(`Bulk transition completed with ${successCount} success and ${failureCount} failure${skippedCount > 0 ? `; ${skippedCount} skipped` : ''}.`, 'warning');
            } else {
              onNotify?.(`Bulk transitioned ${successCount} resource requests to ${resourceBulkStatusCodeInput}${skippedCount > 0 ? `; ${skippedCount} skipped` : ''}.`, 'success');
            }
          });
      })
      .catch((err) => {
        console.error('Failed to apply bulk status transition for resource requests:', err);
        onNotify?.(err instanceof Error ? err.message : 'Failed to apply bulk status transition.', 'danger');
        setResourceRequestsLoading(false);
      });
  };

  const handleApplyBulkResourceStatusTransition = () => {
    if (selectedResourceRequestIds.length === 0) {
      return;
    }

    const selectedItems = resourceRequests.filter((item) => selectedResourceRequestIdSet.has(item.incidentResourceRequestId));
    applyBulkResourceStatusTransition(selectedItems);
  };

  const handleSelectResourceLane = (statusCode: string) => {
    const laneItems = prioritizedResourceRequests.filter((item) => item.statusCode === statusCode);
    if (laneItems.length === 0) {
      return;
    }

    const laneIds = laneItems.map((item) => item.incidentResourceRequestId);
    setSelectedResourceRequestIds((current) => {
      const currentSet = new Set(current);
      const allLaneSelected = laneIds.every((id) => currentSet.has(id));

      if (allLaneSelected) {
        return current.filter((id) => !laneIds.includes(id));
      }

      laneIds.forEach((id) => currentSet.add(id));
      return Array.from(currentSet);
    });
  };

  const handleApplyBulkResourceStatusTransitionForLane = (statusCode: string) => {
    const laneItems = prioritizedResourceRequests.filter((item) => item.statusCode === statusCode);
    if (laneItems.length === 0) {
      return;
    }

    setSelectedResourceRequestIds(laneItems.map((item) => item.incidentResourceRequestId));
    applyBulkResourceStatusTransition(laneItems);
  };

  const applyBulkResourceAssignmentUpdate = (sourceItems: IncidentResourceRequest[]) => {
    if (!selectedIncidentId || sourceItems.length === 0) {
      return;
    }

    const eligibleStatuses = resourceBulkAssignmentModeInput === 'AssignFull'
      ? new Set(['Requested', 'Approved', 'PartiallyFulfilled'])
      : new Set(['Requested', 'Approved']);
    const updatableItems = sourceItems.filter((item) => eligibleStatuses.has(item.statusCode));
    if (updatableItems.length === 0) {
      onNotify?.('No selected requests support bulk assignment update.', 'warning');
      return;
    }

    const skippedCount = sourceItems.length - updatableItems.length;
    setResourceRequestsLoading(true);
    import('../../api')
      .then((api) => Promise.allSettled(updatableItems.map((item) => {
        const nextStatusCode = resourceBulkAssignmentModeInput === 'AssignFull'
          ? item.statusCode === 'Requested'
            ? 'Approved'
            : item.statusCode === 'Approved' || item.statusCode === 'PartiallyFulfilled'
              ? 'Fulfilled'
              : item.statusCode
          : item.statusCode;
        const assignedQuantity = resourceBulkAssignmentModeInput === 'AssignFull'
          ? item.requestedQuantity
          : undefined;

        return api.updateIncidentResourceRequest(selectedIncidentId, item.incidentResourceRequestId, {
          resourceTypeCode: item.resourceTypeCode,
          resourceTypeName: item.resourceTypeName,
          requestedQuantity: item.requestedQuantity,
          assignedQuantity,
          unitOfMeasureCode: item.unitOfMeasureCode,
          priorityCode: item.priorityCode,
          statusCode: nextStatusCode,
          notes: item.notes ?? undefined,
        });
      })))
      .then((results) => {
        const successCount = results.filter((result) => result.status === 'fulfilled').length;
        const failureCount = results.length - successCount;
        const autoApprovedCount = resourceBulkAssignmentModeInput === 'AssignFull'
          ? updatableItems.filter((item) => item.statusCode === 'Requested').length
          : 0;
        const autoFulfilledCount = resourceBulkAssignmentModeInput === 'AssignFull'
          ? updatableItems.filter((item) => item.statusCode === 'Approved' || item.statusCode === 'PartiallyFulfilled').length
          : 0;
        return Promise.all([reloadResourceRequests(), reloadResourceLifecycleSummary()])
          .then(() => {
            setSelectedResourceRequestIds([]);
            const modeLabel = resourceBulkAssignmentModeInput === 'AssignFull'
              ? `assigned full quantity${autoApprovedCount > 0 ? ` (auto-approved ${autoApprovedCount} requested item${autoApprovedCount === 1 ? '' : 's'})` : ''}${autoFulfilledCount > 0 ? `${autoApprovedCount > 0 ? ';' : ' ('} auto-fulfilled ${autoFulfilledCount} in-routing item${autoFulfilledCount === 1 ? '' : 's'}${autoApprovedCount > 0 ? '' : ')'}` : ''}`
              : 'cleared assignment';
            if (failureCount > 0) {
              onNotify?.(`Bulk assignment update completed with ${successCount} success and ${failureCount} failure${skippedCount > 0 ? `; ${skippedCount} skipped` : ''}.`, 'warning');
            } else {
              onNotify?.(`Bulk ${modeLabel} for ${successCount} resource requests${skippedCount > 0 ? `; ${skippedCount} skipped` : ''}.`, 'success');
            }

            if (resourceBulkAssignmentModeInput === 'Clear' && skippedCount > 0) {
              onNotify?.('Clear assignment skips Partially Fulfilled and downstream statuses to preserve routing governance.', 'info');
            }
          });
      })
      .catch((err) => {
        console.error('Failed to apply bulk assignment update for resource requests:', err);
        onNotify?.(err instanceof Error ? err.message : 'Failed to apply bulk assignment update.', 'danger');
        setResourceRequestsLoading(false);
      });
  };

  const handleApplyBulkResourceAssignmentUpdate = () => {
    if (selectedResourceRequestIds.length === 0) {
      return;
    }

    const selectedItems = resourceRequests.filter((item) => selectedResourceRequestIdSet.has(item.incidentResourceRequestId));
    applyBulkResourceAssignmentUpdate(selectedItems);
  };

  const handleApplyBulkResourceAssignmentUpdateForLane = (statusCode: string) => {
    const laneItems = prioritizedResourceRequests.filter((item) => item.statusCode === statusCode);
    if (laneItems.length === 0) {
      return;
    }

    setSelectedResourceRequestIds(laneItems.map((item) => item.incidentResourceRequestId));
    applyBulkResourceAssignmentUpdate(laneItems);
  };

  const handleResourceRowAssignedQuantityDraftChange = (incidentResourceRequestId: number, value: string) => {
    setResourceRowAssignedQuantityDrafts((current) => ({
      ...current,
      [incidentResourceRequestId]: value,
    }));
  };

  const handleApplyResourceRowAssignedQuantity = (item: IncidentResourceRequest) => {
    const raw = resourceRowAssignedQuantityDrafts[item.incidentResourceRequestId] ?? '';
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      handleUpdateResourceAssignedQuantity(item, null);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      onNotify?.('Assigned quantity must be a non-negative number.', 'warning');
      return;
    }

    handleUpdateResourceAssignedQuantity(item, parsed);
  };

  const handleUpdateResourceAssignedQuantity = (item: IncidentResourceRequest, assignedQuantity: number | null) => {
    if (!selectedIncidentId) {
      return;
    }

    if (assignedQuantity === null && item.statusCode === 'PartiallyFulfilled') {
      onNotify?.('Cannot clear assignment while status is PartiallyFulfilled. Transition status before clearing assignment.', 'warning');
      return;
    }

    const nextStatusCode = assignedQuantity !== null && assignedQuantity > 0 && item.statusCode === 'Requested'
      ? 'Approved'
      : assignedQuantity !== null && assignedQuantity > 0 && assignedQuantity < item.requestedQuantity && item.statusCode === 'Approved'
        ? 'PartiallyFulfilled'
        : assignedQuantity !== null && assignedQuantity >= item.requestedQuantity && (item.statusCode === 'Approved' || item.statusCode === 'PartiallyFulfilled')
          ? 'Fulfilled'
      : item.statusCode;

    setResourceRequestsLoading(true);
    import('../../api')
      .then((api) => api.updateIncidentResourceRequest(selectedIncidentId, item.incidentResourceRequestId, {
        resourceTypeCode: item.resourceTypeCode,
        resourceTypeName: item.resourceTypeName,
        requestedQuantity: item.requestedQuantity,
        assignedQuantity: assignedQuantity === null ? undefined : assignedQuantity,
        unitOfMeasureCode: item.unitOfMeasureCode,
        priorityCode: item.priorityCode,
        statusCode: nextStatusCode,
        notes: item.notes ?? undefined,
      }))
      .then(() => Promise.all([reloadResourceRequests(), reloadResourceLifecycleSummary()]))
      .then(() => {
        if (nextStatusCode !== item.statusCode) {
          onNotify?.(`Resource assignment updated and request moved to ${nextStatusCode}.`, 'success');
          return;
        }

        onNotify?.('Resource assignment quantity updated.', 'success');
      })
      .catch((err) => {
        console.error('Failed to update assigned quantity for resource request:', err);
        onNotify?.(err instanceof Error ? err.message : 'Failed to update assigned quantity.', 'danger');
        setResourceRequestsLoading(false);
      });
  };

  const applyResourceTypeSuggestion = (lookup: LookupValue) => {
    setResourceTypeNameInput(lookup.displayName);
    setResourceTypeCodeInput(lookup.code);
  };

  const formatValidationErrorMessage = (validationErrors: Record<string, string[]>): string => {
    const preferredOrder = ['assignedQuantity', 'statusCode', 'requestedQuantity', 'resourceTypeCode', 'resourceTypeName'];

    for (const key of preferredOrder) {
      const messages = validationErrors[key];
      if (messages && messages.length > 0) {
        return messages[0];
      }
    }

    const firstMessages = Object.values(validationErrors).find((messages) => Array.isArray(messages) && messages.length > 0);
    if (firstMessages && firstMessages.length > 0) {
      return firstMessages[0];
    }

    return 'Request validation failed.';
  };

  const handleSelectExistingResourceType = (codeValueIdRaw: string) => {
    if (!codeValueIdRaw) {
      return;
    }

    const codeValueId = Number.parseInt(codeValueIdRaw, 10);
    if (!Number.isFinite(codeValueId)) {
      return;
    }

    const selected = suggestedResourceTypeOptions.find((item) => item.codeValueId === codeValueId);
    if (!selected) {
      return;
    }

    applyResourceTypeSuggestion(selected);
    setResourceTypeDropdownOpen(false);
    setResourceTypeHighlightedIndex(-1);
  };

  const handleUseNewResourceTypeOption = () => {
    const typedValue = resourceTypeNameInput.trim();
    if (typedValue.length === 0) {
      return;
    }

    setResourceTypeNameInput(typedValue);
    if (!exactResourceTypeMatch) {
      const generatedCode = normalizeLookupCodeFromName(typedValue);
      setResourceTypeCodeInput(generatedCode.length > 0 ? generatedCode : 'RESOURCE_TYPE');
    }

    setResourceTypeDropdownOpen(false);
    setResourceTypeHighlightedIndex(-1);
  };

  const handleResourceTypeInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setResourceTypeDropdownOpen(false);
      setResourceTypeHighlightedIndex(-1);
      return;
    }

    if (suggestedResourceTypeOptions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setResourceTypeDropdownOpen(true);
      setResourceTypeHighlightedIndex((current) => {
        const next = current + 1;
        return next >= suggestedResourceTypeOptions.length ? 0 : next;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setResourceTypeDropdownOpen(true);
      setResourceTypeHighlightedIndex((current) => {
        if (current <= 0) {
          return suggestedResourceTypeOptions.length - 1;
        }

        return current - 1;
      });
      return;
    }

    if (event.key === 'Enter' && resourceTypeDropdownOpen) {
      event.preventDefault();
      if (resourceTypeHighlightedIndex >= 0 && resourceTypeHighlightedIndex < suggestedResourceTypeOptions.length) {
        const selected = suggestedResourceTypeOptions[resourceTypeHighlightedIndex];
        handleSelectExistingResourceType(String(selected.codeValueId));
        return;
      }

      if (canCreateResourceTypeOption) {
        handleUseNewResourceTypeOption();
      }
    }
  };

  useEffect(() => {
    if (!resourceTypeDropdownOpen) {
      setResourceTypeHighlightedIndex(-1);
      return;
    }

    if (suggestedResourceTypeOptions.length === 0) {
      setResourceTypeHighlightedIndex(-1);
      return;
    }

    setResourceTypeHighlightedIndex(0);
  }, [resourceTypeDropdownOpen, suggestedResourceTypeOptions]);

  useEffect(() => {
    if (!resourceTypeDropdownOpen || resourceTypeHighlightedIndex < 0) {
      return;
    }

    const highlightedItem = resourceTypeDropdownItemRefs.current[resourceTypeHighlightedIndex];
    highlightedItem?.scrollIntoView({ block: 'nearest' });
  }, [resourceTypeDropdownOpen, resourceTypeHighlightedIndex]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const container = resourceTypeDropdownContainerRef.current;
      if (!container) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !container.contains(target)) {
        setResourceTypeDropdownOpen(false);
        setResourceTypeHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, []);

  function getNotificationIdForCommunication(communicationId: number): number | null {
    const communication = communications.find((item) => item.incidentCommunicationId === communicationId);
    if (!communication) {
      return null;
    }

    return typeof communication.notificationId === 'number' && communication.notificationId > 0
      ? communication.notificationId
      : null;
  }

  const loadNotificationRecipientsByNotificationId = (notificationId: number) => {
    setNotificationRecipientsLoading(true);
    setLastDispatchedNotificationId(notificationId);
    return import('../../api')
      .then((api) => api.getNotificationRecipients(notificationId))
      .then((recipients) => {
        setNotificationRecipients(recipients);
        const nextStatuses: Record<number, UpdateRecipientDeliveryStatusRequest['deliveryStatusCode']> = {};
        const nextFailureReasons: Record<number, string> = {};
        const nextAckNotes: Record<number, string> = {};

        recipients.forEach((recipient) => {
          nextStatuses[recipient.notificationRecipientId] = recipient.deliveryStatusCode;
          nextFailureReasons[recipient.notificationRecipientId] = recipient.failureReason ?? '';
          nextAckNotes[recipient.notificationRecipientId] = '';
        });

        setNotificationRecipientStatusSelection(nextStatuses);
        setNotificationRecipientFailureReasonInput(nextFailureReasons);
        setNotificationRecipientAckNoteInput(nextAckNotes);
        setNotificationRecipientsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load notification recipients:', error);
        onNotify?.(error instanceof Error ? error.message : 'Failed to load notification recipients.', 'danger');
        setNotificationRecipientsLoading(false);
      });
  };

  const handleSaveResourceRequest = () => {
    if (!selectedIncidentId) {
      return;
    }

    if (isRequestedQuantityInvalid || isAssignedQuantityInvalid) {
      return;
    }

    setResourceRequestsLoading(true);
    import('../../api')
      .then(async (api) => {
        const normalizedTypeName = resourceTypeNameInput.trim();
        const normalizedTypeCode = resourceTypeCodeInput.trim();

        const existingByName = resourceTypeLookups.find((item) => item.displayName.localeCompare(normalizedTypeName, undefined, { sensitivity: 'accent' }) === 0);
        const existingByCode = resourceTypeLookups.find((item) => item.code.localeCompare(normalizedTypeCode, undefined, { sensitivity: 'accent' }) === 0);

        const effectiveTypeName = existingByName?.displayName ?? existingByCode?.displayName ?? normalizedTypeName;
        const generatedTypeCode = normalizeLookupCodeFromName(normalizedTypeName);
        const effectiveTypeCode = existingByName?.code
          ?? existingByCode?.code
          ?? (normalizedTypeCode.length > 0 ? normalizedTypeCode : (generatedTypeCode.length > 0 ? generatedTypeCode : 'RESOURCE_TYPE'));

        const lookupExists = !!existingByName || !!existingByCode;
        if (!lookupExists && effectiveTypeName.length > 0 && effectiveTypeCode.length > 0) {
          try {
            await api.createLookupValue('ResourceType', {
              code: effectiveTypeCode,
              displayName: effectiveTypeName,
              description: 'Runtime-added from Incident Resource Requests workflow.',
            });
            onNotify?.(`Added '${effectiveTypeName}' to ResourceType lookup.`, 'info');
          } catch (lookupError) {
            console.error('Unable to persist resource type lookup value:', lookupError);
          }
        }

        if (editingResourceRequestId) {
          const lifecycleValidationError = validateResourceLifecycleCombination(
            requestedQuantityNumber,
            assignedQuantityNumber,
            resourceStatusCodeInput,
          );
          if (lifecycleValidationError) {
            onNotify?.(lifecycleValidationError, 'warning');
            setResourceRequestsLoading(false);
            return;
          }

          return api.updateIncidentResourceRequest(selectedIncidentId, editingResourceRequestId, {
            resourceTypeCode: effectiveTypeCode,
            resourceTypeName: effectiveTypeName,
            requestedQuantity: requestedQuantityNumber,
            assignedQuantity: assignedQuantityNumber ?? undefined,
            unitOfMeasureCode: resourceUnitOfMeasureCodeInput.trim(),
            priorityCode: resourcePriorityCodeInput,
            statusCode: resourceStatusCodeInput,
            notes: resourceNotesInput.trim().length > 0 ? resourceNotesInput.trim() : undefined,
          });
        }

        return api.createIncidentResourceRequest(selectedIncidentId, {
          resourceTypeCode: effectiveTypeCode,
          resourceTypeName: effectiveTypeName,
          requestedQuantity: requestedQuantityNumber,
          unitOfMeasureCode: resourceUnitOfMeasureCodeInput.trim(),
          priorityCode: resourcePriorityCodeInput,
          notes: resourceNotesInput.trim().length > 0 ? resourceNotesInput.trim() : undefined,
        }).then(() => undefined);
      })
      .then(() => Promise.all([reloadResourceRequests(), reloadResourceLifecycleSummary()]))
      .then(() => {
        resetResourceRequestForm();
      })
      .catch((err) => {
        console.error('Failed to save incident resource request:', err);
        if (err instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(err.validationErrors), 'warning');
        }
        setResourceRequestsLoading(false);
      });
  };

  const handleEditResourceRequest = (item: IncidentResourceRequest) => {
    setEditingResourceRequestId(item.incidentResourceRequestId);
    setResourceTypeCodeInput(item.resourceTypeCode);
    setResourceTypeNameInput(item.resourceTypeName);
    setResourceRequestedQuantityInput(String(item.requestedQuantity));
    setResourceAssignedQuantityInput(item.assignedQuantity === null ? '' : String(item.assignedQuantity));
    setResourceUnitOfMeasureCodeInput(item.unitOfMeasureCode);
    setResourcePriorityCodeInput(item.priorityCode);
    setResourceStatusCodeInput(item.statusCode);
    setResourceNotesInput(item.notes ?? '');
  };

  const handleArchiveResourceRequest = (item: IncidentResourceRequest) => {
    if (!selectedIncidentId) {
      return;
    }

    setResourceRequestsLoading(true);
    import('../../api')
      .then((api) => api.updateIncidentResourceRequest(selectedIncidentId, item.incidentResourceRequestId, {
        resourceTypeCode: item.resourceTypeCode,
        resourceTypeName: item.resourceTypeName,
        requestedQuantity: item.requestedQuantity,
        assignedQuantity: item.assignedQuantity ?? undefined,
        unitOfMeasureCode: item.unitOfMeasureCode,
        priorityCode: item.priorityCode,
        statusCode: item.statusCode === 'Archived' ? 'Requested' : 'Archived',
        notes: item.notes ?? undefined,
      }))
      .then(() => Promise.all([reloadResourceRequests(), reloadResourceLifecycleSummary()]))
      .catch((err) => {
        console.error('Failed to archive/unarchive incident resource request:', err);
        if (err instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(err.validationErrors), 'warning');
        }
        setResourceRequestsLoading(false);
      });
  };

  const handleTransitionResourceRequestStatus = (item: IncidentResourceRequest, statusCode: string) => {
    if (!selectedIncidentId) {
      return;
    }

    let assignedQuantity = item.assignedQuantity ?? undefined;
    if (statusCode === 'Fulfilled') {
      assignedQuantity = item.requestedQuantity;
    }

    if (statusCode === 'Requested' || statusCode === 'Denied' || statusCode === 'Cancelled' || statusCode === 'Archived') {
      assignedQuantity = undefined;
    }

    const lifecycleValidationError = validateResourceLifecycleCombination(item.requestedQuantity, assignedQuantity, statusCode);
    if (lifecycleValidationError) {
      onNotify?.(lifecycleValidationError, 'warning');
      return;
    }

    setResourceRequestsLoading(true);
    import('../../api')
      .then((api) => api.updateIncidentResourceRequest(selectedIncidentId, item.incidentResourceRequestId, {
        resourceTypeCode: item.resourceTypeCode,
        resourceTypeName: item.resourceTypeName,
        requestedQuantity: item.requestedQuantity,
        assignedQuantity,
        unitOfMeasureCode: item.unitOfMeasureCode,
        priorityCode: item.priorityCode,
        statusCode,
        notes: item.notes ?? undefined,
      }))
      .then(() => Promise.all([reloadResourceRequests(), reloadResourceLifecycleSummary()]))
      .then(() => {
        onNotify?.(`Resource request moved to ${statusCode}.`, statusCode === 'Denied' || statusCode === 'Cancelled' ? 'warning' : 'success');
      })
      .catch((err) => {
        console.error('Failed to transition incident resource request status:', err);
        if (err instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(err.validationErrors), 'warning');
        } else {
          onNotify?.(err instanceof Error ? err.message : 'Failed to update resource request status.', 'danger');
        }
        setResourceRequestsLoading(false);
      });
  };

  const resetCommunicationForm = () => {
    setEditingCommunicationId(null);
    setCommunicationChannelCode('Phone');
    setCommunicationDirectionCode('Inbound');
    setCommunicationSubject('');
    setCommunicationMessage('');
    setCommunicationNotifyEnabled(true);
    setNotificationTypeCodeInput('INCIDENT_NOTIFICATION');
    setNotificationPriorityCodeInput('Normal');
    setNotificationChannelCodeInput('EMAIL');
    clearNotificationRecipientDraftInputs();
    setNotificationRecipientsDraft([]);
  };

  const reloadCommunications = () => {
    if (!selectedIncidentId) {
      return Promise.resolve();
    }

    communicationsRequestRef.current?.abort();
    const controller = new AbortController();
    communicationsRequestRef.current = controller;
    setCommunicationsLoading(true);
    setCommunicationsLoadError(null);
    return import('../../api')
      .then((api) => api.getIncidentCommunications(selectedIncidentId, controller.signal))
      .then((items) => {
        if (communicationsRequestRef.current !== controller || controller.signal.aborted) {
          return;
        }

        setCommunications(items);
        setCommunicationsLoadAttempted(true);
        setCommunicationsLoading(false);
        communicationsRequestRef.current = null;
      })
      .catch((err) => {
        if (communicationsRequestRef.current !== controller) {
          return;
        }

        if (isAbortError(err)) {
          setCommunicationsLoading(false);
          return;
        }

        console.error('Failed to reload incident communications:', err);
        setCommunicationsLoadError(err instanceof Error ? err.message : 'Failed to reload incident communications.');
        setCommunicationsLoadAttempted(true);
        setCommunicationsLoading(false);
        communicationsRequestRef.current = null;
      });
  };

  const handleSaveCommunication = () => {
    if (!selectedIncidentId || communicationSubject.trim().length === 0 || communicationMessage.trim().length === 0) {
      return;
    }

    const payload: import('../../types').CreateIncidentCommunicationRequest = {
      channelCode: communicationChannelCode,
      directionCode: communicationDirectionCode,
      subject: communicationSubject.trim(),
      message: communicationMessage.trim(),
    };

    const draftRecipient = buildNotificationRecipientDraft();

    if (!editingCommunicationId && communicationNotifyEnabled) {
      const recipients = draftRecipient
        ? [...notificationRecipientsDraft, draftRecipient]
        : notificationRecipientsDraft;

      if (recipients.length > 0) {
        payload.notificationTypeCode = notificationTypeCodeInput.trim().toUpperCase();
        payload.notificationPriorityCode = notificationPriorityCodeInput;
        payload.notificationRecipients = recipients;
      }
    }

    setCommunicationsLoading(true);
    import('../../api')
      .then((api) => {
        if (editingCommunicationId) {
          return api.updateIncidentCommunication(selectedIncidentId, editingCommunicationId, {
            ...payload,
            statusCode: 'Active',
          });
        }

        return api.createIncidentCommunication(selectedIncidentId, payload).then(() => undefined);
      })
      .then(async () => {
        if (!communicationNotifyEnabled || editingCommunicationId || !payload.notificationRecipients?.length) {
          return;
        }
        const refreshedItems = await import('../../api')
          .then((api) => api.getIncidentCommunications(selectedIncidentId));
        const matched = refreshedItems
          .filter((item) => item.subject === payload.subject && item.message === payload.message)
          .sort((left, right) => new Date(right.loggedUtc).getTime() - new Date(left.loggedUtc).getTime())[0];

        if (matched?.notificationId) {
          setLastDispatchedNotificationId(matched.notificationId);
          onNotify?.(`Notification #${matched.notificationId} dispatched.`, 'success');
          setCommunicationDispatchLoading(true);
          await loadNotificationRecipientsByNotificationId(matched.notificationId);
        }
      })
      .then(() => Promise.all([reloadCommunications(), reloadCommunicationLifecycleSummary()]))
      .then(() => {
        resetCommunicationForm();
      })
      .catch((err) => {
        console.error('Failed to save communication:', err);
        if (err instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(err.validationErrors), 'warning');
        } else {
          onNotify?.(err instanceof Error ? err.message : 'Failed to save communication.', 'danger');
        }
        setCommunicationsLoading(false);
        setCommunicationDispatchLoading(false);
      })
      .finally(() => {
        setCommunicationDispatchLoading(false);
      });
  };

  const handleLoadNotificationRecipients = () => {
    if (!lastDispatchedNotificationId) {
      return Promise.resolve();
    }

    return loadNotificationRecipientsByNotificationId(lastDispatchedNotificationId);
  };

  const handleUpdateNotificationRecipientStatus = (recipient: NotificationRecipient) => {
    const selectedStatus = notificationRecipientStatusSelection[recipient.notificationRecipientId] ?? recipient.deliveryStatusCode;
    const failureReason = notificationRecipientFailureReasonInput[recipient.notificationRecipientId]?.trim();

    setNotificationRecipientsLoading(true);
    import('../../api')
      .then((api) => api.updateNotificationRecipientDeliveryStatus(recipient.notificationId, recipient.notificationRecipientId, {
        deliveryStatusCode: selectedStatus,
        failureReason: selectedStatus === 'Failed' ? (failureReason || undefined) : undefined,
      }))
      .then(() => handleLoadNotificationRecipients())
      .then(() => Promise.all([reloadCommunications(), reloadCommunicationLifecycleSummary()]))
      .then(() => {
        onNotify?.('Recipient delivery status updated.', 'success');
      })
      .catch((error) => {
        console.error('Failed to update notification recipient status:', error);
        if (error instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(error.validationErrors), 'warning');
        } else {
          onNotify?.(error instanceof Error ? error.message : 'Failed to update recipient delivery status.', 'danger');
        }
        setNotificationRecipientsLoading(false);
      });
  };

  const handleAcknowledgeNotificationRecipient = (recipient: NotificationRecipient) => {
    const acknowledgmentNote = notificationRecipientAckNoteInput[recipient.notificationRecipientId]?.trim();

    setNotificationRecipientsLoading(true);
    import('../../api')
      .then((api) => api.acknowledgeNotificationRecipient(recipient.notificationId, recipient.notificationRecipientId, {
        acknowledgmentNote: acknowledgmentNote && acknowledgmentNote.length > 0 ? acknowledgmentNote : undefined,
      }))
      .then(() => handleLoadNotificationRecipients())
      .then(() => Promise.all([reloadCommunications(), reloadCommunicationLifecycleSummary()]))
      .then(() => {
        onNotify?.('Recipient acknowledgment recorded.', 'success');
      })
      .catch((error) => {
        console.error('Failed to acknowledge notification recipient:', error);
        if (error instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(error.validationErrors), 'warning');
        } else {
          onNotify?.(error instanceof Error ? error.message : 'Failed to acknowledge recipient.', 'danger');
        }
        setNotificationRecipientsLoading(false);
      });
  };

  const handleBulkNotificationRecipientStatusUpdate = (targetStatus: UpdateRecipientDeliveryStatusRequest['deliveryStatusCode']) => {
    if (notificationRecipients.length === 0) {
      return;
    }

    const candidates = notificationRecipients.filter((recipient) => recipient.deliveryStatusCode !== targetStatus);
    if (candidates.length === 0) {
      onNotify?.(`All recipients already set to ${targetStatus}.`, 'info');
      return;
    }

    setNotificationRecipientsLoading(true);
    import('../../api')
      .then(async (api) => {
        const outcomes = await Promise.allSettled(candidates.map((recipient) => api.updateNotificationRecipientDeliveryStatus(
          recipient.notificationId,
          recipient.notificationRecipientId,
          { deliveryStatusCode: targetStatus },
        )));

        const successCount = outcomes.filter((outcome) => outcome.status === 'fulfilled').length;
        const failureCount = outcomes.length - successCount;

        await Promise.all([handleLoadNotificationRecipients(), reloadCommunications(), reloadCommunicationLifecycleSummary()]);

        if (failureCount > 0) {
          onNotify?.(`Updated ${successCount} recipient(s) to ${targetStatus}; ${failureCount} failed.`, 'warning');
          return;
        }

        onNotify?.(`Updated ${successCount} recipient(s) to ${targetStatus}.`, 'success');
      })
      .catch((error) => {
        console.error('Failed to apply bulk recipient status update:', error);
        if (error instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(error.validationErrors), 'warning');
        } else {
          onNotify?.(error instanceof Error ? error.message : 'Failed to apply bulk recipient status update.', 'danger');
        }
        setNotificationRecipientsLoading(false);
      });
  };

  const handleBulkAcknowledgeNotificationRecipients = () => {
    if (notificationRecipients.length === 0) {
      return;
    }

    const candidates = notificationRecipients.filter((recipient) => !recipient.acknowledgedUtc);
    if (candidates.length === 0) {
      onNotify?.('All recipients are already acknowledged.', 'info');
      return;
    }

    setNotificationRecipientsLoading(true);
    import('../../api')
      .then(async (api) => {
        const outcomes = await Promise.allSettled(candidates.map((recipient) => api.acknowledgeNotificationRecipient(
          recipient.notificationId,
          recipient.notificationRecipientId,
          {},
        )));

        const successCount = outcomes.filter((outcome) => outcome.status === 'fulfilled').length;
        const failureCount = outcomes.length - successCount;

        await Promise.all([handleLoadNotificationRecipients(), reloadCommunications(), reloadCommunicationLifecycleSummary()]);

        if (failureCount > 0) {
          onNotify?.(`Acknowledged ${successCount} recipient(s); ${failureCount} failed.`, 'warning');
          return;
        }

        onNotify?.(`Acknowledged ${successCount} recipient(s).`, 'success');
      })
      .catch((error) => {
        console.error('Failed to apply bulk recipient acknowledgment:', error);
        if (error instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(error.validationErrors), 'warning');
        } else {
          onNotify?.(error instanceof Error ? error.message : 'Failed to apply bulk recipient acknowledgment.', 'danger');
        }
        setNotificationRecipientsLoading(false);
      });
  };

  const handleEscalateCommunicationNotification = () => {
    if (!lastDispatchedNotificationId || escalationReasonInput.trim().length === 0 || escalationDestinationAddressInput.trim().length === 0) {
      return;
    }

    const normalizedReason = escalationReasonInput.trim();
    const normalizedDestination = escalationDestinationAddressInput.trim();

    setCommunicationEscalationLoading(true);
    import('../../api')
      .then((api) => api.escalateNotification(lastDispatchedNotificationId, {
        escalationReason: normalizedReason,
        escalationChannelCode: escalationChannelCodeInput,
        escalationDestinationAddress: normalizedDestination,
      }))
      .then((result) => {
        setLastDispatchedNotificationId(result.escalatedNotificationId);
        onNotify?.(`Notification escalated to #${result.escalatedNotificationId}.`, 'warning');
        return loadNotificationRecipientsByNotificationId(result.escalatedNotificationId)
          .then(() => Promise.all([reloadCommunications(), reloadCommunicationLifecycleSummary()]));
      })
      .catch((error) => {
        console.error('Failed to escalate communication notification:', error);
        if (error instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(error.validationErrors), 'warning');
        } else {
          onNotify?.(error instanceof Error ? error.message : 'Failed to escalate notification.', 'danger');
        }
      })
      .finally(() => {
        setCommunicationEscalationLoading(false);
      });
  };

  const handleSosEscalation = (channelCode: 'VOICE' | 'PUSH') => {
    if (!lastDispatchedNotificationId || escalationDestinationAddressInput.trim().length === 0) {
      return;
    }

    const normalizedDestination = escalationDestinationAddressInput.trim();
    const customReason = escalationReasonInput.trim();
    const effectiveReason = customReason.length > 0
      ? `SOS/PANIC: ${customReason}`
      : `SOS/PANIC: Immediate ${channelCode} escalation requested from incident command pane.`;

    setCommunicationEscalationLoading(true);
    import('../../api')
      .then((api) => api.escalateNotification(lastDispatchedNotificationId, {
        escalationReason: effectiveReason,
        escalationChannelCode: channelCode,
        escalationDestinationAddress: normalizedDestination,
      }))
      .then((result) => {
        setLastDispatchedNotificationId(result.escalatedNotificationId);
        onNotify?.(`SOS escalation (${channelCode}) dispatched as #${result.escalatedNotificationId}.`, 'warning');
        return loadNotificationRecipientsByNotificationId(result.escalatedNotificationId)
          .then(() => Promise.all([reloadCommunications(), reloadCommunicationLifecycleSummary()]));
      })
      .catch((error) => {
        console.error(`Failed SOS ${channelCode} escalation:`, error);
        if (error instanceof ApiValidationError) {
          onNotify?.(formatValidationErrorMessage(error.validationErrors), 'warning');
        } else {
          onNotify?.(error instanceof Error ? error.message : `Failed SOS ${channelCode} escalation.`, 'danger');
        }
      })
      .finally(() => {
        setCommunicationEscalationLoading(false);
      });
  };

  const handleEditCommunication = (item: IncidentCommunication) => {
    setEditingCommunicationId(item.incidentCommunicationId);
    setCommunicationChannelCode(item.channelCode);
    setCommunicationDirectionCode(item.directionCode);
    setCommunicationSubject(item.subject);
    setCommunicationMessage(item.message);
  };

  const handleArchiveCommunication = (item: IncidentCommunication) => {
    if (!selectedIncidentId) {
      return;
    }

    setCommunicationsLoading(true);
    import('../../api')
      .then((api) => api.updateIncidentCommunication(selectedIncidentId, item.incidentCommunicationId, {
        channelCode: item.channelCode,
        directionCode: item.directionCode,
        subject: item.subject,
        message: item.message,
        statusCode: item.statusCode === 'Archived' ? 'Active' : 'Archived',
      }))
      .then(() => Promise.all([reloadCommunications(), reloadCommunicationLifecycleSummary()]))
      .catch((err) => {
        console.error('Failed to archive/unarchive communication:', err);
        setCommunicationsLoading(false);
      });
  };

  const handleBulkCommunicationStatusTransition = (targetStatus: 'Active' | 'NeedsFollowUp' | 'Escalated' | 'Archived') => {
    if (!selectedIncidentId) {
      return;
    }

    const candidates = filteredCommunications.filter((item) => item.statusCode !== targetStatus);
    if (candidates.length === 0) {
      onNotify?.(`All filtered communications are already ${targetStatus}.`, 'info');
      return;
    }

    setCommunicationsLoading(true);
    import('../../api')
      .then(async (api) => {
        const outcomes = await Promise.allSettled(candidates.map((item) => api.updateIncidentCommunication(selectedIncidentId, item.incidentCommunicationId, {
          channelCode: item.channelCode,
          directionCode: item.directionCode,
          subject: item.subject,
          message: item.message,
          statusCode: targetStatus,
        })));

        const successCount = outcomes.filter((outcome) => outcome.status === 'fulfilled').length;
        const failureCount = outcomes.length - successCount;

        await Promise.all([reloadCommunications(), reloadCommunicationLifecycleSummary()]);

        if (failureCount > 0) {
          onNotify?.(`Updated ${successCount} communication(s) to ${targetStatus}; ${failureCount} failed.`, 'warning');
          return;
        }

        const successVariant = targetStatus === 'Escalated'
          ? 'warning'
          : targetStatus === 'NeedsFollowUp'
            ? 'info'
            : 'success';
        onNotify?.(`Updated ${successCount} communication(s) to ${targetStatus}.`, successVariant);
      })
      .catch((error) => {
        console.error('Failed to apply bulk communication status transition:', error);
        onNotify?.(error instanceof Error ? error.message : 'Failed to apply bulk communication status transition.', 'danger');
        setCommunicationsLoading(false);
      });
  };

  const handleCreateSituationReport = () => {
    if (!selectedIncidentId || sitrepSummary.trim().length === 0) {
      if (selectedIncidentId && sitrepSummary.trim().length === 0) {
        onNotify?.('Situation summary is required before creating a SITREP.', 'warning');
      }
      return;
    }

    import('../../api')
      .then((api) =>
        api.createSituationReport(selectedIncidentId, {
          summary: sitrepSummary,
          currentActions: sitrepCurrentActions || undefined,
          plannedActions: sitrepPlannedActions || undefined,
          unmetNeeds: sitrepUnmetNeeds || undefined,
          operationalPeriodId: sitrepOperationalPeriodId || undefined,
        })
      )
      .then(() => {
        // Reload situation reports
        situationReportsRequestRef.current?.abort();
        const controller = new AbortController();
        situationReportsRequestRef.current = controller;
        setSituationReportsLoadAttempted(false);
        setSituationReportsLoading(true);
        setSituationReportsLoadError(null);
        return import('../../api').then((api) => api.getSituationReports(selectedIncidentId, controller.signal));
      })
      .then((reports) => {
        if (situationReportsRequestRef.current?.signal.aborted) {
          return;
        }

        setSituationReports(reports);
        setSituationReportsLoadAttempted(true);
        setSituationReportsLoading(false);
        onOperationalDataChanged?.();
        setShowSitrepForm(false);
        setSitrepSummary('');
        setSitrepCurrentActions('');
        setSitrepPlannedActions('');
        setSitrepUnmetNeeds('');
        setSitrepOperationalPeriodId(null);
      })
      .catch((err) => {
        if (isAbortError(err)) {
          setSituationReportsLoading(false);
          return;
        }

        console.error('Failed to create situation report:', err);
        if (err instanceof ApiValidationError) {
          const firstValidationError = Object.values(err.validationErrors).flat()[0];
          const message = firstValidationError ?? err.message;
          setSituationReportsLoadError(message);
          onNotify?.(message, 'warning');
        } else {
          const message = err instanceof Error ? err.message : 'Failed to create situation report.';
          setSituationReportsLoadError(message);
          onNotify?.(message, 'danger');
        }
        setSituationReportsLoadAttempted(true);
        setSituationReportsLoading(false);
      });
  };

  const handleUserSelected = async (user: ActiveUser) => {
    if (selectedPositionForAssignment === null) {
      return false;
    }

    const didAssign = await onAssignCommandPosition(selectedPositionForAssignment, user.userId);
    if (didAssign) {
      setOptimisticAssignedUsers((current) => ({
        ...current,
        [selectedPositionForAssignment]: user.displayName,
      }));
      setShowUserPicker(false);
      setSelectedPositionForAssignment(null);
      return true;
    }

    return false;
  };

  const handleDownloadIapPacket = () => {
    if (!selectedIncidentId) {
      return;
    }

    if (iapExportBlockedReason) {
      onNotify?.(iapExportBlockedReason, 'warning');
      return;
    }

    import('../../api')
      .then((api) => api.exportIncidentIapPacketJson(selectedIncidentId))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `incident-${selectedIncidentId}-iap-packet.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error('Failed to export incident IAP packet:', error);
        if (error instanceof ApiValidationError) {
          const firstValidationError = Object.values(error.validationErrors).flat()[0];
          onNotify?.(firstValidationError ?? error.message, 'warning');
          return;
        }
        onNotify?.(error instanceof Error ? error.message : 'Unable to export incident IAP packet.', 'warning');
      });
  };

  const handlePrintIapPacket = () => {
    if (!selectedIncidentId) {
      return;
    }

    if (iapExportBlockedReason) {
      onNotify?.(iapExportBlockedReason, 'warning');
      return;
    }

    import('../../api')
      .then((api) => api.exportIncidentIapPacketPrintHtml(selectedIncidentId))
      .then((html) => {
        const popup = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
        if (!popup) {
          return;
        }

        popup.document.open();
        popup.document.documentElement.innerHTML = html;
        popup.document.close();
        popup.focus();
        popup.print();
      })
      .catch((error) => {
        console.error('Failed to load server-side IAP print HTML:', error);
        if (error instanceof ApiValidationError) {
          const firstValidationError = Object.values(error.validationErrors).flat()[0];
          onNotify?.(firstValidationError ?? error.message, 'warning');
          return;
        }
        onNotify?.(error instanceof Error ? error.message : 'Unable to print incident IAP packet.', 'warning');
      });
  };

  const handleDownloadIapGovernanceEvidence = () => {
    if (!selectedIncidentId) {
      return;
    }

    import('../../api')
      .then((api) => api.exportIncidentIapGovernanceEvidenceJson(selectedIncidentId))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `incident-${selectedIncidentId}-iap-governance-evidence.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error('Failed to export incident IAP governance evidence:', error);
        if (error instanceof ApiValidationError) {
          const firstValidationError = Object.values(error.validationErrors).flat()[0];
          onNotify?.(firstValidationError ?? error.message, 'warning');
          return;
        }
        onNotify?.(error instanceof Error ? error.message : 'Unable to export IAP governance evidence.', 'warning');
      });
  };

  return (
    <Card className="shadow-sm mb-3">
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <span>Incident Command Workspace</span>
        {incidentDetail && (
          <span className="small text-muted ms-2">
            {incidentDetail.incidentNumber} — {incidentDetail.incidentName}
            {incidentDetail.severityCode && (
              <Badge bg={severityVariant(incidentDetail.severityCode)} className="ms-2">
                {incidentDetail.severityCode}
              </Badge>
            )}
            <Badge bg={statusVariant(incidentDetail.incidentStatusCode)} className="ms-2">
              {incidentDetail.incidentStatusCode}
            </Badge>
          </span>
        )}
      </Card.Header>
      <Card.Body>
        {!isAuthenticated && <div className="text-muted small">Sign in to view incident details.</div>}
        {isAuthenticated && selectedIncidentId === null && <div className="text-muted small">Select an incident to view details.</div>}

        {incidentDetailLoading && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span>Loading incident details...</span>
          </div>
        )}

        {!incidentDetailLoading && !incidentDetailError && incidentDetail && (
          <>
            <div className="ipoc-incident-tabs-vertical-layout">
            <Nav
              variant="tabs"
              className="mb-3 ipoc-incident-tabs"
              activeKey={activeTab}
              onSelect={(key) => {
                if (key) {
                  setActiveTab(key as TabKey);
                  setActiveRemediationIntent(null);
                }
              }}
            >
              <Nav.Item>
                <Nav.Link eventKey="overview">
                  <span className="ipoc-admin-tab-title">
                    <i className="bi bi-info-circle ipoc-admin-tab-title-icon" aria-hidden="true" />
                    <span>Overview</span>
                  </span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="tasks">
                  <span className="ipoc-admin-tab-title">
                    <i className="bi bi-check2-square ipoc-admin-tab-title-icon" aria-hidden="true" />
                    <span>Tasks</span>
                  </span>
                  {incidentTasks.length > 0 && (
                    <Badge bg="secondary" className="ms-1">{incidentTasks.length}</Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="timeline">
                  <span className="ipoc-admin-tab-title">
                    <i className="bi bi-clock-history ipoc-admin-tab-title-icon" aria-hidden="true" />
                    <span>Timeline</span>
                  </span>
                  {incidentTimelineEvents.length > 0 && (
                    <Badge bg="secondary" className="ms-1">{incidentTimelineEvents.length}</Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="periods">
                  <span className="ipoc-admin-tab-title">
                    <i className="bi bi-calendar3 ipoc-admin-tab-title-icon" aria-hidden="true" />
                    <span>Periods &amp; Objectives</span>
                  </span>
                  {(incidentOperationalPeriods.length + incidentObjectives.length) > 0 && (
                    <Badge bg="secondary" className="ms-1">{incidentOperationalPeriods.length}/{incidentObjectives.length}</Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="resources">
                  <span className="ipoc-admin-tab-title">
                    <i className="bi bi-box-seam ipoc-admin-tab-title-icon" aria-hidden="true" />
                    <span>Resources</span>
                  </span>
                  {resourceRequests.length > 0 && (
                    <Badge bg="secondary" className="ms-1">{resourceRequests.length}</Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="communications">
                  <span className="ipoc-admin-tab-title">
                    <i className="bi bi-broadcast ipoc-admin-tab-title-icon" aria-hidden="true" />
                    <span>Communications</span>
                  </span>
                  {communications.length > 0 && (
                    <Badge bg="secondary" className="ms-1">{communications.length}</Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="sitrep">
                  <span className="ipoc-admin-tab-title">
                    <i className="bi bi-file-earmark-text ipoc-admin-tab-title-icon" aria-hidden="true" />
                    <span>SITREP / IAP</span>
                  </span>
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <div className="ipoc-incident-tab-content">

            {/* ── Overview tab ── */}
            {activeTab === 'overview' && (
              <>
                <Row className="g-2 mb-3">
                  <Col md={6}><strong>Incident</strong><div>{incidentDetail.incidentNumber} — {incidentDetail.incidentName}</div></Col>
                  <Col md={3}><strong>Type</strong><div>{incidentDetail.incidentTypeCode}</div></Col>
                  <Col md={3}><strong>Planned</strong><div>{incidentDetail.isPlannedEvent ? 'Yes' : 'No'}</div></Col>
                  <Col md={3}>
                    <strong>Status</strong>
                    <div>
                      <Badge bg={statusVariant(incidentDetail.incidentStatusCode)}>
                        {incidentDetail.incidentStatusCode}
                      </Badge>
                    </div>
                  </Col>
                  <Col md={3}>
                    <strong>Severity</strong>
                    <div>
                      {incidentDetail.severityCode
                        ? <Badge bg={severityVariant(incidentDetail.severityCode)}>{incidentDetail.severityCode}</Badge>
                        : <span className="text-muted">—</span>}
                    </div>
                  </Col>
                  <Col md={3}><strong>Activated</strong><div>{incidentDetail.activatedUtc ? new Date(incidentDetail.activatedUtc).toLocaleString() : 'Not activated'}</div></Col>
                  <Col md={3}><strong>Created</strong><div>{new Date(incidentDetail.createdUtc).toLocaleString()}</div></Col>
                </Row>

                <div className="d-flex flex-wrap align-items-center gap-2 mb-3 small">
                  <span className="text-muted">Workspace snapshot:</span>
                  <Badge bg="light" text="dark">Tasks {incidentTasks.length}</Badge>
                  <Badge bg="light" text="dark">Timeline {incidentTimelineEvents.length}</Badge>
                  <Badge bg="light" text="dark">Periods {incidentOperationalPeriods.length}</Badge>
                  <Badge bg="light" text="dark">Objectives {incidentObjectives.length}</Badge>
                </div>

                {operationalInsight && (
                  <div className="analytics-shell mb-3">
                    <div className="small fw-semibold mb-2 d-flex align-items-center gap-2">
                      <span>Operational Insight</span>
                      <LabelWithInfo
                        text=""
                        info="Operational insight summarizes command tempo, planning cadence, compliance posture, and mission dependency pressure for the active incident."
                      />
                    </div>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <Badge bg={operationalInsight.attentionLevel === 'high' ? 'danger' : operationalInsight.attentionLevel === 'moderate' ? 'info' : 'secondary'}>
                        Attention {operationalInsight.attentionLevel.toUpperCase()}
                      </Badge>
                      {operationalInsight.staleTimelineHours !== null && operationalInsight.staleTimelineHours > 24 && (
                        <Badge bg="danger">Timeline stale {operationalInsight.staleTimelineHours}h</Badge>
                      )}
                      {operationalInsight.staleSitrepHours !== null && operationalInsight.staleSitrepHours > 24 && (
                        <Badge bg="danger">SITREP stale {operationalInsight.staleSitrepHours}h</Badge>
                      )}
                    </div>
                    <div className="d-flex flex-wrap gap-2 mb-2 small">
                      <Badge bg="light" text="dark">Tasks 24h: {operationalInsight.taskActivity24hCount} (Δ {formatDelta(operationalInsight.taskActivity24hDelta)})</Badge>
                      <Badge bg="light" text="dark">Timeline 24h: {operationalInsight.timelineActivity24hCount} (Δ {formatDelta(operationalInsight.timelineActivity24hDelta)})</Badge>
                      <Badge bg="light" text="dark">Comms 24h: {operationalInsight.communicationActivity24hCount} (Δ {formatDelta(operationalInsight.communicationActivity24hDelta)})</Badge>
                      <Badge bg="light" text="dark">SITREP: {operationalInsight.staleSitrepHours === null ? 'No SITREP' : `${operationalInsight.staleSitrepHours}h stale`}</Badge>
                      <Badge bg={transferInsightSignal.variant}>{transferInsightSignal.label}: {transferInsightSignal.detail}</Badge>
                    </div>
                    <Accordion flush>
                      <Accordion.Item eventKey="operational-insight-details">
                        <Accordion.Header>Insight Details</Accordion.Header>
                        <Accordion.Body className="small">
                          <div className="mb-1">
                            Attention score: {operationalInsight.attentionScore} ({operationalInsight.attentionLevel})
                          </div>
                          <div className="mb-1">
                            Incident maturity: <Badge bg={operationalInsight.maturityLevel === 'Type1' ? 'success' : operationalInsight.maturityLevel === 'Type2' ? 'info' : operationalInsight.maturityLevel === 'Type3' ? 'secondary' : operationalInsight.maturityLevel === 'Type4' ? 'warning' : 'danger'}>{operationalInsight.maturityLevel}</Badge> (score {operationalInsight.maturityScore})
                          </div>
                          <div className="mb-1">
                            NIMS compliance: <Badge bg={operationalInsight.nimsComplianceLevel === 'compliant' ? 'success' : operationalInsight.nimsComplianceLevel === 'watch' ? 'warning' : 'danger'}>{operationalInsight.nimsComplianceLevel.toUpperCase()}</Badge> (score {operationalInsight.nimsComplianceScore})
                          </div>
                          <div className="mb-1">
                            Mission dependency graph: <Badge bg={operationalInsight.missionDependencyStatus === 'stable' ? 'success' : operationalInsight.missionDependencyStatus === 'watch' ? 'warning' : 'danger'}>{operationalInsight.missionDependencyStatus.toUpperCase()}</Badge> (nodes {operationalInsight.missionDependencyNodeCount}, edges {operationalInsight.missionDependencyEdgeCount})
                          </div>
                          {operationalInsight.needsAttention && (
                            <div className="mt-2">
                              <span className="fw-semibold">Needs Attention:</span> {operationalInsight.needsAttentionReasons.join(' · ')}
                            </div>
                          )}
                          {operationalInsight.nimsComplianceGaps.length > 0 && (
                            <div className="mt-2">
                              <span className="fw-semibold">NIMS compliance gaps:</span> {operationalInsight.nimsComplianceGaps.join(' · ')}
                            </div>
                          )}
                          {operationalInsight.missionDependencyBlockers.length > 0 && (
                            <div className="mt-2">
                              <span className="fw-semibold">Dependency blockers:</span> {operationalInsight.missionDependencyBlockers.join(' · ')}
                            </div>
                          )}
                          {operationalInsight.commandPostureRecommendations.length > 0 && (
                            <div className="mt-2">
                              <span className="fw-semibold">Command posture recommendations:</span> {operationalInsight.commandPostureRecommendations.join(' · ')}
                            </div>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>
                    </Accordion>
                  </div>
                )}

                <Card className="mb-3 border-light-subtle" data-testid="incident-iap-cycle-status-card">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-arrow-repeat" aria-hidden="true" />
                    <span className="me-auto">IAP Cycle Status</span>
                    <LabelWithInfo
                      text=""
                      info="Tracks ICS planning cycle progression: Understand, Objectives, Develop, Approve, Execute, Evaluate and revise."
                    />
                  </Card.Header>
                  <Card.Body>
                    <IpocDataGrid
                      gridId="incident-iap-cycle-status-grid"
                      rowData={iapCycleStatusRows}
                      columnDefs={iapCycleStatusColumnDefs}
                      emptyMessage="No IAP cycle status available."
                      pageSize={6}
                      height={280}
                    />
                  </Card.Body>
                </Card>

                <Card className="mb-3 border-light-subtle">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-diagram-3" aria-hidden="true" />
                    <span className="me-auto">ICS Command Structure</span>
                    <LabelWithInfo
                      text=""
                      info="Use this command structure board to manage role coverage, current assignments, and assignment notes in a dense operational view."
                    />
                    <IconActionButton
                      iconClassName="bi bi-journal-text"
                      tooltip="Open ICS workflow context diagram in User Guide"
                      ariaLabel="Open ICS workflow context diagram in User Guide"
                      onClick={handleOpenIcsWorkflowGuide}
                      variant="outline-secondary"
                      testId="incident-open-ics-workflow-guide"
                    />
                    <IconActionButton
                      iconClassName={isIcsCommandStructureExpanded ? 'bi bi-arrows-collapse' : 'bi bi-arrows-expand'}
                      tooltip={isIcsCommandStructureExpanded ? 'Collapse ICS command structure section' : 'Expand ICS command structure section'}
                      ariaLabel={isIcsCommandStructureExpanded ? 'Collapse ICS command structure section' : 'Expand ICS command structure section'}
                      onClick={() => setIsIcsCommandStructureExpanded((current) => !current)}
                      disabled={!isAuthenticated}
                      variant="outline-secondary"
                    />
                    <IconActionButton
                      iconClassName="bi bi-arrow-clockwise"
                      tooltip="Refresh ICS positions and assignment board using the latest role definitions."
                      ariaLabel="Refresh ICS positions"
                      onClick={onRefreshIcsPositions}
                      disabled={!isAuthenticated || icsPositionsLoading || incidentActionLoading}
                      variant="outline-secondary"
                    />
                  </Card.Header>
                  <Card.Body>
                    {!isIcsCommandStructureExpanded ? (
                      <div className="text-muted small">ICS command structure is collapsed. Expand to view and manage assignments.</div>
                    ) : incidentCommandAssignmentsLoading || icsPositionsLoading ? (
                      <div className="text-center py-3">
                        <Spinner animation="border" size="sm" role="status">
                          <span className="visually-hidden">Loading command assignments...</span>
                        </Spinner>
                      </div>
                    ) : icsPositions.length === 0 ? (
                      <div className="text-muted small">ICS command positions are not configured yet.</div>
                    ) : (
                      <IpocDataGrid
                        gridId="incident-ics-command-structure"
                        rowData={icsCommandStructureRows}
                        columnDefs={icsCommandStructureColumnDefs}
                        emptyMessage="No command positions configured."
                        pageSize={10}
                        height={380}
                      />
                    )}
                  </Card.Body>
                </Card>

                <Card className="mb-3 border-light-subtle" data-testid="incident-command-transfer-ledger-card">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-arrow-left-right" aria-hidden="true" />
                    <span className="me-auto">ICS Command Transfer Ledger</span>
                    <LabelWithInfo
                      text=""
                      info="Log command transfer events and verify assignment continuity across operational periods and demobilization handoffs."
                    />
                    <IconActionButton
                      iconClassName="bi bi-arrow-clockwise"
                      tooltip="Refresh command transfer ledger"
                      ariaLabel="Refresh command transfer ledger"
                      onClick={() => { void loadCommandTransferLog(); }}
                      disabled={!isAuthenticated || commandTransferLogLoading}
                      variant="outline-secondary"
                    />
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-2 mb-3" data-testid="incident-command-transfer-entry-form">
                      <Col lg={2} md={6}>
                        <Form.Group controlId="commandTransferPositionId">
                          <Form.Label className="small mb-1">Position</Form.Label>
                          <Form.Control
                            size="sm"
                            as="select"
                            value={transferPositionIdInput}
                            onChange={(event) => setTransferPositionIdInput(event.target.value)}
                          >
                            <option value="">Select position</option>
                            {transferPositionOptions.map((option) => (
                              <option key={`transfer-position-${option.value}`} value={option.value}>{option.label}</option>
                            ))}
                          </Form.Control>
                        </Form.Group>
                      </Col>
                      <Col lg={2} md={6}>
                        <Form.Group controlId="commandTransferAssignedUserId">
                          <Form.Label className="small mb-1">Assigned User</Form.Label>
                          <Form.Control
                            size="sm"
                            as="select"
                            value={transferAssignedUserIdInput}
                            onChange={(event) => setTransferAssignedUserIdInput(event.target.value)}
                          >
                            <option value="">Select user</option>
                            {transferUserOptions.map((option) => (
                              <option key={`transfer-user-${option.value}`} value={option.value}>{option.label}</option>
                            ))}
                          </Form.Control>
                        </Form.Group>
                      </Col>
                      <Col lg={3} md={6}>
                        <Form.Group controlId="commandTransferSummary">
                          <Form.Label className="small mb-1">Transfer Summary</Form.Label>
                          <Form.Control
                            size="sm"
                            value={transferSummaryInput}
                            onChange={(event) => setTransferSummaryInput(event.target.value)}
                            placeholder="Transferred from Fire to Public Works"
                            maxLength={500}
                          />
                        </Form.Group>
                      </Col>
                      <Col lg={3} md={6}>
                        <Form.Group controlId="commandTransferCommandPost">
                          <Form.Label className="small mb-1">Command Post</Form.Label>
                          <Form.Control
                            size="sm"
                            value={transferCommandPostLocationInput}
                            onChange={(event) => setTransferCommandPostLocationInput(event.target.value)}
                            placeholder="Public Works truck"
                            maxLength={200}
                          />
                        </Form.Group>
                      </Col>
                      <Col lg={2} md={12} className="d-flex align-items-end justify-content-end">
                        <IconActionButton
                          iconClassName="bi bi-plus-circle"
                          tooltip="Create command transfer ledger entry"
                          ariaLabel="Create command transfer ledger entry"
                          onClick={() => { void handleCreateCommandTransferLog(); }}
                          disabled={!isAuthenticated || incidentActionLoading}
                          variant="outline-primary"
                        />
                      </Col>
                    </Row>

                    <Row className="g-2 mb-3" data-testid="incident-command-transfer-filter-form">
                      <Col lg={2} md={6}>
                        <Form.Group controlId="commandTransferStatusFilter">
                          <Form.Label className="small mb-1">Status Filter</Form.Label>
                          <Form.Select
                            size="sm"
                            value={transferStatusFilter}
                            onChange={(event) => setTransferStatusFilter(event.target.value)}
                          >
                            {transferStatusFilterOptions.map((option) => (
                              <option key={`transfer-status-filter-${option}`} value={option}>{option}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col lg={2} md={6}>
                        <Form.Group controlId="commandTransferSectionFilter">
                          <Form.Label className="small mb-1">Section Filter</Form.Label>
                          <Form.Select
                            size="sm"
                            value={transferSectionFilter}
                            onChange={(event) => setTransferSectionFilter(event.target.value)}
                          >
                            {transferSectionFilterOptions.map((option) => (
                              <option key={`transfer-section-filter-${option}`} value={option}>{option}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col lg={2} md={6}>
                        <Form.Group controlId="commandTransferDateFromFilter">
                          <Form.Label className="small mb-1">Date From (UTC)</Form.Label>
                          <Form.Control
                            size="sm"
                            type="date"
                            value={transferDateFromFilter}
                            onChange={(event) => setTransferDateFromFilter(event.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col lg={2} md={6}>
                        <Form.Group controlId="commandTransferDateToFilter">
                          <Form.Label className="small mb-1">Date To (UTC)</Form.Label>
                          <Form.Control
                            size="sm"
                            type="date"
                            value={transferDateToFilter}
                            onChange={(event) => setTransferDateToFilter(event.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      <Col lg={3} md={6}>
                        <Form.Group controlId="commandTransferPresetName">
                          <Form.Label className="small mb-1">Preset Name</Form.Label>
                          <Form.Control
                            size="sm"
                            value={transferFilterPresetNameInput}
                            onChange={(event) => setTransferFilterPresetNameInput(event.target.value)}
                            placeholder="Night shift handoff"
                            maxLength={80}
                          />
                        </Form.Group>
                      </Col>
                      <Col lg={4} md={12} className="d-flex align-items-end justify-content-end gap-2">
                        <IconActionButton
                          iconClassName="bi bi-bookmark-plus"
                          tooltip="Save current transfer filter preset"
                          ariaLabel="Save current transfer filter preset"
                          onClick={() => { void handleSaveTransferFilterPreset(); }}
                          disabled={!isAuthenticated || commandTransferLogLoading}
                          variant="outline-primary"
                          testId="incident-transfer-filter-preset-save"
                        />
                        <IconActionButton
                          iconClassName="bi bi-calendar-day"
                          tooltip="Apply quick range: Today"
                          ariaLabel="Apply quick range: Today"
                          onClick={() => handleApplyTransferQuickRange('today')}
                          disabled={!isAuthenticated || commandTransferLogLoading}
                          variant="outline-secondary"
                          testId="incident-transfer-quick-range-today"
                        />
                        <IconActionButton
                          iconClassName="bi bi-clock-history"
                          tooltip="Apply quick range: Last 24h"
                          ariaLabel="Apply quick range: Last 24h"
                          onClick={() => handleApplyTransferQuickRange('last24h')}
                          disabled={!isAuthenticated || commandTransferLogLoading}
                          variant="outline-secondary"
                          testId="incident-transfer-quick-range-last24h"
                        />
                        <IconActionButton
                          iconClassName="bi bi-calendar-week"
                          tooltip="Apply quick range: Last 7d"
                          ariaLabel="Apply quick range: Last 7d"
                          onClick={() => handleApplyTransferQuickRange('last7d')}
                          disabled={!isAuthenticated || commandTransferLogLoading}
                          variant="outline-secondary"
                          testId="incident-transfer-quick-range-last7d"
                        />
                        <IconActionButton
                          iconClassName="bi bi-eraser"
                          tooltip="Clear transfer ledger filters"
                          ariaLabel="Clear transfer ledger filters"
                          onClick={handleClearTransferFilters}
                          disabled={!isAuthenticated || commandTransferLogLoading}
                          variant="outline-secondary"
                        />
                        <IconActionButton
                          iconClassName="bi bi-download"
                          tooltip="Export filtered command transfer ledger as CSV"
                          ariaLabel="Export filtered command transfer ledger as CSV"
                          onClick={handleExportTransferLedgerCsv}
                          disabled={!isAuthenticated || filteredIncidentCommandTransferLogRows.length === 0}
                          variant="outline-primary"
                        />
                        <IconActionButton
                          iconClassName="bi bi-filetype-json"
                          tooltip="Export filtered command transfer ledger as JSON"
                          ariaLabel="Export filtered command transfer ledger as JSON"
                          onClick={handleExportTransferLedgerJson}
                          disabled={!isAuthenticated || filteredIncidentCommandTransferLogRows.length === 0}
                          variant="outline-primary"
                        />
                      </Col>
                    </Row>

                    <div className="d-flex flex-wrap gap-2 mb-3" data-testid="incident-command-transfer-preset-list">
                      {transferFilterPresets.length === 0 ? (
                        <span className="small text-muted">No saved transfer presets.</span>
                      ) : transferFilterPresets.map((preset) => (
                        <div key={preset.id} className="d-flex align-items-center gap-1 border rounded px-2 py-1">
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-decoration-none p-0"
                            onClick={() => handleApplyTransferFilterPreset(preset)}
                            data-testid="incident-transfer-filter-preset-apply"
                          >
                            {preset.name}
                          </button>
                          <IconActionButton
                            iconClassName="bi bi-trash"
                            tooltip={`Delete transfer filter preset ${preset.name}`}
                            ariaLabel={`Delete transfer filter preset ${preset.name}`}
                            onClick={() => { void handleDeleteTransferFilterPreset(preset); }}
                            disabled={!isAuthenticated}
                            variant="outline-secondary"
                            testId="incident-transfer-filter-preset-delete"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="d-flex flex-wrap gap-2 mb-3 small" data-testid="incident-command-transfer-summary-chips">
                      <Badge bg="light" text="dark">Rows in scope {transferLedgerSummary.inScopeRows}</Badge>
                      <Badge bg="light" text="dark">Total rows {transferLedgerSummary.totalRows}</Badge>
                      <Badge bg="light" text="dark">Sections {transferLedgerSummary.sectionCount}</Badge>
                      <Badge bg="light" text="dark">Latest transfer {transferLedgerSummary.latestTransferUtc}</Badge>
                    </div>

                    {commandTransferLogLoading ? (
                      <div className="text-center py-3">
                        <Spinner animation="border" size="sm" role="status">
                          <span className="visually-hidden">Loading command transfer log...</span>
                        </Spinner>
                      </div>
                    ) : filteredIncidentCommandTransferLogRows.length === 0 ? (
                      <div className="text-muted small">No command transfer entries logged for this incident.</div>
                    ) : (
                      <IpocDataGrid
                        gridId="incident-command-transfer-log-grid"
                        rowData={filteredIncidentCommandTransferLogRows}
                        columnDefs={incidentCommandTransferLogColumnDefs}
                        emptyMessage="No command transfer entries logged for this incident."
                        pageSize={8}
                        height={300}
                      />
                    )}
                  </Card.Body>
                </Card>

                <Card className="border-light-subtle mb-3">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-list-check" aria-hidden="true" />
                    ICS-204 Assignment List
                  </Card.Header>
                  <Card.Body>
                    {ics204Loading && (
                      <div className="small ipoc-loading-inline">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        <span>Loading ICS-204 data...</span>
                      </div>
                    )}
                    {!ics204Loading && ics204LoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2">
                        <span>{ics204LoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading ICS-204 data"
                          ariaLabel="Retry loading ICS-204 data"
                          onClick={() => { setIcs204LoadAttempted(false); setIcs204LoadError(null); }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}
                    {!ics204Loading && ics204Data && (
                      <>
                        <div className="small text-muted mb-2">Generated: {new Date(ics204Data.generatedUtc).toLocaleString()}</div>
                        {ics204Data.assignments.length === 0 ? (
                          <div className="small text-muted">No assignment tasks recorded.</div>
                        ) : (
                          <IpocDataGrid
                            gridId="incident-ics204-assignments"
                            rowData={ics204GridRows}
                            columnDefs={ics204GridColumnDefs}
                            emptyMessage="No assignment tasks recorded."
                            pageSize={10}
                          />
                        )}
                      </>
                    )}
                  </Card.Body>
                </Card>

                <Card className="border-light-subtle mb-3">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-journal-text" aria-hidden="true" />
                    ICS-214 Unit Log
                  </Card.Header>
                  <Card.Body>
                    {ics214Loading && (
                      <div className="small ipoc-loading-inline">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        <span>Loading ICS-214 data...</span>
                      </div>
                    )}
                    {!ics214Loading && ics214LoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2">
                        <span>{ics214LoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading ICS-214 data"
                          ariaLabel="Retry loading ICS-214 data"
                          onClick={() => { setIcs214LoadAttempted(false); setIcs214LoadError(null); }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}
                    {!ics214Loading && ics214Data && (
                      <>
                        <div className="small text-muted mb-2">Generated: {new Date(ics214Data.generatedUtc).toLocaleString()}</div>
                        {ics214Data.entries.length === 0 ? (
                          <div className="small text-muted">No unit log activity recorded.</div>
                        ) : (
                          <IpocDataGrid
                            gridId="incident-ics214-unit-log"
                            rowData={ics214GridRows}
                            columnDefs={ics214GridColumnDefs}
                            emptyMessage="No unit log activity recorded."
                            pageSize={10}
                          />
                        )}
                      </>
                    )}
                  </Card.Body>
                </Card>

                <Card className="border-light-subtle mb-3">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-shield-check" aria-hidden="true" />
                    ICS-215 Incident Action Plan Safety Analysis
                  </Card.Header>
                  <Card.Body>
                    {ics215Loading && (
                      <div className="small ipoc-loading-inline">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        <span>Loading ICS-215 data...</span>
                      </div>
                    )}
                    {!ics215Loading && ics215LoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2">
                        <span>{ics215LoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading ICS-215 data"
                          ariaLabel="Retry loading ICS-215 data"
                          onClick={() => { setIcs215LoadAttempted(false); setIcs215LoadError(null); }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}
                    {!ics215Loading && ics215Data && (
                      <>
                        <div className="small text-muted mb-2">Generated: {new Date(ics215Data.generatedUtc).toLocaleString()}</div>
                        {ics215Data.safetyItems.length === 0 ? (
                          <div className="small text-muted">No active safety analysis items detected.</div>
                        ) : (
                          <IpocDataGrid
                            gridId="incident-ics215-safety-analysis"
                            rowData={ics215GridRows}
                            columnDefs={ics215GridColumnDefs}
                            emptyMessage="No active safety analysis items detected."
                            pageSize={10}
                          />
                        )}
                      </>
                    )}
                  </Card.Body>
                </Card>

                <Card className="mb-3 border-light-subtle">
                  <Card.Header className="small fw-semibold">Edit Incident Metadata</Card.Header>
                  <Card.Body>
                    <Row className="g-2 align-items-end mb-2">
                      <Col md={4}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Incident Name" info="Operational display name for the incident record." /></Form.Label>
                        <Form.Control
                          value={incidentEditName}
                          onChange={(event) => setIncidentEditName(event.target.value)}
                          placeholder="Incident name"
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Incident Type" info="Classification of the incident used for reporting and workflow." /></Form.Label>
                        <Form.Select
                          value={incidentEditTypeCode}
                          onChange={(event) => setIncidentEditTypeCode(event.target.value)}
                        >
                          {incidentTypeLookups.map((item) => (
                            <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Severity" info="Optional severity level indicating operational impact." /></Form.Label>
                        <Form.Select
                          value={incidentEditSeverity}
                          onChange={(event) => setIncidentEditSeverity(event.target.value)}
                        >
                          <option value="">Optional</option>
                          {incidentSeverityLookups.map((item) => (
                            <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={4}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Primary Location" info="Primary incident location; updates Lead Organization and Region based on selected location." /></Form.Label>
                        <Form.Select
                          value={incidentEditPrimaryLocationId}
                          onChange={(event) => setIncidentEditPrimaryLocationId(event.target.value)}
                        >
                          <option value="">Select location</option>
                          {locationLookups.map((location) => (
                            <option key={location.locationId} value={location.locationId}>{location.displayText}</option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>

                    <Row className="g-2 align-items-end mb-2">
                      <Col md={6}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Initial Summary" info="Brief initial description captured when the incident is created." /></Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={incidentEditInitialSummary}
                          onChange={(event) => setIncidentEditInitialSummary(event.target.value)}
                          placeholder="Initial incident summary"
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Situation Summary" info="Current operational summary reflecting latest conditions." /></Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={incidentEditSituationSummary}
                          onChange={(event) => setIncidentEditSituationSummary(event.target.value)}
                          placeholder="Current situation summary"
                        />
                      </Col>
                    </Row>

                    <Row className="g-2 align-items-end">
                      <Col md={3}>
                        <Form.Check
                          id="incident-edit-planned"
                          type="checkbox"
                          label="Planned Event"
                          checked={incidentEditPlanned}
                          onChange={(event) => setIncidentEditPlanned(event.target.checked)}
                        />
                      </Col>
                      <Col md={6} />
                      <Col md={3} className="d-flex justify-content-end align-items-end">
                        <IconActionButton
                          iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : 'bi bi-floppy'}
                          tooltip="Save incident metadata updates (name, type, location, severity, and summaries)."
                          ariaLabel="Save incident metadata"
                          onClick={onSaveIncidentMetadata}
                          variant="outline-primary"
                          disabled={incidentActionLoading || !isAuthenticated}
                        />
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                <div className="d-flex gap-2">
                  <IconActionButton
                    iconClassName="bi bi-play-fill"
                    tooltip="Activate incident"
                    ariaLabel="Activate incident"
                    onClick={onActivateIncident}
                    variant="outline-success"
                    className="incident-activate-btn"
                    disabled={!isAuthenticated || incidentActionLoading || incidentDetail.incidentStatusCode === 'Active' || incidentDetail.incidentStatusCode === 'Closed'}
                  />
                  <IconActionButton
                    iconClassName="bi bi-stop-fill"
                    tooltip="Close incident"
                    ariaLabel="Close incident"
                    onClick={onCloseIncident}
                    variant="outline-danger"
                    className="incident-close-btn"
                    disabled={!isAuthenticated || incidentActionLoading || incidentDetail.incidentStatusCode === 'Closed'}
                  />
                </div>
              </>
            )}

            {/* ── Tasks tab ── */}
            {activeTab === 'tasks' && (
              <Card className="border-light-subtle">
                <Card.Header className="small fw-semibold">Task Board</Card.Header>
                <Card.Body>
                  <Row className="g-2 align-items-end mb-3">
                    <Col md={4}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Task Title" info="Required short title for the task item." /> <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        value={taskTitleInput}
                        onChange={(event) => setTaskTitleInput(event.target.value)}
                        placeholder="Task title"
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Priority" info="Urgency level used for task triage and sorting." /></Form.Label>
                      <Form.Select value={taskPriorityInput} onChange={(event) => setTaskPriorityInput(event.target.value)}>
                        {taskPriorityLookups.map((item) => (
                          <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Due (optional)" info="Optional due date/time for task completion." /></Form.Label>
                      <Form.Control
                        type="datetime-local"
                        value={taskDueInput}
                        onChange={(event) => setTaskDueInput(event.target.value)}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Assigned User (optional)" info="Optional active user assigned as task owner." /></Form.Label>
                      <Form.Select
                        value={taskAssignedToUserIdInput}
                        onChange={(event) => setTaskAssignedToUserIdInput(event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {taskAssignableUsers.map((user) => (
                          <option key={user.userId} value={user.userId}>{user.displayName}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={2} className="d-flex justify-content-end align-items-end">
                      <IconActionButton
                        iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : 'bi bi-plus-square'}
                        tooltip="Add incident task"
                        ariaLabel="Add incident task"
                        onClick={onCreateIncidentTask}
                        variant="outline-primary"
                        disabled={incidentActionLoading || !isAuthenticated || !isTaskTitleValid}
                      />
                    </Col>
                    <Col md={12}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Description" info="Optional details, context, and expected outcomes for the task." /></Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={taskDescriptionInput}
                        onChange={(event) => setTaskDescriptionInput(event.target.value)}
                        placeholder="Task details (optional)"
                      />
                    </Col>
                  </Row>

                  <Row className="g-2 align-items-end mb-3">
                    <Col md={4}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Filter by Assignee" info="Limit task board rows to a specific assigned user or unassigned tasks." /></Form.Label>
                      <Form.Select value={taskAssigneeFilter} onChange={(event) => setTaskAssigneeFilter(event.target.value)}>
                        <option value="all">All Assignees</option>
                        <option value="unassigned">Unassigned</option>
                        {taskAssignableUsers.map((user) => (
                          <option key={user.userId} value={user.userId.toString()}>{user.displayName}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={4}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Filter by Status" info="Limit task board rows to a specific task status." /></Form.Label>
                      <Form.Select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)}>
                        <option value="all">All Statuses</option>
                        {taskStatusFilterOptions.filter((item) => item !== 'all').map((statusCode) => (
                          <option key={statusCode} value={statusCode}>{statusCode}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={4} className="d-flex justify-content-end">
                      <Badge bg="secondary" className="align-self-center">Showing {filteredIncidentTasks.length} of {incidentTasks.length}</Badge>
                    </Col>
                  </Row>

                  {incidentTasksLoading && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <Spinner animation="border" size="sm" />
                      <span className="small">Loading incident tasks...</span>
                    </div>
                  )}

                  {taskAssignableUsersLoading && (
                    <div className="small text-muted mb-2">Loading active users for task assignment...</div>
                  )}

                  {!incidentTasksLoading && incidentTasks.length === 0 && (
                    <div className="text-muted small">No tasks recorded for this incident yet.</div>
                  )}

                  {!incidentTasksLoading && incidentTasks.length > 0 && filteredIncidentTasks.length === 0 && (
                    <div className="text-muted small">No tasks match the current assignee/status filters.</div>
                  )}

                  {!incidentTasksLoading && filteredIncidentTasks.length > 0 && (
                    <IpocDataGrid
                      gridId="incident-task-board"
                      rowData={filteredIncidentTasksGridRows}
                      columnDefs={filteredIncidentTasksGridColumnDefs}
                      emptyMessage="No tasks match the current assignee/status filters."
                      pageSize={25}
                    />
                  )}
                </Card.Body>
              </Card>
            )}

            {/* ── Timeline tab ── */}
            {activeTab === 'timeline' && (
              <Card className="border-light-subtle">
                <Card.Header className="small fw-semibold">Incident Timeline</Card.Header>
                <Card.Body>
                  <Row className="g-2 align-items-end mb-3">
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Event Type" info="Required timeline event category." /> <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        value={timelineTypeInput}
                        onChange={(event) => setTimelineTypeInput(event.target.value)}
                      >
                        {timelineEventTypeLookups.map((item) => (
                          <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={5}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Event Title" info="Required brief title for the timeline entry." /> <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        value={timelineTitleInput}
                        onChange={(event) => setTimelineTitleInput(event.target.value)}
                        placeholder="Timeline event title"
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Event Time" info="Timestamp for when the timeline event occurred." /></Form.Label>
                      <Form.Control
                        type="datetime-local"
                        value={timelineEventUtcInput}
                        onChange={(event) => setTimelineEventUtcInput(event.target.value)}
                      />
                    </Col>
                    <Col md={2} className="d-flex justify-content-end align-items-end">
                      <IconActionButton
                        iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : 'bi bi-clock-history'}
                        tooltip="Add timeline event"
                        ariaLabel="Add timeline event"
                        onClick={onCreateIncidentTimelineEvent}
                        variant="outline-primary"
                        disabled={incidentActionLoading || !isAuthenticated || !isTimelineTypeValid || !isTimelineTitleValid}
                      />
                    </Col>
                    <Col md={12}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Description" info="Optional narrative details for this timeline event." /></Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={timelineDescriptionInput}
                        onChange={(event) => setTimelineDescriptionInput(event.target.value)}
                        placeholder="Timeline context (optional)"
                      />
                    </Col>
                  </Row>

                  {incidentTimelineLoading && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <Spinner animation="border" size="sm" />
                      <span className="small">Loading timeline events...</span>
                    </div>
                  )}

                  {!incidentTimelineLoading && incidentTimelineEvents.length === 0 && (
                    <div className="text-muted small">No timeline events recorded yet.</div>
                  )}

                  {!incidentTimelineLoading && incidentTimelineEvents.length > 0 && (
                    <IpocDataGrid
                      gridId="incident-timeline-events"
                      rowData={incidentTimelineGridRows}
                      columnDefs={incidentTimelineGridColumnDefs}
                      emptyMessage="No timeline events recorded yet."
                      pageSize={25}
                    />
                  )}
                </Card.Body>
              </Card>
            )}

            {/* ── Periods & Objectives tab ── */}
            {activeTab === 'periods' && (
              <>
                {activeRemediationIntent === 'iap-approve-period' && (
                  <div className="small text-warning d-flex align-items-center gap-2 mb-2" data-testid="incident-remediation-hint-periods">
                    <span>Remediation focus: approve at least one operational period to clear IAP governance blockers.</span>
                    <IconActionButton
                      iconClassName="bi bi-x-circle"
                      tooltip="Dismiss remediation focus hint"
                      ariaLabel="Dismiss remediation focus hint"
                      onClick={clearRemediationIntent}
                      variant="outline-secondary"
                      size="sm"
                      testId="incident-remediation-dismiss-periods"
                    />
                  </div>
                )}
                <Card className="mb-3 border-light-subtle">
                  <Card.Header className="small fw-semibold">Operational Periods</Card.Header>
                  <Card.Body>
                    <Row className="g-2 align-items-end mb-3">
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Period #" info="Required operational period sequence number." /> <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          value={operationalPeriodNumberInput}
                          onChange={(event) => setOperationalPeriodNumberInput(event.target.value)}
                          placeholder="1"
                          isInvalid={operationalPeriodNumberInput.trim().length > 0 && !isOperationalPeriodNumberValid}
                        />
                      </Col>
                      <Col md={4}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Name" info="Optional descriptive name for this operational period." /></Form.Label>
                        <Form.Control
                          value={operationalPeriodNameInput}
                          onChange={(event) => setOperationalPeriodNameInput(event.target.value)}
                          placeholder="Operational period name"
                        />
                      </Col>
                      <Col md={3}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Start" info="Required start date/time for this operational period." /> <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={operationalPeriodStartInput}
                          onChange={(event) => setOperationalPeriodStartInput(event.target.value)}
                          isInvalid={hasOperationalPeriodWindow && !isOperationalPeriodWindowOrderValid}
                        />
                      </Col>
                      <Col md={3}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="End" info="Required end date/time for this operational period." /> <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={operationalPeriodEndInput}
                          onChange={(event) => setOperationalPeriodEndInput(event.target.value)}
                          isInvalid={hasOperationalPeriodWindow && !isOperationalPeriodWindowOrderValid}
                        />
                      </Col>
                      <Col md={3}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Status" info="Required lifecycle state for the operational period." /> <span className="text-danger">*</span></Form.Label>
                        <Form.Select
                          value={operationalPeriodStatusInput}
                          onChange={(event) => setOperationalPeriodStatusInput(event.target.value)}
                          isInvalid={operationalPeriodStatusInput.trim().length === 0}
                        >
                          <option value="Planned">Planned</option>
                          <option value="Active">Active</option>
                        </Form.Select>
                      </Col>
                      <Col md={4}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Planning Meeting (optional)" info="Optional planning meeting date/time tied to this period." /></Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={operationalPeriodPlanningMeetingInput}
                          onChange={(event) => setOperationalPeriodPlanningMeetingInput(event.target.value)}
                        />
                      </Col>
                    </Row>

                    <div className="d-flex justify-content-end mb-3">
                      <IconActionButton
                        iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : 'bi bi-calendar-plus'}
                        tooltip={operationalPeriodActionTooltip}
                        ariaLabel="Create operational period"
                        onClick={onCreateOperationalPeriod}
                        variant="outline-primary"
                        className="incident-form-action-btn"
                        disabled={
                          incidentActionLoading
                          || !isAuthenticated
                        }
                      />
                    </div>
                    <div className="small text-muted mb-3">
                      Required: Period #, Start, End, Status. End must be later than Start.
                    </div>
                    {operationalPeriodValidationHint && (
                      <div className="small text-danger mb-3">{operationalPeriodValidationHint}</div>
                    )}

                    {incidentOperationalPeriodsLoading && (
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <Spinner animation="border" size="sm" />
                        <span className="small">Loading operational periods...</span>
                      </div>
                    )}

                    {!incidentOperationalPeriodsLoading && incidentOperationalPeriods.length === 0 && (
                      <div className="text-muted small">No operational periods recorded yet.</div>
                    )}

                    {!incidentOperationalPeriodsLoading && incidentOperationalPeriods.length > 0 && (
                      <IpocDataGrid
                        gridId="incident-operational-periods"
                        rowData={operationalPeriodsGridRows}
                        columnDefs={operationalPeriodsGridColumnDefs}
                        emptyMessage="No operational periods recorded yet."
                        pageSize={25}
                        height={420}
                      />
                    )}
                    {operationalPeriodEditValidationError && (
                      <div className="small text-danger mt-2">{operationalPeriodEditValidationError}</div>
                    )}
                  </Card.Body>
                </Card>

                <Card className="border-light-subtle">
                  <Card.Header className="small fw-semibold">Objectives</Card.Header>
                  <Card.Body>
                    <Row className="g-2 align-items-end mb-3">
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Objective #" info="Required objective sequence number." /> <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          value={objectiveNumberInput}
                          onChange={(event) => setObjectiveNumberInput(event.target.value)}
                          placeholder="1"
                          isInvalid={objectiveNumberInput.trim().length > 0 && !isObjectiveNumberValid}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Period Id (optional)" info="Optional link to an existing operational period." /></Form.Label>
                        <Form.Select
                          value={objectiveOperationalPeriodIdInput}
                          onChange={(event) => setObjectiveOperationalPeriodIdInput(event.target.value)}
                        >
                          <option value="">None</option>
                          {incidentOperationalPeriods.map((period) => (
                            <option key={period.operationalPeriodId} value={period.operationalPeriodId}>
                              #{period.periodNumber} {period.periodName?.trim() ? `— ${period.periodName}` : ''}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Priority" info="Required priority level for objective execution." /> <span className="text-danger">*</span></Form.Label>
                        <Form.Select value={objectivePriorityInput} onChange={(event) => setObjectivePriorityInput(event.target.value)}>
                          <option value="Low">Low</option>
                          <option value="Normal">Normal</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </Form.Select>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Status" info="Required current state of the objective." /> <span className="text-danger">*</span></Form.Label>
                        <Form.Select value={objectiveStatusInput} onChange={(event) => setObjectiveStatusInput(event.target.value)}>
                          <option value="Open">Open</option>
                          <option value="InProgress">InProgress</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </Form.Select>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Owner User Id" info="Optional assigned owner user for objective accountability." /></Form.Label>
                        <Form.Select
                          value={objectiveOwnerUserIdInput}
                          onChange={(event) => setObjectiveOwnerUserIdInput(event.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {taskAssignableUsers.map((user) => (
                            <option key={user.userId} value={user.userId}>{user.displayName}</option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={2}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Due" info="Optional due date/time for objective completion." /></Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={objectiveDueInput}
                          onChange={(event) => setObjectiveDueInput(event.target.value)}
                        />
                      </Col>
                      <Col md={12}>
                        <Form.Label className="small mb-1"><LabelWithInfo text="Objective Text" info="Required objective statement describing intended outcome." /> <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={objectiveTextInput}
                          onChange={(event) => setObjectiveTextInput(event.target.value)}
                          placeholder="Objective statement"
                          isInvalid={!isObjectiveTextValid}
                        />
                      </Col>
                    </Row>

                    {taskAssignableUsersLoading && (
                      <div className="small text-muted mb-2">Loading active users for objective ownership...</div>
                    )}

                    <div className="d-flex justify-content-end mb-3">
                      <IconActionButton
                        iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : 'bi bi-list-check'}
                        tooltip={objectiveActionTooltip}
                        ariaLabel="Create incident objective"
                        onClick={onCreateObjective}
                        variant="outline-primary"
                        className="incident-form-action-btn"
                        disabled={
                          incidentActionLoading
                          || !isAuthenticated
                        }
                      />
                    </div>
                    <div className="small text-muted mb-3">
                      Required: Objective #, Objective Text, Priority, Status.
                    </div>
                    {objectiveValidationHint && (
                      <div className="small text-danger mb-3">{objectiveValidationHint}</div>
                    )}

                    {incidentObjectivesLoading && (
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <Spinner animation="border" size="sm" />
                        <span className="small">Loading objectives...</span>
                      </div>
                    )}

                    {!incidentObjectivesLoading && incidentObjectives.length === 0 && (
                      <div className="text-muted small">No objectives recorded yet.</div>
                    )}

                    {!incidentObjectivesLoading && incidentObjectives.length > 0 && (
                      <IpocDataGrid
                        gridId="incident-objectives"
                        rowData={objectivesGridRows}
                        columnDefs={objectivesGridColumnDefs}
                        emptyMessage="No objectives recorded yet."
                        pageSize={25}
                        height={420}
                      />
                    )}
                    {objectiveEditValidationError && (
                      <div className="small text-danger mt-2">{objectiveEditValidationError}</div>
                    )}
                  </Card.Body>
                </Card>
              </>
            )}

            {/* ── Resources tab ── */}
            {activeTab === 'resources' && (
              <Card className="border-light-subtle mb-3">
                <Card.Header className="small fw-semibold">Incident Resource Requests</Card.Header>
                <Card.Body>
                  {(activeRemediationIntent === 'resource-open-unassigned' || activeRemediationIntent === 'resource-transition-coverage') && (
                    <div className="small text-warning d-flex align-items-center gap-2 mb-2" data-testid="incident-remediation-hint-resources">
                      <span>
                        {activeRemediationIntent === 'resource-open-unassigned'
                          ? 'Remediation focus: resolve open unassigned requests in routing lanes.'
                          : 'Remediation focus: complete requested→approved and approved→fulfillment transitions.'}
                      </span>
                      <IconActionButton
                        iconClassName="bi bi-x-circle"
                        tooltip="Dismiss remediation focus hint"
                        ariaLabel="Dismiss remediation focus hint"
                        onClick={clearRemediationIntent}
                        variant="outline-secondary"
                        size="sm"
                        testId="incident-remediation-dismiss-resources"
                      />
                    </div>
                  )}
                  <Row className="g-2 align-items-end mb-3">
                    <Col md={2}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Type Code" info="Resource classification code requested for the incident." /></Form.Label>
                      <Form.Control value={resourceTypeCodeInput} onChange={(event) => setResourceTypeCodeInput(event.target.value)} placeholder="Auto-generated if blank" />
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Type Name" info="Human-readable name for the requested resource type." tip="Use the dropdown options for existing lookup values, or type a custom value to add it when you save." /></Form.Label>
                      <div className="position-relative" ref={resourceTypeDropdownContainerRef}>
                        <div className="input-group">
                          <Form.Control
                            value={resourceTypeNameInput}
                            onFocus={() => setResourceTypeDropdownOpen(true)}
                            onChange={(event) => {
                              setResourceTypeNameInput(event.target.value);
                              setResourceTypeDropdownOpen(true);
                            }}
                            onKeyDown={handleResourceTypeInputKeyDown}
                            placeholder="Select or type resource type"
                            autoComplete="off"
                            aria-expanded={resourceTypeDropdownOpen}
                            aria-controls="resource-type-dropdown-options"
                          />
                          <IconActionButton
                            iconClassName="bi bi-caret-down-fill"
                            tooltip={resourceTypeDropdownOpen ? 'Hide existing resource type options' : 'Show existing resource type options'}
                            ariaLabel={resourceTypeDropdownOpen ? 'Hide existing resource type options' : 'Show existing resource type options'}
                            onClick={() => setResourceTypeDropdownOpen((current) => !current)}
                            variant="outline-secondary"
                          />
                        </div>
                        {resourceTypeDropdownOpen && (
                          <div id="resource-type-dropdown-options" className="position-absolute start-0 end-0 mt-1 border rounded bg-body shadow-sm z-3" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                            {canCreateResourceTypeOption && (
                              <div className="dropdown-item ipoc-combobox-create-option d-flex align-items-center justify-content-between">
                                <span>Create new: {resourceTypeNameInput.trim()}</span>
                                <IconActionButton
                                  iconClassName="bi bi-plus-circle"
                                  tooltip="Create new resource type option"
                                  ariaLabel="Create new resource type option"
                                  onClick={handleUseNewResourceTypeOption}
                                  variant="outline-primary"
                                  size="sm"
                                />
                              </div>
                            )}
                            {suggestedResourceTypeOptions.length > 0 ? (
                              suggestedResourceTypeOptions.map((item, index) => (
                                <div
                                  key={`resource-type-existing-${item.codeValueId}`}
                                  className={`dropdown-item d-flex align-items-center justify-content-between${resourceTypeHighlightedIndex === index ? ' active' : ''}`}
                                  ref={(element) => {
                                    resourceTypeDropdownItemRefs.current[index] = element;
                                  }}
                                >
                                  <span>{item.displayName}</span>
                                  <IconActionButton
                                    iconClassName="bi bi-check2"
                                    tooltip={`Select existing resource type ${item.displayName}`}
                                    ariaLabel={`Select existing resource type ${item.displayName}`}
                                    onClick={() => handleSelectExistingResourceType(String(item.codeValueId))}
                                    variant="outline-secondary"
                                    size="sm"
                                  />
                                </div>
                              ))
                            ) : (
                              <div className="small text-muted px-3 py-2">No existing matches.</div>
                            )}
                          </div>
                        )}
                      </div>
                      {resourceTypeSearchLoading && (
                        <div className="small text-muted mt-1 d-flex align-items-center gap-1">
                          <Spinner animation="border" size="sm" />
                          <span>Searching existing values…</span>
                        </div>
                      )}
                      {!resourceTypeSearchLoading && resourceTypeNameInput.trim().length >= 2 && suggestedResourceTypeOptions.length === 0 && (
                        <div className="small text-muted mt-1">
                          No close matches found. This value will be added to lookup when saved.
                        </div>
                      )}
                    </Col>
                    <Col md={2}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Requested Qty" info="Requested quantity needed for operations." /></Form.Label>
                      <Form.Control value={resourceRequestedQuantityInput} onChange={(event) => setResourceRequestedQuantityInput(event.target.value)} />
                    </Col>
                    <Col md={2}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Assigned Qty" info="Optional quantity currently assigned toward the request." /></Form.Label>
                      <Form.Control value={resourceAssignedQuantityInput} onChange={(event) => setResourceAssignedQuantityInput(event.target.value)} placeholder="optional" />
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="UOM" info="Unit of measure used for requested and assigned quantities." /></Form.Label>
                      <Form.Control value={resourceUnitOfMeasureCodeInput} onChange={(event) => setResourceUnitOfMeasureCodeInput(event.target.value)} />
                    </Col>
                    <Col md={2}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Priority" info="Priority level for fulfilling this resource request." /></Form.Label>
                      <Form.Select value={resourcePriorityCodeInput} onChange={(event) => setResourcePriorityCodeInput(event.target.value)}>
                        <option value="Low">Low</option>
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </Form.Select>
                    </Col>
                    <Col md={2}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Status" info="Current processing state of the resource request." /></Form.Label>
                      <Form.Select value={resourceStatusCodeInput} onChange={(event) => setResourceStatusCodeInput(event.target.value)}>
                        {allowedResourceStatusOptions.map((statusOption) => (
                          <option key={`resource-status-option-${statusOption}`} value={statusOption}>
                            {statusOption === 'PartiallyFulfilled' ? 'Partially Fulfilled' : statusOption}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={8}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Notes" info="Optional additional context for fulfillment teams." /></Form.Label>
                      <Form.Control value={resourceNotesInput} onChange={(event) => setResourceNotesInput(event.target.value)} placeholder="Optional request context" />
                    </Col>
                    <Col md={12} className="d-flex gap-2 justify-content-end">
                      <IconActionButton
                        iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : (editingResourceRequestId ? 'bi bi-floppy' : 'bi bi-plus-square')}
                        tooltip={editingResourceRequestId ? 'Save resource request changes' : 'Add resource request'}
                        ariaLabel={editingResourceRequestId ? 'Save resource request changes' : 'Add resource request'}
                        onClick={handleSaveResourceRequest}
                        variant="outline-primary"
                        disabled={
                          !isAuthenticated
                          || incidentActionLoading
                          || resourceTypeNameInput.trim().length === 0
                          || isRequestedQuantityInvalid
                          || isAssignedQuantityInvalid
                        }
                      />
                      {editingResourceRequestId && (
                        <IconActionButton
                          iconClassName="bi bi-x-circle"
                          tooltip="Cancel resource request editing"
                          ariaLabel="Cancel resource request editing"
                          onClick={resetResourceRequestForm}
                          variant="outline-secondary"
                        />
                      )}
                    </Col>
                  </Row>

                  <Row className="g-2 align-items-end mb-3">
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Status filter" info="Filter visible resource requests by status." /></Form.Label>
                      <Form.Select value={resourceStatusFilter} onChange={(event) => setResourceStatusFilter(event.target.value)}>
                        {resourceStatusFilterOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Queue view" info="Focus resource queue on open routing requests requiring action." /></Form.Label>
                      <Form.Check
                        type="switch"
                        id="resource-queue-focus-toggle"
                        label="Open routing requests only"
                        checked={resourceQueueFocusOnly}
                        onChange={(event) => setResourceQueueFocusOnly(event.target.checked)}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Queue sort" info="Control queue ordering for triage, including largest assignment gaps first." /></Form.Label>
                      <Form.Select value={resourceQueueSortModeInput} onChange={(event) => setResourceQueueSortModeInput(event.target.value)}>
                        <option value="StatusPriorityAge">Status, Priority, Age</option>
                        <option value="LargestGap">Largest Gap First</option>
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Gap triage preset" info="Quickly focus open routing requests and sort by largest assignment gap." /></Form.Label>
                      <Form.Check
                        type="switch"
                        id="resource-gap-triage-preset-toggle"
                        label="Open + largest gap"
                        checked={isGapTriagePresetActive}
                        onChange={(event) => handleToggleGapTriagePreset(event.target.checked)}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Bulk transition" info="Apply one status transition to all selected visible requests." /></Form.Label>
                      <div className="d-flex gap-2">
                        <Form.Select value={resourceBulkStatusCodeInput} onChange={(event) => setResourceBulkStatusCodeInput(event.target.value)}>
                          <option value="Approved">Approved</option>
                          <option value="PartiallyFulfilled">Partially Fulfilled</option>
                          <option value="Fulfilled">Fulfilled</option>
                          <option value="Denied">Denied</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Archived">Archived</option>
                        </Form.Select>
                        <IconActionButton
                          iconClassName="bi bi-check2-circle"
                          tooltip="Apply selected bulk transition"
                          ariaLabel="Apply selected bulk transition"
                          onClick={handleApplyBulkResourceStatusTransition}
                          variant="outline-primary"
                          disabled={resourceRequestsLoading || selectedResourceRequestIds.length === 0}
                        />
                      </div>
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Bulk assignment" info="Apply assignment mode to selected open routing requests." /></Form.Label>
                      <div className="d-flex gap-2">
                        <Form.Select value={resourceBulkAssignmentModeInput} onChange={(event) => setResourceBulkAssignmentModeInput(event.target.value)}>
                          <option value="AssignFull">Assign Full</option>
                          <option value="Clear">Clear Assignment</option>
                        </Form.Select>
                        <IconActionButton
                          iconClassName="bi bi-sliders2"
                          tooltip="Apply bulk assignment mode"
                          ariaLabel="Apply bulk assignment mode"
                          onClick={handleApplyBulkResourceAssignmentUpdate}
                          variant="outline-secondary"
                          disabled={resourceRequestsLoading || selectedResourceRequestIds.length === 0}
                        />
                      </div>
                    </Col>
                    <Col md="auto">
                      <IconActionButton
                        iconClassName="bi bi-arrow-repeat"
                        tooltip="Refresh resource lifecycle evidence package preview"
                        ariaLabel="Refresh resource lifecycle evidence package preview"
                        onClick={handleRefreshResourceLifecycleEvidencePackage}
                        variant="outline-secondary"
                        disabled={!selectedIncidentId || resourceLifecycleEvidenceLoading}
                      />
                      <IconActionButton
                        iconClassName="bi bi-download"
                        tooltip="Export filtered resource requests to CSV"
                        ariaLabel="Export resource requests CSV"
                        onClick={() => downloadCsv('incident-resource-requests.csv', resourceRequestsCsv)}
                        variant="outline-secondary"
                        disabled={filteredResourceRequests.length === 0}
                      />
                      <IconActionButton
                        iconClassName="bi bi-file-earmark-medical"
                        tooltip="Export resource evidence CSV"
                        ariaLabel="Export resource evidence CSV"
                        onClick={handleExportResourceEvidenceCsv}
                        variant="outline-secondary"
                        disabled={!resourceLifecycleSummary && filteredResourceRequests.length === 0}
                      />
                      <IconActionButton
                        iconClassName="bi bi-file-earmark-check"
                        tooltip="Export resource lifecycle evidence JSON"
                        ariaLabel="Export resource lifecycle evidence JSON"
                        onClick={handleExportResourceLifecycleEvidenceJson}
                        variant="outline-secondary"
                        disabled={!resourceLifecycleSummary && filteredResourceRequests.length === 0}
                      />
                      <IconActionButton
                        iconClassName="bi bi-globe2"
                        tooltip="Export statewide/regional rollup CSV"
                        ariaLabel="Export statewide/regional rollup CSV"
                        onClick={handleExportRegionalRollupsCsv}
                        variant="outline-secondary"
                        disabled={resourceRollupLoading || regionResourceRollups.length === 0}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Rollup Region" info="Filter regional rollup posture and export by selected region." /></Form.Label>
                      <Form.Select value={resourceRollupRegionFilter} onChange={(event) => {
                        setResourceRollupRegionFilter(event.target.value);
                        setResourceRollupRegionIdFilter('');
                      }}>
                        {availableRollupRegions.map((regionName) => (
                          <option key={`resource-rollup-region-${regionName}`} value={regionName}>{regionName}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Rollup Region ID" info="Use a deterministic region identifier filter for rollup retrieval/export." /></Form.Label>
                      <Form.Select value={resourceRollupRegionIdFilter} onChange={(event) => {
                        setResourceRollupRegionIdFilter(event.target.value);
                        if (event.target.value.length > 0) {
                          setResourceRollupRegionFilter('All');
                        }
                      }}>
                        <option value="">All region IDs</option>
                        {availableRollupRegionIds.map((region) => (
                          <option key={`resource-rollup-region-id-${region.regionId}`} value={region.regionId}>{region.regionName} ({region.regionId})</option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>

                  <div className="small text-muted mb-2">
                    Queue: Open {resourceQueueSummary.open}; High/Critical Open {resourceQueueSummary.highPriorityOpen}; Blocked {resourceQueueSummary.blocked}; Completed {resourceQueueSummary.completed}
                  </div>

                  <div className="small text-muted mb-2">
                    Open Assignment: Requested {resourceQueueSummary.totalRequestedOpen}; Assigned {resourceQueueSummary.totalAssignedOpen}; Gap {resourceQueueSummary.totalGapOpen}
                  </div>

                  <div className="small text-muted mb-2">
                    Routing Lanes: Requested {resourceRoutingLaneSummary.requested}; Approved {resourceRoutingLaneSummary.approved}; Partially Fulfilled {resourceRoutingLaneSummary.partiallyFulfilled}
                  </div>

                  <div className="small text-muted mb-2">
                    Bulk Selection: {selectedResourceRequestIds.length} selected
                  </div>

                  <div className="small text-muted mb-2">
                    Lane Selection: {resourceQueueSections.map((section) => {
                      const laneSummary = resourceLaneSelectionSummary.get(section.statusCode);
                      if (!laneSummary) {
                        return `${section.label} 0/0`;
                      }

                      return `${section.label} ${laneSummary.selected}/${laneSummary.total}`;
                    }).join('; ')}
                  </div>

                  <div className="small text-muted mb-2">
                    {resourceLifecycleSummaryLoading && 'Loading resource lifecycle summary...'}
                    {!resourceLifecycleSummaryLoading && resourceLifecycleSummaryError && resourceLifecycleSummaryError}
                    {!resourceLifecycleSummaryLoading && !resourceLifecycleSummaryError && resourceLifecycleSummary && (
                      `Lifecycle: Total ${resourceLifecycleSummary.totalRequests}; Requested ${resourceLifecycleSummary.requestedRequests}; Approved ${resourceLifecycleSummary.approvedRequests}; Partial ${resourceLifecycleSummary.partiallyFulfilledRequests}; Fulfilled ${resourceLifecycleSummary.fulfilledRequests}; Open Unassigned ${resourceLifecycleSummary.openUnassignedRequests}; Qty Requested ${resourceLifecycleSummary.totalRequestedQuantity}; Qty Assigned ${resourceLifecycleSummary.totalAssignedQuantity}`
                    )}
                  </div>

                  <div className="small text-muted mb-2">
                    {resourceLifecycleEvidenceLoading && 'Loading resource lifecycle evidence package preview...'}
                    {!resourceLifecycleEvidenceLoading && resourceLifecycleEvidenceError && resourceLifecycleEvidenceError}
                    {!resourceLifecycleEvidenceLoading && !resourceLifecycleEvidenceError && resourceLifecycleEvidencePackage && (
                      `Evidence Preview: Checklist ${resourceLifecycleEvidencePackage.acceptanceChecklist.filter((item) => item.status === 'Pass').length}/${resourceLifecycleEvidencePackage.acceptanceChecklist.length} pass; Blockers ${resourceLifecycleEvidencePackage.blockedReasons.length}; Requested→Approved ${resourceLifecycleEvidencePackage.transitionCoverage.requestedToApproved ? 'Yes' : 'No'}; Approved→Fulfillment ${resourceLifecycleEvidencePackage.transitionCoverage.approvedToFulfillment ? 'Yes' : 'No'}`
                    )}
                  </div>
                  {!resourceLifecycleEvidenceLoading && !resourceLifecycleEvidenceError && resourceLifecycleEvidencePackage && resourceLifecycleEvidencePackage.blockedReasons.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {resourceLifecycleEvidencePackage.lifecycleSummary.openUnassignedRequests > 0 && (
                        <IconActionButton
                          iconClassName="bi bi-sign-turn-right"
                          tooltip="Open resource routing lanes to resolve open unassigned requests"
                          ariaLabel="Open resource routing lanes"
                          onClick={() => jumpToResourceRouting('resource-open-unassigned')}
                          variant="outline-warning"
                          testId="incident-remediation-action-resource-open-unassigned"
                        />
                      )}
                      {(!resourceLifecycleEvidencePackage.transitionCoverage.requestedToApproved || !resourceLifecycleEvidencePackage.transitionCoverage.approvedToFulfillment) && (
                        <IconActionButton
                          iconClassName="bi bi-diagram-3"
                          tooltip="Open resource routing lanes to complete required lifecycle transitions"
                          ariaLabel="Open resource transition lanes"
                          onClick={() => jumpToResourceRouting('resource-transition-coverage')}
                          variant="outline-warning"
                          testId="incident-remediation-action-resource-transition-coverage"
                        />
                      )}
                    </div>
                  )}

                  <div className="small text-muted mb-2" data-testid="resource-rollup-summary">
                    {resourceRollupLoading && 'Loading statewide/regional rollups...'}
                    {!resourceRollupLoading && resourceRollupError && resourceRollupError}
                    {!resourceRollupLoading && !resourceRollupError && (
                      `Statewide Rollup: Res Available ${statewideResourceRollup.resourceAvailable}; Res Committed ${statewideResourceRollup.resourceCommitted}; Res OOS ${statewideResourceRollup.resourceOutOfService}; Beds Available ${statewideResourceRollup.bedsAvailable}; Beds Occupied ${statewideResourceRollup.bedsOccupied}; Beds Unavailable ${statewideResourceRollup.bedsUnavailable}`
                    )}
                  </div>

                  {!resourceRollupLoading && !resourceRollupError && regionResourceRollups.length > 0 && (
                    <div className="mb-3">
                      <IpocDataGrid
                        gridId="incident-resource-region-rollups"
                        rowData={regionResourceRollupGridRows}
                        columnDefs={regionResourceRollupColumnDefs}
                        emptyMessage="No regional rollup rows available."
                        pageSize={10}
                      />
                    </div>
                  )}

                  {resourceRequestsLoading && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <Spinner animation="border" size="sm" />
                      <span className="small">Loading incident resource requests...</span>
                    </div>
                  )}

                  {!resourceRequestsLoading && resourceRequestsLoadError && (
                    <div className="small text-danger mb-2 d-flex align-items-center gap-2">
                      <span>{resourceRequestsLoadError}</span>
                      <IconActionButton
                        iconClassName="bi bi-arrow-clockwise"
                        tooltip="Retry loading resource requests"
                        ariaLabel="Retry loading resource requests"
                        onClick={() => {
                          setResourceRequestsLoadAttempted(false);
                          setResourceRequestsLoadError(null);
                        }}
                        variant="outline-secondary"
                      />
                    </div>
                  )}

                  {!resourceRequestsLoading && !resourceRequestsLoadError && prioritizedResourceRequests.length === 0 && (
                    <div className="text-muted small">No resource requests logged yet.</div>
                  )}

                  {!resourceRequestsLoading && prioritizedResourceRequests.length > 0 && (
                    <>
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <Form.Check
                          type="checkbox"
                          id="resource-select-all-visible"
                          checked={isAllVisibleResourceRequestsSelected}
                          onChange={(event) => handleToggleSelectAllVisibleResources(event.target.checked)}
                          aria-label="Select all visible resource requests"
                          label="Select all visible"
                        />
                        {resourceQueueSections.map((section) => (
                          <div key={`resource-lane-actions-${section.statusCode}`} className="d-inline-flex align-items-center gap-1">
                            <span className="small text-muted">{section.label} ({section.items.length})</span>
                            <IconActionButton
                              iconClassName="bi bi-check-square"
                              tooltip={`Select or clear all ${section.label} lane requests`}
                              ariaLabel={`Select or clear all ${section.label} lane requests`}
                              onClick={() => handleSelectResourceLane(section.statusCode)}
                              variant="outline-secondary"
                              className="incident-form-action-btn"
                              disabled={resourceRequestsLoading}
                            />
                            <IconActionButton
                              iconClassName="bi bi-arrow-right-circle"
                              tooltip={`Apply current bulk transition to ${section.label} lane`}
                              ariaLabel={`Apply current bulk transition to ${section.label} lane`}
                              onClick={() => handleApplyBulkResourceStatusTransitionForLane(section.statusCode)}
                              variant="outline-primary"
                              className="incident-form-action-btn"
                              disabled={resourceRequestsLoading || section.items.length === 0}
                            />
                            <IconActionButton
                              iconClassName="bi bi-sliders2-vertical"
                              tooltip={`Apply current bulk assignment mode to ${section.label} lane`}
                              ariaLabel={`Apply current bulk assignment mode to ${section.label} lane`}
                              onClick={() => handleApplyBulkResourceAssignmentUpdateForLane(section.statusCode)}
                              variant="outline-secondary"
                              className="incident-form-action-btn"
                              disabled={resourceRequestsLoading || section.items.length === 0}
                            />
                          </div>
                        ))}
                      </div>

                      <IpocDataGrid
                        gridId="incident-resource-request-queue"
                        rowData={prioritizedResourceRequestsGridRows}
                        columnDefs={prioritizedResourceRequestsGridColumnDefs}
                        emptyMessage="No resource requests logged yet."
                        pageSize={25}
                        height={520}
                      />
                    </>
                  )}
                </Card.Body>
              </Card>
            )}

            {/* ── Communications tab ── */}
            {activeTab === 'communications' && (
              <Card className="border-light-subtle">
                <Card.Header className="small fw-semibold">Incident Communications Log</Card.Header>
                <Card.Body>
                  <Row className="g-2 align-items-end mb-3">
                    <Col md={2}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Channel" info="Communication channel used for this entry." /></Form.Label>
                      <Form.Select value={communicationChannelCode} onChange={(event) => setCommunicationChannelCode(event.target.value)}>
                        <option value="Phone">Phone</option>
                        <option value="Radio">Radio</option>
                        <option value="Email">Email</option>
                        <option value="WebEoc">WebEoc</option>
                        <option value="InPerson">In Person</option>
                        <option value="Other">Other</option>
                      </Form.Select>
                    </Col>
                    <Col md={2}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Direction" info="Direction of communication relative to the incident team." /></Form.Label>
                      <Form.Select value={communicationDirectionCode} onChange={(event) => setCommunicationDirectionCode(event.target.value)}>
                        <option value="Inbound">Inbound</option>
                        <option value="Outbound">Outbound</option>
                        <option value="Internal">Internal</option>
                      </Form.Select>
                    </Col>
                    <Col md={4}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Subject" info="Short subject line for this communication log entry." /></Form.Label>
                      <Form.Control
                        value={communicationSubject}
                        onChange={(event) => setCommunicationSubject(event.target.value)}
                        placeholder="Communication subject"
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Label className="small mb-1"><LabelWithInfo text="Message" info="Communication details captured for incident records." /></Form.Label>
                      <Form.Control
                        value={communicationMessage}
                        onChange={(event) => setCommunicationMessage(event.target.value)}
                        placeholder="Communication details"
                      />
                    </Col>
                    <Col md={12} className="d-flex gap-2 justify-content-end">
                      <Form.Check
                        type="switch"
                        id="incident-communications-notify-toggle"
                        label="Dispatch notification"
                        checked={communicationNotifyEnabled}
                        onChange={(event) => setCommunicationNotifyEnabled(event.target.checked)}
                        className="me-auto"
                      />
                      <IconActionButton
                        iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : (editingCommunicationId ? 'bi bi-floppy' : 'bi bi-broadcast-pin')}
                        tooltip={communicationActionTooltip}
                        ariaLabel={communicationActionTooltip}
                        onClick={handleSaveCommunication}
                        variant="outline-primary"
                        disabled={!isAuthenticated || incidentActionLoading || communicationSubject.trim().length === 0 || communicationMessage.trim().length === 0 || !isNotificationDispatchInputValid}
                      />
                      {editingCommunicationId && (
                        <IconActionButton
                          iconClassName="bi bi-x-circle"
                          tooltip="Cancel communication editing"
                          ariaLabel="Cancel communication editing"
                          onClick={resetCommunicationForm}
                          variant="outline-secondary"
                        />
                      )}
                    </Col>
                  </Row>

                  {communicationNotifyEnabled && (
                    <>
                      <Row className="g-2 align-items-end mb-3">
                        <Col md={3}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Notification Type" info="Type code used for outbound communication notifications." /></Form.Label>
                          <Form.Control value={notificationTypeCodeInput} onChange={(event) => setNotificationTypeCodeInput(event.target.value)} placeholder="INCIDENT_NOTIFICATION" />
                        </Col>
                        <Col md={2}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Priority" info="Priority for outbound communication dispatch." /></Form.Label>
                          <Form.Select value={notificationPriorityCodeInput} onChange={(event) => setNotificationPriorityCodeInput(event.target.value as 'Low' | 'Normal' | 'High' | 'Critical')}>
                            <option value="Low">Low</option>
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </Form.Select>
                        </Col>
                        <Col md={2}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Notify Channel" info="Dispatch channel for notification recipient." /></Form.Label>
                          <Form.Select value={notificationChannelCodeInput} onChange={(event) => setNotificationChannelCodeInput(event.target.value as 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH')}>
                            <option value="EMAIL">EMAIL</option>
                            <option value="SMS">SMS</option>
                            <option value="VOICE">VOICE</option>
                            <option value="PUSH">PUSH</option>
                          </Form.Select>
                        </Col>
                        <Col md={5}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Destination Address" info="Destination by selected channel: EMAIL uses email address, SMS/VOICE use phone number, and PUSH uses token or HTTPS endpoint." /></Form.Label>
                          <Form.Control value={notificationDestinationAddressInput} onChange={(event) => setNotificationDestinationAddressInput(event.target.value)} placeholder={notificationDestinationPlaceholder} />
                        </Col>
                      </Row>

                      <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
                        <div className="small text-muted">
                          Staged recipients: {notificationRecipientsDraft.length}
                          {isNotificationDraftRecipientValid ? ' (+1 draft ready)' : ''}
                        </div>
                        <IconActionButton
                          iconClassName="bi bi-person-plus"
                          tooltip="Stage recipient"
                          ariaLabel="Stage notification recipient"
                          onClick={handleAddNotificationRecipient}
                          variant="outline-secondary"
                          disabled={!isNotificationDraftRecipientValid}
                        />
                      </div>

                      {notificationRecipientsDraft.length > 0 && (
                        <div className="mb-2">
                          <IpocDataGrid
                            gridId="incident-communications-draft-recipients"
                            rowData={notificationRecipientsDraftGridRows}
                            columnDefs={notificationRecipientsDraftGridColumnDefs}
                            emptyMessage="No staged recipients."
                            pageSize={10}
                          />
                        </div>
                      )}

                      <Row className="g-2 align-items-end mb-3">
                        <Col md={4}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Recipient User" info="Optional recipient user loaded from active users in the database." /></Form.Label>
                          <Form.Select value={notificationRecipientUserIdInput} onChange={(event) => setNotificationRecipientUserIdInput(event.target.value)}>
                            <option value="">Select user (optional)</option>
                            {taskAssignableUsers.length === 0 && (
                              <option value="" disabled>No active users available</option>
                            )}
                            {taskAssignableUsers.map((user) => (
                              <option key={user.userId} value={String(user.userId)}>
                                {user.displayName}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={4}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Recipient Contact" info="Optional recipient contact loaded from active contacts in the database." /></Form.Label>
                          <Form.Select value={notificationRecipientContactIdInput} onChange={(event) => setNotificationRecipientContactIdInput(event.target.value)}>
                            <option value="">Select contact (optional)</option>
                            {activeContacts.length === 0 && (
                              <option value="" disabled>No active contacts available</option>
                            )}
                            {activeContacts.map((contact) => (
                              <option key={contact.contactId} value={String(contact.contactId)}>
                                {contact.displayName}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={4}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Recipient Location" info="Optional recipient location loaded from active locations in the database." /></Form.Label>
                          <Form.Select value={notificationRecipientLocationIdInput} onChange={(event) => setNotificationRecipientLocationIdInput(event.target.value)}>
                            <option value="">Select location (optional)</option>
                            {locationLookups.length === 0 && (
                              <option value="" disabled>No active locations available</option>
                            )}
                            {locationLookups.map((location) => (
                              <option key={location.locationId} value={String(location.locationId)}>
                                {location.displayText}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                      </Row>

                      <Row className="g-2 align-items-end mb-3">
                        <Col md={10}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Geo Broadcast Locations" info="Select one or more locations to stage geo-targeted broadcast recipients for the current channel and destination." /></Form.Label>
                          <Form.Select
                            multiple
                            value={notificationBroadcastLocationIdsInput}
                            onChange={(event) => {
                              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                              setNotificationBroadcastLocationIdsInput(selected);
                            }}
                          >
                            {locationLookups.length === 0 && (
                              <option value="" disabled>No active locations available</option>
                            )}
                            {locationLookups.map((location) => (
                              <option key={`broadcast-location-${location.locationId}`} value={String(location.locationId)}>
                                {location.displayText}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={2} className="d-flex justify-content-end">
                          <IconActionButton
                            iconClassName="bi bi-broadcast-pin"
                            tooltip="Stage geo-targeted recipients"
                            ariaLabel="Stage geo-targeted recipients"
                            onClick={handleStageGeoBroadcastRecipients}
                            variant="outline-secondary"
                            disabled={notificationBroadcastLocationIdsInput.length === 0 || notificationDestinationAddressInput.trim().length === 0}
                          />
                        </Col>
                      </Row>

                      {!isNotificationDispatchInputValid && (
                        <div className="small text-secondary mb-2">
                          Provide Notification Type and at least one recipient with destination and principal (User, Contact, or Location) before saving.
                        </div>
                      )}
                    </>
                  )}

                  {communicationsLoading && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <Spinner animation="border" size="sm" />
                      <span className="small">Loading communications...</span>
                    </div>
                  )}

                  {!communicationsLoading && communicationsLoadError && (
                    <div className="small text-danger mb-2 d-flex align-items-center gap-2">
                      <span>{communicationsLoadError}</span>
                      <IconActionButton
                        iconClassName="bi bi-arrow-clockwise"
                        tooltip="Retry loading communications"
                        ariaLabel="Retry loading communications"
                        onClick={() => {
                          setCommunicationsLoadAttempted(false);
                          setCommunicationsLoadError(null);
                        }}
                        variant="outline-secondary"
                      />
                    </div>
                  )}

                  {!communicationsLoading && !communicationsLoadError && communications.length === 0 && (
                    <div className="text-muted small">No communications logged yet.</div>
                  )}

                  {!communicationsLoading && communications.length > 0 && (
                    <>
                      <Row className="g-2 align-items-end mb-3">
                        <Col md={3}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Status filter" info="Filter communication rows by lifecycle status." /></Form.Label>
                          <Form.Select value={communicationStatusFilter} onChange={(event) => setCommunicationStatusFilter(event.target.value)}>
                            {communicationStatusFilterOptions.map((status) => (
                              <option key={`communication-status-filter-${status}`} value={status}>{status}</option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={3}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Channel filter" info="Filter communication rows by communication channel." /></Form.Label>
                          <Form.Select value={communicationChannelFilter} onChange={(event) => setCommunicationChannelFilter(event.target.value)}>
                            {communicationChannelFilterOptions.map((channel) => (
                              <option key={`communication-channel-filter-${channel}`} value={channel}>{channel}</option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={3}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Logged from" info="Show communications logged on or after this date." /></Form.Label>
                          <Form.Control type="date" value={communicationDateFromFilter} onChange={(event) => setCommunicationDateFromFilter(event.target.value)} />
                        </Col>
                        <Col md={3}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Logged to" info="Show communications logged on or before this date." /></Form.Label>
                          <Form.Control type="date" value={communicationDateToFilter} onChange={(event) => setCommunicationDateToFilter(event.target.value)} />
                        </Col>
                      </Row>
                      <div className="small text-muted mb-2">
                        Showing {filteredCommunications.length} of {communications.length} communications.
                      </div>
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                        <div className="small text-muted">
                          {communicationLifecycleSummaryLoading && 'Loading lifecycle summary...'}
                          {!communicationLifecycleSummaryLoading && communicationLifecycleSummaryError && communicationLifecycleSummaryError}
                          {!communicationLifecycleSummaryLoading && !communicationLifecycleSummaryError && communicationLifecycleSummary && (
                            `Lifecycle (range): Comms ${communicationLifecycleSummary.totalCommunications}; With Notify ${communicationLifecycleSummary.communicationsWithNotifications}; Notifications ${communicationLifecycleSummary.totalNotifications}; Recipients ${communicationLifecycleSummary.totalRecipients}; Sent ${communicationLifecycleSummary.sentRecipients}; Failed ${communicationLifecycleSummary.failedRecipients}; Ack ${communicationLifecycleSummary.acknowledgedRecipients}`
                          )}
                        </div>
                        <IconActionButton
                          iconClassName="bi bi-archive-fill"
                          tooltip="Archive all filtered communications"
                          ariaLabel="Archive all filtered communications"
                          onClick={() => handleBulkCommunicationStatusTransition('Archived')}
                          variant="outline-secondary"
                          disabled={communicationsLoading || filteredCommunications.length === 0}
                        />
                        <IconActionButton
                          iconClassName="bi bi-flag-fill"
                          tooltip="Mark all filtered communications as needs follow-up"
                          ariaLabel="Mark all filtered communications as needs follow-up"
                          onClick={() => handleBulkCommunicationStatusTransition('NeedsFollowUp')}
                          variant="outline-warning"
                          disabled={communicationsLoading || filteredCommunications.length === 0}
                        />
                        <IconActionButton
                          iconClassName="bi bi-exclamation-octagon-fill"
                          tooltip="Mark all filtered communications as escalated"
                          ariaLabel="Mark all filtered communications as escalated"
                          onClick={() => handleBulkCommunicationStatusTransition('Escalated')}
                          variant="outline-danger"
                          disabled={communicationsLoading || filteredCommunications.length === 0}
                        />
                        <IconActionButton
                          iconClassName="bi bi-arrow-counterclockwise"
                          tooltip="Reactivate all filtered communications"
                          ariaLabel="Reactivate all filtered communications"
                          onClick={() => handleBulkCommunicationStatusTransition('Active')}
                          variant="outline-secondary"
                          disabled={communicationsLoading || filteredCommunications.length === 0}
                        />
                        <IconActionButton
                          iconClassName="bi bi-file-earmark-spreadsheet"
                          tooltip="Export filtered communications to CSV"
                          ariaLabel="Export filtered communications to CSV"
                          onClick={() => downloadCsv('incident-communications.csv', communicationsCsv)}
                          variant="outline-secondary"
                          disabled={filteredCommunications.length === 0}
                        />
                        <IconActionButton
                          iconClassName="bi bi-file-earmark-medical"
                          tooltip="Export communication delivery evidence CSV"
                          ariaLabel="Export communication delivery evidence CSV"
                          onClick={handleExportCommunicationEvidenceCsv}
                          variant="outline-secondary"
                          disabled={!communicationLifecycleSummary && notificationRecipients.length === 0}
                        />
                      </div>
                      {!communicationLifecycleSummaryLoading && !communicationLifecycleSummaryError && communicationLifecycleSummary && (
                        <div className="d-flex flex-wrap gap-2 small mb-2">
                          {communicationChannelLifecycle.map((channel) => (
                            <Badge
                              key={`communication-channel-success-${channel.code}`}
                              bg={channel.recipients === 0 ? 'secondary' : channel.failed > 0 ? 'danger' : 'success'}
                            >
                              {channel.code}: {channel.sent}/{channel.recipients} sent ({channel.successRateLabel})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {!communicationsLoading && communications.length > 0 && filteredCommunications.length > 0 && (
                    <IpocDataGrid
                      gridId="incident-communications-list"
                      rowData={filteredCommunicationsGridRows}
                      columnDefs={filteredCommunicationsGridColumnDefs}
                      emptyMessage="No communications match the current filters."
                      pageSize={25}
                      height={460}
                    />
                  )}

                  {!communicationsLoading && communications.length > 0 && filteredCommunications.length === 0 && (
                    <div className="small text-muted mb-2">No communications match the current filters.</div>
                  )}

                  {lastDispatchedNotificationId && (
                    <div className="mt-3 border-top pt-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="small fw-semibold">Notification Recipients (Notification #{lastDispatchedNotificationId})</div>
                        <IconActionButton
                          iconClassName={notificationRecipientsLoading ? 'bi bi-arrow-repeat' : 'bi bi-people'}
                          tooltip="Load notification recipients"
                          ariaLabel="Load notification recipients"
                          onClick={() => void handleLoadNotificationRecipients()}
                          variant="outline-secondary"
                          disabled={notificationRecipientsLoading || communicationDispatchLoading}
                        />
                      </div>

                      {notificationRecipients.length > 0 && (
                        <>
                          <div className="small text-muted mb-2">
                            Lifecycle totals — Total: {notificationLifecycleSummary.total}; Queued: {notificationLifecycleSummary.queued}; Sent: {notificationLifecycleSummary.sent}; Failed: {notificationLifecycleSummary.failed}; Suppressed: {notificationLifecycleSummary.suppressed}; Cancelled: {notificationLifecycleSummary.cancelled}; Acknowledged: {notificationLifecycleSummary.acknowledged}
                          </div>
                        <div className="d-flex flex-wrap justify-content-end gap-2 mb-2">
                          <IconActionButton
                            iconClassName="bi bi-send-check"
                            tooltip="Mark all queued recipients as sent"
                            ariaLabel="Mark all queued recipients as sent"
                            onClick={() => handleBulkNotificationRecipientStatusUpdate('Sent')}
                            variant="outline-primary"
                            disabled={notificationRecipientsLoading || notificationLifecycleSummary.queued === 0}
                          />
                          <IconActionButton
                            iconClassName="bi bi-check2-all"
                            tooltip="Acknowledge all unacknowledged recipients"
                            ariaLabel="Acknowledge all unacknowledged recipients"
                            onClick={handleBulkAcknowledgeNotificationRecipients}
                            variant="outline-success"
                            disabled={notificationRecipientsLoading || notificationLifecycleSummary.total === notificationLifecycleSummary.acknowledged}
                          />
                        </div>
                        <div className="mb-3">
                          <IpocDataGrid
                            gridId="incident-communications-notification-recipients"
                            rowData={notificationRecipientsGridRows}
                            columnDefs={notificationRecipientsGridColumnDefs}
                            emptyMessage="No notification recipients loaded."
                            pageSize={25}
                            height={420}
                          />
                        </div>
                        </>
                      )}

                      <Row className="g-2 align-items-end">
                        <Col md={4}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Escalation Channel" info="Channel used when escalating this notification." /></Form.Label>
                          <Form.Select value={escalationChannelCodeInput} onChange={(event) => setEscalationChannelCodeInput(event.target.value as 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH')}>
                            <option value="EMAIL">EMAIL</option>
                            <option value="SMS">SMS</option>
                            <option value="VOICE">VOICE</option>
                            <option value="PUSH">PUSH</option>
                          </Form.Select>
                        </Col>
                        <Col md={4}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Escalation Destination" info="Destination address for escalated notification." /></Form.Label>
                          <Form.Control value={escalationDestinationAddressInput} onChange={(event) => setEscalationDestinationAddressInput(event.target.value)} placeholder={escalationDestinationPlaceholder} />
                        </Col>
                        <Col md={4}>
                          <Form.Label className="small mb-1"><LabelWithInfo text="Escalation Reason" info="Reason captured in escalation evidence record." /></Form.Label>
                          <Form.Control value={escalationReasonInput} onChange={(event) => setEscalationReasonInput(event.target.value)} placeholder="Escalation reason" />
                        </Col>
                      </Row>
                      <div className="d-flex justify-content-end gap-2 mt-2">
                        <IconActionButton
                          iconClassName="bi bi-broadcast"
                          tooltip="SOS escalation using VOICE channel"
                          ariaLabel="SOS escalation using VOICE channel"
                          onClick={() => handleSosEscalation('VOICE')}
                          variant="outline-warning"
                          disabled={communicationEscalationLoading || notificationRecipientsLoading || !lastDispatchedNotificationId || escalationDestinationAddressInput.trim().length === 0}
                        />
                        <IconActionButton
                          iconClassName="bi bi-bell"
                          tooltip="SOS escalation using PUSH channel"
                          ariaLabel="SOS escalation using PUSH channel"
                          onClick={() => handleSosEscalation('PUSH')}
                          variant="outline-warning"
                          disabled={communicationEscalationLoading || notificationRecipientsLoading || !lastDispatchedNotificationId || escalationDestinationAddressInput.trim().length === 0}
                        />
                        <IconActionButton
                          iconClassName="bi bi-exclamation-triangle"
                          tooltip="Escalate latest notification"
                          ariaLabel="Escalate latest notification"
                          onClick={handleEscalateCommunicationNotification}
                          variant="outline-danger"
                          disabled={communicationEscalationLoading || notificationRecipientsLoading}
                        />
                      </div>
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}

            {/* ── SITREP / IAP tab ── */}
            {activeTab === 'sitrep' && (
              <>
                {activeRemediationIntent === 'iap-build-packet' && (
                  <div className="small text-warning d-flex align-items-center gap-2 mb-2" data-testid="incident-remediation-hint-sitrep">
                    <span>Remediation focus: create SITREP evidence, then refresh governance preview before IAP export.</span>
                    <IconActionButton
                      iconClassName="bi bi-x-circle"
                      tooltip="Dismiss remediation focus hint"
                      ariaLabel="Dismiss remediation focus hint"
                      onClick={clearRemediationIntent}
                      variant="outline-secondary"
                      size="sm"
                      testId="incident-remediation-dismiss-sitrep"
                    />
                  </div>
                )}
                <div className="d-flex gap-2 mb-3">
                  <IconActionButton
                    iconClassName="bi bi-arrow-repeat"
                    tooltip="Refresh IAP governance evidence package preview"
                    ariaLabel="Refresh IAP governance evidence package preview"
                    onClick={handleRefreshIapGovernanceEvidencePackage}
                    variant="outline-secondary"
                    disabled={!selectedIncidentId || iapGovernanceEvidenceLoading}
                  />
                  <IconActionButton
                    iconClassName="bi bi-download"
                    tooltip={iapExportBlockedReason ?? 'Export full IAP packet'}
                    ariaLabel="Export IAP packet"
                    onClick={handleDownloadIapPacket}
                    variant="outline-secondary"
                    disabled={Boolean(iapExportBlockedReason)}
                  />
                  <IconActionButton
                    iconClassName="bi bi-printer"
                    tooltip={iapExportBlockedReason ?? 'Print full IAP packet'}
                    ariaLabel="Print IAP packet"
                    onClick={handlePrintIapPacket}
                    variant="outline-secondary"
                    disabled={Boolean(iapExportBlockedReason)}
                  />
                  <IconActionButton
                    iconClassName="bi bi-shield-check"
                    tooltip="Export IAP governance evidence"
                    ariaLabel="Export IAP governance evidence"
                    onClick={handleDownloadIapGovernanceEvidence}
                    variant="outline-primary"
                  />
                </div>
                {iapExportBlockedReason && (
                  <div className="small text-warning mb-2">{iapExportBlockedReason}</div>
                )}
                <div className="small text-muted mb-2">
                  {iapGovernanceEvidenceLoading && 'Loading IAP governance evidence package preview...'}
                  {!iapGovernanceEvidenceLoading && iapGovernanceEvidenceError && iapGovernanceEvidenceError}
                  {!iapGovernanceEvidenceLoading && !iapGovernanceEvidenceError && iapGovernanceEvidencePackage && (
                    `Governance Preview: Export eligible ${iapGovernanceEvidencePackage.governance.exportEligible ? 'Yes' : 'No'}; Approved periods ${iapGovernanceEvidencePackage.governance.approvedOperationalPeriodCount}; Checklist ${iapGovernanceEvidencePackage.acceptanceChecklist.filter((item) => item.status === 'Pass').length}/${iapGovernanceEvidencePackage.acceptanceChecklist.length} pass; Blockers ${iapGovernanceEvidencePackage.governance.blockedReasons.length}`
                  )}
                </div>
                {!iapGovernanceEvidenceLoading && !iapGovernanceEvidenceError && iapGovernanceEvidencePackage && iapGovernanceEvidencePackage.governance.blockedReasons.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {!iapGovernanceEvidencePackage.governance.hasApprovedOperationalPeriod && (
                      <IconActionButton
                        iconClassName="bi bi-sign-turn-right"
                        tooltip="Open Operational Periods to approve a period for IAP governance compliance"
                        ariaLabel="Open operational periods tab"
                        onClick={jumpToOperationalPeriodGovernance}
                        variant="outline-warning"
                        testId="incident-remediation-action-iap-approve-period"
                      />
                    )}
                    {!iapGovernanceEvidencePackage.governance.hasIapPacketPayload && (
                      <IconActionButton
                        iconClassName="bi bi-journal-plus"
                        tooltip="Open SITREP tab to build baseline evidence for packet generation"
                        ariaLabel="Open SITREP tab for evidence"
                        onClick={jumpToSituationReporting}
                        variant="outline-warning"
                        testId="incident-remediation-action-iap-build-packet"
                      />
                    )}
                  </div>
                )}

                {/* ICS-201 Incident Briefing */}
                <Card className="border-light-subtle mb-3">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-file-earmark-text" aria-hidden="true" />
                    ICS-201 Incident Briefing
                  </Card.Header>
                  <Card.Body>
                    {ics201Loading && (
                      <div className="text-center py-3">
                        <Spinner animation="border" size="sm" className="me-2" />
                        <span className="small text-muted">Loading ICS-201 data...</span>
                      </div>
                    )}

                    {!ics201Loading && ics201LoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2">
                        <span>{ics201LoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading ICS-201 data"
                          ariaLabel="Retry loading ICS-201 data"
                          onClick={() => {
                            setIcs201LoadAttempted(false);
                            setIcs201LoadError(null);
                          }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}

                    {!ics201Loading && ics201Data && (
                      <>
                        <Row className="mb-3">
                          <Col md={6}>
                            <div className="small mb-2">
                              <strong>Incident Name:</strong>{' '}
                              {ics201Data.incidentDetail.incidentName}
                            </div>
                            <div className="small mb-2">
                              <strong>Incident Number:</strong>{' '}
                              {ics201Data.incidentDetail.incidentNumber}
                            </div>
                            <div className="small mb-2">
                              <strong>Incident Type:</strong>{' '}
                              {ics201Data.incidentDetail.incidentTypeCode}
                            </div>
                            <div className="small mb-2">
                              <strong>Severity:</strong>{' '}
                              {ics201Data.incidentDetail.severityCode ? (
                                <Badge bg={severityVariant(ics201Data.incidentDetail.severityCode)}>
                                  {ics201Data.incidentDetail.severityCode}
                                </Badge>
                              ) : (
                                '—'
                              )}
                            </div>
                          </Col>
                          <Col md={6}>
                            <div className="small mb-2">
                              <strong>Status:</strong>{' '}
                              <Badge bg={statusVariant(ics201Data.incidentDetail.incidentStatusCode)}>
                                {ics201Data.incidentDetail.incidentStatusCode}
                              </Badge>
                            </div>
                            <div className="small mb-2">
                              <strong>Current Operational Period:</strong>{' '}
                              {ics201Data.currentPeriod ? (
                                <>
                                  {ics201Data.currentPeriod.periodName}{' '}
                                  <Badge bg={statusVariant(ics201Data.currentPeriod.statusCode)} className="ms-1">
                                    {ics201Data.currentPeriod.statusCode}
                                  </Badge>
                                </>
                              ) : (
                                <span className="text-muted">No active period</span>
                              )}
                            </div>
                            {ics201Data.currentPeriod && (
                              <>
                                <div className="small mb-2">
                                  <strong>Period Start:</strong>{' '}
                                  {new Date(ics201Data.currentPeriod.startUtc).toLocaleString()}
                                </div>
                                <div className="small mb-2">
                                  <strong>Period End:</strong>{' '}
                                  {ics201Data.currentPeriod.endUtc
                                    ? new Date(ics201Data.currentPeriod.endUtc).toLocaleString()
                                    : '—'}
                                </div>
                              </>
                            )}
                          </Col>
                        </Row>

                        <hr className="my-3" />

                        <div className="mb-3">
                          <div className="small fw-semibold mb-2">Situation Summary</div>
                          <div className="small text-muted">
                            {ics201Data.incidentDetail.situationSummary || ics201Data.incidentDetail.initialSummary || 'No summary available.'}
                          </div>
                        </div>

                        <hr className="my-3" />

                        <div className="mb-3">
                          <div className="small fw-semibold mb-2">Active Objectives</div>
                          {ics201Data.activeObjectives.length === 0 ? (
                            <div className="small text-muted">No active objectives.</div>
                          ) : (
                            <ul className="small mb-0">
                              {ics201Data.activeObjectives.map((obj) => (
                                <li key={obj.incidentObjectiveId}>
                                  <strong>#{obj.objectiveNumber}</strong> {obj.objectiveText}{' '}
                                  <Badge bg={statusVariant(obj.statusCode)} className="ms-1">
                                    {obj.statusCode}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <hr className="my-3" />

                        <div className="mb-3">
                          <div className="small fw-semibold mb-2">Command Assignments (ICS Structure)</div>
                          {(ics201Data.commandAssignments.length === 0 && incidentCommandAssignments.length === 0) ? (
                            <div className="small text-muted">No command assignments.</div>
                          ) : (
                            <IpocDataGrid
                              gridId="incident-ics201-command-assignments"
                              rowData={ics201CommandAssignmentsRows}
                              columnDefs={ics201CommandAssignmentsColumnDefs}
                              emptyMessage="No command assignments."
                              pageSize={10}
                            />
                          )}
                        </div>

                        <hr className="my-3" />

                        <div className="mb-2">
                          <div className="small fw-semibold mb-2">Resource Status Summary</div>
                          <div className="small text-muted">
                            {ics201Data.resourceStatusSummary || 'Resource integration pending.'}
                          </div>
                        </div>
                      </>
                    )}
                  </Card.Body>
                </Card>

                <Card className="border-light-subtle mb-3">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-list-task" aria-hidden="true" />
                    ICS-202 Incident Objectives
                  </Card.Header>
                  <Card.Body>
                    {ics202Loading && <div className="small text-muted">Loading ICS-202 data...</div>}
                    {!ics202Loading && ics202LoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2">
                        <span>{ics202LoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading ICS-202 data"
                          ariaLabel="Retry loading ICS-202 data"
                          onClick={() => { setIcs202LoadAttempted(false); setIcs202LoadError(null); }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}
                    {!ics202Loading && ics202Data && (
                      <>
                        <div className="small text-muted mb-2">Generated: {new Date(ics202Data.generatedUtc).toLocaleString()}</div>
                        {ics202Data.objectives.length === 0 ? (
                          <div className="small text-muted">No objectives recorded.</div>
                        ) : (
                          <ul className="small mb-0">
                            {ics202Data.objectives.map((objective) => (
                              <li key={objective.incidentObjectiveId}>
                                <strong>#{objective.objectiveNumber}</strong> {objective.objectiveText}
                                <Badge bg={statusVariant(objective.statusCode)} className="ms-1">{objective.statusCode}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </Card.Body>
                </Card>

                <Card className="border-light-subtle mb-3">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-diagram-3" aria-hidden="true" />
                    ICS-203 Organization Assignment List
                  </Card.Header>
                  <Card.Body>
                    {ics203Loading && <div className="small text-muted">Loading ICS-203 data...</div>}
                    {!ics203Loading && ics203LoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2">
                        <span>{ics203LoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading ICS-203 data"
                          ariaLabel="Retry loading ICS-203 data"
                          onClick={() => { setIcs203LoadAttempted(false); setIcs203LoadError(null); }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}
                    {!ics203Loading && !ics203LoadError && !ics203Data && (
                      <div className="small text-muted">No ICS-203 payload returned yet. Showing live command board assignments.</div>
                    )}
                    {!ics203Loading && ics203Data && (
                      <>
                        <div className="small text-muted mb-2">Generated: {new Date(ics203Data.generatedUtc).toLocaleString()}</div>
                        {ics203Data.assignments.length === 0 ? (
                          <div className="small text-muted">No command assignments recorded.</div>
                        ) : (
                          <IpocDataGrid
                            gridId="incident-ics203-assignments"
                            rowData={ics203AssignmentsRows}
                            columnDefs={ics203AssignmentsColumnDefs}
                            emptyMessage="No command assignments recorded."
                            pageSize={10}
                          />
                        )}
                      </>
                    )}
                    {!ics203Loading && !ics203LoadError && (!ics203Data || ics203Data.assignments.length === 0) && incidentCommandAssignments.length > 0 && (
                      <div className="mt-2">
                        <IpocDataGrid
                          gridId="incident-ics203-live-assignments"
                          rowData={liveCommandAssignmentsRows}
                          columnDefs={liveCommandAssignmentsColumnDefs}
                          emptyMessage="No live command assignments available."
                          pageSize={10}
                        />
                      </div>
                    )}
                  </Card.Body>
                </Card>

                <Card className="border-light-subtle mb-3">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-broadcast" aria-hidden="true" />
                    ICS-205 Communications Plan
                  </Card.Header>
                  <Card.Body>
                    {ics205Loading && <div className="small text-muted">Loading ICS-205 data...</div>}
                    {!ics205Loading && ics205LoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2">
                        <span>{ics205LoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading ICS-205 data"
                          ariaLabel="Retry loading ICS-205 data"
                          onClick={() => { setIcs205LoadAttempted(false); setIcs205LoadError(null); }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}
                    {!ics205Loading && ics205Data && (
                      <>
                        <div className="small text-muted mb-2">Generated: {new Date(ics205Data.generatedUtc).toLocaleString()}</div>
                        {ics205Data.activeCommunications.length === 0 ? (
                          <div className="small text-muted">No active communications logged.</div>
                        ) : (
                          <IpocDataGrid
                            gridId="incident-ics205-communications"
                            rowData={ics205CommunicationsRows}
                            columnDefs={ics205CommunicationsColumnDefs}
                            emptyMessage="No active communications logged."
                            pageSize={10}
                          />
                        )}
                      </>
                    )}
                  </Card.Body>
                </Card>

                <Card className="border-light-subtle mb-3">
                  <Card.Header className="small fw-semibold d-flex align-items-center gap-2">
                    <i className="bi bi-bar-chart" aria-hidden="true" />
                    ICS-209 Incident Status Summary
                  </Card.Header>
                  <Card.Body>
                    {ics209Loading && <div className="small text-muted">Loading ICS-209 data...</div>}
                    {!ics209Loading && ics209LoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2">
                        <span>{ics209LoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading ICS-209 data"
                          ariaLabel="Retry loading ICS-209 data"
                          onClick={() => { setIcs209LoadAttempted(false); setIcs209LoadError(null); }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}
                    {!ics209Loading && ics209Data && (
                      <Row className="g-2">
                        <Col md={3}><Badge bg="light" text="dark">Open Tasks: {ics209Data.openTaskCount}</Badge></Col>
                        <Col md={3}><Badge bg="light" text="dark">Active Objectives: {ics209Data.activeObjectiveCount}</Badge></Col>
                        <Col md={3}><Badge bg="light" text="dark">Active Resources: {ics209Data.activeResourceRequestCount}</Badge></Col>
                        <Col md={3}><Badge bg="light" text="dark">Active Comms: {ics209Data.activeCommunicationCount}</Badge></Col>
                      </Row>
                    )}
                  </Card.Body>
                </Card>

                {/* Situation Reports */}
                <Card className="border-light-subtle">
                  <Card.Header className="small fw-semibold d-flex align-items-center justify-content-between">
                    <span>
                      <i className="bi bi-file-text" aria-hidden="true" />
                      <span className="ms-2">Situation Reports</span>
                    </span>
                    <IconActionButton
                      iconClassName={showSitrepForm ? 'bi bi-x-circle' : 'bi bi-file-earmark-plus'}
                      tooltip={showSitrepForm ? 'Cancel SITREP form' : 'Generate SITREP'}
                      ariaLabel={showSitrepForm ? 'Cancel SITREP form' : 'Generate SITREP'}
                      onClick={() => setShowSitrepForm(!showSitrepForm)}
                      variant="outline-primary"
                      disabled={incidentActionLoading}
                    />
                  </Card.Header>
                  <Card.Body>
                    {showSitrepForm && (
                      <Card className="border-primary mb-3">
                        <Card.Header className="small fw-semibold">New Situation Report</Card.Header>
                        <Card.Body>
                          <Form>
                            <Form.Group className="mb-3">
                              <Form.Label className="small fw-semibold">
                                <LabelWithInfo text="Operational Period" info="Optionally associate this SITREP with a specific operational period for governance traceability and period-based reporting context." /> <span className="text-muted">(optional)</span>
                              </Form.Label>
                              <Form.Select
                                size="sm"
                                value={sitrepOperationalPeriodId || ''}
                                onChange={(e) =>
                                  setSitrepOperationalPeriodId(e.target.value ? Number(e.target.value) : null)
                                }
                              >
                                <option value="">— No period selected —</option>
                                {incidentOperationalPeriods.map((period) => (
                                  <option
                                    key={period.operationalPeriodId}
                                    value={period.operationalPeriodId}
                                  >
                                    {period.periodName} ({period.statusCode})
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>

                            <Form.Group className="mb-3">
                              <Form.Label className="small fw-semibold">
                                <LabelWithInfo text="Summary" info="Provide the required high-level situation narrative used for command briefing and downstream evidence exports." /> <span className="text-danger">*</span>
                              </Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={3}
                                size="sm"
                                value={sitrepSummary}
                                onChange={(e) => setSitrepSummary(e.target.value)}
                                placeholder="High-level situation summary..."
                              />
                            </Form.Group>

                            <Form.Group className="mb-3">
                              <Form.Label className="small fw-semibold">
                                <LabelWithInfo text="Current Actions" info="Capture actions currently underway so responders and leadership share an up-to-date execution picture." /> <span className="text-muted">(optional)</span>
                              </Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                size="sm"
                                value={sitrepCurrentActions}
                                onChange={(e) => setSitrepCurrentActions(e.target.value)}
                                placeholder="Actions currently underway..."
                              />
                            </Form.Group>

                            <Form.Group className="mb-3">
                              <Form.Label className="small fw-semibold">
                                <LabelWithInfo text="Planned Actions" info="Document near-term actions expected next to support operational alignment and shift handoff continuity." /> <span className="text-muted">(optional)</span>
                              </Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                size="sm"
                                value={sitrepPlannedActions}
                                onChange={(e) => setSitrepPlannedActions(e.target.value)}
                                placeholder="Next planned actions..."
                              />
                            </Form.Group>

                            <Form.Group className="mb-3">
                              <Form.Label className="small fw-semibold">
                                <LabelWithInfo text="Unmet Needs" info="List unresolved resource or capability gaps requiring escalation, procurement, or interagency support." /> <span className="text-muted">(optional)</span>
                              </Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                size="sm"
                                value={sitrepUnmetNeeds}
                                onChange={(e) => setSitrepUnmetNeeds(e.target.value)}
                                placeholder="Outstanding resource or capability gaps..."
                              />
                            </Form.Group>

                            <div className="d-flex gap-2 justify-content-end">
                              <IconActionButton
                                iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : 'bi bi-check2-circle'}
                                tooltip="Create situation report"
                                ariaLabel="Create situation report"
                                onClick={handleCreateSituationReport}
                                variant="primary"
                                disabled={incidentActionLoading || sitrepSummary.trim().length === 0}
                              />
                              <IconActionButton
                                iconClassName="bi bi-x-circle"
                                tooltip="Cancel situation report form"
                                ariaLabel="Cancel situation report form"
                                onClick={() => setShowSitrepForm(false)}
                                variant="outline-secondary"
                              />
                            </div>
                          </Form>
                        </Card.Body>
                      </Card>
                    )}

                    {situationReportsLoading && (
                      <div className="text-center py-3">
                        <Spinner animation="border" size="sm" className="me-2" />
                        <span className="small text-muted">Loading situation reports...</span>
                      </div>
                    )}

                    {!situationReportsLoading && situationReportsLoadError && (
                      <div className="small text-danger d-flex align-items-center gap-2 mb-2">
                        <span>{situationReportsLoadError}</span>
                        <IconActionButton
                          iconClassName="bi bi-arrow-clockwise"
                          tooltip="Retry loading situation reports"
                          ariaLabel="Retry loading situation reports"
                          onClick={() => {
                            setSituationReportsLoadAttempted(false);
                            setSituationReportsLoadError(null);
                          }}
                          variant="outline-secondary"
                        />
                      </div>
                    )}

                    {!situationReportsLoading && !situationReportsLoadError && situationReports.length === 0 && !showSitrepForm && (
                      <div className="small text-muted">
                        No situation reports yet. Click <strong>Generate SITREP</strong> to create one.
                      </div>
                    )}

                    {!situationReportsLoading && situationReports.length > 0 && (
                      <IpocDataGrid
                        gridId="incident-situation-reports"
                        rowData={situationReportsRows}
                        columnDefs={situationReportsColumnDefs}
                        emptyMessage="No situation reports available."
                        pageSize={25}
                        height={380}
                      />
                    )}
                  </Card.Body>
                </Card>
              </>
            )}
            </div>
            </div>
          </>
        )}
      </Card.Body>

      <UserPickerModal
        show={showUserPicker}
        onHide={() => {
          setShowUserPicker(false);
          setSelectedPositionForAssignment(null);
        }}
        onSelect={handleUserSelected}
        title="Assign User to Command Position"
      />
    </Card>
  );
}

export default IncidentCommandPaneCard;
