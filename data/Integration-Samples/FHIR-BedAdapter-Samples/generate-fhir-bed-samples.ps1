$base = 'IPOC_WEB.AppHost/planning/Integration-Samples'
$sampleDir = Join-Path $base 'FHIR-BedAdapter-Samples'
New-Item -ItemType Directory -Force -Path $sampleDir | Out-Null

function New-LocationResource {
  param(
	[int]$locationId,
	[string]$name,
	[string]$city,
	[string]$state,
	[string]$postal,
	[double]$lat,
	[double]$lng
  )

  return [ordered]@{
	resourceType = 'Location'
	id = "iocem-location-$locationId"
	meta = @{ profile = @('http://hl7.org/fhir/StructureDefinition/Location') }
	identifier = @(
	  @{ system = 'https://kdhe.ks.gov/iocem/location-id'; value = "$locationId" },
	  @{ system = 'urn:oid:2.16.840.1.113883.4.6'; value = "KS-FAC-$locationId" }
	)
	status = 'active'
	name = $name
	telecom = @(
	  @{ system = 'phone'; value = "785-555-$($locationId.ToString().PadLeft(4,'0'))"; use = 'work' }
	)
	address = @{ use='work'; type='physical'; city=$city; state=$state; postalCode=$postal; country='US'; line=@("$($locationId) Main Campus Dr") }
	position = @{ latitude = $lat; longitude = $lng }
	managingOrganization = @{ display = 'Kansas Health Preparedness Network' }
  }
}

function New-HealthcareServiceResource {
  param(
	[int]$locationId,
	[string]$serviceId,
	[string]$category,
	[int]$staffed,
	[int]$available,
	[int]$occupied,
	[int]$unavailable,
	[int]$iso,
	[int]$surge
  )

  return [ordered]@{
	resourceType = 'HealthcareService'
	id = $serviceId
	meta = @{ profile = @('http://hl7.org/fhir/StructureDefinition/HealthcareService') }
	active = $true
	providedBy = @{ reference = "Location/iocem-location-$locationId"; display = "Facility $locationId" }
	category = @(
	  @{ coding = @(
		  @{ system='https://kdhe.ks.gov/iocem/bed-category'; code=$category; display=$category },
		  @{ system='http://terminology.hl7.org/CodeSystem/service-category'; code='31'; display='Specialist Medical Service' }
	  ) }
	)
	specialty = @(
	  @{ coding = @(@{ system='http://snomed.info/sct'; code='394592004'; display='Critical care medicine' }) }
	)
	type = @(
	  @{ coding = @(@{ system='http://terminology.hl7.org/CodeSystem/service-type'; code='57'; display='Intensive care' }) }
	)
	name = "Bed Capacity - $category"
	comment = 'Operational bed census feed for emergency coordination.'
	extension = @(
	  @{ url='https://kdhe.ks.gov/fhir/StructureDefinition/staffedBedsTotal'; valueInteger=$staffed },
	  @{ url='https://kdhe.ks.gov/fhir/StructureDefinition/bedsAvailable'; valueInteger=$available },
	  @{ url='https://kdhe.ks.gov/fhir/StructureDefinition/bedsOccupied'; valueInteger=$occupied },
	  @{ url='https://kdhe.ks.gov/fhir/StructureDefinition/bedsUnavailable'; valueInteger=$unavailable },
	  @{ url='https://kdhe.ks.gov/fhir/StructureDefinition/isolationCapableBeds'; valueInteger=$iso },
	  @{ url='https://kdhe.ks.gov/fhir/StructureDefinition/surgeBedsPotential'; valueInteger=$surge }
	)
  }
}

$facilities = @(
  @{ id=101; name='Topeka Regional Medical Center'; city='Topeka'; state='KS'; postal='66603'; lat=39.0473; lng=-95.6752 },
  @{ id=102; name='Wichita Metro Hospital'; city='Wichita'; state='KS'; postal='67202'; lat=37.6872; lng=-97.3301 },
  @{ id=103; name='Lawrence Community Health'; city='Lawrence'; state='KS'; postal='66044'; lat=38.9717; lng=-95.2353 },
  @{ id=104; name='Salina Valley Medical'; city='Salina'; state='KS'; postal='67401'; lat=38.8403; lng=-97.6114 },
  @{ id=105; name='Hays Plains Health'; city='Hays'; state='KS'; postal='67601'; lat=38.8792; lng=-99.3268 },
  @{ id=106; name='Pittsburg Regional Care'; city='Pittsburg'; state='KS'; postal='66762'; lat=37.4109; lng=-94.7049 },
  @{ id=107; name='Dodge City General'; city='Dodge City'; state='KS'; postal='67801'; lat=37.7528; lng=-100.0171 },
  @{ id=108; name='Garden City Medical Hub'; city='Garden City'; state='KS'; postal='67846'; lat=37.9717; lng=-100.8727 },
  @{ id=109; name='Kansas City Metro East'; city='Kansas City'; state='KS'; postal='66101'; lat=39.1141; lng=-94.6275 },
  @{ id=110; name='Olathe Advanced Care'; city='Olathe'; state='KS'; postal='66061'; lat=38.8814; lng=-94.8191 }
)

$categories = @('ICU','MEDSURG','PEDIATRIC')
$entries = New-Object System.Collections.ArrayList
foreach ($f in $facilities) {
  [void]$entries.Add(@{ resource = (New-LocationResource -locationId $f.id -name $f.name -city $f.city -state $f.state -postal $f.postal -lat $f.lat -lng $f.lng) })
  $seed = [int]$f.id
  for ($i = 0; $i -lt $categories.Count; $i++) {
	$cat = $categories[$i]
	$staffed = 18 + (($seed + ($i * 7)) % 25)
	$available = [int][Math]::Max(2, [Math]::Floor($staffed * 0.22))
	$occupied = [int][Math]::Max(0, $staffed - $available - 1)
	$unavailable = [int]($staffed - ($available + $occupied))
	$iso = [int][Math]::Min($staffed, [Math]::Floor($staffed * 0.35))
	$surge = [int][Math]::Floor($staffed * 0.2)
	[void]$entries.Add(@{ resource = (New-HealthcareServiceResource -locationId $f.id -serviceId "iocem-bed-$($cat.ToLower())-$($f.id)" -category $cat -staffed $staffed -available $available -occupied $occupied -unavailable $unavailable -iso $iso -surge $surge) })
  }
}

$validBundle = [ordered]@{
  resourceType = 'Bundle'
  id = 'iocem-bed-capacity-large-valid'
  type = 'collection'
  timestamp = (Get-Date).ToUniversalTime().ToString('o')
  identifier = @{ system='https://kdhe.ks.gov/iocem/fhir-feed'; value='BEDCAP-LARGE-VALID-001' }
  entry = $entries
}
$validBundle | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 (Join-Path $sampleDir 'IOCEM_FHIR_BedCapacity_Large_Valid.bundle.json')

$deltaEntries = New-Object System.Collections.ArrayList
foreach ($f in $facilities[0..5]) {
  [void]$deltaEntries.Add(@{ resource = (New-LocationResource -locationId $f.id -name $f.name -city $f.city -state $f.state -postal $f.postal -lat $f.lat -lng $f.lng) })
  foreach ($cat in @('ICU','ED','BURN')) {
	$baseStaffed = if ($cat -eq 'ED') { 30 } elseif ($cat -eq 'BURN') { 12 } else { 24 }
	$staffed = $baseStaffed + (($f.id % 3) * 2)
	$available = [int][Math]::Max(1, [Math]::Floor($staffed * 0.15))
	$occupied = [int][Math]::Max(0, $staffed - $available - 2)
	$unavailable = [int]($staffed - ($available + $occupied))
	$iso = [int][Math]::Min($staffed, [Math]::Floor($staffed * 0.4))
	$surge = [int][Math]::Floor($staffed * 0.3)
	[void]$deltaEntries.Add(@{ resource = (New-HealthcareServiceResource -locationId $f.id -serviceId "iocem-bed-$($cat.ToLower())-delta-$($f.id)" -category $cat -staffed $staffed -available $available -occupied $occupied -unavailable $unavailable -iso $iso -surge $surge) })
  }
}
$deltaBundle = [ordered]@{
  resourceType = 'Bundle'
  id = 'iocem-bed-capacity-delta-valid'
  type = 'collection'
  timestamp = (Get-Date).AddMinutes(15).ToUniversalTime().ToString('o')
  identifier = @{ system='https://kdhe.ks.gov/iocem/fhir-feed'; value='BEDCAP-DELTA-VALID-002' }
  entry = $deltaEntries
}
$deltaBundle | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 (Join-Path $sampleDir 'IOCEM_FHIR_BedCapacity_Delta_Valid.bundle.json')

$mixed = [ordered]@{
  resourceType = 'Bundle'
  id = 'iocem-bed-capacity-mixed-quality'
  type = 'collection'
  timestamp = (Get-Date).AddMinutes(30).ToUniversalTime().ToString('o')
  entry = @(
	@{ resource = (New-LocationResource -locationId 111 -name 'Emporia Medical Center' -city 'Emporia' -state 'KS' -postal '66801' -lat 38.4039 -lng -96.1817) },
	@{ resource = @{ resourceType='Location'; id='iocem-location-112'; name='Broken Identifier Facility'; identifier=@(@{ system='https://kdhe.ks.gov/iocem/location-id'; value='ABC-112' }) } },
	@{ resource = @{ resourceType='Location'; id='iocem-location-113'; name='Missing Identifier Facility' } },
	@{ resource = (New-HealthcareServiceResource -locationId 111 -serviceId 'iocem-bed-icu-111' -category 'ICU' -staffed 28 -available 5 -occupied 21 -unavailable 2 -iso 10 -surge 6) },
	@{ resource = @{ resourceType='HealthcareService'; id='iocem-bed-missing-category-111'; providedBy=@{ reference='Location/iocem-location-111' }; extension=@(@{ url='https://kdhe.ks.gov/fhir/StructureDefinition/staffedBedsTotal'; valueInteger=20 }) } },
	@{ resource = @{ resourceType='HealthcareService'; id='iocem-bed-unresolved-location'; providedBy=@{ reference='Location/non-existent-location' }; category=@(@{ coding=@(@{ system='https://kdhe.ks.gov/iocem/bed-category'; code='MEDSURG' }) }); extension=@(@{ url='https://kdhe.ks.gov/fhir/StructureDefinition/bedsAvailable'; valueInteger=4 }) } },
	@{ resource = (New-HealthcareServiceResource -locationId 111 -serviceId 'iocem-bed-medsurg-111' -category 'MEDSURG' -staffed 36 -available 8 -occupied 25 -unavailable 3 -iso 9 -surge 7) }
  )
}
$mixed | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 (Join-Path $sampleDir 'IOCEM_FHIR_BedCapacity_MixedQuality.bundle.json')

$invalid = [ordered]@{
  resourceType = 'Parameters'
  parameter = @(
	@{ name='source'; valueString='INVALID_ENVELOPE_DEMO' },
	@{ name='note'; valueString='Intentional negative test payload: not a FHIR Bundle.' }
  )
}
$invalid | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $sampleDir 'IOCEM_FHIR_BedCapacity_InvalidEnvelope.json')

Write-Host "Generated FHIR sample files in $sampleDir"