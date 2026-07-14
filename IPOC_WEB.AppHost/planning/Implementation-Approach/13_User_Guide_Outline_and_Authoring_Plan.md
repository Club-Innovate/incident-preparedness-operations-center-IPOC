# IPOC_WEB User Guide Outline and Authoring Plan

## Purpose
Provide a high-quality, operator-focused user guide that explains each page, key feature areas, workflow intent, and step-by-step usage tutorials for command and executive users.

## Authoring Goals
1. Explain **what each page is for** (decision intent, not only control descriptions).
2. Explain **how to use each section** with realistic operator scenarios.
3. Explain **why each control matters** using concise tooltips and deep-reference guide content.
4. Provide **role-based walkthroughs** for command, planning, logistics, finance/admin, and after-action users.
5. Include **best-practice playbooks** so users apply the system effectively during surge operations.

## Guide Structure (Proposed)

### 1. Platform Orientation
- Navigation model and workspace hierarchy.
- Core concepts: incidents, operational periods, directives, command handoffs, evidence exports.
- Common UI conventions (badges, triage lanes, drill-through, replay, export metadata).

### 2. Page-by-Page Reference + Tutorials
For each workspace page:
- Purpose and decision outcomes.
- Main sections and controls.
- “How to use” walkthrough (tutorial sequence).
- Troubleshooting and common mistakes.

Target pages:
- Dashboard
- Incidents
- Facilities/Resources
- Reports
- Common Operating Picture
- Operations
- Planning
- Logistics
- Finance & Administration
- After Action
- Alerts
- Assistant/AI Copilot panel

### 3. Reports Deep-Dive (Priority)
- Executive decision queue workflow.
- Pending approvals workflow (single + batch triage).
- Decision history replay workflow.
- Export workflows (mode, rationale filtering, metadata interpretation).
- Cross-workspace handoff guidance.

### 4. Role-Based Tutorials
- Incident Commander quick-start.
- Planning lead cycle workflow.
- Logistics coordinator fulfillment triage.
- Finance/Admin cost-recovery and procurement cadence.
- After-action evidence and improvement pipeline workflow.

### 5. Operational Readiness and Governance
- Validation gates and smoke checks.
- Evidence package expectations.
- Audit/export handling guidance.
- Feature-flag behavior awareness.

## Tutorial Quality Standard
Each tutorial should include:
1. Objective
2. Prerequisites
3. Step-by-step actions
4. Expected outcome
5. Validation checks
6. Recovery paths for common errors

## Delivery Plan
### Phase 1 (Immediate)
- Publish full outline and style standards.
- Deliver complete Reports workspace guide (highest current complexity).

### Phase 2
- Deliver COP + Operations + Planning guides.

### Phase 3
- Deliver Logistics + Finance/Admin + After Action guides.

### Phase 4
- Deliver platform orientation, role-based paths, and release governance sections.

## Maintenance Plan
- Update the guide in every feature round where user workflows change.
- Keep guide links synchronized with matrix and release closeout evidence.
- Add a changelog section to track guide updates per sprint.

## Latest Workflow Delta Notes (2026-07)
1. **Operations focused-incident selector** now uses a single combobox interaction model (textbox + filtered options + keyboard navigation); tutorials must show arrow/enter/escape usage and live-match behavior.
2. **Reports pending-approval triage rail** now uses one-row pastel icon actions with hover affordance; tutorials must map icon semantics (select/clear/approve/defer/reject) and non-wrapping behavior.
3. **Admin General > Cache** now shows requested-vs-runtime Redis mode and Docker startup-attempt feedback; tutorials must explain requested intent vs active runtime and Redis container startup verification cues.
4. **Admin General > API Performance Timing Logs** now provides an admin-facing switch for browser-local API timing diagnostics (`ipoc.api.timing.debug`); tutorials must explain enable/disable behavior, local-browser scope, and how to read method/status/elapsed-ms console output for triage.
5. **Incident context loading responsiveness** now uses short-lived read-cache + in-flight dedupe with mutation invalidation and parallel detail/dataset load startup; tutorials should clarify expected faster selector-switch behavior and note that recent writes may briefly rehydrate as cache invalidation completes.

## Authoring Next Actions (Immediate)
1. Update Reports deep-dive screenshots and callouts to reflect one-row icon action rail styling and icon meanings.
2. Add Operations tutorial subsection for visible typeahead textbox workflow and keyboard recovery (`Esc`, selector change, empty-match behavior).
3. Add Admin tutorial subsection for cache mode governance (`requested` vs `runtime`, restart-required scenarios, auditability expectations).
4. Add Admin troubleshooting subsection for API timing diagnostics toggle usage (when to enable, sample log interpretation, when to disable for normal operations).
5. Add Planning/Operations performance expectation note describing improved incident-switch loading flow and validation cues operators should observe.
