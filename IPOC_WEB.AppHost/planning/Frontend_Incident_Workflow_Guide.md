# Frontend Incident Workflow Guide

**Author:** Hans Esquivel  
**Created:** 2026-06-22  
**Purpose:** Walkthrough for creating and editing incidents in the ipoc Operations Center frontend

---

## Overview

The ipoc Operations Center provides a professional, Bootstrap-based UI for managing emergency operations incidents. This guide explains how to create new incidents, edit existing ones, and understand the data flow from backend to frontend.

---

## Prerequisites

### Database Setup

Before the frontend can display incident data and lookup values, the database must be initialized:

1. **Run the NIMS Data Model script:**
   ```sql
   -- Execute: IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_NIMS_Data_Model.sql
   ```

2. **Run the Lookup Migration script:**
   ```sql
   -- Execute: IPOC_WEB.AppHost/planning/KDHE_Custom_IOC_EM_Lookup_Migration.sql
   ```

These scripts create:
- Schema structure (ref, inc, org, sec, res, cmd)
- Lookup code sets (IncidentType, Severity, IncidentStatus, TaskPriority, TaskStatus, TimelineEventType)
- Seed lookup values (e.g., "Public Health", "Severe Weather", "Low", "Moderate", etc.)
- Permission and role mappings for lookup administration

### Authentication

The application uses MSAL (Microsoft Authentication Library) for Azure AD authentication. To use incident features:

1. **Sign In:**
   - Click the **Sign In** button in the top-right action bar
   - Authenticate with your Azure AD account
   - The UI will show your name and enable authenticated features

2. **Guest Mode Limitations:**
   - Without authentication, the UI shows read-only placeholders
   - Create/edit incident features are disabled
   - Lookup dropdowns will be empty

---

## Navigation

The application uses a collapsible left navigation pane with three main views:

### **Dashboard View** (🏠 Icon)
- System readiness snapshot
- Resource posture overview
- Weather feed
- Quick metrics

### **Incidents View** (📋 Icon)
- **Incident Workspace** accordion (placeholder for future quick-create/search UI)
- **Create Incident** card
- **Active Incident Board** (list of all incidents with search/filter)
- **Incident Command Pane** (tabbed workspace for selected incident)

### **Facilities View** (🏥 Icon)
- Resource inventory management
- Bed availability snapshot entry
- Location-based facility views

### **Alerts** (⚠️ Icon)
- Opens the Alert Center panel
- Shows system/operational alerts and notifications

**How to Navigate:**
- Click any navigation button to switch views
- Only the selected view's content is rendered (improves performance)
- Navigation pane can be collapsed/expanded using the chevron button

---

## Creating a New Incident

### Step 1: Navigate to Incidents View

1. Click the **Incidents** button in the left navigation pane (📋 icon)
2. The Incidents view renders three main sections:
   - **Incident Workspace** (placeholder accordion)
   - **Create Incident** card
   - **Active Incident Board**
   - **Incident Command Pane** (only visible when an incident is selected)

### Step 2: Fill Out the Create Incident Form

The **Create Incident** card includes:

- **Incident Number** (text input)
  - Example: `2026-001`, `FLOOD-001`, `PH-COVID-2026`
  - User-defined identifier for the incident

- **Incident Name** (text input, required)
  - Example: `Severe Weather Response - Tornado Warning`
  - Short descriptive name

- **Incident Type** (dropdown, populated from backend)
  - Options loaded from `ref.CodeSet` → `IncidentType`:
	- Public Health
	- Severe Weather
	- Hazmat
	- Mass Casualty
	- Cybersecurity
	- Infrastructure Failure
  - **If the dropdown is empty:**
	- Verify the database has been seeded (run `KDHE_Custom_IOC_EM_Lookup_Migration.sql`)
	- Check browser console for API errors (F12 → Console)
	- Verify backend is running and `/api/v1/lookups/codesets/IncidentType` returns data

- **Severity** (dropdown, populated from backend)
  - Options loaded from `ref.CodeSet` → `Severity`:
	- Low
	- Moderate
	- High
	- Critical
	- Catastrophic

- **Initial Summary** (textarea)
  - Brief operational summary of the incident situation
  - Example: `Tornado warning issued for Johnson County. Expected landfall 1400 hours. Activating shelter coordination.`

- **Planned Event** (checkbox)
  - Check if this is a planned exercise or scheduled event (e.g., training drill, special event support)
  - Unchecked by default (real-world incident)

### Step 3: Submit the Incident

1. Click **Create Incident** button
2. Backend API call: `POST /api/v1/incidents`
3. On success:
   - Toast notification appears: "Incident created successfully."
   - Form fields reset
   - Incident list refreshes automatically
   - New incident appears in **Active Incident Board**

4. On error:
   - Toast notification shows error message
   - Form fields retain entered data
   - User can correct and retry

---

## Viewing and Selecting Incidents

### Active Incident Board

The **Active Incident Board** displays all incidents in a searchable, filterable table:

- **Search Bar:** Filter incidents by number, name, or summary (real-time client-side filter)
- **Status Filter Dropdown:** Filter by incident status (All, Draft, Active, Monitoring, Demobilizing, Closed, Archived)
- **Incident List:**
  - Displays: Incident Number, Name, Type, Severity, Status
  - Click any row to select the incident
  - Selected row is highlighted
  - Selection triggers **Incident Command Pane** to load and display

### Loading States

- **Loading:** Shows spinner and "Loading incidents..." message
- **Empty State:** "No incidents found" (if database has no incidents)
- **Error State:** Displays error message with red alert styling
- **Guest Mode:** "Please sign in to view incidents."

---

## Editing an Existing Incident

### Step 1: Select the Incident

1. Navigate to **Incidents** view
2. In the **Active Incident Board**, click the incident row you want to edit
3. The **Incident Command Pane** appears below with tabbed interface

### Step 2: Incident Command Pane Tabs

The Incident Command Pane provides five tabs:

#### **Overview Tab**

- **Edit Incident Metadata:**
  - Incident Name (text input)
  - Incident Type (dropdown, populated from lookups)
  - Severity (dropdown, populated from lookups)
  - Initial Summary (textarea)
  - Situation Summary (textarea) – updated summary for ongoing operations
  - Planned Event (checkbox)

- **Action Buttons:**
  - **Save Changes:** Updates incident metadata via `PUT /api/v1/incidents/{id}`
  - **Activate Incident:** Changes status from Draft → Active (enables operational period tracking)
  - **Close Incident:** Changes status to Closed (demobilization complete)

- **Command Assignments (ICS Positions):**
  - Lists all available ICS positions (Incident Commander, Operations Chief, Planning Chief, etc.)
  - Shows assigned user for each position
  - **Assign User:** Select user from dropdown and click **Assign**
  - **Remove Assignment:** Click **Remove** to clear assignment
  - Tracks command structure changes for NIMS compliance

#### **Tasks Tab**

- **Create Incident Task:**
  - Task Title (text input, required)
  - Description (textarea)
  - Priority (dropdown: Low, Normal, High, Critical)
  - Due Date (datetime-local input)
  - Click **Create Task** to add

- **Task List:**
  - Displays all tasks for the incident
  - Each task shows: Title, Priority, Status, Due Date
  - **Update Status Dropdown:** Change task status (Open → Assigned → In Progress → Completed / Blocked / Cancelled)
  - Status changes save immediately via API

#### **Timeline Tab**

- **Create Timeline Event:**
  - Event Type (dropdown: Operational Update, Command Decision, Resource Deployment, Public Information, Situation Report)
  - Event Title (text input, required)
  - Description (textarea)
  - Event Time (datetime-local input)
  - Click **Create Event** to add

- **Timeline Event List:**
  - Chronological list of all timeline events
  - Displays: Event Time, Type, Title, Description
  - Provides operational log and audit trail

#### **Periods & Objectives Tab**

- **Create Operational Period:**
  - Period Number (integer, e.g., 1, 2, 3)
  - Period Name (text input, e.g., "Initial Response", "Sustained Operations")
  - Start Time (datetime-local input)
  - End Time (datetime-local input)
  - Status (dropdown: Draft, Active, Completed)
  - Planning Meeting Notes (textarea)
  - Click **Create Period** to add

- **Operational Period List:**
  - Shows all defined operational periods
  - NIMS-aligned ICS 202/204 support

- **Create Objective:**
  - Operational Period (dropdown, populated from created periods)
  - Objective Number (text input, e.g., "1A", "2B")
  - Objective Text (textarea, required)
  - Priority (dropdown: Low, Normal, High, Critical)
  - Status (dropdown: Draft, Approved, Active, Completed, Deferred, Cancelled)
  - Owner User (dropdown, future: assigned responsible party)
  - Due Date (datetime-local input)
  - Click **Create Objective** to add

- **Objectives List:**
  - Displays all objectives grouped by operational period
  - Tracks goal achievement and command intent

#### **SITREP / IAP Tab**

- **Situation Report (SITREP):**
  - **Current Situation Summary** (displays incident's current situation summary)
  - **Incident Status Overview** (displays incident metadata: number, name, type, severity, status)
  - **Active Command Assignments** (lists ICS positions with assigned users)
  - **Pending and In-Progress Tasks** (filters task list by non-completed statuses)

- **Incident Action Plan (IAP):**
  - **Incident Objectives** (displays all active/approved objectives for current operational period)
  - **Command Structure** (ICS organizational chart representation)
  - **Operational Period Details** (current period start/end, planning meeting notes)

- **Export/Print Capability (Future):**
  - Generate PDF/Word documents for ICS 209, ICS 201, ICS 202 forms
  - Supports NIMS documentation requirements

---

## ICS Command Structure Management and Assignment

This section describes how to manage ICS positions and apply them to incidents using the current Admin and Incident workflows.

### A. Configure ICS Positions (Admin)

1. Open **Administration Workspace**.
2. Select the **ICS Positions** tab.
3. Use the filter row to locate existing positions by:
   - Position Code
   - Position Name
   - ICS Section
   - NIMS Standard vs Custom
4. To create a new position:
   - Enter **Position Code** (unique, e.g., `IC`, `OPS`, `LOG`)
   - Enter **Position Name** (e.g., `Incident Commander`)
   - Enter **ICS Section** (e.g., `Command`, `Operations`, `Planning`, `Logistics`, `Finance/Admin`)
   - Optional: **Parent Position Code** for hierarchy
   - Optional: **Sort Order**
   - Optional: **Description**
   - Optional: toggle **NIMS standard position**
   - Click **Save**
5. To edit an existing position:
   - Click the row **Edit** action
   - Update fields (Position Code remains immutable in edit mode)
   - Click **Save**
6. To change standard/custom classification:
   - Use the row action to toggle **NIMS standard** status.

### B. ICS Validation Rules (Current Behavior)

The backend enforces:

- `PositionCode` must be unique.
- `ParentPositionCode` must exist when provided.
- `ParentPositionCode` cannot reference the same position.
- Form-level validation errors are returned inline in Admin (field-level messages).

### C. Apply ICS Positions to an Incident

1. Navigate to **Incidents** view.
2. Select an incident from **Active Incident Board**.
3. In **Incident Command Pane → Overview**:
   - Locate **ICS Command Structure** assignment area.
   - For each ICS position, choose an assignee.
   - Click **Assign** to create/update assignment.
   - Use **Remove** to clear assignment.

Assignment behavior:

- Positions come from configured ICS lookup data.
- Assignments are incident-specific.
- Reassignment updates the current active assignment for the incident/position pair.

### D. Recommended Governance Pattern

- Keep standard NIMS roles enabled for baseline interoperability.
- Add custom roles only when operationally required.
- Use Parent Position Code to keep hierarchy readable.
- Review assignment completeness at incident activation and operational period transition.

---

## Data Flow Architecture

### Frontend → Backend

1. **User Action:**
   - User fills form in React component (e.g., `CreateIncidentCard.tsx`)
   - User clicks submit button

2. **API Client Call:**
   - `frontend/src/api.ts` function invoked (e.g., `createIncident()`)
   - `fetchApi()` wrapper handles authentication token injection
   - HTTP request sent to backend endpoint (e.g., `POST /api/v1/incidents`)

3. **Backend Processing:**
   - `IPOC_WEB.Server/Program.cs` route handler receives request
   - Validates DTO payload
   - Service layer (`IncidentCommandService.cs`) executes business logic
   - ADO.NET direct SQL command writes to database
   - Returns response DTO

4. **Frontend Update:**
   - API client receives response
   - Success: Toast notification shown, data refresh triggered
   - Error: Toast notification with error message, no state change

### Backend → Frontend (Lookups)

1. **Component Mount:**
   - `useOperationalLookups` hook runs on component mount
   - Checks if user is authenticated

2. **Lookup API Calls:**
   - Hook invokes `getLookupValues('IncidentType')`, etc.
   - API client checks local cache first (5-minute TTL)
   - If not cached: `GET /api/v1/lookups/codesets/{codeSetName}`

3. **Backend Lookup Service:**
   - `LookupQueryService.cs` queries `ref.CodeSet` and `ref.CodeValue` tables
   - Parameterized SQL prevents injection
   - Returns array of `{ code, displayName, sortOrder, isActive }`

4. **Frontend Rendering:**
   - Hook stores lookup values in state
   - Dropdown components (`<Form.Select>`) render `<option>` elements
   - User sees populated dropdowns with display names

### Real-Time Data Refresh

- **Incident List:** Refreshes every 30 seconds when Incidents view is active (configurable in `useIncidentDataRefresh.ts`)
- **Incident Detail:** Refreshes when selected incident changes
- **Tasks/Timeline/Periods:** Refresh after each create/update action
- **Lookups:** Cached for 5 minutes, then re-fetched

---

## Troubleshooting

### Dropdowns Are Empty

**Symptoms:**
- Incident Type, Severity, and other dropdowns show "Select..." but no options

**Root Causes:**
1. **Database not seeded:**
   - Run `KDHE_Custom_IOC_EM_Lookup_Migration.sql`
   - Verify `ref.CodeSet` and `ref.CodeValue` tables have data

2. **Backend API error:**
   - Open browser DevTools (F12) → Network tab
   - Look for `/api/v1/lookups/codesets/IncidentType` request
   - Check response status (should be 200)
   - If 401/403: Authentication issue
   - If 500: Database connection or SQL error

3. **Not authenticated:**
   - Sign in with Azure AD account
   - Verify token is present in API request headers

4. **Degraded read fallback enabled:**
   - In development, if SQL is unavailable, backend returns empty arrays
   - Check server console logs for SQL connection errors

### Incident Workspace Accordions Empty

**Symptoms:**
- "Incident Workspace" card expands but shows no content

**Root Cause:**
- This is currently a **placeholder UI component**
- Future implementation will show quick-create form and recent incidents summary
- Current workflow: use **Create Incident** card and **Active Incident Board**

### Incident List Shows "No incidents found"

**Possible Causes:**
1. **Database has no incidents yet:**
   - Create your first incident using the Create Incident card

2. **Backend API not running:**
   - Verify `dotnet run --project IPOC_WEB.AppHost` is running
   - Check console for errors

3. **Filter is too restrictive:**
   - Clear search bar
   - Set status filter to "All"

### Navigation Buttons Don't Work

**Symptoms:**
- Clicking Dashboard, Incidents, or Facilities does nothing

**Fix:**
- This issue was resolved in the latest build
- Verify you have the latest code with `activeView` state in `App.tsx`
- Navigation buttons now call `onNavigate()` callback to switch views

---

## Best Practices

### Incident Number Conventions

- Use consistent naming: `YYYY-NNN` (e.g., `2026-001`, `2026-002`)
- Include type prefix for clarity: `FLOOD-001`, `PH-COVID-2026`
- Avoid special characters (database stores as `NVARCHAR(50)`)

### Severity Assignment

- **Low:** Routine monitoring, minimal resource commitment
- **Moderate:** Limited activation, regional coordination
- **High:** Full ICS activation, multi-agency coordination
- **Critical:** State-level coordination, federal assistance likely
- **Catastrophic:** Disaster declaration, national resources deployed

### Operational Period Planning

- **Initial Response:** First 0-12 hours, rapid assessment and stabilization
- **Sustained Operations:** 12-hour or 24-hour periods for ongoing response
- **Demobilization Planning:** Final period before closure
- Use consistent period numbering (1, 2, 3, etc.)

### Task Management

- **Assign priorities realistically:** Don't mark everything "Critical"
- **Use status updates:** Track task progress accurately (Open → Assigned → In Progress → Completed)
- **Set realistic due dates:** Coordinate with operational period timelines
- **Link tasks to objectives:** Tasks should support defined operational period objectives

---

## Future Enhancements

### Planned Features

1. **Incident Workspace Quick-Create:**
   - One-click incident creation with minimal fields
   - Predefined incident templates (e.g., "Severe Weather Response", "Public Health Emergency")

2. **Map Integration:**
   - GIS/map view showing incident locations
   - Resource deployment visualization
   - Affected area boundaries

3. **Real-Time Collaboration:**
   - SignalR/WebSocket live updates
   - Show other users currently viewing/editing the same incident
   - Chat/messaging within incident context

4. **Document Attachments:**
   - Upload/download ICS forms, situation photos, resource manifests
   - Versioned document repository per incident

5. **Automated SITREP/IAP Generation:**
   - Export to PDF/Word/Excel
   - ICS 209, ICS 201, ICS 202, ICS 204 form templates
   - Scheduled SITREP email distribution

6. **Mobile Responsive UI:**
   - Bootstrap already provides responsive foundation
   - Optimize for tablet/phone field use
   - Offline-capable PWA for field commanders

---

## Summary

**Creating an Incident:**
1. Navigate to Incidents view (📋 icon)
2. Fill out Create Incident card form
3. Click **Create Incident**
4. Incident appears in Active Incident Board

**Editing an Incident:**
1. Navigate to Incidents view
2. Click incident row in Active Incident Board
3. Incident Command Pane opens with tabbed interface
4. Use Overview tab to edit metadata
5. Use Tasks, Timeline, Periods & Objectives tabs to manage operations
6. Use SITREP/IAP tab for reporting and documentation

**Data Requirements:**
- Run `KDHE_Custom_IOC_EM_NIMS_Data_Model.sql` (schema)
- Run `KDHE_Custom_IOC_EM_Lookup_Migration.sql` (lookup seed data)
- Sign in with Azure AD (MSAL authentication)
- Backend API running on configured port

**Alignment with RFP:**
- NIMS/ICS-compliant incident management
- Professional Bootstrap UI (competitive differentiator)
- Backend-driven lookups (extensible and admin-managed)
- Real-time operational visibility
- Task/timeline/objective tracking for AAR and compliance
