# Endpoint Authorization + Audit Coverage Matrix

## Scope
Concrete endpoint inventory derived from `KPP_WEB.Server/Program.cs` route mappings. This matrix is used to attest policy enforcement and audit coverage endpoint-by-endpoint.

## Coverage Criteria (must pass all)
1. Authorization policy enforced (group-level or endpoint-level).
2. Write/mutation/export/admin-sensitive actions produce audit evidence.
3. Audit record includes actor, action, outcome, and trace/correlation context.
4. Sensitive values are redacted/masked in logs and exported audit detail.

## Group: admin

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/admin/streaming/status | GET | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5270 in Program.cs |
| /api/v1/admin/streaming/start | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5277 in Program.cs |
| /api/v1/admin/streaming/stop | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5308 in Program.cs |
| /api/v1/admin/external-provider/executive-packet/automation/status | GET | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5332 in Program.cs |
| /api/v1/admin/external-provider/executive-packet/automation/run | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5341 in Program.cs |
| /api/v1/admin/streaming/upload | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5384 in Program.cs |
| /api/v1/admin/data/synthetic/reset | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5449 in Program.cs |
| /api/v1/admin/data/synthetic/seed | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5603 in Program.cs |
| /api/v1/admin/data/synthetic/preview | GET | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5756 in Program.cs |
| /api/v1/admin/users | GET | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5840 in Program.cs |
| /api/v1/admin/users | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5855 in Program.cs |
| /api/v1/admin/users/{userId:long}/active | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5937 in Program.cs |
| /api/v1/admin/locations | GET | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5977 in Program.cs |
| /api/v1/admin/locations/{locationId:long}/active | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 5992 in Program.cs |
| /api/v1/admin/locations/{locationId:long}/geo | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6032 in Program.cs |
| /api/v1/admin/locations/{locationId:long}/geocode | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6090 in Program.cs |
| /api/v1/admin/ics-positions | GET | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6173 in Program.cs |
| /api/v1/admin/ics-positions | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6188 in Program.cs |
| /api/v1/admin/ics-positions/{icsPositionId:int} | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6258 in Program.cs |
| /api/v1/admin/ics-positions/{icsPositionId:int}/nims-standard | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6338 in Program.cs |
| /api/v1/admin/sessions | GET | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6378 in Program.cs |
| /api/v1/admin/sessions/{userSessionId:long}/terminate | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6393 in Program.cs |
| /api/v1/admin/sessions/{userSessionId:long}/impersonate/start | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6433 in Program.cs |
| /api/v1/admin/sessions/{userSessionId:long}/impersonate/stop | POST | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6510 in Program.cs |
| /api/v1/admin/sessions/compliance-evidence/export/json | GET | AuthorizationPolicies.LookupAdmin | TBD | TBD | TBD | Pending | Source line 6574 in Program.cs |

## Group: agent

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/agent/history | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 1724 in Program.cs |
| /api/v1/agent/chat/completions | POST | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 1756 in Program.cs |
| /api/v1/agent/planning/predictive-demand-supply | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 1891 in Program.cs |
| /api/v1/agent/planning/predictive-demand-supply/operational-acceptance | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 1976 in Program.cs |
| /api/v1/agent/personalization/policy | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 2046 in Program.cs |
| /api/v1/agent/personalization/policy/history | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 2098 in Program.cs |
| /api/v1/agent/personalization/policy | PUT | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 2138 in Program.cs |
| /api/v1/agent/personalization | POST | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 2202 in Program.cs |
| /api/v1/agent/analytics/events | POST | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 2231 in Program.cs |

## Group: alerts

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/alerts/ | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2291 in Program.cs |
| /api/v1/alerts/ | POST | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2307 in Program.cs |
| /api/v1/alerts/{alertId:long}/acknowledge | POST | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2357 in Program.cs |
| /api/v1/alerts/{alertId:long} | DELETE | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2381 in Program.cs |
| /api/v1/alerts/ | DELETE | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2405 in Program.cs |
| /api/v1/alerts/dispatch | POST | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2421 in Program.cs |
| /api/v1/alerts/{notificationId:long}/recipients | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2547 in Program.cs |
| /api/v1/alerts/{notificationId:long}/recipients/{notificationRecipientId:long}/status | POST | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2576 in Program.cs |
| /api/v1/alerts/{notificationId:long}/recipients/{notificationRecipientId:long}/acknowledge | POST | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2650 in Program.cs |
| /api/v1/alerts/{notificationId:long}/escalate | POST | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2715 in Program.cs |

## Group: auth

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/auth/me | GET | RequireAuthorization() | TBD | TBD | TBD | Pending | Source line 1567 in Program.cs |
| /api/v1/auth/audit/login | POST | RequireAuthorization() | Yes | AUTH / LOGIN_SUCCESS | TBD | In Progress | Source line 1596 in Program.cs |
| /api/v1/auth/audit/logout | POST | RequireAuthorization() | Yes | AUTH / LOGOUT | TBD | In Progress | Source line 1618 in Program.cs |
| /api/v1/auth/token-debug | GET | RequireAuthorization() | TBD | TBD | TBD | Pending | Source line 1640 in Program.cs |

## Group: beds

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/beds/import/availability | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 7411 in Program.cs |
| /api/v1/beds/import/availability/csv | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 7473 in Program.cs |
| /api/v1/beds/import/availability/csv/reject-report | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 7549 in Program.cs |
| /api/v1/beds/import/availability/fhir | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 7590 in Program.cs |
| /api/v1/beds/import/availability/fhir/adapter-contract | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 7662 in Program.cs |
| /api/v1/beds/availability | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 7731 in Program.cs |
| /api/v1/beds/availability/{locationId:long} | POST | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 7739 in Program.cs |

## Group: incidents

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/incidents/dashboard-summary | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2811 in Program.cs |
| /api/v1/incidents/ | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2819 in Program.cs |
| /api/v1/incidents/{incidentId:long} | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2827 in Program.cs |
| /api/v1/incidents/ | POST | AuthorizationPolicies.IncidentCommander | TBD | TBD | TBD | Pending | Source line 2843 in Program.cs |
| /api/v1/incidents/{incidentId:long} | POST | AuthorizationPolicies.IncidentCommander | TBD | TBD | TBD | Pending | Source line 2866 in Program.cs |
| /api/v1/incidents/{incidentId:long}/activate | POST | AuthorizationPolicies.IncidentCommander | TBD | TBD | TBD | Pending | Source line 2888 in Program.cs |
| /api/v1/incidents/{incidentId:long}/close | POST | AuthorizationPolicies.IncidentCommander | TBD | TBD | TBD | Pending | Source line 2904 in Program.cs |
| /api/v1/incidents/{incidentId:long}/tasks | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 2920 in Program.cs |
| /api/v1/incidents/{incidentId:long}/tasks | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 2936 in Program.cs |
| /api/v1/incidents/{incidentId:long}/tasks/{incidentTaskId:long}/status | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 2967 in Program.cs |
| /api/v1/incidents/{incidentId:long}/tasks/{incidentTaskId:long}/assignment | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 2997 in Program.cs |
| /api/v1/incidents/{incidentId:long}/timeline | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 3029 in Program.cs |
| /api/v1/incidents/{incidentId:long}/timeline | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3045 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 3076 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications/lifecycle-summary | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3092 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications/evidence/export/csv | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3121 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3267 in Program.cs |
| /api/v1/incidents/{incidentId:long}/communications/{incidentCommunicationId:long} | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3326 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 3356 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources/lifecycle-summary | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 3372 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources/evidence/export/csv | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3388 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources/lifecycle-evidence/export/json | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3495 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3635 in Program.cs |
| /api/v1/incidents/{incidentId:long}/resources/{incidentResourceRequestId:long} | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3666 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 3758 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3774 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods/{operationalPeriodId:long} | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3805 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods/{operationalPeriodId:long}/approve | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3859 in Program.cs |
| /api/v1/incidents/{incidentId:long}/operational-periods/{operationalPeriodId:long}/reopen | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 3937 in Program.cs |
| /api/v1/incidents/{incidentId:long}/objectives | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4028 in Program.cs |
| /api/v1/incidents/{incidentId:long}/objectives | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4044 in Program.cs |
| /api/v1/incidents/{incidentId:long}/objectives/{incidentObjectiveId:long} | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4075 in Program.cs |
| /api/v1/incidents/{incidentId:long}/command-assignments | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4105 in Program.cs |
| /api/v1/incidents/{incidentId:long}/command-assignments | PUT | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4143 in Program.cs |
| /api/v1/incidents/{incidentId:long}/command-assignments/{icsPositionId:int} | DELETE | AuthorizationPolicies.IncidentCommander | TBD | TBD | TBD | Pending | Source line 4174 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-201 | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4198 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-202 | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4214 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-203 | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4230 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-204 | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4246 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-205 | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4262 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-209 | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4278 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-214 | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4294 in Program.cs |
| /api/v1/incidents/{incidentId:long}/ics-215 | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4310 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-packet | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4326 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-packet/print | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4342 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-packet/export/json | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4364 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-packet/export/print | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4445 in Program.cs |
| /api/v1/incidents/{incidentId:long}/iap-governance/evidence/json | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4506 in Program.cs |
| /api/v1/incidents/{incidentId:long}/situation-reports | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4635 in Program.cs |
| /api/v1/incidents/{incidentId:long}/after-action/evidence/export/json | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4651 in Program.cs |
| /api/v1/incidents/{incidentId:long}/situation-reports | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 4797 in Program.cs |

## Group: lookups

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/lookups/ics-positions | GET | AuthorizationPolicies.LookupViewer | TBD | TBD | TBD | Pending | Source line 4832 in Program.cs |
| /api/v1/lookups/codesets/{codeSetName} | GET | AuthorizationPolicies.LookupViewer | TBD | TBD | TBD | Pending | Source line 6727 in Program.cs |
| /api/v1/lookups/codesets/{codeSetName}/search | GET | AuthorizationPolicies.LookupViewer | TBD | TBD | TBD | Pending | Source line 6745 in Program.cs |
| /api/v1/lookups/locations | GET | AuthorizationPolicies.LookupViewer | TBD | TBD | TBD | Pending | Source line 6769 in Program.cs |
| /api/v1/lookups/codesets/{codeSetName} | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 6778 in Program.cs |
| /api/v1/lookups/codesets/{codeSetName}/{codeValueId:int} | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 6812 in Program.cs |

## Group: reports

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/reports/audit-events | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4845 in Program.cs |
| /api/v1/reports/audit-events/export/csv | GET | AuthorizationPolicies.IncidentViewer | Yes | REPORTING / AUDIT_EVIDENCE_EXPORT_CSV | Yes | In Progress | Source line 4895 in Program.cs |
| /api/v1/reports/external-provider-health/governance/export/csv | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 4974 in Program.cs |
| /api/v1/reports/external-provider-health/scorecards/export/csv | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 5047 in Program.cs |
| /api/v1/reports/external-provider-health/scorecards/export/json | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 5110 in Program.cs |
| /api/v1/reports/external-provider-health/executive-packet/export/zip | GET | AuthorizationPolicies.IncidentViewer | TBD | TBD | TBD | Pending | Source line 5173 in Program.cs |

## Group: resources

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/resources/import/inventory | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 6845 in Program.cs |
| /api/v1/resources/import/inventory/csv | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 6907 in Program.cs |
| /api/v1/resources/import/inventory/csv/reject-report | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 6983 in Program.cs |
| /api/v1/resources/inventory | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 7024 in Program.cs |
| /api/v1/resources/regional-rollups | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 7032 in Program.cs |
| /api/v1/resources/regional-rollups/export/csv | GET | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 7041 in Program.cs |
| /api/v1/resources/inventory/{locationResourceInventoryId:long} | POST | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 7122 in Program.cs |
| /api/v1/resources/report-presets/{presetScope} | GET | AuthorizationPolicies.ResourceReporter | TBD | TBD | TBD | Pending | Source line 7144 in Program.cs |
| /api/v1/resources/report-presets/{presetScope} | POST | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 7169 in Program.cs |
| /api/v1/resources/report-presets/{presetScope}/{userReportPresetId:long} | DELETE | Endpoint-specific review required | TBD | TBD | TBD | Pending | Source line 7233 in Program.cs |

## Group: users

| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |
|---|---|---|---|---|---|---|---|
| /api/v1/users/active | GET | AuthorizationPolicies.LookupViewer | TBD | TBD | TBD | Pending | Source line 6709 in Program.cs |
| /api/v1/users/contacts | GET | AuthorizationPolicies.LookupViewer | TBD | TBD | TBD | Pending | Source line 6718 in Program.cs |

## Current Status Snapshot
- Matrix now contains concrete route paths, methods, and authorization baselines extracted from code.
- Auth baseline verified in code: route groups and endpoint-specific `RequireAuthorization(...)` policies are present across `auth`, `agent`, `alerts`, `incidents`, `reports`, and privileged admin groups.
- Audit evidence partially verified in code for `AUTH/LOGIN_SUCCESS`, `AUTH/LOGOUT`, and `REPORTING/AUDIT_EVIDENCE_EXPORT_CSV` flows.
- Sensitive-data redaction verified for exported audit detail payloads via `RedactSensitiveData(...)` (API keys, bearer/access/refresh tokens, client secrets, passwords, connection strings).
- Next pass: complete endpoint-by-endpoint audit attestation with `audit.AuditEvent` record samples and auth test evidence.

