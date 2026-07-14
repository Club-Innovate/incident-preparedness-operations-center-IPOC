# Dashboard and Reports User Manual

## Purpose
This guide explains how to use the Dashboard and Reports analytics workspaces, which visualization types are currently supported, how to use prompt-driven generation, and how color palettes are customized and persisted.

## 1) Dashboard Workspace (Operational Snapshot)

### What it is for
Dashboard focuses on fast operational posture snapshots (incident load, readiness, compliance, maturity, and posture trends).

### Dashboard visualization/widget types currently supported
- Operational load KPIs (`kpi-load`)
- Readiness gauge (`gauge-readiness`)
- NIMS compliance gauge (`gauge-compliance`)
- Maturity gauge (`gauge-maturity`)
- Posture bar plot (`bar-posture`)

### How to use Dashboard
1. Open the Dashboard card.
2. Expand the Dashboard rail if collapsed.
3. Apply one-click templates (Executive, Operations, Compliance, Briefing, Resilience, Recovery).
4. Reorder widgets in **Canvas order**.
5. Save favorites with a template name.
6. Use **Agent visualization prompt** to add/replace widgets from natural-language intent.

## 2) Reports Workspace (Ad-Hoc Analytics)

### What it is for
Reports focuses on analytical exploration and governance trends across incident and provider-health data.

### Reports visualization/widget types currently supported
- Governance posture KPI (`kpi-governance-posture`)
- Temporal incident volume line chart (`line-volume`)
- Success vs failure trend line chart (`line-success-vs-failure`)
- Failure-rate area trend (`area-failure-trend`)
- Provider risk scatter plot (`scatter-provider-risk`)
- Provider failure-rate bar ranking (`bar-provider-failure-rate`)

### Additional chart surfaces already present in Reports
- Incident group bar chart (status/type grouping)
- Severity distribution pie chart
- Provider governance trend charts (line/area/scatter/bar)
- AG Grid tabular breakdown with chart drilldown integration

### How to use Reports
1. Set filters: time window, group-by, status, and type.
2. Review KPI badges/cards and drill into charts.
3. Expand the Reports template rail.
4. Apply templates (Executive, Risk, Volume; Governance, Surveillance, Capacity).
5. Reorder/remove widgets in the analytics canvas.
6. Use **Agent visualization prompt** to append/replace generated widgets.

## 3) Visualization Colors (Pastel + Custom)

### Default behavior
- Dashboard and Reports now use pastel-first chart colors by default.

### User customization
- Each workspace includes **Visualization palette** controls.
- You can edit core chart colors (primary, secondary, critical, warning, success, neutral).
- Click **Save palette** to persist to backend (user-scoped) with local fallback.
- Click **Reset pastel** to restore the default pastel set.

### Persistence details
- Palette preferences are persisted via report-preset scopes:
  - `dashboard-visualization-palette-v1`
  - `reports-visualization-palette-v1`
- Existing generated visualization spec scopes remain:
  - `dashboard-generated-visualization-specs-v1`
  - `reports-generated-visualization-specs-v1`

## 4) Prompting Guide for Dashboard and Reports

### Current prompt engine behavior
Prompt parsing is currently deterministic/rule-based in:
- `frontend/src/components/layout/visualizationPrompt.ts`

It extracts:
- intent keywords
- preferred chart types
- top N
- threshold percent
- time grain (hour/day/week/month)
- grouping (status/type/provider/severity)

### Example prompts for Dashboard
- "Add readiness gauge and posture bar plot"
- "Executive briefing dashboard with KPI, readiness, and compliance"
- "Show resilience posture with maturity and compliance"
- "Recovery view with readiness and posture"
- "Compare incident load and task pressure"

### Example prompts for Reports
- "Show governance surveillance for provider failures over last week"
- "Top 5 providers by failure rate with bar chart"
- "Area trend for failure rate with threshold 20%"
- "Line chart for success vs failure by day"
- "Scatter provider risk by failure rate and total volume"
- "Executive governance overview with KPI and trend charts"
- "Capacity throughput analysis with volume and outcome trends"

## 5) Q&A: Azure OpenAI / Azure AI Search Consistency

### Q: Are Dashboard/Reports visualization prompts currently using Azure OpenAI + Azure AI Search?
Short answer: **Not for visualization parsing today**.

The current Dashboard/Reports visualization prompt path is local deterministic parsing (`generateVisualizationSpec(...)`), then persisted generated-spec JSON is applied to the canvas.

### Q: How is consistency maintained with the Agent/chatbot?
Current consistency approach:
1. Shared visualization contract (`VisualizationSpec`) with explicit versioning (`schemaVersion`, `specVersion`).
2. Shared parser/normalization (`parseVisualizationSpecJson(...)`) across Dashboard and Reports.
3. Backend validation + normalization on generated-spec write scopes.

Recommended production convergence path:
- Keep this deterministic parser as a strict fallback/guardrail.
- Introduce a server-side canonical visualization planning endpoint used by both:
  - Dashboard/Reports prompt actions
  - Agent/chatbot visualization responses
- Ensure both channels emit the same `VisualizationSpec` schema and persistence semantics.

## 6) AI Incident Co-Pilot Administration Access

### How to enable Administration controls in the Co-Pilot panel
Administration controls in the Co-Pilot personalization panel are enabled when either of these is true:
- Your authenticated role list includes an admin role (for example: `SYSTEM_ADMIN`, `KDHE_ADMIN`, `INCIDENT_COMMANDER`, `LOOKUP_ADMIN`, `DATA_OPS_ADMIN`, `ADMIN`, `ADMINISTRATOR`).
- Backend personalization policy state returns `canManagePolicy = true` for your user.

### How to add yourself or another admin
1. Assign one of the recognized admin roles in your identity provider / app role assignment flow.
2. Sign out and sign back in so `/api/v1/auth/me` returns the updated role claims.
3. Open AI Incident Co-Pilot -> Personalization -> Administration section and verify controls are no longer locked.
4. If roles are present but controls are still locked, confirm backend policy endpoint response includes `canManagePolicy = true` for the user.

## 7) AI Incident Co-Pilot Personalization Persistence

Co-Pilot personalization (theme/colors/avatar/font/shadow/governance toggles) persists automatically via:
- immediate local preference durability (`ipoc.agent.dock.preferences.v1`)
- dock state persistence (`ipoc.agent.dock.state`)
- server profile sync (`agent-assistant-preferences` preset scope) when authenticated

Persistence is flushed when you change preferences, when the dock closes, and before page unload/refresh.

## 8) Production Readiness Checklist (Analytics-specific)
- Deterministic fallback parser remains available.
- Generated-spec schema versioning and validation are active.
- Legacy generated-spec migration path is enabled.
- Palette customization persists with local/server durability.
- Prompt examples are documented for operators and analysts.
- Convergence plan defined for Agent + analytics consistency.
