/*
Author: Hans Esquivel
Created: 20260620

KDHE Custom IOC for EM - Azure Cosmos DB for NoSQL Query Script
Purpose:
  Admin-executable Cosmos DB SQL query library for the optional Flexible EEI / IEE data layer.

Important:
  Azure Cosmos DB for NoSQL does not support T-SQL DDL such as CREATE DATABASE, CREATE TABLE,
  ALTER TABLE, PRIMARY KEY, FOREIGN KEY, or CREATE INDEX.

  This .sql file is intended for Cosmos DB Data Explorer, Query Explorer, or the Cosmos DB Emulator
  query window. It provides production-ready validation, operational, dashboard, reconciliation,
  and administrative queries that align to the Cosmos DB layer created by the companion .ps1 script.

How to use:
  1. Open the target database in Cosmos DB Data Explorer or Emulator.
  2. Select the container shown in the section header.
  3. Run the query under that section.
  4. Replace parameter comments such as @tenantId, @incidentId, @locationId with literals or
     parameterized values supported by your SDK/tooling.

Recommended containers from the .ps1 deployment:
  - eeiTemplates
  - eeiResponses
  - resourceStatusDocuments
  - operationalEvents
  - dashboardProjections
  - integrationPayloads
  - validationResults
  - notificationReadModels

Partitioning convention:
  pk = "TENANT#KDHE|INCIDENT#{incidentId}"
  pk = "TENANT#KDHE|LOCATION#{locationId}"
  pk = "TENANT#KDHE|REGION#{regionId}"
  pk = "TENANT#KDHE|STATE#KS"
  pk = "TENANT#KDHE|SOURCE#{sourceSystemCode}"

Design intent:
  Azure SQL Database remains the authoritative system of record. Cosmos DB is used for flexible,
  high-variability EEI/IEE payloads, operational read models, integration payloads, and dashboard
  projections where document shape varies by incident, hazard, location, resource type, or prompt.
*/

--------------------------------------------------------------------------------
-- SECTION 1: eeiTemplates
-- Container: eeiTemplates
-- Purpose: Template definitions for Essential Elements of Information.
--------------------------------------------------------------------------------

-- 1.1 Active EEI templates for KDHE.
SELECT
    c.id,
    c.templateCode,
    c.templateName,
    c.appliesToCode,
    c.versionNumber,
    c.isActive,
    c.createdUtc,
    c.updatedUtc
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_TEMPLATE"
  AND c.isActive = true
ORDER BY c.templateCode ASC, c.versionNumber DESC;

-- 1.2 Latest active version for a specific EEI template.
-- Replace "BED_STATUS_DAILY" with the target templateCode.
SELECT TOP 1
    c.id,
    c.templateCode,
    c.templateName,
    c.versionNumber,
    c.schema,
    c.validationRules,
    c.displayDefinition
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_TEMPLATE"
  AND c.templateCode = "BED_STATUS_DAILY"
  AND c.isActive = true
ORDER BY c.versionNumber DESC;

-- 1.3 Templates that apply to location-level prompts.
SELECT
    c.templateCode,
    c.templateName,
    c.versionNumber,
    c.appliesToCode
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_TEMPLATE"
  AND c.appliesToCode = "LOCATION"
  AND c.isActive = true
ORDER BY c.templateName ASC;


--------------------------------------------------------------------------------
-- SECTION 2: eeiResponses
-- Container: eeiResponses
-- Purpose: Flexible EEI / IEE prompt responses by incident, location, region, or organization.
--------------------------------------------------------------------------------

-- 2.1 Responses for an incident.
-- Replace incidentId and pk with the actual values.
SELECT
    c.id,
    c.incidentId,
    c.promptId,
    c.promptTargetId,
    c.locationId,
    c.organizationId,
    c.regionId,
    c.responseVersion,
    c.responseStatusCode,
    c.submittedUtc,
    c.submittedByUserId
FROM c
WHERE c.tenantId = "KDHE"
  AND c.pk = "TENANT#KDHE|INCIDENT#12345"
  AND c.documentType = "EEI_RESPONSE"
  AND c.incidentId = "12345"
ORDER BY c.submittedUtc DESC;

-- 2.2 Most recent accepted response per prompt target.
SELECT
    c.promptTargetId,
    c.locationId,
    c.promptId,
    c.responseVersion,
    c.responseStatusCode,
    c.submittedUtc,
    c.payload
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_RESPONSE"
  AND c.incidentId = "12345"
  AND c.responseStatusCode = "Accepted"
ORDER BY c.promptTargetId ASC, c.responseVersion DESC;

-- 2.3 EEI responses submitted by a specific location.
SELECT
    c.id,
    c.incidentId,
    c.promptId,
    c.promptTargetId,
    c.locationId,
    c.responseStatusCode,
    c.submittedUtc,
    c.payload
FROM c
WHERE c.tenantId = "KDHE"
  AND c.pk = "TENANT#KDHE|LOCATION#456"
  AND c.documentType = "EEI_RESPONSE"
  AND c.locationId = "456"
ORDER BY c.submittedUtc DESC;

-- 2.4 Find responses with validation errors.
SELECT
    c.id,
    c.incidentId,
    c.promptId,
    c.promptTargetId,
    c.locationId,
    c.validation.statusCode,
    c.validation.errors,
    c.submittedUtc
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_RESPONSE"
  AND IS_DEFINED(c.validation.statusCode)
  AND c.validation.statusCode != "Valid"
ORDER BY c.submittedUtc DESC;

-- 2.5 Search response metadata/tags for dashboard use.
SELECT
    c.id,
    c.incidentId,
    c.locationId,
    c.promptId,
    c.tags,
    c.search
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_RESPONSE"
  AND ARRAY_CONTAINS(c.tags, "bed-availability")
ORDER BY c.submittedUtc DESC;

-- 2.6 Retrieve a specific payload field across responses.
-- Example field path: payload.staffedBedsAvailable
SELECT
    c.locationId,
    c.promptId,
    c.submittedUtc,
    c.payload.staffedBedsAvailable AS staffedBedsAvailable
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_RESPONSE"
  AND c.incidentId = "12345"
  AND IS_DEFINED(c.payload.staffedBedsAvailable)
ORDER BY c.submittedUtc DESC;

-- 2.7 Count submitted responses by status for an incident.
SELECT
    c.responseStatusCode,
    COUNT(1) AS responseCount
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_RESPONSE"
  AND c.incidentId = "12345"
GROUP BY c.responseStatusCode;

-- 2.8 Late/missing response candidates using target metadata embedded into response or projection documents.
-- This query assumes dueUtc is denormalized on the EEI response document.
SELECT
    c.id,
    c.promptId,
    c.promptTargetId,
    c.locationId,
    c.responseStatusCode,
    c.dueUtc,
    c.submittedUtc
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "EEI_RESPONSE"
  AND c.responseStatusCode IN ("Draft", "Returned")
  AND c.dueUtc < GetCurrentDateTime()
ORDER BY c.dueUtc ASC;


--------------------------------------------------------------------------------
-- SECTION 3: resourceStatusDocuments
-- Container: resourceStatusDocuments
-- Purpose: Flexible resource and bed availability status documents by location and incident.
--------------------------------------------------------------------------------

-- 3.1 Current resource status documents for a location.
SELECT
    c.id,
    c.locationId,
    c.incidentId,
    c.resourceTypeCode,
    c.statusCode,
    c.reportedUtc,
    c.payload
FROM c
WHERE c.tenantId = "KDHE"
  AND c.pk = "TENANT#KDHE|LOCATION#456"
  AND c.documentType = "RESOURCE_STATUS"
  AND c.locationId = "456"
ORDER BY c.reportedUtc DESC;

-- 3.2 Resource status for an active incident.
SELECT
    c.locationId,
    c.resourceTypeCode,
    c.statusCode,
    c.reportedUtc,
    c.payload.quantityAvailable,
    c.payload.quantityTotal,
    c.payload.attributes
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "RESOURCE_STATUS"
  AND c.incidentId = "12345"
ORDER BY c.resourceTypeCode ASC, c.reportedUtc DESC;

-- 3.3 Bed availability documents for an incident.
SELECT
    c.locationId,
    c.reportedUtc,
    c.payload.bedCategoryCode,
    c.payload.staffedBedsTotal,
    c.payload.bedsAvailable,
    c.payload.bedsOccupied,
    c.payload.bedsUnavailable,
    c.payload.surgeBedsPotential
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "RESOURCE_STATUS"
  AND c.incidentId = "12345"
  AND c.resourceTypeCode = "BED"
ORDER BY c.locationId ASC, c.reportedUtc DESC;

-- 3.4 Resource status records with data quality warnings.
SELECT
    c.id,
    c.locationId,
    c.incidentId,
    c.resourceTypeCode,
    c.validation.statusCode,
    c.validation.warnings,
    c.reportedUtc
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "RESOURCE_STATUS"
  AND IS_DEFINED(c.validation.statusCode)
  AND c.validation.statusCode IN ("Warning", "Invalid")
ORDER BY c.reportedUtc DESC;

-- 3.5 Count resource reports by resource type.
SELECT
    c.resourceTypeCode,
    COUNT(1) AS reportCount
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "RESOURCE_STATUS"
  AND c.incidentId = "12345"
GROUP BY c.resourceTypeCode;


--------------------------------------------------------------------------------
-- SECTION 4: operationalEvents
-- Container: operationalEvents
-- Purpose: Event-style timeline, audit-friendly operational updates, and COP event feed.
--------------------------------------------------------------------------------

-- 4.1 Incident operational timeline.
SELECT
    c.id,
    c.eventUtc,
    c.incidentId,
    c.locationId,
    c.eventTypeCode,
    c.severityCode,
    c.eventTitle,
    c.eventDescription,
    c.createdByUserId,
    c.correlationId
FROM c
WHERE c.tenantId = "KDHE"
  AND c.pk = "TENANT#KDHE|INCIDENT#12345"
  AND c.documentType = "OPERATIONAL_EVENT"
  AND c.incidentId = "12345"
ORDER BY c.eventUtc DESC;

-- 4.2 Critical or high-severity operational events.
SELECT
    c.id,
    c.eventUtc,
    c.incidentId,
    c.locationId,
    c.eventTypeCode,
    c.severityCode,
    c.eventTitle,
    c.payload
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "OPERATIONAL_EVENT"
  AND c.severityCode IN ("High", "Critical")
ORDER BY c.eventUtc DESC;

-- 4.3 Events for a specific location.
SELECT
    c.eventUtc,
    c.incidentId,
    c.locationId,
    c.eventTypeCode,
    c.eventTitle,
    c.payload
FROM c
WHERE c.tenantId = "KDHE"
  AND c.pk = "TENANT#KDHE|LOCATION#456"
  AND c.documentType = "OPERATIONAL_EVENT"
  AND c.locationId = "456"
ORDER BY c.eventUtc DESC;

-- 4.4 Operational event counts by type for an incident.
SELECT
    c.eventTypeCode,
    COUNT(1) AS eventCount
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "OPERATIONAL_EVENT"
  AND c.incidentId = "12345"
GROUP BY c.eventTypeCode;


--------------------------------------------------------------------------------
-- SECTION 5: dashboardProjections
-- Container: dashboardProjections
-- Purpose: Read-optimized COP, regional, statewide, resource, and executive dashboard projections.
--------------------------------------------------------------------------------

-- 5.1 Statewide dashboard projection.
SELECT TOP 1
    c.id,
    c.viewName,
    c.scopeType,
    c.scopeId,
    c.updatedUtc,
    c.metrics,
    c.cards,
    c.sourceWatermarkUtc
FROM c
WHERE c.tenantId = "KDHE"
  AND c.pk = "TENANT#KDHE|STATE#KS"
  AND c.documentType = "DASHBOARD_PROJECTION"
  AND c.viewName = "StatewideOperationalPosture"
ORDER BY c.updatedUtc DESC;

-- 5.2 Regional resource posture projection.
SELECT
    c.id,
    c.viewName,
    c.scopeType,
    c.scopeId,
    c.updatedUtc,
    c.metrics,
    c.cards
FROM c
WHERE c.tenantId = "KDHE"
  AND c.pk = "TENANT#KDHE|REGION#7"
  AND c.documentType = "DASHBOARD_PROJECTION"
  AND c.viewName = "RegionalResourcePosture"
ORDER BY c.updatedUtc DESC;

-- 5.3 Incident common operating picture projection.
SELECT TOP 1
    c.id,
    c.viewName,
    c.scopeType,
    c.scopeId,
    c.incidentId,
    c.updatedUtc,
    c.metrics,
    c.cards,
    c.mapLayers,
    c.alerts
FROM c
WHERE c.tenantId = "KDHE"
  AND c.pk = "TENANT#KDHE|INCIDENT#12345"
  AND c.documentType = "DASHBOARD_PROJECTION"
  AND c.viewName = "IncidentCommonOperatingPicture"
ORDER BY c.updatedUtc DESC;

-- 5.4 Stale dashboard projections.
SELECT
    c.id,
    c.viewName,
    c.scopeType,
    c.scopeId,
    c.updatedUtc,
    c.sourceWatermarkUtc
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "DASHBOARD_PROJECTION"
  AND c.updatedUtc < DateTimeAdd("minute", -30, GetCurrentDateTime())
ORDER BY c.updatedUtc ASC;


--------------------------------------------------------------------------------
-- SECTION 6: integrationPayloads
-- Container: integrationPayloads
-- Purpose: Raw and normalized external integration payload capture and reconciliation.
--------------------------------------------------------------------------------

-- 6.1 Recent inbound integration messages.
SELECT
    c.id,
    c.sourceSystemCode,
    c.sourceMessageId,
    c.interfaceTypeCode,
    c.processingStatusCode,
    c.receivedUtc,
    c.relatedIncidentId,
    c.relatedLocationId,
    c.correlationId
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "INTEGRATION_PAYLOAD"
ORDER BY c.receivedUtc DESC;

-- 6.2 Failed or rejected integration payloads.
SELECT
    c.id,
    c.sourceSystemCode,
    c.sourceMessageId,
    c.interfaceTypeCode,
    c.processingStatusCode,
    c.receivedUtc,
    c.errorSummary,
    c.validationErrors
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "INTEGRATION_PAYLOAD"
  AND c.processingStatusCode IN ("Rejected", "Error", "Failed")
ORDER BY c.receivedUtc DESC;

-- 6.3 Integration payloads for bed availability.
SELECT
    c.id,
    c.sourceSystemCode,
    c.sourceMessageId,
    c.receivedUtc,
    c.processingStatusCode,
    c.relatedLocationId,
    c.rawPayload
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "INTEGRATION_PAYLOAD"
  AND c.interfaceTypeCode = "BED_AVAILABILITY"
ORDER BY c.receivedUtc DESC;

-- 6.4 Duplicate source message detection.
SELECT
    c.sourceSystemCode,
    c.sourceMessageId,
    COUNT(1) AS messageCount
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "INTEGRATION_PAYLOAD"
  AND IS_DEFINED(c.sourceMessageId)
GROUP BY c.sourceSystemCode, c.sourceMessageId
HAVING COUNT(1) > 1;


--------------------------------------------------------------------------------
-- SECTION 7: validationResults
-- Container: validationResults
-- Purpose: Short-lived validation results, error details, and operational quality checks.
--------------------------------------------------------------------------------

-- 7.1 Recent validation failures.
SELECT
    c.id,
    c.validationTypeCode,
    c.entityTypeCode,
    c.entityId,
    c.statusCode,
    c.createdUtc,
    c.errors,
    c.warnings
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "VALIDATION_RESULT"
  AND c.statusCode IN ("Invalid", "Warning")
ORDER BY c.createdUtc DESC;

-- 7.2 Validation failures for an incident.
SELECT
    c.id,
    c.incidentId,
    c.validationTypeCode,
    c.entityTypeCode,
    c.entityId,
    c.statusCode,
    c.errors
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "VALIDATION_RESULT"
  AND c.incidentId = "12345"
  AND c.statusCode != "Valid"
ORDER BY c.createdUtc DESC;


--------------------------------------------------------------------------------
-- SECTION 8: notificationReadModels
-- Container: notificationReadModels
-- Purpose: Read-optimized notification status, delivery rollups, and recipient views.
--------------------------------------------------------------------------------

-- 8.1 Notification delivery status for an incident.
SELECT
    c.id,
    c.incidentId,
    c.notificationId,
    c.notificationTypeCode,
    c.subject,
    c.createdUtc,
    c.statusSummary,
    c.recipientSummary
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "NOTIFICATION_READ_MODEL"
  AND c.incidentId = "12345"
ORDER BY c.createdUtc DESC;

-- 8.2 Failed notification recipients.
SELECT
    c.id,
    c.notificationId,
    r.recipientId,
    r.channelCode,
    r.destinationAddress,
    r.deliveryStatusCode,
    r.failureReason
FROM c
JOIN r IN c.recipients
WHERE c.tenantId = "KDHE"
  AND c.documentType = "NOTIFICATION_READ_MODEL"
  AND r.deliveryStatusCode = "Failed"
ORDER BY c.createdUtc DESC;

-- 8.3 Notification status counts.
SELECT
    c.notificationTypeCode,
    c.statusSummary.totalRecipients,
    c.statusSummary.sentCount,
    c.statusSummary.failedCount,
    c.createdUtc
FROM c
WHERE c.tenantId = "KDHE"
  AND c.documentType = "NOTIFICATION_READ_MODEL"
ORDER BY c.createdUtc DESC;


--------------------------------------------------------------------------------
-- SECTION 9: Cross-container query patterns
-- Note: Cosmos DB Data Explorer executes queries within one selected container.
-- These patterns should be executed against the listed container or implemented
-- in application/API code where cross-container coordination is required.
--------------------------------------------------------------------------------

-- 9.1 Pattern: incident dashboard load sequence
-- Step 1, dashboardProjections: get IncidentCommonOperatingPicture by incident partition.
-- Step 2, operationalEvents: get recent operational timeline events by incident partition.
-- Step 3, eeiResponses: get latest accepted responses by incident.
-- Step 4, resourceStatusDocuments: get latest resource status by incident.
-- Step 5, notificationReadModels: get notification rollups by incident.

-- 9.2 Pattern: location detail page load sequence
-- Step 1, resourceStatusDocuments: get current resource status by location partition.
-- Step 2, eeiResponses: get location EEI submissions.
-- Step 3, operationalEvents: get operational events for location.
-- Step 4, notificationReadModels: get location-related notifications if projected.

-- 9.3 Pattern: regional dashboard load sequence
-- Step 1, dashboardProjections: get RegionalResourcePosture by region partition.
-- Step 2, eeiResponses: query regionId if regional response documents are partitioned by region.
-- Step 3, resourceStatusDocuments: use SQL/analytics layer for aggregated cross-location resource metrics
--         when region spans many locations.


--------------------------------------------------------------------------------
-- SECTION 10: Administrative health checks
--------------------------------------------------------------------------------

-- 10.1 Validate tenant/document type distribution in a selected container.
SELECT
    c.tenantId,
    c.documentType,
    COUNT(1) AS documentCount
FROM c
GROUP BY c.tenantId, c.documentType;

-- 10.2 Validate partition key format.
SELECT TOP 100
    c.id,
    c.pk,
    c.documentType
FROM c
WHERE NOT STARTSWITH(c.pk, "TENANT#KDHE|");

-- 10.3 Recently updated documents in the selected container.
SELECT TOP 100
    c.id,
    c.pk,
    c.documentType,
    c.updatedUtc,
    c.createdUtc
FROM c
WHERE c.tenantId = "KDHE"
ORDER BY c._ts DESC;

-- 10.4 Documents missing expected governance metadata.
SELECT TOP 100
    c.id,
    c.pk,
    c.documentType,
    c.tenantId,
    c.createdUtc,
    c.createdByUserId
FROM c
WHERE NOT IS_DEFINED(c.tenantId)
   OR NOT IS_DEFINED(c.documentType)
   OR NOT IS_DEFINED(c.pk)
   OR NOT IS_DEFINED(c.createdUtc);

-- 10.5 Documents with raw payloads, for review of indexing/storage policies.
SELECT TOP 100
    c.id,
    c.pk,
    c.documentType,
    c.sourceSystemCode,
    c.receivedUtc
FROM c
WHERE IS_DEFINED(c.rawPayload)
ORDER BY c._ts DESC;


--------------------------------------------------------------------------------
-- SECTION 11: Document contract reference
-- These are NOT executable INSERT statements. Cosmos DB Data Explorer query mode
-- does not create containers or insert documents using SQL.
-- Use SDK, Data Explorer item editor, stored procedures, or the companion .ps1
-- deployment script for writes.
--------------------------------------------------------------------------------

-- EEI_RESPONSE contract:
-- {
--   "documentType": "EEI_RESPONSE",
--   "id": "response-{promptTargetId}-{responseVersion}",
--   "pk": "TENANT#KDHE|INCIDENT#{incidentId}",
--   "tenantId": "KDHE",
--   "incidentId": "{incidentId}",
--   "promptId": "{promptId}",
--   "promptTargetId": "{promptTargetId}",
--   "locationId": "{locationId}",
--   "organizationId": "{organizationId}",
--   "regionId": "{regionId}",
--   "responseVersion": 1,
--   "responseStatusCode": "Submitted",
--   "schemaVersion": 1,
--   "submittedUtc": "ISO-8601 UTC",
--   "submittedByUserId": "{userId}",
--   "payload": {
--     "fieldCode": "value"
--   },
--   "validation": {
--     "statusCode": "Valid",
--     "ruleVersion": 1
--   },
--   "search": {
--     "incidentName": "optional denormalized search value",
--     "locationName": "optional denormalized search value"
--   }
-- }

-- RESOURCE_STATUS contract:
-- {
--   "documentType": "RESOURCE_STATUS",
--   "id": "resource-status-{locationId}-{resourceTypeCode}-{reportedUtc}",
--   "pk": "TENANT#KDHE|LOCATION#{locationId}",
--   "tenantId": "KDHE",
--   "incidentId": "{incidentId}",
--   "locationId": "{locationId}",
--   "resourceTypeCode": "{resourceTypeCode}",
--   "statusCode": "Reported",
--   "reportedUtc": "ISO-8601 UTC",
--   "payload": {
--     "quantityAvailable": 0,
--     "quantityTotal": 0,
--     "attributes": {}
--   }
-- }

-- DASHBOARD_PROJECTION contract:
-- {
--   "documentType": "DASHBOARD_PROJECTION",
--   "id": "projection-{viewName}-{scopeType}-{scopeId}",
--   "pk": "TENANT#KDHE|{scopeType}#{scopeId}",
--   "tenantId": "KDHE",
--   "viewName": "RegionalResourcePosture",
--   "scopeType": "REGION",
--   "scopeId": "{regionId}",
--   "updatedUtc": "ISO-8601 UTC",
--   "metrics": {},
--   "cards": [],
--   "sourceWatermarkUtc": "ISO-8601 UTC"
-- }

-- INTEGRATION_PAYLOAD contract:
-- {
--   "documentType": "INTEGRATION_PAYLOAD",
--   "id": "integration-{sourceSystemCode}-{sourceMessageId}",
--   "pk": "TENANT#KDHE|SOURCE#{sourceSystemCode}",
--   "tenantId": "KDHE",
--   "sourceSystemCode": "{sourceSystemCode}",
--   "sourceMessageId": "{sourceMessageId}",
--   "interfaceTypeCode": "BED_AVAILABILITY",
--   "processingStatusCode": "Received",
--   "receivedUtc": "ISO-8601 UTC",
--   "relatedIncidentId": "{incidentId}",
--   "relatedLocationId": "{locationId}",
--   "correlationId": "{correlationId}",
--   "rawPayload": {}
-- }
