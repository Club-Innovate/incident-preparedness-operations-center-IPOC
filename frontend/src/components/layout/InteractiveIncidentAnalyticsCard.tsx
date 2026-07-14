import { useMemo, useState } from 'react';
import { Badge, Card, Col, Form, Row } from 'react-bootstrap';
import type { ColDef } from 'ag-grid-community';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import IpocDataGrid from '../common/IpocDataGrid';
import type { IncidentSummary, LookupValue } from '../../types';

type GroupByOption = 'status' | 'type' | 'severity' | 'month';

type InteractiveIncidentAnalyticsCardProps = {
  incidents: IncidentSummary[];
  incidentStatusLookups: LookupValue[];
  incidentTypeLookups: LookupValue[];
  incidentSeverityLookups: LookupValue[];
};

function formatMonthLabel(monthValue: string): string {
  if (monthValue.length !== 7) {
    return monthValue;
  }

  const [yearText, monthText] = monthValue.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthValue;
  }

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function InteractiveIncidentAnalyticsCard({
  incidents,
  incidentStatusLookups,
  incidentTypeLookups,
  incidentSeverityLookups,
}: InteractiveIncidentAnalyticsCardProps) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [searchFilter, setSearchFilter] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByOption>('status');

  const statusLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    incidentStatusLookups.forEach((item) => map.set(item.code, item.displayName));
    return map;
  }, [incidentStatusLookups]);

  const typeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    incidentTypeLookups.forEach((item) => map.set(item.code, item.displayName));
    return map;
  }, [incidentTypeLookups]);

  const severityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    incidentSeverityLookups.forEach((item) => map.set(item.code, item.displayName));
    return map;
  }, [incidentSeverityLookups]);

  const filteredIncidents = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase();

    return incidents.filter((incident) => {
      const statusMatch = statusFilter === 'All' || incident.incidentStatusCode === statusFilter;
      const typeMatch = typeFilter === 'All' || incident.incidentTypeCode === typeFilter;
      const severityMatch = severityFilter === 'All' || (incident.severityCode ?? '') === severityFilter;
      const searchMatch =
        normalizedSearch.length === 0
        || incident.incidentNumber.toLowerCase().includes(normalizedSearch)
        || incident.incidentName.toLowerCase().includes(normalizedSearch)
        || incident.incidentTypeCode.toLowerCase().includes(normalizedSearch)
        || incident.incidentStatusCode.toLowerCase().includes(normalizedSearch);

      return statusMatch && typeMatch && severityMatch && searchMatch;
    });
  }, [incidents, searchFilter, severityFilter, statusFilter, typeFilter]);

  const groupedData = useMemo(() => {
    const counts = new Map<string, number>();

    filteredIncidents.forEach((incident) => {
      const key = (() => {
        switch (groupBy) {
          case 'status':
            return incident.incidentStatusCode;
          case 'type':
            return incident.incidentTypeCode;
          case 'severity':
            return incident.severityCode ?? 'Unspecified';
          case 'month':
            return incident.createdUtc.slice(0, 7);
          default:
            return 'Unknown';
        }
      })();

      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const rows = Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

    return rows;
  }, [filteredIncidents, groupBy]);

  const maxGroupCount = useMemo(() => {
    if (groupedData.length === 0) {
      return 1;
    }

    return Math.max(...groupedData.map((item) => item.count));
  }, [groupedData]);

  const activeCount = useMemo(
    () => filteredIncidents.filter((incident) => incident.incidentStatusCode !== 'Closed').length,
    [filteredIncidents],
  );

  const recent24hCount = useMemo(() => {
    const nowMs = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;

    return filteredIncidents.filter((incident) => {
      const createdMs = Date.parse(incident.createdUtc);
      return Number.isFinite(createdMs) && nowMs - createdMs <= windowMs;
    }).length;
  }, [filteredIncidents]);

  const groupedCsv = useMemo(() => {
    const lines = ['Group,Count'];
    groupedData.forEach((row) => {
      const safeLabel = row.key.replace(/"/g, '""');
      lines.push(`"${safeLabel}",${row.count}`);
    });

    return lines.join('\n');
  }, [groupedData]);

  const resolveLabel = (value: string): string => {
    if (groupBy === 'status') {
      return statusLabelMap.get(value) ?? value;
    }

    if (groupBy === 'type') {
      return typeLabelMap.get(value) ?? value;
    }

    if (groupBy === 'severity') {
      return severityLabelMap.get(value) ?? value;
    }

    if (groupBy === 'month') {
      return formatMonthLabel(value);
    }

    return value;
  };

  const gridRows = groupedData.map((row, index) => {
    const widthPercent = Math.round((row.count / maxGroupCount) * 100);
    return {
      id: `${groupBy}-${row.key}`,
      group: resolveLabel(row.key),
      distribution: `${widthPercent}%`,
      count: row.count,
      rank: index + 1,
    };
  });

  const gridColumnDefs: ColDef<{ id: string; group: string; distribution: string; count: number; rank: number }>[] = [
    {
      field: 'rank',
      headerName: '#',
      width: 70,
      minWidth: 60,
      maxWidth: 90,
      type: 'numericColumn',
    },
    {
      field: 'group',
      headerName: 'Group',
      flex: 2,
      minWidth: 180,
    },
    {
      field: 'distribution',
      headerName: 'Distribution',
      flex: 1,
      minWidth: 140,
    },
    {
      field: 'count',
      headerName: 'Count',
      flex: 1,
      minWidth: 120,
      sort: 'desc',
      type: 'numericColumn',
      cellClass: 'text-end fw-semibold',
    },
  ];

  return (
    <Card className="shadow-sm h-100">
      <Card.Body>
        <div className="analytics-shell">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="fw-semibold">Interactive Incident Analytics</div>
          <IconActionButton
            iconClassName="bi bi-download"
            tooltip="Export grouped analytics results to CSV"
            ariaLabel="Export analytics CSV"
            onClick={() => downloadCsv('incident-analytics-grouped.csv', groupedCsv)}
            disabled={groupedData.length === 0}
          />
        </div>

        <Row className="g-2 mb-3">
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Status" info="Filter incidents by status code." /></Form.Label>
            <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All statuses</option>
              {incidentStatusLookups.map((item) => (
                <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Type" info="Filter incidents by incident type." /></Form.Label>
            <Form.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="All">All types</option>
              {incidentTypeLookups.map((item) => (
                <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Severity" info="Filter incidents by assigned severity." /></Form.Label>
            <Form.Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="All">All severity</option>
              {incidentSeverityLookups.map((item) => (
                <option key={item.codeValueId} value={item.code}>{item.displayName}</option>
              ))}
              <option value="">Unspecified</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small mb-1"><LabelWithInfo text="Search" info="Search by incident number, name, type, or status." /></Form.Label>
            <Form.Control
              value={searchFilter}
              placeholder="Search incident number/name"
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </Col>
        </Row>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex gap-2">
            <IconActionButton
              iconClassName="bi bi-list-check"
              tooltip="Group analytics by status"
              ariaLabel="Group by status"
              onClick={() => setGroupBy('status')}
              variant={groupBy === 'status' ? 'secondary' : 'outline-secondary'}
            />
            <IconActionButton
              iconClassName="bi bi-tags"
              tooltip="Group analytics by type"
              ariaLabel="Group by type"
              onClick={() => setGroupBy('type')}
              variant={groupBy === 'type' ? 'secondary' : 'outline-secondary'}
            />
            <IconActionButton
              iconClassName="bi bi-exclamation-diamond"
              tooltip="Group analytics by severity"
              ariaLabel="Group by severity"
              onClick={() => setGroupBy('severity')}
              variant={groupBy === 'severity' ? 'secondary' : 'outline-secondary'}
            />
            <IconActionButton
              iconClassName="bi bi-calendar3"
              tooltip="Group analytics by month"
              ariaLabel="Group by month"
              onClick={() => setGroupBy('month')}
              variant={groupBy === 'month' ? 'secondary' : 'outline-secondary'}
            />
          </div>
          <div className="small text-muted">Filtered records: {filteredIncidents.length}</div>
        </div>

        <div className="d-flex flex-wrap gap-2 mb-3">
          <Badge bg="secondary">Total: {filteredIncidents.length}</Badge>
          <Badge bg="primary">Active: {activeCount}</Badge>
          <Badge bg="danger">Created (24h): {recent24hCount}</Badge>
        </div>

        <IpocDataGrid
          gridId="interactive-incident-analytics-grouped"
          rowData={gridRows}
          columnDefs={gridColumnDefs}
          emptyMessage="No records match the selected filters."
          pageSize={25}
        />
        </div>
      </Card.Body>
    </Card>
  );
}

export default InteractiveIncidentAnalyticsCard;
