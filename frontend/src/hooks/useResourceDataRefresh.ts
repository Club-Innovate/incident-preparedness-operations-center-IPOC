import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getBedAvailability, getResourceInventory } from '../api';
import type { NotifyHandler } from '../notifications/types';
import type { BedAvailabilityItem, ResourceInventoryItem } from '../types';

type ResourceDataRefreshDeps = {
  isAuthenticated: boolean;
  selectedInventoryId: number | null;
  bedLocationIdInput: string;
  setResourceInventory: Dispatch<SetStateAction<ResourceInventoryItem[]>>;
  setBedAvailability: Dispatch<SetStateAction<BedAvailabilityItem[]>>;
  setResourceLoading: Dispatch<SetStateAction<boolean>>;
  setSelectedInventoryId: Dispatch<SetStateAction<number | null>>;
  setBedLocationIdInput: Dispatch<SetStateAction<string>>;
  onNotify: NotifyHandler;
};

export function useResourceDataRefresh(deps: ResourceDataRefreshDeps) {
  const refreshResources = useCallback(async () => {
    if (!deps.isAuthenticated) {
      deps.setResourceInventory([]);
      deps.setBedAvailability([]);
      return;
    }

    try {
      deps.setResourceLoading(true);
      const [inventory, beds] = await Promise.all([
        getResourceInventory(),
        getBedAvailability(),
      ]);

      deps.setResourceInventory(inventory);
      deps.setBedAvailability(beds);

      if (inventory.length > 0 && deps.selectedInventoryId === null) {
        deps.setSelectedInventoryId(inventory[0].locationResourceInventoryId);
      }

      if (beds.length > 0 && deps.bedLocationIdInput.length === 0) {
        deps.setBedLocationIdInput(String(beds[0].locationId));
      }
    } catch (resourceError) {
      const message = resourceError instanceof Error ? resourceError.message : 'Unable to load resource and bed data.';
      deps.onNotify(message, 'danger');
    } finally {
      deps.setResourceLoading(false);
    }
  }, [
    deps.bedLocationIdInput,
    deps.isAuthenticated,
    deps.onNotify,
    deps.selectedInventoryId,
    deps.setBedAvailability,
    deps.setBedLocationIdInput,
    deps.setResourceInventory,
    deps.setResourceLoading,
    deps.setSelectedInventoryId,
  ]);

  return {
    refreshResources,
  };
}
