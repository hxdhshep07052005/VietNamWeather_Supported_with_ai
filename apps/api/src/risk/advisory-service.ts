/**
 * Phase 6 advisory service.
 *
 * Translates the latest observation-level signals into a typed list of
 * advisory records the right-hand info panel can render. The thresholds
 * live in `weather/constants.ts` so they can move to Directus later
 * without changing the response shape.
 *
 * Important: this module never invents advisory text. If the DB has
 * no rows matching the severe-condition set, the response is an empty
 * list with the correct `evaluated_at` timestamp. The front-end renders
 * the i18n key `infoPanel.advisories.empty` when the list is empty.
 */
import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { SEVERE_CONDITION_THRESHOLDS } from "../weather/constants.js";

export type AdvisorySeverity = "info" | "caution" | "high";
export type AdvisoryKind =
  | "wind"
  | "precipitation"
  | "visibility"
  | "thunderstorm";

export interface Advisory {
  readonly advisoryId: string;
  readonly locationId: string;
  readonly observedAt: string;
  readonly kind: AdvisoryKind;
  readonly severity: AdvisorySeverity;
  readonly metricValue: number;
  readonly thresholdValue: number;
  readonly unit: "m/s" | "mm" | "m";
  readonly language: "vi" | "en";
}

export interface AdvisoryListResponse {
  readonly data: readonly Advisory[];
  readonly evaluatedAt: string;
  readonly correlationId: string;
  readonly activeRuleSetVersion: number | null;
}

export interface AdvisoryServiceOptions {
  readonly dbPool: Pool;
  readonly cacheTtlSeconds?: number;
}

interface CachedAdvisory {
  readonly response: AdvisoryListResponse;
  readonly cachedAt: number;
}

interface ObservationRow {
  readonly location_id: string;
  readonly observed_at: string;
  readonly temp_c: number | null;
  readonly wind_speed: number | null;
  readonly wind_gust: number | null;
  readonly vis_km: number | null;
  readonly precip_mm: number | null;
  readonly condition_code: number | null;
}

const DEFAULT_LANGUAGE: "vi" | "en" = "vi";

export class AdvisoryService {
  readonly #dbPool: Pool;
  readonly #cacheTtlSeconds: number;
  #cache: CachedAdvisory | null = null;

  constructor(options: AdvisoryServiceOptions) {
    this.#dbPool = options.dbPool;
    this.#cacheTtlSeconds = options.cacheTtlSeconds ?? 30;
  }

  async listAdvisoriesForLocation(
    locationId: string,
    language: "vi" | "en" = DEFAULT_LANGUAGE,
    correlationId: string = randomUUID()
  ): Promise<AdvisoryListResponse> {
    if (this.#cache !== null && Date.now() - this.#cache.cachedAt < this.#cacheTtlSeconds * 1000) {
      const filtered = this.#cache.response.data.filter((entry) => entry.locationId === locationId);
      return {
        data: filtered,
        evaluatedAt: this.#cache.response.evaluatedAt,
        correlationId,
        activeRuleSetVersion: this.#cache.response.activeRuleSetVersion
      };
    }

    const ruleSetVersion = await this.#loadActiveRuleSetVersion();
    const observed = await this.#loadLatestObservation(locationId);
    const advisories = observed ? this.#buildAdvisories(observed, language) : [];
    const response: AdvisoryListResponse = {
      data: advisories,
      evaluatedAt: new Date().toISOString(),
      correlationId,
      activeRuleSetVersion: ruleSetVersion
    };
    return response;
  }

  async listAllAdvisories(
    language: "vi" | "en" = DEFAULT_LANGUAGE,
    correlationId: string = randomUUID()
  ): Promise<AdvisoryListResponse> {
    if (this.#cache !== null && Date.now() - this.#cache.cachedAt < this.#cacheTtlSeconds * 1000) {
      return { ...this.#cache.response, correlationId };
    }
    const ruleSetVersion = await this.#loadActiveRuleSetVersion();
    const rows = await this.#loadLatestObservationsAll();
    const advisories = rows.flatMap((row) => this.#buildAdvisories(row, language));
    const response: AdvisoryListResponse = {
      data: advisories,
      evaluatedAt: new Date().toISOString(),
      correlationId,
      activeRuleSetVersion: ruleSetVersion
    };
    this.#cache = { response, cachedAt: Date.now() };
    return response;
  }

  async #loadActiveRuleSetVersion(): Promise<number | null> {
    try {
      const result = await this.#dbPool.query<{ version: number }>(
        `SELECT version FROM risk_rule_sets
         WHERE status = 'published'
           AND (effective_from IS NULL OR effective_from <= NOW())
           AND (effective_to IS NULL OR effective_to >= NOW())
         ORDER BY version DESC
         LIMIT 1`
      );
      return result.rows[0]?.version ?? null;
    } catch {
      return null;
    }
  }

  async #loadLatestObservation(locationId: string): Promise<ObservationRow | null> {
    try {
      const result = await this.#dbPool.query<ObservationRow>(
        `SELECT location_id::text AS location_id,
                observed_at,
                temp_c,
                wind_speed_mps AS wind_speed,
                wind_gust_mps AS wind_gust,
                visibility_meters / 1000.0 AS vis_km,
                precipitation_mm AS precip_mm,
                condition_code::int AS condition_code
           FROM app_weather.weather_observations
          WHERE location_id = $1::uuid
          ORDER BY observed_at DESC
          LIMIT 1`,
        [locationId]
      );
      return result.rows[0] ?? null;
    } catch {
      return null;
    }
  }

  async #loadLatestObservationsAll(): Promise<readonly ObservationRow[]> {
    try {
      const result = await this.#dbPool.query<ObservationRow>(
        `SELECT DISTINCT ON (location_id)
                location_id::text AS location_id,
                observed_at,
                temp_c,
                wind_speed_mps AS wind_speed,
                wind_gust_mps AS wind_gust,
                visibility_meters / 1000.0 AS vis_km,
                precipitation_mm AS precip_mm,
                condition_code::int AS condition_code
           FROM app_weather.weather_observations
          ORDER BY location_id, observed_at DESC`
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  #buildAdvisories(row: ObservationRow, language: "vi" | "en"): readonly Advisory[] {
    const out: Advisory[] = [];
    const windSpeed = row.wind_speed ?? 0;
    const windGust = row.wind_gust ?? windSpeed;
    const windPeak = Math.max(windSpeed, windGust);
    if (windPeak >= SEVERE_CONDITION_THRESHOLDS.windSpeedMetresPerSecond) {
      out.push({
        advisoryId: randomUUID(),
        locationId: row.location_id,
        observedAt: row.observed_at,
        kind: "wind",
        severity: windPeak >= SEVERE_CONDITION_THRESHOLDS.windSpeedMetresPerSecond * 1.5 ? "high" : "caution",
        metricValue: round(windPeak, 1),
        thresholdValue: SEVERE_CONDITION_THRESHOLDS.windSpeedMetresPerSecond,
        unit: "m/s",
        language
      });
    }

    const precipMm = row.precip_mm ?? 0;
    if (precipMm >= SEVERE_CONDITION_THRESHOLDS.precipitationMillimetres) {
      out.push({
        advisoryId: randomUUID(),
        locationId: row.location_id,
        observedAt: row.observed_at,
        kind: "precipitation",
        severity: precipMm >= SEVERE_CONDITION_THRESHOLDS.precipitationMillimetres * 1.5 ? "high" : "caution",
        metricValue: round(precipMm, 1),
        thresholdValue: SEVERE_CONDITION_THRESHOLDS.precipitationMillimetres,
        unit: "mm",
        language
      });
    }

    const visMetres = row.vis_km !== null ? Math.round(row.vis_km * 1000) : Number.POSITIVE_INFINITY;
    if (visMetres <= SEVERE_CONDITION_THRESHOLDS.visibilityMetres) {
      out.push({
        advisoryId: randomUUID(),
        locationId: row.location_id,
        observedAt: row.observed_at,
        kind: "visibility",
        severity: visMetres <= SEVERE_CONDITION_THRESHOLDS.visibilityMetres / 2 ? "high" : "caution",
        metricValue: round(visMetres, 0),
        thresholdValue: SEVERE_CONDITION_THRESHOLDS.visibilityMetres,
        unit: "m",
        language
      });
    }

    if (row.condition_code !== null && SEVERE_CONDITION_THRESHOLDS.thunderstormConditionCodes.includes(row.condition_code)) {
      out.push({
        advisoryId: randomUUID(),
        locationId: row.location_id,
        observedAt: row.observed_at,
        kind: "thunderstorm",
        severity: "high",
        metricValue: row.condition_code,
        thresholdValue: SEVERE_CONDITION_THRESHOLDS.thunderstormConditionCodes[0] ?? 1087,
        unit: "m/s",
        language
      });
    }
    return out;
  }
}

  /**
   * Register Fastify routes for advisories.
   */
  registerAdvisoryRoutes(
    app: FastifyInstance,
    _options: { readonly correlationIdFn: (request: { id: string }) => string }
  ): void {
    app.get("/api/v1/advisories", async (request) => {
      const query = request.query as Record<string, string | undefined>;
      const language = (query.language as "vi" | "en") ?? "vi";
      const result = await this.listAllAdvisories(language);
      return { data: result };
    });

    app.get("/api/v1/advisories/by-location/:locationId", async (request, reply) => {
      const params = request.params as Record<string, string>;
      const query = request.query as Record<string, string | undefined>;
      const locationId = params.locationId;
      const language = (query.language as "vi" | "en") ?? "vi";
      const result = await this.listAdvisoriesForLocation(locationId, language);
      reply.header("cache-control", `private, max-age=${this.#cacheTtlSeconds}`);
      return { data: result };
    });
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function createAdvisoryService(options: AdvisoryServiceOptions): AdvisoryService {
  return new AdvisoryService(options);
}
