# Copilot Instructions

## Project Guidelines
- User prefers a Bootstrap-style professional UI with pane expand/collapse controls, consistent theming, toast notifications, and wants MSAL authentication plus passkey capability integrated.
- User expects competitor-grade UI/UX, not generic text-heavy pages, and wants advanced open-source controls (maps, analytics, interactive controls) to make the product look and feel highly professional while matching or exceeding competitor solutions.
- User prefers a significantly more professional enterprise-grade UI aesthetic, comparable to ServiceNow, Apple, and Microsoft product experiences, and wants novice-looking styling removed.
- User prefers strict adherence to explicitly provided UI/task requirements and expects navigation pane behavior to match prior design references (expand/collapse pane). 
- User wants all navigation pane modules/pages to be completed with professional, high-end controls and aesthetically strong, domain-meaningful functionality aligned to each section's core purpose.
- User wants all navigation pages to be intuitive with high-quality controls and meaningful sample/live data behavior, including clear filtering behavior and dependable rendering even when backend datasets are sparse.
- Do not refactor Navigation pane item controls unless explicitly requested; preserve existing active-button highlight behavior and professional collapsed narrow icon-only mode.
- User prefers strict focus to be placed on the previously agreed solution build plan and does not want pivots to alternate task lists unless explicitly requested.
- User prefers execution focused on closing major remaining deliverables and does not want additional fine-tune or micro-optimization tasks until core completion is done.
- User prefers frontend static port configuration to be applied in the correct Aspire/frontend resource location, not indirectly via unrelated service or launch profile overrides.
- When setting fixed frontend ports in Aspire for non-container Vite resources, configure only port and env for the frontend resource; avoid specifying both targetPort and port with the same value on a proxied endpoint.
- Keep operational/error notifications in toast prompt and alert-center collection only; avoid inline page alert blocks that consume dashboard space.
- User wants toast notifications fully restored for save/edit/insert/success/error/warning/info flows, with initial pastel/faded toast display and routing into the Alerts pane, plus admin controls to enable/disable notification types/statuses. User requires reliable bottom-right toast fade in/out behavior.
- Prioritize delivering MVP features, functionality, and UX/UI over additional non-functional hardening unless explicitly requested. Prioritize core MVP features/functionality first; defer fine-tuning by recording it in a markdown follow-up list for later.
- Prefer backend-driven lookup/reference tables for UX selectable fields (e.g., incident type, severity, location, surge potential), rendered at runtime with caching, and support admin/user extensibility for adding new lookup values.
- Implement a generic lookup system over ref.CodeSet/ref.CodeValue, including location lookups from active org.Location with org/region context. Use server-side output caching primarily plus selective client-side short-TTL caching, and support admin/contributor self-service lookup management via soft-delete semantics.
- User requires end-of-task reporting in every session: provide phase-based approach, explain next steps, and ensure implementation aligns with planning markdown files and RFP requirements.
- For local development, use an application/service account for on-prem SQL access; when deployed to Azure, use authenticated user identity for Azure SQL connectivity.
- User expects all UI buttons to be icon-based with meaningful tooltips, all labels to include an info icon tooltip, and no non-functional buttons in the app. Convert traditional buttons across all pages/containers/modals to icon buttons with meaningful tooltip descriptions.
- User wants temporary UX polish tasks to be followed immediately by returning to core solution task assignments/workstream.
- Keep the Create Incident button anchored at the bottom-right, and place the Planned Event closer to the Initial Summary area (left side of right column).
- For UI hover states, keep Active Incident Board tile hover simple and avoid grey background tint/fill effects.
- User prefers ICS Command Structure tiles to be smaller, denser, and use the same hover effect style as Active Incident Board tiles. Implement expandable/collapsible section behavior for these tiles. User wants ICS Command Structure presented as a professional interactive data grid instead of bulky tiles.
- Avoid yellow/amber text or #ffc107 on white backgrounds; use neutral gray or other accessible contrast-safe styling for status/help text. User prefers never to use white text on light backgrounds and to use pastel orange for warnings.
- User prefers a clean, conventional dropdown/edit experience for lookup fields and dislikes chip-heavy suggestion UI for Type Name selection.
- User prefers elegant, distinct theme templates with emphasis on pastel, frosted, and pearl-style palettes; they want more templates and smaller tile sizing to fit more choices in Theme Studio.
- User wants buildout trace/progress captured in markdown planning artifacts, not implemented as additional in-app trace interface features.
- Prioritize 2026+ differentiators: AI-driven Common Operating Picture with an AI Incident Co-Pilot (continuous summary, impact prediction, action recommendations, ICS draft generation) and predictive analytics for public health and emergency management resource risks.

## Incident Command Workspace
- In Edit Incident Metadata, layout preference is: row 1 = Incident Name + Type + Severity + Primary Location; row 2 = Initial Summary + Situation Summary; row 3 = Planned Event + Save button. In this layout, the Save Incident Metadata action should be positioned at the far bottom-right. Additionally, the Incident Type column should be narrower to ensure that the Primary Location fits cleanly on the same row as the Incident Name.

## Design Principles
- User prefers pragmatic object-oriented and modular design: keep files small, avoid concentrating logic in large files, and extract interfaces/modules/components/scripts where appropriate.
- User expects robust exception handling and diagnostic stack trace support to be present across code/script files for troubleshooting. When diagnosing integration issues, include stronger exception handling and explicit debug/print-style diagnostic output to surface what failed and why.
- User expects consistent exception handling, audit/logging, observability instrumentation, file header descriptions, and inline comments across backend and frontend code files, and wants these standards followed rigorously.

## Alert Center
- User wants Alert Center chips to ignore theme gray tones and use explicit appropriate colors. User prefers alert chips with cleaner, more polished colors and readable contrast; avoid muddy/ugly background tones.
- User wants alerts persisted to the database.

## AssistantDock Layout
- Avoid large static empty vertical gaps; only allocate extra vertical space dynamically when personalization/conversation panels are open so normal chat view stays compact.

## Documentation Formatting
- Use plain black-and-white documentation formatting: no emojis or colored icons in markdown files.
- After completing each task, always include explicit next steps in the response and follow copilot-instructions.md.

## User Guide Maintenance
- Maintain the in-app help as a User Guide (not a functional specification), and update the User Guide content whenever new features are added so corresponding usage guidance stays current.

## Implementation Tracking
- Always update KPP_WEB.AppHost/planning/Implementation-Approach/11_Master_Checkoff_Matrix.md as implementation progress changes.
- Always end responses with a 'Next Steps' section.

## Brand/Header Treatment
- Brand/header title and subtitle must not be rendered as chip-like pills; keep clear spacing between title and subtitle with plain text treatment.

## AI Incident Co-Pilot
- User requires personalization changes in AI Incident Co-Pilot to persist reliably across refreshes and wants Dashboard/Reports palette/canvas controls to be consistent and non-duplicated. User also expects app changes to be persisted locally and in backend DB when applicable. User expects admin access controls to reflect their administrator role without incorrect greying out.
- Every response must end with a 'Next Steps' section.

## Compliance and Security
- User prefers each execution round to complete multiple compliance/security items instead of only a single incremental item.

## No-Code Platform Capability
- No-code feature is currently removed from this build and deferred for future redesign; do not describe it as an active capability.

## Tooltip Alignment
- Use left-aligned tooltip text throughout the UI; tooltip content should be text-align left globally.
