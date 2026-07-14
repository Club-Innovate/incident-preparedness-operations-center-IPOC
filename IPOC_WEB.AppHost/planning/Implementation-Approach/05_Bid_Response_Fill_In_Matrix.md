# KDHE EVT0010848 — Bid Response Fill-In Matrix
## Purpose
This document is the **proposal-ready fill-in version** of the competitive + RFP scored matrix.
Each row ends with a **"Proposal Response / Evidence Link"** column where final bid language and supporting artifacts are inserted before submission.

Fill-in conventions:
- **[RESPONSE]** — Replace with final proposal narrative sentence(s).
- **[LINK]** — Replace with evidence artifact path, demo URL, or test result reference.
- **[TBD]** — Confirm and fill before submission gate review.

---

## Section 1 — RFP Scope Fit (EVT0010848 p.28)
| RFP Requirement | Our Position | Competitive Differentiator | Proposal Response / Evidence Link |
|---|---|---|---|
| Scalable electronic ICS aligned to NIMS/NRF for public health/healthcare | IPOC_WEB implements the NIMS/NRF domain model natively from KDHE-aligned SQL schema; incident lifecycle, operational periods, objectives, and tasks are ICS-structured | Unlike generic platforms, every entity and workflow traces directly to the KDHE domain schema and NIMS ICS sections | [RESPONSE] Our solution delivers a purpose-built NIMS/NRF-native incident command environment for KDHE public health operations. [LINK] `02_NIMS_NRF_Traceability_Matrix.md`, demo walkthrough |
| Statewide platform for EEI capture, views/reports, incident notifications | Bed/resource baseline APIs and posture views delivered; multi-channel notification slice next | Audit-first SQL operational record ensures defensible statewide data integrity vs. eventual-consistency NoSQL-only competitors | [RESPONSE] [TBD — insert statewide notification and EEI collection narrative here] [LINK] |
| Both components (IM + Bed/Resource) required | Both domains fully represented in architecture; both APIs and UX surfaces in active development | Single integrated platform removes data silos between incident command and healthcare resource coordination | [RESPONSE] [TBD] [LINK] |
| No patient tracking / no PHI in app | PHI guardrails are hardcoded in domain model; no patient-level entities exist | Explicit architectural constraint with test gate evidence eliminates HIPAA surface risk | [RESPONSE] [TBD] [LINK] |

---

## Section 2 — Incident Management Functional Requirements (A/B/C)
| Ref | Requirement | Our Evidence | Proposal Response / Evidence Link |
|---|---|---|---|
| A1/A2 | Web-capable devices + modern browser support | Browser-based React + .NET 10 on Azure App Service; no client software | [RESPONSE] [TBD] [LINK] browser compatibility matrix |
| A3 | Cross-sector sharing state/local/regional | Entra-backed RBAC with org/region/location scope model | [RESPONSE] [TBD] [LINK] |
| A4 | No per-seat/per-use; 5,000 concurrent users | Azure-hosted scalable architecture; licensing model included in proposal | [RESPONSE] [TBD] [LINK] load test plan |
| A5 | 99.95% uptime | Azure SLA-backed hosting; health endpoints + smoke gate baseline | [RESPONSE] [TBD] [LINK] SLO definition and synthetic monitoring plan |
| A6 | No client software required | Strictly browser-based; no desktop agent, plug-in, or ActiveX dependency | [RESPONSE] Confirmed; no client install required. [LINK] architecture overview |
| B1 | Admin can view/terminate user access | Session termination controls in Admin/Governance slice (next sprint) | [RESPONSE] [TBD] [LINK] |
| B2-B6 | RBAC, granular permissions, local admin, facility management | RBAC baseline with Entra; full user/facility admin module in next sprint | [RESPONSE] [TBD] [LINK] |
| B7/B8 | Unique login + MFA every login | Entra ID with Conditional Access MFA policy enforcement | [RESPONSE] [TBD] [LINK] Entra policy evidence |
| B9 | Full authentication audit logs | Request-level audit middleware present; durable auth event store in audit slice | [RESPONSE] [TBD] [LINK] |
| B10 | Data residency restricted to US | Azure US-only region deployment policy; data sovereignty controls in compliance slice | [RESPONSE] [TBD] [LINK] |
| C1 | Export to Excel/CSV | Reporting/export slice planned; audit-trail-linked export path | [RESPONSE] [TBD] [LINK] |
| C2 | FEMA-compatible AAR report | FEMA AAR/IP in reporting slice; template aligned to FEMA standards | [RESPONSE] [TBD] [LINK] |
| C4 | Multi-incident management + historical query | Incident list/detail/history baseline; multi-incident COP in roadmap | [RESPONSE] [TBD] [LINK] |
| C5/C6 | Distinct user admin section and profiles | Admin panel scaffold exists; full lifecycle admin in next sprint | [RESPONSE] [TBD] [LINK] |
| C7 | Test/demo environment | Local/dev + smoke gate; formalized UAT runbook in delivery package | [RESPONSE] [TBD] [LINK] |
| C8 | HVA downloadable | HVA workflow in reporting slice; downloadable output in scope | [RESPONSE] [TBD] [LINK] |

---

## Section 3 — Bed/Resource Functional Requirements (D/E/F/G)
| Ref | Requirement | Our Evidence | Proposal Response / Evidence Link |
|---|---|---|---|
| D1/D2 | Web-capable devices + modern browser support | Browser-based app architecture confirmed | [RESPONSE] [TBD] [LINK] |
| D3 | Cross-sector data collection/sharing | Cross-sector API and lookup/location model; sharing workflow in resource lifecycle slice | [RESPONSE] [TBD] [LINK] |
| D4 | No per-seat/per-use; 2,000 concurrent users | Scalable Azure architecture; licensing terms in proposal | [RESPONSE] [TBD] [LINK] load test evidence |
| D6 | 99.95% uptime | Azure SLA + health monitoring baseline | [RESPONSE] [TBD] [LINK] |
| D7 | No client software | Browser-based, zero client footprint | [RESPONSE] Confirmed. [LINK] |
| E1-E6 | Session/admin controls, RBAC, role segregation, account management | RBAC baseline; full admin module in next sprint | [RESPONSE] [TBD] [LINK] |
| E7/E8 | Unique login + MFA | Entra ID + Conditional Access MFA | [RESPONSE] [TBD] [LINK] Entra policy evidence |
| E9 | Authentication logs on request | Auth event persistence in audit slice; requestable via admin query | [RESPONSE] [TBD] [LINK] |
| E10 | US data residency and access constraints | Azure US-only deployment; data sovereignty controls in compliance slice | [RESPONSE] [TBD] [LINK] |
| F2 | Export to Excel/CSV | Export module in reporting slice | [RESPONSE] [TBD] [LINK] |
| F3 | Batch upload/update user data | Bulk admin import in admin/governance slice | [RESPONSE] [TBD] [LINK] |
| F4/F5 | User administration and distinct profiles | Full user lifecycle admin in next sprint | [RESPONSE] [TBD] [LINK] |
| F6 | Test/demo environment | Available; formalized runbook in delivery package | [RESPONSE] [TBD] [LINK] |
| F7 | "Switch to user view" for troubleshooting | Controlled impersonation with audit trail in admin slice | [RESPONSE] [TBD] [LINK] |
| F8/F9 | Configurable system/user resource-status views | Configurable view builder in resource lifecycle slice | [RESPONSE] [TBD] [LINK] |
| F10 | Detailed facility account snapshot | Full facility snapshot card in resource lifecycle slice (EMResource parity) | [RESPONSE] [TBD] [LINK] |
| F11 | Ad-hoc + standard prompts for point-in-time facility data | EEI prompt orchestration in resource lifecycle slice | [RESPONSE] [TBD] [LINK] |
| G1 | Add-on API for bed data import from hospital EHR | Standards-aware EHR ingestion adapter in integration slice | [RESPONSE] [TBD] [LINK] |

---

## Section 4 — Security and Data Attachment Readiness
| Area | Our Evidence | Proposal Response / Evidence Link |
|---|---|---|
| Industry-standard data protection controls | Entra auth, parameterized queries, managed identity, Key Vault, audit middleware | [RESPONSE] [TBD] [LINK] security control summary |
| Kansas K.S.A./ITEC/OITS policy alignment | Compliance matrix planned; formal attestation in compliance slice | [RESPONSE] [TBD] [LINK] compliance control matrix |
| Security training and governance artifacts | Runbooks and training log templates in compliance delivery package | [RESPONSE] [TBD] [LINK] |

---

## Section 5 — Competitive Differentiators (Proposal Win Themes)
| Differentiator | Supporting Evidence | Proposal Response / Evidence Link |
|---|---|---|
| NIMS/NRF-native healthcare operations model — not generic incident tooling | Every entity and workflow traces to KDHE-aligned SQL schema and NIMS ICS sections | [RESPONSE] [TBD] [LINK] `02_NIMS_NRF_Traceability_Matrix.md` |
| Audit-first SQL-authoritative operational record | Non-repudiable audit table per command event; defensible export path from day one | [RESPONSE] [TBD] [LINK] audit table schema |
| Degraded-but-operational resilience with explicit operator visibility | Degraded-mode banner, health endpoint, and fallback toggle pattern built into architecture | [RESPONSE] [TBD] [LINK] readiness endpoint + smoke gate output |
| Interoperability without rip-and-replace | API-first, event-capable, EHR/GIS integration profiles; existing customer infrastructure preserved | [RESPONSE] [TBD] [LINK] integration architecture diagram |
| ICS/NIMS-accurate UX — workspace sections map to ICS command structure | Tabbed incident workspace (Overview / Tasks / Timeline / Periods & Objectives / SITREP/IAP); SITREP/IAP tab includes ICS-201 Incident Briefing with aggregated incident metadata, current operational period, active objectives, ICS command assignments, and resource summary; integrated situation report generation and history tracking | [RESPONSE] [TBD] [LINK] demo screenshot + SITREP/IAP tab walkthrough |
| Compliance-evidence-by-design | Every feature slice produces auditable, exportable evidence artifacts | [RESPONSE] [TBD] [LINK] audit + export sample artifacts |
| Competitive parity with leading platforms — purpose-built for KDHE | Feature parity table vs. Juvare/Veoci/E Team/Everbridge/Esri documented in `04_Competitive_and_RFP_Scored_Matrix.md` | [RESPONSE] [TBD] [LINK] `04_Competitive_and_RFP_Scored_Matrix.md` |

---

## Submission Gate Checklist
Before final submission, confirm every [TBD] row is resolved and each [LINK] points to a deliverable artifact or demo recording:

- [ ] All Section 1–3 rows have final proposal narrative
- [ ] All evidence [LINK]s point to committed artifacts or demo recordings
- [ ] Compliance matrix created and attached
- [ ] Licensing model statement finalized
- [ ] Load test plan and SLO definition drafted
- [ ] US data residency policy documented
- [ ] Non-functional evidence package complete (uptime, concurrency, browser compatibility)
- [ ] Final proposal reviewed against RFP p.28–34 line by line