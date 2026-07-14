# Navigation Acceptance Criteria (RFP-Aligned)

## Purpose
Define implementation-ready acceptance criteria for each navigation page/container and cross-cutting trust controls.

## Preconditions (all pages)
1. User authentication state is explicit (authenticated, degraded, unauthenticated).
2. Authorization failures return ProblemDetails with trace ID and non-sensitive message.
3. Loading, empty, and error states are visible and actionable (retry where appropriate).
4. Every data mutation path emits an auditable event.
5. No PHI/patient tracking data is rendered or persisted in app workflows.

---

## 1) Dashboard Container
Components: `DashboardSnapshotCard`, `InteractiveIncidentAnalyticsCard`, `ResourcePostureCard`, `WeatherFeedCard`

### Acceptance Criteria
- Displays incident, task, timeline, and readiness KPIs from live API data.
- Supports operational filtering/grouping without page reload.
- Presents degraded/read-fallback status visibly to operators.
- Supports export actions where exposed and logs export actions to audit event store.
- Fails safely: if one card fails, other cards remain usable and a scoped error is shown.

### RFP Coverage Targets
- C4 multi-incident visibility baseline.
- A5/D6 operability indicators.
- C1/F2 export evidence baseline.

---

## 2) Incidents Container
Components: `IncidentWorkspaceCard`, `CreateIncidentCard`, `ActiveIncidentBoardCard`, `IncidentCommandPaneCard`

### Acceptance Criteria
- Incident create/list/select/update workflows are complete with validation and role checks.
- Command workspace tabs (overview/tasks/timeline/periods/resources/communications/sitrep) load on demand, cancel stale requests, and avoid flicker loops.
- SITREP/ICS-201 rendering supports retry/error states and operational period context.
- Resource and communication tab actions support create/edit/archive and reflect post-save refresh consistently.
- All incident mutations produce durable audit entries with actor, action, entity, incident ID, UTC timestamp, trace ID.

### RFP Coverage Targets
- Incident management baseline and C4.
- Planning workflow baseline for ICS content.
- Security audit readiness B9/E9.

---

## 3) Facilities Container
Components: `FacilitiesCapacityAnalyticsCard`, `FacilitiesTrendDrilldownCard`, `ResourcePostureCard`

### Acceptance Criteria
- Displays near-real-time bed/resource posture by facility/location.
- Supports configurable threshold-driven risk highlighting and trend windows.
- Supports bed snapshot creation and immediate visibility of latest records.
- Supports filtered exports with audit trail for who exported, when, and scope.
- Enforces resource reporter authorization for mutation endpoints.

### RFP Coverage Targets
- D/F resource coordination baseline.
- F10 facility snapshot baseline.
- F2 export baseline.

---

## 4) Reports Container
Components: `ReportingWorkspaceCard`, `InteractiveIncidentAnalyticsCard`

### Acceptance Criteria
- Supports ad-hoc filtering/grouping and time-windowed reporting.
- Exports include reproducible metadata (filters, generation UTC, actor) and are auditable.
- Provides baseline standard report templates for incident status/resource posture.
- Includes explicit placeholders/flags for pending FEMA AAR/IP and HVA modules.
- Avoids presenting reports as compliant artifacts unless required fields are populated.

### RFP Coverage Targets
- C1/F2 export requirements.
- C2 and C8 preparatory baseline.

---

## 5) Alerts Container
Components: `AlertCenterPanel` (+ future communications orchestration)

### Acceptance Criteria
- Shows alert stream with clear severity, timestamp, source, and lifecycle state.
- Supports acknowledgement state transitions with audit entries.
- Provides retry/resume behavior for failed outbound notification attempts.
- Exposes delivery evidence fields for each outbound notification (channel, target group, status).
- Implements role checks for who can send/broadcast/escalate.

### RFP Coverage Targets
- Communications orchestration baseline.
- Delivery audit evidence baseline.

---

## 6) Cross-Cutting Security, Compliance, Audit, Observability

### Security Acceptance Criteria
- Strict HTTPS/HSTS/security headers in non-dev; no relaxed token validation outside dev.
- Least-privilege authorization policies are applied per endpoint and mutation path.
- Rate limiting and abuse controls active on API, with user-safe retry guidance.
- Sensitive logs redacted; no secrets/tokens/regulated data in application logs.

### Compliance/Audit Acceptance Criteria
- Durable audit event writes for auth/admin/mutation/export/security-relevant operations.
- Audit query capability for compliance requests with role restrictions.
- Retention policy documented and technically enforceable for audit logs.
- Data residency and access governance controls documented with environment guardrails.

### Observability Acceptance Criteria
- Correlation IDs/traces available across frontend request errors and backend logs.
- ProblemDetails includes trace ID for all failure classes.
- Readiness endpoint exposes dependency state and degraded mode flags.
- Operational metrics defined for latency, error rate, throttling rate, and critical workflow completion time.

---

## HIPAA/HITRUST Readiness Constraint
This codebase can satisfy technical safeguard and evidence requirements for readiness posture. Formal HIPAA/HITRUST attestation still requires organizational controls, policy governance, risk management, training, and third-party assessment evidence outside source code alone.
