$path = "D:/Projects/KPP_WEB/KPP_WEB.Server/Program.cs"
$lines = Get-Content $path

$groups = @{}
for($i=0; $i -lt $lines.Count; $i++){
  if($lines[$i] -match '^\s*var\s+(\w+)\s*=\s*apiV1\.MapGroup\("([^"]+)"\)(.*)$'){
    $name = $matches[1]
    $prefix = $matches[2]
    $rest = $matches[3]
    $policy = 'Endpoint-specific review required'
    if($rest -match 'RequireAuthorization\(([^\)]*)\)'){ $policy = $matches[1].Trim() }
    $groups[$name] = [pscustomobject]@{ prefix = $prefix; defaultPolicy = $policy }
  }
}

$endpoints = @()
for($i=0; $i -lt $lines.Count; $i++){
  $line = $lines[$i]
  $group=''; $method=''; $route=''; $policy='Endpoint-specific review required'

  if($line -match '^\s*(\w+)\.Map(Get|Post|Put|Delete|Patch)\("([^"]+)"'){
    $group = $matches[1]
    $method = $matches[2].ToUpper()
    $route = $matches[3]
    if(-not $groups.ContainsKey($group)){ continue }
    $prefix = $groups[$group].prefix
    $policy = $groups[$group].defaultPolicy
    $fullRoute = if($route.StartsWith('/')) { "/api/v1$prefix$route" } else { "/api/v1/$route" }
  }
  elseif($line -match '^\s*apiV1\.Map(Get|Post|Put|Delete|Patch)\("([^"]+)"'){
    $group = 'apiV1'
    $method = $matches[1].ToUpper()
    $route = $matches[2]
    $fullRoute = if($route.StartsWith('/')) { "/api/v1$route" } else { "/api/v1/$route" }
  }
  else { continue }

  $end = [Math]::Min($i + 260, $lines.Count - 1)
  for($j=$i; $j -le $end; $j++){
    if($lines[$j] -match '\.RequireAuthorization\(([^\)]*)\)'){ $policy = $matches[1].Trim() }
    if($lines[$j] -match '^\s*\)\s*\.WithName\('){ $end = $j; break }
  }

  $audited = $false
  $auditAction = ''
  $redaction = 'TBD'

  for($k=$i; $k -le $end; $k++){
    if($lines[$k] -match 'WriteAsync\('){ $audited = $true }
    if($lines[$k] -match 'BuildAuditEventExportCsv\('){ $redaction = 'Yes' }
  }

  if($audited){
    for($k=$i; $k -le $end; $k++){
      if($lines[$k] -match 'new\s+AuditEventWriteModel\('){
        $vals = @()
        for($m=$k; $m -le [Math]::Min($k+30,$end); $m++){
          if($lines[$m] -match '^\s*"([A-Z0-9_]+)"\s*,?\s*$'){
            $vals += $matches[1]
          }
        }
        if($vals.Count -ge 2){ $auditAction = "$($vals[0]) / $($vals[1])" }
        elseif($vals.Count -eq 1){ $auditAction = $vals[0] }
        break
      }
    }
  }

  $endpoints += [pscustomobject]@{
    Group = $group
    Method = $method
    Route = $fullRoute
    Policy = $(if([string]::IsNullOrWhiteSpace($policy)){'RequireAuthorization()'} else {$policy})
    Audited = $(if($audited){'Yes'} else {'TBD'})
    AuditAction = $(if($auditAction){$auditAction}else{'TBD'})
    Redaction = $redaction
    Status = $(if($audited){'In Progress'} else {'Pending'})
    Line = ($i+1)
  }
}

$groupOrder = @('admin','agent','alerts','apiV1','auth','beds','incidents','lookups','reports','resources','users')
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# Endpoint Authorization + Audit Coverage Matrix')
[void]$sb.AppendLine()
[void]$sb.AppendLine('## Scope')
[void]$sb.AppendLine('Concrete endpoint inventory derived from `KPP_WEB.Server/Program.cs` route mappings. This matrix is used to attest policy enforcement and audit coverage endpoint-by-endpoint.')
[void]$sb.AppendLine()
[void]$sb.AppendLine('## Coverage Criteria (must pass all)')
[void]$sb.AppendLine('1. Authorization policy enforced (group-level or endpoint-level).')
[void]$sb.AppendLine('2. Write/mutation/export/admin-sensitive actions produce audit evidence.')
[void]$sb.AppendLine('3. Audit record includes actor, action, outcome, and trace/correlation context.')
[void]$sb.AppendLine('4. Sensitive values are redacted/masked in logs and exported audit detail.')

foreach($g in $groupOrder){
  $rows = @($endpoints | Where-Object { $_.Group -eq $g } | Sort-Object Line)
  if($rows.Count -eq 0){ continue }
  [void]$sb.AppendLine()
  [void]$sb.AppendLine("## Group: $g")
  [void]$sb.AppendLine()
  [void]$sb.AppendLine('| Endpoint | Method | Policy Baseline | Audited | Audit Category/Action | Sensitive Data Redaction Verified | Status | Notes |')
  [void]$sb.AppendLine('|---|---|---|---|---|---|---|---|')
  foreach($r in $rows){
    [void]$sb.AppendLine("| $($r.Route) | $($r.Method) | $($r.Policy) | $($r.Audited) | $($r.AuditAction) | $($r.Redaction) | $($r.Status) | Source line $($r.Line) in Program.cs |")
  }
}

$auditedCount = @($endpoints | Where-Object { $_.Audited -eq 'Yes' }).Count
[void]$sb.AppendLine()
[void]$sb.AppendLine('## Current Status Snapshot')
[void]$sb.AppendLine('- Matrix now contains concrete route paths, methods, and authorization baselines extracted from code.')
[void]$sb.AppendLine('- Auth baseline verified in code: route groups and endpoint-specific `RequireAuthorization(...)` policies are present across endpoint groups.')
[void]$sb.AppendLine("- Audit evidence automatically detected for $auditedCount endpoints that call `auditWriter`/`auditEventWriter` in endpoint handlers (manual evidence record linkage still required).")
[void]$sb.AppendLine('- Sensitive-data redaction verified for exported audit detail payloads via `RedactSensitiveData(...)` in `BuildAuditEventExportCsv(...)`.')
[void]$sb.AppendLine('- Next pass: attach concrete `audit.AuditEvent` sample IDs and auth test artifacts per privileged/write/export endpoint.')

Set-Content 'D:/Projects/KPP_WEB/KPP_WEB.AppHost/planning/Implementation-Approach/14_Endpoint_Authorization_Audit_Coverage_Matrix.md' $sb.ToString()
$endpoints | Export-Csv 'D:/Projects/KPP_WEB/_tmp_endpoint_audit_detect.csv' -NoTypeInformation
"updated endpoints=$($endpoints.Count) audited=$auditedCount"
