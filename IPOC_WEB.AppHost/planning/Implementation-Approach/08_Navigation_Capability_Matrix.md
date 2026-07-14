# Navigation Capability Matrix (Non-Duplication Guard)

## Purpose
Define each navigation module's unique capability scope and explicitly prevent duplicate functionality with Dashboard, Incidents, Facilities, and Reports.

## Matrix
| Navigation Module | Primary Scope | Must Not Duplicate | Distinction Rule |
|---|---|---|---|
| Dashboard | Cross-platform KPI snapshot and broad readiness context | Incident command execution, facility-level edits, report authoring | Dashboard summarizes posture and trends, but does not execute incident workflows. |
| Incidents | Single-incident command execution (metadata, tasks, timeline, resources, communications, SITREP/IAP) | Cross-incident operations orchestration, enterprise planning board | Incident view remains the execution workspace for one selected incident. |
| Facilities | Facility posture analytics, bed/resource state, facility trend drilldowns | Incident command tab workflows, reporting workspace templates | Facilities focuses on infrastructure posture across sites, not incident command actions. |
| Reports | Time-windowed analytics, grouped reporting, evidence/export outputs | Incident execution and operations queue management | Reports produces analytical/evidence outputs, not operational orchestration controls. |
| Common Operating Picture | Geospatial and statewide common picture overlays | Incident tab execution controls, facility editing forms | COP provides situational context and overlays, not direct command mutation workflows. |
| Operations | Cross-incident mission coordination and assignment pressure monitoring | Incident Command Workspace tabs (tasks/resources/communications) | Operations aggregates operational load across incidents; incident tabs remain detail execution. |
| Planning | Cross-period planning cadence and readiness tracking | Incident SITREP/ICS tab execution controls | Planning monitors readiness cadence and planning-cycle posture; incident tabs execute ICS content for one incident. |
| Logistics | Supply/staging/vendor movement workflows across incidents/facilities | Facilities posture analytics and incident resource request editing | Logistics orchestrates fulfillment pathways and staging dependencies, not incident tab-level request editing. |
| Finance & Administration | Cost/procurement/reimbursement and admin control workflows | Reports analytics dashboards and export cards | Finance/Admin governs fiscal/compliance workflows; Reports remains analytics/output focused. |
| After Action | Post-incident lessons learned and corrective action tracking | Live command execution and real-time report filtering views | After Action is retrospective and improvement-oriented, not live command operations. |
| Alerts | Alert stream and acknowledgment lifecycle | Incident communications tab compose/update workflow | Alerts manages alert-center lifecycle state; incident communications handles incident-specific comm log actions. |

## Current Enforcement Decisions
1. Navigation buttons removed to avoid duplication and inert controls:
   - Resources
   - Communications
   - Intelligence
   - Administration
   - Settings
2. Operations and Planning are now enabled as distinct module views with explicit distinction copy in UI.
3. Any new navigation feature must include a "Must Not Duplicate" statement before implementation.
4. Logistics, Finance/Admin, and After Action now include actionable readiness/constraint signals beyond summary counts, while remaining explicitly non-duplicative with Facilities, Reports, and Incident command tabs.
5. Initial module-local action controls are now present (Logistics watch/escalation flags, Finance/Admin checkpoint toggles, After Action corrective-action starter counters) and scoped to module posture workflows only.
6. Module-local action state is now persisted in frontend local storage for Logistics, Finance/Admin, and After Action to maintain operator continuity without introducing duplicate incident/facility/report mutations.
7. Module-local action controls are now authentication-gated (disabled for unauthenticated sessions) to align with role-aware mutation safety expectations.
8. For authenticated users, module-local action state now also persists to backend user preset storage (`report-presets`) under dedicated navigation scopes, with local storage retained as resilience fallback.
9. Module-local action controls now apply role/scope gating in UI (`SYSTEM_ADMIN`/`KDHE_ADMIN`/`INCIDENT_COMMANDER` and module-specific scopes) so command/admin actions are not exposed to basic authenticated users.
10. Frontend authorization gating is now centralized in `frontend/src/security/authorization.ts` with a smoke assertion file (`authorization.spec.ts`) to prevent policy drift across navigation modules.
11. Navigation authorization rules now include explicit backend-policy alignment metadata (`AuthorizationPolicies.*`) and smoke assertions verify that alignment mapping remains intact.
12. Local smoke gate now executes frontend authorization smoke checks (`npm run smoke:authz`) so policy-alignment regressions fail smoke validation early.
13. Smoke gate frontend authorization checks now support graceful environment skip (missing npm/frontend path) and explicit skip switch (`-SkipFrontendAuthorizationSmoke`) to avoid false failures in constrained runtime environments.
14. Smoke gate now emits explicit frontend authorization smoke status in output (`Passed`, `Failed`, `Skipped*`) for audit clarity on whether checks executed or were skipped.
15. Frontend authorization smoke now validates UI wiring guards in navigation cards (central helper usage, disabled-state bindings, unauthorized guidance text, and App role/scope prop flow), not only policy-source declarations.
16. Frontend authorization smoke now also validates backend `report-presets` route policy bindings in `Program.cs` (`MapGet`/`MapPost`/`MapDelete` for `/report-presets/{presetScope}` require `AuthorizationPolicies.ResourceReporter`).
17. Local smoke gate now emits explicit `Backend report-presets policy alignment smoke status` and includes runtime auth checks for `GET /api/v1/resources/report-presets/{presetScope}` (no token: `401` or `200` when development bypass is enabled; token: `200`).

## Backend Endpoint Policy Mapping (Navigation Module Actions)
| Navigation Module Action Surface | Frontend Authorization Helper | Backend Policy Alignment Metadata | Primary API Surface Used |
|---|---|---|---|
| Logistics watchlist/escalation flags | `canManageLogisticsModuleActions` | `AuthorizationPolicies.ResourceReporter`, `AuthorizationPolicies.IncidentCommander` | `/api/v1/resources/report-presets/{scope}` (state persistence channel) |
| Finance/Admin checkpoint toggles | `canManageFinanceModuleActions` | `AuthorizationPolicies.LookupAdmin`, `AuthorizationPolicies.IncidentCommander` | `/api/v1/resources/report-presets/{scope}` (state persistence channel) |
| After Action corrective-action starter controls | `canManageAfterActionModuleActions` | `AuthorizationPolicies.LookupAdmin`, `AuthorizationPolicies.IncidentCommander` | `/api/v1/resources/report-presets/{scope}` (state persistence channel) |

## Report-Presets API Enforcement Note
Navigation module state persistence is enforced by backend API authorization on the report-presets channel. The `GET`, `POST`, and `DELETE` endpoints under `/api/v1/resources/report-presets/{presetScope}` require `AuthorizationPolicies.ResourceReporter` in `IPOC_WEB.Server/Program.cs`, and frontend auth smoke validates this policy binding to detect drift.

## Synthetic Logistics Data Demo Readiness Note
- Logistics cockpit demo/testing data can now be seeded and reset through `IPOC_WEB.AppHost/planning/Initialize-Database.ps1`.
- Seed command uses `-IncludeSyntheticLogisticsData`; reset command uses `-ResetSyntheticLogisticsData`.
- Operational usage details are documented in `IPOC_WEB.AppHost/planning/Database_Seed_Reset_Runbook.md`.
