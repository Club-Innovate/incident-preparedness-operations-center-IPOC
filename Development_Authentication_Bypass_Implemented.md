# Authentication Bypass Implementation - Development Mode

## Status:  IMPLEMENTED

### Problem Solved
**Console Error:** `Token acquisition failed. Object`

**Root Cause:** MSAL cannot acquire Azure AD tokens because:
- The Azure AD app registration is either missing or not properly configured in your development environment
- Redirect URIs are not registered for `http://localhost:5280`
- API permissions may not be granted

### Solution Applied: Development Authentication Bypass

I've implemented a **development-only** authentication bypass that allows you to test the application without needing Azure AD configured.

 **WARNING: This bypass is ONLY active in Development mode and will NOT work in production.**

---

## Changes Made

### 1. Frontend: Mock MSAL Account (`frontend/src/App.tsx`)

**What it does:**
- When running in development mode (`import.meta.env.DEV`) and MSAL has no authenticated accounts, the app injects a mock account
- This bypasses the "Token acquisition failed" error
- The app now treats you as authenticated: `isAuthenticated = true`

**Code added:**
```typescript
// DEV BYPASS: Mock authenticated account when MSAL token acquisition fails
const effectiveAccounts = import.meta.env.DEV && accounts.length === 0
  ? [{
	  homeAccountId: 'dev-bypass',
	  localAccountId: 'dev-user-12345',
	  environment: 'local',
	  tenantId: 'dev-tenant',
	  username: 'dev@localhost',
	  name: 'Development User',
	}] as typeof accounts
  : accounts;
```

**Result:**
- Top bar shows: "Development User" instead of "Guest"
- Frontend makes API calls as if authenticated

---

### 2. Backend: Development User Middleware (`KPP_WEB.Server/Infrastructure/Security/DevelopmentUserMiddleware.cs`)

**What it does:**
- Intercepts incoming API requests **before** authorization checks
- If no valid JWT token is present, injects a mock `ClaimsPrincipal` with all required roles:
  - `IncidentViewer`
  - `IncidentContributor`
  - `LookupViewer`
  - `ResourceViewer`
  - `SystemAdmin`
- API endpoints no longer return `401 Unauthorized`

**Registered in `Program.cs`:**
```csharp
// DEV BYPASS: Inject mock authenticated user when no valid JWT token is present
if (builder.Environment.IsDevelopment())
{
	app.UseMiddleware<DevelopmentUserMiddleware>();
}
```

**Security safeguards:**
- Middleware constructor checks `IsDevelopment()` and logs a warning if enabled
- Logs every request where bypass is applied
- **Will not run in production** (environment check is enforced)

---

## Expected Behavior After Restart

### 1. Stop Current Processes
```powershell
# Stop any running processes
Get-Process | Where-Object {$_.ProcessName -eq 'dcp'} | Stop-Process -Force
Get-Process | Where-Object {$_.ProcessName -like '*node*'} | Stop-Process -Force
```

### 2. Restart the Application
**Via Visual Studio:**
1. Set `KPP_WEB.AppHost` as startup project
2. Press F5

**Via Command Line:**
```powershell
cd D:\Projects\KPP_WEB
dotnet run --project KPP_WEB.AppHost
```

### 3. Open the Frontend
Navigate to: http://localhost:5280

### 4. Expected Results 

#### Console
-  **No** "Token acquisition failed" errors
-  **No** MSAL errors

#### Top Bar
-  Shows "Development User" (not "Guest")

#### Dropdowns
-  Incident Type dropdown shows: Public Health, Severe Weather, Hazmat, Mass Casualty, Cybersecurity, Infrastructure Failure
-  Severity dropdown populates
-  Task Priority dropdown populates
-  All other lookup dropdowns populate

#### Dashboard
-  Shows incident count (10 sample incidents)
-  Incident summaries render in the Active Incident Board

#### Incident Workspace
-  Selecting an incident loads its details
-  Tasks tab shows tasks
-  Timeline tab shows timeline events
-  Periods & Objectives tab shows data
-  SITREP/IAP tab renders

#### Network Tab (F12 → Network)
-  `/api/v1/lookups/codesets/IncidentType` returns **200 OK** (not 401)
-  `/api/v1/incidents` returns **200 OK**
-  All API calls return data

---

## How to Verify It's Working

### Browser DevTools Check
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Refresh the page
4.  No "Token acquisition failed" errors

### Network Check
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Filter by "XHR" or "Fetch"
4. Look for calls to `/api/v1/lookups/` and `/api/v1/incidents`
5.  All should return **200 OK**
6. Click on a request → **Preview** tab → Should show actual data

### Backend Logs Check
```powershell
# If running via dotnet run, check terminal output
# Should see:
# - "  Development User Bypass Middleware is ENABLED..."
# - "Development user context injected for request to /api/v1/..."
# - "Retrieved X lookup values for code set IncidentType"
# - "Retrieved X incidents from database"
```

---

## Production Deployment

### Before Deploying to Production:

1. **Remove or disable the bypass** (or ensure it's environment-gated)
2. **Configure proper Azure AD authentication:**
   - Register the app in Azure Portal
   - Configure redirect URIs
   - Grant API permissions
   - Update `appsettings.Production.json` with correct tenant/client/audience

3. **Verify the middleware does NOT run:**
   ```csharp
   if (builder.Environment.IsDevelopment()) // ← This MUST be present
   {
	   app.UseMiddleware<DevelopmentUserMiddleware>();
   }
   ```

---

## Files Modified

1.  `frontend/src/App.tsx` - Mock MSAL account injection
2.  `KPP_WEB.Server/Infrastructure/Security/DevelopmentUserMiddleware.cs` - Created
3.  `KPP_WEB.Server/Program.cs` - Registered middleware in development mode

---

## Next Steps

1. **Restart the application** (stop all processes, then F5 in Visual Studio or `dotnet run`)
2. **Open the browser** to http://localhost:5280
3. **Verify:**
   - No console errors
   - Dropdowns populate
   - Dashboard shows incidents
   - Incident workspace renders data

4. **Report back** with:
   -  Does the top bar show "Development User"?
   -  Do dropdowns populate?
   -  Does the dashboard show 10 incidents?
   -  Does the Incident page render tasks/timeline/etc.?

If any of these still fail, check the browser console and backend logs for specific errors.
