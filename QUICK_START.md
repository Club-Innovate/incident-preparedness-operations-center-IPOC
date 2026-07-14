# KPP_WEB Quick Start Checklist

**Purpose:** Get the KPP Operations Center running locally with full functionality  
**Time Required:** ~10 minutes (first-time setup)  
**Author:** Hans Esquivel  
**Date:** 2026-06-22

---

## Prerequisites

-  .NET 10 SDK installed
-  Node.js and npm installed
-  SQL Server running locally (or Azure SQL connection string)
-  Azure AD application configured (MSAL authentication)
-  Visual Studio 2026 or VS Code (optional, but recommended)

---

## Step 1: Database Initialization

**Goal:** Run schema and lookup seed scripts against your existing **IOCEM** database

**IMPORTANT:** You already have the IOCEM database configured. The scripts below will add schemas and seed data to your **existing database** - they will NOT create a new database.

### Option A: Automated Script (Recommended)

```powershell
# From repository root
# Uses defaults from appsettings.Development.json:
# Server: (local), Database: IOCEM, User: sa, Password: !devapp!
.\Initialize-Database.ps1
```

**What it does:**
- Connects to your **existing IOCEM database** on (local) SQL Server
- Creates all necessary schemas (ic, ref, org, sec, res, eei, comm, doc, assessment, audit, intg, app) if they don't exist
- Seeds lookup code sets (IncidentType, Severity, IncidentStatus, TaskPriority, TaskStatus, TimelineEventType)
- Populates lookup values (Public Health, Severe Weather, Low, Moderate, etc.)
- Sets up permissions and roles

**Expected Output:**
```
✓ Connection successful!
✓ Data model script executed successfully!
✓ Lookup migration script executed successfully!
Database initialization complete!
```

### Option B: Manual SQL Execution

If you prefer to run SQL scripts manually:

1. Open SQL Server Management Studio (SSMS)
2. Connect to **(local)** with SQL Authentication (User: **sa**, Password: **!devapp!**)
3. Select database: **IOCEM** (already exists - do NOT create a new database)
4. Execute: `KPP_WEB.AppHost/planning/KDHE_Custom_IOC_EM_NIMS_Data_Model.sql`
5. Execute: `KPP_WEB.AppHost/planning/KDHE_Custom_IOC_EM_Lookup_Migration.sql`

---

## Step 2: Backend Configuration

**Goal:** Verify connection string configuration (already configured in appsettings.Development.json)

### Your Current Configuration

The project is already configured for your local development environment:

**From `appsettings.Development.json`:**
```json
{
  "ConnectionStrings": {
	"IocEm": "Server=(local);Database=IOCEM;User Id=sa;Password=!devapp!;TrustServerCertificate=True;Encrypt=True"
  },
  "SqlData": {
	"ConnectionStringName": "IocEm",
	"DatabaseName": "IOCEM"
  }
}
```

**No changes needed for local development.** The backend will automatically use the IOCEM database on (local) SQL Server.

---

## Step 3: Start Backend

**Goal:** Run the .NET Aspire AppHost and backend API

### From Terminal (PowerShell or Bash)

```powershell
# From repository root
dotnet run --project KPP_WEB.AppHost
```

**Expected Output:**
```
info: Microsoft.Hosting.Lifetime[14]
	  Now listening on: https://localhost:7435
info: Microsoft.Hosting.Lifetime[0]
	  Application started. Press Ctrl+C to shut down.
```

**Verify Backend is Running:**
- Open browser: https://localhost:7435/api/v1/system/readiness
- Expected response: JSON with `status: "Operational"` or similar

---

## Step 4: Start Frontend

**Goal:** Run the Vite dev server for React frontend

### From Terminal (separate window)

```powershell
# From repository root
cd frontend
npm install  # First time only
npm run dev
```

**Expected Output:**
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Open Application:**
- Browser: http://localhost:5173
- You should see the KDHE Preparedness Operations Center UI

---

## Step 5: Sign In and Verify

**Goal:** Authenticate and verify lookup data loads

### Sign In
1. Click **Sign In** button in top-right corner
2. Azure AD login page opens
3. Enter your credentials
4. After redirect, your name appears in top bar

### Verify Navigation
1. Click **Dashboard** button in left nav pane → Dashboard view renders
2. Click **Incidents** button → Incidents view renders
3. Click **Facilities** button → Facilities view renders
4. Click **Alerts** button → Alert Center panel opens

### Verify Lookup Dropdowns
1. Navigate to **Incidents** view (� icon in left nav)
2. Scroll down to **Create Incident** card
3. Click **Incident Type** dropdown
   -  Should show: Public Health, Severe Weather, Hazmat, Mass Casualty, Cybersecurity, Infrastructure Failure
4. Click **Severity** dropdown
   -  Should show: Low, Moderate, High, Critical, Catastrophic

**If dropdowns are empty:**
-  Database not seeded → Re-run `Initialize-Database.ps1`
-  Backend not running → Check Step 3
-  Not authenticated → Check Step 5 (Sign In)
-  CORS issue → Check browser console (F12) for errors

---

## Step 6: Create Your First Incident

**Goal:** Verify end-to-end create workflow

### Fill Out Create Incident Form

1. **Incident Number:** `2026-001`
2. **Incident Name:** `Test Incident - System Validation`
3. **Incident Type:** Select **Public Health**
4. **Severity:** Select **Low**
5. **Initial Summary:** `Testing incident creation workflow after setup.`
6. **Planned Event:** Leave unchecked (real-world incident)

### Submit
- Click **Create Incident** button
-  Toast notification: "Incident created successfully."
-  Form fields reset
-  Incident appears in **Active Incident Board** below

---

## Step 7: Edit the Incident

**Goal:** Verify incident command pane and editing workflow

### Select Incident
1. In **Active Incident Board**, click the incident row you just created
2. **Incident Command Pane** appears below with tabs

### Verify Tabs Work
1. **Overview Tab:**
   - Edit **Incident Name** → Change to `Test Incident - Verified`
   - Click **Save Changes**
   -  Toast: "Incident metadata updated successfully."

2. **Tasks Tab:**
   - **Task Title:** `Validate task creation`
   - **Priority:** High
   - Click **Create Task**
   -  Task appears in task list

3. **Timeline Tab:**
   - **Event Type:** Operational Update
   - **Event Title:** `System validation checkpoint`
   - Click **Create Event**
   -  Event appears in timeline

4. **Periods & Objectives Tab:**
   - Click **Create Period**
   - **Period Number:** 1
   - **Period Name:** Initial Response
   -  Period created
   - Click **Create Objective**
   - **Objective Text:** `Validate operational period creation`
   -  Objective created

5. **SITREP/IAP Tab:**
   - Verify **ICS-201 Incident Briefing** card shows incident data
   - Click **Generate SITREP**
   - Fill out summary fields
   -  SITREP appears in table

---

## Step 8: Verify Data Persistence

**Goal:** Ensure data survives page refresh (not just in-memory)

### Refresh Browser
- Press **F5** or Ctrl+R to refresh page
- Sign in again if needed
- Navigate to **Incidents** view
-  Your test incident still appears in Active Incident Board
-  Click incident row → tasks, timeline, periods, objectives all persist

---

## Troubleshooting

### Backend Won't Start
**Error:** `Unable to connect to database`
-  Verify SQL Server is running: `services.msc` → find SQL Server service (MSSQLSERVER or SQL Server (SQLEXPRESS))
-  Check connection string in `appsettings.Development.json` - should be `Server=(local);Database=IOCEM;...`
-  Verify IOCEM database exists: Open SSMS, connect to (local), verify database appears in list
-  Run `Initialize-Database.ps1` to seed schema/lookup data (does NOT create database, only adds tables/data)

**Error:** `Port 7435 already in use`
-  Kill existing process: `netstat -ano | findstr 7435` then `taskkill /PID [PID] /F`
-  Or change port in `KPP_WEB.AppHost/Program.cs`

### Frontend Won't Start
**Error:** `npm: command not found`
-  Install Node.js: https://nodejs.org

**Error:** `Cannot find module ...`
-  Run `npm install` in `frontend/` directory
-  Delete `node_modules/` and `package-lock.json`, then `npm install` again

### Sign In Fails
**Error:** `MSAL configuration error`
-  Verify Azure AD `ClientId` and `TenantId` in `appsettings.json`
-  Check MSAL config in `frontend/src/authConfig.ts`
-  Ensure redirect URI matches (e.g., `http://localhost:5173`)

### Dropdowns Are Empty
**Symptom:** Incident Type dropdown shows "Select..." with no options
-  Re-run `Initialize-Database.ps1` to seed lookup data
-  Open browser DevTools (F12) → Network tab → look for `/api/v1/lookups/codesets/IncidentType`
-  Check response: should be HTTP 200 with JSON array
-  If 401/403: Sign in required
-  If 500: Backend error, check server console

### Navigation Buttons Don't Work
**Symptom:** Clicking Dashboard/Incidents/Facilities does nothing
-  This was fixed in the latest session
-  Verify you have the latest code: `git pull` or check `App.tsx` for `activeView` state
-  Rebuild frontend: `npm run build`

---

## Success Criteria Checklist

-  IOCEM database exists on (local) SQL Server with schemas and seed data
-  Backend starts without errors on https://localhost:7435
-  Frontend starts without errors on http://localhost:5173
-  Sign in works and user name displays
-  Navigation buttons switch views (Dashboard → Incidents → Facilities)
-  Incident Type and Severity dropdowns populated
-  Can create a new incident (toast success message)
-  Can edit incident metadata (Save Changes works)
-  Can create tasks, timeline events, operational periods, and objectives
-  Can generate SITREP in SITREP/IAP tab
-  Data persists after page refresh

---

## Next Steps After Setup

### Explore the Application
- Create multiple incidents with different types and severities
- Practice assigning ICS command positions (Overview tab)
- Build out operational periods and objectives
- Generate multiple SITREPs to see reporting workflow

### Review Documentation
- **Comprehensive Guide:** `KPP_WEB.AppHost/planning/Frontend_Incident_Workflow_Guide.md`
- **Session Summary:** `KPP_WEB.AppHost/planning/Session_2026-06-22_Navigation_UX_Fix_Summary.md`
- **Implementation Status:** `KPP_WEB.AppHost/planning/Implementation-Approach/03_Current_Implementation_Status_and_Next_Sprint.md`

### Plan Next Features
- Review sprint queue in `03_Current_Implementation_Status_and_Next_Sprint.md`
- Prioritize based on RFP requirements and competitive analysis
- Consider GIS/map integration (high differentiator value)

---

## Support and Resources

### Documentation Files
- `Frontend_Incident_Workflow_Guide.md` → Detailed user workflows and troubleshooting
- `Session_2026-06-22_Navigation_UX_Fix_Summary.md` → Technical implementation details
- `03_Current_Implementation_Status_and_Next_Sprint.md` → Project status and sprint plan

### Key Commands Reference
```powershell
# Database init (uses existing IOCEM database)
.\Initialize-Database.ps1

# Or with custom credentials
.\Initialize-Database.ps1 -ServerInstance "(local)" -Database "IOCEM" -Username "sa" -Password "!devapp!"

# Start backend
dotnet run --project KPP_WEB.AppHost

# Start frontend
cd frontend && npm run dev

# Build everything
dotnet build

# Frontend build only
cd frontend && npm run build

# Run smoke tests
pwsh KPP_WEB.AppHost/planning/Implementation-Approach/Run_Local_Smoke_Gate.ps1 -ApiBaseUrl https://localhost:7435
```

---

**Setup Complete! You now have a fully functional KPP Operations Center.**

For detailed incident creation/editing workflows, see:  
� **`KPP_WEB.AppHost/planning/Frontend_Incident_Workflow_Guide.md`**
