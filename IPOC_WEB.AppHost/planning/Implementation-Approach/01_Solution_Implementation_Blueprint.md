# KDHE IOC/EM Solution Implementation Blueprint

## 1. Source Artifacts and Benchmark Inputs
Reviewed in repository:
- `IPOC_WEB.AppHost/planning/Azure_Web_Based_Preparedness_Architecture_Explanation.md`
- `IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_NIMS_Data_Model.sql`
- `IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_CosmosDB_IEE_Query_Library.sql`
- `IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_CosmosDB_IEE_Layer_MixDeploy.ps1`
- `IPOC_WEB.AppHost/planning/Implementation-Approach/02_NIMS_NRF_Traceability_Matrix.md`

Competitive benchmark sources reviewed (public product pages):
- Juvare WebEOC / EMResource
- Everbridge Critical Event Management
- Esri ArcGIS Mission / ArcGIS Enterprise / ArcGIS Hub
- Veoci link returned 404 during current review cycle

Not machine-parsed (binary in repo):
- `EVT0010848_-_RFP_Document.pdf`
- `KDHE_RFP_Technical_Proposal_FINAL_Enhanced.docx`
- `KS DOA Diagrams.png`

## 2. Confirmed Architecture Direction (RFP-aligned)
- **Platform pattern**: secure browser-based app with layered architecture (edge/security, app, workflow/orchestration, integration, data, analytics, operations).
- **Primary persistence**: **Azure SQL-first** authoritative transactional system of record.
- **Optional extension**: Cosmos DB for high-variability/high-volume document/event payloads.
- **Document storage**: Blob-backed file storage with SQL metadata and audit links.
- **Identity and access**: Microsoft Entra ID + scoped RBAC + MFA + Conditional Access.
- **Observability and SecOps**: OpenTelemetry + Azure Monitor/Application Insights + Sentinel/Defender integration pathway.
- **Interoperability posture**: API-first, event-capable, standards-aware (REST-first with healthcare integration profiles where required).

## 3. Core Bounded Domains (from SQL model)
1. **Security & Access** (`sec`) – users, roles, permissions, assignments, sessions.
2. **Organization/Geography** (`org`) – region, organization, location, contacts.
3. **Incident Command** (`ic`) – incident lifecycle, operational periods, command assignments, objectives, tasks, SITREP/IAP.
4. **Resource Management** (`res`) – inventory, status, requests, assignments, bed capacity.
5. **EEI Workflow** (`eei`) – templates, prompts, targets, responses, escalation signals.
6. **Communications** (`comm`) – notifications, delivery channels, acknowledgments.
7. **Document/Assessment** (`doc`, `assessment`) – exports, AAR/IP, HVA, evidence artifacts.
8. **Integration & Audit** (`intg`, `audit`, `app`) – inbound/outbound integration events, replay/idempotency, non-repudiable audit trails.

## 4. Competitive Capability Themes to Match or Exceed
The following are cross-vendor patterns consistently visible in benchmark platforms and should be treated as baseline expectations:

1. **Unified common operating picture**
   - Multi-incident view, role-specific dashboards, operational drill-through.
2. **Configurable workflows (low/no-code posture)**
   - Form/workflow configurability without heavy engineering cycles.
3. **Multi-channel communication with targeted routing**
   - Voice/SMS/email/push/collaboration channel delivery with acknowledgment tracking.
4. **Healthcare operational coordination**
   - Bed/capacity/resource visibility, patient movement context, inter-facility coordination.
5. **Geospatial situational awareness**
   - AOI, map overlays, live feed fusion, incident-to-location intelligence.
6. **Secure cross-agency exchange**
   - Controlled collaboration boundaries, encrypted data sharing, auditable external coordination.
7. **After-action analytics and continuous improvement loops**
   - Incident replay, KPI trendlines, response performance metrics, corrective action tracking.

## 5. KDHE Differentiator Strategy (Win Theme)
To differentiate while remaining tightly aligned to the RFP, this solution should emphasize:

1. **NIMS/NRF-native healthcare operations model**
   - Directly modeled from KDHE-aligned SQL schema and proposal checkpoints (not generic incident tooling).
2. **SQL-authoritative + audit-first trust model**
   - High-confidence operational record, deterministic reporting, export traceability, and defensible compliance posture.
3. **Degraded-but-operational resilience mode**
   - Clear local/state operational continuity behavior with visible degraded-state UX and controlled fallbacks.
4. **Interoperability without rip-and-replace**
   - API/event-based integration with existing systems and future GIS/public collaboration extensions.
5. **RFP traceability by design**
   - Every feature slice mapped to explicit framework/RFP commitments and acceptance evidence.

## 6. Security, Compliance, and Data Protection Controls
Mandatory cross-cutting controls:
- Entra-backed authN and scoped authZ checks (state/region/org/location/incident).
- Least-privilege service and data access.
- Parameterized data access only; explicit input validation and output encoding.
- Managed identity + Key Vault-backed secret governance.
- Audit write coverage for auth, command, data change, admin, export, and security events.
- Data classification, retention, and legal-hold aware export paths.
- CORS, anti-forgery, and API abuse protections aligned to threat model.
- Compliance mapping runway for HIPAA/CJIS/FISMA/NIST controls as contractually required.

## 7. API and Service Blueprint (.NET 10)
Recommended service surface in `IPOC_WEB.Server`:
- `Features/Incidents/*`
- `Features/Resources/*`
- `Features/Eei/*`
- `Features/Communications/*`
- `Features/Reports/*`
- `Features/Assessments/*`
- `Infrastructure/Data/*`
- `Infrastructure/Security/*`
- `Infrastructure/Observability/*`
- `Infrastructure/Integrations/*`

API standards:
- Versioned REST (`/api/v1/*`) with ProblemDetails contracts.
- Idempotency keys for ingestion/command endpoints where replay risk exists.
- Consistent filtering/paging/sorting patterns.
- Async workflow orchestration hooks (Logic Apps/Durable Functions patterns) for reminders/escalations.

## 8. UX/UI Direction (Operator-first)
- Role-oriented shell: command, operations, planning, logistics, admin perspectives.
- Incident workspace sections: Situation, Objectives/Operational Periods, Tasks, Resources/Beds, EEI, Communications, Documents, AAR.
- Fast-action patterns: one-click acknowledgment, quick status updates, minimal keystrokes during surge events.
- Clear state design: normal/degraded/partial-data banners with operator guidance.
- Accessibility and consistency: keyboard-first workflows, ARIA compliance, consistent validation/error behaviors.

## 9. GIS and Community Collaboration Extension Path
- **GIS integration path**: map-centric COP, AOI-driven operations, live layer overlays, optional ArcGIS-aligned integration profile.
- **Community transparency path**: publish selected operational datasets and updates through controlled public engagement channels.
- **Governance**: strict public/private data separation and approval workflow before external publication.

## 10. Observability and Operational Readiness
- End-to-end traces for incident activation, objective lifecycle, resource assignments, communications, exports.
- Operational SLOs: API latency, message delivery success, data freshness, command completion time.
- Health model: readiness endpoints with dependency state and degraded-mode flags.
- SOC-compatible telemetry structure with correlation IDs and actionable dashboards.

## 11. Phased Delivery (RFP-tightened)
Phase 1 — Secure Foundation and Operability
- Environment, identity, policy, SQL connectivity, baseline telemetry, smoke gates.

Phase 2 — Incident Planning and Command
- Operational periods, objectives, tasks, command assignment workflows, SITREP cadence.

Phase 3 — Resource and Healthcare Coordination
- Bed/resource workflow lifecycle (request-routing-assignment), capacity rollups, healthcare interoperability adapters.

Phase 4 — Communications and Collaboration
- Multi-channel targeted notifications, acknowledgments, escalation orchestration, external partner exchange.

Phase 5 — Intelligence, Reporting, and Improvement
- AAR/IP, HVA, KPI dashboards, incident replay and trend analytics.

Phase 6 — Hardening and Release Readiness
- Compliance evidence package, penetration/performance validation, role-scope verification, runbooks and release gates.

## 13. ICS Features Intake Expansion (from `ICS Features Functionality Planning .docx`)
The following items are now added to the implementation blueprint and should be tracked as phased commitments.

### 13.1 Navigation/Module Expansion Targets
- Incident Workspace (existing, keep primary)
- Operations (missions/tasks, assignment tracking, strike teams/task forces, field ops status)
- Planning (IAP manager, ICS forms library, operational planning P-cycle)
- Resources (personnel/equipment/teams, mutual aid exchange, ICS-213RR workflows)
- Communications (directory, message center, ICS-205/radio plan integration, notification center, collaboration)
- Situational Awareness / COP (GIS, weather, threat intel, epidemiological trends, external feeds)
- Logistics (supply requests, inventory, staging, shelter ops, vendor management)
- Finance & Administration (cost, time, procurement, reimbursement, FEMA recovery)
- After Action (AAR/IP and corrective actions)

### 13.2 Differentiator Capability Set
- AI Incident Co-Pilot for summarization, drafting, and recommendation workflows.
- Dynamic Incident Maturity Model (complexity/staffing/EOC-level recommendations).
- Automated NIMS Compliance Engine with actionable gap findings.
- Cross-jurisdiction COP with partner and asset visibility.
- Predictive analytics for healthcare and emergency operations demand/supply signals.
- Digital Planning P-Cycle dashboard with reminders and workflow state.
- Mission dependency graph for cascading-impact visibility.
- Resource marketplace / mutual aid exchange operations.
- Executive decision dashboard for unified command leadership.
- Automated after-action evidence capture and lessons-learned generation.

### 13.3 Status Baseline
- **Implemented/Partial now**: Incident workspace, command/planning core, communications dispatch-recipient linkage baseline, alert/recipient lifecycle, resource and SITREP foundations.
- **Planned next increments**: Operations/Planning/COP deepening, logistics and finance modules, mission dependency and maturity scoring, predictive/executive/AI capabilities.

## 14. Updated Phase Mapping for New Intake Items
- **Phase 2 (Incident Planning and Command)**: Digital planning P-cycle scaffold, expanded operations task/assignment tracking, ICS forms management runway.
- **Phase 3 (Resource and Healthcare Coordination)**: Resource marketplace/mutual aid, ICS-213RR lifecycle completeness, logistics domain start.
- **Phase 4 (Communications and Collaboration)**: Message center maturation, contact/network directory, collaboration and ICS-205 integration patterns.
- **Phase 5 (Intelligence, Reporting, and Improvement)**: COP intelligence overlays, predictive analytics, executive dashboard, mission dependency graph, AAR automation.
- **Phase 6 (Hardening and Release Readiness)**: Compliance scoring engine hardening, governance controls, model risk controls for AI-assisted outputs.

## 15. UX/UI Inspiration Research Notes (Non-copying)
Public product research (Juvare, Veoci, Everbridge, ArcGIS Mission pages) reinforces these design directions:
- Persistent operator-focused left navigation with clear mission-domain grouping.
- High-signal dashboard cards (risk/decision/resource gaps) with minimal clutter for executives.
- Map-first situational awareness entry for operational users.
- Workflow-centric panels for planning cycle and incident communications.
- Role-aware views: command, operations, planning, logistics, finance, admin.

These patterns should guide visual refinement while preserving existing project constraints (icon-first controls, tooltips, toast/alert behavior, and current navigation behavior expectations).

## 12. Immediate Execution Priorities
1. Complete incident planning slice end-to-end (operational periods/objectives/tasks UX and APIs).
2. Implement auditable communications orchestration baseline.
3. Implement resource lifecycle workflow (request-routing-assignment) and statewide posture rollups.
4. Add explicit audit persistence coverage and reporting evidence outputs.
5. Maintain smoke-gate-first discipline before each new slice.