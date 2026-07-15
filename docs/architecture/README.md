# IPOC_WEB Architecture Reference

## Purpose
This architecture set provides a complete technical overview of IPOC_WEB, including platform context, features, workflows, security/compliance posture, AI and analytics capabilities, and deployment model.

Use this index as the entry point for solution architecture reviews, bid support, engineering onboarding, and implementation planning.

## Architecture Document Set

1. [01_System_Context_and_Value_Proposition.md](./01_System_Context_and_Value_Proposition.md)
   - Mission context, target users, business outcomes, and capability map.

2. [02_Solution_Component_Architecture.md](./02_Solution_Component_Architecture.md)
   - End-to-end component architecture across frontend, backend, app host, and streaming ingestor.

3. [03_Data_Integration_and_Interop_Architecture.md](./03_Data_Integration_and_Interop_Architecture.md)
   - Data domains, ingestion paths, API surfaces, interoperability (FHIR baseline), and evidence exports.

4. [04_Operational_Workflows_and_Command_Model.md](./04_Operational_Workflows_and_Command_Model.md)
   - ICS/NIMS workflow model, command cycle, cross-workspace operational choreography, and handoff flow.

5. [05_Security_Compliance_and_Governance_Architecture.md](./05_Security_Compliance_and_Governance_Architecture.md)
   - Security controls, governance, auditability, HIPAA/HITRUST alignment narrative, and assurance boundaries.

6. [06_AI_and_Analytics_Architecture.md](./06_AI_and_Analytics_Architecture.md)
   - AI Incident Co-Pilot, predictive modeling, executive analytics, visualization generation, and human-approval guardrails.

7. [07_Deployment_Operability_and_Extensibility.md](./07_Deployment_Operability_and_Extensibility.md)
   - Local/staging production posture, observability, release controls, and extensibility roadmap.

## Document Conventions
- Diagrams are provided in Mermaid for renderable architecture visuals.
- Architecture statements are implementation-grounded to current repository capabilities.
- Compliance content describes alignment/readiness posture and operational controls; formal certification status remains a governance process outcome.

## Work-In-Progress Notice
IPOC_WEB is actively evolving. This architecture set reflects the current implemented baseline plus near-term extension model. Specific capabilities may continue to mature as roadmap increments are delivered.
