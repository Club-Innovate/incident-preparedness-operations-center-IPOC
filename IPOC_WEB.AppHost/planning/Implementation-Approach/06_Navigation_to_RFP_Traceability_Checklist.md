# Navigation-to-RFP Traceability Checklist

## Scope
Navigation surfaces from `frontend/src/components/layout/NavigationPaneCard.tsx`:
- Dashboard
- Incidents
- Facilities
- Reports
- Alerts

Source requirements:
- `IPOC_WEB.AppHost/planning/EVT0010848_-_RFP_Document.txt`
- `IPOC_WEB.AppHost/planning/Implementation-Approach/04_Competitive_and_RFP_Scored_Matrix.md`
- `IPOC_WEB.AppHost/planning/Implementation-Approach/03_Current_Implementation_Status_and_Next_Sprint.md`

## Legend
- Status: Implemented | Partial | Missing
- Priority: High | Medium | Low

## 1) Dashboard
| Capability | RFP/Matrix Ref | Current Status | Priority | Evidence/Notes |
|---|---|---|---|---|
| Multi-incident operational summary | C4 | Partial | High | KPI snapshot + analytics present in `App.tsx`; no map COP or cross-sector drill-through yet. |
| KPI trend visibility | F5 (trend dashboards) | Partial | Medium | Interactive analytics exists; no formal SLO/uptime dashboard wiring. |
| Degraded mode visibility | A5/D6 ops readiness | Implemented | Medium | Readiness badge and degraded fallback indicators present. |

## 2) Incidents
| Capability | RFP/Matrix Ref | Current Status | Priority | Evidence/Notes |
|---|---|---|---|---|
| Incident create/list/detail/update | C4 | Implemented | High | Active board + command pane + metadata updates are live. |
| ICS command assignments | A/B/C incident mgmt | Implemented | High | Command assignment workflow delivered (status doc item). |
| SITREP/ICS-201 workflow | C4 + incident planning requirements | Partial | High | ICS-201 + SITREPs available; ICS-202..215 export pipeline pending. |
| Resource requests in incident workspace | Resource lifecycle refs | Partial | High | Request tracking present; routing-assignment-return lifecycle incomplete. |
| Incident communications log | Comms parity refs | Partial | High | Log present; multi-channel orchestration/ack/escalation pending. |

## 3) Facilities
| Capability | RFP/Matrix Ref | Current Status | Priority | Evidence/Notes |
|---|---|---|---|---|
| Bed/resource posture views | D/F requirements | Partial | High | Inventory + bed snapshots + analytics available. |
| Statewide rollup and detailed facility snapshot | F10/F11 | Partial | High | Basic analytics available; full facility profile model + prompt orchestration pending. |
| Resource request routing/assignment lifecycle | F8/F9 + D/E/F | Missing/Partial | High | Incident resource requests exist; cross-facility orchestration incomplete. |
| EHR adapter pathway | G1 | Missing | High | Not yet implemented. |

## 4) Reports
| Capability | RFP/Matrix Ref | Current Status | Priority | Evidence/Notes |
|---|---|---|---|---|
| Export to CSV/Excel | C1/F2 | Partial | High | Some CSV exports present in feature cards; no standardized export pipeline/audit evidence. |
| FEMA-compatible AAR/IP | C2 | Missing | High | Planned only. |
| HVA outputs | C8 | Missing | Medium | Planned only. |
| Incident replay/trend analytics | F5 | Partial | Medium | Basic grouped analytics present; replay and formal AAR evidence pending. |

## 5) Alerts
| Capability | RFP/Matrix Ref | Current Status | Priority | Evidence/Notes |
|---|---|---|---|---|
| Notification center and alert feed | Communications requirements | Partial | High | Alert center scaffold exists. |
| Multi-channel delivery (SMS/email/voice/push) | F3 communications matrix | Missing | High | Not implemented. |
| Per-recipient ack + escalation chain | F3 communications matrix | Missing | High | Not implemented. |
| Delivery audit evidence | F3 delivery audit | Missing/Partial | High | Request-level logs exist; no dedicated comm-delivery evidence model yet. |

## 6) Cross-Cutting Security, Compliance, Audit, Observability
| Capability | RFP/Matrix Ref | Current Status | Priority | Evidence/Notes |
|---|---|---|---|---|
| AuthN/AuthZ policy enforcement | B2-B8/E1-E8 | Partial | High | Policy-based endpoint protection in `Program.cs`; full role/facility admin flows pending. |
| API abuse protection / throttling | Security controls | Implemented | Medium | Rate limiting + Retry-After implemented. |
| Durable audit event persistence | B9/E9 + audit-first strategy | Partial | High | `audit.AuditEvent` schema exists in SQL model; app-level write coverage not yet complete. |
| Security headers/HSTS/HTTPS | Security controls | Implemented | Medium | Headers + HTTPS redirection + HSTS in non-dev. |
| US data residency governance artifacts | B10/E10 | Missing/Partial | High | Not codified in repo as enforceable runbook/controls. |
| Observability traces/metrics/SLO evidence | A5/D6 + blueprint sec.10 | Partial | High | Service defaults + logs exist; no formal SLO dashboard/evidence package in repo. |

## Immediate Prioritized Build Queue
1. Communications orchestration baseline (alerts -> channel routing -> delivery status -> acknowledgment).
2. Resource lifecycle completion (request -> routing -> assignment -> fulfillment/return) with auditable transitions.
3. Durable audit service + endpoint coverage for high-risk operations (auth, admin, incident/resource/comms mutations, exports).
4. Reporting compliance package (standardized CSV/Excel export trail, AAR/HVA starter outputs).
5. Security/compliance evidence package (US residency controls, retention, access review, incident response runbooks).

## 7) Intake-Driven Navigation Expansion (Planned Additions)
These items are added from `ICS Features Functionality Planning .docx` and should be tracked as phased navigation/module expansion requirements.

| Proposed Navigation Area | Capability Focus | Status | Priority | Notes |
|---|---|---|---|---|
| Common Operating Picture | GIS map, weather, threat intel, epidemiological trends, partner overlays | Planned | High | Should become first-class operator nav surface with role-aware filters. |
| Operations | Missions/tasks, assignment tracking, strike teams, field operations status | Partial/Planned | High | Tasking exists; operations module structure and dependency visualization pending. |
| Planning | IAP manager, ICS forms library, planning P-cycle timeline/reminders | Partial/Planned | High | ICS-201/SITREP baseline exists; full ICS library + P-cycle dashboard pending. |
| Resources (expanded) | Personnel/equipment/teams, ICS-213RR, mutual aid marketplace | Partial/Planned | High | Resource baseline exists; marketplace/mutual aid exchange and full routing lifecycle pending. |
| Communications (expanded) | Contact directory, message center, ICS-205/radio, collaboration | Partial/Planned | High | Recipient lifecycle baseline exists; directory/message/radio plan/collab expansion pending. |
| Logistics | Supply/inventory/staging/shelter/vendor workflows | Planned | Medium-High | New module area from intake; align to resource lifecycle and FEMA reimbursement data needs. |
| Finance & Administration | Cost/time/procurement/reimbursement/FEMA cost recovery | Planned | Medium-High | New module area; align to AAR and compliance reporting. |
| After Action | Automated AAR/IP and corrective action tracking | Planned | High | Coordinate with reporting/compliance slices. |
| Executive Dashboard | Top risks, pending decisions, life-safety/resource gaps | Planned | Medium-High | Role-targeted command summary view for leadership. |

## Compliance Positioning Note
HIPAA/HITRUST alignment requires both technical controls and organizational controls (policies/procedures/training/vendor management/risk assessments/third-party attestation). This repository can implement and evidence technical safeguards and auditability, but cannot by itself claim formal certification without external assessment and governance evidence.

## Buildout Trace Log (Session Update)

### Implemented This Session
1. Introduced shared execution-lane workflow component for Navigation modules:
   - `frontend/src/components/navigation/ExecutionLaneBoard.tsx`
2. Integrated execution-lane workflow into:
   - Operations,
   - Planning,
   - Finance & Administration,
   - After Action.
3. Added operator workflow controls:
   - directive status/owner/due controls,
   - status/owner filters,
   - due-date and blocked-first sorting,
   - my-items triage mode,
   - per-row quick actions,
   - bulk actions.
4. Added guardrails and evidence support:
   - owner-required status transition validation (`In Progress`/`Blocked`),
   - overdue directive flagging,
   - CSV export for directive evidence.

### Pending Buildout Priorities (Functional Depth)
1. Operations:
   - add blocked-by/dependency linkage,
   - introduce dependency-aware sequencing actions.
2. Planning:
   - implement explicit P-cycle milestone gates and ICS package readiness progression.
3. Finance & Administration:
   - implement reimbursement packet lifecycle checkpoints with stronger state progression.
4. After Action:
   - implement corrective-action closure and owner follow-through lifecycle.
