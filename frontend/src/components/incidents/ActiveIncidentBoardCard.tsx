import { Badge, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import type { IncidentSummary } from '../../types';

type ActiveIncidentBoardCardProps = {
  incidentSearchText: string;
  incidentStatusFilter: string;
  incidentStatusFilterOptions: string[];
  incidentsLoading: boolean;
  isAuthenticated: boolean;
  incidentsError: string | null;
  incidents: IncidentSummary[];
  filteredIncidents: IncidentSummary[];
  selectedIncidentId: number | null;
  setIncidentSearchText: (value: string) => void;
  setIncidentStatusFilter: (value: string) => void;
  setSelectedIncidentId: (value: number) => void;
};

function ActiveIncidentBoardCard({
  incidentSearchText,
  incidentStatusFilter,
  incidentStatusFilterOptions,
  incidentsLoading,
  isAuthenticated,
  incidentsError,
  incidents,
  filteredIncidents,
  selectedIncidentId,
  setIncidentSearchText,
  setIncidentStatusFilter,
  setSelectedIncidentId,
}: ActiveIncidentBoardCardProps) {
  return (
    <Card className="shadow-sm mb-3">
      <Card.Header className="fw-semibold">Active Incident Board</Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3">
          <Col md={7}>
            <Form.Control
              value={incidentSearchText}
              onChange={(event) => setIncidentSearchText(event.target.value)}
              placeholder="Search by number, name, or type"
            />
          </Col>
          <Col md={5}>
            <Form.Select value={incidentStatusFilter} onChange={(event) => setIncidentStatusFilter(event.target.value)}>
              {incidentStatusFilterOptions.map((statusCode) => (
                <option key={statusCode} value={statusCode}>{statusCode}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>

        {incidentsLoading && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span>Loading incidents...</span>
          </div>
        )}

        {!incidentsLoading && !isAuthenticated && (
          <div className="text-muted small">Sign in to load protected incidents.</div>
        )}

        {!incidentsLoading && isAuthenticated && !incidentsError && incidents.length === 0 && (
          <div className="text-muted small">No incidents found. Create or import incidents to populate this board.</div>
        )}

        {!incidentsLoading && !incidentsError && incidents.length > 0 && filteredIncidents.length === 0 && (
          <div className="text-muted small">No incidents match the current filters.</div>
        )}

        {!incidentsLoading && filteredIncidents.length > 0 && (
          <Row className="g-2">
            {filteredIncidents.map((incident) => (
              <Col xl={3} lg={4} md={6} key={incident.incidentId}>
                <Card
                  className={`h-100 ipoc-active-incident-tile ${selectedIncidentId === incident.incidentId ? 'border-primary ipoc-active-incident-tile-selected' : ''}`}
                  role="button"
                  onClick={() => setSelectedIncidentId(incident.incidentId)}
                >
                  <Card.Body>
                    <div className="fw-semibold">{incident.incidentNumber}</div>
                    <div>{incident.incidentName}</div>
                    <div className="text-muted small">{incident.incidentTypeCode}</div>
                    <Badge bg={incident.incidentStatusCode === 'Active' ? 'success' : 'secondary'} className="mt-2 ipoc-active-incident-tile-status-badge">
                      {incident.incidentStatusCode}
                    </Badge>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card.Body>
    </Card>
  );
}

export default ActiveIncidentBoardCard;
