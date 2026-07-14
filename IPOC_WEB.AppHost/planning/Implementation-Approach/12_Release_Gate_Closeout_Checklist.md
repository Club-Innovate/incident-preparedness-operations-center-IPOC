# Release Gate Closeout Checklist

## Scope
Final pre-production gate and cutover checklist for IPOC_WEB release readiness.

## Inputs / Evidence Sources
- `IPOC_WEB.AppHost/planning/Implementation-Approach/Run_Local_Smoke_Gate.ps1`
- `IPOC_WEB.AppHost/planning/Implementation-Approach/08_Compliance_Evidence_and_Operational_Runbook.md`
- `IPOC_WEB.AppHost/planning/Implementation-Approach/11_Master_Checkoff_Matrix.md`
- `IPOC_WEB.AppHost/planning/Implementation-Approach/Security_Compliance_Evidence_Index.md`

## Exit Criteria
1. Smoke gate passes in staging with token-enabled protected endpoint checks.
2. Release evidence bundle is archived for the candidate.
3. Staging signoff is documented with approver/date.

## Checklist

### 1) Pre-Prod Environment Readiness
- [ ] Staging environment URL, build version, and deployment timestamp captured.
- [ ] SQL connection/readiness endpoint validated (`/api/v1/system/readiness`).
- [ ] Auth configuration validated (Entra authority/audience and token issuance path).

### 2) Security + Authorization Gate
- [ ] Run smoke gate script with frontend authorization smoke enabled.
- [ ] Capture explicit smoke statuses:
  - Frontend authorization smoke status
  - Backend report-presets policy alignment smoke status
- [ ] Validate protected endpoint behavior:
  - no token = 401 (or documented development bypass behavior where applicable)
  - with token = 200

### 3) Operational Workflow Gate
- [ ] Validate IAP governance flow in staging (approve/reopen/export guardrails).
- [ ] Validate COP external readiness diagnostics endpoint returns expected payload.
- [ ] Validate COP command handoff continuity across Incident/Planning/Operations/After Action modules (publish, consume, dismiss, clear).
- [ ] Validate COP handoff freshness guardrail behavior (stale `generatedUtc` payload is ignored and purged).
- [ ] Validate communication baseline dispatch and evidence export (if scenario data is present).
- [ ] Validate resource evidence export and regional rollup export (if scenario data is present).

### 4) Admin / Compliance Gate
- [ ] Validate session compliance evidence export (`/api/v1/admin/sessions/compliance-evidence/export/json`).
- [ ] Validate impersonation controls:
  - start endpoint: `/api/v1/admin/sessions/{userSessionId}/impersonate/start`
  - stop endpoint: `/api/v1/admin/sessions/{userSessionId}/impersonate/stop`
- [ ] Validate termination endpoint remains functional:
  - `/api/v1/admin/sessions/{userSessionId}/terminate`
- [ ] Confirm audit events exist for key admin lifecycle actions.

### 5) Evidence Package Assembly
- [ ] Build output archived (`dotnet build` logs).
- [ ] Smoke gate output archived (full console log).
- [ ] Key export artifacts archived (IAP governance, session compliance, resource/communication evidence where executed).
- [ ] Authorization matrix/checklist artifacts archived.

### 6) Cutover Readiness + Signoff
- [ ] Rollback strategy reviewed and owner identified.
- [ ] On-call / incident response contacts confirmed.
- [ ] Go/No-Go decision recorded.
- [ ] Staging signoff recorded.

## Signoff Record
- Release Candidate: Local-RC-2026-07-10
- Environment: Local Validation Gate (`http://localhost:5459`)
- Smoke Gate Execution Time (UTC): 2026-07-10
- Approver Name/Role: Engineering Validation (GitHub Copilot-assisted execution)
- Decision: Go (Local Gate)
- Notes: Full smoke gate executed with frontend authorization smoke enabled; readiness/authz/report-presets policy alignment checks passed.

## Latest Execution Snapshot
- Date: 2026-07-10 (local execution)
- Command:
	- `pwsh -NoProfile -File .\IPOC_WEB.AppHost\planning\Implementation-Approach\Run_Local_Smoke_Gate.ps1 -ApiBaseUrl http://localhost:5459`
- Result: Passed
- Observations:
  - Readiness and weather endpoints passed.
  - Protected endpoint checks behaved as expected without bearer token (`401`).
	- Frontend authorization smoke passed.
  - Backend report-presets policy alignment smoke passed.
  - Generated visualization report-preset compatibility hardening is in place: legacy payloads missing `schemaVersion` / `specVersion` are normalized in frontend rails and auto-normalized server-side before validation/upsert.
- Remaining for final gate closure:
  - Execute token-enabled staging run and archive output as the deployment-time counterpart to this local gate.

## Latest Strict-Auth Evidence Snapshot
- Date: 2026-07-12 (local execution)
- Command:
	- `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_ExecutivePacket_Automation_StrictAuth_Validation.ps1 -ApiBaseUrl https://localhost:7435`
- Result: Passed
- Evidence Artifact:
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/executive-packet-strict-auth-validation-20260712-073926.json`
- Observations:
	- Admin executive packet automation status endpoint validated with bearer-token path and required transport evidence fields.
	- Admin executive packet automation manual run endpoint validated with required transport evidence fields.
	- Local strict-auth evidence is now captured; remaining release gate dependency is staging token-enabled execution and environment signoff.

## Latest UI Modernization Smoke Snapshot
- Date: 2026-07-12 (local execution)
- Command:
	- `node frontend/scripts/ui-modernization-smoke.mjs`
- Result: Passed
- Observations:
	- COP handoff continuity assertions now validate shared utility consumption across Incident/Planning/Operations/After Action modules.
	- COP freshness guardrail assertions validate TTL-based stale payload purge behavior (`generatedUtc`, 12-hour max age).
	- Legacy smoke assertions were aligned to current UI implementation labels/wiring (Logistics map fit controls and AssistantDock Azure connection status labels).
	- Incident evidence blocker remediation assertions now validate one-click operator routing contracts (Resources / Operational Periods / SITREP) in command workflow surfaces.
	- Reports executive decision cockpit assertions now validate comparative drill-through controls, decision queue/risk timeline modules, and cross-workspace handoff actions (Incidents/Planning/Operations/After Action).
	- Reports executive decision queue now validates one-click handoff-and-navigate wiring from reports to downstream workspaces via app-shell view routing callback.
	- Reports pending approvals module now validates confidence-labeled recommendation controls and recommendation drill-through action wiring.
	- Reports pending approvals decision workflow now validates approve/defer/reject action anchors and decision-persistence scope wiring.
	- Reports pending approvals trend visualization now validates decision trend card/chart anchors (Approved/Deferred/Rejected + total decisions trajectory).
	- Reports pending approvals rationale workflow now validates rationale input/display anchors and persisted rationale continuity behavior.
	- Reports pending approvals executive summary workflow now validates export action anchor and export filename wiring for decision+rationale CSV output.
	- Reports pending approvals export workflow now validates export mode selector anchor and metadata-enriched CSV generation wiring.
	- Reports pending approvals export workflow now validates empty-rationale toggle behavior and `IncludeEmptyRationale` metadata capture.
	- Reports pending approvals cockpit now validates confidence-floor triage, row selection controls, batch decision actions, and batch handler wiring anchors.
	- Reports workspace layout remediation now validates that pending-approval trend and batch cockpit render in dedicated row containers without KPI-column overlap.
	- Reports decision history replay now validates persisted history scope consumption, replay action wiring, and dedicated history panel anchors.
	- Tooltip rendering standard now validates left-aligned tooltip content in shared icon-action and global tooltip surfaces.
	- Reports unified queue-to-pending rail now validates stage-top3 and per-row staging controls with handler wiring and triage continuity behavior.
	- Cross-page label guidance now validates `LabelWithInfo` coverage for key workspace controls (Reports/COP/Logistics/Operations/Planning/Finance/After Action/Assistant settings).
  - Finance/Admin container guidance now validates execution-lane title and lane capability tooltip metadata for FEMA reimbursement, procurement orchestration, and admin governance/audit checkpoints.
  - Finance/Admin checkpoint actions section now validates descriptive `LabelWithInfo` guidance anchor coverage.
  - Dashboard Snapshot guidance now validates `LabelWithInfo` coverage for palette semantics and prompt/template control labels.
  - Reporting workspace guidance now validates `LabelWithInfo` coverage for favorite-template and agent-prompt control labels.
  - Incident SITREP guidance now validates `LabelWithInfo` coverage for operational period, summary, current/planned actions, and unmet needs labels.
  - Admin workspace guidance now validates `LabelWithInfo` coverage for user provisioning, role-assignment rationale, facility geolocation metadata, and synthetic data confirmation labels.
  - Reports interaction smoke now validates queue staging handler wiring, pending-selection toolbar action wiring, batch decision wiring, and replay notification guardrails.
  - Runnable Reports interaction smoke harness now validates scenario-level decision workflow behavior (`smoke:reports`) and is included in aggregate frontend smoke execution (`smoke:all`).
  - Runnable execution-lane interaction smoke harness now validates dependency-aware directive workflow behavior (`smoke:execution`) and is included in aggregate frontend smoke execution (`smoke:all`).
	- Operations workspace now supports visible in-selector typeahead capture via dedicated textbox input (`operations-focused-incident-typeahead-input`) synchronized with focused-incident selector filtering/jump behavior.
	- UI modernization smoke now validates Operations focused-incident selector anchors for visible textbox typeahead + live summary + selector continuity.
	- Reports pending-approval batch action controls now render as a one-row, non-wrapping icon strip with pastel action styling, hover affordance, and no yellow defer emphasis.
	- Reports pending-approval action rail hover behavior now scales icon glyphs (not button boxes) to prevent horizontal-scroll jitter during hover interactions.
	- Shared icon tooltip rendering behavior now includes stability hardening to reduce sporadic far-left tooltip placement in dense action surfaces.
	- Admin General > Cache now exposes requested-vs-runtime Redis mode visibility and persisted cache-mode controls backed by `/api/v1/admin/cache/mode` (GET/PUT).
	- Admin cache-mode save path now performs a best-effort Docker Compose Redis startup attempt (`docker compose up -d redis`) and surfaces attempt outcome details to operators.
	- Planning focused-incident selector now refreshes Planning Cycle Command Board subsection metrics deterministically without stale incident carryover.
	- App operational bootstrap load loop was reduced (incident-switch no longer re-triggers full bootstrap), improving cross-workspace runtime responsiveness.
  - Incident-context API read paths now include short-lived dedupe/cache + mutation invalidation and parallelized incident detail/dataset load startup to improve perceived runtime responsiveness.
  - Admin General workspace now includes operator-facing API timing diagnostics toggle (`ipoc.api.timing.debug`) for runtime performance triage without developer-tool-only workflow.
	- Admin User bulk import now runs server-side (`/api/v1/admin/users/import/csv`) with centralized validation and audit evidence.
  - Admin User bulk import now supports optional update-existing mode for create-or-update identity reconciliation with explicit created/updated run telemetry.
  - Admin Facility geolocation workflow now includes auditable point-in-time facility snapshot visibility (`/api/v1/admin/locations/{locationId}/snapshot`) with resource/bed posture metrics.
  - Admin Facility snapshot workflow now includes auditable CSV evidence export (`/api/v1/admin/locations/{locationId}/snapshot/export/csv`) for release packet capture.
  - Admin Facility snapshot workflow now includes prompt-kit generation controls (standard templates + copy/download) for ad-hoc and standardized point-in-time facility prompt operations.
  - Admin Facility snapshot workflow now includes operator-facing risk-signal badges and prompt-integrated signal context (occupancy pressure, commitment pressure, staleness, partial visibility).
  - Admin Facility snapshot prompt-kit workflow now persists prompt template/text per facility (`admin-location-snapshot-prompts`) for authenticated operator continuity.
  - Admin Facility prompt workflow now includes freshness guardrail indicator and generated timestamp metadata to flag stale prompt context before reuse/export.
  - Admin Facility geolocation updates now persist and rehydrate City/State/Postal metadata across admin location read/query surfaces (no null placeholder fallback on reload).
  - Admin Facility snapshot payload now fuses facility profile metadata (name/org/region/address/status) with resource/bed posture metrics for single-view account+operations context.
  - Admin Facility snapshot CSV evidence export now includes profile metadata plus computed occupancy/commitment percentages for normalized executive/release packet analysis.
  - Admin Facility snapshot workflow now includes structured JSON evidence export (`/api/v1/admin/locations/{locationId}/snapshot/export/json`) with auditable export event traceability.
  - Weather feed runtime now supports dynamic incident-context resolution with administrator default fallback controls (Admin General tab + persisted `admin-weather` preset scope + local continuity key `ipoc.weather.defaultLocation`).
  - Weather endpoint query contract now supports explicit fallback inputs (`defaultLocationId`, `defaultCity`, `defaultState`, `defaultPostalCode`) and was validated with HTTP 200 runtime checks for incident and default-only scenarios.
  - Admin weather default persistence now includes hydrate-gated autosave protection, explicit save-state telemetry (Loading/Saving/Saved/Save failed), and saved timestamp feedback for operator confirmation.
  - Weather operational context is now rendered across Incident/COP/Planning/Logistics modules via shared signal adapters (tactical forecast context, overlay/weather risk cueing, trend planning signal, logistics disruption indicator).
	- Admin User CSV reject-report export now runs server-side (`/api/v1/admin/users/import/csv/reject-report`) with auditable download path.
  - Frontend TS6133 build blockers were remediated in dashboard/incident/operations/planning surfaces, restoring clean frontend build pipeline continuity.
	- Production-style demo data preparation script now runs with AAD connection strings using SQL client/token fallback logic and idempotent schema-init skip behavior on pre-initialized environments.
	- Scenario-driven demo-data prep now validates deterministic SURGE posture generation (`Prepare-ProductionStyle-DemoData.ps1`) with verification summary counts.
	- User-guide enablement artifact now includes `13_User_Guide_Outline_and_Authoring_Plan.md` for phased tutorial-quality documentation rollout.

## Latest Frontend Aggregate Smoke Snapshot
- Date: 2026-07-14 (local execution)
- Commands:
	- `npm run smoke:ui --prefix frontend`
	- `npm run smoke:all --prefix frontend`
- Result: Passed
- Observations:
	- UI modernization smoke passed after weather persistence hardening and cross-workspace weather adapter rollout.
	- Aggregate smoke suite passed (`smoke:authz`, `smoke:ui`, `smoke:assistant-personalization`, `smoke:assistant-personalization-api`, `smoke:reports`, `smoke:execution`, `smoke:after-action-replay`).
	- npm emitted non-blocking warning `Unknown env config "metrics-registry"`; no smoke failures were caused by this warning.

## Staging Execution Capture (Pending)
- Staging API Base URL: `https://webfrontend-ipoc-web.dev.localhost:51009/`
- Execution Date (UTC): `2026-07-13T<hh:mm:ssZ>`
- Operator: `Hans Esquivel (hans.esquivel@bottegadata.com)`
- Bearer Token Source: `Current token retrieval approach (Entra token path used by existing scripts)`

### Staging Command Run Record
1. Token-enabled smoke gate
   - Command:
	 - `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_Local_Smoke_Gate.ps1 -ApiBaseUrl https://webfrontend-ipoc-web.dev.localhost:51009/ -BearerToken <token>`
   - Result: `<Passed|Failed>`
	  - Artifact: `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/staging-smoke-gate-20260713-<hhmmss>.log`

2. Strict-auth executive packet validation
   - Command:
	 - `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_ExecutivePacket_Automation_StrictAuth_Validation.ps1 -ApiBaseUrl https://webfrontend-ipoc-web.dev.localhost:51009/ -BearerToken <token>`
   - Result: `<Passed|Failed>`
	  - Artifact: `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/executive-packet-strict-auth-validation-staging-20260713-<hhmmss>.json`

3. Optional transport onboarding validation
   - Command:
	 - `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_ExecutivePacket_Transport_Onboarding_Validation.ps1 -ApiBaseUrl https://webfrontend-ipoc-web.dev.localhost:51009/ -BearerToken <token> -ValidationMode <DirectoryCopy|WebhookSuccess|WebhookFailure>`
   - Result: `<Passed|Failed|Skipped>`
	  - Artifact: `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/executive-packet-transport-validation-staging-20260713-<mode>-<hhmmss>.log`

4. Admin cache-mode runtime evidence capture
   - Command:
	 - `pwsh -NoProfile -Command "$token='<token>'; $headers=@{ Authorization = \"Bearer $token\" }; Invoke-RestMethod -Method Get -Uri 'https://webfrontend-ipoc-web.dev.localhost:51009/api/v1/admin/cache/mode' -Headers $headers | ConvertTo-Json -Depth 8 | Set-Content 'IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-before.json'; Invoke-RestMethod -Method Put -Uri 'https://webfrontend-ipoc-web.dev.localhost:51009/api/v1/admin/cache/mode' -Headers ($headers + @{ 'Content-Type'='application/json' }) -Body '{\"cacheUseRedisRequested\":true}' | ConvertTo-Json -Depth 8 | Set-Content 'IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-enable.json'; Invoke-RestMethod -Method Get -Uri 'https://webfrontend-ipoc-web.dev.localhost:51009/api/v1/admin/cache/mode' -Headers $headers | ConvertTo-Json -Depth 8 | Set-Content 'IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-after.json'"`
   - Result: `<Passed|Failed>`
   - Artifact:
	 - `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-before.json`
	 - `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-enable.json`
	 - `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-after.json`

### Staging Signoff Placeholder
- Approver Name/Role: `Hans Esquivel (hans.esquivel@bottegadata.com)`
- Decision: `Pending staging execution`
- Notes: `Pending token-enabled staging smoke/strict-auth/cache-mode evidence capture and artifact path substitution.`

## Final Release Evidence Bundle Index (To Populate)
- Bundle Root: `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/`
- Build Log:
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/dotnet-build-20260712-170035.log`
- Smoke Gate Log (token-enabled staging run):
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/staging-smoke-gate-20260713-<hhmmss>.log`
- Strict-Auth Validation Evidence JSON:
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/executive-packet-strict-auth-validation-20260712-073926.json` (local)
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/executive-packet-strict-auth-validation-staging-20260713-<hhmmss>.json` (staging)
- UI Modernization Smoke Log:
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/ui-modernization-smoke-20260712-170210.log`
- Frontend Aggregate Smoke Execution (latest local run):
	- `npm run smoke:ui --prefix frontend` (2026-07-14, passed)
	- `npm run smoke:all --prefix frontend` (2026-07-14, passed)
- Admin cache mode evidence (requested/runtime + Docker telemetry):
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-before.json`
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-enable.json`
	- `IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-after.json`
- IAP Governance Evidence Export:
	- `<relative-path-to-iap-governance-evidence-json>`
- Session Compliance Evidence Export:
	- `<relative-path-to-session-compliance-evidence-json>`
- Resource / Communications Evidence Exports (if executed):
	- `<relative-path-to-resource-evidence-artifact>`
	- `<relative-path-to-communications-evidence-artifact>`
- Identity Governance Attestation Package:
	- `<relative-path-to-conditional-access-mfa-evidence>`
	- `<relative-path-to-access-review-signoff>`
- Data Protection + Log Safety Attestation Package:
	- `<relative-path-to-infra-security-posture-export>`
	- `<relative-path-to-data-protection-attestation-memo>`
	- `<relative-path-to-log-scan-report>`
- Retention / Tamper-Evidence + Tabletop Package:
	- `<relative-path-to-retention-policy-table>`
	- `<relative-path-to-storage-design-owner-signoff>`
	- `<relative-path-to-tabletop-exercise-summary>`

## Gate Completion Quick Check
- [ ] Staging smoke gate executed with archived artifact (pending staging token run).
- [x] Local strict-auth command executed with archived artifact (`executive-packet-strict-auth-validation-20260712-073926.json`).
- [x] Local build + UI modernization smoke artifacts archived (`dotnet-build-20260712-170035.log`, `ui-modernization-smoke-20260712-170210.log`).
- [x] Weather persistence and cross-workspace adapter compile validation completed (`npm run build --prefix frontend`, `dotnet build IPOC_WEB.slnx`).
- [ ] Staging signoff block populated with approver, decision, and notes.
- [ ] Evidence bundle index fully populated with concrete relative paths.
- [ ] Remaining high-impact blocker artifacts attached or explicitly waived with owner/date.

## Next Steps Summary (Release Closeout)
1. Execute staging token-enabled smoke + strict-auth commands and replace all remaining `<staging-url>` / artifact placeholders with concrete paths.
2. Capture and attach staging evidence for Incident remediation-link workflow outcomes (blocked state -> action click -> target tab/section reached).
3. Capture and attach staging evidence for Admin cache-mode requested-vs-runtime workflow (`/api/v1/admin/cache/mode`) including Docker startup-attempt telemetry verification.
4. Capture and attach staging evidence for Admin user bulk CSV import and reject-report workflows (`/api/v1/admin/users/import/csv`, `/api/v1/admin/users/import/csv/reject-report`).
5. Populate staging signoff block (approver, decision, notes) and complete evidence bundle index path resolution.
6. Close or waive remaining high-impact blockers with explicit owner/date and final attestation artifacts.

## No-Code Rollback Decision
- No-code feature was removed from the current build after UX rejection.
- Any prior no-code UX correction notes are obsolete and should not be used as release evidence.

## Remaining High-Impact Blockers (Core Closeout)

1. **Staging token-enabled smoke and strict-auth run evidence**
   - Required completion:
	 - Run `Run_Local_Smoke_Gate.ps1` in staging with bearer token path.
	 - Run `Run_ExecutivePacket_Automation_StrictAuth_Validation.ps1` in staging.
   - Required artifacts:
	 - Full smoke gate console log
	 - Strict-auth evidence JSON artifact path

2. **Identity governance operational attestation**
   - Required completion:
	 - Conditional Access + MFA proof for privileged roles.
	 - Access review evidence package (admin/data-ops scopes).
   - Required artifacts:
	 - Tenant policy screenshots/exports
	 - Access review signoff record

3. **Data protection + log safety attestation**
   - Required completion:
	 - TLS/cipher and encryption-at-rest evidence capture.
	 - PHI-exclusion payload/export attestation.
	 - Log safety verification showing no secret/token leakage.
   - Required artifacts:
	 - Infra security posture export
	 - Data protection attestation memo
	 - Log scan output / detection report

4. **Retention/tamper-evidence + incident readiness**
   - Required completion:
	 - Retention schedule finalized for audit logs/exports/telemetry.
	 - Tamper-evident storage path documented.
	 - Tabletop incident drill completed with corrective action list.
   - Required artifacts:
	 - Retention policy table
	 - Evidence storage design/owner signoff
	 - Tabletop exercise summary

## Execution Commands (Staging)
- Smoke gate (token-enabled):
	- `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_Local_Smoke_Gate.ps1 -ApiBaseUrl https://webfrontend-ipoc-web.dev.localhost:51009/ -BearerToken <token>`
- UI modernization handoff reliability smoke:
  - `node frontend/scripts/ui-modernization-smoke.mjs`
- Strict-auth executive packet validation:
	- `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_ExecutivePacket_Automation_StrictAuth_Validation.ps1 -ApiBaseUrl https://webfrontend-ipoc-web.dev.localhost:51009/ -BearerToken <token>`
- Admin cache-mode evidence capture (requested/runtime + Docker startup telemetry):
	- `pwsh -NoProfile -Command "$token='<token>'; $headers=@{ Authorization = \"Bearer $token\" }; Invoke-RestMethod -Method Get -Uri 'https://webfrontend-ipoc-web.dev.localhost:51009/api/v1/admin/cache/mode' -Headers $headers | ConvertTo-Json -Depth 8 | Set-Content 'IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-before.json'; Invoke-RestMethod -Method Put -Uri 'https://webfrontend-ipoc-web.dev.localhost:51009/api/v1/admin/cache/mode' -Headers ($headers + @{ 'Content-Type'='application/json' }) -Body '{\"cacheUseRedisRequested\":true}' | ConvertTo-Json -Depth 8 | Set-Content 'IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-enable.json'; Invoke-RestMethod -Method Get -Uri 'https://webfrontend-ipoc-web.dev.localhost:51009/api/v1/admin/cache/mode' -Headers $headers | ConvertTo-Json -Depth 8 | Set-Content 'IPOC_WEB.AppHost/planning/Implementation-Approach/evidence/admin-cache-mode-after.json'"`
- Transport onboarding validation (as configured):
	- `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_ExecutivePacket_Transport_Onboarding_Validation.ps1 -ApiBaseUrl https://webfrontend-ipoc-web.dev.localhost:51009/ -BearerToken <token> -ValidationMode DirectoryCopy`
  - `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_ExecutivePacket_Transport_Onboarding_Validation.ps1 -ApiBaseUrl https://webfrontend-ipoc-web.dev.localhost:51009/ -BearerToken <token> -ValidationMode WebhookSuccess`
  - `pwsh IPOC_WEB.AppHost/planning/Implementation-Approach/Run_ExecutivePacket_Transport_Onboarding_Validation.ps1 -ApiBaseUrl https://webfrontend-ipoc-web.dev.localhost:51009/ -BearerToken <token> -ValidationMode WebhookFailure`
