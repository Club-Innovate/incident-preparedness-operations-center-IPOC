# Reporting and Analytics Documentation

## Current Reporting Features

### Interactive Incident Analytics Card
Location: `frontend/src/components/layout/InteractiveIncidentAnalyticsCard.tsx`

Capabilities:
- Filter by incident status
- Filter by incident type
- Filter by incident severity
- Free-text search on incident number/name/type/status
- Grouping modes:
  - Group by Status
  - Group by Type
  - Group by Severity
  - Group by Month
- KPI chips for filtered datasets:
  - Total records
  - Active records
  - Created in last 24 hours
- Distribution table with in-row bars
- CSV export for grouped view

### Facilities Analytics and Drilldown
Locations:
- `frontend/src/components/resources/FacilitiesCapacityAnalyticsCard.tsx`
- `frontend/src/components/resources/FacilitiesTrendDrilldownCard.tsx`

Capabilities:
- Capacity/utilization KPIs with location/resource grouping
- At-risk facilities highlighting based on occupancy and resource availability thresholds
- Location-based trend mini-chart for bed metrics
- Constraint drilldown table by resource type
- CSV export for:
  - grouped facilities capacity data
  - trend data
  - resource constraint data

### Dashboard Summary Endpoint
Backend endpoint: `GET /api/v1/incidents/dashboard-summary`

Payload currently includes:
- Total incident count
- Active incident count
- Open task count
- Overdue task count
- Open objective count
- Latest SITREP timestamp
- SITREP count in last 24 hours

## Planned Reporting Enhancements (Next Iteration)

### Embedded BI Integration
- Add Power BI Embedded report host component
- Add report metadata model for selecting embedded reports
- Add environment-based config for embed URLs/report IDs/workspace IDs
- Add role-aware report visibility

### Advanced Ad-Hoc Reporting
- Add report builder UI for selecting dimensions/metrics
- Add pivot/grouping controls
- Add date windowing and incident scope filters
- Add saved report definitions per user/role

### Visualization Library Expansion
Candidate OSS libraries:
- Apache ECharts (rich interactions and theming)
- Plotly.js (ad-hoc analytics and export options)
- AG Grid charts (if tabular analytics expands)

Selection criteria:
- Accessibility
- Themeability
- Export support (PNG/SVG/CSV)
- Performance with larger datasets

## Current Theme Support

### Theme Studio
Location: `frontend/src/components/layout/ThemeCustomizerModal.tsx`

Capabilities:
- Prebuilt themes available immediately
- Custom theme builder with color palette controls
- Theme persistence in browser local storage
- Runtime application through CSS variables

Prebuilt themes currently included:
- Classic Dark
- Pastel Dawn
- Frosted Command
- Sunset Ops

## Revisit Checklist

When revisiting reporting:
1. Confirm whether Power BI Embedded is required for this sprint
2. Confirm tenant/workspace/report IDs and embedding security model
3. Decide whether to standardize on one OSS charting library
4. Define first set of executive/operations report templates
5. Add server-side filtered aggregate endpoints to support ad-hoc drilldown performance

## Implementation Note: Theme Persistence Strategy

Current state:
- Theme selection is persisted in browser local storage for fast client-side restore.

Planned enhancement:
- Persist user theme selection in IOCEM database profile tables so preferences roam across devices and browsers.
- Continue using local storage as warm cache/fallback for startup responsiveness and offline tolerance.

Planned sync flow:
1. On sign-in, fetch server-side saved theme for authenticated user.
2. Apply server theme and refresh local storage cache.
3. On user theme change, write to server and local storage in the same action.
4. If server read/write fails, continue with local cache and log telemetry for retry.

## Facilities Report Preset Persistence

Status:
- Implemented hybrid preset persistence for facilities analytics presets:
  - server persistence in IOCEM (`app.UserReportPreset`)
  - local storage fallback cache

API endpoints:
- `GET /api/v1/resources/report-presets/{presetScope}`
- `POST /api/v1/resources/report-presets/{presetScope}`
- `DELETE /api/v1/resources/report-presets/{presetScope}/{userReportPresetId}`

Preset scope currently used:
- `facilities-capacity-v1`

Database migration script:
- `KPP_WEB.AppHost/planning/KDHE_Custom_IOC_EM_User_Report_Preset_Migration.sql`
