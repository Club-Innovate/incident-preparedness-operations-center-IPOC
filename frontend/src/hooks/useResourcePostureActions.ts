import { addBedAvailability, updateResourceInventory } from '../api';
import type { NotifyHandler } from '../notifications/types';

type ResourcePostureActionDeps = {
  isAuthenticated: boolean;
  selectedInventoryId: number | null;
  bedLocationIdInput: string;
  resourceTotalInput: string;
  resourceAvailableInput: string;
  resourceCommittedInput: string;
  resourceOutOfServiceInput: string;
  bedStaffedInput: string;
  bedAvailableInput: string;
  bedOccupiedInput: string;
  bedUnavailableInput: string;
  bedIsolationInput: string;
  bedSurgeInput: string;
  refreshResources: () => Promise<void>;
  onNotify: NotifyHandler;
};

export function useResourcePostureActions(deps: ResourcePostureActionDeps) {
  const handleUpdateInventory = async () => {
    if (!deps.isAuthenticated || deps.selectedInventoryId === null) {
      deps.onNotify('Sign in and select an inventory row before updating.', 'warning');
      return;
    }

    const parseOptionalDecimal = (value: string, fieldLabel: string): number | null | undefined => {
      if (value.trim().length === 0) {
        return undefined;
      }

      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        deps.onNotify(`${fieldLabel} must be a non-negative number.`, 'warning');
        return null;
      }

      return parsed;
    };

    const quantityTotal = parseOptionalDecimal(deps.resourceTotalInput, 'Total quantity');
    if (quantityTotal === null) {
      return;
    }

    const quantityAvailable = parseOptionalDecimal(deps.resourceAvailableInput, 'Available quantity');
    if (quantityAvailable === null) {
      return;
    }

    const quantityCommitted = parseOptionalDecimal(deps.resourceCommittedInput, 'Committed quantity');
    if (quantityCommitted === null) {
      return;
    }

    const quantityOutOfService = parseOptionalDecimal(deps.resourceOutOfServiceInput, 'Out-of-service quantity');
    if (quantityOutOfService === null) {
      return;
    }

    if (quantityTotal === undefined
      && quantityAvailable === undefined
      && quantityCommitted === undefined
      && quantityOutOfService === undefined) {
      deps.onNotify('Enter at least one resource quantity field before submitting.', 'warning');
      return;
    }

    try {
      await updateResourceInventory(deps.selectedInventoryId, {
        quantityTotal,
        quantityAvailable,
        quantityCommitted,
        quantityOutOfService,
      });

      deps.onNotify('Resource inventory updated.', 'success');
      await deps.refreshResources();
    } catch (resourceUpdateError) {
      const message = resourceUpdateError instanceof Error ? resourceUpdateError.message : 'Unable to update resource inventory.';
      deps.onNotify(message, 'danger');
    }
  };

  const handleAddBedSnapshot = async () => {
    if (!deps.isAuthenticated) {
      deps.onNotify('Sign in before submitting bed availability.', 'warning');
      return;
    }

    const locationId = Number(deps.bedLocationIdInput);

    if (!Number.isInteger(locationId) || locationId <= 0) {
      deps.onNotify('Enter a valid location ID for bed availability submission.', 'warning');
      return;
    }

    const parseOptionalInt = (value: string, fieldLabel: string): number | null | undefined => {
      if (value.trim().length === 0) {
        return undefined;
      }

      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        deps.onNotify(`${fieldLabel} must be a non-negative whole number.`, 'warning');
        return null;
      }

      return parsed;
    };

    const staffedBedsTotal = parseOptionalInt(deps.bedStaffedInput, 'Staffed beds');
    if (staffedBedsTotal === null) {
      return;
    }

    const bedsAvailable = parseOptionalInt(deps.bedAvailableInput, 'Beds available');
    if (bedsAvailable === null) {
      return;
    }

    const bedsOccupied = parseOptionalInt(deps.bedOccupiedInput, 'Beds occupied');
    if (bedsOccupied === null) {
      return;
    }

    const bedsUnavailable = parseOptionalInt(deps.bedUnavailableInput, 'Beds unavailable');
    if (bedsUnavailable === null) {
      return;
    }

    const isolationCapableBeds = parseOptionalInt(deps.bedIsolationInput, 'Isolation-capable beds');
    if (isolationCapableBeds === null) {
      return;
    }

    const surgeBedsPotential = parseOptionalInt(deps.bedSurgeInput, 'Surge beds potential');
    if (surgeBedsPotential === null) {
      return;
    }

    if (staffedBedsTotal === undefined
      && bedsAvailable === undefined
      && bedsOccupied === undefined
      && bedsUnavailable === undefined
      && isolationCapableBeds === undefined
      && surgeBedsPotential === undefined) {
      deps.onNotify('Enter at least one bed field before submitting.', 'warning');
      return;
    }

    try {
      await addBedAvailability(locationId, {
        staffedBedsTotal,
        bedsAvailable,
        bedsOccupied,
        bedsUnavailable,
        isolationCapableBeds,
        surgeBedsPotential,
      });

      deps.onNotify('Bed availability snapshot submitted.', 'success');
      await deps.refreshResources();
    } catch (bedError) {
      const message = bedError instanceof Error ? bedError.message : 'Unable to submit bed availability snapshot.';
      deps.onNotify(message, 'danger');
    }
  };

  return {
    handleUpdateInventory,
    handleAddBedSnapshot,
  };
}
