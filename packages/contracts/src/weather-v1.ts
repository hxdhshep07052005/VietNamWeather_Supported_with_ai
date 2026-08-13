import { weatherV1Schemas } from "./openapi-v1.js";
import type { JsonSchema } from "./openapi-v1.js";

export type WeatherDataset = "current" | "hourly" | "daily";
export type WeatherFreshnessState = "fresh" | "stale" | "expired" | "unavailable";
export type WeatherConditionCode =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy_rain"
  | "thunderstorm"
  | "sleet"
  | "snow"
  | "hail"
  | "unknown";

export interface WeatherUnits {
  readonly temperature: "celsius";
  readonly windSpeed: "metres_per_second";
  readonly precipitation: "millimetres";
  readonly pressure: "hectopascals";
  readonly visibility: "metres";
  readonly relativeHumidity: "percent";
  readonly probability: "percent";
  readonly direction: "degrees";
}

export interface Attribution {
  readonly name: string;
  readonly url: string;
}

export interface SourceIdentity {
  readonly provider: string;
  readonly attribution: Attribution;
}

export interface ValidInterval {
  readonly from: string;
  readonly to: string;
}

export interface FeatureAccountCapability {
  readonly supported: boolean;
  readonly verifiedAt: string | null;
  readonly maximumHorizonHours: number | null;
}

export interface FeatureEntitlement {
  readonly allowed: boolean;
  readonly maximumHorizonHours: number | null;
}

export interface FeatureProviderCoverage {
  readonly available: boolean;
  readonly maximumHorizonHours: number | null;
}

export interface FreshnessPolicy {
  readonly freshForSeconds: number | null;
  readonly staleDisplayForSeconds: number | null;
  readonly staleDisplayEligible: boolean;
  readonly staleRiskEligible: false;
  readonly staleRouteEligible: false;
}

export interface WeatherFeatureCapability {
  readonly enabled: boolean;
  readonly granularityMinutes: number | null;
  readonly account: FeatureAccountCapability;
  readonly entitlement: FeatureEntitlement;
  readonly providerCoverage: FeatureProviderCoverage;
  readonly operationalMaximumHorizonHours: number;
  readonly effectiveMaximumHorizonHours: number;
  readonly freshnessPolicy: FreshnessPolicy;
}

export interface WeatherCapabilities {
  readonly apiVersion: "v1";
  readonly updatedAt: string;
  readonly canonicalTimezone: "Asia/Ho_Chi_Minh";
  readonly units: WeatherUnits;
  readonly fallback: "none";
  readonly providerMixing: false;
  readonly operationalMaximumHorizonHours: 72;
  readonly source: SourceIdentity;
  readonly features: {
    readonly current: WeatherFeatureCapability;
    readonly hourly: WeatherFeatureCapability;
    readonly daily: WeatherFeatureCapability;
    readonly nowcast: WeatherFeatureCapability;
    readonly alerts: WeatherFeatureCapability;
    readonly spatialLayers: WeatherFeatureCapability;
  };
}

export interface WeatherCapabilitiesResponse {
  readonly status: "success";
  readonly data: WeatherCapabilities;
  readonly correlationId: string;
}

export interface LocationIdWeatherTarget {
  readonly locationId: string;
}

export interface CoordinateWeatherTarget {
  readonly coordinates: {
    readonly latitude: number;
    readonly longitude: number;
  };
}

export type WeatherQueryTarget = LocationIdWeatherTarget | CoordinateWeatherTarget;

export interface WeatherQueryRequest {
  readonly target: WeatherQueryTarget;
  readonly include: readonly WeatherDataset[];
}

export interface ResolvedWeatherTarget {
  readonly locationId: string | null;
  readonly timezone: "Asia/Ho_Chi_Minh";
}

export type NormalizedWeatherField =
  | "temperatureCelsius"
  | "apparentTemperatureCelsius"
  | "minimumTemperatureCelsius"
  | "maximumTemperatureCelsius"
  | "relativeHumidityPercent"
  | "averageRelativeHumidityPercent"
  | "windSpeedMetresPerSecond"
  | "windGustMetresPerSecond"
  | "maximumWindSpeedMetresPerSecond"
  | "windDirectionDegrees"
  | "precipitationMillimetres"
  | "precipitationProbabilityPercent"
  | "maximumPrecipitationProbabilityPercent"
  | "pressureHectopascals"
  | "visibilityMetres"
  | "uvIndex"
  | "cloudCoverPercent"
  | "conditionCode";

export interface WeatherQuality {
  readonly state: "complete" | "partial";
  readonly missingFields: readonly NormalizedWeatherField[];
}

export interface WeatherProvenance {
  readonly provider: string;
  readonly parserVersion: string;
  readonly snapshotId: string;
  readonly providerIssuedAt: string | null;
  readonly fetchedAt: string;
  readonly expiresAt: string;
}

export interface WeatherFreshness {
  readonly state: WeatherFreshnessState;
  readonly assessedAt: string;
  readonly freshUntil: string | null;
  readonly staleUntil: string | null;
  readonly displayEligible: boolean;
  readonly riskEligible: boolean;
  readonly routeEligible: boolean;
}

export interface DatasetCoverage {
  readonly dataset: WeatherDataset;
  readonly status: "complete" | "partial" | "unavailable" | "not_requested";
  readonly validInterval: ValidInterval | null;
  readonly expectedIntervals: number | null;
  readonly returnedIntervals: number;
  readonly gaps: readonly ValidInterval[];
}

export interface WeatherQueryCoverage {
  readonly requested: readonly WeatherDataset[];
  readonly effectiveHorizonHours: number;
  readonly datasets: {
    readonly current: DatasetCoverage;
    readonly hourly: DatasetCoverage;
    readonly daily: DatasetCoverage;
  };
}

export interface CurrentWeatherValue {
  readonly kind: "observation";
  readonly observedAt: string;
  readonly validInterval: ValidInterval;
  readonly quality: WeatherQuality;
  readonly temperatureCelsius: number | null;
  readonly apparentTemperatureCelsius: number | null;
  readonly relativeHumidityPercent: number | null;
  readonly windSpeedMetresPerSecond: number | null;
  readonly windGustMetresPerSecond: number | null;
  readonly windDirectionDegrees: number | null;
  readonly precipitationMillimetres: number | null;
  readonly pressureHectopascals: number | null;
  readonly visibilityMetres: number | null;
  readonly uvIndex: number | null;
  readonly cloudCoverPercent: number | null;
  readonly conditionCode: WeatherConditionCode | null;
}

export interface HourlyWeatherValue {
  readonly kind: "forecast";
  readonly validInterval: ValidInterval;
  readonly quality: WeatherQuality;
  readonly temperatureCelsius: number | null;
  readonly apparentTemperatureCelsius: number | null;
  readonly relativeHumidityPercent: number | null;
  readonly windSpeedMetresPerSecond: number | null;
  readonly windGustMetresPerSecond: number | null;
  readonly windDirectionDegrees: number | null;
  readonly precipitationMillimetres: number | null;
  readonly pressureHectopascals: number | null;
  readonly visibilityMetres: number | null;
  readonly uvIndex: number | null;
  readonly cloudCoverPercent: number | null;
  readonly conditionCode: WeatherConditionCode | null;
  readonly precipitationProbabilityPercent: number | null;
}

export interface DailyWeatherValue {
  readonly kind: "forecast";
  readonly date: string;
  readonly validInterval: ValidInterval;
  readonly quality: WeatherQuality;
  readonly minimumTemperatureCelsius: number | null;
  readonly maximumTemperatureCelsius: number | null;
  readonly precipitationMillimetres: number | null;
  readonly maximumPrecipitationProbabilityPercent: number | null;
  readonly maximumWindSpeedMetresPerSecond: number | null;
  readonly averageRelativeHumidityPercent: number | null;
  readonly conditionCode: WeatherConditionCode | null;
}

export interface CurrentWeatherSection {
  readonly provenance: WeatherProvenance;
  readonly freshness: WeatherFreshness;
  readonly coverage: DatasetCoverage;
  readonly value: CurrentWeatherValue;
}

export interface HourlyWeatherSection {
  readonly provenance: WeatherProvenance;
  readonly freshness: WeatherFreshness;
  readonly coverage: DatasetCoverage;
  readonly values: readonly HourlyWeatherValue[];
}

export interface DailyWeatherSection {
  readonly provenance: WeatherProvenance;
  readonly freshness: WeatherFreshness;
  readonly coverage: DatasetCoverage;
  readonly values: readonly DailyWeatherValue[];
}

export interface WeatherQueryData {
  readonly target: ResolvedWeatherTarget;
  readonly units: WeatherUnits;
  readonly providerMixing: false;
  readonly attribution: Attribution;
  readonly coverage: WeatherQueryCoverage;
  readonly current: CurrentWeatherSection | null;
  readonly hourly: HourlyWeatherSection | null;
  readonly daily: DailyWeatherSection | null;
}

export interface WeatherQuerySuccessResponse {
  readonly status: "success";
  readonly data: WeatherQueryData;
  readonly correlationId: string;
}

export type WeatherDegradedIssueCode =
  | "CURRENT_UNAVAILABLE"
  | "HOURLY_PARTIAL"
  | "DAILY_PARTIAL"
  | "STALE_DATA"
  | "COVERAGE_REDUCED";

export interface WeatherDegradedIssue {
  readonly code: WeatherDegradedIssueCode;
  readonly dataset: WeatherDataset | null;
  readonly retryable: boolean;
}

export interface WeatherQueryDegradedResponse {
  readonly status: "degraded";
  readonly data: WeatherQueryData;
  readonly issues: readonly WeatherDegradedIssue[];
  readonly correlationId: string;
}

export interface WeatherQueryPendingResponse {
  readonly status: "pending";
  readonly retryAfterSeconds: number;
  readonly correlationId: string;
}

export type WeatherErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "CSRF_VALIDATION_FAILED"
  | "ORIGIN_NOT_ALLOWED"
  | "INVALID_REQUEST"
  | "LOCATION_NOT_FOUND"
  | "WEATHER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type WeatherErrorMessage =
  | "Authentication is required."
  | "CSRF validation failed."
  | "Request origin is not allowed."
  | "Request validation failed."
  | "Location was not found."
  | "Weather data is temporarily unavailable."
  | "Too many requests."
  | "An unexpected error occurred.";

export interface WeatherError {
  readonly code: WeatherErrorCode;
  readonly message: WeatherErrorMessage;
  readonly correlationId: string;
  readonly retryable: boolean;
}

export interface WeatherErrorResponse {
  readonly status: "error";
  readonly error: WeatherError;
}

export interface WeatherUnavailableResponse {
  readonly status: "unavailable";
  readonly error: WeatherError;
}

export type WeatherQueryResponse =
  | WeatherQuerySuccessResponse
  | WeatherQueryDegradedResponse
  | WeatherQueryPendingResponse
  | WeatherUnavailableResponse
  | WeatherErrorResponse;

export type WeatherCapabilitiesApiResponse = WeatherCapabilitiesResponse | WeatherErrorResponse;

export type ContractValidationKeyword =
  | "$ref"
  | "additionalProperties"
  | "const"
  | "enum"
  | "format"
  | "maximum"
  | "maxItems"
  | "maxLength"
  | "minimum"
  | "minItems"
  | "minLength"
  | "oneOf"
  | "pattern"
  | "required"
  | "type"
  | "uniqueItems";

export interface ContractValidationIssue {
  readonly path: string;
  readonly keyword: ContractValidationKeyword;
  readonly message: string;
}

export type ContractValidationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly issues: readonly ContractValidationIssue[] };

export class ContractValidationError extends TypeError {
  readonly contract: string;
  readonly issues: readonly ContractValidationIssue[];

  constructor(contract: string, issues: readonly ContractValidationIssue[]) {
    super(`${contract} failed contract validation (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
    this.name = "ContractValidationError";
    this.contract = contract;
    this.issues = issues;
  }
}

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((entry, index) => jsonEqual(entry, right[index]));
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length && leftKeys.every(
      (key) => hasOwn(right, key) && jsonEqual(left[key], right[key])
    );
  }
  return false;
}

function addIssue(
  issues: ContractValidationIssue[],
  path: string,
  keyword: ContractValidationKeyword,
  message: string
): void {
  issues.push({ path, keyword, message });
}

function resolveReference(reference: string): JsonSchema | undefined {
  const prefix = "#/components/schemas/";
  if (!reference.startsWith(prefix)) return undefined;
  return weatherV1Schemas[reference.slice(prefix.length)];
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidFormat(value: string, format: unknown): boolean {
  if (format === "date") return isValidDate(value);
  if (format === "date-time") {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
  }
  if (format === "uri") {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
  if (format === "uuid") {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
  return true;
}

function validateType(schemaType: unknown, value: unknown): boolean {
  switch (schemaType) {
    case "null": return value === null;
    case "object": return isObject(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isSafeInteger(value);
    case "boolean": return typeof value === "boolean";
    default: return true;
  }
}

function validateSchema(
  schema: JsonSchema,
  value: unknown,
  path: string,
  issues: ContractValidationIssue[]
): void {
  const reference = schema.$ref;
  if (typeof reference === "string") {
    const resolved = resolveReference(reference);
    if (resolved === undefined) {
      addIssue(issues, path, "$ref", "references an unknown contract schema");
      return;
    }
    validateSchema(resolved, value, path, issues);
    return;
  }

  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf)) {
    const matching = oneOf.filter((candidate) => {
      if (!isObject(candidate)) return false;
      const candidateIssues: ContractValidationIssue[] = [];
      validateSchema(candidate, value, path, candidateIssues);
      return candidateIssues.length === 0;
    });
    if (matching.length !== 1) {
      addIssue(issues, path, "oneOf", "must match exactly one allowed shape");
    }
    return;
  }

  if (hasOwn(schema, "const") && !jsonEqual(value, schema.const)) {
    addIssue(issues, path, "const", "must use the contract-defined constant");
    return;
  }

  const enumValues = schema.enum;
  if (Array.isArray(enumValues) && !enumValues.some((entry) => jsonEqual(entry, value))) {
    addIssue(issues, path, "enum", "must be an allowed value");
    return;
  }

  if (schema.type !== undefined && !validateType(schema.type, value)) {
    addIssue(issues, path, "type", `must be ${String(schema.type)}`);
    return;
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      addIssue(issues, path, "minLength", "is shorter than the allowed minimum");
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      addIssue(issues, path, "maxLength", "is longer than the allowed maximum");
    }
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) {
      addIssue(issues, path, "pattern", "does not match the required format");
    }
    if (!isValidFormat(value, schema.format)) {
      addIssue(issues, path, "format", "does not use the required format");
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      addIssue(issues, path, "minimum", "is below the allowed minimum");
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      addIssue(issues, path, "maximum", "is above the allowed maximum");
    }
    if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) {
      addIssue(issues, path, "maximum", "is at or above the exclusive maximum");
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      addIssue(issues, path, "minItems", "contains too few items");
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      addIssue(issues, path, "maxItems", "contains too many items");
    }
    if (schema.uniqueItems === true) {
      const duplicate = value.some((entry, index) => value.slice(0, index).some((seen) => jsonEqual(seen, entry)));
      if (duplicate) addIssue(issues, path, "uniqueItems", "must not contain duplicate items");
    }
    if (isObject(schema.items)) {
      value.forEach((entry, index) => validateSchema(schema.items as JsonSchema, entry, `${path}[${index}]`, issues));
    }
  }

  if (isObject(value)) {
    const properties = isObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === "string")
      : [];
    for (const property of required) {
      if (!hasOwn(value, property)) {
        addIssue(issues, `${path}.${property}`, "required", "is required");
      }
    }
    for (const [property, propertySchema] of Object.entries(properties)) {
      if (hasOwn(value, property) && isObject(propertySchema)) {
        validateSchema(propertySchema, value[property], `${path}.${property}`, issues);
      }
    }
    if (schema.additionalProperties === false) {
      const knownProperties = new Set(Object.keys(properties));
      if (Object.keys(value).some((property) => !knownProperties.has(property))) {
        addIssue(issues, path, "additionalProperties", "must not contain unknown fields");
      }
    }
  }
}

export function validateWeatherV1Component(
  componentName: string,
  value: unknown
): readonly ContractValidationIssue[] {
  const schema = weatherV1Schemas[componentName];
  if (schema === undefined) {
    return [{ path: "$", keyword: "$ref", message: "references an unknown contract schema" }];
  }
  const issues: ContractValidationIssue[] = [];
  validateSchema(schema, value, "$", issues);
  return issues;
}

function safeParse<T>(componentName: string, value: unknown): ContractValidationResult<T> {
  const issues = validateWeatherV1Component(componentName, value);
  return issues.length === 0
    ? { success: true, data: value as T }
    : { success: false, issues };
}

function parse<T>(componentName: string, value: unknown): T {
  const result = safeParse<T>(componentName, value);
  if (!result.success) throw new ContractValidationError(componentName, result.issues);
  return result.data;
}

export function isWeatherQueryRequest(value: unknown): value is WeatherQueryRequest {
  return validateWeatherV1Component("WeatherQueryRequest", value).length === 0;
}

export function safeParseWeatherQueryRequest(
  value: unknown
): ContractValidationResult<WeatherQueryRequest> {
  return safeParse("WeatherQueryRequest", value);
}

export function parseWeatherQueryRequest(value: unknown): WeatherQueryRequest {
  return parse("WeatherQueryRequest", value);
}

export function isWeatherCapabilitiesResponse(value: unknown): value is WeatherCapabilitiesResponse {
  return validateWeatherV1Component("WeatherCapabilitiesResponse", value).length === 0;
}

export function safeParseWeatherCapabilitiesResponse(
  value: unknown
): ContractValidationResult<WeatherCapabilitiesResponse> {
  return safeParse("WeatherCapabilitiesResponse", value);
}

export function parseWeatherCapabilitiesResponse(value: unknown): WeatherCapabilitiesResponse {
  return parse("WeatherCapabilitiesResponse", value);
}

export function isWeatherQueryResponse(value: unknown): value is WeatherQueryResponse {
  return validateWeatherV1Component("WeatherQueryResponse", value).length === 0;
}

export function safeParseWeatherQueryResponse(
  value: unknown
): ContractValidationResult<WeatherQueryResponse> {
  return safeParse("WeatherQueryResponse", value);
}

export function parseWeatherQueryResponse(value: unknown): WeatherQueryResponse {
  return parse("WeatherQueryResponse", value);
}

export function isWeatherErrorResponse(value: unknown): value is WeatherErrorResponse {
  return validateWeatherV1Component("WeatherErrorResponse", value).length === 0;
}

export function safeParseWeatherErrorResponse(
  value: unknown
): ContractValidationResult<WeatherErrorResponse> {
  return safeParse("WeatherErrorResponse", value);
}

export function parseWeatherErrorResponse(value: unknown): WeatherErrorResponse {
  return parse("WeatherErrorResponse", value);
}
