import { Card, Col, Form, Row } from 'react-bootstrap';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import type { LocationLookupValue, LookupValue } from '../../types';

type CreateIncidentCardProps = {
  incidentCreateNumber: string;
  incidentCreateName: string;
  incidentCreateTypeCode: string;
  incidentCreateSeverity: string;
  incidentCreatePrimaryLocationId: string;
  incidentCreateSummary: string;
  incidentCreatePlanned: boolean;
  incidentTypeLookups: LookupValue[];
  incidentSeverityLookups: LookupValue[];
  locationLookups: LocationLookupValue[];
  incidentActionLoading: boolean;
  isAuthenticated: boolean;
  setIncidentCreateNumber: (value: string) => void;
  setIncidentCreateName: (value: string) => void;
  setIncidentCreateTypeCode: (value: string) => void;
  setIncidentCreateSeverity: (value: string) => void;
  setIncidentCreatePrimaryLocationId: (value: string) => void;
  setIncidentCreateSummary: (value: string) => void;
  setIncidentCreatePlanned: (value: boolean) => void;
  onCreateIncident: () => void;
};

function CreateIncidentCard({
  incidentCreateNumber,
  incidentCreateName,
  incidentCreateTypeCode,
  incidentCreateSeverity,
  incidentCreatePrimaryLocationId,
  incidentCreateSummary,
  incidentCreatePlanned,
  incidentTypeLookups,
  incidentSeverityLookups,
  locationLookups,
  incidentActionLoading,
  isAuthenticated,
  setIncidentCreateNumber,
  setIncidentCreateName,
  setIncidentCreateTypeCode,
  setIncidentCreateSeverity,
  setIncidentCreatePrimaryLocationId,
  setIncidentCreateSummary,
  setIncidentCreatePlanned,
  onCreateIncident,
}: CreateIncidentCardProps) {
  return (
    <Card className="shadow-sm mb-3">
      <Card.Header className="fw-semibold">Create Incident</Card.Header>
      <Card.Body>
        <Row className="g-2 align-items-start mb-2">
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Incident Number" info="Unique incident identifier used for dispatch and reporting." /></Form.Label>
            <Form.Control
              value={incidentCreateNumber}
              onChange={(event) => setIncidentCreateNumber(event.target.value)}
              placeholder="e.g. INC-2026-001"
            />
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Incident Name" info="Operational display name for this incident record." /></Form.Label>
            <Form.Control
              value={incidentCreateName}
              onChange={(event) => setIncidentCreateName(event.target.value)}
              placeholder="Incident name"
            />
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Incident Type" info="Classification code used for incident workflow and reporting." /></Form.Label>
            <Form.Select
              value={incidentCreateTypeCode}
              onChange={(event) => setIncidentCreateTypeCode(event.target.value)}
            >
              {incidentTypeLookups.map((item) => (
                <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Severity" info="Optional impact level used for prioritization and executive reporting." /></Form.Label>
            <Form.Select
              value={incidentCreateSeverity}
              onChange={(event) => setIncidentCreateSeverity(event.target.value)}
            >
              <option value="">Optional</option>
              {incidentSeverityLookups.map((item) => (
                <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Primary Location" info="Primary location for incident command; sets Lead Organization and Region automatically." /></Form.Label>
            <Form.Select
              value={incidentCreatePrimaryLocationId}
              onChange={(event) => setIncidentCreatePrimaryLocationId(event.target.value)}
            >
              {locationLookups.map((location) => (
                <option key={location.locationId} value={location.locationId}>{location.displayText}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>

        <Row className="g-2 align-items-stretch">
          <Col md={8}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Initial Summary" info="Initial incident narrative for situational awareness and handoff context." /></Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={incidentCreateSummary}
              onChange={(event) => setIncidentCreateSummary(event.target.value)}
              placeholder="Operational summary (optional)"
            />
          </Col>
          <Col md={4}>
            <div className="d-flex justify-content-between align-items-end h-100 w-100">
              <Form.Check
                id="is-planned-event"
                type="checkbox"
                label="Planned Event"
                className="mb-0"
                checked={incidentCreatePlanned}
                onChange={(event) => setIncidentCreatePlanned(event.target.checked)}
              />
              <IconActionButton
                iconClassName={incidentActionLoading ? 'bi bi-arrow-repeat' : 'bi bi-plus-circle'}
                tooltip="Create a new incident using the current number, type, location, and summary values."
                ariaLabel="Create incident"
                onClick={onCreateIncident}
                variant="outline-secondary"
                className="create-incident-action-btn"
                disabled={incidentActionLoading || !isAuthenticated}
              />
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

export default CreateIncidentCard;
