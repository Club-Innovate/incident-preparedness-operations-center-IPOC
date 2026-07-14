import { Badge, Button, Card } from 'react-bootstrap';
import IconActionButton from '../common/IconActionButton';

type NavigationPaneCardProps = {
  navigationExpanded: boolean;
  activeView: 'dashboard' | 'incidents' | 'facilities' | 'reports' | 'cop' | 'operations' | 'planning' | 'logistics' | 'finance' | 'after-action';
  incidentCount: number;
  operationsOpenTaskCount: number;
  planningSitrepCount: number;
  logisticsResourceRequestCount: number;
  financeActiveIncidentCount: number;
  afterActionClosedIncidentCount: number;
  alertCount: number;
  onToggleNavigation: () => void;
  onStartResize: (clientX: number) => void;
  onNavigate: (view: 'dashboard' | 'incidents' | 'facilities' | 'reports' | 'cop' | 'operations' | 'planning' | 'logistics' | 'finance' | 'after-action') => void;
  onOpenAlertCenter: () => void;
};

function NavigationPaneCard({
  navigationExpanded,
  activeView,
  incidentCount,
  operationsOpenTaskCount,
  planningSitrepCount,
  logisticsResourceRequestCount,
  financeActiveIncidentCount,
  afterActionClosedIncidentCount,
  alertCount,
  onToggleNavigation,
  onStartResize,
  onNavigate,
  onOpenAlertCenter,
}: NavigationPaneCardProps) {
  const renderMetricBadge = (value: number, label: string) => {
    if (!navigationExpanded || value <= 0) {
      return null;
    }

    return (
      <Badge
        bg="secondary"
        pill
        className="ms-auto nav-pane-metric-badge"
        title={`${label}: ${value}`}
        aria-label={`${label}: ${value}`}
      >
        {value}
      </Badge>
    );
  };

  return (
    <Card className={`h-100 shadow-sm nav-pane-card ${navigationExpanded ? 'nav-pane-expanded' : 'nav-pane-collapsed'}`}>
      <Card.Header className="fw-semibold d-flex align-items-center justify-content-between">
        <div className="nav-pane-header-block">
          <span className={navigationExpanded ? 'nav-pane-title' : 'visually-hidden'}>Navigation</span>
          {navigationExpanded && <span className="nav-pane-subtitle">Workspaces</span>}
        </div>
        <IconActionButton
          iconClassName={`bi ${navigationExpanded ? 'bi-chevron-left' : 'bi-chevron-right'}`}
          tooltip={navigationExpanded ? 'Collapse navigation pane' : 'Expand navigation pane'}
          ariaLabel={navigationExpanded ? 'Collapse navigation pane' : 'Expand navigation pane'}
          onClick={onToggleNavigation}
        />
      </Card.Header>
      <Card.Body className={`nav-pane-body ${navigationExpanded ? 'expanded' : 'collapsed'}`}>
        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'dashboard' ? 'active' : ''}`}
          title="Open Dashboard workspace (hotkey: g then d)"
          aria-label="Dashboard"
          onClick={() => onNavigate('dashboard')}
        >
          <i className="bi bi-speedometer2" aria-hidden="true" />
          {navigationExpanded && <span>Dashboard</span>}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'incidents' ? 'active' : ''}`}
          title="Open Incidents workspace (hotkey: g then i)"
          aria-label="Incidents"
          onClick={() => onNavigate('incidents')}
        >
          <i className="bi bi-card-list" aria-hidden="true" />
          {navigationExpanded && <span>Incidents</span>}
          {renderMetricBadge(incidentCount, 'Incidents count')}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'facilities' ? 'active' : ''}`}
          title="Open Facilities workspace (hotkey: g then f)"
          aria-label="Facilities"
          onClick={() => onNavigate('facilities')}
        >
          <i className="bi bi-hospital" aria-hidden="true" />
          {navigationExpanded && <span>Facilities</span>}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'reports' ? 'active' : ''}`}
          title="Open Reports workspace (hotkey: g then r)"
          aria-label="Reports"
          onClick={() => onNavigate('reports')}
        >
          <i className="bi bi-bar-chart" aria-hidden="true" />
          {navigationExpanded && <span>Reports</span>}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'cop' ? 'active' : ''}`}
          title="Open Common Operating Picture workspace (hotkey: g then c)"
          aria-label="Common Operating Picture"
          onClick={() => onNavigate('cop')}
        >
          <i className="bi bi-globe-americas" aria-hidden="true" />
          {navigationExpanded && <span>Common Operating Picture</span>}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'operations' ? 'active' : ''}`}
          title="Open Operations Coordination workspace (hotkey: g then o)"
          aria-label="Operations"
          onClick={() => onNavigate('operations')}
        >
          <i className="bi bi-diagram-3" aria-hidden="true" />
          {navigationExpanded && <span>Operations</span>}
          {renderMetricBadge(operationsOpenTaskCount, 'Operations open tasks')}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'planning' ? 'active' : ''}`}
          title="Open Planning Cycle workspace (hotkey: g then p)"
          aria-label="Planning"
          onClick={() => onNavigate('planning')}
        >
          <i className="bi bi-journal-text" aria-hidden="true" />
          {navigationExpanded && <span>Planning</span>}
          {renderMetricBadge(planningSitrepCount, 'Planning SITREP count')}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'logistics' ? 'active' : ''}`}
          title="Open Logistics Coordination workspace (hotkey: g then l)"
          aria-label="Logistics"
          onClick={() => onNavigate('logistics')}
        >
          <i className="bi bi-truck" aria-hidden="true" />
          {navigationExpanded && <span>Logistics</span>}
          {renderMetricBadge(logisticsResourceRequestCount, 'Logistics resource requests')}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'finance' ? 'active' : ''}`}
          title="Open Finance and Administration workspace (hotkey: g then n)"
          aria-label="Finance and Administration"
          onClick={() => onNavigate('finance')}
        >
          <i className="bi bi-cash-coin" aria-hidden="true" />
          {navigationExpanded && <span>Finance & Administration</span>}
          {renderMetricBadge(financeActiveIncidentCount, 'Finance active incidents')}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'} ${activeView === 'after-action' ? 'active' : ''}`}
          title="Open After Action workspace (hotkey: g then a)"
          aria-label="After Action"
          onClick={() => onNavigate('after-action')}
        >
          <i className="bi bi-clipboard2-data" aria-hidden="true" />
          {navigationExpanded && <span>After Action</span>}
          {renderMetricBadge(afterActionClosedIncidentCount, 'After Action closed incidents')}
        </Button>

        <Button
          variant="light"
          className={`nav-pane-btn ${navigationExpanded ? 'expanded' : 'collapsed'}`}
          title="Open Alert Center panel (hotkey: g then z)"
          aria-label="Alerts"
          onClick={onOpenAlertCenter}
        >
          <i className="bi bi-exclamation-triangle" aria-hidden="true" />
          {navigationExpanded && <span>Alerts</span>}
          {renderMetricBadge(alertCount, 'Alerts count')}
        </Button>
      </Card.Body>
      {navigationExpanded && (
        <div
          className="nav-pane-resize-handle"
          role="separator"
          aria-label="Resize navigation pane"
          aria-orientation="vertical"
          title="Drag to resize navigation pane"
          onMouseDown={(event) => onStartResize(event.clientX)}
        />
      )}
    </Card>
  );
}

export default NavigationPaneCard;
