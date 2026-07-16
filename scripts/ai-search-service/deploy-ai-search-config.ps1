<#
File: scripts/ai-search-service/deploy-ai-search-config.ps1
Blueprint Name:  Deploy-AzureAI-SearchConfig

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-16

.SYNOPSIS
Deploys exported Azure AI Search configuration assets into a target search service.

.DESCRIPTION
Reads JSON assets from the local SearchConfigExport folder and deploys them to a target
Azure AI Search service in dependency order (Data Sources -> Skillsets -> Indexes -> Indexers).
Intended for controlled environment migration and configuration bootstrap workflows.

.NOTES
- Update target service values before execution.
- This script is intended for operational migration tasks and should be executed by authorized operators only.
#>

$targetSearchServiceName = "your-new-search-service-name"
$targetAdminKey          = "YOUR_NEW_SERVICE_ADMIN_KEY"
$apiVersion              = "2023-11-01" # Make sure this matches the API version you used to export
$exportFolder            = ".\SearchConfigExport"

$headers = @{
    "Content-Type" = "application/json"
    "api-key"      = $targetAdminKey
}

$baseUrl = "https://$targetSearchServiceName.search.windows.net"

# Helper function to deploy API objects
function Deploy-SearchObjects ($folderName, $endpoint) {
    $folderPath = Join-Path $exportFolder $folderName
    if (Test-Path $folderPath) {
        $files = Get-ChildItem -Path $folderPath -Filter "*.json"
        foreach ($file in $files) {
            Write-Host "Deploying $folderName : $($file.BaseName)" -ForegroundColor Cyan
            $jsonContent = Get-Content $file.FullName -Raw
            $url = "$baseUrl/$endpoint`?api-version=$apiVersion"
            
            try {
                Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $jsonContent
                Write-Host "Successfully deployed $($file.BaseName)" -ForegroundColor Green
            } catch {
                Write-Host "Failed to deploy $($file.BaseName). Error: $_" -ForegroundColor Red
            }
        }
    }
}

# 1. Deploy Data Sources
Deploy-SearchObjects -folderName "DataSources" -endpoint "datasources"

# 2. Deploy Skillsets
Deploy-SearchObjects -folderName "Skillsets" -endpoint "skillsets"

# 3. Deploy Indexes
Deploy-SearchObjects -folderName "Indexes" -endpoint "indexes"

# 4. Deploy Indexers
Deploy-SearchObjects -folderName "Indexers" -endpoint "indexers"