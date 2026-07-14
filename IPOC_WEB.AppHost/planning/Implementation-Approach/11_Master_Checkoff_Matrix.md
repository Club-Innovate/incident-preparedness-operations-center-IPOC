# IPOC_WEB Master Checkoff Matrix

## Legend
- **Status**: Done | In Progress | Pending
- **Demo Confidence**: High | Medium | Low

## Phase 1 — Secure Foundation and Operability
| Area | Status | Demo Confidence | Blocker | Next Action |
|---|---|---:|---|---|
| Entra auth/authz baseline, token diagnostics, exception handling, readiness | Done | High | None | No additional closure scope |
| Strict production role/scope hardening and governance artifacts | Done | High | None | Local full smoke gate passes readiness + protected endpoint behavior + frontend auth smoke + backend policy alignment; staging token-enabled execution remains a deployment-time runbook activity |

## Phase 2 — Incident Command and Planning
| Area | Status | Demo Confidence | Blocker | Next Action |
|---|---|---:|---|---|
| Incident command tabbed workspace + task/timeline/objective baseline | Done | High | None | No additional closure scope |
| ICS command assignment workflows | Done | High | None | No additional closure scope |
| ICS-201 + SITREP generation baseline | Done | High | None | No additional closure scope |
| ICS-202/203/204/205/209/214/215 read/display baseline | Done | High | None | No additional closure scope |
| IAP draft/approve governance and period workflow completeness | Done | High | None | Approval/reopen APIs enforce explicit lifecycle preconditions (approve: Planned/Active only; reopen: Approved only); operational period create/update are now contract-aligned to editable states (`Planned`/`Active`) with conflict handling on stale state updates; IAP export/print governance is enforced in backend + API validation + UI pre-check messaging/disablement; governance evidence export (`/api/v1/incidents/{incidentId}/iap-governance/evidence/json`) and smoke-gate coverage are in place for acceptance evidence |
| Planning governance closeout board + cross-workspace drilldown actions | Done | High | None | No additional closure scope |

## Phase 3 — Resource and Healthcare Coordination
| Area | Status | Demo Confidence | Blocker | Next Action |
|---|---|---:|---|---|
| Resource evidence export + lifecycle transition guardrails | Done | High | None | No additional closure scope |
| Queue/lane routing, batch operations, assignment controls | Done | High | None | No additional closure scope |
| Regional/statewide rollup read/export posture | Done | High | None | No additional closure scope |
| Full request-routing-assignment lifecycle parity + healthcare coordination depth | Done | High | None | Incident resource lifecycle now includes transition guardrails, lifecycle summary, CSV evidence export, and dedicated lifecycle governance evidence export (`/api/v1/incidents/{incidentId}/resources/lifecycle-evidence/export/json`) with smoke-gate coverage |
| EHR adapter path and facility point-in-time parity | Done | High | None | FHIR bed availability adapter baseline is production-operable: import endpoint now enforces normalized source identifiers + validation guardrails (including invalid JSON payload handling), adapter contract remains published via `/api/v1/beds/import/availability/fhir/adapter-contract`, and Admin FHIR translator workflow now surfaces contract-assisted preflight details with structured validation feedback and reject evidence download |

## Phase 4 — Communications and Collaboration
| Area | Status | Demo Confidence | Blocker | Next Action |
|---|---|---:|---|---|
| Recipient lifecycle (ack/escalation), multi-recipient staging, SOS voice/push | Done | High | None | No additional closure scope |
| Geo-targeted broadcast staging + comm evidence export | Done | High | None | No additional closure scope |
| Collaboration breadth (workspace depth and cross-team orchestration parity) | Done | High | None | Planning and After Action workspaces now include explicit cross-workspace orchestration pathing (Planning closeout board drills into Incident/COP/After Action), and AAR closeout now includes incident-scoped evidence export handoff (`/api/v1/incidents/{incidentId}/after-action/evidence/export/json`) to support synchronized collaboration acceptance |

## Phase 5 — Intelligence, Reporting, AAR/HVA
| Area | Status | Demo Confidence | Blocker | Next Action |
|---|---|---:|---|---|
| Audit evidence feed + auditable CSV export baseline | Done | High | None | No additional closure scope |
| Incident maturity/NIMS/dependency posture + executive snapshot starter | Done | High | None | No additional closure scope |
| Automated lessons-learned capture v1 + promotion flow | Done | High | None | No additional closure scope |
| AAR/HVA module completeness, KPI trends, incident replay | Done | High | None | Incident-scoped AAR/HVA evidence export now packages replay/HVA readiness, evidence counts, checklist outcomes, and blocked reasons (`/api/v1/incidents/{incidentId}/after-action/evidence/export/json`), wired to After Action UI export control and smoke-gate validation |
| Predictive analytics and AI co-pilot depth | Done | High | None | Provider abstraction (`IPredictivePlanningModelService`) and model metadata contract are complete; operational governance acceptance endpoint (`/api/v1/agent/planning/predictive-demand-supply/operational-acceptance`) now validates confidence/drift thresholds for production signoff evidence; navigation AI/predictive controls are explicitly feature-flag gated with no dead-click placeholders (`VITE_IPOC_NAV_PLANNING_AI_ENABLED`, `VITE_IPOC_NAV_FINANCE_PREDICTIVE_ENABLED`, `VITE_IPOC_NAV_AFTER_ACTION_AI_ENABLED`) |

## Phase 6 — Hardening and Release Readiness
| Area | Status | Demo Confidence | Blocker | Next Action |
|---|---|---:|---|---|
| Admin data-ops safeguards (typed confirm, preview, telemetry, policy split, cooldown) | Done | High | None | No additional closure scope |
| Session controls, impersonation-with-audit, full compliance evidence package | Done | High | None | Session administration includes auditable compliance evidence export (`/api/v1/admin/sessions/compliance-evidence/export/json`), impersonation start/stop controls, and audited lifecycle events (`SESSION_IMPERSONATION_START`/`SESSION_IMPERSONATION_STOP`) |
| Release runbooks and strict pre-prod validation gates | Done | High | None | Release gate checklist artifact (`12_Release_Gate_Closeout_Checklist.md`) completed with successful full local smoke-gate execution and signoff record; staging token run is tracked as operational deployment execution |

## Cross-Cutting Competitive Differentiators
| Differentiator | Status | Demo Confidence | Blocker | Next Action |
|---|---|---:|---|---|
| NIMS/NRF-native operational UX + auditable SQL-first record | Done | High | None | No additional closure scope |
| Mission dependency graph posture + executive command signals | Done | High | None | No additional closure scope |
| COP/GIS map-first operations parity | Done | High | None | Staging external-source onboarding and validation evidence captured with contract/readiness/provider-health diagnostics (`/api/v1/cop/live-overlay/contract`, `/api/v1/cop/live-overlay/external-readiness`, `/api/v1/system/external-provider-health`, `/api/v1/system/external-provider-health/history`) and smoke-gate endpoint coverage now in place |
| Dynamic weather context by incident/location | Done | High | None | Open-Meteo provider integration includes deterministic fallback, circuit-breaker bypass controls, durable telemetry history, long-window trends, threshold alerting, governance export, and federation summary coverage |
| Admin location geodata operations (edit + geocode) | Done | High | None | Nominatim-first geocode flow includes fallback heuristics, circuit-breaker + cooldown controls, durable telemetry/governance reporting, and cross-environment federation diagnostics |
| Admin facility point-in-time snapshot operations | Done | High | None | Admin facility workflow now includes snapshot view/export, risk-signal interpretation (occupancy/commitment/staleness/partial-visibility), and per-facility prompt-kit persistence (generate/copy/download + saved template/text) |
| Admin facility address metadata persistence parity | Done | High | None | Facility address metadata (City/State/Postal) now persists with geolocation edits and is returned consistently in admin location read/query surfaces |
| Admin facility snapshot profile-account fusion | Done | High | None | Facility snapshot contract now returns facility profile metadata (name/org/region/address/status) fused with point-in-time resource/bed posture in one operational payload |
| Admin facility snapshot evidence export fidelity | Done | High | None | Facility snapshot CSV export now includes profile metadata plus computed occupancy/commitment posture percentages for command-grade evidence packets |
| Admin facility snapshot structured JSON export parity | Done | High | None | Facility snapshot workflow now supports auditable JSON artifact export endpoint and admin one-click JSON download for machine-readable evidence ingestion |
| External provider guardrails (telemetry + throttling) | Done | High | None | Added provider health + event history endpoints, config-driven circuit policy and bypass tracking, durable telemetry persistence (file + optional SQL warehouse with retention), storage diagnostics/rotation endpoints (`/api/v1/system/external-provider-health/storage`, `/api/v1/system/external-provider-health/storage/rotate`), warehouse history endpoint (`/api/v1/system/external-provider-health/history/warehouse`), long-window trend endpoint (`/api/v1/system/external-provider-health/trends`), threshold evaluation alert trigger (`/api/v1/system/external-provider-health/alerts/evaluate`), governance CSV export (`/api/v1/reports/external-provider-health/governance/export/csv`), executive scorecard exports (`/api/v1/reports/external-provider-health/scorecards/export/csv`, `/api/v1/reports/external-provider-health/scorecards/export/json`), admin diagnostics trend/alert/export controls, and smoke-gate coverage |
| COP unified command risk board + cross-workspace quick actions | Done | High | None | COP map overlay drives hotspot command queue actions into Planning/Operations with acknowledgment + reset workflow, and Admin diagnostics now provide contract/readiness/feed/provider-health evidence for triage and operational acceptance |
| AI-assisted planning and predictive demand/supply modeling | Done | High | None | Endpoint + assistant integration are active via `/api/v1/agent/planning/predictive-demand-supply`; provider abstraction + governance metadata are in place and operational acceptance gating is exposed via `/api/v1/agent/planning/predictive-demand-supply/operational-acceptance` |

## Analytics & Predictive Feature Matrix
| Feature Area | Capability | Status | Evidence Endpoint / Surface |
|---|---|---|---|
| Dashboard visualization generation | Prompt -> visualization spec -> widget canvas generation (append/replace) | Done | `frontend/src/components/layout/DashboardSnapshotCard.tsx` prompt rail + generated spec persistence scope `dashboard-generated-visualization-specs-v1` |
| Reports visualization generation | Prompt -> visualization spec -> advanced analytics canvas generation (append/replace) | Done | `frontend/src/components/layout/ReportingWorkspaceCard.tsx` prompt rail + generated spec persistence scope `reports-generated-visualization-specs-v1` |
| Prompt NL parsing | Shared parser/spec generator with intent extraction | Done | `frontend/src/components/layout/visualizationPrompt.ts` |
| Prompt parameterization | Time grain, top N, grouping, threshold extraction from prompt | Done | `generateVisualizationSpec(...)` output contract in `visualizationPrompt.ts` |
| Generated visualization spec persistence | Server-stored generated specs with local fallback, reuse/apply, metadata badges, delete parity actions, and legacy spec migration/resave compatibility | Done | `/api/v1/resources/report-presets/{scope}` with scopes `dashboard-generated-visualization-specs-v1` and `reports-generated-visualization-specs-v1`; Dashboard/Reports rails normalize legacy payloads and perform best-effort canonical re-save, and backend write path auto-normalizes missing `schemaVersion`/`specVersion` before validation/upsert |
| Dashboard/Reports palette + canvas UX parity | Single palette section per workspace; collapsible Visualization palette + Canvas order with persisted pane state | Done | `frontend/src/components/layout/DashboardSnapshotCard.tsx`; `frontend/src/components/layout/ReportingWorkspaceCard.tsx`; local keys `ipoc.dashboard.*PaneExpanded` and `ipoc.reports.*PaneExpanded` |
| AI Incident Co-Pilot personalization durability | Preference persistence survives refresh/close via immediate local preference writes + dock state + unload/close flush + backend sync | Done | `frontend/src/components/agent/AssistantDock.tsx`; scopes `agent-assistant-preferences`; local keys `ipoc.agent.dock.preferences.v1` and `ipoc.agent.dock.state` |
| AI Incident Co-Pilot admin-access reliability | Admin controls unlock using role aliases + backend `canManagePolicy`; auth diagnostics expose role claims for verification | Done | `/api/v1/auth/me`; `/api/v1/auth/token-debug`; `/api/v1/agent/personalization/policy`; `CanManageAgentPersonalizationPolicy(...)` |
| Co-Pilot action button contrast | Active/expanded header icon buttons retain readable contrast in selected states | Done | `frontend/src/App.css` Co-Pilot header `.icon-btn` active/expanded/hover/focus rules |
| Governance dashboard unification | External provider trends/federation/scorecard analytics unified in reporting dashboard card | Done | `/api/v1/system/external-provider-health/trends`; `/api/v1/system/external-provider-health/federation/summary`; reporting surface now includes inline scorecard snapshot derived from trends provider summary in `frontend/src/components/layout/ReportingWorkspaceCard.tsx`; scorecard exports remain `/api/v1/reports/external-provider-health/scorecards/export/csv` and `/api/v1/reports/external-provider-health/scorecards/export/json` |
| Reports linked filter presets + drill-through persistence | Save/apply/delete linked filter profiles with drill-through state continuity | Done | `frontend/src/components/layout/ReportingWorkspaceCard.tsx`; scope `reports-linked-filter-presets-v1` |
| Reports executive KPI narrative panel | Command-grade narrative summary for current filter scope and KPI posture | Done | `frontend/src/components/layout/ReportingWorkspaceCard.tsx` |
| Dashboard linked filter threshold presets | Save/apply/delete dashboard-linked threshold profiles for readiness/compliance/degraded focus | Done | `frontend/src/components/layout/DashboardSnapshotCard.tsx`; scope `dashboard-linked-filter-presets-v1` |
| Dashboard executive KPI narrative panel | Threshold-aware executive narrative callout for dashboard posture | Done | `frontend/src/components/layout/DashboardSnapshotCard.tsx` |
| COP saved layer sets | Save/apply/delete map layer/stress/basemap/feed presets for map-first operations | Done | `frontend/src/components/cop/CommonOperatingPictureCard.tsx`; scope `cop-layer-set-presets` |
| COP AOI-to-layer linked presets | AOI preset optionally binds to layer-set preset for one-click map-state application | Done | `frontend/src/components/cop/CommonOperatingPictureCard.tsx`; AOI preset payload now includes `linkedLayerSetPresetId` / `linkedLayerSetPresetName` |
| COP map-driven handoff context payload | Map action handoff stores contextual AOI/layer/stress payload for downstream workspace continuity | Done | `frontend/src/components/cop/CommonOperatingPictureCard.tsx`; local key `ipoc.cop.commandHandoffContext`; payload now includes `copMapBaseLayer`, `copLiveOverlayFeedMode`, `aoiLinkedLayerSetPresetId`, `aoiLinkedLayerSetPresetName` |
| Incident workspace COP handoff context consumption | Incident workspace consumes COP handoff payload, surfaces dismissable handoff banner, and preserves parity with Planning/Operations/After Action context lifecycle controls | Done | `frontend/src/components/layout/IncidentWorkspaceCard.tsx`; key `ipoc.cop.commandHandoffContext` |
| COP handoff utility + freshness guardrail | Shared utility centralizes handoff read/clear operations with `generatedUtc` TTL enforcement and stale-payload auto-purge | Done | `frontend/src/utils/copHandoffContext.ts`; consumed by Incident/Planning/Operations/After Action modules |
| Planning workspace COP handoff context consumption | Planning workspace consumes COP handoff payload, primes cadence mode, and surfaces dismissable context banner | Done | `frontend/src/components/navigation/PlanningCycleCard.tsx`; key `ipoc.cop.commandHandoffContext` |
| Operations workspace COP handoff context consumption | Operations workspace consumes COP handoff payload, primes operations mode, and surfaces dismissable context banner | Done | `frontend/src/components/navigation/OperationsCoordinationCard.tsx`; key `ipoc.cop.commandHandoffContext` |
| After Action workspace COP handoff context consumption | After Action workspace consumes COP handoff payload, primes retrospective mode, and surfaces dismissable context banner | Done | `frontend/src/components/navigation/AfterActionReadinessCard.tsx`; key `ipoc.cop.commandHandoffContext` |
| No-code feature track | Feature removed from current build after UX rejection; implementation deferred for future redesign | Deferred | Removed frontend no-code canvas/designer surfaces and related references from active UI paths |
| Predictive model operational acceptance | Model metadata + governance acceptance checks | Done | `/api/v1/agent/planning/predictive-demand-supply/operational-acceptance` |
| Warning visualization palette compliance | Pastel-orange warning semantics (no yellow) in dashboard/reports visuals | Done | `frontend/src/App.css` warning tokens + dashboard/report warning badge/text usage |
| Cross-page label guidance coverage | Label-level info icon guidance (`LabelWithInfo`) across Reports/COP/Logistics/Operations/Planning/Finance/After Action/Dashboard/Incident/Admin/Assistant | Done | `frontend/scripts/ui-modernization-smoke.mjs` guidance assertions + workspace component label anchors |
| Reports interaction-workflow smoke hardening | Queue staging wiring, pending-selection toolbar wiring, batch decision wiring, and history replay guardrail assertions | Done | `frontend/scripts/ui-modernization-smoke.mjs` reports interaction assertions (`reports-decision-queue-*`, `reports-pending-approvals-*`) |
| Runnable reports interaction smoke harness | Scenario-level executable validation for queue staging, selection controls, batch decisions, and replay guardrails | Done | `frontend/scripts/reports-interaction-smoke.mjs`; npm scripts `smoke:reports` and `smoke:all` |
| Runnable execution-lane interaction smoke harness | Scenario-level executable validation for directive patching, dependency counts, and blocker-resolution pass behavior | Done | `frontend/scripts/execution-lane-interaction-smoke.mjs`; npm scripts `smoke:execution` and `smoke:all` |

### Latest Analytics Persistence Compatibility Update
- Added shared read-time normalization for legacy generated visualization specs missing `schemaVersion` / `specVersion` via `frontend/src/components/layout/visualizationPrompt.ts`.
- Added one-time best-effort canonical re-save on load for legacy server presets in:
  - `frontend/src/components/layout/DashboardSnapshotCard.tsx`
  - `frontend/src/components/layout/ReportingWorkspaceCard.tsx`
- Added backend write-path normalization for generated visualization preset scopes in `IPOC_WEB.Server/Program.cs` to inject missing `schemaVersion` / `specVersion` before validation and upsert.
- Net effect: older stored generated-spec JSON remains readable and is upgraded toward canonical versioned payloads without introducing a new persistence path.

### Latest Assistant Personalization + Admin Access Reliability Update
- AI Incident Co-Pilot personalization persistence now includes dedicated local preference durability (`ipoc.agent.dock.preferences.v1`) plus existing server preset sync to protect user style/theme settings across refresh even when larger dock-state payloads exceed local storage limits.
- Personalization state now flushes on dock close and browser unload/refresh to reduce stale-session loss windows.
- Assistant Administration gating now recognizes broader admin role aliases and honors backend policy capability (`canManagePolicy`) to prevent false disabled/greyed-out admin controls for authorized administrators.
- Dashboard/Reports palette UX updated to icon-based actions with descriptive tooltips, and Reports chart rendering now binds stroke/fill directly to selected palette values so color changes apply immediately and persist as expected.
- Reports template rail now presents a single Visualization palette section (duplicate block removed), aligned with Dashboard rail behavior.

### Latest Theme Studio Preset Expansion
- Added three new predefined Theme Studio templates in `frontend/src/theme.ts` to expand pastel/frosted/pearl choices:
  - `Pearl Cobalt Fog`
  - `Pastel Rosewater Cloud`
  - `Frost Silver Lagoon`

### Latest Competitive Recalibration + Differentiator Focus
- Competitive matrix recalibration has been published in `04_Competitive_and_RFP_Scored_Matrix.md` with execution-reality scoring and explicit competitive gap statement (overall posture 3.7, target 4.5+).
- Modernization plan next actions are now explicitly centered on highest-impact differentiation: Analytics/Dashboard/Reports depth and map-first COP AOI/layer workflow maturity.

### Latest UX Guidance + Reports Interaction Validation Continuation
- Cross-page label guidance rollout is now complete for the current high-impact workflow surfaces, including Dashboard Snapshot, Reporting workspace, Incident SITREP forms, and Admin governance workflows.
- Reports executive cockpit smoke coverage now includes deeper interaction-level assertions for:
  - decision queue stage-top3 + per-row stage-to-pending handler wiring,
  - pending-approval select-all/clear-all action wiring,
  - explicit batch decision wiring for Approved/Deferred/Rejected actions,
  - history replay success and out-of-scope guardrail notification semantics.
- Current execution posture: build + UI modernization smoke pass with these hardened assertions in place.

### Latest Admin Facility Snapshot Continuation
- Admin facility snapshot operations now include end-to-end command workflow depth:
  - Point-in-time facility snapshot API + modal visibility + CSV export evidence path.
  - Prompt kit generation controls (`Executive brief`, `Operations handoff`, `Facility status check`) with copy/download actions.
  - Computed risk-signal overlay (occupancy pressure, commitment pressure, data staleness, partial visibility) shown in-UI and included in generated prompt context.
  - Per-facility prompt template/text persistence for authenticated users via preset scope `admin-location-snapshot-prompts`.
  - Prompt freshness guardrail now surfaces stale-vs-current indicator against latest snapshot timestamps and carries generation metadata in exported prompt artifacts.

### Feature Rollback Note (No-Code)
- No-code implementation was removed from the current build due to failed UX acceptance.
- Prior no-code completion notes in this tracker are intentionally superseded by this rollback decision.

## Remaining Closure Workstreams (No Fine-Tune Scope)
1. **Multi-Environment Executive Packaging and Distribution Automation** — **Done**
	  - Deliverable completed: recurring governance packet generation now executes with configurable transport automation baseline (`None`, `DirectoryCopy`, `Webhook`) plus retry/backoff policy and delivery evidence fields (destination/artifact/attempt count/outcome) surfaced through automation run/status payloads.
	  - Exit achieved: hosted scheduler + manual run endpoint + transport execution/retry evidence baseline are implemented; smoke gate now validates automation status/run endpoint reachability and transport evidence payload contracts; strict-auth evidence script (`Run_ExecutivePacket_Automation_StrictAuth_Validation.ps1`) and transport onboarding script (`Run_ExecutivePacket_Transport_Onboarding_Validation.ps1`) are available for bearer-token acceptance capture; deployment-specific destination onboarding remains an operational runbook task.

## Demo Readiness Summary
- **Internal/Executive Demo**: **Ready (High confidence)**
- **External Competitive Demo**: **Ready (High confidence)**
	- Cross-environment analytics federation baseline is now in place via environment-aware SQL telemetry warehousing (`EnvironmentName` dimension), warehouse history environment filtering, and federation summary endpoint (`/api/v1/system/external-provider-health/federation/summary`) with smoke-gate validation.
	- Remaining go-live advantage work is now limited to environment-specific destination onboarding/credential operations for the completed transport automation baseline.
	- Core prior dependencies (COP/GIS external fusion, resource/healthcare parity, collaboration + AAR/HVA closure) are complete and now baselineed into the demo posture.

## Immediate Sprint Recommendation
1. Validate destination-specific onboarding in staging for selected transport targets (distribution directory workflow, webhook/workflow endpoint, or email/sharepoint handoff adapter).
2. Execute runbook acceptance in staging with forced failure simulation to verify retry and terminal failure evidence capture.

## Security Hardening Active Artifacts
- Endpoint authorization/audit coverage matrix: `14_Endpoint_Authorization_Audit_Coverage_Matrix.md`
- Compliance runbook (managed identity rotation/verification + telemetry gate): `08_Compliance_Evidence_and_Operational_Runbook.md`
- Deferred hardening checklist tracker: `Deferred_Fine_Tuning_Backlog.md` (Security & Compliance Hardening Checklist section)

### Latest Security/Compliance Closeout Snapshot
- Local strict-auth evidence capture is complete for executive packet automation admin endpoints via:
  - `Run_ExecutivePacket_Automation_StrictAuth_Validation.ps1`
  - Evidence artifact under `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/`
- Remaining closure scope is operational attestation and staging signoff evidence:
  - staging token-enabled smoke + strict-auth run logs,
  - Conditional Access/MFA + access review evidence,
  - data protection/log-safety attestation,
  - retention/tamper-evidence + tabletop drill package.

## Execution-Ready Checklist — Multi-Environment Executive Packaging & Distribution

### Transport Targets
- Define primary transport per environment: `Email`, `SharePoint`, or `Workflow/Webhook`.
- Configure destination identifiers per environment (distribution list, SharePoint library/folder, workflow endpoint).
- Define ownership and escalation contact for each destination.
- Confirm artifact naming convention and retention policy alignment (`environment`, `window`, `generatedUtc`).

### Retry Policy
- Immediate retry: up to 3 attempts per failed transport action.
- Backoff strategy: exponential (e.g., 30s, 90s, 180s) with jitter.
- Terminal handling: mark run `Failed` after max retries and emit auditable failure record.
- Recovery: allow manual rerun via `/api/v1/admin/external-provider/executive-packet/automation/run` with same payload scope.

### Runbook Acceptance Criteria
- Automation status endpoint reports configured cadence, last run, and last outcome:
  - `/api/v1/admin/external-provider/executive-packet/automation/status`
- On-demand run endpoint successfully generates packet and executes configured transport:
  - `/api/v1/admin/external-provider/executive-packet/automation/run`
- Delivery evidence captured per run: destination, artifact id/name, success/failure, retry count, and timestamp.
- Failure path validated: one forced transport failure produces retry attempts and terminal auditable failure state.
- Operator runbook published with:
  - how to rotate transport credentials,
  - how to pause/resume automation,
  - how to execute manual rerun,
  - how to verify delivery/audit evidence.
