/**
 * useProvinceAdvisories — TanStack Query hook for province weather advisories.
 * Phase 9 — split-pane map layout.
 *
 * Advisories require a registered location UUID to query by location.
 * Coordinates alone are insufficient — the advisory engine filters by location_id
 * in the weather_observations table.  When no real location UUID is available
 * the query is skipped and the panel shows an empty advisory list.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { ProvinceRiskTarget } from "./useProvinceRisk";

const ADVISORY_STALE_TIME = 1000 * 30;  // 30 s
const ADVISORY_GC_TIME    = 1000 * 60 * 5; // 5 min

async function fetchAdvisories(locationId: string, language = "vi") {
  return apiClient.get<{
    data: {
      data: readonly {
        advisoryId: string;
        locationId: string;
        observedAt: string;
        kind: "wind" | "precipitation" | "visibility" | "thunderstorm";
        severity: "info" | "caution" | "high";
        metricValue: number;
        thresholdValue: number;
        unit: "m/s" | "mm" | "m";
        language: "vi" | "en";
      }[];
      evaluatedAt: string;
      correlationId: string;
      activeRuleSetVersion: number | null;
    };
  }>(`/advisories/by-location/${encodeURIComponent(locationId)}?language=${language}`);
}

/** Returns "unknown" (query skipped) when no real location UUID is available. */
export function useProvinceAdvisories(
  target: ProvinceRiskTarget,
  language: "vi" | "en" = "vi"
) {
  const { locationId } = target;
  const hasRealUuid = Boolean(locationId) && isUuid(locationId);

  return useQuery({
    queryKey: ["province-advisories", locationId, language] as const,
    queryFn: () => {
      if (!hasRealUuid) throw new Error("locationId is required for advisories");
      return fetchAdvisories(locationId!, language);
    },
    enabled: hasRealUuid,
    staleTime: ADVISORY_STALE_TIME,
    gcTime: ADVISORY_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Strict UUID v4 pattern used by the backend `isUuid()` guard */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(value: string | undefined | null): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}
