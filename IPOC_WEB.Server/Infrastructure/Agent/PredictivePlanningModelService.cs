/*
File: IPOC_WEB.Server/Infrastructure/Agent/PredictivePlanningModelService.cs
Blueprint Name: AgentPredictivePlanningService

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-07-10
Updated: 2026-07-12

Description:
Predictive planning model service abstraction and default provider implementation.

Features:
  - Provider abstraction for predictive demand/supply model execution.
  - Configurable model metadata via PredictivePlanningOptions.
  - Deterministic prediction synthesis from operational feature vectors.

Security & Compliance:
  - Supports explicit model provenance and drift posture metadata.
  - Separates model execution concerns from API endpoint handling.
*/

using System.Globalization;
using IPOC_WEB.Server.Infrastructure.Configuration;
using Microsoft.Extensions.Options;

namespace IPOC_WEB.Server.Infrastructure.Agent;

public interface IPredictivePlanningModelService
{
    Task<PredictivePlanningResultDto> PredictDemandSupplyAsync(PredictivePlanningRequestDto request, CancellationToken cancellationToken);
    PredictivePlanningOperationalAcceptanceResultDto EvaluateOperationalAcceptance(PredictivePlanningResultDto result);
}

public sealed class PredictivePlanningModelService : IPredictivePlanningModelService
{
    private readonly PredictivePlanningOptions _options;

    public PredictivePlanningModelService(IOptions<PredictivePlanningOptions> options)
    {
        _options = options.Value;
    }

    public Task<PredictivePlanningResultDto> PredictDemandSupplyAsync(PredictivePlanningRequestDto request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var openTaskCount = request.Tasks.Count(item => !string.Equals(item.StatusCode, "Completed", StringComparison.OrdinalIgnoreCase));
        var highPriorityOpenTaskCount = request.Tasks.Count(item =>
            !string.Equals(item.StatusCode, "Completed", StringComparison.OrdinalIgnoreCase)
            && (string.Equals(item.PriorityCode, "Critical", StringComparison.OrdinalIgnoreCase)
                || string.Equals(item.PriorityCode, "High", StringComparison.OrdinalIgnoreCase)));
        var openObjectiveCount = request.Objectives.Count(item => !string.Equals(item.StatusCode, "Completed", StringComparison.OrdinalIgnoreCase));

        var pendingResourceRequests = request.ResourceRequests
            .Where(item => !string.Equals(item.StatusCode, "Fulfilled", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(item.StatusCode, "Cancelled", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(item.StatusCode, "Denied", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(item.StatusCode, "Archived", StringComparison.OrdinalIgnoreCase))
            .ToArray();

        var requestedOutstandingQuantity = pendingResourceRequests.Sum(item =>
            Math.Max(0m, item.RequestedQuantity - (item.AssignedQuantity ?? 0m)));

        var availableInventoryQuantity = request.ResourceInventory.Sum(item => Math.Max(0m, item.QuantityAvailable));
        var availableBeds = request.BedAvailability.Sum(item => (long)Math.Max(0, item.BedsAvailable ?? 0));

        var projectedDemandQuantity = Math.Round(
            requestedOutstandingQuantity
            + (highPriorityOpenTaskCount * 2.0m)
            + (openTaskCount * 0.5m)
            + (openObjectiveCount * 1.25m),
            2,
            MidpointRounding.AwayFromZero);

        var horizonScalingFactor = Math.Clamp((decimal)request.HorizonHours / 24m, 0.5m, 3.0m);
        var projectedSupplyQuantity = Math.Round(
            availableInventoryQuantity * (0.45m + (0.20m * horizonScalingFactor))
            + (availableBeds * 0.10m),
            2,
            MidpointRounding.AwayFromZero);

        var predictedShortfallQuantity = Math.Max(0m, Math.Round(projectedDemandQuantity - projectedSupplyQuantity, 2, MidpointRounding.AwayFromZero));
        var demandPressureIndex = Math.Clamp((int)Math.Round((openTaskCount * 2.0m) + (highPriorityOpenTaskCount * 4.0m) + (openObjectiveCount * 1.5m) + (requestedOutstandingQuantity * 0.6m), MidpointRounding.AwayFromZero), 0, 100);
        var supplyReadinessIndex = projectedDemandQuantity <= 0m
            ? 100
            : Math.Clamp((int)Math.Round((projectedSupplyQuantity / projectedDemandQuantity) * 100m, MidpointRounding.AwayFromZero), 0, 100);

        var shortageByResourceType = pendingResourceRequests
            .GroupBy(item => item.ResourceTypeCode, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var required = group.Sum(item => Math.Max(0m, item.RequestedQuantity - (item.AssignedQuantity ?? 0m)));
                var available = request.ResourceInventory
                    .Where(item => string.Equals(item.ResourceTypeCode, group.Key, StringComparison.OrdinalIgnoreCase))
                    .Sum(item => Math.Max(0m, item.QuantityAvailable));
                var gap = Math.Max(0m, required - available);

                return new PredictivePlanningResourceGapDto(
                    group.Key,
                    Math.Round(required, 2, MidpointRounding.AwayFromZero),
                    Math.Round(available, 2, MidpointRounding.AwayFromZero),
                    Math.Round(gap, 2, MidpointRounding.AwayFromZero));
            })
            .Where(item => item.PredictedGapQuantity > 0m)
            .OrderByDescending(item => item.PredictedGapQuantity)
            .Take(8)
            .ToArray();

        var riskLevel = predictedShortfallQuantity switch
        {
            > 80m => "critical",
            > 30m => "watch",
            _ => "stable"
        };

        var recommendations = new List<string>();
        if (predictedShortfallQuantity > 0m)
        {
            recommendations.Add($"Pre-stage mutual aid and logistics sourcing for projected shortfall of {predictedShortfallQuantity.ToString("F1", CultureInfo.InvariantCulture)} units.");
        }
        if (highPriorityOpenTaskCount > 0)
        {
            recommendations.Add($"Prioritize fulfillment alignment for {highPriorityOpenTaskCount} high-priority open task(s) in the next {request.HorizonHours}h window.");
        }
        if (shortageByResourceType.Length > 0)
        {
            recommendations.Add($"Initiate targeted acquisition for top constrained resource type {shortageByResourceType[0].ResourceTypeCode}.");
        }
        if (availableBeds < 20)
        {
            recommendations.Add("Coordinate healthcare surge posture and bed transfer planning due to low currently available beds.");
        }
        if (recommendations.Count == 0)
        {
            recommendations.Add("Maintain current operational tempo and continue 24h demand/supply monitoring cadence.");
        }

        var lowerConfidence = Math.Min(_options.ConfidenceIntervalLower, _options.ConfidenceIntervalUpper);
        var upperConfidence = Math.Max(_options.ConfidenceIntervalLower, _options.ConfidenceIntervalUpper);

        return Task.FromResult(new PredictivePlanningResultDto(
            _options.ModelId,
            _options.ModelVersion,
            _options.TrainedAtUtc,
            new PredictivePlanningConfidenceIntervalDto(lowerConfidence, upperConfidence),
            _options.DriftStatus,
            demandPressureIndex,
            supplyReadinessIndex,
            riskLevel,
            projectedDemandQuantity,
            projectedSupplyQuantity,
            predictedShortfallQuantity,
            shortageByResourceType,
            recommendations,
            [
                "Forecast uses current open tasks/objectives, unresolved resource requests, current inventory, and available bed capacity.",
                "Decision-support output requires command review prior to operational execution.",
                "Horizon scaling assumes linear intake pressure and partial supply replenishment within forecast window."
            ],
            DateTimeOffset.UtcNow));
    }

    public PredictivePlanningOperationalAcceptanceResultDto EvaluateOperationalAcceptance(PredictivePlanningResultDto result)
    {
        var violations = new List<string>();

        if (!_options.EnforceOperationalGovernance)
        {
            return new PredictivePlanningOperationalAcceptanceResultDto(
                true,
                "Predictive governance enforcement is disabled by configuration.",
                violations,
                DateTimeOffset.UtcNow);
        }

        if (result.ConfidenceInterval.Lower < _options.MinOperationalConfidenceLower)
        {
            violations.Add($"Confidence lower bound {result.ConfidenceInterval.Lower:F2} is below minimum {_options.MinOperationalConfidenceLower:F2}.");
        }

        var allowedStatuses = (_options.AllowedOperationalDriftStatuses ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (allowedStatuses.Count > 0 && !allowedStatuses.Contains(result.DriftStatus.Trim().ToLowerInvariant()))
        {
            violations.Add($"Drift status '{result.DriftStatus}' is outside allowed operational statuses ({string.Join(", ", allowedStatuses)}).");
        }

        var allowed = violations.Count == 0;
        var reason = allowed
            ? "Predictive output meets operational governance thresholds."
            : "Predictive output did not meet operational governance thresholds.";

        return new PredictivePlanningOperationalAcceptanceResultDto(
            allowed,
            reason,
            violations,
            DateTimeOffset.UtcNow);
    }
}
