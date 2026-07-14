# Schema Name Verification and Correction

**Date:** 2026-06-22  
**Issue:** Documentation referenced wrong schema name  
**Status:** CORRECTED

---

## User Feedback

> "missing inc schema, but I'm assuming my existing 'ic' may be the same. 'ic' is in reference to incident. if that's the same for inc, then update your current changes with ic."

**User is correct.** The schema is **`ic`** (incident), not `inc`.

---

## Verification Results

###  **SQL Schema Definition (Source of Truth)**

From `KDHE_Custom_IOC_EM_NIMS_Data_Model.sql` lines 34-45:

```sql
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ref') EXEC('CREATE SCHEMA ref');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'sec') EXEC('CREATE SCHEMA sec');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'org') EXEC('CREATE SCHEMA org');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ic') EXEC('CREATE SCHEMA ic');      --  INCIDENT SCHEMA
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'res') EXEC('CREATE SCHEMA res');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'eei') EXEC('CREATE SCHEMA eei');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'comm') EXEC('CREATE SCHEMA comm');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'doc') EXEC('CREATE SCHEMA doc');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'assessment') EXEC('CREATE SCHEMA assessment');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'audit') EXEC('CREATE SCHEMA audit');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'intg') EXEC('CREATE SCHEMA intg');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'app') EXEC('CREATE SCHEMA app');
```

###  **Backend Code Already Correct**

Verified `KPP_WEB.Server/Infrastructure/Incidents/IncidentQueryService.cs`:
-  Line 88: `FROM ic.Incident i`
-  Line 223: `INSERT INTO ic.Incident`
-  Line 349: `FROM ic.IncidentTask t`
-  Line 411: `INSERT INTO ic.IncidentTask`
-  Line 527: `FROM ic.IncidentTimelineEvent e`
-  Line 660: `FROM ic.IncidentOperationalPeriod p`
-  Line 795: `FROM ic.IncidentObjective o`
-  Line 1080: `FROM ic.IncidentCommandAssignment a`
-  Line 1305: `FROM ic.SituationReport sr`

**All backend service code uses `ic.` correctly. No code changes needed.**

---

## Complete Schema List (IOCEM Database)

| Schema | Purpose |
|--------|---------|
| **ic** | **Incident Command** - incidents, tasks, timeline, operational periods, objectives, command assignments, SITREPs |
| ref | Reference data - lookups, code sets, code values |
| sec | Security - users, roles, permissions, sessions |
| org | Organization - facilities, locations, regions, contacts |
| res | Resources - inventory, resource requests, deployments |
| eei | Essential Elements of Information - EEI prompts, responses |
| comm | Communications - notifications, alerts, messages |
| doc | Documents - attachments, exports, templates |
| assessment | Assessment - After Action Reports (AAR), Hazard Vulnerability Assessments (HVA) |
| audit | Audit logs - user actions, data changes, export tracking |
| intg | Integration - API clients, interface messages, outbox events |
| app | Application - system settings, feature flags |

---

## Documentation Corrections Made

###  **QUICK_START.md**
**Changed:**
```markdown
- Creates all necessary schemas (inc, ref, org, sec, res, cmd, etc.) if they don't exist
```

**To:**
```markdown
- Creates all necessary schemas (ic, ref, org, sec, res, eei, comm, doc, assessment, audit, intg, app) if they don't exist
```

###  **CRITICAL_CORRECTION_Database_Name.md**
**Added section:**
```markdown
## Additional Correction: Schema Name (ic vs inc)

**Secondary Error Found:**
-  **Wrong:** I referenced `inc` schema in some documentation
-  **Correct:** Your actual schema is **`ic`** (incident)
```

**Fixed schema verification query:**
```sql
-- OLD (WRONG):
SELECT name FROM sys.schemas WHERE name IN ('ref', 'inc', 'org', ...);

-- NEW (CORRECT):
SELECT name FROM sys.schemas WHERE name IN ('ref', 'ic', 'org', 'sec', 'res', 'eei', 'comm', 'doc', 'assessment', 'audit', 'intg', 'app');
```

---

## No Code Changes Required

 **Backend services** - Already use `ic.` schema correctly  
 **SQL migration scripts** - Already define `ic` schema correctly  
 **Frontend** - No schema references (uses API endpoints only)  
 **API endpoints** - No schema references (delegates to backend services)  

**The error was documentation-only.**

---

## Corrected Verification Commands

### Check if IOCEM database has all required schemas:

```sql
-- Connect to (local)\IOCEM in SSMS and run:
SELECT name 
FROM sys.schemas 
WHERE name IN ('ic', 'ref', 'sec', 'org', 'res', 'eei', 'comm', 'doc', 'assessment', 'audit', 'intg', 'app')
ORDER BY name;
```

**Expected result:** 12 rows (all schemas listed above)

### Check if incident tables exist in `ic` schema:

```sql
SELECT 
	s.name AS SchemaName, 
	t.name AS TableName
FROM sys.tables t
INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name = 'ic'
ORDER BY t.name;
```

**Expected tables:**
- `ic.Incident`
- `ic.IncidentCommandAssignment`
- `ic.IncidentObjective`
- `ic.IncidentOperationalPeriod`
- `ic.IncidentTask`
- `ic.IncidentTimelineEvent`
- `ic.SituationReport`

### Check if lookup tables exist in `ref` schema:

```sql
SELECT COUNT(*) AS CodeSetCount FROM ref.CodeSet;
SELECT COUNT(*) AS CodeValueCount FROM ref.CodeValue;
```

**Expected:**
- CodeSetCount: 6 (IncidentType, Severity, IncidentStatus, TaskPriority, TaskStatus, TimelineEventType)
- CodeValueCount: ~25 (all lookup values seeded)

---

## Summary

**What was wrong:** I wrote `inc` in documentation instead of the correct **`ic`** schema name.

**What's correct now:**
-  Documentation updated to reference `ic` schema
-  Verified all backend code already uses `ic.` correctly
-  Verified SQL scripts define `ic` schema correctly
-  No code changes needed - error was documentation-only

**User's existing `ic` schema is correct and matches the SQL migration scripts.**
