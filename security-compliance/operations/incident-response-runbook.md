# Incident Response Runbook

## Purpose

Define the operational response process for security/compliance incidents affecting IPOC systems or data.

## Severity Levels

- **SEV-1**: Active compromise, suspected PHI exposure, critical service impact.
- **SEV-2**: Confirmed policy/security control failure without active compromise.
- **SEV-3**: Low-impact security anomaly or control drift with no confirmed exposure.

## Response Timeline Targets

- Initial triage: within 1 hour (SEV-1), 4 hours (SEV-2), 1 business day (SEV-3)
- Containment start: within 2 hours (SEV-1), same day (SEV-2)
- Stakeholder notification kickoff: within 4 hours (SEV-1), 1 business day (SEV-2)

## Response Steps

1. **Detect and Triage**
   - Capture incident source, timestamp, impacted services, and potential data classes.
   - Open incident record and assign incident commander.
2. **Contain**
   - Isolate affected endpoint/service/account access.
   - Preserve forensic logs and relevant artifacts.
3. **Assess Impact**
   - Determine whether PHI or sensitive operational data may be impacted.
   - Confirm control failures and scope of affected users/systems.
4. **Eradicate and Recover**
   - Apply remediations, rotate credentials/keys if needed, and restore normal operations.
   - Validate control effectiveness post-remediation.
5. **Communicate and Document**
   - Notify internal stakeholders and legal/compliance contacts per severity.
   - Record timeline, decisions, evidence references, and follow-up actions.
6. **Post-Incident Review**
   - Conduct retrospective and assign preventive actions with owners and due dates.

## Required Artifacts

- Incident ticket/reference ID
- Timeline of response actions
- Affected asset inventory
- Audit/event log excerpts
- Root cause analysis
- Corrective action plan

## Tabletop Drill Cadence

- Minimum cadence: quarterly
- Record each exercise in: `security-compliance/operations/incident-response-tabletop-log.md`
