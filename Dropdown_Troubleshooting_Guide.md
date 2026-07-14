# Dropdown Not Populating - Troubleshooting Guide

**Issue:** Incident Type, Severity, and other dropdowns show no options  
**Root Cause:** API requires authentication  
**Status:**  **Database has data** |  **Frontend not authenticated**

---

## Verification Results

###  **Database Has Lookup Data**

Verified `ref.CodeValue` table contains:

**IncidentType:**
- Public Health (PublicHealth)
- Severe Weather (SevereWeather)  
- Hazmat (Hazmat)
- Mass Casualty (MassCasualty)
- Cybersecurity (Cybersecurity)
- Infrastructure Failure (InfrastructureFailure)

**Other lookup sets also populated:**
- Severity: 5 values
- IncidentStatus: 6 values
- TaskPriority: 4 values
- TaskStatus: 6 values
- TimelineEventType: 5 values

###  **Backend API is Running**

- Server: https://localhost:7435
- Process: 28776
- Status: Listening

###  **API Requires Authentication**

Test result:
```powershell
curl -k https://localhost:7435/api/v1/lookups/codesets/IncidentType
# Response: 401 Unauthorized
```

**Why?**  
Line 857 in `KPP_WEB.Server/Program.cs`:
```csharp
.RequireAuthorization(AuthorizationPolicies.LookupViewer)
```

The API endpoint requires you to be signed in with a valid Azure AD token.

---

## Solution: Sign In to the Frontend

### Step 1: Make Sure Frontend is Running

```powershell
cd frontend
npm run dev
```

**Expected:**
```
➜  Local:   http://localhost:5173/
```

### Step 2: Open Browser and Sign In

1. **Open:** http://localhost:5173
2. **Look for Sign In button** in the top-right corner (action bar area)
3. **Click Sign In**
4. **Azure AD login page** should appear
5. **Enter your credentials** (the Azure AD account configured in appsettings.Development.json)
6. **After redirect,** you should see your name in the top bar

### Step 3: Navigate to Incidents View

1. **Click Incidents button** in left navigation pane (� icon)
2. **Scroll to Create Incident card**
3. **Click Incident Type dropdown**
4. **Verify options appear:**
   - Public Health
   - Severe Weather
   - Hazmat
   - Mass Casualty
   - Cybersecurity
   - Infrastructure Failure

---

## Troubleshooting: If Sign In Fails

### Check Azure AD Configuration

**File:** `KPP_WEB.Server/appsettings.Development.json` (line 20-22)

```json
"AzureAd": {
  "Authority": "https://login.microsoftonline.com/0f2d8cd0-b8ce-4e36-81f5-b568f2bed28b/v2.0",
  "Audience": "api://7a7111a7-26d8-424c-bcc5-7ae31dae3f1f",
  "RelaxTokenValidationForDevelopment": true
}
```

**Verify:**
- TenantId: `0f2d8cd0-b8ce-4e36-81f5-b568f2bed28b`
- ClientId: `7a7111a7-26d8-424c-bcc5-7ae31dae3f1f`

**File:** `frontend/src/authConfig.ts`

Check that the frontend MSAL config matches the backend:
```typescript
export const msalConfig = {
  auth: {
	clientId: "7a7111a7-26d8-424c-bcc5-7ae31dae3f1f",
	authority: "https://login.microsoftonline.com/0f2d8cd0-b8ce-4e36-81f5-b568f2bed28b",
	redirectUri: "http://localhost:5173"
  }
};
```

### Check Frontend Console for Errors

1. **Open browser DevTools:** Press `F12`
2. **Go to Console tab**
3. **Look for errors after attempting sign-in**

**Common errors:**
- `AADSTS50011`: Redirect URI mismatch → Check Azure AD app registration
- `AADSTS700016`: Application not found → Wrong ClientId
- `AADSTS90002`: Tenant not found → Wrong TenantId

### Check Network Tab for API Calls

1. **Open DevTools:** Press `F12`
2. **Go to Network tab**
3. **Navigate to Incidents view**
4. **Filter by:** `lookups`
5. **Look for requests to:**
   - `/api/v1/lookups/codesets/IncidentType`
   - `/api/v1/lookups/codesets/Severity`
   - etc.

**Expected after sign-in:**
- Status: `200 OK`
- Response: JSON array with lookup values

**If still 401:**
- Check that Authorization header is present
- Verify token is being sent: `Authorization: Bearer eyJ0eXAi...`

---

## Alternative: Temporarily Allow Anonymous Access (Development Only)

** NOT RECOMMENDED** - This bypasses security and should only be used for local testing.

If you want to test without signing in, you can temporarily remove authentication from lookup endpoints:

### Edit `KPP_WEB.Server/Program.cs`

**Find lines 842-858:**
```csharp
lookups.MapGet("/codesets/{codeSetName}", async (string codeSetName, ILookupQueryService lookupQueryService, CancellationToken cancellationToken) =>
{
	var normalizedCodeSetName = codeSetName.Trim();
	if (string.IsNullOrWhiteSpace(normalizedCodeSetName))
	{
		return Results.ValidationProblem(new Dictionary<string, string[]>
		{
			["codeSetName"] = ["codeSetName is required."]
		});
	}

	var result = await lookupQueryService.GetLookupValuesAsync(normalizedCodeSetName, cancellationToken);
	return Results.Ok(result);
})
.CacheOutput(p => p.Expire(TimeSpan.FromMinutes(5)))
.RequireAuthorization(AuthorizationPolicies.LookupViewer)  // ← COMMENT THIS OUT
.WithName("GetLookupValuesByCodeSet");
```

**Change to:**
```csharp
.CacheOutput(p => p.Expire(TimeSpan.FromMinutes(5)))
// .RequireAuthorization(AuthorizationPolicies.LookupViewer)  // Temporarily disabled for dev
.WithName("GetLookupValuesByCodeSet");
```

**Do the same for line 866 (locations endpoint).**

**Then restart backend:**
```powershell
# Stop current backend (Ctrl+C in terminal)
dotnet run --project KPP_WEB.AppHost
```

** Remember to re-enable authentication before committing code!**

---

## Expected Frontend Behavior

### Before Sign In:
- Dropdowns show: "Select..." with no options
- No error messages (authentication errors are suppressed)
- Console may show: Network requests with 401 status

### After Sign In:
- Dropdowns populate with lookup values
- API calls return 200 OK
- User name appears in top bar
- Can create/edit incidents

---

## Quick Test Command

Once signed in, test the API from browser console:

```javascript
// Open browser console (F12) on http://localhost:5173
fetch('/api/v1/lookups/codesets/IncidentType')
  .then(r => r.json())
  .then(data => console.log('IncidentType lookups:', data))
  .catch(err => console.error('Error:', err));
```

**Expected result:**
```javascript
IncidentType lookups: [
  {code: "PublicHealth", displayName: "Public Health", sortOrder: 10, isActive: true, ...},
  {code: "SevereWeather", displayName: "Severe Weather", sortOrder: 20, isActive: true, ...},
  ...
]
```

---

## Summary

**Problem:** Dropdowns empty  
**Root Cause:** API requires authentication, frontend not signed in  
**Database:**  Has correct data  
**Backend:**  Running and responding  
**Solution:** **Sign in to the frontend application**

**Next Steps:**
1. Start frontend: `cd frontend && npm run dev`
2. Open http://localhost:5173
3. Click **Sign In** in top-right
4. After successful login, dropdowns will populate

**If sign-in still doesn't work**, check Azure AD configuration in `appsettings.Development.json` and `frontend/src/authConfig.ts`.
