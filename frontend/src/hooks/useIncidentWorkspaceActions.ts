import type { Dispatch, SetStateAction } from 'react';
import {
  ApiValidationError,
  activateIncident,
  closeIncident,
  createIncident,
  createIncidentTask,
  createIncidentTimelineEvent,
  createIncidentOperationalPeriod,
  createIncidentObjective,
  approveIncidentOperationalPeriod,
  reopenIncidentOperationalPeriod,
  removeIncidentCommandAssignment,
  updateIncidentOperationalPeriod,
  updateIncidentObjective,
  updateIncident,
  updateIncidentTaskAssignment,
  updateIncidentTaskStatus,
  upsertIncidentCommandAssignment,
} from '../api';
import type { NotifyHandler } from '../notifications/types';
import type { IncidentDetail, LocationLookupValue, LookupValue } from '../types';

type IncidentWorkspaceActionDeps = {
  isAuthenticated: boolean;
  selectedIncidentId: number | null;
  incidentDetail: IncidentDetail | null;
  incidentCreateNumber: string;
  incidentCreateName: string;
  incidentCreateTypeCode: string;
  incidentCreateSeverity: string;
  incidentCreatePrimaryLocationId: string;
  incidentCreateSummary: string;
  incidentCreatePlanned: boolean;
  incidentEditName: string;
  incidentEditTypeCode: string;
  incidentEditSeverity: string;
  incidentEditPrimaryLocationId: string;
  incidentEditInitialSummary: string;
  incidentEditSituationSummary: string;
  incidentEditPlanned: boolean;
  taskTitleInput: string;
  taskDescriptionInput: string;
  taskPriorityInput: string;
  taskAssignedToUserIdInput: string;
  taskDueInput: string;
  timelineTypeInput: string;
  timelineTitleInput: string;
  timelineDescriptionInput: string;
  timelineEventUtcInput: string;
  operationalPeriodNumberInput: string;
  operationalPeriodNameInput: string;
  operationalPeriodStartInput: string;
  operationalPeriodEndInput: string;
  operationalPeriodStatusInput: string;
  operationalPeriodPlanningMeetingInput: string;
  objectiveOperationalPeriodIdInput: string;
  objectiveNumberInput: string;
  objectiveTextInput: string;
  objectivePriorityInput: string;
  objectiveStatusInput: string;
  objectiveOwnerUserIdInput: string;
  objectiveDueInput: string;
  incidentTypeLookups: LookupValue[];
  taskPriorityLookups: LookupValue[];
  timelineEventTypeLookups: LookupValue[];
  locationLookups: LocationLookupValue[];
  refreshIncidents: () => Promise<void>;
  refreshSelectedIncidentDetail: () => Promise<void>;
  refreshIncidentTasks: () => Promise<void>;
  refreshIncidentTimeline: () => Promise<void>;
  refreshIncidentOperationalPeriods: () => Promise<void>;
  refreshIncidentObjectives: () => Promise<void>;
  refreshIncidentCommandAssignments: () => Promise<void>;
  onNotify: NotifyHandler;
  setSelectedIncidentId: Dispatch<SetStateAction<number | null>>;
  setIncidentActionLoading: Dispatch<SetStateAction<boolean>>;
  setIncidentDetailError: Dispatch<SetStateAction<string | null>>;
  setIncidentCreateNumber: Dispatch<SetStateAction<string>>;
  setIncidentCreateName: Dispatch<SetStateAction<string>>;
  setIncidentCreateTypeCode: Dispatch<SetStateAction<string>>;
  setIncidentCreateSeverity: Dispatch<SetStateAction<string>>;
  setIncidentCreatePrimaryLocationId: Dispatch<SetStateAction<string>>;
  setIncidentCreateSummary: Dispatch<SetStateAction<string>>;
  setIncidentCreatePlanned: Dispatch<SetStateAction<boolean>>;
  setTaskTitleInput: Dispatch<SetStateAction<string>>;
  setTaskDescriptionInput: Dispatch<SetStateAction<string>>;
  setTaskPriorityInput: Dispatch<SetStateAction<string>>;
  setTaskAssignedToUserIdInput: Dispatch<SetStateAction<string>>;
  setTaskDueInput: Dispatch<SetStateAction<string>>;
  setTimelineTypeInput: Dispatch<SetStateAction<string>>;
  setTimelineTitleInput: Dispatch<SetStateAction<string>>;
  setTimelineDescriptionInput: Dispatch<SetStateAction<string>>;
  setTimelineEventUtcInput: Dispatch<SetStateAction<string>>;
  setOperationalPeriodNumberInput: Dispatch<SetStateAction<string>>;
  setOperationalPeriodNameInput: Dispatch<SetStateAction<string>>;
  setOperationalPeriodStartInput: Dispatch<SetStateAction<string>>;
  setOperationalPeriodEndInput: Dispatch<SetStateAction<string>>;
  setOperationalPeriodStatusInput: Dispatch<SetStateAction<string>>;
  setOperationalPeriodPlanningMeetingInput: Dispatch<SetStateAction<string>>;
  setObjectiveOperationalPeriodIdInput: Dispatch<SetStateAction<string>>;
  setObjectiveNumberInput: Dispatch<SetStateAction<string>>;
  setObjectiveTextInput: Dispatch<SetStateAction<string>>;
  setObjectivePriorityInput: Dispatch<SetStateAction<string>>;
  setObjectiveStatusInput: Dispatch<SetStateAction<string>>;
  setObjectiveOwnerUserIdInput: Dispatch<SetStateAction<string>>;
  setObjectiveDueInput: Dispatch<SetStateAction<string>>;
};

export function useIncidentWorkspaceActions(deps: IncidentWorkspaceActionDeps) {
  const handleReopenOperationalPeriod = async (operationalPeriodId: number): Promise<boolean> => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before reopening operational periods.', 'warning');
      return false;
    }

    if (operationalPeriodId <= 0) {
      deps.onNotify('Operational period id is required.', 'warning');
      return false;
    }

    try {
      deps.setIncidentActionLoading(true);
      await reopenIncidentOperationalPeriod(deps.selectedIncidentId, operationalPeriodId);
      await deps.refreshIncidentOperationalPeriods();
      deps.onNotify('Operational period reopened for planning updates.', 'success');
      return true;
    } catch (periodError) {
      if (periodError instanceof ApiValidationError) {
        const firstValidationError = Object.values(periodError.validationErrors).flat()[0];
        deps.onNotify(firstValidationError ?? periodError.message, 'warning');
        return false;
      }

      const message = periodError instanceof Error ? periodError.message : 'Unable to reopen operational period.';
      deps.onNotify(message, 'danger');
      return false;
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleApproveOperationalPeriod = async (operationalPeriodId: number): Promise<boolean> => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before approving operational periods.', 'warning');
      return false;
    }

    if (operationalPeriodId <= 0) {
      deps.onNotify('Operational period id is required.', 'warning');
      return false;
    }

    try {
      deps.setIncidentActionLoading(true);
      await approveIncidentOperationalPeriod(deps.selectedIncidentId, operationalPeriodId);
      await deps.refreshIncidentOperationalPeriods();
      deps.onNotify('Operational period approved.', 'success');
      return true;
    } catch (periodError) {
      if (periodError instanceof ApiValidationError) {
        const firstValidationError = Object.values(periodError.validationErrors).flat()[0];
        deps.onNotify(firstValidationError ?? periodError.message, 'warning');
        return false;
      }

      const message = periodError instanceof Error ? periodError.message : 'Unable to approve operational period.';
      deps.onNotify(message, 'danger');
      return false;
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleCreateIncident = async () => {
    if (!deps.isAuthenticated) {
      deps.onNotify('Sign in to create incidents.', 'warning');
      return;
    }

    if (deps.incidentCreateNumber.trim().length === 0) {
      deps.onNotify('Incident number is required.', 'warning');
      return;
    }

    if (deps.incidentCreateName.trim().length === 0) {
      deps.onNotify('Incident name is required.', 'warning');
      return;
    }

    if (deps.incidentCreateTypeCode.trim().length === 0) {
      deps.onNotify('Incident type is required.', 'warning');
      return;
    }

    if (deps.incidentCreatePrimaryLocationId.trim().length === 0 || Number.isNaN(Number(deps.incidentCreatePrimaryLocationId))) {
      deps.onNotify('Primary location is required.', 'warning');
      return;
    }

    const selectedLocation = deps.locationLookups.find((location) => location.locationId === Number(deps.incidentCreatePrimaryLocationId));
    if (!selectedLocation) {
      deps.onNotify('Selected location is not valid.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);

      const createdIncidentId = await createIncident({
        incidentNumber: deps.incidentCreateNumber.trim(),
        incidentName: deps.incidentCreateName.trim(),
        incidentTypeCode: deps.incidentCreateTypeCode.trim(),
        severityCode: deps.incidentCreateSeverity.trim().length > 0 ? deps.incidentCreateSeverity.trim() : undefined,
        isPlannedEvent: deps.incidentCreatePlanned,
        initialSummary: deps.incidentCreateSummary.trim().length > 0 ? deps.incidentCreateSummary.trim() : undefined,
      });

      await deps.refreshIncidents();
      deps.setSelectedIncidentId(createdIncidentId);
      deps.setIncidentCreateNumber('');
      deps.setIncidentCreateName('');
      deps.setIncidentCreateTypeCode(deps.incidentTypeLookups[0]?.code ?? '');
      deps.setIncidentCreateSeverity('');
      deps.setIncidentCreatePrimaryLocationId(deps.locationLookups[0] ? String(deps.locationLookups[0].locationId) : '');
      deps.setIncidentCreateSummary('');
      deps.setIncidentCreatePlanned(false);

      deps.onNotify('Incident created successfully.', 'success');
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Unable to create incident.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleUpdateOperationalPeriod = async (
    operationalPeriodId: number,
    request: {
      periodNumber: number;
      periodName?: string;
      startUtc: string;
      endUtc: string;
      statusCode: string;
      planningMeetingUtc?: string;
      approvedByUserId?: number;
      approvedUtc?: string;
    },
  ): Promise<boolean> => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before updating operational periods.', 'warning');
      return false;
    }

    if (operationalPeriodId <= 0) {
      deps.onNotify('Operational period id is required.', 'warning');
      return false;
    }

    if (request.periodNumber <= 0) {
      deps.onNotify('Operational period number must be greater than zero.', 'warning');
      return false;
    }

    if (new Date(request.endUtc).getTime() <= new Date(request.startUtc).getTime()) {
      deps.onNotify('Operational period end must be later than start.', 'warning');
      return false;
    }

    if (request.statusCode.trim().length === 0) {
      deps.onNotify('Operational period status is required.', 'warning');
      return false;
    }

    try {
      deps.setIncidentActionLoading(true);
      await updateIncidentOperationalPeriod(deps.selectedIncidentId, operationalPeriodId, request);
      await deps.refreshIncidentOperationalPeriods();
      deps.onNotify('Operational period updated.', 'success');
      return true;
    } catch (periodError) {
      if (periodError instanceof ApiValidationError) {
        const firstValidationError = Object.values(periodError.validationErrors).flat()[0];
        deps.onNotify(firstValidationError ?? periodError.message, 'warning');
        return false;
      }

      const message = periodError instanceof Error ? periodError.message : 'Unable to update operational period.';
      deps.onNotify(message, 'danger');
      return false;
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleUpdateObjective = async (
    incidentObjectiveId: number,
    request: {
      operationalPeriodId?: number;
      objectiveNumber: number;
      objectiveText: string;
      priorityCode: string;
      statusCode: string;
      ownerUserId?: number;
      dueUtc?: string;
    },
  ): Promise<boolean> => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before updating objectives.', 'warning');
      return false;
    }

    if (incidentObjectiveId <= 0) {
      deps.onNotify('Objective id is required.', 'warning');
      return false;
    }

    if (request.objectiveNumber <= 0) {
      deps.onNotify('Objective number must be greater than zero.', 'warning');
      return false;
    }

    if (request.objectiveText.trim().length === 0) {
      deps.onNotify('Objective text is required.', 'warning');
      return false;
    }

    if (request.priorityCode.trim().length === 0 || request.statusCode.trim().length === 0) {
      deps.onNotify('Objective priority and status are required.', 'warning');
      return false;
    }

    try {
      deps.setIncidentActionLoading(true);
      await updateIncidentObjective(deps.selectedIncidentId, incidentObjectiveId, request);
      await deps.refreshIncidentObjectives();
      deps.onNotify('Objective updated.', 'success');
      return true;
    } catch (objectiveError) {
      const message = objectiveError instanceof Error ? objectiveError.message : 'Unable to update objective.';
      deps.onNotify(message, 'danger');
      return false;
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleSaveIncidentMetadata = async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null || !deps.incidentDetail) {
      deps.onNotify('Sign in and select an incident before saving changes.', 'warning');
      return;
    }

    if (deps.incidentEditName.trim().length === 0) {
      deps.onNotify('Incident name is required.', 'warning');
      return;
    }

    if (deps.incidentEditTypeCode.trim().length === 0) {
      deps.onNotify('Incident type is required.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);
      deps.setIncidentDetailError(null);

      const selectedEditLocation = deps.incidentEditPrimaryLocationId.trim().length > 0
        ? deps.locationLookups.find((location) => location.locationId === Number(deps.incidentEditPrimaryLocationId))
        : null;

      if (deps.incidentEditPrimaryLocationId.trim().length > 0 && !selectedEditLocation) {
        deps.onNotify('Selected primary location is not valid.', 'warning');
        return;
      }

      await updateIncident(deps.selectedIncidentId, {
        incidentName: deps.incidentEditName.trim(),
        incidentTypeCode: deps.incidentEditTypeCode.trim(),
        severityCode: deps.incidentEditSeverity.trim().length > 0 ? deps.incidentEditSeverity.trim() : undefined,
        isPlannedEvent: deps.incidentEditPlanned,
        initialSummary: deps.incidentEditInitialSummary.trim().length > 0 ? deps.incidentEditInitialSummary.trim() : undefined,
        situationSummary: deps.incidentEditSituationSummary.trim().length > 0 ? deps.incidentEditSituationSummary.trim() : undefined,
      });

      await Promise.all([deps.refreshSelectedIncidentDetail(), deps.refreshIncidents()]);
      deps.onNotify('Incident metadata updated.', 'success');
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update incident.';
      deps.setIncidentDetailError(message);
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleCreateIncidentTask = async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before creating tasks.', 'warning');
      return;
    }

    if (deps.taskTitleInput.trim().length === 0) {
      deps.onNotify('Task title is required.', 'warning');
      return;
    }

    if (deps.taskAssignedToUserIdInput.trim().length > 0 && Number.isNaN(Number(deps.taskAssignedToUserIdInput))) {
      deps.onNotify('Assigned user id must be numeric when provided.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);

      await createIncidentTask(deps.selectedIncidentId, {
        taskTitle: deps.taskTitleInput.trim(),
        taskDescription: deps.taskDescriptionInput.trim().length > 0 ? deps.taskDescriptionInput.trim() : undefined,
        priorityCode: deps.taskPriorityInput,
        assignedToUserId: deps.taskAssignedToUserIdInput.trim().length > 0 ? Number(deps.taskAssignedToUserIdInput) : undefined,
        dueUtc: deps.taskDueInput.length > 0 ? new Date(deps.taskDueInput).toISOString() : undefined,
      });

      await deps.refreshIncidentTasks();
      deps.setTaskTitleInput('');
      deps.setTaskDescriptionInput('');
      deps.setTaskPriorityInput(deps.taskPriorityLookups[0]?.code ?? '');
      deps.setTaskAssignedToUserIdInput('');
      deps.setTaskDueInput('');

      deps.onNotify('Incident task created.', 'success');
    } catch (taskError) {
      const message = taskError instanceof Error ? taskError.message : 'Unable to create incident task.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleUpdateIncidentTaskAssignment = async (incidentTaskId: number, assignedToUserId: number | null) => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before updating task assignment.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);
      await updateIncidentTaskAssignment(deps.selectedIncidentId, incidentTaskId, {
        assignedToUserId: assignedToUserId ?? undefined,
      });
      await deps.refreshIncidentTasks();
      deps.onNotify('Task assignment updated.', 'success');
    } catch (taskError) {
      const message = taskError instanceof Error ? taskError.message : 'Unable to update task assignment.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleUpdateIncidentTaskStatus = async (incidentTaskId: number, statusCode: string) => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before updating task status.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);
      await updateIncidentTaskStatus(deps.selectedIncidentId, incidentTaskId, { statusCode });
      await deps.refreshIncidentTasks();
      deps.onNotify('Task status updated.', 'success');
    } catch (taskError) {
      const message = taskError instanceof Error ? taskError.message : 'Unable to update task status.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleCreateIncidentTimelineEvent = async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before adding timeline events.', 'warning');
      return;
    }

    if (deps.timelineTypeInput.trim().length === 0) {
      deps.onNotify('Timeline event type is required.', 'warning');
      return;
    }

    if (deps.timelineTitleInput.trim().length === 0) {
      deps.onNotify('Timeline event title is required.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);

      await createIncidentTimelineEvent(deps.selectedIncidentId, {
        eventTypeCode: deps.timelineTypeInput.trim(),
        eventTitle: deps.timelineTitleInput.trim(),
        eventDescription: deps.timelineDescriptionInput.trim().length > 0 ? deps.timelineDescriptionInput.trim() : undefined,
        eventUtc: deps.timelineEventUtcInput.length > 0 ? new Date(deps.timelineEventUtcInput).toISOString() : undefined,
      });

      await deps.refreshIncidentTimeline();
      deps.setTimelineTypeInput(deps.timelineEventTypeLookups[0]?.code ?? '');
      deps.setTimelineTitleInput('');
      deps.setTimelineDescriptionInput('');
      deps.setTimelineEventUtcInput('');

      deps.onNotify('Timeline event added.', 'success');
    } catch (timelineError) {
      const message = timelineError instanceof Error ? timelineError.message : 'Unable to add timeline event.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleCreateOperationalPeriod = async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before creating operational periods.', 'warning');
      return;
    }

    if (deps.operationalPeriodNumberInput.trim().length === 0 || Number.isNaN(Number(deps.operationalPeriodNumberInput))) {
      deps.onNotify('Operational period number is required.', 'warning');
      return;
    }

    if (deps.operationalPeriodStartInput.trim().length === 0 || deps.operationalPeriodEndInput.trim().length === 0) {
      deps.onNotify('Operational period start and end are required.', 'warning');
      return;
    }

    if (deps.operationalPeriodStatusInput.trim().length === 0) {
      deps.onNotify('Operational period status is required.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);

      await createIncidentOperationalPeriod(deps.selectedIncidentId, {
        periodNumber: Number(deps.operationalPeriodNumberInput),
        periodName: deps.operationalPeriodNameInput.trim().length > 0 ? deps.operationalPeriodNameInput.trim() : undefined,
        startUtc: new Date(deps.operationalPeriodStartInput).toISOString(),
        endUtc: new Date(deps.operationalPeriodEndInput).toISOString(),
        statusCode: deps.operationalPeriodStatusInput.trim(),
        planningMeetingUtc: deps.operationalPeriodPlanningMeetingInput.trim().length > 0
          ? new Date(deps.operationalPeriodPlanningMeetingInput).toISOString()
          : undefined,
      });

      await deps.refreshIncidentOperationalPeriods();
      deps.setOperationalPeriodNumberInput('');
      deps.setOperationalPeriodNameInput('');
      deps.setOperationalPeriodStartInput('');
      deps.setOperationalPeriodEndInput('');
      deps.setOperationalPeriodStatusInput('Planned');
      deps.setOperationalPeriodPlanningMeetingInput('');

      deps.onNotify('Operational period created.', 'success');
    } catch (periodError) {
      if (periodError instanceof ApiValidationError) {
        const firstValidationError = Object.values(periodError.validationErrors).flat()[0];
        deps.onNotify(firstValidationError ?? periodError.message, 'warning');
        return;
      }

      const message = periodError instanceof Error ? periodError.message : 'Unable to create operational period.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleCreateObjective = async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in and select an incident before creating objectives.', 'warning');
      return;
    }

    if (deps.objectiveNumberInput.trim().length === 0 || Number.isNaN(Number(deps.objectiveNumberInput))) {
      deps.onNotify('Objective number is required.', 'warning');
      return;
    }

    if (deps.objectiveTextInput.trim().length === 0) {
      deps.onNotify('Objective text is required.', 'warning');
      return;
    }

    if (deps.objectivePriorityInput.trim().length === 0 || deps.objectiveStatusInput.trim().length === 0) {
      deps.onNotify('Objective priority and status are required.', 'warning');
      return;
    }

    if (deps.objectiveOperationalPeriodIdInput.trim().length > 0 && Number.isNaN(Number(deps.objectiveOperationalPeriodIdInput))) {
      deps.onNotify('Operational period id must be numeric when provided.', 'warning');
      return;
    }

    if (deps.objectiveOwnerUserIdInput.trim().length > 0 && Number.isNaN(Number(deps.objectiveOwnerUserIdInput))) {
      deps.onNotify('Owner user id must be numeric when provided.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);

      await createIncidentObjective(deps.selectedIncidentId, {
        operationalPeriodId: deps.objectiveOperationalPeriodIdInput.trim().length > 0 ? Number(deps.objectiveOperationalPeriodIdInput) : undefined,
        objectiveNumber: Number(deps.objectiveNumberInput),
        objectiveText: deps.objectiveTextInput.trim(),
        priorityCode: deps.objectivePriorityInput.trim(),
        statusCode: deps.objectiveStatusInput.trim(),
        ownerUserId: deps.objectiveOwnerUserIdInput.trim().length > 0 ? Number(deps.objectiveOwnerUserIdInput) : undefined,
        dueUtc: deps.objectiveDueInput.trim().length > 0 ? new Date(deps.objectiveDueInput).toISOString() : undefined,
      });

      await deps.refreshIncidentObjectives();
      deps.setObjectiveOperationalPeriodIdInput('');
      deps.setObjectiveNumberInput('');
      deps.setObjectiveTextInput('');
      deps.setObjectivePriorityInput('Normal');
      deps.setObjectiveStatusInput('Open');
      deps.setObjectiveOwnerUserIdInput('');
      deps.setObjectiveDueInput('');

      deps.onNotify('Objective created.', 'success');
    } catch (objectiveError) {
      const message = objectiveError instanceof Error ? objectiveError.message : 'Unable to create objective.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleActivateIncident = async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in to activate incidents.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);
      deps.setIncidentDetailError(null);
      await activateIncident(deps.selectedIncidentId);
      await Promise.all([deps.refreshSelectedIncidentDetail(), deps.refreshIncidents()]);
      deps.onNotify('Incident activated successfully.', 'success');
    } catch (commandError) {
      const message = commandError instanceof Error ? commandError.message : 'Unable to activate incident.';
      deps.setIncidentDetailError(message);
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleCloseIncident = async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in to close incidents.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);
      deps.setIncidentDetailError(null);
      await closeIncident(deps.selectedIncidentId);
      await Promise.all([deps.refreshSelectedIncidentDetail(), deps.refreshIncidents()]);
      deps.onNotify('Incident closed successfully.', 'warning');
    } catch (commandError) {
      const message = commandError instanceof Error ? commandError.message : 'Unable to close incident.';
      deps.setIncidentDetailError(message);
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleAssignCommandPosition = async (icsPositionId: number, assignedUserId: number | null): Promise<boolean> => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in to assign command positions.', 'warning');
      return false;
    }

    try {
      deps.setIncidentActionLoading(true);
      await upsertIncidentCommandAssignment(deps.selectedIncidentId, {
        icsPositionId,
        assignedUserId: assignedUserId ?? undefined,
      });
      await deps.refreshIncidentCommandAssignments();
      deps.onNotify('Command position assigned successfully.', 'success');
      return true;
    } catch (assignError) {
      const message = assignError instanceof Error ? assignError.message : 'Unable to assign command position.';
      deps.onNotify(message, 'danger');
      return false;
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  const handleRemoveCommandAssignment = async (icsPositionId: number) => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.onNotify('Sign in to remove command assignments.', 'warning');
      return;
    }

    try {
      deps.setIncidentActionLoading(true);
      await removeIncidentCommandAssignment(deps.selectedIncidentId, icsPositionId);
      await deps.refreshIncidentCommandAssignments();
      deps.onNotify('Command assignment removed successfully.', 'warning');
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : 'Unable to remove command assignment.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentActionLoading(false);
    }
  };

  return {
    handleCreateIncident,
    handleSaveIncidentMetadata,
    handleCreateIncidentTask,
    handleUpdateIncidentTaskStatus,
    handleUpdateIncidentTaskAssignment,
    handleCreateIncidentTimelineEvent,
    handleCreateOperationalPeriod,
    handleApproveOperationalPeriod,
    handleReopenOperationalPeriod,
    handleCreateObjective,
    handleUpdateOperationalPeriod,
    handleUpdateObjective,
    handleActivateIncident,
    handleCloseIncident,
    handleAssignCommandPosition,
    handleRemoveCommandAssignment,
  };
}
