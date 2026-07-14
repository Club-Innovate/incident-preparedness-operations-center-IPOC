using System.Text.Json;

namespace IPOC_WEB.Server.Infrastructure.Resources;

public interface IFhirBedAvailabilityTranslator
{
    (BedAvailabilityImportBatchRequestDto Batch, IReadOnlyList<string> Rejects) Translate(string sourceSystemCode, string? sourceMessageId, string bundleJson);
}

public sealed class FhirBedAvailabilityTranslator : IFhirBedAvailabilityTranslator
{
    public (BedAvailabilityImportBatchRequestDto Batch, IReadOnlyList<string> Rejects) Translate(string sourceSystemCode, string? sourceMessageId, string bundleJson)
    {
        using var document = JsonDocument.Parse(bundleJson);
        var root = document.RootElement;

        if (!root.TryGetProperty("resourceType", out var resourceType) || !string.Equals(resourceType.GetString(), "Bundle", StringComparison.OrdinalIgnoreCase))
        {
            return (new BedAvailabilityImportBatchRequestDto(sourceSystemCode, sourceMessageId, []), ["Payload is not a FHIR Bundle."]);
        }

        if (!root.TryGetProperty("entry", out var entryArray) || entryArray.ValueKind != JsonValueKind.Array)
        {
            return (new BedAvailabilityImportBatchRequestDto(sourceSystemCode, sourceMessageId, []), ["Bundle.entry array is missing."]);
        }

        var locationMap = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        var rows = new List<BedAvailabilityImportRowDto>();
        var rejects = new List<string>();

        foreach (var entry in entryArray.EnumerateArray())
        {
            if (!entry.TryGetProperty("resource", out var resource))
            {
                continue;
            }

            if (!resource.TryGetProperty("resourceType", out var resourceTypeNode))
            {
                continue;
            }

            var type = resourceTypeNode.GetString();
            if (string.Equals(type, "Location", StringComparison.OrdinalIgnoreCase))
            {
                ParseLocation(resource, locationMap, rejects);
                continue;
            }

            if (string.Equals(type, "HealthcareService", StringComparison.OrdinalIgnoreCase))
            {
                ParseHealthcareService(resource, locationMap, rows, rejects);
            }
        }

        return (new BedAvailabilityImportBatchRequestDto(sourceSystemCode, sourceMessageId, rows), rejects);
    }

    private static void ParseLocation(JsonElement resource, IDictionary<string, long> locationMap, ICollection<string> rejects)
    {
        if (!resource.TryGetProperty("id", out var idNode))
        {
            rejects.Add("Location is missing id.");
            return;
        }

        var locationResourceId = idNode.GetString();
        if (string.IsNullOrWhiteSpace(locationResourceId))
        {
            rejects.Add("Location has empty id.");
            return;
        }

        if (!resource.TryGetProperty("identifier", out var identifiers) || identifiers.ValueKind != JsonValueKind.Array)
        {
            rejects.Add($"Location/{locationResourceId} is missing identifier.");
            return;
        }

        foreach (var identifier in identifiers.EnumerateArray())
        {
            if (!identifier.TryGetProperty("value", out var valueNode))
            {
                continue;
            }

            var value = valueNode.GetString();
            if (long.TryParse(value, out var locationId) && locationId > 0)
            {
                locationMap[$"Location/{locationResourceId}"] = locationId;
                return;
            }
        }

        rejects.Add($"Location/{locationResourceId} identifier does not map to IOCEM LocationId.");
    }

    private static void ParseHealthcareService(
        JsonElement resource,
        IReadOnlyDictionary<string, long> locationMap,
        ICollection<BedAvailabilityImportRowDto> rows,
        ICollection<string> rejects)
    {
        if (!resource.TryGetProperty("providedBy", out var providedBy)
            || !providedBy.TryGetProperty("reference", out var referenceNode))
        {
            rejects.Add("HealthcareService missing providedBy.reference.");
            return;
        }

        var locationReference = referenceNode.GetString();
        if (string.IsNullOrWhiteSpace(locationReference) || !locationMap.TryGetValue(locationReference, out var locationId))
        {
            rejects.Add($"HealthcareService references unresolved location '{locationReference ?? "(null)"}'.");
            return;
        }

        var bedCategoryCode = TryGetCategoryCode(resource);
        if (string.IsNullOrWhiteSpace(bedCategoryCode))
        {
            rejects.Add($"HealthcareService for location {locationId} missing category code.");
            return;
        }

        var extensionMap = ReadExtensions(resource);

        rows.Add(new BedAvailabilityImportRowDto(
            locationId,
            bedCategoryCode,
            TryReadInt(extensionMap, "staffedBedsTotal"),
            TryReadInt(extensionMap, "bedsAvailable"),
            TryReadInt(extensionMap, "bedsOccupied"),
            TryReadInt(extensionMap, "bedsUnavailable"),
            TryReadInt(extensionMap, "isolationCapableBeds"),
            TryReadInt(extensionMap, "surgeBedsPotential"),
            DateTimeOffset.UtcNow));
    }

    private static string? TryGetCategoryCode(JsonElement resource)
    {
        if (!resource.TryGetProperty("category", out var categories) || categories.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var category in categories.EnumerateArray())
        {
            if (!category.TryGetProperty("coding", out var codings) || codings.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var coding in codings.EnumerateArray())
            {
                if (coding.TryGetProperty("code", out var codeNode))
                {
                    var code = codeNode.GetString();
                    if (!string.IsNullOrWhiteSpace(code))
                    {
                        return code;
                    }
                }
            }
        }

        return null;
    }

    private static Dictionary<string, int> ReadExtensions(JsonElement resource)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (!resource.TryGetProperty("extension", out var extensions) || extensions.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var extension in extensions.EnumerateArray())
        {
            if (!extension.TryGetProperty("url", out var urlNode))
            {
                continue;
            }

            var url = urlNode.GetString();
            if (string.IsNullOrWhiteSpace(url))
            {
                continue;
            }

            var key = url.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).LastOrDefault();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            if (extension.TryGetProperty("valueInteger", out var valueInteger)
                && valueInteger.TryGetInt32(out var parsed))
            {
                result[key] = parsed;
            }
        }

        return result;
    }

    private static int? TryReadInt(IReadOnlyDictionary<string, int> values, string key)
        => values.TryGetValue(key, out var value) ? value : null;
}
