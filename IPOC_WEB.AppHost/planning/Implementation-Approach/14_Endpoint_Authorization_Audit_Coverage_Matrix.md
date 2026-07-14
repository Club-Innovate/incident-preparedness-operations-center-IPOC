# Endpoint Authorization + Audit Coverage Matrix

## Scope
Concrete endpoint inventory derived from `IPOC_WEB.Server/Program.cs` route mappings. This matrix is used to attest policy enforcement and audit coverage endpoint-by-endpoint.

## Coverage Criteria (must pass all)
1. Authorization policy enforced (group-level or endpoint-level).
2. Write/mutation/export/admin-sensitive actions produce audit evidence.
3. Audit record includes actor, action, outcome, and trace/correlation context.
4. Sensitive values are redacted/masked in logs and exported audit detail.

## Group: admin

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/admin/streaming/status | GET | AuthorizationPolicies.LookupAdmin | Yes | REPORTING / STREAMING_INGESTION_STATUS_VIEW | N/A | Done | Source line 5486 in Program.cs |
| /api/v1/admin/streaming/start | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / STREAMING_INGESTION_START | N/A | Done | Source line 6653 in Program.cs |
| /api/v1/admin/streaming/stop | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / STREAMING_INGESTION_STOP | N/A | Done | Source line 6684 in Program.cs |
| /api/v1/admin/external-provider/executive-packet/automation/status | GET | AuthorizationPolicies.LookupAdmin | Yes | REPORTING / EXTERNAL_PROVIDER_EXECUTIVE_PACKET_AUTOMATION_STATUS_VIEW | N/A | Done | Source line 5548 in Program.cs |
| /api/v1/admin/external-provider/executive-packet/automation/run | POST | AuthorizationPolicies.LookupAdmin | Yes | REPORTING / EXTERNAL_PROVIDER_EXECUTIVE_PACKET_AUTOMATION_RUN_MANUAL | N/A | Done | Source line 6738 in Program.cs |
| /api/v1/admin/streaming/upload | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / STREAMING_INGESTION_UPLOAD | N/A | Done | Source line 6781 in Program.cs |
| /api/v1/admin/data/synthetic/reset | POST | AuthorizationPolicies.DataOpsAdmin | Yes | DATA_CHANGE / SYNTHETIC_DATA_RESET | N/A | Done | Source line 6846 in Program.cs |
| /api/v1/admin/data/synthetic/seed | POST | AuthorizationPolicies.DataOpsAdmin | Yes | DATA_CHANGE / SYNTHETIC_DATA_SEED | N/A | Done | Source line 7000 in Program.cs |
| /api/v1/admin/data/synthetic/preview | GET | AuthorizationPolicies.DataOpsAdmin | Yes | REPORTING / SYNTHETIC_DATA_PREVIEW_VIEW | N/A | Done | Source line 6012 in Program.cs |
| /api/v1/admin/users | GET | AuthorizationPolicies.LookupAdmin | Yes | REPORTING / ADMIN_USERS_VIEW | N/A | Done | Source line 6102 in Program.cs |
| /api/v1/admin/users | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / USER_CREATE | N/A | Done | Source line 7303 in Program.cs |
| /api/v1/admin/users/{userId:long}/active | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / USER_ACTIVATE or USER_DEACTIVATE | N/A | Done | Source line 7385 in Program.cs |
| /api/v1/admin/locations | GET | AuthorizationPolicies.LookupAdmin | Yes | REPORTING / ADMIN_LOCATIONS_VIEW | N/A | Done | Source line 6264 in Program.cs |
| /api/v1/admin/locations/{locationId:long}/active | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / LOCATION_ACTIVATE or LOCATION_DEACTIVATE | N/A | Done | Source line 7465 in Program.cs |
| /api/v1/admin/locations/{locationId:long}/geo | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / LOCATION_GEO_UPDATE | N/A | Done | Source line 7505 in Program.cs |
| /api/v1/admin/locations/{locationId:long}/geocode | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / LOCATION_GEOCODE | N/A | Done | Source line 7639 in Program.cs |
| /api/v1/admin/ics-positions | GET | AuthorizationPolicies.LookupAdmin | Yes | REPORTING / ADMIN_ICS_POSITIONS_VIEW | N/A | Done | Source line 6485 in Program.cs |
| /api/v1/admin/ics-positions | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / ICS_POSITION_CREATE | N/A | Done | Source line 7686 in Program.cs |
| /api/v1/admin/ics-positions/{icsPositionId:int} | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / ICS_POSITION_UPDATE | N/A | Done | Source line 7756 in Program.cs |
| /api/v1/admin/ics-positions/{icsPositionId:int}/nims-standard | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / ICS_POSITION_STANDARD_ENABLE or ICS_POSITION_STANDARD_DISABLE | N/A | Done | Source line 7836 in Program.cs |
| /api/v1/admin/sessions | GET | AuthorizationPolicies.LookupAdmin | Yes | REPORTING / ADMIN_SESSIONS_VIEW | N/A | Done | Source line 6715 in Program.cs |
| /api/v1/admin/sessions/{userSessionId:long}/terminate | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / SESSION_TERMINATE | N/A | Done | Source line 7915 in Program.cs |
| /api/v1/admin/sessions/{userSessionId:long}/impersonate/start | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / SESSION_IMPERSONATION_START | N/A | Done | Source line 7955 in Program.cs |
| /api/v1/admin/sessions/{userSessionId:long}/impersonate/stop | POST | AuthorizationPolicies.LookupAdmin | Yes | DATA_CHANGE / SESSION_IMPERSONATION_STOP | N/A | Done | Source line 8032 in Program.cs |
| /api/v1/admin/sessions/compliance-evidence/export/json | GET | AuthorizationPolicies.LookupAdmin | Yes | REPORTING / SESSION_COMPLIANCE_EVIDENCE_EXPORT_JSON | N/A | Done | Source line 6790 in Program.cs |

## Group: agent

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/agent/history | GET | AuthorizationPolicies.ResourceReporter | Yes | AGENT / CONVERSATION_HISTORY_VIEW | N/A | Done | Source line 1889 in Program.cs |
| /api/v1/agent/chat/completions | POST | AuthorizationPolicies.ResourceReporter | Yes | AGENT / CHAT_COMPLETION | N/A | Done | Source line 1941 in Program.cs |
| /api/v1/agent/planning/predictive-demand-supply | GET | AuthorizationPolicies.ResourceReporter | Yes | AGENT / PREDICTIVE_DEMAND_SUPPLY_VIEW | N/A | Done | Source line 2102 in Program.cs |
| /api/v1/agent/planning/predictive-demand-supply/operational-acceptance | GET | AuthorizationPolicies.ResourceReporter | Yes | AGENT / PREDICTIVE_OPERATIONAL_ACCEPTANCE_VIEW | N/A | Done | Source line 2212 in Program.cs |
| /api/v1/agent/personalization/policy | GET | AuthorizationPolicies.ResourceReporter | Yes | AGENT_POLICY / PERSONALIZATION_POLICY_VIEW | N/A | Done | Source line 2306 in Program.cs |
| /api/v1/agent/personalization/policy/history | GET | AuthorizationPolicies.ResourceReporter | Yes | AGENT_POLICY / PERSONALIZATION_POLICY_HISTORY_VIEW | N/A | Done | Source line 2245 in Program.cs (audit event action filter + explicit history-view audit write) |
| /api/v1/agent/personalization/policy | PUT | AuthorizationPolicies.ResourceReporter | Yes | AGENT_POLICY / PERSONALIZATION_POLICY_UPDATED | N/A | Done | Source line 2316 in Program.cs |
| /api/v1/agent/personalization | POST | AuthorizationPolicies.ResourceReporter | Yes | AGENT_POLICY / PERSONALIZATION_PREFERENCES_UPDATED | N/A | Done | Source line 2373 in Program.cs |
| /api/v1/agent/analytics/events | POST | AuthorizationPolicies.ResourceReporter | Yes | AGENT_ANALYTICS / ANALYTICS_EVENT_RECORDED | N/A | Done | Source line 2429 in Program.cs |

## Group: alerts

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/alerts/ | GET | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / UI_ALERTS_VIEW | N/A | Done | Source line 2462 in Program.cs |
| /api/v1/alerts/ | POST | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / UI_ALERT_CREATE | N/A | Done | Source line 2496 in Program.cs |
| /api/v1/alerts/{alertId:long}/acknowledge | POST | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / UI_ALERT_ACKNOWLEDGE | N/A | Done | Source line 2569 in Program.cs |
| /api/v1/alerts/{alertId:long} | DELETE | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / UI_ALERT_DELETE | N/A | Done | Source line 2625 in Program.cs |
| /api/v1/alerts/ | DELETE | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / UI_ALERT_CLEAR | N/A | Done | Source line 2676 in Program.cs |
| /api/v1/alerts/dispatch | POST | AuthorizationPolicies.IncidentCommander | Yes | COMMUNICATION / DISPATCH_CREATE | N/A | Done | Source line 2879 in Program.cs |
| /api/v1/alerts/{notificationId:long}/recipients | GET | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / NOTIFICATION_RECIPIENTS_VIEW | Yes | Done | Source line 3005 in Program.cs (destination address and failure narrative are redacted in response payload) |
| /api/v1/alerts/{notificationId:long}/recipients/{notificationRecipientId:long}/status | POST | AuthorizationPolicies.IncidentCommander | Yes | COMMUNICATION / RECIPIENT_STATUS_UPDATE | N/A | Done | Source line 3057 in Program.cs |
| /api/v1/alerts/{notificationId:long}/recipients/{notificationRecipientId:long}/acknowledge | POST | AuthorizationPolicies.IncidentCommander | Yes | COMMUNICATION / RECIPIENT_ACKNOWLEDGE | N/A | Done | Source line 3131 in Program.cs |
| /api/v1/alerts/{notificationId:long}/escalate | POST | AuthorizationPolicies.IncidentCommander | Yes | COMMUNICATION / NOTIFICATION_ESCALATE | N/A | Done | Source line 3196 in Program.cs |

## Group: auth

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/auth/me | GET | RequireAuthorization() | Yes | AUTH / PROFILE_VIEW | N/A | Done | Source line 1684 in Program.cs |
| /api/v1/auth/audit/login | POST | RequireAuthorization() | Yes | AUTH / LOGIN_SUCCESS | N/A | Done | Source line 1674 in Program.cs |
| /api/v1/auth/audit/logout | POST | RequireAuthorization() | Yes | AUTH / LOGOUT | N/A | Done | Source line 1696 in Program.cs |
| /api/v1/auth/token-debug | GET | AuthorizationPolicies.LookupAdmin | Yes | AUTH / TOKEN_DEBUG_VIEW | N/A | Done | Source line 1759 in Program.cs (admin-only + development-only + audited) |

## Group: beds

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/beds/import/availability | POST | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / IMPORT_BED_AVAILABILITY_BATCH | N/A | Done | Source line 9162 in Program.cs |
| /api/v1/beds/import/availability/csv | POST | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / IMPORT_BED_AVAILABILITY_CSV | N/A | Done | Source line 9224 in Program.cs |
| /api/v1/beds/import/availability/csv/reject-report | POST | AuthorizationPolicies.ResourceReporter | Yes | REPORTING / IMPORT_BED_AVAILABILITY_REJECT_REPORT_DOWNLOAD | Yes | Done | Source line 9300 in Program.cs (reject report CSV applies RedactSensitiveData to reason/raw/source message fields) |
| /api/v1/beds/import/availability/fhir | POST | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / IMPORT_BED_AVAILABILITY_FHIR | N/A | Done | Source line 9341 in Program.cs |
| /api/v1/beds/import/availability/fhir/adapter-contract | GET | AuthorizationPolicies.ResourceReporter | Yes | LOOKUP / BED_AVAILABILITY_FHIR_ADAPTER_CONTRACT_VIEW | N/A | Done | Source line 9413 in Program.cs |
| /api/v1/beds/availability | GET | AuthorizationPolicies.ResourceReporter | Yes | RESOURCE / BED_AVAILABILITY_VIEW | N/A | Done | Source line 9482 in Program.cs |
| /api/v1/beds/availability/{locationId:long} | POST | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / BED_AVAILABILITY_SNAPSHOT_ADD | N/A | Done | Source line 9490 in Program.cs |

## Group: incidents

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/incidents/dashboard-summary | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / DASHBOARD_SUMMARY_VIEW | N/A | Done | Source line 3157 in Program.cs |
| /api/v1/incidents/ | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / INCIDENT_LIST_VIEW | N/A | Done | Source line 3187 in Program.cs |
| /api/v1/incidents/{incidentId:long} | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / INCIDENT_VIEW | N/A | Done | Source line 3217 in Program.cs |
| /api/v1/incidents/ | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_CREATE | N/A | Done | Source line 3263 in Program.cs |
| /api/v1/incidents/{incidentId:long} | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_UPDATE | N/A | Done | Source line 3308 in Program.cs |
| /api/v1/incidents/{incidentId:long}/activate | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_ACTIVATE | N/A | Done | Source line 3335 in Program.cs |
| /api/v1/incidents/{incidentId:long}/close | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_CLOSE | N/A | Done | Source line 3376 in Program.cs |
| /api/v1/incidents/{incidentId:long}/tasks | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / INCIDENT_TASKS_VIEW | N/A | Done | Source line 3415 in Program.cs |
| /api/v1/incidents/{incidentId:long}/tasks | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_TASK_CREATE | N/A | Done | Source line 3452 in Program.cs |
| /api/v1/incidents/{incidentId:long}/tasks/{incidentTaskId:long}/status | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_TASK_STATUS_UPDATE | N/A | Done | Source line 3504 in Program.cs |
| /api/v1/incidents/{incidentId:long}/tasks/{incidentTaskId:long}/assignment | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_TASK_ASSIGNMENT_UPDATE | N/A | Done | Source line 3559 in Program.cs |
| /api/v1/incidents/{incidentId:long}/timeline | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / INCIDENT_TIMELINE_VIEW | N/A | Done | Source line 3616 in Program.cs |
| /api/v1/incidents/{incidentId:long}/timeline | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_TIMELINE_EVENT_CREATE | N/A | Done | Source line 3654 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications | GET | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / INCIDENT_COMMUNICATIONS_VIEW | N/A | Done | Source line 3708 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications/lifecycle-summary | GET | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / INCIDENT_COMMUNICATION_LIFECYCLE_SUMMARY_VIEW | N/A | Done | Source line 3748 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications/evidence/export/csv | GET | AuthorizationPolicies.IncidentViewer | Yes | COMMUNICATION / COMMUNICATION_EVIDENCE_EXPORT_CSV | Yes | Done | Source line 3292 in Program.cs (destination and narrative fields redacted in CSV export path) |
| /api/v1/incidents/{incidentId:long}/communications | POST | AuthorizationPolicies.IncidentCommander | Yes | COMMUNICATION / INCIDENT_COMMUNICATION_CREATE | N/A | Done | Source line 3944 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications/{incidentCommunicationId:long} | POST | AuthorizationPolicies.IncidentCommander | Yes | COMMUNICATION / INCIDENT_COMMUNICATION_UPDATE | N/A | Done | Source line 4023 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources | GET | AuthorizationPolicies.IncidentViewer | Yes | RESOURCE / INCIDENT_RESOURCE_REQUESTS_VIEW | N/A | Done | Source line 4077 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources/lifecycle-summary | GET | AuthorizationPolicies.IncidentViewer | Yes | RESOURCE / INCIDENT_RESOURCE_LIFECYCLE_SUMMARY_VIEW | N/A | Done | Source line 4129 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources/evidence/export/csv | GET | AuthorizationPolicies.IncidentViewer | Yes | RESOURCE / RESOURCE_EVIDENCE_EXPORT_CSV | Yes | Done | Source line 3560 in Program.cs (free-text notes redacted in CSV export path) |
| /api/v1/incidents/{incidentId:long}/resources/lifecycle-evidence/export/json | GET | AuthorizationPolicies.IncidentViewer | Yes | RESOURCE / RESOURCE_LIFECYCLE_EVIDENCE_EXPORT_JSON | N/A | Done | Source line 3668 in Program.cs (explicit audit write + sensitive export limiter) |
| /api/v1/incidents/{incidentId:long}/resources | POST | AuthorizationPolicies.IncidentCommander | Yes | RESOURCE / RESOURCE_REQUEST_CREATE | N/A | Done | Source line 4381 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources/{incidentResourceRequestId:long} | POST | AuthorizationPolicies.IncidentCommander | Yes | RESOURCE / RESOURCE_REQUEST_STATUS_TRANSITION | N/A | Done | Source line 4435 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / INCIDENT_OPERATIONAL_PERIODS_VIEW | N/A | Done | Source line 4527 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_OPERATIONAL_PERIOD_CREATE | N/A | Done | Source line 4572 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods/{operationalPeriodId:long} | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_OPERATIONAL_PERIOD_UPDATE | N/A | Done | Source line 4626 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods/{operationalPeriodId:long}/approve | POST | AuthorizationPolicies.IncidentCommander | Yes | DATA_CHANGE / INCIDENT_OPERATIONAL_PERIOD_APPROVE | N/A | Done | Source line 4704 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods/{operationalPeriodId:long}/reopen | POST | AuthorizationPolicies.IncidentCommander | Yes | DATA_CHANGE / INCIDENT_OPERATIONAL_PERIOD_REOPEN | N/A | Done | Source line 4795 in Program.cs |
| /api/v1/incidents/{incidentId:long}/objectives | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / INCIDENT_OBJECTIVES_VIEW | N/A | Done | Source line 4848 in Program.cs |
| /api/v1/incidents/{incidentId:long}/objectives | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_OBJECTIVE_CREATE | N/A | Done | Source line 4895 in Program.cs |
| /api/v1/incidents/{incidentId:long}/objectives/{incidentObjectiveId:long} | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_OBJECTIVE_UPDATE | N/A | Done | Source line 5005 in Program.cs |
| /api/v1/incidents/{incidentId:long}/command-assignments | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / INCIDENT_COMMAND_ASSIGNMENTS_VIEW | N/A | Done | Source line 5063 in Program.cs |
| /api/v1/incidents/{incidentId:long}/command-assignments | PUT | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_COMMAND_ASSIGNMENT_UPSERT | N/A | Done | Source line 5117 in Program.cs |
| /api/v1/incidents/{incidentId:long}/command-assignments/{icsPositionId:int} | DELETE | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / INCIDENT_COMMAND_ASSIGNMENT_REMOVE | N/A | Done | Source line 5176 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-201 | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / ICS_201_VIEW | N/A | Done | Source line 5168 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-202 | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / ICS_202_VIEW | N/A | Done | Source line 5210 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-203 | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / ICS_203_VIEW | N/A | Done | Source line 5252 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-204 | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / ICS_204_VIEW | N/A | Done | Source line 5294 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-205 | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / ICS_205_VIEW | N/A | Done | Source line 5336 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-209 | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / ICS_209_VIEW | N/A | Done | Source line 5378 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-214 | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / ICS_214_VIEW | N/A | Done | Source line 5420 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-215 | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / ICS_215_VIEW | N/A | Done | Source line 5462 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-packet | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / IAP_PACKET_VIEW | N/A | Done | Source line 5504 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-packet/print | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / IAP_PACKET_PRINT_VIEW | N/A | Done | Source line 5546 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-packet/export/json | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / IAP_PACKET_EXPORT_JSON | N/A | Done | Source line 4538 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-packet/export/print | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / IAP_PACKET_EXPORT_PRINT | N/A | Done | Source line 4619 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-governance/evidence/json | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / IAP_GOVERNANCE_EVIDENCE_EXPORT_JSON | N/A | Done | Source line 4680 in Program.cs |
| /api/v1/incidents/{incidentId:long}/situation-reports | GET | AuthorizationPolicies.IncidentViewer | Yes | INCIDENT / SITUATION_REPORTS_VIEW | N/A | Done | Source line 5950 in Program.cs |
| /api/v1/incidents/{incidentId:long}/after-action/evidence/export/json | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / AFTER_ACTION_EVIDENCE_EXPORT_JSON | N/A | Done | Source line 4825 in Program.cs |
| /api/v1/incidents/{incidentId:long}/situation-reports | POST | AuthorizationPolicies.IncidentCommander | Yes | INCIDENT / SITUATION_REPORT_CREATE | N/A | Done | Source line 6132 in Program.cs |

## Group: lookups

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/lookups/ics-positions | GET | AuthorizationPolicies.LookupViewer | Yes | LOOKUP / ICS_POSITIONS_VIEW | N/A | Done | Source line 6147 in Program.cs |
| /api/v1/lookups/codesets/{codeSetName} | GET | AuthorizationPolicies.LookupViewer | Yes | LOOKUP / CODESET_VALUES_VIEW | N/A | Done | Source line 8301 in Program.cs |
| /api/v1/lookups/codesets/{codeSetName}/search | GET | AuthorizationPolicies.LookupViewer | Yes | LOOKUP / CODESET_VALUES_SEARCH | N/A | Done | Source line 8341 in Program.cs |
| /api/v1/lookups/locations | GET | AuthorizationPolicies.LookupViewer | Yes | LOOKUP / ACTIVE_LOCATIONS_VIEW | N/A | Done | Source line 8392 in Program.cs |
| /api/v1/lookups/codesets/{codeSetName} | POST | AuthorizationPolicies.LookupContributor | Yes | DATA_CHANGE / LOOKUP_VALUE_CREATE | N/A | Done | Source line 8427 in Program.cs |
| /api/v1/lookups/codesets/{codeSetName}/{codeValueId:int} | POST | AuthorizationPolicies.LookupContributor | Yes | DATA_CHANGE / LOOKUP_VALUE_UPDATE | N/A | Done | Source line 8537 in Program.cs |

## Group: reports

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/reports/audit-events | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / AUDIT_EVIDENCE_VIEW | N/A | Done | Source line 5029 in Program.cs |
| /api/v1/reports/audit-events/export/csv | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / AUDIT_EVIDENCE_EXPORT_CSV | Yes | Done | Source line 5113 in Program.cs (uses BuildAuditEventExportCsv -> RedactSensitiveData) |
| /api/v1/reports/external-provider-health/governance/export/csv | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / EXTERNAL_PROVIDER_GOVERNANCE_EXPORT_CSV | N/A | Done | Source line 5187 in Program.cs (aggregated operational metrics only; no direct PII/PHI fields exported) |
| /api/v1/reports/external-provider-health/scorecards/export/csv | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / EXTERNAL_PROVIDER_SCORECARD_EXPORT_CSV | N/A | Done | Source line 5261 in Program.cs (aggregated operational metrics only; no direct PII/PHI fields exported) |
| /api/v1/reports/external-provider-health/scorecards/export/json | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / EXTERNAL_PROVIDER_SCORECARD_EXPORT_JSON | N/A | Done | Source line 5325 in Program.cs |
| /api/v1/reports/external-provider-health/executive-packet/export/zip | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / EXTERNAL_PROVIDER_EXECUTIVE_PACKET_EXPORT_ZIP | N/A | Done | Source line 5389 in Program.cs (zip contains governance/scorecard aggregates + metadata readme, no direct PII/PHI fields) |

## Group: resources

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/resources/import/inventory | POST | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / IMPORT_RESOURCE_INVENTORY_BATCH | N/A | Done | Source line 8596 in Program.cs |
| /api/v1/resources/import/inventory/csv | POST | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / IMPORT_RESOURCE_INVENTORY_CSV | N/A | Done | Source line 8658 in Program.cs |
| /api/v1/resources/import/inventory/csv/reject-report | POST | AuthorizationPolicies.ResourceReporter | Yes | REPORTING / IMPORT_RESOURCE_INVENTORY_REJECT_REPORT_DOWNLOAD | Yes | Done | Source line 8734 in Program.cs (reject report CSV applies RedactSensitiveData to reason/raw/source message fields) |
| /api/v1/resources/inventory | GET | AuthorizationPolicies.ResourceReporter | Yes | RESOURCE / RESOURCE_INVENTORY_VIEW | N/A | Done | Source line 8775 in Program.cs |
| /api/v1/resources/regional-rollups | GET | AuthorizationPolicies.ResourceReporter | Yes | RESOURCE / RESOURCE_REGIONAL_ROLLUPS_VIEW | N/A | Done | Source line 8783 in Program.cs |
| /api/v1/resources/regional-rollups/export/csv | GET | AuthorizationPolicies.ResourceReporter | Yes | RESOURCE / RESOURCE_REGIONAL_ROLLUP_EXPORT_CSV | N/A | Done | Source line 8792 in Program.cs |
| /api/v1/resources/inventory/{locationResourceInventoryId:long} | POST | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / RESOURCE_INVENTORY_UPDATE | N/A | Done | Source line 8873 in Program.cs |
| /api/v1/resources/report-presets/{presetScope} | GET | AuthorizationPolicies.ResourceReporter | Yes | RESOURCE / REPORT_PRESETS_VIEW | N/A | Done | Source line 8895 in Program.cs |
| /api/v1/resources/report-presets/{presetScope} | POST | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / REPORT_PRESET_UPSERT | N/A | Done | Source line 8920 in Program.cs |
| /api/v1/resources/report-presets/{presetScope}/{userReportPresetId:long} | DELETE | AuthorizationPolicies.ResourceReporter | Yes | DATA_CHANGE / REPORT_PRESET_DELETE | N/A | Done | Source line 8984 in Program.cs |

## Group: users

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/users/active | GET | AuthorizationPolicies.LookupViewer | Yes | LOOKUP / ACTIVE_USERS_VIEW | N/A | Done | Source line 8310 in Program.cs |
| /api/v1/users/contacts | GET | AuthorizationPolicies.LookupViewer | Yes | LOOKUP / ACTIVE_CONTACTS_VIEW | N/A | Done | Source line 8336 in Program.cs |

## Current Status Snapshot
- Matrix contains 130 concrete endpoint rows with route, method, and policy baseline extracted from code.
- Explicit code-level attestation is now marked **Done** for core auth + agent policy + audit evidence endpoints with implemented audit write paths, including incident IAP/evidence exports and admin session compliance evidence export.
- Sensitive-data redaction is verified for audit CSV export handlers using `BuildAuditEventExportCsv(...)` + `RedactSensitiveData(...)`.
- Remaining work: attach runtime `audit.AuditEvent` sample IDs for high-risk privileged/write/export endpoints still marked Pending.

