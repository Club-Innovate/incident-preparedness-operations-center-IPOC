# 04. Operational Workflows and Command Model

## Command Model
IPOC_WEB applies an ICS/NIMS-aligned operational model across module workflows. It emphasizes explicit command ownership, recurring planning cadence, dependency-aware execution, and auditable handoff.

## Core Command Cycle
```mermaid
flowchart LR
  A[Detect and Initiate Incident] --> B[Establish Command Context]
  B --> C[Set Objectives and Planning Cadence]
  C --> D[Execute and Coordinate Tasks]
  D --> E[Monitor Constraints and Signals]
  E --> F[Report, Review, and Decide]
  F --> G[Closeout and Corrective Actions]
  G --> C
```

## Cross-Workspace Workflow
- **Incidents**: incident setup, command context, timeline baseline.
- **Operations**: execution directives, blockers, and escalations.
- **Planning**: SITREP/IAP cadence and objective readiness.
- **Logistics**: shortages, weather/constraint triage, resource posture.
- **Finance/Admin**: reimbursement/procurement and governance checkpoints.
- **Reports/After Action**: decision artifacts, replay evidence, corrective plans.

## Command Transfer and Handoff
- Transfer ledger captures command transitions with explicit accountability.
- Quick-range and preset filters accelerate shift turnover evidence slicing.
- Deep links and guide narratives support briefing continuity across teams.

## Scenario-Based ICS Narrative
- Small Incident: lean command path and rapid stabilization.
- Multi-Agency Expansion: section activation and unified-command cadence.
- Demobilization-heavy closeout: handoff and unresolved action ownership.

## Decision Workflow Diagram
```mermaid
sequenceDiagram
  participant IC as Incident Commander
  participant OPS as Operations
  participant PLN as Planning
  participant LOG as Logistics
  participant FIN as Finance/Admin
  participant REP as Reports

  IC->>OPS: Assign execution priorities
  OPS->>PLN: Escalate planning dependencies
  PLN->>LOG: Request constrained resource support
  LOG->>FIN: Flag procurement/reimbursement needs
  FIN->>REP: Confirm checkpoint evidence
  REP-->>IC: Executive brief and decision package
```
