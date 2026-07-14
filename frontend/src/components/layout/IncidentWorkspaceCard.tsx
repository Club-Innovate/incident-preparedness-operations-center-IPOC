import { useEffect, useState } from 'react';
import { Accordion, Badge, Card, ListGroup } from 'react-bootstrap';
import type { CopCommandHandoffContext, IncidentOperationalInsight, WeatherOperationalSignal } from '../../types';
import type { NotifyHandler } from '../../notifications/types';
import CopHandoffBanner from '../common/CopHandoffBanner';
import { readCopCommandHandoffContext } from '../../utils/copHandoffContext';
import { clearCopHandoffBannerContext, dismissCopHandoffBanner } from '../../utils/copHandoffNotifications';

type IncidentWorkspaceCardProps = {
  incidentDetail: {
    incidentNumber: string;
    incidentName: string;
    incidentStatusCode: string;
    situationSummary: string | null;
    initialSummary: string | null;
  } | null;
  resourceRequestCount?: number;
  communicationCount?: number;
  sitrepCount?: number;
  openTaskCount?: number;
  timelineEventCount?: number;
  operationalInsight?: IncidentOperationalInsight;
  weatherOperationalSignal: WeatherOperationalSignal;
  onNotify: NotifyHandler;
};

function IncidentWorkspaceCard({ incidentDetail, resourceRequestCount, communicationCount, sitrepCount, openTaskCount, timelineEventCount, operationalInsight, weatherOperationalSignal, onNotify }: IncidentWorkspaceCardProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['0', '1', '2']);
  const [accordionStateReady, setAccordionStateReady] = useState(false);
  const [showWeatherRiskDayDetails, setShowWeatherRiskDayDetails] = useState(false);
  const [copHandoffContext, setCopHandoffContext] = useState<CopCommandHandoffContext | null>(null);
  const [copHandoffDismissed, setCopHandoffDismissed] = useState(false);
  const safeResourceRequestCount = resourceRequestCount ?? 0;
  const safeCommunicationCount = communicationCount ?? 0;
  const safeSitrepCount = sitrepCount ?? 0;
  const safeOpenTaskCount = openTaskCount ?? 0;
  const safeTimelineEventCount = timelineEventCount ?? 0;
  const situationText = incidentDetail?.situationSummary || incidentDetail?.initialSummary || 'Select an incident to view situation details.';
  const incidentStatusSummary = incidentDetail
    ? `Incident is currently ${incidentDetail.incidentStatusCode}.`
    : 'Incident status is not available until an incident is selected.';
  const resourceInsight = safeResourceRequestCount === 0
    ? 'No resource requests logged yet for this incident.'
    : `${safeResourceRequestCount} resource request(s) are currently in play.`;
  const communicationsInsight = safeCommunicationCount === 0
    ? 'No communications logged yet.'
    : `${safeCommunicationCount} communication log entr${safeCommunicationCount === 1 ? 'y' : 'ies'} captured.`;
  const sitrepInsight = safeSitrepCount === 0
    ? 'No SITREP submitted yet.'
    : `${safeSitrepCount} SITREP report(s) published.`;
  const formatDelta = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  const attentionVariant = operationalInsight?.attentionLevel === 'high'
    ? 'danger'
    : operationalInsight?.attentionLevel === 'moderate'
      ? 'info'
      : 'secondary';
  const staleTimelineUrgency = operationalInsight?.staleTimelineHours !== null && operationalInsight?.staleTimelineHours !== undefined
    ? operationalInsight.staleTimelineHours > 24
      ? 'Timeline refresh recommended immediately.'
      : operationalInsight.staleTimelineHours > 12
        ? 'Timeline update recommended this operational period.'
        : 'Timeline cadence is healthy.'
    : 'No timeline staleness signal yet.';
  const staleSitrepUrgency = operationalInsight?.staleSitrepHours !== null && operationalInsight?.staleSitrepHours !== undefined
    ? operationalInsight.staleSitrepHours > 24
      ? 'SITREP refresh recommended immediately.'
      : operationalInsight.staleSitrepHours > 12
        ? 'SITREP update recommended this operational period.'
        : 'SITREP cadence is healthy.'
    : 'No SITREP submitted yet for this incident.';
  const taskAttentionSignal = safeOpenTaskCount > 0
    ? `${safeOpenTaskCount} open task${safeOpenTaskCount === 1 ? '' : 's'} should be reviewed for assignment and due-time alignment.`
    : 'No open tasks currently pending assignment.';
  const communicationsActionSignal = safeCommunicationCount > 0
    ? 'Review communication entries for unresolved inbound requests and route acknowledgements.'
    : 'Consider logging command communications to improve common operating picture continuity.';
  const immediateWeatherDay = weatherOperationalSignal.days[0] ?? null;
  const weatherRiskVariant = weatherOperationalSignal.highRiskDayCount > 0
    ? 'danger'
    : weatherOperationalSignal.moderateRiskDayCount > 0
      ? 'warning'
      : 'success';
  const weatherRiskLabel = weatherOperationalSignal.highRiskDayCount > 0
    ? `${weatherOperationalSignal.highRiskDayCount} high-risk day(s)`
    : weatherOperationalSignal.moderateRiskDayCount > 0
      ? `${weatherOperationalSignal.moderateRiskDayCount} watch day(s)`
      : 'No elevated weather risk';
  const weatherRiskLevelFilter = weatherOperationalSignal.highRiskDayCount > 0 ? 'high' : 'moderate';
  const weatherRiskDays = weatherOperationalSignal.days.filter((item) => item.riskLevel === weatherRiskLevelFilter);

  useEffect(() => {
    const persisted = localStorage.getItem('ipoc.accordion.incidentWorkspace');
    if (!persisted) {
      setAccordionStateReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(persisted) as unknown;
      if (Array.isArray(parsed)) {
        setExpandedSections(parsed.filter((item): item is string => typeof item === 'string'));
      }
    } catch {
      // ignore invalid persisted accordion state
    }

    setAccordionStateReady(true);
  }, []);

  useEffect(() => {
    const parsed = readCopCommandHandoffContext('incidents');
    if (!parsed) {
      return;
    }

    setCopHandoffContext(parsed);
    setCopHandoffDismissed(false);
    onNotify('Incident workspace primed from COP command handoff context.', 'info');
  }, [onNotify]);

  useEffect(() => {
    if (!accordionStateReady) {
      return;
    }

    localStorage.setItem('ipoc.accordion.incidentWorkspace', JSON.stringify(expandedSections));
  }, [accordionStateReady, expandedSections]);

  const handleAccordionSelect = (eventKey: string | string[] | null | undefined) => {
    if (eventKey === null || eventKey === undefined) {
      return;
    }

    if (Array.isArray(eventKey)) {
      setExpandedSections(eventKey);
      return;
    }

    setExpandedSections((current) => {
      if (current.includes(eventKey)) {
        return current.filter((key) => key !== eventKey);
      }

      return [...current, eventKey];
    });
  };

  const dismissCopHandoffContext = () => {
    dismissCopHandoffBanner('Incident', setCopHandoffDismissed, onNotify);
  };

  const clearCopHandoffContext = () => {
    clearCopHandoffBannerContext(setCopHandoffContext, setCopHandoffDismissed, onNotify, false);
  };

  const launchIncidentCopilotBrief = () => {
    if (!incidentDetail) {
      onNotify('Select an incident before launching AI Incident Co-Pilot brief.', 'warning');
      return;
    }

    const prompt = `Create an AI incident co-pilot brief for incident ${incidentDetail.incidentId} over 24 hours and include recommended actions plus ICS draft objectives.`;
    localStorage.setItem('ipoc.agent.prefillPrompt', prompt);
    onNotify('AI Incident Co-Pilot prompt staged. Open the assistant and submit when ready.', 'info');
  };

  return (
    <Card className="shadow-sm mb-3">
      <Card.Header className="fw-semibold">Incident Workspace</Card.Header>
      <Card.Body>
        {copHandoffContext && !copHandoffDismissed && (
          <CopHandoffBanner
            context={copHandoffContext}
            badgeLabel="Incident handoff"
            onDismiss={dismissCopHandoffContext}
            onClear={clearCopHandoffContext}
          />
        )}
        <Accordion
          alwaysOpen
          activeKey={expandedSections}
          onSelect={handleAccordionSelect}
          className="ipoc-section-accordion"
        >
          <div className="d-flex justify-content-end mb-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={launchIncidentCopilotBrief}
            >
              Launch AI Incident Co-Pilot Brief
            </button>
          </div>
          <Accordion.Item eventKey="0">
            <Accordion.Header>Situation</Accordion.Header>
            <Accordion.Body>
              {!incidentDetail && <div className="text-muted small">No incident selected.</div>}
              {incidentDetail && (
                <>
                  <div className="small fw-semibold">{incidentDetail.incidentNumber} — {incidentDetail.incidentName}</div>
                  <div className="small text-muted">Status: {incidentDetail.incidentStatusCode}</div>
                </>
              )}
              <div className="small mt-2">{situationText}</div>
              <div className="small text-muted mt-2">{incidentStatusSummary}</div>
              <div className="small text-muted mt-2">
                Weather context: {weatherOperationalSignal.locationLabel} · Source {weatherOperationalSignal.sourceLabel}
              </div>
              {!weatherOperationalSignal.hasData && (
                <div className="small text-muted mt-1">
                  Live weather unavailable for this incident context. Ensure incident/location coordinates or Admin weather fallback location data are configured.
                </div>
              )}
              {immediateWeatherDay && (
                <div className="small text-muted mt-1">
                  Next forecast: {new Date(immediateWeatherDay.date).toLocaleDateString()} · {immediateWeatherDay.temperatureF}°F · {immediateWeatherDay.summary}
                </div>
              )}
              <div className="d-flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => setShowWeatherRiskDayDetails((current) => !current)}
                  disabled={weatherRiskDays.length === 0}
                >
                  <Badge bg={weatherRiskVariant}>{weatherRiskLabel}</Badge>
                </button>
                <Badge bg="secondary">Avg {weatherOperationalSignal.averageTempF}°F</Badge>
                <Badge bg="secondary">Spread {weatherOperationalSignal.temperatureSpread}°F</Badge>
              </div>
              <div className="small text-muted mt-1">{weatherOperationalSignal.immediateSummary}</div>
              {showWeatherRiskDayDetails && weatherRiskDays.length > 0 && (
                <ListGroup variant="flush" className="mt-2">
                  {weatherRiskDays.map((item) => (
                    <ListGroup.Item key={`incident-weather-risk-${item.date}`} className="px-0 py-1 small bg-transparent">
                      <span className="fw-semibold">{new Date(item.date).toLocaleDateString()}</span>
                      <span className="text-muted"> · {item.temperatureF}°F / {item.temperatureC}°C · {item.summary}</span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
              {operationalInsight && operationalInsight.needsAttention && (
                <div className="small mt-2">
                  <span className="fw-semibold">Needs Attention:</span>{' '}
                  {operationalInsight.needsAttentionReasons.join(' · ')}
                </div>
              )}
                {operationalInsight && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <Badge bg={attentionVariant}>Attention {operationalInsight.attentionLevel.toUpperCase()}</Badge>
                  {operationalInsight.staleTimelineHours !== null && operationalInsight.staleTimelineHours > 24 && (
                    <Badge bg="danger">Timeline stale {operationalInsight.staleTimelineHours}h</Badge>
                  )}
                  {operationalInsight.staleSitrepHours !== null && operationalInsight.staleSitrepHours > 24 && (
                    <Badge bg="danger">SITREP stale {operationalInsight.staleSitrepHours}h</Badge>
                  )}
                </div>
              )}
              {operationalInsight && (
                  <div className="small mt-2">
                    <span className="fw-semibold">Attention Score:</span>{' '}
                    {operationalInsight.attentionScore} ({operationalInsight.attentionLevel})
                  </div>
                )}
              {operationalInsight && (
                <div className="small text-muted mt-2">
                  Timeline 24h activity: {operationalInsight.timelineActivity24hCount} (Δ {formatDelta(operationalInsight.timelineActivity24hDelta)})
                </div>
              )}
              <div className="small text-muted mt-2">{staleTimelineUrgency}</div>
              <div className="small text-muted mt-1">{staleSitrepUrgency}</div>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>Resources</Accordion.Header>
            <Accordion.Body>
              <div className="small mb-2">Resource requests, assignments, and bed availability posture.</div>
              <div className="small text-muted mb-2">{resourceInsight}</div>
              <div className="small text-muted mb-2">{taskAttentionSignal}</div>
              <ListGroup variant="flush">
                <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                  <span>Incident resource requests</span>
                  <strong>{safeResourceRequestCount}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                  <span>Open incident tasks</span>
                  <strong>{safeOpenTaskCount}</strong>
                </ListGroup.Item>
                {operationalInsight && (
                  <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                    <span>Overdue tasks</span>
                    <strong>{operationalInsight.overdueTaskCount}</strong>
                  </ListGroup.Item>
                )}
                {operationalInsight && (
                  <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                    <span>Task activity (24h)</span>
                    <strong>{operationalInsight.taskActivity24hCount} (Δ {formatDelta(operationalInsight.taskActivity24hDelta)})</strong>
                  </ListGroup.Item>
                )}
                {operationalInsight && (
                  <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                    <span>Resource requests requiring action</span>
                    <strong>{Math.max(0, operationalInsight.resourceRequestCount - (operationalInsight.openTaskCount - operationalInsight.overdueTaskCount))}</strong>
                  </ListGroup.Item>
                )}
              </ListGroup>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="2">
            <Accordion.Header>Communications</Accordion.Header>
            <Accordion.Body>
              <div className="small text-muted mb-2">{communicationsInsight}</div>
              <div className="small text-muted mb-2">{sitrepInsight}</div>
              <div className="small text-muted mb-2">{communicationsActionSignal}</div>
              <ListGroup variant="flush">
                <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                  <span>Communication log entries</span>
                  <strong>{safeCommunicationCount}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                  <span>Situation reports</span>
                  <strong>{safeSitrepCount}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                  <span>Timeline events</span>
                  <strong>{safeTimelineEventCount}</strong>
                </ListGroup.Item>
                {operationalInsight && (
                  <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                    <span>Communications (24h)</span>
                    <strong>{operationalInsight.communicationActivity24hCount} (Δ {formatDelta(operationalInsight.communicationActivity24hDelta)})</strong>
                  </ListGroup.Item>
                )}
                {operationalInsight && (
                  <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                    <span>Latest timeline update</span>
                    <strong>
                      {operationalInsight.latestTimelineUtc
                        ? new Date(operationalInsight.latestTimelineUtc).toLocaleString()
                        : '—'}
                    </strong>
                  </ListGroup.Item>
                )}
                {operationalInsight && (
                  <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                    <span>SITREP staleness</span>
                    <strong>{operationalInsight.staleSitrepHours === null ? 'No SITREP' : `${operationalInsight.staleSitrepHours}h`}</strong>
                  </ListGroup.Item>
                )}
                {operationalInsight && (
                  <ListGroup.Item className="px-0 py-1 small d-flex justify-content-between">
                    <span>Needs-attention reasons</span>
                    <strong>{operationalInsight.needsAttentionReasons.length}</strong>
                  </ListGroup.Item>
                )}
              </ListGroup>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Card.Body>
    </Card>
  );
}

export default IncidentWorkspaceCard;
