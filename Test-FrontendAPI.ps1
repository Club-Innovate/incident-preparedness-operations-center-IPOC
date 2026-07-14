#!/usr/bin/env pwsh

<#
.SYNOPSIS
	Test the frontend API flow by simulating what the browser does.
#>

param(
	[string]$BackendUrl = "https://localhost:7435"
)

Write-Host "`n=== Testing Frontend API Calls ===" -ForegroundColor Cyan
Write-Host "Backend URL: $BackendUrl`n" -ForegroundColor White

# Disable certificate validation for local development
add-type @"
	using System.Net;
	using System.Security.Cryptography.X509Certificates;
	public class TrustAllCertsPolicy : ICertificatePolicy {
		public bool CheckValidationResult(
			ServicePoint svcPoint, X509Certificate certificate,
			WebRequest webRequest, int certificateProblem) {
			return true;
		}
	}
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

Write-Host "1. Testing Lookup API (IncidentType) - Unauthenticated" -ForegroundColor Yellow
try {
	$response = Invoke-WebRequest -Uri "$BackendUrl/api/v1/lookups/codesets/IncidentType" -Method GET -ErrorAction Stop
	Write-Host "   SUCCESS: Status $($response.StatusCode)" -ForegroundColor Green
	$content = $response.Content | ConvertFrom-Json
	Write-Host "   Response: $($content | ConvertTo-Json -Depth 2)" -ForegroundColor White
} catch {
	Write-Host "   EXPECTED FAILURE: $($_.Exception.Message)" -ForegroundColor Magenta
	Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Magenta
}

Write-Host "`n2. Testing Incidents API - Unauthenticated" -ForegroundColor Yellow
try {
	$response = Invoke-WebRequest -Uri "$BackendUrl/api/v1/incidents" -Method GET -ErrorAction Stop
	Write-Host "   SUCCESS: Status $($response.StatusCode)" -ForegroundColor Green
	$content = $response.Content | ConvertFrom-Json
	Write-Host "   Incident Count: $($content.Length)" -ForegroundColor White
} catch {
	Write-Host "   EXPECTED FAILURE: $($_.Exception.Message)" -ForegroundColor Magenta
	Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Magenta
}

Write-Host "`n3. Checking Frontend Server" -ForegroundColor Yellow
try {
	$response = Invoke-WebRequest -Uri "http://localhost:5280/" -Method GET -ErrorAction Stop
	Write-Host "   SUCCESS: Frontend is running on http://localhost:5280" -ForegroundColor Green
	Write-Host "   Status: $($response.StatusCode)" -ForegroundColor White
} catch {
	Write-Host "   FAILURE: Frontend is NOT running" -ForegroundColor Red
	Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "  1. Sign in to the application via the browser" -ForegroundColor White
Write-Host "  2. Open browser DevTools (F12) -> Network tab" -ForegroundColor White
Write-Host "  3. Check if API calls to /api/v1/lookups are returning 200 OK" -ForegroundColor White
Write-Host "  4. Check the Response preview to see if data is coming back" -ForegroundColor White
Write-Host "  5. Check Console tab for any JavaScript errors`n" -ForegroundColor White
