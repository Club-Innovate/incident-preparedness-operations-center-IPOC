# Azure AD Authentication Setup & Troubleshooting

## Current Status: Token Acquisition Failing 

### Error
```
Token acquisition failed. Object
```

This error occurs because MSAL cannot acquire tokens from Azure AD, likely due to:
1. The Azure AD app registration is missing or misconfigured
2. Redirect URIs are not registered in Azure Portal
3. API permissions are not granted
4. The app is not available in your development tenant

## Configuration Summary

### Frontend (`.env.development`)
```env
VITE_AZURE_TENANT_ID=0f2d8cd0-b8ce-4e36-81f5-b568f2bed28b
VITE_AZURE_CLIENT_ID=7a7111a7-26d8-424c-bcc5-7ae31dae3f1f
VITE_API_SCOPE=api://7a7111a7-26d8-424c-bcc5-7ae31dae3f1f/access_as_user
```

### Backend (`appsettings.Development.json`)
```json
"AzureAd": {
  "Authority": "https://login.microsoftonline.com/0f2d8cd0-b8ce-4e36-81f5-b568f2bed28b/v2.0",
  "Audience": "api://7a7111a7-26d8-424c-bcc5-7ae31dae3f1f",
  "RelaxTokenValidationForDevelopment": true
}
```

## Solution Options

### Option 1: Fix Azure AD Registration (Production-Ready)

#### Required Steps in Azure Portal

1. **Navigate to Azure AD App Registration**
   - Go to https://portal.azure.com
   - Azure Active Directory → App registrations
   - Find app with Client ID: `7a7111a7-26d8-424c-bcc5-7ae31dae3f1f`

2. **Add Redirect URIs**
   - Go to "Authentication" blade
   - Add the following Redirect URIs:
	 - `http://localhost:5280`
	 - `https://localhost:5280`
   - Platform: Single-page application (SPA)

3. **Configure API Permissions**
   - Go to "API permissions" blade
   - Ensure the following are granted:
	 - `access_as_user` (delegated)
	 - `User.Read` (Microsoft Graph)
   - Click "Grant admin consent"

4. **Expose an API**
   - Go to "Expose an API" blade
   - Application ID URI should be: `api://7a7111a7-26d8-424c-bcc5-7ae31dae3f1f`
   - Add scope: `access_as_user`
	 - Who can consent: Admins and users
	 - Admin consent display name: Access KPP IOC/EM API
	 - Admin consent description: Allows the app to access the IOC/EM API on behalf of the signed-in user

5. **Check Token Configuration** (Optional)
   - Go to "Token configuration" blade
   - Add optional claims if needed (e.g., `email`, `groups`)

#### Test Authentication
After completing the above, restart the frontend:
```powershell
cd D:\Projects\KPP_WEB\frontend
npm run dev
```

Refresh the browser and try signing in again.

---

### Option 2: Bypass Authentication for Local Development (Quick Fix)

** WARNING: This is for local development ONLY. Do NOT deploy this to production.**

This option allows you to test the application functionality without Azure AD authentication.

#### Step 1: Create Development User Context Middleware

Create `KPP_WEB.Server/Infrastructure/Security/DevelopmentUserMiddleware.cs`:

```csharp
using System.Security.Claims;

namespace KPP_WEB.Server.Infrastructure.Security;

public class DevelopmentUserMiddleware
{
	private readonly RequestDelegate _next;
	private readonly ILogger<DevelopmentUserMiddleware> _logger;

	public DevelopmentUserMiddleware(RequestDelegate next, ILogger<DevelopmentUserMiddleware> logger)
	{
		_next = next;
		_logger = logger;
	}

	public async Task InvokeAsync(HttpContext context)
	{
		if (!context.User.Identity?.IsAuthenticated ?? true)
		{
			var claims = new List<Claim>
			{
				new(ClaimTypes.NameIdentifier, "dev-user-12345"),
				new(ClaimTypes.Name, "Development User"),
				new(ClaimTypes.Email, "dev@localhost"),
				new("roles", "IncidentViewer"),
				new("roles", "IncidentContributor"),
				new("roles", "LookupViewer"),
			};

			var identity = new ClaimsIdentity(claims, "DevelopmentBypass");
			context.User = new ClaimsPrincipal(identity);

			_logger.LogWarning("Development user context injected for unauthenticated request to {Path}", context.Request.Path);
		}

		await _next(context);
	}
}
```

#### Step 2: Enable Middleware in Development

Add to `KPP_WEB.Server/Program.cs` (after authentication middleware):

```csharp
// AFTER: app.UseAuthentication();
// AFTER: app.UseAuthorization();

if (builder.Environment.IsDevelopment())
{
	app.UseMiddleware<DevelopmentUserMiddleware>();
}
```

#### Step 3: Disable MSAL in Frontend

Update `frontend/src/App.tsx` to skip MSAL initialization in development:

```typescript
// At the top of App.tsx
const BYPASS_AUTH = import.meta.env.DEV; // true in development mode

// Wrap MsalProvider conditionally
function App() {
  if (BYPASS_AUTH) {
	return <AppContent />;
  }

  return (
	<MsalProvider instance={msalInstance}>
	  <AppContent />
	</MsalProvider>
  );
}

function AppContent() {
  // ... existing app content
}
```

Update `frontend/src/hooks/useAuth.ts` to return mock auth in development:

```typescript
if (import.meta.env.DEV) {
  return {
	isAuthenticated: true,
	user: { name: 'Dev User', email: 'dev@localhost' },
	login: async () => {},
	logout: async () => {},
  };
}
```

---

### Option 3: Use a Different Tenant

If the current Azure AD app is not available in your development environment, create a new one:

1. Go to https://portal.azure.com
2. Azure Active Directory → App registrations → New registration
3. Name: `KPP IOC/EM Local Dev`
4. Supported account types: Single tenant
5. Redirect URI:
   - Platform: Single-page application
   - URI: `http://localhost:5280`
6. Register

After registration:
- Copy the **Application (client) ID**
- Copy the **Directory (tenant) ID**
- Update `frontend/.env.development` with the new values
- Update `KPP_WEB.Server/appsettings.Development.json` with the new values

---

## Recommended Approach

For **immediate development work**:
- Use **Option 2 (Bypass Authentication)** to test application functionality now
- This lets you verify dropdowns, dashboard, incident workspace work correctly

For **production deployment**:
- Use **Option 1 (Fix Azure AD Registration)** before deploying
- Ensure proper RBAC and authentication in place

---

## Verify Authentication is Working

### Check Browser Console
After applying a fix, check the browser console:
-  No "Token acquisition failed" errors
-  Network tab shows API calls return 200 OK (not 401)

### Check Backend Logs
```powershell
# If running via Visual Studio, check Output window
# If running via dotnet run, check terminal output
```

Look for:
- `Retrieved X lookup values for code set IncidentType`
- `Retrieved X incidents from database`

### Check Application Behavior
-  Dropdowns populate with data (Incident Type, Severity, etc.)
-  Dashboard shows incident count and summaries
-  Incident workspace renders tasks, timeline, objectives

---

## Next Steps

1. Choose one of the three options above
2. Apply the changes
3. Restart frontend and backend
4. Test sign-in and data rendering
5. Report back with results

If you choose Option 2 (bypass), I can implement it for you immediately.
