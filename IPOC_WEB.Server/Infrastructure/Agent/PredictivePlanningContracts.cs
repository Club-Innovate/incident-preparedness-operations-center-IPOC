/*
File: IPOC_WEB.Server/Infrastructure/Agent/PredictivePlanningContracts.cs
Blueprint Name: AgentPredictivePlanningContracts

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2026-07-10
Updated: 2026-07-12

Description:
Contracts for predictive demand/supply planning model inputs and outputs.

Features:
  - Request contract for predictive horizon and incident context.
  - Response contract with model governance metadata.
  - Resource gap contract for shortage-specific recommendations.

Security & Compliance:
  - Keeps model metadata explicit for auditability and model governance.
  - Separates model inference boundary from API transport concerns.
*/

namespace IPOC_WEB.Server.Infrastructure.Agent;

public sealed record PredictivePlanningRequestDto(
    long IncidentId,
    string IncidentNumber,
    string IncidentName,
    int HorizonHours,
    IReadOnlyList<IncidentPredictiveTaskFeatureDto> Tasks,
    IReadOnlyList<IncidentPredictiveObjectiveFeatureDto> Objectives,
    IReadOnlyList<IncidentPredictiveResourceRequestFeatureDto> ResourceRequests,
    IReadOnlyList<PredictiveResourceInventoryFeatureDto> ResourceInventory,
    IReadOnlyList<PredictiveBedAvailabilityFeatureDto> BedAvailability);

public sealed record IncidentPredictiveTaskFeatureDto(
    string PriorityCode,
    string StatusCode);

public sealed record IncidentPredictiveObjectiveFeatureDto(
    string StatusCode);

public sealed record IncidentPredictiveResourceRequestFeatureDto(
    string ResourceTypeCode,
    decimal RequestedQuantity,
    decimal? AssignedQuantity,
    string StatusCode);

public sealed record PredictiveResourceInventoryFeatureDto(
    string ResourceTypeCode,
    decimal QuantityAvailable);

public sealed record PredictiveBedAvailabilityFeatureDto(
    int? BedsAvailable);

public sealed record PredictivePlanningConfidenceIntervalDto(
    decimal Lower,
    decimal Upper);

public sealed record PredictivePlanningResourceGapDto(
    string ResourceTypeCode,
    decimal RequestedOutstandingQuantity,
    decimal AvailableQuantity,
    decimal PredictedGapQuantity);

public sealed record PredictivePlanningResultDto(
    string ModelId,
    string ModelVersion,
    DateTimeOffset TrainedAtUtc,
    PredictivePlanningConfidenceIntervalDto ConfidenceInterval,
    string DriftStatus,
    int DemandPressureIndex,
    int SupplyReadinessIndex,
    string RiskLevel,
    decimal ProjectedDemandQuantity,
    decimal ProjectedSupplyQuantity,
    decimal PredictedShortfallQuantity,
    IReadOnlyList<PredictivePlanningResourceGapDto> ShortageByResourceType,
    IReadOnlyList<string> Recommendations,
    IReadOnlyList<string> Assumptions,
    DateTimeOffset GeneratedUtc);

public sealed record PredictivePlanningOperationalAcceptanceResultDto(
    bool Allowed,
    string Reason,
    IReadOnlyList<string> Violations,
    DateTimeOffset EvaluatedUtc);
