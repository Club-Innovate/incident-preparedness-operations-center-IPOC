# Breach Notification Workflow

## Purpose

Define the operational process for evaluating, escalating, and notifying stakeholders when a potential data breach or unauthorized disclosure is detected.

## Trigger Conditions

Initiate this workflow when any of the following occur:

- Suspected unauthorized access to PHI or sensitive operational data
- Confirmed control bypass affecting confidentiality/integrity
- Incident response assessment indicates potential reportable breach

## Workflow Steps

1. **Detect and Triage**
   - Record incident source and detection timestamp.
   - Assign incident commander and compliance lead.
2. **Contain and Preserve Evidence**
   - Isolate affected systems/accounts.
   - Preserve logs and forensic artifacts.
3. **Impact Assessment**
   - Determine affected data classes, user impact, and exposure window.
   - Document confidence level and known unknowns.
4. **Legal/Compliance Escalation**
   - Follow `security-compliance/operations/legal-escalation-matrix.md`.
   - Determine notification obligations and required timelines.
5. **Notification Execution**
   - Prepare internal/external notification package.
   - Track notification timestamps and recipients.
6. **Recovery and Corrective Actions**
   - Remediate root cause and validate controls.
   - Link corrective actions to owners and due dates.
7. **Post-Incident Review**
   - Conduct retrospective and update controls/runbooks.

## Required Evidence Artifacts

- Incident ID and timeline
- Impact assessment report
- Escalation decision log
- Notification record and approvals
- Corrective action register
