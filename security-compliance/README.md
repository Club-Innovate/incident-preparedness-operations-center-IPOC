# Security & Compliance Framework

This folder defines a reusable, application-agnostic security and compliance architecture that can be applied to IPOC and future systems.

## Folder Structure

- `architecture/` - target architecture, trust boundaries, and reference patterns
- `standards/` - normative standards, policy baselines, and control expectations
- `controls/` - control catalog and implementation requirements
- `templates/` - reusable implementation and evidence templates
- `evidence/` - evidence index and collection guidance
- `roadmaps/` - time-phased implementation plans

## How to Use

1. Start with `standards/HIPAA_HITRUST_Blueprint.md`.
2. Instantiate a system using `templates/project-compliance-profile.template.yaml`.
3. Map controls in `controls/control-catalog.md`.
4. Track implementation evidence with `templates/evidence-register.template.csv`.
5. Execute `roadmaps/IPOC_30-60-90_Compliance_Plan.md` and replicate for new systems.

## Applicability

This framework is designed to be technology-neutral with cloud implementation notes where useful.
It supports internal readiness and external assessment preparation; certification requires independent assessor validation.
