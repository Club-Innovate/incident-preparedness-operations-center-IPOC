import { useEffect, useState } from 'react';
import { getLocationLookups, getLookupValues } from '../api';
import type { NotifyHandler } from '../notifications/types';
import type { LocationLookupValue, LookupValue } from '../types';

type OperationalLookups = {
  incidentTypeLookups: LookupValue[];
  incidentSeverityLookups: LookupValue[];
  incidentStatusLookups: LookupValue[];
  taskPriorityLookups: LookupValue[];
  taskStatusLookups: LookupValue[];
  timelineEventTypeLookups: LookupValue[];
  resourceTypeLookups: LookupValue[];
  locationLookups: LocationLookupValue[];
};

export function useOperationalLookups(isAuthenticated: boolean, onNotify: NotifyHandler): OperationalLookups {
  const [incidentTypeLookups, setIncidentTypeLookups] = useState<LookupValue[]>([]);
  const [incidentSeverityLookups, setIncidentSeverityLookups] = useState<LookupValue[]>([]);
  const [incidentStatusLookups, setIncidentStatusLookups] = useState<LookupValue[]>([]);
  const [taskPriorityLookups, setTaskPriorityLookups] = useState<LookupValue[]>([]);
  const [taskStatusLookups, setTaskStatusLookups] = useState<LookupValue[]>([]);
  const [timelineEventTypeLookups, setTimelineEventTypeLookups] = useState<LookupValue[]>([]);
  const [resourceTypeLookups, setResourceTypeLookups] = useState<LookupValue[]>([]);
  const [locationLookups, setLocationLookups] = useState<LocationLookupValue[]>([]);

  useEffect(() => {
    const loadLookups = async () => {
      if (!isAuthenticated) {
        setIncidentTypeLookups([]);
        setIncidentSeverityLookups([]);
        setIncidentStatusLookups([]);
        setTaskPriorityLookups([]);
        setTaskStatusLookups([]);
        setTimelineEventTypeLookups([]);
        setResourceTypeLookups([]);
        setLocationLookups([]);
        return;
      }

      try {
        const [
          incidentTypes,
          incidentSeverities,
          incidentStatuses,
          taskPriorities,
          taskStatuses,
          timelineTypes,
          resourceTypes,
          locations,
        ] = await Promise.all([
          getLookupValues('IncidentType'),
          getLookupValues('Severity'),
          getLookupValues('IncidentStatus'),
          getLookupValues('TaskPriority'),
          getLookupValues('TaskStatus'),
          getLookupValues('TimelineEventType'),
          getLookupValues('ResourceType'),
          getLocationLookups(),
        ]);

        setIncidentTypeLookups(incidentTypes);
        setIncidentSeverityLookups(incidentSeverities);
        setIncidentStatusLookups(incidentStatuses);
        setTaskPriorityLookups(taskPriorities);
        setTaskStatusLookups(taskStatuses);
        setTimelineEventTypeLookups(timelineTypes);
        setResourceTypeLookups(resourceTypes);
        setLocationLookups(locations);
      } catch (lookupError) {
        const message = lookupError instanceof Error ? lookupError.message : 'Unable to load lookup values.';
        if (!message.includes('Authentication required.')) {
          onNotify(message, 'danger');
        }
      }
    };

    void loadLookups();
  }, [isAuthenticated, onNotify]);

  return {
    incidentTypeLookups,
    incidentSeverityLookups,
    incidentStatusLookups,
    taskPriorityLookups,
    taskStatusLookups,
    timelineEventTypeLookups,
    resourceTypeLookups,
    locationLookups,
  };
}
