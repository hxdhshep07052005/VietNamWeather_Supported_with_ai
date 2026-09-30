import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { findVietnamProvinceByName, type VehicleType, type ReportPointResponse } from "@vietnam-weather/contracts";
import { apiClient } from "@/api/client";
import { getAllProvincesData, type ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";
import { reportRiskDisplay, reportMeasurements } from "@/utils/reportRisk";

interface OverviewResponse {
  data: { target_time: string; provinces: Array<{ id: string; name: string } & ReportPointResponse> };
}

/** Shared cache, one request per view, cancellation and debounced timeline. */
export function useReportProvinceWeather(offsetHours: number, vehicle?: VehicleType): ProvinceGeoFeatureProperties[] {
  const [offset, setOffset] = useState(offsetHours);
  useEffect(() => {
    const timer = setTimeout(() => setOffset(offsetHours), 300);
    return () => clearTimeout(timer);
  }, [offsetHours]);
  const query = useQuery({
    queryKey: ["report-provinces", offset, vehicle ?? ""],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ offset_hours: String(offset) });
      if (vehicle) params.set("vehicle", vehicle);
      return apiClient.get<OverviewResponse>(`/risk/report-provinces?${params}`, { signal });
    },
    staleTime: 60000,
    refetchInterval: 120000,
    retry: (count, error) => count < 2 && ((error as { status?: number }).status === 429 || (error as { status?: number }).status === 503),
    retryDelay: (_attempt, error) => {
      const seconds = (error as { retryAfterSeconds?: number }).retryAfterSeconds;
      return Number.isFinite(seconds) ? Math.max(1000, seconds! * 1000) : 60000;
    },
  });
  const points = new Map(query.data?.data.provinces.map(p => [p.id, p]));
  return getAllProvincesData().map(province => {
    const source = findVietnamProvinceByName(province.name);
    const point = source ? points.get(source.id) : undefined;
    if (query.isError || !point || offset !== offsetHours) return { ...province, dataState: query.isError ? "error" as const : "loading" as const };
    return {
      ...province, ...reportMeasurements(point.weather), ...reportRiskDisplay(point.assessment),
      assessment: point.assessment, freshnessState: point.weather.freshness,
      weatherTargetTime: query.data?.data.target_time,
      dataState: point.weather.reasons.includes("weather_query_failed") ? "error" as const : "ready" as const,
      riskText: reportRiskDisplay(point.assessment).riskText,
    };
  });
}
