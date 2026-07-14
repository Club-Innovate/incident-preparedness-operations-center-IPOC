# Azure Web-Based Preparedness Application Architecture Explanation

## 1. Executive Summary

The Azure Web-Based Preparedness Application is organized as a secure, scalable, browser-based platform that supports preparedness planning, public health and healthcare coordination, incident management, resource tracking, reporting, and recovery activities.

The architecture separates the solution into functional domains so each part of the platform has a clear purpose.

1. Users and agencies access the system through a secure browser-based experience.
2. Edge and security services protect the public entry point.
3. The application layer delivers the core business functions.
4. Workflow and integration services orchestrate business processes and connect external systems.
5. Data and content services persist operational records, documents, flexible data, and analytics structures.
6. Monitoring and operations services provide visibility, auditability, and security operations.
7. Analytics and insights services provide dashboards and reports for local, regional, and statewide decision-making.

Security, compliance, observability, governance, and operational control are implemented as cross-cutting services across the entire platform.

---

## 2. Architecture Domains

### 2.1 Users and Agencies

The users and agencies layer represents the people and organizations that interact with the preparedness platform.

This includes state, local, and regional users, hospitals, KDHE, BCHS, emergency operations centers, public health facilities, emergency management agencies, external systems, and authorized partners.

These users access the platform through a web browser. The platform does not require locally installed client software, which simplifies deployment, reduces support overhead, and allows users to operate from a common web-based environment.

Key responsibilities include secure role-specific access to preparedness and incident information, participation by public health facilities and regional partners, emergency management coordination, and external system data exchange through governed integrations.

---

### 2.2 Edge and Security

The edge and security layer protects the public-facing entry point into the application.

Azure Front Door provides global routing, high availability, and optimized access to the application. The Web Application Firewall protects the platform from common web threats, including OWASP Top 10 attack patterns. TLS/HTTPS ensures that traffic is encrypted in transit. Azure DDoS Protection helps maintain availability during denial-of-service attacks.

This layer provides secure browser-based access, global routing, web application protection, encrypted traffic, and DDoS protection.

---

### 2.3 Application Layer

The application layer contains the custom web application and user-facing business capabilities.

The web application is implemented as a .NET 8, Blazor, or React-based application hosted on Azure App Service or Azure Kubernetes Service. It provides the core preparedness and emergency management functionality, including user and role-based access, preparedness planning, incident management, facility and location management, resource and bed availability tracking, Essential Elements of Information collection, notifications and prompts, document management, dashboards, reporting, administration, and configuration.

Microsoft Entra ID provides identity services, MFA, and Conditional Access. Azure Cache for Redis can improve performance for high-read workloads, dashboard acceleration, frequently accessed lookup values, and non-authoritative cached application data.

---

### 2.4 Workflow and Integration

The workflow and integration layer moves work through the platform.

Azure API Management provides secure, versioned APIs for external integrations, throttling, policy enforcement, authentication, and IP filtering.

The workflow orchestrator uses Azure Logic Apps and Durable Functions to automate business processes such as incident activation, facility prompts, resource status collection, resource request routing, escalation rules, notification triggers, scheduled reminders, data validation, external system ingestion, and report generation.

Azure Communication Services delivers email and SMS notifications for routine operations, preparedness exercises, emergency response, escalation reminders, and operational alerts.

---

### 2.5 Data and Content Services

The data and content services layer is the persistence foundation of the platform.

It contains four logical data areas: operational data, flexible EEI data, documents and exports, and analytics data.

#### Operational Data

Azure SQL Database serves as the system of record for structured operational data. This includes users, roles, organizations, locations, facilities, contacts, incidents, incident locations, operational periods, ICS assignments, objectives, tasks, resource requests, resource assignments, audit metadata, lookup tables, and configuration records.

This data is relational, transactional, governed, and well suited to Azure SQL Database.

#### Flexible EEI Data

Flexible EEI data represents information that may vary by incident, facility, region, event type, hazard, exercise, or reporting need.

EEI means Essential Elements of Information. These are the critical pieces of information needed for situational awareness and decision-making during preparedness and response activities.

Examples include facility-specific status questions, incident-specific prompts, resource availability details, custom situation updates, regional readiness fields, special event data collection, hazard-specific response fields, and ad hoc reporting attributes.

Azure Cosmos DB was included in the architecture because this type of data may change frequently and may not always fit cleanly into a fixed relational schema.

#### Documents and Exports

Azure Blob Storage stores larger binary content and generated files, including preparedness plans, attachments, After Action Reports, Hazard Vulnerability Assessments, CSV exports, XLSX exports, PDFs, and supporting evidence.

Azure SQL Database should store document metadata, while Blob Storage should store the files themselves.

#### Analytics

Power BI and Synapse-ready analytical data structures provide dashboards, reporting, statewide views, regional views, and operational metrics.

The operational database should not be overburdened with heavy analytics. The architecture supports analytical models that can be refreshed from the operational system and optimized for reporting.

---

### 2.6 Monitoring and Operations

Monitoring and operations provide visibility into system health, application performance, audit activity, and security events.

Microsoft Sentinel and Microsoft Defender for Cloud support security operations, threat detection, posture management, and incident response. Azure Monitor, Application Insights, and Log Analytics collect application telemetry, performance metrics, diagnostic logs, health alerts, availability data, error details, usage patterns, and operational traces.

Azure Key Vault manages secrets, certificates, and keys. Azure Policy supports governance and compliance.

---

### 2.7 Analytics and Insights

The analytics and insights layer turns operational data into decision support.

Power BI dashboards provide operational views, executive views, trends, and key performance indicators. Regional dashboards provide resource and incident visibility across geographic or operational regions. Statewide dashboards support executive and operational oversight across the full preparedness environment.

AAR and HVA reporting supports after-action analysis, hazard vulnerability assessments, corrective action tracking, and program improvement.

---

## 3. Cross-Cutting Security, Compliance, and Observability

Security is not a single layer in the design. It crosses every domain.

Key controls include Microsoft Entra ID, RBAC, MFA, Conditional Access, TLS 1.2 or higher, AES-256 encryption at rest, Azure Activity Log, diagnostic logs, Microsoft Sentinel, Azure Key Vault, Azure Policy, alerting, and ITSM integration.

The goal is to ensure that every user action, administrative change, export, integration event, and operational transaction can be secured, monitored, and audited.

---

## 4. Platform Governance and Control Plane

The platform governance and control plane supports long-term operational management of the solution.

It includes CI/CD and release gates, environment management, configuration management, Infrastructure as Code templates, observability standards, logging, metrics, tracing, security controls, hardening, patching, baselines, operational runbooks, support procedures, and recovery procedures.

This control plane ensures the platform can be maintained consistently across environments and improved over time without relying on manual configuration.

---

## 5. End-to-End Data Flow

### 5.1 User Access Flow

1. A user accesses the application through a browser.
2. Azure Front Door receives the request.
3. The Web Application Firewall evaluates the request for web threats.
4. Traffic is encrypted using TLS/HTTPS.
5. The user is authenticated through Microsoft Entra ID.
6. MFA and Conditional Access policies are applied.
7. The application evaluates the user's role and scope.
8. The user is routed to the appropriate dashboards, locations, incidents, resources, or administrative functions.

### 5.2 Incident Management Flow

1. An authorized user creates or activates an incident.
2. The incident is associated with one or more locations.
3. The system establishes operational context, including incident type, status, severity, affected locations, operational period, and command assignments.
4. Incident staff create objectives, tasks, prompts, notifications, resource requests, and situation updates.
5. Workflow automation routes tasks, approvals, reminders, and escalations.
6. Operational data is persisted in Azure SQL Database.
7. Flexible incident-specific EEI responses may be stored in Cosmos DB or Azure SQL, depending on the persistence strategy selected.
8. Documents and generated reports are stored in Blob Storage.
9. Dashboards and reports update operational views.
10. Monitoring and audit services record activity.

### 5.3 Location and Resource Flow

1. Locations are defined as operational entities, such as hospitals, public health facilities, EOCs, warehouses, or partner sites.
2. Each location may have contacts, users, resource inventories, and facility-specific attributes.
3. During an incident, locations may be added as affected locations, responding locations, resource sources, resource destinations, shelters, or EOCs.
4. Resource requests are created against an incident.
5. A request may originate from a location and may be fulfilled by another location.
6. Communications are sent to users or contacts at relevant locations.
7. Resource assignments track what was requested, approved, assigned, delivered, released, or closed.
8. Dashboards provide visibility into resource posture across facilities, regions, and the state.

### 5.4 EEI Prompt and Response Flow

1. Administrators or incident staff define an EEI template or select an existing one.
2. A prompt is created for a specific incident, region, facility type, or set of locations.
3. Prompt targets are generated for the applicable locations or organizations.
4. Notifications are sent by email or SMS.
5. Facility users submit responses through the application.
6. Responses are validated.
7. Submitted data is persisted.
8. Dashboards and reports update.
9. Late or missing responses trigger reminders or escalations.
10. Audit logs record the prompt, submission, review, and export history.

### 5.5 Analytics Flow

1. Operational data is captured in Azure SQL Database.
2. Flexible EEI data is captured in Cosmos DB or Azure SQL, depending on the final data strategy.
3. Document metadata and export metadata are stored in Azure SQL Database.
4. Files are stored in Blob Storage.
5. Data is transformed into reporting-ready views or marts.
6. Power BI consumes curated datasets.
7. Dashboards provide operational, regional, statewide, executive, and AAR/HVA views.

---

## 6. Workflow Orchestration

Workflow orchestration is the automation layer that keeps the system from becoming a passive data-entry application.

It ensures that business processes move forward without requiring users to manually track every next step.

Examples include creating an incident workspace when an incident is activated, creating operational period tasks, routing resource requests for review, sending prompts to facilities, escalating overdue responses, sending SMS or email alerts, publishing outbox events for integration, processing inbound API data, starting report generation jobs, triggering audit or security alerts, notifying regional coordinators of missing data, and updating dashboards after data submission.

Azure Logic Apps are well suited for integration-heavy and low-code workflow processes. Durable Functions are well suited for long-running workflows that require state tracking, retries, timers, and multi-step orchestration.

Together, they allow the system to support routine preparedness operations as well as surge response workflows during incidents.

---

## 7. Cosmos DB Decision Analysis

### 7.1 Why Cosmos DB Was Proposed

Cosmos DB was proposed to support flexible, high-variability operational data that may not fit cleanly into a traditional relational schema.

The strongest use cases for Cosmos DB in this architecture are dynamic EEI prompts and responses, incident-specific data collection, custom facility status views, resource status payloads that vary by incident type, semi-structured integration payloads, rapidly changing form structures, flexible public health or healthcare situational awareness attributes, event-style operational updates, and JSON-heavy payloads that require fast read/write at scale.

In a preparedness and emergency management system, the data requested during a cyber incident may be different from the data requested during a tornado, disease outbreak, winter storm, mass casualty event, planned exercise, or resource shortage.

Cosmos DB gives the platform flexibility when the data model must evolve quickly.

### 7.2 Do We Actually Need Cosmos DB?

Not necessarily.

Cosmos DB is useful, but it is not mandatory for this solution if Azure SQL Database is designed carefully.

Azure SQL Database can support flexible attributes and dynamic lookup values using a hybrid relational approach. This can include relational master tables, lookup tables, configurable forms, attribute definition tables, attribute value tables, JSON columns with ISJSON constraints, computed columns over JSON values, indexed persisted computed columns, temporal tables, audit tables, reporting views, and dynamic metadata-driven screens.

A SQL-only approach may be preferable if KDHE wants simpler operations, fewer data platforms, easier reporting, stronger relational consistency, simpler backup and recovery, lower operational complexity, easier data governance, and one primary transactional system of record.

### 7.3 When Cosmos DB Is Worth Keeping

Cosmos DB should be kept if the solution expects a high volume of flexible, rapidly changing, document-style data where the structure changes often and must be captured without schema changes.

It is especially valuable if the platform needs highly variable EEI forms by incident type, frequent ad hoc data structures, high-volume operational event ingestion, large JSON payloads from integrations, multi-region active-active data access, low-latency reads across many dynamic payloads, separation between fixed transactional data and flexible operational payloads, or fast iteration of new data collection forms without database deployments.

### 7.4 When Azure SQL Alone Is Enough

Azure SQL Database alone is likely enough if EEI forms are configurable but governed, new fields are added through administrative configuration, dynamic attributes are moderate in volume, reporting is a major priority, relational integrity is more important than schema flexibility, the platform team wants fewer moving parts, there is no need for multi-region active-active document persistence, and JSON payloads are mostly attached to structured parent records.

For this RFP, a strong production-ready approach would be to start with Azure SQL Database as the authoritative persistence layer and use JSON-capable tables for configurable EEI responses and forms. Cosmos DB can remain an optional enhancement for future high-volume or highly variable workloads.

---

## 8. Recommended Persistence Strategy

### 8.1 Recommended Option

Use Azure SQL Database as the primary system of record.

Use Blob Storage for documents and generated exports.

Make Cosmos DB optional, not mandatory, unless the implementation team confirms high-volume, high-variability EEI and integration payload needs.

### 8.2 Recommended SQL-First Design

The SQL-first model should include incident tables, location tables, contact tables, resource tables, resource request tables, ICS command tables, operational period tables, task and objective tables, notification tables, audit tables, document metadata tables, AAR and HVA tables, EEI template tables, EEI prompt tables, EEI response tables with JSON payload support, attribute definition tables for configurable fields, lookup tables for controlled values, and reporting views for Power BI.

This provides both structure and flexibility.

### 8.3 Suggested Proposal Positioning

Azure SQL Database will serve as the authoritative transactional system of record for incidents, locations, resources, users, roles, tasks, audit records, and reporting metadata. For configurable EEI collection and incident-specific operational payloads, the platform can support either a SQL-native flexible attribute model or Azure Cosmos DB. The recommended baseline is a SQL-first persistence model to simplify governance, reporting, and operational support, with Cosmos DB available as an extension point if the State requires high-volume, highly variable, document-style operational data.

This gives the State a practical and cost-conscious architecture while preserving a growth path.

---

## 9. Practical Recommendation

For this application, the strongest architecture is:

- Azure SQL Database for the core operational system of record
- Azure SQL JSON support for configurable EEI forms and dynamic attributes
- Azure Blob Storage for files, reports, attachments, and exports
- Power BI for dashboards and curated reporting models
- Cosmos DB only if flexible operational payloads become too variable or high-volume for SQL to manage cleanly

This avoids over-engineering while preserving architectural flexibility.

Cosmos DB was included for good reasons, but it should be treated as a targeted capability rather than a required default persistence layer.

---

## 10. Bottom Line

The system can be built successfully without Cosmos DB.

Azure SQL Database can support the application, dynamic attributes, configurable lookups, and EEI response payloads if the data model is designed properly.

Cosmos DB becomes valuable when the platform needs to manage large volumes of highly variable, document-style operational data that changes frequently by incident type, facility type, hazard, exercise, or reporting requirement.

The differentiator is not simply adding Cosmos DB. The differentiator is designing the platform so the State can start with a governed SQL-first model and still expand into Cosmos DB if operational complexity or data variability justifies it.
