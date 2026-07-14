# Deferred Fine-Tuning Backlog

## Scope
This file tracks non-blocking polish items deferred to keep current sprint focus on core MVP features and production-operable functionality.

## Deferred Items
1. Resource lifecycle KPI visual refinement
   - Convert the current compact text summary into small grouped cards/chips with clearer hierarchy and spacing.
2. Resource workflow guidance copy tuning
   - Refine helper tooltip/text phrasing for Assigned Quantity and status transitions based on operator usability testing.
3. Resource status transition guardrails UX
   - Add inline client-side hints before save (status vs assigned quantity mismatches) to reduce round trips to server validation.
4. Resource lifecycle export enhancement
   - Add a dedicated resource lifecycle summary CSV export (separate from request-row export).
5. Communication lifecycle summary parity polish
   - Align resource and communication lifecycle blocks into a shared visual pattern for consistency.
6. COP geospatial map overlay integration
   - Replace table-first COP with map-first rendering (AOI polygon/layer overlays, incident markers, and status symbology).
7. COP live telemetry and staleness indicators
   - Add auto-refresh cadence controls and age indicators per location rollup to highlight stale data.
8. COP advanced filters and saved views
   - Add severity/status filters, quick AOI chips, and persisted named COP presets.
9. Audit evidence detail drill-down UX
   - Add expandable row/details panel for formatted `DetailJson` with safe truncation/pretty-print controls.
10. Audit evidence aggregation dashboard widgets
   - Add trend/group charts for category/action/outcome and top actors for command-level evidence review.
11. AAR/HVA evidence package automation
   - Add export bundling for incident-scoped audit evidence snapshots and starter AAR/IP worksheet generation.
12. AI-assisted visualization planning (Dashboard/Reports)
	- Introduce optional server-side generative AI planning for Agent visualization prompts (Azure OpenAI-backed), returning canonical `VisualizationSpec` with confidence/trace metadata.
13. Hybrid prompt engine fallback policy
	- Implement AI-first planning with deterministic parser fallback when AI is unavailable, low-confidence, or policy-blocked, while preserving current persistence/validation contracts.
14. Prompt explainability and operator controls
	- Add per-prompt rationale panel (why selected widgets/time-grain/grouping) and a toggle to force deterministic mode for governance or incident drill scenarios.

## Notes
- These items are intentionally deferred and are not blockers for MVP operability.
- Revisit after completing core phased slices in `03_Current_Implementation_Status_and_Next_Sprint.md`.

## Security & Compliance Hardening Checklist (RFP + HIPAA/HITRUST-Ready)

### Phase 1 — Critical Risk Burn-Down (Immediate)
- [x] Remove hardcoded Azure AI API keys from source-controlled appsettings.
- [x] Set managed identity as default for Azure OpenAI and Azure AI Search config.
- [x] Add startup fail-fast validation to block API-key auth in production when Azure AI integrations are enabled.
- [ ] Rotate all previously exposed credentials and invalidate old keys in Azure immediately.
- [ ] Move all secrets to Azure Key Vault + managed identity retrieval paths.

### Phase 2 — Identity, Access, and Boundary Controls
- [x] Enforce strict JWT validation in non-development (issuer/audience/lifetime/signing keys).
- [x] Verify no development token relaxation flags can be enabled in production deployment artifacts.
- [x] Run endpoint-by-endpoint authorization matrix and close any policy coverage gaps.
- [x] Capture strict-auth bearer-token endpoint validation evidence for executive packet automation admin controls (`Run_ExecutivePacket_Automation_StrictAuth_Validation.ps1`, 2026-07-12 local execution artifact).
- [ ] Implement/verify Conditional Access + MFA enforcement for privileged operational roles.
- [ ] Add periodic access review checklist (admin/data-ops roles).

### Phase 3 — Data Protection (At Rest / In Transit / In Use)
- [ ] Verify TLS 1.2+ everywhere and document cipher/TLS posture.
- [ ] Confirm database/storage encryption-at-rest controls and key ownership model.
- [ ] Define and enforce data classification for all persisted payload categories.
- [x] Add masking/redaction policy implementation for sensitive fields in logs, exports, and diagnostics.
- [ ] Validate integration payload contracts remain PHI-excluded per RFP constraints.

### Phase 4 — Audit, Logging, and Observability Completeness
- [x] Build audit coverage map for all write/privileged/export/auth-sensitive endpoints.
- [x] Add missing audit events with actor, action, scope, target, outcome, correlation/trace id.
- [x] Enable production telemetry export path (OTLP/Azure Monitor) with retention + access controls.
- [x] Add detection rules/alerts for auth failures, privilege changes, anomalous export volume, and repeated integration failures.
- [ ] Validate logs do not contain secrets/tokens/sensitive payload fragments.

### Phase 5 — Retention, Evidence, and Operational Readiness
- [ ] Define and enforce retention schedules for audit logs, exports, and telemetry.
- [ ] Add immutable or tamper-evident evidence storage path for critical audit artifacts.
- [ ] Produce control-evidence runbook for RFP/HIPAA/HITRUST audits (technical + operational proof points).
- [ ] Execute tabletop incident-response drill for unauthorized access and data-exposure scenarios.
- [ ] Final readiness gate: security/compliance signoff checklist before production cutover.

## Immediate Core Closeout Actions (Highest Impact)

### Action Pack A — Identity + Access Governance Evidence
1. Capture Conditional Access and MFA policy evidence for privileged roles (LookupAdmin, DataOpsAdmin, System/Admin operators).
2. Archive periodic access review output (review date, approver, revoked/retained assignments).
3. Attach evidence artifact references to `12_Release_Gate_Closeout_Checklist.md` under Security + Authorization Gate.

### Action Pack B — Data Protection Attestation Evidence
1. Capture TLS 1.2+ posture and approved cipher suite evidence from staging/prod ingress.
2. Capture encryption-at-rest attestation for SQL/storage and key ownership model.
3. Publish PHI-exclusion contract attestation for integration payload classes and export surfaces.

### Action Pack C — Logging/Observability Safety Evidence
1. Execute sensitive endpoint traffic test and confirm telemetry/logs do not contain secrets/tokens.
2. Capture alert-rule evidence for auth failures, privilege-change, anomalous export activity, and integration failures.
3. Archive telemetry retention/access-control settings for OTLP/Azure Monitor destination.

### Action Pack D — Release Readiness Finalization
1. Define retention schedule table (audit logs, evidence exports, telemetry history) with owner and retention period.
2. Define immutable/tamper-evident storage path for critical audit artifacts.
3. Execute tabletop incident-response drill and archive outcome summary + remediation actions.
4. Complete final security/compliance signoff in `12_Release_Gate_Closeout_Checklist.md`.
