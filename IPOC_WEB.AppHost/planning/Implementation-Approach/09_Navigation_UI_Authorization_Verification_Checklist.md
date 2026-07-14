# Navigation UI Authorization Verification Checklist

## Purpose
Verify that navigation module action controls enforce role/scope gating and clearly communicate disabled-state behavior without duplicating existing workspace functionality.

## Scope
- Logistics module controls (watchlist/escalation)
- Finance/Admin module controls (checkpoint toggles)
- After Action module controls (corrective-action starter controls)

## Verification Matrix
| Scenario | Auth State | Role/Scope Example | Expected UI Result |
|---|---|---|---|
| Unauthenticated user | Not signed in | N/A | All module action controls disabled; guidance text indicates access requirement. |
| Authenticated but no matching role/scope | Signed in | role=`INCIDENT_VIEWER`; scope=`incident.read` | Action controls disabled; guidance text shown. |
| Logistics authorized by role | Signed in | role=`RESOURCE_REPORTER` | Logistics controls enabled; Finance/Admin and After Action remain policy-gated by their own rules. |
| Logistics authorized by scope | Signed in | scope=`resource.report` | Logistics controls enabled. |
| Finance/Admin authorized by role | Signed in | role=`LOOKUP_ADMIN` | Finance/Admin controls enabled. |
| Finance/Admin authorized by scope | Signed in | scope=`lookup.admin` | Finance/Admin controls enabled. |
| After Action authorized by commander role | Signed in | role=`INCIDENT_COMMANDER` | After Action controls enabled. |
| After Action authorized by scope | Signed in | scope=`access_as_user` | After Action controls enabled. |

## UI Checks
1. Disabled controls must remain icon-based and retain tooltip descriptions.
2. Guidance text must remain visible when controls are disabled by authz.
3. Enabled/disabled transitions must react after auth diagnostics refresh.
4. No module action should navigate or mutate Incident Command Workspace tabs directly.

## Smoke and Regression Hooks
1. Run local smoke gate with frontend authorization smoke enabled by default.
2. Validate smoke output includes explicit `Frontend authorization smoke status` line.
3. Validate smoke output includes explicit `Backend report-presets policy alignment smoke status` line.
4. Validate smoke output includes runtime report-presets endpoint auth check behavior:
   - no token: `401` (or `200` when development user bypass is enabled)
   - with token: `200`
5. If environment cannot run frontend checks, ensure `Skipped*` status is explicit and reason is logged.
