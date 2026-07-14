import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion, Badge, Card, Col, Form, Row } from 'react-bootstrap';

type AppView = 'dashboard' | 'incidents' | 'facilities' | 'reports' | 'cop' | 'operations' | 'planning' | 'logistics' | 'finance' | 'after-action';

type LinkKind = 'OVERVIEW' | 'QUICKSTART' | 'HOW-TO GUIDE' | 'REFERENCE' | 'SAMPLE' | 'SECURITY' | 'COMPLIANCE' | 'OBSERVABILITY';

type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

type GuideCallout = {
  tone: CalloutTone;
  title: string;
  body: string;
};

type GuideCodeSample = {
  title: string;
  language: string;
  code: string;
};

type GuideLink = {
  id: string;
  title: string;
  kind: LinkKind;
  detail: string;
  tutorial: string[];
  prerequisites?: string[];
  expectedOutcomes?: string[];
  sectionChecklist?: string[];
  commonPitfalls?: string[];
  callout?: GuideCallout;
  codeSample?: GuideCodeSample;
};

type GuideSection = {
  id: string;
  title: string;
  links: GuideLink[];
};

type GuideTopic = {
  id: string;
  title: string;
  intro: string;
  keywords: string[];
  sections: GuideSection[];
};

type NavGroup = {
  id: string;
  label: string;
  topicIds: string[];
};

type UserGuidePageProps = {
  initialView: AppView;
};

const viewToTopic: Record<AppView, string> = {
  dashboard: 'application-overview',
  incidents: 'incidents-command-workspace',
  facilities: 'facilities-capacity-and-resources',
  reports: 'reporting-and-evidence',
  cop: 'common-operating-picture',
  operations: 'operations-coordination-cockpit',
  planning: 'planning-cycle-command-board',
  logistics: 'logistics-staging-operations-cockpit',
  finance: 'finance-administration-command-board',
  'after-action': 'after-action-analytics-board',
};

const navGroups: NavGroup[] = [
  { id: 'overview', label: 'Overview', topicIds: ['application-overview'] },
  {
    id: 'quickstarts',
    label: 'Quickstarts',
    topicIds: [
      'operations-coordination-cockpit',
      'planning-cycle-command-board',
      'logistics-staging-operations-cockpit',
      'finance-administration-command-board',
      'after-action-analytics-board',
      'incidents-command-workspace',
      'common-operating-picture',
      'facilities-capacity-and-resources',
      'reporting-and-evidence',
    ],
  },
  {
    id: 'setup-and-management',
    label: 'Setup and management',
    topicIds: ['administrator-workspace-and-modal', 'application-overview'],
  },
  {
    id: 'classic-operations',
    label: 'Classic operations',
    topicIds: ['operations-coordination-cockpit', 'planning-cycle-command-board', 'logistics-staging-operations-cockpit'],
  },
  {
    id: 'security',
    label: 'Security',
    topicIds: ['security-compliance-audit-observability'],
  },
  {
    id: 'development',
    label: 'Development',
    topicIds: ['application-overview', 'administrator-workspace-and-modal'],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    topicIds: ['security-compliance-audit-observability', 'common-operating-picture'],
  },
  {
    id: 'samples',
    label: 'Samples',
    topicIds: ['workflow-samples-and-runbooks'],
  },
  {
    id: 'references',
    label: 'References',
    topicIds: ['references-and-glossary'],
  },
];

const tocExpandedStateLocalStorageKey = 'ipoc.help.toc.expanded-state.v1';

const coreScenarioMilestones: string[] = [
  'Initiate an incident with validated location, severity, and command ownership.',
  'Build an execution workflow across operations, planning, logistics, and finance checkpoints.',
  'Configure administration controls (roles, locations, cache mode, ingestion, and governance defaults).',
  'Publish evidence-driven reports and close the loop through after-action corrective tracking.',
];

function getCalloutClassName(tone: CalloutTone): string {
  switch (tone) {
    case 'success':
      return 'border-success-subtle bg-success-subtle';
    case 'warning':
      return 'border-warning-subtle bg-warning-subtle';
    case 'danger':
      return 'border-danger-subtle bg-danger-subtle';
    default:
      return 'border-info-subtle bg-info-subtle';
  }
}

const topics: GuideTopic[] = [
  {
    id: 'application-overview',
    title: 'Application overview',
    intro: 'Incident Preparedness Operations Center (IPOC) is an operational command platform for incident response, planning, logistics, finance/administration, and after-action improvement. This user guide explains how to use each page and section effectively.',
    keywords: ['application overview', 'ipoc', 'user guide', 'navigation', 'features', 'faq'],
    sections: [
      {
        id: 'app-overview',
        title: 'What IPOC is and how to use it',
        links: [
          {
            id: 'ipoc-overview',
            title: 'What is IPOC?',
            kind: 'OVERVIEW',
            detail: 'Mission-oriented command platform that connects incident execution, governance, and continuous improvement into one operating rhythm.',
            prerequisites: [
              'User account has authenticated access to IPOC and at least one incident domain.',
              'Operator understands local incident command structure and escalation policy.',
            ],
            tutorial: [
              'Start in Incidents to establish command context (incident owner, severity, location, and operational objective).',
              'Use focused-incident selectors in each workspace so every command action stays scoped to the same operational event.',
              'Drive execution through Operations and Planning, then route constraints through Logistics and Finance/Admin checkpoints.',
              'Close the command cycle using Reporting and After Action to produce traceable outcomes and corrective actions.',
            ],
            expectedOutcomes: [
              'Users understand that IPOC is a cross-module operating system, not a single-page tracker.',
              'Teams align on one incident narrative from initial response through closeout.',
            ],
            sectionChecklist: [
              'Incident has clear owner and command mode.',
              'Execution lane tasks have owners and due windows.',
              'Governance checkpoints and evidence outputs are scheduled before closure.',
            ],
            commonPitfalls: [
              'Switching focused incident mid-cycle without documenting handoff causes fragmented metrics.',
              'Treating module cards as static dashboards instead of action-oriented controls delays execution.',
            ],
            callout: {
              tone: 'info',
              title: 'Operating model',
              body: 'Use IPOC as a closed loop: detect -> coordinate -> execute -> validate -> improve.',
            },
          },
          {
            id: 'ipoc-features',
            title: 'Core features',
            kind: 'REFERENCE',
            detail: 'Detailed capability map for command operations, governance, and support workflows.',
            tutorial: [
              'Command flow modules: Incidents, Operations, Planning, Logistics, Finance/Admin, and After Action.',
              'Situational modules: Dashboard, COP, Facilities, and Reporting for command visibility and evidence.',
              'Global controls: alerts, administrator modal, theme studio, and contextual Help entry from header.',
              'Cross-cutting signals: readiness, weather impact, workload pressure, compliance status, and closure risk.',
            ],
            expectedOutcomes: [
              'Users can map each operational question to the correct module and section.',
              'Leads can train new operators with consistent page responsibility boundaries.',
            ],
            callout: {
              tone: 'success',
              title: 'Role-based usage pattern',
              body: 'Operators execute tasks in module controls; supervisors monitor readiness and unblock dependencies.',
            },
          },
          {
            id: 'ipoc-faq',
            title: 'FAQ',
            kind: 'REFERENCE',
            detail: 'Frequent user questions and recommended usage patterns.',
            sectionChecklist: [
              'Confirm role permissions before troubleshooting disabled controls.',
              'Verify active focused incident and command mode.',
              'Capture timestamp and screen context when escalating support issues.',
            ],
            tutorial: [
              'Q: Why are some controls disabled? A: Role authorization, feature flags, or prerequisite workflow states.',
              'Q: Why does Help open new tab? A: Preserves current page context and allows side-by-side learning.',
              'Q: Where do I learn admin workflows? A: Administrator workspace and modal section in this guide.',
            ],
            commonPitfalls: [
              'Escalating issues without incident context (which incident, module, and tab) slows support triage.',
            ],
          },
          {
            id: 'ipoc-core-scenario',
            title: 'Core scenario: first incident to closure',
            kind: 'SAMPLE',
            detail: 'End-to-end tutorial covering incident creation, workflow execution, administration, and closeout.',
            prerequisites: [
              'At least one test/real incident location is available.',
              'Admin user can access configuration modal.',
              'Operations lead and planner have assigned roles.',
            ],
            tutorial: [
              'Create incident "Regional Flooding - North Sector" with severity and activation timestamp.',
              'In Operations, assign lane directives for evacuation coordination, shelter staffing, and communications.',
              'In Planning, publish objective set for operational period and update SITREP freshness.',
              'In Logistics, flag bed/resource shortages and assign escalation owner for constrained facilities.',
              'In Finance/Admin, mark reimbursement/procurement checkpoints with packet readiness status.',
              'In Reports and After Action, generate evidence pack and open corrective actions for unresolved gaps.',
              'Finalize closure only after governance checklist and corrective owners are confirmed.',
            ],
            expectedOutcomes: [
              'Users can execute the full command lifecycle with traceable ownership.',
              'Leadership receives a closure package with operational and audit evidence.',
            ],
            callout: {
              tone: 'warning',
              title: 'Training recommendation',
              body: 'Run this scenario in a tabletop environment first, then repeat in live operations with role-specific job aids.',
            },
          },
          {
            id: 'use-reports-predictive-risk-analytics',
            title: 'Use Reports predictive risk analytics signal',
            kind: 'HOW-TO GUIDE',
            detail: 'Review demand/supply forecast risk signal in Reports, adjust horizon, and refresh analytics for current incident scope.',
            prerequisites: [
              'At least one active or recent incident is visible in Reports filters.',
              'Agent predictive-demand endpoint is available for authenticated users.',
            ],
            tutorial: [
              'Open Reports and locate the Predictive risk analytics card under KPI summary tiles.',
              'Select a 24h, 48h, or 72h horizon based on command planning window.',
              'Use refresh action to regenerate latest risk signal from predictive model service.',
              'Apply Top recommendation output into planning and operations workflows after command review.',
            ],
            expectedOutcomes: [
              'Command staff can rapidly assess forecasted shortfall and risk level in Reports.',
              'Planning teams align actions to an explicit predictive recommendation signal.',
            ],
            commonPitfalls: [
              'Treating predictive output as final command decision without incident commander validation.',
              'Using stale report filters that hide active incidents and reduce signal relevance.',
            ],
            callout: {
              tone: 'warning',
              title: 'Decision support guidance',
              body: 'Predictive analytics are advisory. Confirm recommendations against live operations telemetry before execution.',
            },
          },
          {
            id: 'use-cop-ai-impact-hotspots',
            title: 'Use COP AI impact hotspot overlay',
            kind: 'HOW-TO GUIDE',
            detail: 'Activate AI impact hotspots layer in COP to prioritize location-level risk escalation and route command actions.',
            prerequisites: [
              'COP has incident/resource/bed baseline data for current AOI scope.',
              'Operator has access to Incident, Planning, or Operations workspaces for cross-workspace handoff.',
            ],
            tutorial: [
              'Open Common Operating Picture and select AI impact hotspots in geospatial layer controls.',
              'Use stress filter badges (All, Watch+, High only) to focus map and command queue on highest-risk locations.',
              'Select hotspot markers to inspect AI impact stress alongside resource, bed, and incident stress context.',
              'Use queue actions to open Planning/Operations/Incident workspaces with handoff context for mitigation execution.',
            ],
            expectedOutcomes: [
              'Command team can prioritize AI-ranked hotspots in a map-first workflow.',
              'Cross-workspace action routing starts from COP risk context without losing AOI and stress filters.',
            ],
            commonPitfalls: [
              'Operating only in composite layer and missing AI hotspot prioritization signal.',
              'Acknowledging queue actions without routing work into downstream planning/operations execution lanes.',
            ],
            callout: {
              tone: 'warning',
              title: 'Operational use guidance',
              body: 'AI hotspot ranking is decision-support. Validate local constraints and command intent before escalation actions.',
            },
          },
          {
            id: 'use-reports-executive-decision-brief-package',
            title: 'Use Reports executive decision brief package export',
            kind: 'HOW-TO GUIDE',
            detail: 'Capture trend baseline and export one-click executive brief package with recommendation bundle for command leadership handoff.',
            prerequisites: [
              'Reports filters are set to the desired operational window and grouping scope.',
              'Pending approval recommendation rows are available in the current report scope.',
            ],
            tutorial: [
              'Open Reports and locate the Executive decision brief package card.',
              'Use baseline capture action to set the current trend comparison timestamp.',
              'Review recommendation queue and confidence values in pending approvals section.',
              'Use export action to download executive decision brief markdown package with trend deltas and top recommendations.',
            ],
            expectedOutcomes: [
              'Leadership receives a concise decision brief with trend-delta context and prioritized recommendations.',
              'Command teams can archive consistent brief artifacts across reporting cycles.',
            ],
            commonPitfalls: [
              'Skipping baseline capture can reduce interpretability of delta metadata across cycles.',
              'Exporting before filter validation can produce a brief for unintended operational scope.',
            ],
            callout: {
              tone: 'warning',
              title: 'Governance reminder',
              body: 'Executive brief recommendations are decision support artifacts and require command validation prior to execution.',
            },
          },
        ],
      },
      {
        id: 'app-management',
        title: 'Setup and management basics',
        links: [
          {
            id: 'configure-navigation',
            title: 'Configure user workflow setup',
            kind: 'HOW-TO GUIDE',
            detail: 'Daily shift-start setup for operators, supervisors, and admin support leads.',
            prerequisites: [
              'Shift lead has assigned module ownership for current operational period.',
              'Incident list is reviewed for active and standby states.',
            ],
            tutorial: [
              'Set the active incident naming convention and verify all workspaces reference the same incident ID.',
              'Align module sequence for the shift (example: Incidents -> Operations -> Planning -> Logistics -> Finance).',
              'Keep this guide open in a second tab and use the left TOC to jump directly to role-specific runbooks.',
              'At mid-shift, review checklist completion and update unresolved blockers in execution lanes.',
              'At shift-end, export reporting snapshot and handoff notes to the incoming command team.',
            ],
            sectionChecklist: [
              'Incident context verified across modules.',
              'Command mode selected in operational workspaces.',
              'Escalation owner assigned for weather or shortage alerts.',
              'Handoff artifacts identified for reporting/export.',
            ],
            commonPitfalls: [
              'Teams starting work before incident naming and ownership alignment creates data drift.',
              'Skipping mid-shift checkpoint reviews leads to late-stage closure surprises.',
            ],
            callout: {
              tone: 'success',
              title: 'Shift discipline',
              body: 'Treat setup as a formal preflight. Five minutes of alignment can remove hours of rework later in the cycle.',
            },
          },
          {
            id: 'configure-ai-search-service',
            title: 'Configure backend AI Search service integration',
            kind: 'HOW-TO GUIDE',
            detail: 'Starter backend configuration pattern for Azure AI Search-backed retrieval workflows used by assistant features.',
            prerequisites: [
              'Azure subscription with an Azure AI Search service and index created.',
              'Backend API project has secure secret loading (environment variables or Key Vault).',
            ],
            tutorial: [
              'Create service-level settings for endpoint, index name, API version, and credential source.',
              'Inject typed options into backend startup and validate at boot time.',
              'Implement a search client wrapper with retry policy and explicit timeout boundaries.',
              'Log query correlation IDs so operator questions can be traced to backend retrieval events.',
              'Surface safe fallback behavior in UI when search service is unavailable.',
            ],
            expectedOutcomes: [
              'Backend can query indexed incident knowledge consistently.',
              'Operations teams receive deterministic behavior when AI retrieval is degraded.',
            ],
            commonPitfalls: [
              'Hardcoding API keys in source control rather than secure configuration stores.',
              'Skipping timeout/retry controls can lock UI flows during transient search failures.',
            ],
            callout: {
              tone: 'danger',
              title: 'Security requirement',
              body: 'Never store search admin keys in frontend code. Keep credentials in backend-only secrets storage.',
            },
            codeSample: {
              title: 'Sample .NET backend configuration for Azure AI Search',
              language: 'csharp',
              code: `public sealed class AiSearchOptions\n{\n    public string Endpoint { get; init; } = string.Empty;\n    public string IndexName { get; init; } = string.Empty;\n    public string ApiKey { get; init; } = string.Empty;\n}\n\nbuilder.Services\n    .AddOptions<AiSearchOptions>()\n    .Bind(builder.Configuration.GetSection("AiSearch"))\n    .ValidateDataAnnotations()\n    .Validate(options =>\n        Uri.TryCreate(options.Endpoint, UriKind.Absolute, out _)\n        && !string.IsNullOrWhiteSpace(options.IndexName)\n        && !string.IsNullOrWhiteSpace(options.ApiKey),\n        "AiSearch settings are invalid.");\n\nbuilder.Services.AddSingleton(sp =>\n{\n    var options = sp.GetRequiredService<IOptions<AiSearchOptions>>().Value;\n    var credential = new AzureKeyCredential(options.ApiKey);\n    return new SearchClient(new Uri(options.Endpoint), options.IndexName, credential);\n});`,
            },
          },
          {
            id: 'use-ai-incident-copilot-briefing',
            title: 'Use AI Incident Co-Pilot incident briefing and ICS objective drafts',
            kind: 'HOW-TO GUIDE',
            detail: 'Generate incident summary briefs, action recommendations, and ICS draft objectives from AI Incident Co-Pilot prompts with incident ID and horizon context.',
            prerequisites: [
              'User is authenticated and Assistant Dock is enabled.',
              'Prompt includes a valid incident ID (example: incident 125) and optional horizon (example: 24 hours).',
            ],
            tutorial: [
              'Open AI Incident Co-Pilot and submit a brief-style prompt such as "create an AI incident co-pilot brief for incident 125 over 24 hours".',
              'For action recommendations, include recommendation intent in prompt text.',
              'For ICS drafting support, use prompt text like "generate ICS draft objectives for incident 125 over 24 hours".',
              'Review generated assumptions and recommendations before operational execution.',
            ],
            expectedOutcomes: [
              'Command staff receives a concise AI-assisted operational brief for the incident horizon.',
              'Teams can bootstrap ICS objective drafting with grounded predictive planning context.',
            ],
            commonPitfalls: [
              'Missing incident ID in prompt prevents predictive context retrieval.',
              'Treating draft objectives as final without command review and approval.',
            ],
            callout: {
              tone: 'warning',
              title: 'Human-in-the-loop requirement',
              body: 'AI briefing and ICS draft output are decision-support artifacts and must be reviewed by incident command before execution.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'operations-coordination-cockpit',
    title: 'Operations Coordination Cockpit',
    intro: 'Coordinate command tempo, focused-incident execution, and dependency-aware directive flow.',
    keywords: ['operations', 'playbooks', 'focused incident', 'directives', 'coordination'],
    sections: [
      {
        id: 'ops-get-started',
        title: 'Get started',
        links: [
          {
            id: 'ops-quickstart',
            title: 'Use operations coordination',
            kind: 'QUICKSTART',
            detail: 'Run a full operational command cycle with ownership, dependencies, and escalation discipline.',
            prerequisites: [
              'Incident is active and command owner is assigned.',
              'Execution lane contains initial directive set for current period.',
            ],
            tutorial: [
              'Select the focused incident in combobox, then verify incident metadata at top status region.',
              'Set command mode (Balanced, Surge, Communications) based on current pressure and staffing profile.',
              'Run readiness checkpoints before initiating playbook actions to avoid premature execution.',
              'Create or refine execution lane directives with owner, due date, and dependency chain.',
              'Review needs-attention counters and escalate unresolved blockers to planning/logistics leads.',
            ],
            sectionChecklist: [
              'All active directives have owners and due windows.',
              'Blocked directives are tagged with dependency reason.',
              'Escalation queue reflects unresolved high-priority tasks.',
            ],
            expectedOutcomes: [
              'Operational team has synchronized command posture and visible blocker status.',
              'Downstream teams receive dependency-aware work items for planning/logistics.',
            ],
            commonPitfalls: [
              'Running playbooks without readiness verification creates downstream rework.',
              'Unowned directives become silent delays in closure timelines.',
            ],
            callout: {
              tone: 'warning',
              title: 'Escalation discipline',
              body: 'If a blocker persists beyond one review interval, escalate immediately and document the dependency owner.',
            },
          },
        ],
      },
      {
        id: 'ops-controls',
        title: 'How-to guide',
        links: [
          {
            id: 'ops-controls-reference',
            title: 'Use controls and metrics',
            kind: 'HOW-TO GUIDE',
            detail: 'Detailed control behavior for all operations sections.',
            tutorial: [
              'Combobox section: supports keyboard navigation and scoped incident switching without leaving page.',
              'Playbook section: run command actions only when gating states are met.',
              'Execution lane section: keep blockers current and maintain dependency map integrity.',
              'Signal section: attention badge and needs-attention count indicate escalation urgency.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'planning-cycle-command-board',
    title: 'Planning Cycle Command Board',
    intro: 'Manage planning cadence, SITREP freshness, objective readiness, and governance actions.',
    keywords: ['planning', 'sitrep', 'objectives', 'cadence', 'governance'],
    sections: [
      {
        id: 'planning-quickstart-group',
        title: 'Quickstart',
        links: [
          {
            id: 'planning-quickstart',
            title: 'Run planning cycle workflow',
            kind: 'QUICKSTART',
            detail: 'Operational period control loop for objective readiness, SITREP quality, and handoff execution.',
            prerequisites: [
              'Current operational period is defined and shared with command staff.',
              'Latest SITREP source data is available or flagged stale.',
            ],
            tutorial: [
              'Confirm focused incident and check SITREP freshness before objective review starts.',
              'Set planning cadence mode to match event tempo (routine, accelerated, surge).',
              'Review objective readiness indicators and identify objectives lacking owners or evidence.',
              'Execute planning playbook actions and update execution lane dependencies.',
              'Publish timeline updates and handoff packet to operations lead with explicit unresolved items.',
            ],
            expectedOutcomes: [
              'Operational period objectives are measurable, owned, and time-bounded.',
              'SITREP and timeline outputs are synchronized for downstream execution teams.',
            ],
            callout: {
              tone: 'info',
              title: 'Planning quality signal',
              body: 'Objective readiness is reliable only when ownership, due time, and evidence source are all present.',
            },
          },
        ],
      },
      {
        id: 'planning-reference-group',
        title: 'How-to guide',
        links: [
          {
            id: 'planning-controls',
            title: 'Use planning controls',
            kind: 'HOW-TO GUIDE',
            detail: 'Per-section instructions and expected behavior.',
            tutorial: [
              'Focused incident selector defines scope for all planning cards and signals.',
              'Cadence selector changes planning posture and urgency expectations.',
              'AI summary controls (when enabled): generate, approve, reject, clear; record approval actor/time.',
              'Execution lane manages planning tasks, dependencies, and readiness continuity.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'logistics-staging-operations-cockpit',
    title: 'Logistics & Staging Operations Cockpit',
    intro: 'Coordinate inventory and bed-shortage triage with weather and location-focused map operations.',
    keywords: ['logistics', 'staging', 'inventory', 'shortage', 'weather', 'map'],
    sections: [
      {
        id: 'logistics-quickstart-group',
        title: 'Quickstart',
        links: [
          {
            id: 'logistics-quickstart',
            title: 'Run logistics triage cycle',
            kind: 'QUICKSTART',
            detail: 'Logistics triage workflow from feed integrity review to constrained-resource escalation.',
            prerequisites: [
              'Facility and resource feeds are connected or manually verified.',
              'AOI/map context is set for incident-affected footprint.',
            ],
            tutorial: [
              'Start with feed-health and weather disruption indicators to detect stale or degraded inputs.',
              'Use map and location controls to focus highest-risk facilities and transport corridors.',
              'Review inventory and bed constraints, then assign watchlist or escalation flags.',
              'Route unresolved shortages to execution queue with owner, SLA target, and fallback action.',
              'Confirm queue state is reflected in Operations and Planning dependency cards.',
            ],
            expectedOutcomes: [
              'Resource shortages are visible with ownership and escalation timelines.',
              'Cross-module teams share the same constraint narrative for decision-making.',
            ],
            callout: {
              tone: 'danger',
              title: 'High-risk condition',
              body: 'If weather impact and shortage severity rise together, trigger immediate cross-module command review.',
            },
          },
        ],
      },
      {
        id: 'logistics-howto-group',
        title: 'How-to guide',
        links: [
          {
            id: 'logistics-controls',
            title: 'Use logistics controls and sections',
            kind: 'HOW-TO GUIDE',
            detail: 'Detailed instructions for map, weather, analytics, and queues.',
            tutorial: [
              'Weather section: click disruption badge to open day-level weather impact details.',
              'Map section: marker click sets focus location context for triage actions.',
              'Analytics section: use filter and mode controls to narrow operational set.',
              'Queue sections: assign watchlist/escalation states and clear resolved backlog.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'finance-administration-command-board',
    title: 'Finance & Administration Command Board',
    intro: 'Manage reimbursement/procurement readiness and administrative governance checkpoints.',
    keywords: ['finance', 'administration', 'reimbursement', 'procurement', 'checkpoints'],
    sections: [
      {
        id: 'finance-quickstart-group',
        title: 'Quickstart',
        links: [
          {
            id: 'finance-quickstart',
            title: 'Run finance/admin readiness cycle',
            kind: 'QUICKSTART',
            detail: 'Checkpoint-driven governance cycle for reimbursement, procurement, and administrative closure readiness.',
            prerequisites: [
              'Finance/admin roles are assigned for current incident period.',
              'Procurement and reimbursement packet templates are available.',
            ],
            tutorial: [
              'Select command mode (Balanced, Cost Recovery, Procurement Focus) based on incident phase.',
              'Review KPI cards for packet completeness, aging workload, and compliance risk.',
              'Assign lane directives for missing artifacts and ownership gaps.',
              'Update checkpoint status only after evidence links are validated.',
              'Escalate unresolved high-risk packets before period closure recommendation.',
            ],
            sectionChecklist: [
              'Reimbursement packet status current and evidence-linked.',
              'Procurement packet status current and approval path defined.',
              'Admin follow-up actions have named owners.',
            ],
            expectedOutcomes: [
              'Financial governance posture is auditable and closure-ready.',
              'Supervisors can certify readiness without manual evidence chase.',
            ],
            callout: {
              tone: 'success',
              title: 'Governance quality',
              body: 'Checkpoint completion is meaningful only when every status maps to verifiable evidence.',
            },
          },
        ],
      },
      {
        id: 'finance-howto-group',
        title: 'How-to guide',
        links: [
          {
            id: 'finance-controls',
            title: 'Use finance/admin controls',
            kind: 'HOW-TO GUIDE',
            detail: 'Section-by-section control guidance.',
            tutorial: [
              'Mode section controls prioritization strategy.',
              'Execution lane section captures ownership and dependency closure sequencing.',
              'Checkpoint section records cost packet, procurement packet, and admin follow-up readiness.',
              'Use access notices to verify role requirements for privileged actions.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'after-action-analytics-board',
    title: 'After Action Analytics Board',
    intro: 'Support retrospective quality analysis, closure readiness, and corrective-action follow-through.',
    keywords: ['after action', 'retrospective', 'closure', 'corrective actions', 'analytics'],
    sections: [
      {
        id: 'aar-quickstart-group',
        title: 'Quickstart',
        links: [
          {
            id: 'aar-quickstart',
            title: 'Run after-action cycle',
            kind: 'QUICKSTART',
            detail: 'Evidence-to-improvement workflow for closure quality and sustained corrective action tracking.',
            prerequisites: [
              'Incident timeline and reporting exports are complete for review window.',
              'Primary findings reviewer and corrective owner are assigned.',
            ],
            tutorial: [
              'Choose mode (Evidence Quality, Closure Readiness, Improvement Pipeline) for current retrospective objective.',
              'Review evidence coverage and identify findings lacking validated source records.',
              'Promote high-confidence findings into corrective starters with owner and deadline.',
              'Track corrective progress in execution lane and verify closure criteria before final archive.',
              'Publish lessons-learned summary for next operational planning cycle.',
            ],
            expectedOutcomes: [
              'Retrospective findings are prioritized and converted into accountable actions.',
              'Closure recommendations include measurable improvement commitments.',
            ],
          },
        ],
      },
      {
        id: 'aar-howto-group',
        title: 'How-to guide',
        links: [
          {
            id: 'aar-controls',
            title: 'Use after-action controls',
            kind: 'HOW-TO GUIDE',
            detail: 'Detailed guidance for replay, findings, and corrective controls.',
            tutorial: [
              'Replay section: inspect moment-by-moment summaries and readiness context.',
              'Findings section: review candidate lessons and evidence links.',
              'Corrective section: add/remove placeholders and assign execution ownership.',
              'Use closure metrics to validate readiness for archival/report handoff.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'incidents-command-workspace',
    title: 'Incidents Command Workspace',
    intro: 'Incident-level command execution for tasks, resources, communications, timelines, periods, and objectives.',
    keywords: ['incidents', 'command', 'tasks', 'communications', 'timeline', 'objectives'],
    sections: [
      {
        id: 'incidents-overview-group',
        title: 'Overview and quickstart',
        links: [
          {
            id: 'incidents-quickstart',
            title: 'Create and run an incident command cycle',
            kind: 'QUICKSTART',
            detail: 'Foundational incident lifecycle workflow that anchors all other module activity.',
            prerequisites: [
              'Incident taxonomy (type, severity model, location model) is defined by administrators.',
              'Responding unit roster and communication channels are available.',
            ],
            tutorial: [
              'Create incident record with incident name, type, severity, start time, and geographic location.',
              'Activate the incident and verify it appears in focused-incident selectors across modules.',
              'Add initial tasks, resources, and communications to establish execution baseline.',
              'Maintain timeline events for major operational decisions and external communications.',
              'Define operational periods and objectives with clear owners before handing off to operations/planning.',
            ],
            sectionChecklist: [
              'Incident metadata complete and consistent.',
              'Activation state confirmed across module selectors.',
              'Timeline includes key command decisions.',
              'Objectives include owners and measurable outcomes.',
            ],
            expectedOutcomes: [
              'Incident context is stable for downstream modules.',
              'Teams can execute without ambiguity about priorities or ownership.',
            ],
            callout: {
              tone: 'info',
              title: 'Critical first hour',
              body: 'The first incident setup determines data quality and coordination quality for the entire lifecycle.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'common-operating-picture',
    title: 'Common Operating Picture (COP)',
    intro: 'Shared geospatial and situational context for coordinated decision support.',
    keywords: ['cop', 'map', 'overlays', 'aoi', 'situational awareness'],
    sections: [
      {
        id: 'cop-overview-group',
        title: 'Overview and how-to',
        links: [
          {
            id: 'cop-howto',
            title: 'Use COP map and overlays',
            kind: 'HOW-TO GUIDE',
            detail: 'Area-of-interest decision workflow using map layers, overlays, weather context, and incident signals.',
            prerequisites: [
              'Focused incident is selected and AOI baseline is defined.',
              'Map layer permissions and data feed status are validated.',
            ],
            tutorial: [
              'Set focused incident and choose AOI preset (regional, corridor, facility cluster) before analysis.',
              'Toggle only required overlays (hazards, transport, capacity, weather) to reduce visual noise.',
              'Inspect map markers and callouts for facilities with rising risk or constrained throughput.',
              'Correlate weather and alert cards with map zones, then route findings to operations/logistics queues.',
              'Capture COP snapshot and share as handoff artifact for command briefing.',
            ],
            expectedOutcomes: [
              'Teams share one geospatial operating picture for tactical decisions.',
              'High-risk zones are escalated with traceable context and owner assignment.',
            ],
            sectionChecklist: [
              'AOI selected and relevant overlays enabled.',
              'At-risk locations tagged and escalated.',
              'Snapshot captured for command briefing continuity.',
            ],
            callout: {
              tone: 'info',
              title: 'Map signal hygiene',
              body: 'Use the minimum overlay set needed for each decision point to avoid misinterpreting conflicting visual signals.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'facilities-capacity-and-resources',
    title: 'Facilities Capacity and Resource Posture',
    intro: 'Capacity analytics, trend drilldowns, and resource/bed posture management.',
    keywords: ['facilities', 'capacity', 'resources', 'beds', 'analytics'],
    sections: [
      {
        id: 'facilities-quickstart-group',
        title: 'Quickstart and reference',
        links: [
          {
            id: 'facilities-quickstart',
            title: 'Run facilities posture review',
            kind: 'QUICKSTART',
            detail: 'Capacity and resource readiness workflow for beds, staffing pressure, and trend-based escalation.',
            prerequisites: [
              'Facility census and resource feeds are refreshed for the active period.',
              'Facility ownership and escalation contacts are up to date.',
            ],
            tutorial: [
              'Review capacity analytics cards for occupancy, throughput, and trend deltas.',
              'Drill into trend anomalies and validate source data with facility operators.',
              'Update bed/resource records only after verification and include rationale notes.',
              'Push critical posture changes to logistics queues and confirm dashboard reflection.',
            ],
            expectedOutcomes: [
              'Capacity posture reflects current operating conditions with validated sources.',
              'Resource constraints are visible to logistics and command teams in near real time.',
            ],
            commonPitfalls: [
              'Updating records from stale feed snapshots produces false confidence in readiness status.',
            ],
            callout: {
              tone: 'warning',
              title: 'Data freshness guardrail',
              body: 'If feed freshness is degraded, mark data confidence and escalate before making allocation decisions.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'reporting-and-evidence',
    title: 'Reporting and Evidence',
    intro: 'Analytics, grouped reporting, filtering, and export preparation for operational and audit scenarios.',
    keywords: ['reporting', 'evidence', 'exports', 'analytics', 'filters'],
    sections: [
      {
        id: 'reporting-howto-group',
        title: 'How-to guide',
        links: [
          {
            id: 'reporting-howto',
            title: 'Generate reports and evidence outputs',
            kind: 'HOW-TO GUIDE',
            detail: 'Operational and audit reporting workflow for grouped analytics, evidence exports, and decision traceability.',
            prerequisites: [
              'Reporting window and incident scope are explicitly defined.',
              'Required evidence sources (timeline, tasks, checkpoints) are available.',
            ],
            tutorial: [
              'Set report time window, grouping dimensions, and incident filters for the target audience.',
              'Review aggregate outputs first, then drill to detailed records for anomalies or unresolved gaps.',
              'Validate evidence completeness before export (owner, timestamp, and status presence).',
              'Generate exports and attach to compliance review or after-action closure packet.',
            ],
            sectionChecklist: [
              'Scope/time window confirmed.',
              'Evidence completeness validated.',
              'Export generated and linked to review workflow.',
            ],
            expectedOutcomes: [
              'Decision-makers receive consistent performance and governance evidence.',
              'Audit and after-action teams can trace outcomes without manual reconstruction.',
            ],
            callout: {
              tone: 'success',
              title: 'Evidence quality standard',
              body: 'A report is closure-ready only when each critical metric can be traced to source actions and timestamps.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'administrator-workspace-and-modal',
    title: 'Administrator workspace and modal',
    intro: 'Configuration, governance, and operational management controls provided through admin surfaces.',
    keywords: ['administrator', 'admin', 'modal', 'configuration', 'governance'],
    sections: [
      {
        id: 'admin-overview-group',
        title: 'Overview',
        links: [
          {
            id: 'admin-overview',
            title: 'Admin responsibilities',
            kind: 'OVERVIEW',
            detail: 'Administrator operating charter for platform configuration, governance controls, and safe operational change.',
            prerequisites: [
              'Administrator access approved for current environment.',
              'Change governance process defined (ticketing/approval/rollback).',
            ],
            tutorial: [
              'Establish admin objective for each session (access correction, location update, ingestion tuning, governance setup).',
              'Validate role boundaries and planned blast radius before making any high-impact changes.',
              'Apply updates incrementally with immediate module-level verification after each change.',
              'Record audit notes including actor, timestamp, rationale, and observed outcome.',
            ],
            expectedOutcomes: [
              'Administrative actions are predictable, traceable, and reversible.',
              'Operational teams receive stable behavior during active incidents.',
            ],
          },
        ],
      },
      {
        id: 'admin-howto-group',
        title: 'How-to guide',
        links: [
          {
            id: 'admin-howto',
            title: 'Use admin modal sections',
            kind: 'HOW-TO GUIDE',
            detail: 'Comprehensive administrator workflow for users, roles, locations, ICS positions, cache mode, ingestion, and governance settings.',
            prerequisites: [
              'Administrator role with full modal access.',
              'Change ticket or operational intent recorded before edits.',
            ],
            tutorial: [
              'Open administrator modal and confirm current environment/profile context.',
              'User and role tabs: validate account state, role assignment, and least-privilege boundaries.',
              'Location and ICS tabs: ensure naming standards, geolocation accuracy, and position hierarchy consistency.',
              'Cache mode and ingestion tabs: apply changes in controlled increments, then validate data freshness indicators.',
              'Weather default and token/config tabs: confirm secrets and defaults align with operational policy.',
              'After each update, verify effects in impacted modules and capture audit notes before finalizing.',
            ],
            sectionChecklist: [
              'User/role alignment verified for current shift.',
              'Critical location data and ICS hierarchy validated.',
              'Data ingestion and cache freshness checks passed.',
              'Audit notes captured with timestamp and actor.',
            ],
            commonPitfalls: [
              'Bulk changes across multiple tabs without checkpoint validation can hide root-cause when regressions occur.',
              'Skipping audit note capture creates governance gaps during post-incident review.',
            ],
            callout: {
              tone: 'warning',
              title: 'Change safety',
              body: 'Apply one high-impact change at a time and validate in the target module before continuing.',
            },
          },
          {
            id: 'admin-sample',
            title: 'Sample admin runbook',
            kind: 'SAMPLE',
            detail: 'Repeatable safe-change runbook spanning user access, location updates, ingestion validation, and post-change monitoring.',
            prerequisites: [
              'Change request approved with rollback criteria.',
              'Validation owner assigned for each impacted module.',
            ],
            tutorial: [
              'Step 1: Record intent, impacted tabs, success criteria, and rollback trigger.',
              'Step 2: Apply one change in admin modal and save with a timestamped note.',
              'Step 3: Validate effects in impacted modules (Incidents, Operations, Logistics, Reporting).',
              'Step 4: Review alert center and readiness indicators for 1-2 monitoring intervals.',
              'Step 5: Document final state and publish handoff/update summary.',
            ],
            sectionChecklist: [
              'Rollback trigger documented before change.',
              'Cross-module validation completed.',
              'Monitoring interval passed without regression.',
            ],
            callout: {
              tone: 'warning',
              title: 'Rollback-first mindset',
              body: 'Define rollback before applying the change, not after observing a problem.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'security-compliance-audit-observability',
    title: 'Security, Compliance, Audit, and Observability',
    intro: 'Operational governance guidance for secure and auditable usage across all modules.',
    keywords: ['security', 'compliance', 'audit', 'observability', 'governance'],
    sections: [
      {
        id: 'security-guide-group',
        title: 'Security and compliance',
        links: [
          {
            id: 'security-reference',
            title: 'Security reference',
            kind: 'SECURITY',
            detail: 'Role boundaries and access behavior.',
            prerequisites: [
              'Role matrix is current and mapped to module actions.',
            ],
            tutorial: [
              'Authorization boundaries are enforced at control/action level.',
              'Use least-privilege access and avoid mixed-role operational sessions.',
              'Review privileged-action logs during shift handoff for unusual access patterns.',
            ],
            sectionChecklist: [
              'Least-privilege role assignment verified.',
              'Privileged action log reviewed.',
            ],
          },
          {
            id: 'compliance-reference',
            title: 'Compliance and audit reference',
            kind: 'COMPLIANCE',
            detail: 'Evidence and traceability requirements.',
            tutorial: [
              'Preserve action traceability across timeline/tasks/resources/procurement.',
              'Use reporting and after-action exports for audit packages.',
              'Ensure every checkpoint status in finance/admin has linked supporting evidence.',
            ],
            expectedOutcomes: [
              'Audit reviewers can trace critical decisions to verifiable evidence.',
            ],
          },
          {
            id: 'observability-reference',
            title: 'Observability reference',
            kind: 'OBSERVABILITY',
            detail: 'Monitoring and troubleshooting signals.',
            tutorial: [
              'Monitor alert center, readiness indicators, and weather/data-availability notices.',
              'Escalate with reproducible context and timestamps.',
              'Use module-level signal trends to identify emerging degradation before user impact spikes.',
            ],
            callout: {
              tone: 'info',
              title: 'Incident telemetry discipline',
              body: 'Always include incident ID, module name, and exact timestamp when escalating reliability issues.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'workflow-samples-and-runbooks',
    title: 'Workflow samples and runbooks',
    intro: 'Example operational patterns for shift handoff, incident surge, and audit preparation.',
    keywords: ['samples', 'runbooks', 'handoff', 'audit', 'workflow'],
    sections: [
      {
        id: 'samples-group',
        title: 'Samples',
        links: [
          {
            id: 'sample-handoff',
            title: 'Shift handoff sample',
            kind: 'SAMPLE',
            detail: 'Cross-module handoff pattern.',
            tutorial: [
              'Review Dashboard and COP context.',
              'Validate Operations and Planning status.',
              'Confirm Logistics, Finance, and After Action queue states.',
              'Document unresolved blockers and escalation paths.',
            ],
            sectionChecklist: [
              'Outgoing lead confirms unresolved blockers list.',
              'Incoming lead acknowledges priority stack and escalation owners.',
            ],
          },
          {
            id: 'sample-audit',
            title: 'Audit preparation sample',
            kind: 'SAMPLE',
            detail: 'Evidence assembly workflow.',
            tutorial: [
              'Export reporting outputs and capture metadata.',
              'Validate finance/admin checkpoints and after-action readiness.',
              'Bundle traceability notes and review with compliance stakeholders.',
            ],
            expectedOutcomes: [
              'Audit package is complete, reproducible, and review-ready without ad hoc data pulls.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'references-and-glossary',
    title: 'References and glossary',
    intro: 'Quick reference for module terms, control behavior, and operational conventions.',
    keywords: ['references', 'glossary', 'terminology', 'conventions'],
    sections: [
      {
        id: 'references-group',
        title: 'Reference',
        links: [
          {
            id: 'reference-glossary',
            title: 'Glossary and usage conventions',
            kind: 'REFERENCE',
            detail: 'Terminology and interpretation baseline.',
            tutorial: [
              'Focused incident: the incident currently scoped for module-specific controls.',
              'Execution lane: dependency-aware directive board for operational ownership and progression.',
              'Readiness signals: status indicators used to prioritize next actions and escalation decisions.',
            ],
            sectionChecklist: [
              'All operators use standardized terms during handoff and escalation.',
            ],
          },
        ],
      },
    ],
  },
];

function UserGuidePage({ initialView }: UserGuidePageProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState(viewToTopic[initialView]);
  const [contentMode, setContentMode] = useState<'hub' | 'topic'>('hub');
  const [isTocCollapsed, setIsTocCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const defaults = Object.fromEntries(navGroups.map((group) => [group.id, true]));
    const persisted = localStorage.getItem(tocExpandedStateLocalStorageKey);
    if (!persisted) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(persisted) as Record<string, boolean>;
      return {
        ...defaults,
        ...parsed,
      };
    } catch {
      return defaults;
    }
  });
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const topicsById = useMemo(() => Object.fromEntries(topics.map((topic) => [topic.id, topic])), []);

  const filteredNavGroups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return navGroups;
    }

    return navGroups
      .map((group) => ({
        ...group,
        topicIds: group.topicIds.filter((topicId) => {
          const topic = topicsById[topicId];
          if (!topic) {
            return false;
          }

          return (
            topic.title.toLowerCase().includes(query)
            || topic.intro.toLowerCase().includes(query)
            || topic.keywords.some((keyword) => keyword.toLowerCase().includes(query))
            || topic.sections.some((section) => (
              section.title.toLowerCase().includes(query)
              || section.links.some((link) => (
                link.title.toLowerCase().includes(query)
                || link.detail.toLowerCase().includes(query)
                || link.tutorial.some((step) => step.toLowerCase().includes(query))
              ))
            ))
          );
        }),
      }))
      .filter((group) => group.topicIds.length > 0);
  }, [searchText, topicsById]);

  useEffect(() => {
    localStorage.setItem(tocExpandedStateLocalStorageKey, JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  const selectedTopic = topicsById[selectedTopicId] ?? topics[0];

  const openTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    setContentMode('topic');
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) => ({ ...current, [groupId]: !(current[groupId] ?? true) }));
  };

  const handleGroupKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, groupId: string, expanded: boolean) => {
    if (event.key === 'ArrowRight' && !expanded) {
      event.preventDefault();
      setExpandedGroups((current) => ({ ...current, [groupId]: true }));
      return;
    }

    if (event.key === 'ArrowLeft' && expanded) {
      event.preventDefault();
      setExpandedGroups((current) => ({ ...current, [groupId]: false }));
    }
  };

  const handleTopicKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, groupId: string) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setExpandedGroups((current) => ({ ...current, [groupId]: false }));
      groupButtonRefs.current[groupId]?.focus();
    }
  };

  return (
    <div className="ipoc-help-page container-fluid py-3">
      <Row className="g-3">
        <Col lg={isTocCollapsed ? 'auto' : 3} className={`ipoc-help-toc-col ${isTocCollapsed ? 'ipoc-help-toc-col-collapsed' : ''}`}>
          <Card className={`shadow-sm ipoc-help-toc-card sticky-top ${isTocCollapsed ? 'ipoc-help-toc-card-collapsed' : ''}`} style={{ top: '1rem', maxHeight: 'calc(100vh - 2rem)' }}>
            <Card.Header className="d-flex align-items-center justify-content-between">
              {!isTocCollapsed && <span className="small fw-semibold text-uppercase text-muted">User Guide</span>}
              <button
                type="button"
                className="btn btn-sm ipoc-help-toc-toggle-btn"
                aria-label={isTocCollapsed ? 'Expand user guide navigation pane' : 'Collapse user guide navigation pane'}
                onClick={() => setIsTocCollapsed((current) => !current)}
              >
                <i className={`bi ${isTocCollapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`} aria-hidden="true" />
              </button>
            </Card.Header>

            {!isTocCollapsed && (
              <Card.Body style={{ overflowY: 'auto' }}>
                <Form.Control
                  size="sm"
                  placeholder="Find by title"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="mb-3"
                />

                <div role="tree" aria-label="User guide table of contents">
                  {filteredNavGroups.map((group) => {
                    const isExpanded = expandedGroups[group.id] ?? true;
                    return (
                      <div key={group.id} className="mb-2" role="treeitem" aria-level={1} aria-expanded={isExpanded}>
                        <button
                          type="button"
                          className="btn btn-link btn-sm w-100 text-start text-decoration-none d-flex align-items-center justify-content-between"
                          ref={(element) => {
                            groupButtonRefs.current[group.id] = element;
                          }}
                          onClick={() => toggleGroup(group.id)}
                          onKeyDown={(event) => handleGroupKeyDown(event, group.id, isExpanded)}
                        >
                          <span>{group.label}</span>
                          <span className="small text-muted" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                        </button>

                        {isExpanded && (
                          <div className="ms-2 d-flex flex-column gap-1" role="group" aria-label={`${group.label} topics`}>
                            {group.topicIds.map((topicId) => {
                              const topic = topicsById[topicId];
                              if (!topic) {
                                return null;
                              }

                              return (
                                <button
                                  key={`${group.id}-${topic.id}`}
                                  type="button"
                                  role="treeitem"
                                  aria-level={2}
                                  aria-selected={selectedTopic.id === topic.id}
                                  className={`btn btn-sm text-start ${selectedTopic.id === topic.id && contentMode === 'topic' ? 'btn-light border' : 'btn-link text-decoration-none'}`}
                                  onClick={() => openTopic(topic.id)}
                                  onKeyDown={(event) => handleTopicKeyDown(event, group.id)}
                                >
                                  {topic.title}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card.Body>
            )}
          </Card>
        </Col>

        <Col lg={isTocCollapsed ? true : 9}>
          <div className="small text-muted mb-2">Learn &gt; IPOC &gt; User Guide</div>
          <div className="d-flex gap-2 mb-3">
            <button
              type="button"
              className={`btn btn-sm ${contentMode === 'hub' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setContentMode('hub')}
            >
              Documentation hub
            </button>
            <button
              type="button"
              className={`btn btn-sm ${contentMode === 'topic' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setContentMode('topic')}
            >
              Topic detail
            </button>
          </div>

          {contentMode === 'hub' ? (
            <>
              <h1 className="h2 mb-2">IPOC documentation hub</h1>
              <p className="mb-4">Use this landing mode to explore grouped topics, then open topic detail for section-by-section execution guidance.</p>

              <Card className="shadow-sm ipoc-help-doc-card mb-3">
                <Card.Header className="fw-semibold">Core scenario milestones</Card.Header>
                <Card.Body>
                  <ol className="small mb-0">
                    {coreScenarioMilestones.map((milestone) => (
                      <li key={milestone} className="mb-1">{milestone}</li>
                    ))}
                  </ol>
                </Card.Body>
              </Card>

              <Row className="g-3">
                {filteredNavGroups.map((group) => (
                  <Col xl={6} key={`hub-${group.id}`}>
                    <Card className="shadow-sm h-100 ipoc-help-doc-card">
                      <Card.Header className="fw-semibold">{group.label}</Card.Header>
                      <Card.Body>
                        <div className="d-flex flex-column gap-3">
                          {group.topicIds.map((topicId) => {
                            const topic = topicsById[topicId];
                            if (!topic) {
                              return null;
                            }

                            return (
                              <div key={`hub-topic-${group.id}-${topic.id}`}>
                                <div className="fw-semibold">{topic.title}</div>
                                <div className="small text-muted mb-2">{topic.intro}</div>
                                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openTopic(topic.id)}>
                                  Open topic detail
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          ) : (
            <>
              <h1 className="h2 mb-2">{selectedTopic.title}</h1>
              <p className="mb-3">{selectedTopic.intro}</p>

              <Card className="shadow-sm ipoc-help-doc-card mb-3">
                <Card.Header className="fw-semibold">Core scenario milestones</Card.Header>
                <Card.Body>
                  <ol className="small mb-0">
                    {coreScenarioMilestones.map((milestone) => (
                      <li key={milestone} className="mb-1">{milestone}</li>
                    ))}
                  </ol>
                </Card.Body>
              </Card>

              <Row className="g-3">
                {selectedTopic.sections.map((section) => (
                  <Col xl={6} key={section.id}>
                    <Card className="shadow-sm h-100 ipoc-help-doc-card">
                      <Card.Header className="fw-semibold">{section.title}</Card.Header>
                      <Card.Body>
                        {section.links.map((link) => {
                          const accordionBase = `${section.id}-${link.id}`;
                          return (
                            <div key={link.id} className="mb-4 pb-1 border-bottom">
                              <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                <div className="fw-semibold mb-1">{link.title}</div>
                                <Badge bg="secondary" className="fw-semibold">{link.kind}</Badge>
                              </div>
                              <div className="small text-muted mb-2">{link.detail}</div>

                              {link.callout && (
                                <div className={`border rounded-2 px-3 py-2 mb-2 ${getCalloutClassName(link.callout.tone)}`}>
                                  <div className="small fw-semibold mb-1">{link.callout.title}</div>
                                  <div className="small mb-0">{link.callout.body}</div>
                                </div>
                              )}

                              <Accordion flush alwaysOpen>
                                {link.prerequisites && link.prerequisites.length > 0 && (
                                  <Accordion.Item eventKey={`${accordionBase}-prereqs`}>
                                    <Accordion.Header>Prerequisites</Accordion.Header>
                                    <Accordion.Body>
                                      <ul className="small mb-0">
                                        {link.prerequisites.map((item) => (
                                          <li key={`${accordionBase}-prereq-${item}`}>{item}</li>
                                        ))}
                                      </ul>
                                    </Accordion.Body>
                                  </Accordion.Item>
                                )}

                                <Accordion.Item eventKey={`${accordionBase}-tutorial`}>
                                  <Accordion.Header>Tutorial steps</Accordion.Header>
                                  <Accordion.Body>
                                    <ol className="small mb-0">
                                      {link.tutorial.map((step) => (
                                        <li key={`${accordionBase}-step-${step}`} className="mb-1">{step}</li>
                                      ))}
                                    </ol>
                                  </Accordion.Body>
                                </Accordion.Item>

                                {link.sectionChecklist && link.sectionChecklist.length > 0 && (
                                  <Accordion.Item eventKey={`${accordionBase}-checklist`}>
                                    <Accordion.Header>Section checklist</Accordion.Header>
                                    <Accordion.Body>
                                      <ul className="small mb-0">
                                        {link.sectionChecklist.map((item) => (
                                          <li key={`${accordionBase}-check-${item}`}>{item}</li>
                                        ))}
                                      </ul>
                                    </Accordion.Body>
                                  </Accordion.Item>
                                )}

                                {link.expectedOutcomes && link.expectedOutcomes.length > 0 && (
                                  <Accordion.Item eventKey={`${accordionBase}-outcomes`}>
                                    <Accordion.Header>Expected outcomes</Accordion.Header>
                                    <Accordion.Body>
                                      <ul className="small mb-0">
                                        {link.expectedOutcomes.map((item) => (
                                          <li key={`${accordionBase}-outcome-${item}`}>{item}</li>
                                        ))}
                                      </ul>
                                    </Accordion.Body>
                                  </Accordion.Item>
                                )}

                                {link.commonPitfalls && link.commonPitfalls.length > 0 && (
                                  <Accordion.Item eventKey={`${accordionBase}-pitfalls`}>
                                    <Accordion.Header>Common pitfalls</Accordion.Header>
                                    <Accordion.Body>
                                      <ul className="small mb-0">
                                        {link.commonPitfalls.map((item) => (
                                          <li key={`${accordionBase}-pitfall-${item}`}>{item}</li>
                                        ))}
                                      </ul>
                                    </Accordion.Body>
                                  </Accordion.Item>
                                )}

                                {link.codeSample && (
                                  <Accordion.Item eventKey={`${accordionBase}-code`}>
                                    <Accordion.Header>{link.codeSample.title}</Accordion.Header>
                                    <Accordion.Body>
                                      <div className="small text-muted mb-2">Language: {link.codeSample.language}</div>
                                      <pre className="small p-2 border rounded bg-body-tertiary mb-0"><code>{link.codeSample.code}</code></pre>
                                    </Accordion.Body>
                                  </Accordion.Item>
                                )}
                              </Accordion>
                            </div>
                          );
                        })}
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Col>
      </Row>
    </div>
  );
}

export default UserGuidePage;
