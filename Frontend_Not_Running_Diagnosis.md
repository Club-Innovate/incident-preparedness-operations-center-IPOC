# Frontend Not Running - Diagnosis

## Problem
After signing in, no dropdown data or dashboard/incident sections render, despite:
-  Backend database (IOCEM) contains lookup and sample data
-  Backend service (port 7435) is running
-  **Frontend (port 5280) is NOT running**

## Root Cause
The Aspire orchestrator (dcp.exe, process 28776) is running on port 7435, but the frontend Vite dev server is not running on port 5280.

When you try to access the application in the browser, the frontend cannot make API calls because:
1. The frontend dev server isn't serving the React app
2. The browser cannot load the JavaScript that makes API calls
3. No authenticated requests reach the backend

## Validation Steps Completed

### 1. Database Schema 
```sql
-- ref.CodeSet columns match
CodeSetId, CodeSetName, Description, IsSystem

-- ref.CodeValue columns match
CodeValueId, CodeSetId, Code, DisplayName, SortOrder, IsActive, Description

-- ic.Incident columns match
IncidentId, IncidentNumber, IncidentName, IncidentTypeCode, IncidentStatusCode, SeverityCode...
```

### 2. Data Exists 
```
Lookup Data:
- IncidentType: 6 rows (Public Health, Severe Weather, Hazmat, etc.)
- Severity: rows exist
- IncidentStatus: rows exist
- TaskPriority: rows exist
- TaskStatus: rows exist
- TimelineEventType: rows exist

Sample Data:
- Incidents: 10 rows
- Tasks: 10 rows
- Timeline Events: 10 rows
```

### 3. Backend SQL Queries 
The backend `IncidentQueryService` and `LookupQueryService` use correct SQL:
- Schema: `ic` (not `inc`) 
- Table names: `ic.Incident`, `ref.CodeSet`, `ref.CodeValue` 
- Column names: match database exactly 

### 4. API Protection 
Backend endpoints correctly require authentication:
- Lookup endpoints: `.RequireAuthorization(AuthorizationPolicies.LookupViewer)`
- Incident endpoints: `.RequireAuthorization(AuthorizationPolicies.IncidentViewer)`
- Anonymous calls return 401 Unauthorized (expected)

## Solution

### Start the Application Properly

#### Option 1: Visual Studio
1. Open `KPP_WEB.slnx` in Visual Studio
2. Set `KPP_WEB.AppHost` as the startup project
3. Press F5 or click the "Start" button
4. Wait for both backend and frontend to appear in the Aspire dashboard

#### Option 2: Command Line
```powershell
# From D:\Projects\KPP_WEB\

# Terminal 1: Start AppHost (orchestrator)
dotnet run --project KPP_WEB.AppHost

# Wait for "Now listening on: https://localhost:22283" in the Aspire dashboard output
# The dashboard will show resource status for 'frontend' and 'apiservice'

# Frontend should auto-start via Aspire orchestration
# If it doesn't, check the Aspire dashboard logs for frontend startup errors
```

#### Option 3: Manual Frontend Start (if Aspire fails)
```powershell
# From D:\Projects\KPP_WEB\frontend\
npm run dev
```

### Expected Behavior After Startup
1. **Aspire Dashboard**: https://localhost:22283 (or similar)
   - Shows `frontend` resource: Running
   - Shows `apiservice` resource: Running

2. **Frontend**: http://localhost:5280
   - React app loads
   - Navigation pane visible
   - Login prompt appears

3. **Backend**: https://localhost:7435
   - API endpoints respond
   - Swagger UI available at /swagger

### After Sign-In
Once you sign in with valid credentials:
1. Dropdowns will populate with lookup data
2. Dashboard will show incident summaries
3. Incident workspace will render active incidents and details

## Why This Wasn't Obvious
The error appeared to be a data/schema issue because:
- The backend was running and responding with 401 (correct behavior)
- The database contained data (correct state)
- The schema matched the code (correct design)

But the frontend wasn't running at all, so the browser never loaded the React app that would make authenticated API calls after sign-in.

## Next Steps
1. Stop any stray processes:
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -eq 'dcp'} | Stop-Process -Force
   ```

2. Start the application via Visual Studio or `dotnet run --project KPP_WEB.AppHost`

3. Verify frontend is running at http://localhost:5280

4. Sign in and verify dropdowns/sections populate

If the frontend still doesn't start, check:
- Aspire dashboard logs for frontend resource
- `frontend/package.json` scripts
- Node.js/npm installation
