/**
 * useProvinceRisk — TanStack Query hook for province risk assessment.
 * Phase 9 — split-pane map layout.
 *
 * Risk assessment requires a registered location UUID — coordinates alone are not
 * sufficient because the risk engine reads from weather_observations filtered by
 * location_id.  When no real location UUID is available the query is skipped
 * (shown as "unknown" in the panel).  Once a /locations lookup endpoint is
 * implemented this hook should be updated to resolve coordinates → location UUID
 * and use the resolved ID.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { RiskAssessmentResponse } from "@vietnam-weather/contracts";

const RISK_STALE_TIME = 1000 * 60 * 5;   // 5 min
const RISK_GC_TIME    = 1000 * 60 * 30; // 30 min

async function fetchRisk(locationId: string) {
  return apiClient.post<{ data: RiskAssessmentResponse }>(
    "/risk/assess",
    { location_id: locationId }
  );
}

export interface ProvinceRiskTarget {
  /** Registered location UUID. Required for risk assessment. */
  locationId?: string;
}

/**
 * Returns "unknown" (query skipped) when no real location UUID is available.
 * This prevents the API from rejecting province codes as invalid UUIDs.
 */
export function useProvinceRisk(target: ProvinceRiskTarget) {
  const { locationId } = target;
  const hasRealUuid = Boolean(locationId) && isUuid(locationId);

  return useQuery({
    queryKey: ["province-risk", locationId] as const,
    queryFn: () => {
      if (!hasRealUuid) throw new Error("locationId is required for risk assessment");
      return fetchRisk(locationId!);
    },
    enabled: hasRealUuid,
    staleTime: RISK_STALE_TIME,
    gcTime: RISK_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Strict UUID v4 pattern used by the backend `isUuid()` guard */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(value: string | undefined | null): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}
