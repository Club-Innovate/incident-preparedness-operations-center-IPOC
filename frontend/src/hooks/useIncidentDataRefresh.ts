import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  getIncidentById,
  getIncidents,
  getIncidentTasks,
  getIncidentTimeline,
  getIncidentOperationalPeriods,
  getIncidentObjectives,
  getIncidentCommandAssignments,
  getIcsPositions,
} from '../api';
import type { NotifyHandler } from '../notifications/types';
import type {
  IcsPosition,
  IncidentCommandAssignment,
  IncidentDetail,
  IncidentSummary,
  IncidentTask,
  IncidentTimelineEvent,
  IncidentOperationalPeriod,
  IncidentObjective,
} from '../types';

type IncidentDataRefreshDeps = {
  isAuthenticated: boolean;
  selectedIncidentId: number | null;
  setIncidents: Dispatch<SetStateAction<IncidentSummary[]>>;
  setIncidentsError: Dispatch<SetStateAction<string | null>>;
  setIncidentDetail: Dispatch<SetStateAction<IncidentDetail | null>>;
  setIncidentDetailLoading: Dispatch<SetStateAction<boolean>>;
  setIncidentDetailError: Dispatch<SetStateAction<string | null>>;
  setIncidentTasks: Dispatch<SetStateAction<IncidentTask[]>>;
  setIncidentTasksLoading: Dispatch<SetStateAction<boolean>>;
  setIncidentTimelineEvents: Dispatch<SetStateAction<IncidentTimelineEvent[]>>;
  setIncidentTimelineLoading: Dispatch<SetStateAction<boolean>>;
  setIncidentOperationalPeriods: Dispatch<SetStateAction<IncidentOperationalPeriod[]>>;
  setIncidentOperationalPeriodsLoading: Dispatch<SetStateAction<boolean>>;
  setIncidentObjectives: Dispatch<SetStateAction<IncidentObjective[]>>;
  setIncidentObjectivesLoading: Dispatch<SetStateAction<boolean>>;
  setIcsPositions: Dispatch<SetStateAction<IcsPosition[]>>;
  setIcsPositionsLoading: Dispatch<SetStateAction<boolean>>;
  setIncidentCommandAssignments: Dispatch<SetStateAction<IncidentCommandAssignment[]>>;
  setIncidentCommandAssignmentsLoading: Dispatch<SetStateAction<boolean>>;
  onNotify: NotifyHandler;
};

export function useIncidentDataRefresh(deps: IncidentDataRefreshDeps) {
  const refreshIncidents = useCallback(async () => {
    if (!deps.isAuthenticated) {
      return;
    }

    try {
      const refreshed = await getIncidents();
      deps.setIncidents(refreshed);
      deps.setIncidentsError(null);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Unable to refresh incidents.';
      deps.setIncidentsError(message);
      deps.onNotify(message, 'danger');
    }
  }, [deps]);

  const refreshSelectedIncidentDetail = useCallback(async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      return;
    }

    deps.setIncidentDetailLoading(true);
    deps.setIncidentDetailError(null);

    try {
      const detail = await getIncidentById(deps.selectedIncidentId);
      deps.setIncidentDetail(detail);
    } catch (detailError) {
      const message = detailError instanceof Error ? detailError.message : 'Unable to load incident detail.';
      deps.setIncidentDetailError(message);
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentDetailLoading(false);
    }
  }, [deps]);

  const refreshIncidentTasks = useCallback(async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.setIncidentTasks([]);
      return;
    }

    try {
      deps.setIncidentTasksLoading(true);
      const tasks = await getIncidentTasks(deps.selectedIncidentId);
      deps.setIncidentTasks(tasks);
    } catch (tasksError) {
      const message = tasksError instanceof Error ? tasksError.message : 'Unable to load incident tasks.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentTasksLoading(false);
    }
  }, [deps]);

  const refreshIncidentTimeline = useCallback(async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.setIncidentTimelineEvents([]);
      return;
    }

    try {
      deps.setIncidentTimelineLoading(true);
      const events = await getIncidentTimeline(deps.selectedIncidentId);
      deps.setIncidentTimelineEvents(events);
    } catch (timelineError) {
      const message = timelineError instanceof Error ? timelineError.message : 'Unable to load incident timeline.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentTimelineLoading(false);
    }
  }, [deps]);

  const refreshIncidentOperationalPeriods = useCallback(async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.setIncidentOperationalPeriods([]);
      return;
    }

    try {
      deps.setIncidentOperationalPeriodsLoading(true);
      const periods = await getIncidentOperationalPeriods(deps.selectedIncidentId);
      deps.setIncidentOperationalPeriods(periods);
    } catch (periodError) {
      const message = periodError instanceof Error ? periodError.message : 'Unable to load operational periods.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentOperationalPeriodsLoading(false);
    }
  }, [deps]);

  const refreshIncidentObjectives = useCallback(async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.setIncidentObjectives([]);
      return;
    }

    try {
      deps.setIncidentObjectivesLoading(true);
      const objectives = await getIncidentObjectives(deps.selectedIncidentId);
      deps.setIncidentObjectives(objectives);
    } catch (objectiveError) {
      const message = objectiveError instanceof Error ? objectiveError.message : 'Unable to load incident objectives.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIncidentObjectivesLoading(false);
    }
  }, [deps]);

  const refreshIcsPositions = useCallback(async (forceRefresh = false) => {
    if (!deps.isAuthenticated) {
      return;
    }

    try {
      deps.setIcsPositionsLoading(true);
      const positions = await getIcsPositions(forceRefresh);
      deps.setIcsPositions(positions);
    } catch (positionError) {
      const message = positionError instanceof Error ? positionError.message : 'Unable to load ICS positions.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setIcsPositionsLoading(false);
    }
  }, [deps]);

  const refreshIncidentCommandAssignments = useCallback(async () => {
    if (!deps.isAuthenticated || deps.selectedIncidentId === null) {
      deps.setIncidentCommandAssignments([]);
      return;
    }

    try {
      deps.setIncidentCommandAssignmentsLoading(true);
      const assignments = await getIncidentCommandAssignments(deps.selectedIncidentId);
      deps.setIncidentCommandAssignments(assignments);

      if (import.meta.env.DEV) {
        console.debug('[ICS] refreshIncidentCommandAssignments success.', {
          incidentId: deps.selectedIncidentId,
          assignmentCount: assignments.length,
        });
      }
    } catch (assignmentError) {
      const message = assignmentError instanceof Error ? assignmentError.message : 'Unable to load command assignments.';
      if (import.meta.env.DEV) {
        console.error('[ICS] refreshIncidentCommandAssignments failed.', {
          incidentId: deps.selectedIncidentId,
          message,
        });
      }
      deps.onNotify(message, 'danger');
      throw assignmentError;
    } finally {
      deps.setIncidentCommandAssignmentsLoading(false);
    }
  }, [deps]);

  return {
    refreshIncidents,
    refreshSelectedIncidentDetail,
    refreshIncidentTasks,
    refreshIncidentTimeline,
    refreshIncidentOperationalPeriods,
    refreshIncidentObjectives,
    refreshIcsPositions,
    refreshIncidentCommandAssignments,
  };
}
