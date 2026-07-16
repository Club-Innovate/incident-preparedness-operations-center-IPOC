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
  dashboard: 'dashboard-command-center',
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
      'dashboard-command-center',
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
    topicIds: ['dashboard-command-center', 'security-compliance-audit-observability', 'common-operating-picture'],
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
const icsPrintDensityLocalStorageKey = 'ipoc.help.ics.print-density.v1';

const coreScenarioMilestones: string[] = [
  'Initiate an incident with validated location, severity, and command ownership.',
  'Build an execution workflow across operations, planning, logistics, and finance checkpoints.',
  'Configure administration controls (roles, locations, cache mode, ingestion, and governance defaults).',
  'Publish evidence-driven reports and close the loop through after-action corrective tracking.',
];

const professionalRunbookChecklist: string[] = [
  'Confirm focused incident, timeframe, and command objective before executing controls.',
  'Capture operator attribution and timestamps for every high-impact action.',
  'Validate data freshness and source completeness before decisions or exports.',
  'Escalate unresolved blockers with owner, ETA, and fallback path.',
  'Publish handoff summary with decisions, open risks, and next review cadence.',
];

const professionalCommonPitfalls: string[] = [
  'Executing controls before scope validation creates inconsistent evidence and rework.',
  'Skipping timestamped notes weakens audit readiness and incident reconstruction.',
  'Treating advisory analytics as final decisions without command validation introduces risk.',
  'Running exports with stale filters produces misleading artifacts for leadership and compliance.',
];

const professionalExpectedOutcomes: string[] = [
  'Operators can execute module workflows with consistent, auditable decision quality.',
  'Supervisors can review status, risks, and evidence without manual reconstruction.',
  'Cross-functional teams maintain shared context from initiation through closeout.',
];

const professionalRunbookTutorial: string[] = [
  'Set incident scope, operational period, and intended audience before making changes.',
  'Run section controls in dependency order: detect, assess, assign, verify, then export/share.',
  'Record command decisions with rationale and ownership at each transition point.',
  'Perform a midpoint quality gate to validate freshness, ownership, and unresolved blocker states.',
  'Close with a brief package containing outcomes, risks, and explicit next actions.',
];

const troubleshootingTutorial: string[] = [
  'Validate user role, focused incident selection, and required prerequisites for the target action.',
  'Check freshness indicators, feed-health signals, and recent admin changes that may affect behavior.',
  'Reproduce the issue with exact timestamps, module path, and filter settings.',
  'Capture corrective action and verify the fix in at least one downstream dependent module.',
  'Document root cause and update runbook notes to prevent recurrence.',
];

function buildAudienceGuidanceTutorial(topicTitle: string): string[] {
  return [
    `Operator track: execute ${topicTitle} controls in checklist order and annotate every action with owner/time context.`,
    `Supervisor track: review queue health, unresolved dependencies, and SLA risk before approving next-cycle posture.`,
    `Executive track: consume a concise summary (top risks, decisions needed, resource asks) and confirm command intent for the next review window.`,
  ];
}

function buildAudienceChecklist(topicTitle: string): string[] {
  return [
    `Operator: ${topicTitle} actions are owner-assigned and status-accurate.`,
    'Supervisor: blockers and escalations are acknowledged with ETA and fallback path.',
    'Executive: decision log includes rationale, priority, and expected operational impact.',
  ];
}

function buildTopicDeepDiveLinks(topicTitle: string, topicId: string): GuideLink[] {
  const moduleToken = topicTitle.toLowerCase();
  return [
    {
      id: `${topicId}-advanced-runbook`,
      title: `${topicTitle}: advanced operator runbook`,
      kind: 'HOW-TO GUIDE',
      detail: `Professional execution workflow for ${topicTitle} with quality gates, escalation discipline, and command handoff rigor.`,
      prerequisites: [
        `Operator has access to ${topicTitle} and the active incident scope is confirmed.`,
        'Shift objective and review cadence are defined by command leadership.',
      ],
      tutorial: [...professionalRunbookTutorial, ...buildAudienceGuidanceTutorial(topicTitle)],
      sectionChecklist: [...professionalRunbookChecklist, ...buildAudienceChecklist(topicTitle)],
      expectedOutcomes: [...professionalExpectedOutcomes],
      commonPitfalls: [...professionalCommonPitfalls],
      callout: {
        tone: 'info',
        title: 'Audience-specific operating standard',
        body: `Treat ${topicTitle} as an execution workspace with role-specific outputs: operator accuracy, supervisor control, and executive clarity.`,
      },
    },
    {
      id: `${topicId}-troubleshooting-playbook`,
      title: `${topicTitle}: troubleshooting and quality control playbook`,
      kind: 'REFERENCE',
      detail: `Structured troubleshooting workflow for ${topicTitle} covering access, data quality, control behavior, and downstream impact validation.`,
      prerequisites: [
        'Issue report includes module path, timeframe, and user context.',
        'Operator can reproduce behavior in a controlled workflow state.',
      ],
      tutorial: [...troubleshootingTutorial],
      sectionChecklist: [
        'Reproduction path documented with exact control sequence.',
        'Root cause category identified (auth, data freshness, dependency, or workflow state).',
        'Downstream module impact validated after fix.',
      ],
      expectedOutcomes: [
        `Teams resolve ${moduleToken} issues faster with reproducible context and less rework.`,
        'Post-incident reviews include root-cause clarity and prevention actions.',
        'Operator, supervisor, and executive escalations carry the right level of detail for rapid decisions.',
      ],
      commonPitfalls: [
        'Escalating without reproduction details or timestamps causes investigation churn.',
        'Fixing symptoms in one control while leaving dependency-chain causes unresolved.',
      ],
      callout: {
        tone: 'warning',
        title: 'Root-cause first',
        body: 'Do not close incidents on workaround success alone. Verify dependent workflows and recurrence controls.',
      },
    },
    {
      id: `${topicId}-automation-sample`,
      title: `${topicTitle}: API integration and automation sample`,
      kind: 'SAMPLE',
      detail: `Example integration pattern for ${topicTitle} showing authenticated retrieval, validation, and normalized export payload construction.`,
      tutorial: [
        'Create typed DTOs for request filters, records, and export metadata.',
        'Call module endpoint with explicit timeout and cancellation support.',
        'Validate required fields (incident id, timestamps, owner/status) before persistence or export.',
        'Transform records to a normalized artifact contract for reporting and archive workflows.',
      ],
      expectedOutcomes: [
        `Development teams can extend ${topicTitle} workflows with reliable automation patterns.`,
        'Exported artifacts stay consistent across operational and compliance workflows.',
        'Audience-specific reporting views can be produced from the same normalized artifact contract.',
      ],
      codeSample: {
        title: `${topicTitle} integration sample (.NET)` ,
        language: 'csharp',
        code: `public sealed record ModuleRecord(string IncidentId, DateTimeOffset TimestampUtc, string Owner, string Status);

public static async Task<IReadOnlyList<ModuleRecord>> FetchModuleRecordsAsync(
    HttpClient http,
    string endpoint,
    CancellationToken cancellationToken)
{
    using var response = await http.GetAsync(endpoint, cancellationToken);
    response.EnsureSuccessStatusCode();

    var payload = await response.Content.ReadFromJsonAsync<List<ModuleRecord>>(cancellationToken: cancellationToken)
        ?? new List<ModuleRecord>();

    return payload
        .Where(item => !string.IsNullOrWhiteSpace(item.IncidentId)
            && item.TimestampUtc != default
            && !string.IsNullOrWhiteSpace(item.Owner)
            && !string.IsNullOrWhiteSpace(item.Status))
        .OrderByDescending(item => item.TimestampUtc)
        .ToList();
}`,
      },
      callout: {
        tone: 'success',
        title: 'Engineering quality note',
        body: 'Prefer typed contracts, explicit validation, and deterministic sort order for reproducible artifacts.',
      },
    },
  ];
}

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

function IcsWorkflowScenarioDiagram() {
  return (
    <div className="ipoc-ics-diagram-rendered" data-testid="user-guide-ics-rendered-diagram">
      <div className="ipoc-ics-diagram-track" data-testid="user-guide-ics-rendered-diagram-track">
        <div className="ipoc-ics-diagram-node">
          <div className="ipoc-ics-diagram-node-title">Scenario 1 · Small Incident</div>
          <div className="ipoc-ics-diagram-node-body">Initial command, life-safety focus, lean cycle, transfer only if needed.</div>
        </div>
        <div className="ipoc-ics-diagram-arrow" aria-hidden="true">→</div>
        <div className="ipoc-ics-diagram-node">
          <div className="ipoc-ics-diagram-node-title">Scenario 2 · Multi-Agency Expansion</div>
          <div className="ipoc-ics-diagram-node-body">Activate sections, run IAP loop cadence, enforce unified command controls.</div>
        </div>
        <div className="ipoc-ics-diagram-arrow" aria-hidden="true">→</div>
        <div className="ipoc-ics-diagram-node">
          <div className="ipoc-ics-diagram-node-title">Scenario 3 · Demobilization-Heavy Closeout</div>
          <div className="ipoc-ics-diagram-node-body">Release resources, transfer unresolved actions, package closeout evidence.</div>
        </div>
      </div>
      <div className="ipoc-ics-diagram-legend" data-testid="user-guide-ics-rendered-diagram-legend">
        <Badge bg="light" text="dark">IC · Green</Badge>
        <Badge bg="light" text="dark">Safety · Red</Badge>
        <Badge bg="light" text="dark">Operations · Orange</Badge>
        <Badge bg="light" text="dark">Planning · Blue</Badge>
        <Badge bg="light" text="dark">Logistics · Violet</Badge>
        <Badge bg="light" text="dark">Finance/Admin · Gray</Badge>
      </div>
    </div>
  );
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
              'Use preview action to validate executive markdown narrative before distribution.',
              'Review exact Generated UTC metadata in preview when audit traceability requires precise artifact timestamp confirmation.',
              'Confirm preview quality checklist badges (baseline, recommendations, decision history) before distribution.',
              'Use freshness badge to confirm brief recency and regenerate when marked stale.',
              'Use Regenerate now in preview to refresh the brief from current recommendation data before sharing.',
              'Inside preview, use Copy brief or Stage to assistant for fast command handoff without leaving Reports.',
              'Use clear-cache action when command policy requires removing locally cached brief content after handoff.',
              'Use export action to download executive decision brief markdown package with trend deltas, recommendation decision state, and attributed decision log appendix.',
              'Use copy action when command leadership needs immediate clipboard-ready brief content for chat/email workflows.',
              'Use AI stage action to prefill Assistant with the brief and generate command summary plus ICS-ready objectives.',
            ],
            expectedOutcomes: [
              'Leadership receives a concise decision brief with trend-delta context and prioritized recommendations.',
              'Command teams can archive consistent brief artifacts across reporting cycles with operator-attributed decision context.',
              'Operators can hand off the same brief directly into AI Incident Co-Pilot without retyping context.',
              'Latest generated brief remains available after refresh for continuity when recommendation rows are temporarily sparse.',
              'Cached continuity can be intentionally cleared by operators after sensitive handoff workflows.',
            ],
            commonPitfalls: [
              'Skipping baseline capture can reduce interpretability of delta metadata across cycles.',
              'Exporting before filter validation can produce a brief for unintended operational scope.',
              'Staging to Assistant without opening Assistant afterward leaves the prompt queued but not yet submitted.',
            ],
            callout: {
              tone: 'warning',
              title: 'Governance reminder',
              body: 'Executive brief recommendations are decision support artifacts and require command validation prior to execution.',
            },
          },
          {
            id: 'use-reports-aar-improvement-plan-export',
            title: 'Use Reports AAR improvement plan export',
            kind: 'HOW-TO GUIDE',
            detail: 'Export an after-action improvement plan baseline with capability gaps, corrective actions, owner lanes, and target windows.',
            prerequisites: [
              'Reports filters are set to the incident scope to be reviewed in after-action sessions.',
              'Decision queue and pending approval modules are populated for best corrective-action fidelity.',
            ],
            tutorial: [
              'Open Reports and locate the executive reporting action rail.',
              'Use AAR improvement plan export to generate a corrective-action baseline CSV.',
              'Review capability gap and owner lane assignments before distributing to command sections.',
              'Use the CSV artifact in post-incident review meetings and formal improvement-plan tracking workflows.',
            ],
            expectedOutcomes: [
              'Command teams have a structured, repeatable improvement-plan artifact linked to current report signals.',
              'After-action closeout includes explicit owner-lane corrective actions with target windows.',
            ],
            commonPitfalls: [
              'Exporting without current filter validation can produce corrective actions for the wrong operational scope.',
              'Treating the generated owner lanes as immutable assignments instead of command-reviewed planning baselines.',
            ],
            callout: {
              tone: 'warning',
              title: 'Governance reminder',
              body: 'AAR improvement plan exports are decision-support baselines and should be validated by command leadership before final publication.',
            },
          },
          {
            id: 'use-reports-risk-timeline-replay-export',
            title: 'Use Reports risk timeline replay export',
            kind: 'HOW-TO GUIDE',
            detail: 'Export risk-change timeline and incident replay rows to support after-action analytics and historical review workflows.',
            prerequisites: [
              'Reports filters are aligned to the incident window you want to replay.',
              'Risk timeline chart has data or report scope is intentionally bounded for no-data evidence capture.',
            ],
            tutorial: [
              'Open Reports and locate the Risk-change timeline card.',
              'Review timeline signal shape and confirm it represents the intended reporting window.',
              'Use the risk timeline export action to generate replay CSV artifact.',
              'Attach artifact to after-action evidence package alongside executive brief and FEMA-compatible AAR export outputs.',
            ],
            expectedOutcomes: [
              'Operators can export a repeatable timeline replay artifact from Reports without manual reconstruction.',
              'After-action workflows gain stronger timestamped trend evidence for command review cycles.',
            ],
            commonPitfalls: [
              'Exporting with stale filters can produce replay rows outside the intended incident scope.',
              'Assuming timeline export is a replacement for command narrative rather than a supporting evidence artifact.',
            ],
            callout: {
              tone: 'warning',
              title: 'Operational reminder',
              body: 'Timeline replay exports support post-incident analytics and should be reviewed with command context before final reporting decisions.',
            },
          },
          {
            id: 'use-reports-fema-compatible-aar-export',
            title: 'Use Reports FEMA-compatible AAR/IP baseline export',
            kind: 'HOW-TO GUIDE',
            detail: 'Generate a FEMA-compatible after-action baseline CSV package from current report, decision, timeline, and HVA readiness context.',
            prerequisites: [
              'Reports filters are aligned to the operational period and incident scope for after-action review.',
              'Decision queue and timeline visuals are populated for best baseline fidelity.',
            ],
            tutorial: [
              'Open Reports and locate the Executive decision brief package command rail.',
              'Use the FEMA-compatible AAR export action to generate the after-action baseline CSV artifact.',
              'Confirm the artifact includes summary metrics, decision history, risk timeline, and HVA readiness sections.',
              'Attach the exported artifact to command closeout and bid evidence workflows as required.',
            ],
            expectedOutcomes: [
              'Command teams receive a structured after-action baseline artifact aligned to FEMA-compatible reporting posture.',
              'RFP evidence workflows have an auditable, repeatable report export path for after-action packaging.',
            ],
            commonPitfalls: [
              'Exporting before report filter validation can produce after-action context for the wrong window.',
              'Treating the baseline export as final doctrine output without command review and supplemental narrative.',
            ],
            callout: {
              tone: 'warning',
              title: 'Governance reminder',
              body: 'FEMA-compatible AAR/IP baseline exports support command documentation and require human validation before external submission.',
            },
          },
          {
            id: 'use-reports-hva-readiness-snapshot-export',
            title: 'Use Reports HVA readiness snapshot export',
            kind: 'HOW-TO GUIDE',
            detail: 'Generate a command-ready Hazard Vulnerability Assessment baseline table and export it as CSV for RFP evidence workflows.',
            prerequisites: [
              'Reports filters are aligned to the incident scope and operational period to be evaluated.',
              'Dashboard and decision queue data are available for current report scope.',
            ],
            tutorial: [
              'Open Reports and locate the HVA readiness snapshot card under executive brief controls.',
              'Review hazard probability and impact values generated from current severity, completeness, and governance signals.',
              'Review mitigation baseline text to confirm it aligns with command doctrine and current shift posture.',
              'Use the export action to download the HVA readiness snapshot CSV for bid/readiness evidence packaging.',
            ],
            expectedOutcomes: [
              'Operators have a repeatable HVA-oriented readiness artifact generated from current report scope.',
              'Command teams can attach a point-in-time hazard baseline to RFP and governance evidence bundles.',
            ],
            commonPitfalls: [
              'Exporting without validating report filters may produce HVA artifacts for the wrong incident window.',
              'Treating generated probability/impact values as final risk decisions without command validation.',
            ],
            callout: {
              tone: 'warning',
              title: 'Decision-support reminder',
              body: 'HVA readiness output is advisory and should be reviewed by command leadership before external distribution.',
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
    id: 'dashboard-command-center',
    title: 'Dashboard Command Center',
    intro: 'Unified command posture view for readiness, risk, queue pressure, and cross-module execution health.',
    keywords: ['dashboard', 'kpi', 'readiness', 'monitoring', 'command posture'],
    sections: [
      {
        id: 'dashboard-overview-group',
        title: 'Overview and quickstart',
        links: [
          {
            id: 'dashboard-quickstart',
            title: 'Run dashboard command review cycle',
            kind: 'QUICKSTART',
            detail: 'Use the Dashboard as a command review board to assess readiness, identify drift, and trigger focused actions in downstream modules.',
            prerequisites: [
              'At least one active incident is visible in dashboard scope.',
              'Command team agrees on review cadence (for example: every 30 minutes during surge).',
            ],
            tutorial: [
              'Confirm the focused incident and reporting window before interpreting KPI cards.',
              'Review readiness, workload pressure, and exception indicators in priority order.',
              'Open high-risk cards and route actions to Operations, Planning, Logistics, or Finance work queues.',
              'Validate that routed actions are owner-assigned and time-bounded in destination modules.',
              'Capture a dashboard snapshot for shift handoff and command brief continuity.',
            ],
            sectionChecklist: [
              'Focused incident and time window validated.',
              'Top risk signals acknowledged with owners.',
              'Cross-module actions routed and verified.',
              'Snapshot captured for handoff evidence.',
            ],
            expectedOutcomes: [
              'Command leadership maintains one-glance posture awareness without losing execution depth.',
              'Teams reduce reaction delay by routing from signal to owner in a single review cycle.',
            ],
            commonPitfalls: [
              'Reading aggregate KPIs without incident/timeframe validation leads to incorrect decisions.',
              'Monitoring risk tiles without routing actions leaves operational posture unchanged.',
            ],
            callout: {
              tone: 'warning',
              title: 'Dashboard discipline',
              body: 'The dashboard should trigger actions. Treat unresolved critical signals as command tasks, not informational widgets.',
            },
          },
          {
            id: 'dashboard-kpi-reference',
            title: 'Interpret dashboard KPI and health signals',
            kind: 'REFERENCE',
            detail: 'Professional interpretation guide for KPI cards, trend deltas, confidence states, and escalation thresholds.',
            tutorial: [
              'Use trend direction and confidence together; avoid reacting to isolated single-point changes.',
              'Classify each high-priority signal as Immediate action, Monitor, or Informational.',
              'When confidence is low, validate source freshness before escalation.',
              'Document decision rationale when suppressing an alert during high-pressure operations.',
            ],
            expectedOutcomes: [
              'Supervisors make consistent escalation decisions across shifts.',
              'False escalation rates decrease through confidence-aware triage.',
            ],
            callout: {
              tone: 'info',
              title: 'Signal interpretation guardrail',
              body: 'Use at least two corroborating indicators before issuing high-impact command changes.',
            },
          },
          {
            id: 'dashboard-sample-kpi-normalization',
            title: 'Sample KPI normalization helper for dashboard inputs',
            kind: 'SAMPLE',
            detail: 'Example TypeScript utility for normalizing dashboard KPI values before rendering risk bands and trend labels.',
            tutorial: [
              'Map raw telemetry into typed dashboard KPI contracts.',
              'Clamp and normalize values to avoid out-of-range rendering behavior.',
              'Apply deterministic status thresholds so command interpretation remains consistent.',
            ],
            codeSample: {
              title: 'Dashboard KPI normalization sample (TypeScript)',
              language: 'typescript',
              code: `type KpiState = 'stable' | 'watch' | 'critical';

type DashboardKpi = {
  key: string;
  value: number;
  trendDelta: number;
  state: KpiState;
};

export function normalizeKpi(key: string, rawValue: number, rawDelta: number): DashboardKpi {
  const value = Number.isFinite(rawValue) ? Math.max(0, Math.min(100, rawValue)) : 0;
  const trendDelta = Number.isFinite(rawDelta) ? rawDelta : 0;

  const state: KpiState = value >= 80 ? 'critical' : value >= 60 ? 'watch' : 'stable';
  return { key, value, trendDelta, state };
}`,
            },
            callout: {
              tone: 'success',
              title: 'Consistency benefit',
              body: 'Normalized KPI contracts reduce UI drift and improve comparability across incidents and shifts.',
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
          {
            id: 'incidents-ics-workflow-context-diagram',
            title: 'Run the ICS workflow context model and role-color assignment standard',
            kind: 'REFERENCE',
            detail: 'Scenario-based ICS workflow for initial call-out, command transfer, IAP cycle, expansion, and demobilization with transcript-aligned role colors in assignment avatars.',
            prerequisites: [
              'Incident command positions are configured in the ICS command structure board.',
              'At least one operational period exists for the active incident.',
              'Command staff assignment workflow is available to set role ownership.',
            ],
            tutorial: [
              'Use the ICS Command Structure grid to assign command roles and verify role-color avatar cues (IC=green, Safety=red, Operations=orange, Planning=blue, Logistics=violet, Finance/Admin=gray).',
              'At initial call-out, identify immediate life safety actions and record the first command owner and command post context.',
              'When command transfer is required, update assignment ownership and operational notes, then notify participating agencies in the communications workflow.',
              'Build and approve an incident action plan for the operational period, execute tasks and resource actions, then evaluate and revise objectives in recurring command cycles.',
              'As complexity expands, add operations/logistics/finance support and maintain span-of-control accountability through assignment and check-in updates.',
              'At demobilization, confirm personnel accountability, close unresolved actions into day-to-day workflows, and publish closeout evidence artifacts.',
            ],
            callout: {
              tone: 'success',
              title: 'Workflow context diagram',
              body: 'Use this multi-scenario diagram set for shift handoff and training to keep all agencies aligned on command transfer, planning cadence, expansion triggers, and demobilization closure.',
            },
            commonPitfalls: [
              'Keeping expansion branches active after complexity has dropped causes avoidable coordination overhead.',
              'Skipping transfer log updates during command-owner changes weakens audit and handoff continuity.',
              'Demobilizing resources without explicit unresolved-action ownership causes post-incident drift.',
            ],
            sectionChecklist: [
              'Selected scenario path matches incident complexity posture (small, expanded, or closeout-heavy).',
              'Role coverage and transfer ledger entries are current before each command brief.',
              'Demobilization package includes transfer evidence, SITREP baseline, and owner-confirmed follow-up actions.',
              'Scenario narrative is briefing-ready for executives and responder shift handoffs.',
            ],
            expectedOutcomes: [
              'Operators can present the right ICS scenario visually and narratively in under two minutes.',
              'Command-transfer, IAP cadence, and demobilization accountability remain understandable at a glance.',
              'User Guide section becomes export/presentation ready without additional restructuring.',
            ],
          },
          {
            id: 'incidents-ics-workflow-presentation-mode',
            title: 'Use presentation mode for export-ready ICS briefings',
            kind: 'HOW-TO GUIDE',
            detail: 'Clean, export-friendly briefing layout for command presentations and print workflows with side-by-side scenario narratives.',
            tutorial: [
              'Open Topic detail mode and navigate to the ICS workflow context model section.',
              'Use the scenario group (Small Incident, Multi-Agency Expansion, Demobilization-Heavy) as the visual lead on the left and the narrative summary on the right.',
              'For executive briefs, read each scenario as trigger -> command actions -> decision gate -> closeout evidence.',
              'Keep role-color legend visible during presentation so assignment interpretation remains immediate across agencies.',
              'Export/print from browser using landscape orientation and include only this section for briefing packets.',
            ],
            sectionChecklist: [
              'Scenario diagram and narrative summary are visible in one viewport for presenter flow.',
              'Role-color legend is visible and aligned to current command board colors (Logistics violet).',
              'Briefing script references transfer, planning cadence, expansion control, and demobilization accountability.',
            ],
            callout: {
              tone: 'info',
              title: 'Presentation layout standard',
              body: 'Use a clean two-column briefing rhythm: left = diagram progression, right = scenario narrative and command decisions.',
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
              'Startup recovery discipline: keep local runtime files (`appsettings.json`, `appsettings.Development.json`, `.env.development`) present and sourced from `.example` templates when onboarding/rebuilding.',
              'Frontend render recovery: if local UI fails to load and startup logs show Vite bind errors, verify AppHost/frontend port alignment and move to an available non-reserved local port per environment policy.',
              'After each update, verify effects in impacted modules and capture audit notes before finalizing.',
            ],
            sectionChecklist: [
              'User/role alignment verified for current shift.',
              'Critical location data and ICS hierarchy validated.',
              'Data ingestion and cache freshness checks passed.',
              'Local runtime config files exist with valid environment-specific values.',
              'Frontend startup endpoint is reachable from the active workstation profile.',
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
            id: 'admin-session-audit-evidence-export',
            title: 'Export session/auth audit evidence from Session Admin',
            kind: 'HOW-TO GUIDE',
            detail: 'Use Session Admin filters to export requestable authentication/session audit evidence CSV for compliance and governance workflows.',
            prerequisites: [
              'Administrator role with session administration access.',
              'Session Admin tab is accessible in current environment.',
            ],
            tutorial: [
              'Open Admin workspace and navigate to Session Admin tab.',
              'Use quick presets for common export scenarios (auth failures 24h, auth success 24h, all events 7d) when appropriate.',
              'Set optional audit category, outcome code, and local datetime boundaries.',
              'Run session/auth audit export to generate filtered audit evidence CSV artifact.',
              'Return later and confirm your last-used audit filter preset and boundaries are restored for continuity.',
              'Attach exported evidence to access-review, audit-response, or compliance requests as needed.',
            ],
            expectedOutcomes: [
              'Administrators can produce requestable filtered session/auth audit evidence directly from UI controls.',
              'Compliance workflows gain traceable, repeatable evidence exports without manual query assembly.',
            ],
            commonPitfalls: [
              'Using broad filters may produce oversized exports that are harder to triage for investigations.',
              'Skipping date boundaries can return unrelated session/auth events outside the intended review window.',
            ],
            callout: {
              tone: 'warning',
              title: 'Evidence hygiene',
              body: 'Record the applied filter values when exporting session/auth evidence so downstream reviewers can reproduce audit scope.',
            },
          },
          {
            id: 'admin-bulk-user-import-evidence-export',
            title: 'Run admin bulk user import with audit evidence export',
            kind: 'HOW-TO GUIDE',
            detail: 'Import users from CSV, review rejects, and export audit evidence for requestable governance/compliance workflows.',
            prerequisites: [
              'Administrator role with user-management permissions.',
              'CSV file prepared with required columns for bulk import.',
            ],
            tutorial: [
              'Open Admin workspace and navigate to Bulk user import (CSV).',
              'Optionally download template, then select CSV and configure source system/message identifiers.',
              'Run import and review summary counts for created, updated, and failed rows.',
              'Review recent bulk import run history to verify execution timestamp, source identifiers, and result counts.',
              'If failures exist, export reject report and correct source data before rerun.',
              'Export admin user import audit evidence CSV and attach it to compliance/request workflows.',
            ],
            expectedOutcomes: [
              'Administrators can execute repeatable bulk-user provisioning and updates with explicit telemetry context.',
              'Governance teams receive requestable audit evidence tied to admin user import operations.',
            ],
            commonPitfalls: [
              'Skipping source system/message identifiers reduces traceability across repeated import runs.',
              'Publishing import outcomes without audit evidence export can leave compliance packages incomplete.',
            ],
            callout: {
              tone: 'warning',
              title: 'Audit readiness reminder',
              body: 'Always export and retain admin user import audit evidence after production-impacting bulk import runs.',
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
            id: 'hipaa-hitrust-compliance-narrative',
            title: 'HIPAA/HITRUST compliance narrative and control posture',
            kind: 'COMPLIANCE',
            detail: 'Comprehensive narrative for documenting HIPAA Security Rule and HITRUST-aligned operational controls, evidence, and review cadence.',
            prerequisites: [
              'Security ownership is assigned for administrative, technical, and operational controls.',
              'Audit evidence export workflows are enabled for reporting and admin modules.',
            ],
            tutorial: [
              'Document safeguard ownership across access control, audit logging, transmission protection, and incident response procedures.',
              'Map IPOC operational controls to HIPAA Security Rule expectations (administrative, physical, and technical safeguards).',
              'Track HITRUST-aligned control objectives with policy references, responsible owners, and evidence locations.',
              'Use Reports and Session/Admin exports to produce evidence packets containing user/session activity, decision traceability, and correction workflows.',
              'Run quarterly control attestations and annual policy reviews with documented remediation plans for open gaps.',
            ],
            sectionChecklist: [
              'Access governance and least-privilege assignments are reviewed and approved on schedule.',
              'Audit logs are retained per policy and can be exported by incident scope and timeframe.',
              'Incident response and breach-notification playbooks are versioned and tested.',
              'Policy exceptions include risk acceptance owner, timeline, and closure criteria.',
            ],
            expectedOutcomes: [
              'Compliance teams can explain control intent, implementation, and evidence sources without ad hoc reconstruction.',
              'External assessors receive a structured narrative linking policy, implementation, and operational artifacts.',
            ],
            commonPitfalls: [
              'Claiming compliance posture without maintaining current evidence trails weakens audit defensibility.',
              'Treating framework mappings as one-time work instead of a recurring governance cycle.',
            ],
            callout: {
              tone: 'warning',
              title: 'Assurance boundary',
              body: 'Framework alignment guidance supports readiness. Formal compliance or certification status must be confirmed through your official governance and independent assessment process.',
            },
          },
          {
            id: 'hipaa-hitrust-evidence-package-sample',
            title: 'Sample HIPAA/HITRUST evidence package structure',
            kind: 'SAMPLE',
            detail: 'Reference structure for organizing policy, technical, and operational evidence for assessment and audit workflows.',
            tutorial: [
              'Create evidence package sections for Access Control, Audit Controls, Integrity, Transmission Security, and Incident Response.',
              'Attach module exports (reporting, session auth evidence, command-transfer artifacts) with owner and timestamp metadata.',
              'Include control mapping worksheet with framework requirement, implementation note, and proof link.',
              'Record open findings with risk rank, remediation owner, and target closure date.',
            ],
            codeSample: {
              title: 'Compliance evidence manifest example (JSON)',
              language: 'json',
              code: `{
  "assessmentWindow": "2026-Q1",
  "frameworks": ["HIPAA-Security-Rule", "HITRUST-CSF"],
  "controls": [
    {
      "id": "AC-01",
      "name": "Least Privilege Access",
      "owner": "Security Admin",
      "evidence": [
        "exports/session-auth-audit-2026-01.csv",
        "exports/admin-role-assignment-review-2026-01.csv"
      ],
      "status": "implemented"
    },
    {
      "id": "AU-02",
      "name": "Audit Trail Retention",
      "owner": "Platform Operations",
      "evidence": [
        "reports/decision-history-2026-01.md",
        "reports/after-action-evidence-2026-01.csv"
      ],
      "status": "implemented"
    }
  ]
}`,
            },
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

const topicsWithDeepDive: GuideTopic[] = topics.map((topic) => ({
  ...topic,
  sections: topic.sections.map((section, sectionIndex) => {
    if (sectionIndex !== topic.sections.length - 1) {
      return section;
    }

    return {
      ...section,
      links: [
        ...section.links,
        ...buildTopicDeepDiveLinks(topic.title, topic.id),
      ],
    };
  }),
}));

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
  const [icsPrintDensity, setIcsPrintDensity] = useState<'standard' | 'compact'>(() => {
    const persisted = localStorage.getItem(icsPrintDensityLocalStorageKey);
    return persisted === 'standard' ? 'standard' : 'compact';
  });
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const topicsById = useMemo(() => Object.fromEntries(topicsWithDeepDive.map((topic) => [topic.id, topic])), []);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const openTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    setContentMode('topic');
  };

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

  useEffect(() => {
    localStorage.setItem(icsPrintDensityLocalStorageKey, icsPrintDensity);
  }, [icsPrintDensity]);

  const selectedTopic = topicsById[selectedTopicId] ?? topicsWithDeepDive[0];

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) {
      return;
    }

    const params = new URLSearchParams(hash.slice(1));
    const topic = params.get('topic');
    const link = params.get('link');
    if (topic && topicsById[topic]) {
      openTopic(topic);
    }

    if (link) {
      window.setTimeout(() => {
        sectionRefs.current[link]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }, [topicsById]);

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
    <div className="ipoc-help-page container-fluid py-3" data-ics-print-density={icsPrintDensity}>
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
                  <Col xl={selectedTopic.sections.length > 1 ? 6 : 12} key={section.id}>
                    <Card className="shadow-sm h-100 ipoc-help-doc-card">
                      <Card.Header className="fw-semibold">{section.title}</Card.Header>
                      <Card.Body>
                        {section.links.map((link) => {
                          const accordionBase = `${section.id}-${link.id}`;
                          return (
                            <div
                              key={link.id}
                              className={`mb-4 pb-1 border-bottom ${link.id === 'incidents-ics-workflow-context-diagram' ? 'ipoc-ics-presentation-section' : ''} ${link.id === 'incidents-ics-workflow-presentation-mode' ? 'ipoc-ics-presentation-mode-section' : ''}`}
                              data-testid={link.id === 'incidents-ics-workflow-context-diagram' ? 'user-guide-ics-presentation-section' : undefined}
                              ref={(element) => {
                                sectionRefs.current[link.id] = element;
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                <div className="fw-semibold mb-1">{link.title}</div>
                                <Badge bg="secondary" className="fw-semibold">{link.kind}</Badge>
                              </div>
                              <div className="small text-muted mb-2">{link.detail}</div>

                              {link.id === 'incidents-ics-workflow-context-diagram' && (
                                <div className="mb-3 ipoc-ics-presentation-summary-wrap" data-testid="user-guide-ics-scenario-summary-grid">
                                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2" data-testid="user-guide-ics-print-density-controls">
                                    <div className="small text-uppercase fw-semibold text-muted mb-0" data-testid="user-guide-ics-presentation-heading">Scenario summary for executive briefing</div>
                                    <div className="btn-group btn-group-sm" role="group" aria-label="ICS print density">
                                      <button
                                        type="button"
                                        className={`btn ${icsPrintDensity === 'standard' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setIcsPrintDensity('standard')}
                                        data-testid="user-guide-ics-print-density-standard"
                                      >
                                        Print: Standard
                                      </button>
                                      <button
                                        type="button"
                                        className={`btn ${icsPrintDensity === 'compact' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setIcsPrintDensity('compact')}
                                        data-testid="user-guide-ics-print-density-compact"
                                      >
                                        Print: Compact
                                      </button>
                                    </div>
                                  </div>
                                  <IcsWorkflowScenarioDiagram />
                                  <Row className="g-2 mb-2 ipoc-ics-scenario-card-grid">
                                    <Col md={4}>
                                      <Card className="h-100 border-success-subtle bg-success-subtle ipoc-ics-scenario-card ipoc-ics-scenario-card-small">
                                        <Card.Body className="p-2">
                                          <div className="small fw-semibold mb-1">Small Incident</div>
                                          <div className="small mb-0">Lean command path focused on immediate life safety, rapid tasking, and minimal transfer overhead.</div>
                                        </Card.Body>
                                      </Card>
                                    </Col>
                                    <Col md={4}>
                                      <Card className="h-100 border-info-subtle bg-info-subtle ipoc-ics-scenario-card ipoc-ics-scenario-card-multiagency">
                                        <Card.Body className="p-2">
                                          <div className="small fw-semibold mb-1">Multi-Agency Expansion</div>
                                          <div className="small mb-0">Unified command with full section activation, recurring IAP loop cadence, and span-of-control governance.</div>
                                        </Card.Body>
                                      </Card>
                                    </Col>
                                    <Col md={4}>
                                      <Card className="h-100 border-secondary-subtle bg-light ipoc-ics-scenario-card ipoc-ics-scenario-card-demob">
                                        <Card.Body className="p-2">
                                          <div className="small fw-semibold mb-1">Demobilization-Heavy</div>
                                          <div className="small mb-0">Resource release sequencing, unresolved action ownership handoff, and closeout packet readiness.</div>
                                        </Card.Body>
                                      </Card>
                                    </Col>
                                  </Row>
                                  <div className="d-flex flex-wrap gap-2 small ipoc-ics-role-legend" data-testid="user-guide-ics-role-color-legend">
                                    <Badge bg="light" text="dark">IC · Green</Badge>
                                    <Badge bg="light" text="dark">Safety · Red</Badge>
                                    <Badge bg="light" text="dark">Operations · Orange</Badge>
                                    <Badge bg="light" text="dark">Planning · Blue</Badge>
                                    <Badge bg="light" text="dark">Logistics · Violet</Badge>
                                    <Badge bg="light" text="dark">Finance/Admin · Gray</Badge>
                                  </div>
                                </div>
                              )}

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

                                {link.codeSample && link.id !== 'incidents-ics-workflow-context-diagram' && (
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
