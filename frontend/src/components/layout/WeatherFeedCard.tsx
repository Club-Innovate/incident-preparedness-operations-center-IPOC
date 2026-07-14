import { Badge, Card, Col, Row } from 'react-bootstrap';
import type { WeatherForecast } from '../../types';

type WeatherFeedCardProps = {
  weather: WeatherForecast[];
};

function WeatherFeedCard({ weather }: WeatherFeedCardProps) {
  if (weather.length === 0) {
    return (
      <Card className="shadow-sm">
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="fw-semibold">Weather Operational Feed</div>
          <Badge bg="warning" text="dark">Live unavailable</Badge>
        </Card.Header>
        <Card.Body>
          <div className="small text-muted">
            Live weather is unavailable for the current incident/location context. Select an incident with resolvable location coordinates or update the Admin default weather location.
          </div>
        </Card.Body>
      </Card>
    );
  }

  const locationLabel = weather.find((item) => item.locationLabel && item.locationLabel.trim().length > 0)?.locationLabel?.trim() ?? 'Context unresolved';
  const sourceLabel = weather.find((item) => item.source && item.source.trim().length > 0)?.source?.trim();

  return (
    <Card className="shadow-sm">
      <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="fw-semibold">
          Weather Operational Feed
          <span className="ms-2 text-muted fw-normal">({locationLabel})</span>
        </div>
        {sourceLabel && (
          <Badge bg="secondary">{sourceLabel}</Badge>
        )}
      </Card.Header>
      <Card.Body>
        <Row className="g-2">
          {weather.map((item) => (
            <Col lg={3} md={4} sm={6} key={item.date}>
              <Card className="h-100 bg-light">
                <Card.Body>
                  <div className="fw-semibold">{new Date(item.date).toLocaleDateString()}</div>
                  <div>{item.summary}</div>
                  <Badge bg="info" className="mt-2">{item.temperatureF}°F / {item.temperatureC}°C</Badge>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Card.Body>
    </Card>
  );
}

export default WeatherFeedCard;
