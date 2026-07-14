# Compliance Evidence and Operational Runbook (HIPAA/HITRUST Readiness Posture)

## Scope
This runbook defines technical evidence and operational procedures for IPOC_WEB readiness against EVT0010848 security/monitoring requirements and HIPAA/HITRUST-aligned controls.

## Important Constraint
Formal HIPAA/HITRUST certification requires organizational governance, documented policies/procedures, control operation evidence, and third-party assessment. This runbook addresses implementation and operational evidence preparation in this repository.

## 1. Security Control Evidence Checklist

### Authentication and Access
- Evidence
  - Entra JWT auth config (`Program.cs`)
  - Authorization policies (`Infrastructure/Security/AuthorizationPolicies.cs`)
  - Admin auth diagnostics tab in Admin Workspace
- Verification steps
  1. Confirm protected endpoints require authorization policies.
  2. Verify MFA policy enforcement in identity platform (external evidence artifact).
  3. Validate sign-in/out audit events appear in `audit.AuditEvent`.

### Audit Logging
- Evidence
  - Durable writer: `Infrastructure/Security/AuditEventWriter.cs`
  - Auth audit endpoints: `/api/v1/auth/audit/login`, `/api/v1/auth/audit/logout`
	- Token diagnostics audit endpoint: `/api/v1/auth/token-debug` -> `AUTH/TOKEN_DEBUG_VIEW`
  - Agent policy history read audit: `/api/v1/agent/personalization/policy/history` -> `AGENT_POLICY/PERSONALIZATION_POLICY_HISTORY_VIEW`
  - Audit evidence read audit: `/api/v1/reports/audit-events` -> `REPORTING/AUDIT_EVIDENCE_VIEW`
  - Import mutation auditing in resource/bed import endpoints
- Verification steps
  1. Trigger login/logout and import workflows.
  2. Query `audit.AuditEvent` by `EventCategory` and `EventAction`.
  3. Confirm traceId present in `DetailJson`.

### Integration Traceability and Idempotency
- Evidence
  - `intg.InboundInterfaceMessage` checks and writes in import workflow.
  - Endpoint duplicate protection using (`SourceSystemCode`,`SourceMessageId`,`InterfaceTypeCode`).
- Verification steps
  1. Submit identical import payload twice with same source/message IDs.
  2. Confirm second request short-circuits without duplicate data mutations.
  3. Verify inbound message statuses (`Processed`,`Rejected`,`Error`).

### Data Protection and Transport
- Evidence
  - HTTPS redirection + HSTS (non-dev)
  - Security headers middleware
  - Parameterized SQL in data services
  - Additional browser hardening headers in API pipeline:
	- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
	- `Cross-Origin-Opener-Policy: same-origin`
	- `Cross-Origin-Resource-Policy: same-site`
  - Sensitive endpoint cache suppression (`Cache-Control: no-store`, `Pragma: no-cache`, `Expires: 0`) for auth/admin/export/evidence paths
  - Export payload redaction in incident evidence CSV handlers:
	- Communications evidence export masks destination addresses and redacts narrative fields (subject/message/failure reason)
	- Resource evidence export redacts free-text notes
- Verification steps
  1. Validate HTTPS only in deployed environment.
  2. Verify response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
  3. Verify CSP/COOP/CORP headers are present on API responses.
  4. Verify `no-store` cache headers are present for sensitive endpoints.
  5. Verify incident communications/resources evidence CSV exports do not emit raw destination or narrative free-text values.

## 2. Operational Monitoring and Observability

### Production Telemetry Exporter Gate
- Evidence
  - Startup fail-fast validation in `IPOC_WEB.Server/Program.cs` requiring one of:
	- `OTEL_EXPORTER_OTLP_ENDPOINT`, or
	- `APPLICATIONINSIGHTS_CONNECTION_STRING`
- Verification steps
  1. In a production-like environment, clear both settings and verify startup fails with explicit configuration error.
  2. Set approved telemetry exporter setting and verify startup succeeds.
  3. Confirm traces/logs/metrics are queryable in the configured observability backend.

### Required Dashboard Signals
- API 5xx error rate (service and endpoint)
- 429 throttling count and retry-after distribution
- Import job success/failure counts
- Inbound interface message status trend
- Authentication audit volume trend
- JWT auth failure/challenge/forbidden volume trend (`Security.Auth` logger events)

### Sensitive Export Abuse Mitigation
- Code control
  - Dedicated `SensitiveExportLimiter` policy in `IPOC_WEB.Server/Program.cs` applied to high-risk export routes:
	- incident evidence exports (`communications`, `resources`, `lifecycle`, `IAP`, `after-action`)
	- audit evidence export (`/api/v1/reports/audit-events/export/csv`)
	- external provider report exports (CSV/JSON/ZIP)
	- admin session compliance evidence export
	- resource regional rollup CSV export
- Verification steps
  1. Execute >12 export requests within 1 minute from the same caller identity and confirm HTTP 429 responses.
  2. Confirm `Retry-After` header is present on rejected requests.
  3. Capture 429 trend metrics and include in release evidence package.

### Required Log Exports
- Request logs with trace IDs
- Exception logs with trace IDs
- Audit event extracts for requested windows
- Inbound interface message extracts for reconciliation

## 3. Data Residency and Access Governance
- Required operational controls (outside code)
  - US-only region deployment policy
  - US-only support access restrictions
  - Access review cadence and evidence archive
  - Break-glass access procedure + review

## 4. Incident Response and Change Management

### Security Incident Procedure (minimum)
1. Detect/triage alert.
2. Identify affected endpoint/workflow and trace IDs.
3. Export relevant logs and audit events.
4. Contain by disabling affected integration client / access scope.
5. Recover and validate with smoke gate and controlled replay.
6. Record post-incident corrective actions.

### Change Control Procedure (minimum)
1. Document change request + risk assessment.
2. Execute in non-prod with evidence capture.
3. Approve and deploy with rollback plan.
4. Validate control operation post-deploy.

## 5. Evidence Package Index
For each release candidate, archive:
- Build/test results
- Endpoint authorization matrix
- Audit log samples (auth, admin, import)
- Inbound message idempotency verification results
- Import reject report samples
- Security header validation output
- Availability/latency metrics snapshot

## 7. Managed Identity and Credential Rotation Operations

### Managed Identity Access Verification (Azure-side)
- Required resource scopes (current environment)
  - Azure OpenAI account scope: `/subscriptions/723d6f68-f330-4a47-a889-d17c64567f89/resourceGroups/ipoc-cognitive-rg/providers/Microsoft.CognitiveServices/accounts/opena-ai-dev-eastus-resource`
  - Azure AI Search scope: `/subscriptions/723d6f68-f330-4a47-a889-d17c64567f89/resourceGroups/ipoc-cognitive-rg/providers/Microsoft.Search/searchServices/dev-ai-search-svc`
- Verification steps
  1. Confirm the application managed identity/service principal has data-plane access at both scopes.
  2. Validate app connectivity succeeds with managed identity and without API keys.
  3. Capture role assignment evidence and attach to release package.

### Credential Rotation and Secret Externalization
- Immediate actions
  1. Rotate all Azure OpenAI and Azure AI Search keys that were previously present in source-controlled configs.
  2. Invalidate old keys and confirm they fail if used.
  3. Store any break-glass secrets in Azure Key Vault only.
  4. Ensure production app configuration does not contain API keys and uses managed identity path only.
- Verification steps
  1. Confirm appsettings values for API keys are empty in deployed production artifacts.
  2. Confirm startup validation blocks API-key auth in production if enabled paths are misconfigured.
  3. Run connectivity smoke checks and document successful MI-based calls.

## 8. Endpoint Authorization and Audit Coverage Matrix (Execution Checklist)

### High-priority endpoint groups
- `/api/v1/auth/*`
- `/api/v1/agent/*`
- `/api/v1/resources/*`
- `/api/v1/incidents/*`
- `/api/v1/admin/*`

### Coverage checklist per endpoint
- [ ] Authorization policy mapped and documented.
- [ ] Write/mutation behavior audited (`audit.AuditEvent`) with actor/action/outcome/trace id.
- [ ] Export/download operation audited with requested scope details.
- [ ] Sensitive payload fields redacted/masked in logs and exported audit detail where required.

### Newly verified endpoint evidence (code attestation)
- [x] `/api/v1/auth/me` writes `AUTH/PROFILE_VIEW` audit events.
- [x] `/api/v1/auth/token-debug` requires `AuthorizationPolicies.LookupAdmin` and writes `AUTH/TOKEN_DEBUG_VIEW` audit events.
- [x] `/api/v1/agent/history` writes `AGENT/CONVERSATION_HISTORY_VIEW` audit events.
- [x] `/api/v1/agent/chat/completions` writes `AGENT/CHAT_COMPLETION` audit events.
- [x] `/api/v1/agent/planning/predictive-demand-supply` writes `AGENT/PREDICTIVE_DEMAND_SUPPLY_VIEW` audit events.
- [x] `/api/v1/agent/planning/predictive-demand-supply/operational-acceptance` writes `AGENT/PREDICTIVE_OPERATIONAL_ACCEPTANCE_VIEW` audit events.
- [x] `/api/v1/agent/personalization/policy` writes `AGENT_POLICY/PERSONALIZATION_POLICY_VIEW` audit events.
- [x] `/api/v1/agent/personalization/policy/history` writes `AGENT_POLICY/PERSONALIZATION_POLICY_HISTORY_VIEW` audit events.
- [x] `/api/v1/alerts/dispatch` writes `COMMUNICATION/DISPATCH_CREATE` audit events.
- [x] `/api/v1/alerts/{notificationId}/recipients/{notificationRecipientId}/status` writes `COMMUNICATION/RECIPIENT_STATUS_UPDATE` audit events.
- [x] `/api/v1/alerts/{notificationId}/recipients/{notificationRecipientId}/acknowledge` writes `COMMUNICATION/RECIPIENT_ACKNOWLEDGE` audit events.
- [x] `/api/v1/alerts/{notificationId}/escalate` writes `COMMUNICATION/NOTIFICATION_ESCALATE` audit events.
- [x] `/api/v1/admin/streaming/start` writes `DATA_CHANGE/STREAMING_INGESTION_START` audit events.
- [x] `/api/v1/admin/streaming/stop` writes `DATA_CHANGE/STREAMING_INGESTION_STOP` audit events.
- [x] `/api/v1/admin/streaming/upload` writes `DATA_CHANGE/STREAMING_INGESTION_UPLOAD` audit events.
- [x] `/api/v1/admin/external-provider/executive-packet/automation/run` writes `REPORTING/EXTERNAL_PROVIDER_EXECUTIVE_PACKET_AUTOMATION_RUN_MANUAL` audit events.
- [x] `/api/v1/admin/data/synthetic/reset` writes `DATA_CHANGE/SYNTHETIC_DATA_RESET` audit events.
- [x] `/api/v1/admin/data/synthetic/seed` writes `DATA_CHANGE/SYNTHETIC_DATA_SEED` audit events.
- [x] `/api/v1/admin/users` (POST) writes `DATA_CHANGE/USER_CREATE` audit events.
- [x] `/api/v1/admin/users/{userId}/active` writes `DATA_CHANGE/USER_ACTIVATE` or `DATA_CHANGE/USER_DEACTIVATE` audit events.
- [x] `/api/v1/admin/locations/{locationId}/active` writes `DATA_CHANGE/LOCATION_ACTIVATE` or `DATA_CHANGE/LOCATION_DEACTIVATE` audit events.
- [x] `/api/v1/admin/locations/{locationId}/geo` writes `DATA_CHANGE/LOCATION_GEO_UPDATE` audit events.
- [x] `/api/v1/admin/ics-positions` (POST) writes `DATA_CHANGE/ICS_POSITION_CREATE` audit events.
- [x] `/api/v1/admin/ics-positions/{icsPositionId}` writes `DATA_CHANGE/ICS_POSITION_UPDATE` audit events.
- [x] `/api/v1/admin/ics-positions/{icsPositionId}/nims-standard` writes `DATA_CHANGE/ICS_POSITION_STANDARD_ENABLE` or `DATA_CHANGE/ICS_POSITION_STANDARD_DISABLE` audit events.
- [x] `/api/v1/admin/sessions/{userSessionId}/terminate` writes `DATA_CHANGE/SESSION_TERMINATE` audit events.
- [x] `/api/v1/admin/sessions/{userSessionId}/impersonate/start` writes `DATA_CHANGE/SESSION_IMPERSONATION_START` audit events.
- [x] `/api/v1/admin/sessions/{userSessionId}/impersonate/stop` writes `DATA_CHANGE/SESSION_IMPERSONATION_STOP` audit events.
- [x] `/api/v1/incidents/{incidentId}/situation-reports` (GET) writes `INCIDENT/SITUATION_REPORTS_VIEW` audit events.
- [x] `/api/v1/incidents/{incidentId}/situation-reports` (POST) writes `INCIDENT/SITUATION_REPORT_CREATE` audit events.
- [x] `/api/v1/lookups/ics-positions` writes `LOOKUP/ICS_POSITIONS_VIEW` audit events.
- [x] `/api/v1/lookups/codesets/{codeSetName}` writes `LOOKUP/CODESET_VALUES_VIEW` audit events.
- [x] `/api/v1/lookups/codesets/{codeSetName}/search` writes `LOOKUP/CODESET_VALUES_SEARCH` audit events.
- [x] `/api/v1/lookups/locations` writes `LOOKUP/ACTIVE_LOCATIONS_VIEW` audit events.
- [x] `/api/v1/lookups/codesets/{codeSetName}` (POST) writes `DATA_CHANGE/LOOKUP_VALUE_CREATE` audit events.
- [x] `/api/v1/lookups/codesets/{codeSetName}/{codeValueId}` (POST) writes `DATA_CHANGE/LOOKUP_VALUE_UPDATE` audit events.
- [x] `/api/v1/users/active` writes `LOOKUP/ACTIVE_USERS_VIEW` audit events.
- [x] `/api/v1/users/contacts` writes `LOOKUP/ACTIVE_CONTACTS_VIEW` audit events.
- [x] `/api/v1/admin/locations/{locationId}/geocode` writes `DATA_CHANGE/LOCATION_GEOCODE` audit events.
- [x] `/api/v1/resources/import/inventory` writes `DATA_CHANGE/IMPORT_RESOURCE_INVENTORY_BATCH` audit events.
- [x] `/api/v1/resources/import/inventory/csv` writes `DATA_CHANGE/IMPORT_RESOURCE_INVENTORY_CSV` audit events.
- [x] `/api/v1/resources/import/inventory/csv/reject-report` writes `REPORTING/IMPORT_RESOURCE_INVENTORY_REJECT_REPORT_DOWNLOAD` audit events.
- [x] `/api/v1/resources/inventory` writes `RESOURCE/RESOURCE_INVENTORY_VIEW` audit events.
- [x] `/api/v1/resources/regional-rollups` writes `RESOURCE/RESOURCE_REGIONAL_ROLLUPS_VIEW` audit events.
- [x] `/api/v1/resources/inventory/{locationResourceInventoryId}` writes `DATA_CHANGE/RESOURCE_INVENTORY_UPDATE` audit events.
- [x] `/api/v1/resources/report-presets/{presetScope}` (GET) writes `RESOURCE/REPORT_PRESETS_VIEW` audit events.
- [x] `/api/v1/resources/report-presets/{presetScope}` (POST) writes `DATA_CHANGE/REPORT_PRESET_UPSERT` audit events.
- [x] `/api/v1/resources/report-presets/{presetScope}/{userReportPresetId}` (DELETE) writes `DATA_CHANGE/REPORT_PRESET_DELETE` audit events.
- [x] `/api/v1/beds/import/availability` writes `DATA_CHANGE/IMPORT_BED_AVAILABILITY_BATCH` audit events.
- [x] `/api/v1/beds/import/availability/csv` writes `DATA_CHANGE/IMPORT_BED_AVAILABILITY_CSV` audit events.
- [x] `/api/v1/beds/import/availability/csv/reject-report` writes `REPORTING/IMPORT_BED_AVAILABILITY_REJECT_REPORT_DOWNLOAD` audit events.
- [x] `/api/v1/beds/import/availability/fhir` writes `DATA_CHANGE/IMPORT_BED_AVAILABILITY_FHIR` audit events.
- [x] `/api/v1/beds/import/availability/fhir/adapter-contract` writes `LOOKUP/BED_AVAILABILITY_FHIR_ADAPTER_CONTRACT_VIEW` audit events.
- [x] `/api/v1/beds/availability` writes `RESOURCE/BED_AVAILABILITY_VIEW` audit events.
- [x] `/api/v1/beds/availability/{locationId}` writes `DATA_CHANGE/BED_AVAILABILITY_SNAPSHOT_ADD` audit events.
- [x] `/api/v1/reports/audit-events` writes `REPORTING/AUDIT_EVIDENCE_VIEW` audit events.
- [x] `/api/v1/reports/audit-events/export/csv` writes `REPORTING/AUDIT_EVIDENCE_EXPORT_CSV` and redacts sensitive detail fields in CSV output.

### Additional redaction verification attestation
- [x] `/api/v1/alerts/{notificationId}/recipients` returns redacted recipient destination and failure narrative fields (`RedactNotificationDestinationAddress`, `RedactNarrativeTextForExport`).
- [x] Reject report CSV generation (`BuildRejectReportCsv`) applies `RedactSensitiveData` to `Reason`, `RawData`, and `SourceMessageId` fields before export.

### Auth Failure Detection (new hardening)
- Code control
  - JWT bearer pipeline now emits structured security logs for:
	- authentication failures (`OnAuthenticationFailed`),
	- JWT challenges (`OnChallenge`),
	- authorization forbidden responses (`OnForbidden`).
- Verification steps
  1. Trigger invalid token and missing token requests against protected endpoints.
  2. Confirm `Security.Auth` warning log events are emitted with method/path/trace id.
  3. Configure alert thresholds for abnormal spikes in auth failures/challenges/forbidden responses.

### Log Safety Hardening (new)
- Code controls
  - RAG smoke endpoint no longer returns raw exception payloads in `search.error` / `openAi.error`; responses now return sanitized operator guidance.
  - Verbose ICS assignment snapshot logging has been reduced from Information to Debug to avoid overexposure in standard log streams.
  - Sensitive endpoint access paths (`/api/v1/auth/*`, `/api/v1/admin/*`, and export/evidence routes) are explicitly logged as warning events for security monitoring.
- Verification steps
  1. Force RAG smoke failures and verify API responses do not include stack traces or raw token-bearing exception text.
  2. Confirm assignment snapshot events only appear when debug-level logging is enabled.
  3. Confirm warning-level log entries are emitted for sensitive endpoint access and are queryable in telemetry backend.

## 6. RFP Mapping Snapshot
- B9/E9: full auth audit logs on request -> implemented endpoints + durable audit storage path.
- B10/E10: US data residency -> deployment/ops policy evidence required.
- C1/F2/F3/G1: exports + batch/API import support -> CSV and FHIR import paths with audit + reconciliation.
