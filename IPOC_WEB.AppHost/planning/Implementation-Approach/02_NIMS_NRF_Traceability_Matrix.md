# KDHE IOC/EM NIMS + NRF Traceability Matrix

## Purpose
This matrix maps key National Incident Management System (NIMS) and National Response Framework (NRF) expectations to the current IPOC_WEB design and implementation state, adapted for public health and healthcare operations.

## Scope Legend
- **Implemented**: Present in current code and testable now.
- **Partial**: Design and/or partial implementation exists, but not complete end-to-end.
- **Planned**: Defined in planning/design artifacts, not yet implemented.

## Traceability Matrix
| Framework Area | Public Health / Healthcare Adaptation | Planned Design Element | Current Evidence (Code/Docs) | Status | Gap / Next Action |
|---|---|---|---|---|---|
| NIMS ICS Command & Management | Incident command structure for state/region/facility operations | Incident lifecycle, command assignments, operational context | `IPOC_WEB.Server/Program.cs` incident APIs; `IPOC_WEB.Server/Infrastructure/Incidents/IncidentQueryService.cs`; `IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_NIMS_Data_Model.sql` (`ic.*`) | Partial | Add full ICS command assignment workflows/UI and role-scoped command actions. |
| NIMS Planning (IAP/SITREP cadence) | Public health incident periods, objectives, tasking, and situational updates | Operational periods, objectives/tasks, SITREP/IAP support | `01_Solution_Implementation_Blueprint.md` domain mapping and build phases; data model includes planning entities | Planned | Implement operational period/objective/task endpoints and corresponding UI tabs. |
| NIMS Resource Management | Bed/resource request and assignment across hospitals/agencies | Resource inventory, status, request-routing, assignment lifecycle | Architecture doc sections 2.3, 5.3; SQL model `res.*` domain | Planned | Build Resource/Bed API slice and UI grid/commands (next delivery slice). |
| NIMS Communications & Information Management | Targeted notifications/escalations to facilities/partners | Notification orchestration and delivery tracking | Architecture doc sections 2.4, 5.4, 6; blueprint phase 3 | Planned | Implement `comm` APIs + delivery status UI + escalation workflows. |
| NRF Situational Awareness | Statewide/regional healthcare posture and trend views | Dashboard + drill-through operational views | Frontend dashboard shell and weather/incident summary cards; architecture analytics layer | Partial | Replace placeholder cards with operational metrics tied to real readiness/resource data. |
| NRF Public Information / Alerts | Timely operational alerts and response prompts | Prompt + reminder + escalation patterns | Alert center/toast UX in frontend; architecture workflow/notifications plan | Partial | Connect UI alerts to backend notification events and persistence/audit. |
| NRF Operational Coordination | Multi-organization coordination with role/scope controls | Scoped RBAC + incident/location routing | `IPOC_WEB.Server/Infrastructure/Security/AuthorizationPolicies.cs`; JWT auth in `IPOC_WEB.Server/Program.cs` | Partial | Add claims-to-scope enforcement (state/region/org/location/incident) beyond authenticated-user baseline. |
| NRF Community Lifelines (Health/Medical) | Healthcare capacity visibility and continuity | Bed/resource posture + healthcare reporting | Planned in architecture and data model (`res`, `assessment`) | Planned | Implement bed availability ingest/update/reporting and regional rollups. |
| NIMS/NRF Interoperability | External partner/system integration | API Management + workflow integration layer + outbox/inbox | Architecture doc sections 2.4, 6; SQL domains `intg.*` | Planned | Implement integration contracts, ingestion APIs, validation, idempotency, and replay controls. |
| Accountability / Audit (NIMS principle) | Traceable operational and administrative actions | Audit/event coverage across auth, data changes, exports | Architecture cross-cutting controls; SQL `audit.*`; current telemetry baseline | Partial | Add explicit audit writes for incident commands, auth events, exports, admin/config changes. |
| Security & Access Governance | Least privilege, MFA/Conditional Access, scoped authorization | Entra ID + JWT + policy model + Key Vault strategy | Current Entra/MSAL integration; auth endpoints and policy skeleton | Partial | Complete production role model, consent flow, conditional access assumptions, and secret governance runbook. |
| Readiness/Recovery Cycle | Preparedness, response, recovery, improvement planning | AAR/IP + HVA + reporting workflows | Architecture sections 2.7 and 5.5; SQL `assessment` / `doc` domains | Planned | Implement AAR/IP and HVA modules with export traceability. |
| NIMS Operational Coordination (Planning P-Cycle) | Structured planning cadence and operational period governance | Digital planning P-cycle dashboard with reminders/status tracking | `ICS Features Functionality Planning .docx` planning-cycle intake; blueprint phase mapping | Planned | Implement planning cycle timeline board and event reminders with period locks. |
| NIMS Command Structure Maturation | Incident complexity-driven command expansion guidance | Dynamic incident maturity model with staffing/EOC recommendations | `ICS Features Functionality Planning .docx` differentiator intake | Planned | Implement complexity scoring rules and recommendation engine with override/audit trail. |
| NIMS Compliance Monitoring | Real-time compliance posture and corrective actions | Automated NIMS compliance score + missing-control diagnostics | `ICS Features Functionality Planning .docx` compliance engine intake | Planned | Build compliance rule catalog and real-time score computation with evidence links. |
| NRF Operational Coordination (Cross-jurisdiction COP) | Statewide/federal partner visibility and asset coordination | COP module with jurisdiction/partner overlays and role-aware filters | Architecture COP intent + intake document COP expansion | Planned | Implement COP nav/module with partner/asset layer model and governance controls. |
| NRF Intelligence & Information Sharing | Predictive situational insights for life-safety/resource posture | Predictive analytics for surge, depletion, and demand forecasting | Intake differentiator set + analytics roadmap | Planned | Add predictive pipelines, confidence metrics, and operator-safe recommendations. |
| NRF Decision Support | Executive unified command prioritization | Executive decision dashboard (top risks/decisions/gaps) | Intake differentiator set + UX direction updates | Planned | Implement executive role view and approval queue model with evidence drill-down. |

## KDHE Proposal (Docx) Page 22-23 Alignment Checkpoints
The following details from `KDHE_RFP_Technical_Proposal_FINAL_Enhanced.docx` (pp. 22-23) are explicitly aligned in this matrix and should remain implementation guardrails:

1. **Incident activation workflow sequence**
   - Authorized user activates incident with incident type, region, affected facilities, and initial operational period.
   - Matrix linkage: **NIMS ICS Command & Management**, **NIMS Planning (IAP/SITREP cadence)**.

2. **Auto-created incident workspace with NIMS/ICS structure**
   - System establishes ICS/NIMS-aligned roles, objectives, task boards, situation reporting structure, and notification rules.
   - Matrix linkage: **NIMS ICS Command & Management**, **NIMS Planning (IAP/SITREP cadence)**, **NIMS Communications & Information Management**.

3. **Workflow orchestration using Logic Apps / Durable Functions**
   - Notifications, reminders, status prompts, operational deadlines, and escalation flows are orchestrated.
   - Matrix linkage: **NIMS Communications & Information Management**, **NRF Operational Coordination**, **NRF Public Information / Alerts**.

4. **Security/compliance accountability controls**
   - Operational posture includes Sentinel/Monitor/Key Vault and accountability expectations.
   - Matrix linkage: **Accountability / Audit (NIMS principle)**, **Security & Access Governance**.

5. **Multiple simultaneous incident support with shared statewide situational views**
   - Incident Commander and authorized staff coordinate concurrent incidents while maintaining statewide common operating picture.
   - Matrix linkage: **NRF Situational Awareness**, **NRF Operational Coordination**, **NIMS ICS Command & Management**.

6. **Workflow domain separation for surge resilience**
   - Proposal describes explicit separation of user interaction, validation, orchestration, async messaging, persistence, reporting, notifications, and audit monitoring.
   - Matrix linkage: **NIMS/NRF Interoperability**, **NIMS Communications & Information Management**, **Accountability / Audit (NIMS principle)**.

7. **Operational governance outcome alignment**
   - Domain-level outcomes include readiness posture, process consistency, improved coordination, auditable data, and executive oversight.
   - Matrix linkage: **NRF Situational Awareness**, **Readiness/Recovery Cycle**, **Security & Access Governance**.

8. **SQL-first with governed hybrid flexibility (Cosmos optional)**
   - Proposal/architecture alignment favors authoritative SQL operations with optional Cosmos extension for high-variability workloads.
   - Matrix linkage: **NIMS Resource Management**, **NRF Community Lifelines (Health/Medical)**, **NIMS/NRF Interoperability**.

## Proposal Statement → Implementation Evidence (Dot-the-I’s Checklist)
| Proposal Commitment (Docx/Blueprint) | Evidence Now | Implementation Confidence | Remaining Action |
|---|---|---|---|
| Incident activation with operational context (type/region/facilities/period) | Incident APIs and SQL incident domain are in place | Medium | Add explicit operational period capture and validations in API/UI flow |
| ICS/NIMS-aligned workspace (roles/objectives/tasks/SITREP/notifications) | Domain design exists; partial incident slice implemented | Medium-Low | Implement command assignments, objectives/tasks, SITREP modules |
| Orchestrated reminders/escalations via Logic Apps/Durable Functions | Planned in architecture, not implemented | Low | Implement first orchestration workflows and message contracts |
| Multi-incident coordination + statewide view | Architectural intent present; dashboard still placeholder | Low | Build statewide/regional metrics and concurrent incident views |
| Security/compliance observability (Sentinel/Monitor/Key Vault) | Security/observability direction defined; partial app-level auth implemented | Medium-Low | Add production audit events, role-scope enforcement, and runbooks |
| Data governance and auditable records | SQL-first model and audit domains planned | Medium | Implement audit write paths and export traceability end-to-end |

## Competitive Baseline Addendum (RFP-Relevant)
Public benchmark review across Juvare WebEOC/EMResource, Everbridge CEM, and Esri ArcGIS Mission/Enterprise/Hub reveals recurring capability expectations that map directly to KDHE functional areas:

1. Multi-channel targeted alerts with acknowledgment and escalation trails.
2. Configurable forms/workflows with low-friction operational adaptation.
3. Persistent field-to-command communication with mobile-first updates.
4. Geospatial common operating picture with AOI and live operational layers.
5. Healthcare capacity/resource coordination with standards-aware interoperability.
6. Secure cross-agency collaboration and auditable information exchange.
7. After-action analytics and continuous improvement loops.

### Matrix Extension: Competitive Capability Alignment
| Competitive Capability Theme | KDHE/RFP-Relevant Outcome | Existing Evidence | Status | Gap / Next Action |
|---|---|---|---|---|
| Multi-channel alerting + acknowledgment | Faster coordinated response and accountability | Alert center UI pattern exists; comm domain planned | Partial | Implement `comm` orchestration APIs, delivery receipts, escalation logic, and audit persistence. |
| Configurable workflow/forms | Adaptability to changing incident playbooks | Domain-driven architecture supports modular slices | Planned | Add configuration-driven form/workflow metadata and admin governance model. |
| Mobile/persistent field collaboration | Real-time status from field operations | Current UI is browser-based with manual updates | Planned | Add mobile-responsive quick-action workflows and persistent ops communication thread model. |
| Geospatial command picture | Better situational awareness and operational routing | Org/location model exists; GIS integration planned in architecture | Planned | Implement map overlays/AOI integration profile and incident-resource geospatial views. |
| Healthcare capacity interoperability | Bed/resource visibility across partners | Bed/resource APIs exist at baseline | Partial | Add request-routing-assignment lifecycle and standards-aware integration adapters (e.g., HL7/FHIR profiles as required). |
| Cross-agency secure exchange | Trusted multi-organization coordination | Auth/policy baseline and audit domain planned | Partial | Implement bounded external sharing workflows with encrypted exchange and scope-based access boundaries. |
| Continuous improvement analytics | Evidence-based readiness and governance | Telemetry baseline and AAR/HVA plans exist | Planned | Implement KPI dashboards, incident replay, AAR/IP workflow completion metrics, and executive scorecards. |

## Current Overall Assessment
- **Planning and design alignment to NIMS/NRF**: **Strong**
- **Production implementation alignment**: **Partial**
- **RFP competitiveness readiness**: **Emerging (core baseline established, differentiator slices pending)**
- **Highest-priority build gaps**:
	1. Communications orchestration channel breadth and governance completion (recipient lifecycle baseline delivered)
  2. Resource/bed request-routing-assignment workflow completion
  3. GIS-enabled statewide common operating picture + intelligence overlays
  4. Planning P-cycle and command maturity/compliance scoring foundations
  5. Audit persistence completeness for command/admin/export actions + AAR/HVA/KPI continuous improvement module

## Recommended Sequencing (Next)
1. Deliver **Incident Planning completion** (operational periods/objectives/tasks/command assignment UX/API).
2. Deliver **Communications orchestration** (multi-channel, targeted, auditable delivery + escalation).
3. Deliver **Resource lifecycle** (inventory/bed + request-routing-assignment + rollups).
4. Deliver **GIS/COP slice** (AOI, map overlays, incident-resource geospatial operations).
5. Deliver **Reporting and improvement** (AAR/IP, HVA, KPI dashboards, replay analytics).
6. Execute **hardening** (strict role-scope validation, audit completeness, performance/security gates).

## Source Artifacts Referenced
- `IPOC_WEB.AppHost/planning/Implementation-Approach/01_Solution_Implementation_Blueprint.md`
- `IPOC_WEB.AppHost/planning/Azure_Web_Based_Preparedness_Architecture_Explanation.md`
- `IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_NIMS_Data_Model.sql`
- `IPOC_WEB.AppHost/planning/KDHE_RFP_Technical_Proposal_FINAL_Enhanced.docx` (pp. 22-23 reference alignment)
- `IPOC_WEB.Server/Program.cs`
- `IPOC_WEB.Server/Infrastructure/Security/AuthorizationPolicies.cs`
- `IPOC_WEB.Server/Infrastructure/Incidents/IncidentQueryService.cs`
- `frontend/src/App.tsx`
- Public benchmark pages listed in the implementation blueprint source section