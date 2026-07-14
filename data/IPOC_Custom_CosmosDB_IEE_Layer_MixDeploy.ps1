<#
Author: Hans Esquivel
Created: 20260620

.SYNOPSIS
  KDHE Custom IOC for EM - Cosmos DB IEE Layer Mixed Deployment Script

.DESCRIPTION
  Deploys the Cosmos DB for NoSQL layer to either:
    - Azure subscription using Azure CLI
    - Local Azure Cosmos DB Emulator using Microsoft.Azure.Cosmos SDK via a generated .NET deployer

  Fix included:
    - Replaces the invalid SDK call Scripts.UpsertStoredProcedureAsync with a production-safe
      Create-or-Replace stored procedure implementation using ReadStoredProcedureAsync,
      ReplaceStoredProcedureAsync, and CreateStoredProcedureAsync.

.EXAMPLE
  Local Emulator:
    .\IPOC_CosmosDB_IEE_Layer_MixDeploy_Fixed.ps1 -DeploymentTarget Emulator -DatabaseName "kdhe-ioc-flexdata-local"

.EXAMPLE
  Azure:
    .\IPOC_CosmosDB_IEE_Layer_MixDeploy_Fixed.ps1 -DeploymentTarget Azure `
      -SubscriptionId "<subscription-id>" `
      -ResourceGroupName "rg-kdhe-preparedness-prod" `
      -Location "eastus2" `
      -CosmosAccountName "cos-kdhe-ioc-prod" `
      -DatabaseName "kdhe-ioc-flexdata-prod"
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("Azure","Emulator")]
  [string]$DeploymentTarget,

  [string]$SubscriptionId = "",
  [string]$ResourceGroupName = "",
  [string]$Location = "eastus2",
  [ValidatePattern('^[a-z0-9-]{3,44}$')]
  [string]$CosmosAccountName = "cos-kdhe-ioc-local",
  [string]$DatabaseName = "kdhe-ioc-flexdata",
  [ValidateSet("dev","test","stage","prod","dr","local")]
  [string]$EnvironmentCode = "prod",

  [int]$DatabaseAutoscaleMaxRu = 4000,
  [int]$HighVolumeAutoscaleMaxRu = 10000,
  [bool]$EnableAnalyticalStore = $true,
  [bool]$DisablePublicNetworkAccess = $true,

  [string]$PrimaryRegion = "",
  [string]$SecondaryRegion = "",

  [string]$ApplicationPrincipalId = "",
  [string]$ReadOnlyPrincipalId = "",
  [string]$DataContributorPrincipalId = "",

  [string]$EmulatorEndpoint = "https://localhost:8081/",
  [string]$EmulatorKey = "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
  [bool]$EmulatorAllowSelfSignedCertificate = $true,
  [bool]$RecreateEmulatorDatabase = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:AuditLogPath = Join-Path $PSScriptRoot ("IPOC_CosmosDB_IEE_Layer_MixDeploy_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".log")

function Write-Audit([string]$message, [ValidateSet("INFO","WARN","ERROR")][string]$level = "INFO") {
  $timestamp = (Get-Date).ToUniversalTime().ToString("o")
  $line = "[$timestamp][$level] $message"
  Add-Content -Path $script:AuditLogPath -Value $line -Encoding UTF8
  switch ($level) {
    "WARN" { Write-Warning $message }
    "ERROR" { Write-Error $message }
    default { Write-Host $message }
  }
}

function Write-Section([string]$m) {
  Write-Host ""
  Write-Host "================================================================================" -ForegroundColor Cyan
  Write-Host $m -ForegroundColor Cyan
  Write-Host "================================================================================" -ForegroundColor Cyan
}

function Ensure-Dir([string]$p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

function Write-Json([string]$path, [object]$obj) {
  $obj | ConvertTo-Json -Depth 80 | Set-Content -Path $path -Encoding UTF8
}

function Az([string]$cmd, [switch]$Json) {
  Write-Host "az $cmd" -ForegroundColor DarkGray
  $r = Invoke-Expression "az $cmd"
  if ($LASTEXITCODE -ne 0) { throw "Azure CLI failed: az $cmd" }
  if ($Json) {
    if ([string]::IsNullOrWhiteSpace(($r | Out-String))) { return $null }
    return $r | ConvertFrom-Json
  }
  return $r
}

function Need-Cmd([string]$cmd) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Required command not found: $cmd" }
}

if ($DeploymentTarget -eq "Azure") {
  Need-Cmd "az"
  if ([string]::IsNullOrWhiteSpace($SubscriptionId)) { throw "SubscriptionId is required for Azure." }
  if ([string]::IsNullOrWhiteSpace($ResourceGroupName)) { throw "ResourceGroupName is required for Azure." }
  if ($PrimaryRegion -eq "") { $PrimaryRegion = $Location }
} else {
  Need-Cmd "dotnet"
  $EnvironmentCode = "local"
  $EnableAnalyticalStore = $false
  $DisablePublicNetworkAccess = $false
}

$root = Join-Path $PSScriptRoot "cosmosdb-generated"
$policyDir = Join-Path $root "policies"
$sprocDir = Join-Path $root "sprocs"
$manifestPath = Join-Path $root "deployment-manifest.json"
Ensure-Dir $root; Ensure-Dir $policyDir; Ensure-Dir $sprocDir

if ($DeploymentTarget -eq "Emulator") {
  $EmulatorKey = $EmulatorKey.Trim()
  try {
    [Convert]::FromBase64String($EmulatorKey) | Out-Null
  }
  catch {
    throw "The EmulatorKey value is not valid Base64. Use the current Microsoft Cosmos DB Emulator key or pass -EmulatorKey explicitly."
  }
}

Write-Section "Generating Cosmos DB policies and deployment manifest"
# Notes:
# - Do not explicitly include /id/? in custom indexing policies. Cosmos DB treats id as a system property.
# - Use /tags/* for array indexing. The emulator rejects /tags/[].

$defaultPolicy = @{
  indexingMode="consistent"; automatic=$true
  includedPaths=@(@{path="/*"})
  excludedPaths=@(@{path="/payload/*"},@{path="/rawPayload/*"},@{path="/attachments/*"},@{path="/_etag/?"})
  compositeIndexes=@(
    @(@{path="/tenantId";order="ascending"},@{path="/incidentId";order="ascending"},@{path="/updatedUtc";order="descending"}),
    @(@{path="/tenantId";order="ascending"},@{path="/locationId";order="ascending"},@{path="/reportedUtc";order="descending"})
  )
}

$eeiPolicy = @{
  indexingMode="consistent"; automatic=$true
  includedPaths=@(
    @{path="/tenantId/?"},@{path="/pk/?"},@{path="/incidentId/?"},
    @{path="/promptId/?"},@{path="/promptTargetId/?"},@{path="/locationId/?"},
    @{path="/organizationId/?"},@{path="/regionId/?"},@{path="/responseStatusCode/?"},
    @{path="/submittedUtc/?"},@{path="/schemaVersion/?"},@{path="/tags/*"},@{path="/search/*"}
  )
  excludedPaths=@(@{path="/*"},@{path="/payload/*"},@{path="/rawPayload/*"},@{path="/_etag/?"})
  compositeIndexes=@(
    @(@{path="/tenantId";order="ascending"},@{path="/incidentId";order="ascending"},@{path="/promptId";order="ascending"},@{path="/submittedUtc";order="descending"}),
    @(@{path="/tenantId";order="ascending"},@{path="/locationId";order="ascending"},@{path="/submittedUtc";order="descending"})
  )
}

$eventPolicy = @{
  indexingMode="consistent"; automatic=$true
  includedPaths=@(
    @{path="/tenantId/?"},@{path="/pk/?"},@{path="/incidentId/?"},
    @{path="/locationId/?"},@{path="/eventTypeCode/?"},@{path="/eventUtc/?"},
    @{path="/severityCode/?"},@{path="/sourceSystemCode/?"},@{path="/createdByUserId/?"},
    @{path="/correlationId/?"}
  )
  excludedPaths=@(@{path="/*"},@{path="/payload/*"},@{path="/rawPayload/*"},@{path="/_etag/?"})
  compositeIndexes=@(
    @(@{path="/tenantId";order="ascending"},@{path="/incidentId";order="ascending"},@{path="/eventUtc";order="descending"}),
    @(@{path="/tenantId";order="ascending"},@{path="/locationId";order="ascending"},@{path="/eventUtc";order="descending"})
  )
}

$projectionPolicy = @{
  indexingMode="consistent"; automatic=$true
  includedPaths=@(@{path="/*"})
  excludedPaths=@(@{path="/sourcePayload/*"},@{path="/debug/*"},@{path="/_etag/?"})
  compositeIndexes=@(
    @(@{path="/tenantId";order="ascending"},@{path="/scopeType";order="ascending"},@{path="/scopeId";order="ascending"},@{path="/updatedUtc";order="descending"})
  )
}

$integrationPolicy = @{
  indexingMode="consistent"; automatic=$true
  includedPaths=@(
    @{path="/tenantId/?"},@{path="/pk/?"},@{path="/sourceSystemCode/?"},
    @{path="/interfaceTypeCode/?"},@{path="/sourceMessageId/?"},@{path="/processingStatusCode/?"},
    @{path="/receivedUtc/?"},@{path="/relatedIncidentId/?"},@{path="/relatedLocationId/?"},@{path="/correlationId/?"}
  )
  excludedPaths=@(@{path="/*"},@{path="/rawPayload/*"},@{path="/payload/*"},@{path="/_etag/?"})
  compositeIndexes=@(
    @(@{path="/tenantId";order="ascending"},@{path="/sourceSystemCode";order="ascending"},@{path="/receivedUtc";order="descending"}),
    @(@{path="/tenantId";order="ascending"},@{path="/processingStatusCode";order="ascending"},@{path="/receivedUtc";order="descending"})
  )
}

$ukResponse = @{ uniqueKeys=@(@{paths=@("/tenantId","/promptTargetId","/responseVersion")}) }
$ukTemplate = @{ uniqueKeys=@(@{paths=@("/tenantId","/templateCode","/versionNumber")}) }
$ukView = @{ uniqueKeys=@(@{paths=@("/tenantId","/viewName","/scopeType","/scopeId")}) }

$files = @{
  default = Join-Path $policyDir "default-indexing-policy.json"
  eei = Join-Path $policyDir "eei-response-indexing-policy.json"
  event = Join-Path $policyDir "operational-event-indexing-policy.json"
  projection = Join-Path $policyDir "projection-indexing-policy.json"
  integration = Join-Path $policyDir "integration-indexing-policy.json"
  ukResponse = Join-Path $policyDir "unique-eei-response.json"
  ukTemplate = Join-Path $policyDir "unique-eei-template.json"
  ukView = Join-Path $policyDir "unique-view-projection.json"
}
Write-Json $files.default $defaultPolicy
Write-Json $files.eei $eeiPolicy
Write-Json $files.event $eventPolicy
Write-Json $files.projection $projectionPolicy
Write-Json $files.integration $integrationPolicy
Write-Json $files.ukResponse $ukResponse
Write-Json $files.ukTemplate $ukTemplate
Write-Json $files.ukView $ukView

$sprocs = @{
  upsertVersionedResponse = Join-Path $sprocDir "upsertVersionedResponse.js"
  appendOperationalEvent = Join-Path $sprocDir "appendOperationalEvent.js"
  replaceProjection = Join-Path $sprocDir "replaceProjection.js"
  recordIntegrationPayload = Join-Path $sprocDir "recordIntegrationPayload.js"
}

@'
function upsertVersionedResponse(doc) {
  var c = getContext().getCollection(), r = getContext().getResponse();
  if (!doc) throw new Error("Document is required.");
  ["id","pk","tenantId","promptTargetId","responseVersion","responseStatusCode","submittedUtc"].forEach(function(k){ if(!doc[k]) throw new Error("Missing required field: "+k); });
  doc.documentType = doc.documentType || "EEI_RESPONSE";
  doc.createdUtc = doc.createdUtc || new Date().toISOString();
  doc.updatedUtc = new Date().toISOString();
  if (!c.upsertDocument(c.getSelfLink(), doc, function(e,d){ if(e) throw e; r.setBody(d); })) throw new Error("Request not accepted.");
}
'@ | Set-Content $sprocs.upsertVersionedResponse -Encoding UTF8

@'
function appendOperationalEvent(doc) {
  var c = getContext().getCollection(), r = getContext().getResponse();
  if (!doc) throw new Error("Event document is required.");
  ["id","pk","tenantId","eventTypeCode","eventUtc","correlationId"].forEach(function(k){ if(!doc[k]) throw new Error("Missing required field: "+k); });
  doc.documentType = doc.documentType || "OPERATIONAL_EVENT";
  doc.createdUtc = doc.createdUtc || new Date().toISOString();
  if (!c.createDocument(c.getSelfLink(), doc, function(e,d){ if(e) throw e; r.setBody(d); })) throw new Error("Request not accepted.");
}
'@ | Set-Content $sprocs.appendOperationalEvent -Encoding UTF8

@'
function replaceProjection(doc) {
  var c = getContext().getCollection(), r = getContext().getResponse();
  if (!doc) throw new Error("Projection document is required.");
  ["id","pk","tenantId","viewName","scopeType","scopeId","updatedUtc"].forEach(function(k){ if(!doc[k]) throw new Error("Missing required field: "+k); });
  doc.documentType = doc.documentType || "DASHBOARD_PROJECTION";
  doc.updatedUtc = new Date().toISOString();
  if (!c.upsertDocument(c.getSelfLink(), doc, function(e,d){ if(e) throw e; r.setBody(d); })) throw new Error("Request not accepted.");
}
'@ | Set-Content $sprocs.replaceProjection -Encoding UTF8

@'
function recordIntegrationPayload(doc) {
  var c = getContext().getCollection(), r = getContext().getResponse();
  if (!doc) throw new Error("Payload document is required.");
  ["id","pk","tenantId","sourceSystemCode","interfaceTypeCode","receivedUtc","processingStatusCode"].forEach(function(k){ if(!doc[k]) throw new Error("Missing required field: "+k); });
  doc.documentType = doc.documentType || "INTEGRATION_PAYLOAD";
  doc.createdUtc = doc.createdUtc || new Date().toISOString();
  if (!c.createDocument(c.getSelfLink(), doc, function(e,d){ if(e) throw e; r.setBody(d); })) throw new Error("Request not accepted.");
}
'@ | Set-Content $sprocs.recordIntegrationPayload -Encoding UTF8

$containers = @(
  @{ name="eeiTemplates"; partitionKeyPath="/pk"; indexingPolicyFile=$files.default; indexingPolicyObject=$defaultPolicy; uniqueKeyPolicyFile=$files.ukTemplate; uniqueKeyPolicyObject=$ukTemplate; autoscaleMaxRu=0; ttl=-1; analyticalStorageTtl=-1; sprocs=@() },
  @{ name="eeiResponses"; partitionKeyPath="/pk"; indexingPolicyFile=$files.eei; indexingPolicyObject=$eeiPolicy; uniqueKeyPolicyFile=$files.ukResponse; uniqueKeyPolicyObject=$ukResponse; autoscaleMaxRu=$HighVolumeAutoscaleMaxRu; ttl=-1; analyticalStorageTtl=-1; sprocs=@(@{name="upsertVersionedResponse"; file=$sprocs.upsertVersionedResponse}) },
  @{ name="resourceStatusDocuments"; partitionKeyPath="/pk"; indexingPolicyFile=$files.default; indexingPolicyObject=$defaultPolicy; uniqueKeyPolicyFile=""; uniqueKeyPolicyObject=$null; autoscaleMaxRu=$HighVolumeAutoscaleMaxRu; ttl=-1; analyticalStorageTtl=-1; sprocs=@() },
  @{ name="operationalEvents"; partitionKeyPath="/pk"; indexingPolicyFile=$files.event; indexingPolicyObject=$eventPolicy; uniqueKeyPolicyFile=""; uniqueKeyPolicyObject=$null; autoscaleMaxRu=$HighVolumeAutoscaleMaxRu; ttl=31536000; analyticalStorageTtl=-1; sprocs=@(@{name="appendOperationalEvent"; file=$sprocs.appendOperationalEvent}) },
  @{ name="dashboardProjections"; partitionKeyPath="/pk"; indexingPolicyFile=$files.projection; indexingPolicyObject=$projectionPolicy; uniqueKeyPolicyFile=$files.ukView; uniqueKeyPolicyObject=$ukView; autoscaleMaxRu=$HighVolumeAutoscaleMaxRu; ttl=-1; analyticalStorageTtl=-1; sprocs=@(@{name="replaceProjection"; file=$sprocs.replaceProjection}) },
  @{ name="integrationPayloads"; partitionKeyPath="/pk"; indexingPolicyFile=$files.integration; indexingPolicyObject=$integrationPolicy; uniqueKeyPolicyFile=""; uniqueKeyPolicyObject=$null; autoscaleMaxRu=$HighVolumeAutoscaleMaxRu; ttl=31536000; analyticalStorageTtl=-1; sprocs=@(@{name="recordIntegrationPayload"; file=$sprocs.recordIntegrationPayload}) },
  @{ name="validationResults"; partitionKeyPath="/pk"; indexingPolicyFile=$files.default; indexingPolicyObject=$defaultPolicy; uniqueKeyPolicyFile=""; uniqueKeyPolicyObject=$null; autoscaleMaxRu=0; ttl=7776000; analyticalStorageTtl=$null; sprocs=@() },
  @{ name="notificationReadModels"; partitionKeyPath="/pk"; indexingPolicyFile=$files.projection; indexingPolicyObject=$projectionPolicy; uniqueKeyPolicyFile=""; uniqueKeyPolicyObject=$null; autoscaleMaxRu=0; ttl=31536000; analyticalStorageTtl=-1; sprocs=@() }
)

$manifest = @{
  deploymentTarget=$DeploymentTarget
  databaseName=$DatabaseName
  environmentCode=$EnvironmentCode
  generatedUtc=(Get-Date).ToUniversalTime().ToString("o")
  containers=$containers
}
Write-Json $manifestPath $manifest

function Deploy-AzureContainer([hashtable]$c) {
  Write-Section "Azure container: $($c.name)"
  $exists = $false
  try { Az "cosmosdb sql container show --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --database-name `"$DatabaseName`" --name `"$($c.name)`" --only-show-errors" | Out-Null; $exists = $true } catch {}
  if (-not $exists) {
    $cmd = "cosmosdb sql container create --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --database-name `"$DatabaseName`" --name `"$($c.name)`" --partition-key-path `"$($c.partitionKeyPath)`" --idx @`"$($c.indexingPolicyFile)`" --ttl $($c.ttl) --only-show-errors"
    if ([int]$c.autoscaleMaxRu -gt 0) { $cmd += " --max-throughput $($c.autoscaleMaxRu)" }
    if (-not [string]::IsNullOrWhiteSpace([string]$c.uniqueKeyPolicyFile)) { $cmd += " --unique-key-policy @`"$($c.uniqueKeyPolicyFile)`"" }
    Az $cmd | Out-Null
  } else {
    Az "cosmosdb sql container update --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --database-name `"$DatabaseName`" --name `"$($c.name)`" --ttl $($c.ttl) --idx @`"$($c.indexingPolicyFile)`" --only-show-errors" | Out-Null
    if ([int]$c.autoscaleMaxRu -gt 0) {
      try { Az "cosmosdb sql container throughput update --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --database-name `"$DatabaseName`" --name `"$($c.name)`" --max-throughput $($c.autoscaleMaxRu) --only-show-errors" | Out-Null } catch { Write-Warning $_.Exception.Message }
    }
  }
  if ($EnableAnalyticalStore -and $null -ne $c.analyticalStorageTtl) {
    try { Az "cosmosdb sql container update --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --database-name `"$DatabaseName`" --name `"$($c.name)`" --analytical-storage-ttl $($c.analyticalStorageTtl) --only-show-errors" | Out-Null } catch { Write-Warning "Analytical TTL skipped for $($c.name)" }
  }
}

function Deploy-AzureSproc([string]$container,[string]$name,[string]$file) {
  Write-Section "Azure sproc: $container / $name"
  $exists = $false
  try { Az "cosmosdb sql stored-procedure show --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --database-name `"$DatabaseName`" --container-name `"$container`" --name `"$name`" --only-show-errors" | Out-Null; $exists = $true } catch {}
  if ($exists) {
    Az "cosmosdb sql stored-procedure update --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --database-name `"$DatabaseName`" --container-name `"$container`" --name `"$name`" --body @`"$file`" --only-show-errors" | Out-Null
  } else {
    Az "cosmosdb sql stored-procedure create --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --database-name `"$DatabaseName`" --container-name `"$container`" --name `"$name`" --body @`"$file`" --only-show-errors" | Out-Null
  }
}

function Deploy-Azure {
  Write-Section "Deploying to Azure Cosmos DB"
  Az "account set --subscription `"$SubscriptionId`"" | Out-Null
  try { Az "group show --name `"$ResourceGroupName`" --only-show-errors" | Out-Null } catch { Az "group create --name `"$ResourceGroupName`" --location `"$Location`" --only-show-errors" | Out-Null }

  $exists = $false
  try { Az "cosmosdb show --name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --only-show-errors" | Out-Null; $exists = $true } catch {}

  $pna = if ($DisablePublicNetworkAccess) { "Disabled" } else { "Enabled" }
  $locs = "`"regionName=$PrimaryRegion failoverPriority=0`""
  if (-not [string]::IsNullOrWhiteSpace($SecondaryRegion)) { $locs += " `"regionName=$SecondaryRegion failoverPriority=1`"" }
  $analytical = if ($EnableAnalyticalStore) { "--enable-analytical-storage true" } else { "" }

  if (-not $exists) {
    Az "cosmosdb create --name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --kind GlobalDocumentDB --default-consistency-level Session --locations $locs --enable-free-tier false --enable-automatic-failover true --enable-multiple-write-locations false --public-network-access $pna --enable-local-auth false $analytical --tags Environment=$EnvironmentCode Workload=KDHE-IOC-EM DataClassification=Restricted Component=Flexible-IEE-CosmosDB --only-show-errors" | Out-Null
  } else {
    Az "cosmosdb update --name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --public-network-access $pna --enable-local-auth false --only-show-errors" | Out-Null
  }

  $dbExists = $false
  try { Az "cosmosdb sql database show --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --name `"$DatabaseName`" --only-show-errors" | Out-Null; $dbExists=$true } catch {}
  if (-not $dbExists) {
    Az "cosmosdb sql database create --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --name `"$DatabaseName`" --max-throughput $DatabaseAutoscaleMaxRu --only-show-errors" | Out-Null
  } else {
    try { Az "cosmosdb sql database throughput update --account-name `"$CosmosAccountName`" --resource-group `"$ResourceGroupName`" --name `"$DatabaseName`" --max-throughput $DatabaseAutoscaleMaxRu --only-show-errors" | Out-Null } catch { Write-Warning $_.Exception.Message }
  }

  foreach ($c in $containers) { Deploy-AzureContainer $c }
  foreach ($c in $containers) { foreach ($sp in $c.sprocs) { Deploy-AzureSproc $c.name $sp.name $sp.file } }

  Write-Section "Azure RBAC note"
  Write-Host "Account provisioning disables local auth for Azure. Assign Cosmos DB SQL data-plane roles to managed identities as part of the environment IaC/release pipeline." -ForegroundColor Yellow
}

function Deploy-Emulator {
  Write-Section "Deploying to local Azure Cosmos DB Emulator"

  $deployer = Join-Path $root "emulator-deployer"
  Ensure-Dir $deployer

  @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.Cosmos" Version="3.43.0" />
  </ItemGroup>
</Project>
'@ | Set-Content (Join-Path $deployer "KDHE.Cosmos.Emulator.Deployer.csproj") -Encoding UTF8

  @'
using System.Collections.ObjectModel;
using System.Text.Json;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Cosmos.Scripts;

if (args.Length < 6) { Console.Error.WriteLine("endpoint key db manifest recreate allowSelfSigned"); return 2; }
string endpoint=args[0], key=args[1].Trim(), dbName=args[2], manifestPath=args[3];
bool recreate=bool.Parse(args[4]), allowSelfSigned=bool.Parse(args[5]);

var opts = new CosmosClientOptions { ConnectionMode = ConnectionMode.Gateway };
if (allowSelfSigned) {
  opts.HttpClientFactory = () => new HttpClient(new HttpClientHandler {
    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
  });
}

var manifest = JsonSerializer.Deserialize<Manifest>(File.ReadAllText(manifestPath), new JsonSerializerOptions{PropertyNameCaseInsensitive=true})!;
using var client = new CosmosClient(endpoint, key, opts);

if (recreate) {
  try { await client.GetDatabase(dbName).DeleteAsync(); } catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound) {}
}

Database db = await client.CreateDatabaseIfNotExistsAsync(dbName);

foreach (var c in manifest.Containers) {
  Console.WriteLine($"Container: {c.Name}");
  var cp = new ContainerProperties(c.Name, c.PartitionKeyPath) { DefaultTimeToLive = c.Ttl };
  ApplyIndex(cp, c.IndexingPolicyObject);
  if (c.UniqueKeyPolicyObject?.UniqueKeys != null) {
    foreach (var uk in c.UniqueKeyPolicyObject.UniqueKeys) {
      var k = new UniqueKey();
      foreach (var p in uk.Paths) k.Paths.Add(p);
      cp.UniqueKeyPolicy.UniqueKeys.Add(k);
    }
  }

  Container container = c.AutoscaleMaxRu > 0
    ? await db.CreateContainerIfNotExistsAsync(cp, ThroughputProperties.CreateAutoscaleThroughput(c.AutoscaleMaxRu))
    : await db.CreateContainerIfNotExistsAsync(cp);

  foreach (var sp in c.Sprocs) {
    await UpsertStoredProcedure(container, sp.Name, File.ReadAllText(sp.File));
    Console.WriteLine($"  Sproc: {sp.Name}");
  }
}

Console.WriteLine("Emulator deployment complete.");
return 0;

static async Task UpsertStoredProcedure(Container container, string name, string body) {
  var props = new StoredProcedureProperties(name, body);
  try {
    await container.Scripts.ReadStoredProcedureAsync(name);
    await container.Scripts.ReplaceStoredProcedureAsync(props);
  }
  catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound) {
    await container.Scripts.CreateStoredProcedureAsync(props);
  }
}

static void ApplyIndex(ContainerProperties cp, IndexPolicy? p) {
  if (p == null) return;
  cp.IndexingPolicy.IndexingMode = IndexingMode.Consistent;
  cp.IndexingPolicy.Automatic = p.Automatic;
  cp.IndexingPolicy.IncludedPaths.Clear();
  cp.IndexingPolicy.ExcludedPaths.Clear();
  cp.IndexingPolicy.CompositeIndexes.Clear();

  if (p.IncludedPaths != null) {
    foreach (var x in p.IncludedPaths) cp.IndexingPolicy.IncludedPaths.Add(new IncludedPath{Path=x.Path});
  }

  if (p.ExcludedPaths != null) {
    foreach (var x in p.ExcludedPaths) cp.IndexingPolicy.ExcludedPaths.Add(new ExcludedPath{Path=x.Path});
  }

  if (p.CompositeIndexes.ValueKind == JsonValueKind.Array) {
    var topLevelElements = p.CompositeIndexes.EnumerateArray().ToList();

    // Normal shape: compositeIndexes = [ [ {path, order}, {path, order} ], ... ]
    if (topLevelElements.Count > 0 && topLevelElements[0].ValueKind == JsonValueKind.Array) {
      foreach (var groupElement in topLevelElements) {
        var col = new Collection<CompositePath>();
        foreach (var pathElement in groupElement.EnumerateArray()) {
          AddCompositePath(col, pathElement);
        }
        if (col.Count >= 2) cp.IndexingPolicy.CompositeIndexes.Add(col);
      }
    }
    // PowerShell ConvertTo-Json may flatten a single composite group to:
    // compositeIndexes = [ {path, order}, {path, order} ]
    // Treat that as one composite index group instead of one invalid single-path group per item.
    else if (topLevelElements.Count > 0 && topLevelElements[0].ValueKind == JsonValueKind.Object) {
      var col = new Collection<CompositePath>();
      foreach (var pathElement in topLevelElements) {
        AddCompositePath(col, pathElement);
      }
      if (col.Count >= 2) cp.IndexingPolicy.CompositeIndexes.Add(col);
    }
  }
}

static void AddCompositePath(Collection<CompositePath> col, JsonElement element) {
  string path = element.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
  string order = element.TryGetProperty("order", out var o) ? o.GetString() ?? "ascending" : "ascending";
  if (string.IsNullOrWhiteSpace(path)) return;

  col.Add(new CompositePath{
    Path = path,
    Order = string.Equals(order, "descending", StringComparison.OrdinalIgnoreCase)
      ? CompositePathSortOrder.Descending
      : CompositePathSortOrder.Ascending
  });
}

public class Manifest { public List<CDef> Containers {get;set;} = new(); }
public class CDef {
  public string Name {get;set;}="";
  public string PartitionKeyPath {get;set;}="/pk";
  public IndexPolicy? IndexingPolicyObject {get;set;}
  public UniquePolicy? UniqueKeyPolicyObject {get;set;}
  public int AutoscaleMaxRu {get;set;}
  public int Ttl {get;set;}=-1;
  public List<SDef> Sprocs {get;set;}=new();
}
public class SDef { public string Name {get;set;}=""; public string File {get;set;}=""; }
public class IndexPolicy {
  public bool Automatic {get;set;}=true;
  public List<P>? IncludedPaths {get;set;}
  public List<P>? ExcludedPaths {get;set;}
  public JsonElement CompositeIndexes {get;set;}
}
public class P { public string Path {get;set;}=""; }
public class CP { public string Path {get;set;}=""; public string? Order {get;set;} }
public class UniquePolicy { public List<UK> UniqueKeys {get;set;}=new(); }
public class UK { public List<string> Paths {get;set;}=new(); }
'@ | Set-Content (Join-Path $deployer "Program.cs") -Encoding UTF8

  Push-Location $deployer
  try {
    dotnet restore | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed." }
    dotnet run -- "$EmulatorEndpoint" "$EmulatorKey" "$DatabaseName" "$manifestPath" "$RecreateEmulatorDatabase" "$EmulatorAllowSelfSignedCertificate" | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Emulator deployer failed." }
  } finally {
    Pop-Location
  }
}

try {
  Write-Audit "Deployment started. Target=$DeploymentTarget; Database=$DatabaseName; EnvironmentCode=$EnvironmentCode"

  if ($DeploymentTarget -eq "Azure") {
    Deploy-Azure
  }
  else {
    Deploy-Emulator
  }

  Write-Section "Deployment complete"
  Write-Audit "Deployment complete. Target=$DeploymentTarget"
  Write-Audit "Database=$DatabaseName"
  Write-Audit "Generated artifacts=$root"
}
catch {
  $errorMessage = "Deployment failed: $($_.Exception.Message)"
  Write-Audit $errorMessage "ERROR"

  if ($_.ScriptStackTrace) {
    Write-Audit ("ScriptStackTrace: " + $_.ScriptStackTrace) "ERROR"
  }

  throw
}
finally {
  Write-Audit "Audit log file: $script:AuditLogPath"
}
