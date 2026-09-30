export type JsonSchema = Readonly<Record<string, unknown>>;

export interface WeatherOpenApiV1Document {
  readonly openapi: "3.1.0";
  readonly jsonSchemaDialect: string;
  readonly info: Readonly<Record<string, unknown>>;
  readonly paths: Readonly<Record<string, unknown>>;
  readonly components: {
    readonly securitySchemes: Readonly<Record<string, unknown>>;
    readonly parameters: Readonly<Record<string, unknown>>;
    readonly responses: Readonly<Record<string, unknown>>;
    readonly schemas: Readonly<Record<string, JsonSchema>>;
  };
  readonly security: readonly Readonly<Record<string, readonly string[]>>[];
  readonly [extension: `x-${string}`]: unknown;
}

const schemaRef = (name: string): JsonSchema => ({
  $ref: `#/components/schemas/${name}`
});

const nullableRef = (name: string): JsonSchema => ({
  oneOf: [schemaRef(name), { type: "null" }]
});

const nullableInteger = (minimum = 0, maximum = 72): JsonSchema => ({
  oneOf: [
    { type: "integer", minimum, maximum },
    { type: "null" }
  ]
});

export const WEATHER_ERROR_CATALOG = {
  AUTHENTICATION_REQUIRED: {
    httpStatus: 401,
    retryable: false,
    message: "Authentication is required."
  },
  CSRF_VALIDATION_FAILED: {
    httpStatus: 403,
    retryable: false,
    message: "CSRF validation failed."
  },
  ORIGIN_NOT_ALLOWED: {
    httpStatus: 403,
    retryable: false,
    message: "Request origin is not allowed."
  },
  INVALID_REQUEST: {
    httpStatus: 400,
    retryable: false,
    message: "Request validation failed."
  },
  LOCATION_NOT_FOUND: {
    httpStatus: 404,
    retryable: false,
    message: "Location was not found."
  },
  WEATHER_UNAVAILABLE: {
    httpStatus: 503,
    retryable: true,
    message: "Weather data is temporarily unavailable."
  },
  RATE_LIMITED: {
    httpStatus: 429,
    retryable: true,
    message: "Too many requests."
  },
  INTERNAL_ERROR: {
    httpStatus: 500,
    retryable: false,
    message: "An unexpected error occurred."
  }
} as const;

export const WEATHER_ERROR_CODES = Object.freeze(
  Object.keys(WEATHER_ERROR_CATALOG) as (keyof typeof WEATHER_ERROR_CATALOG)[]
);

const correlationIdSchema: JsonSchema = {
  type: "string",
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$"
};

const weatherErrorVariants: readonly JsonSchema[] = Object.entries(WEATHER_ERROR_CATALOG).map(
  ([code, entry]) => ({
    type: "object",
    additionalProperties: false,
    required: ["code", "message", "correlationId", "retryable"],
    properties: {
      code: { type: "string", const: code },
      message: { type: "string", const: entry.message },
      correlationId: correlationIdSchema,
      retryable: { type: "boolean", const: entry.retryable }
    }
  })
);

const datasetNames = ["current", "hourly", "daily"] as const;
const freshnessStates = ["fresh", "stale", "expired", "unavailable"] as const;
const conditionCodes = [
  "clear",
  "partly_cloudy",
  "cloudy",
  "fog",
  "haze",
  "dust",
  "smoke",
  "smog",
  "dust_storm",
  "sandstorm",
  "drizzle",
  "rain",
  "heavy_rain",
  "thunderstorm",
  "sleet",
  "snow",
  "hail",
  "unknown"
] as const;
const normalizedWeatherFields = [
  "temperatureCelsius",
  "apparentTemperatureCelsius",
  "minimumTemperatureCelsius",
  "maximumTemperatureCelsius",
  "relativeHumidityPercent",
  "averageRelativeHumidityPercent",
  "windSpeedMetresPerSecond",
  "windGustMetresPerSecond",
  "maximumWindSpeedMetresPerSecond",
  "windDirectionDegrees",
  "precipitationMillimetres",
  "precipitationProbabilityPercent",
  "maximumPrecipitationProbabilityPercent",
  "pressureHectopascals",
  "visibilityMetres",
  "uvIndex",
  "cloudCoverPercent",
  "conditionCode"
] as const;

const metricValueProperties: Readonly<Record<string, JsonSchema>> = {
  temperatureCelsius: {
    oneOf: [{ type: "number", minimum: -100, maximum: 70 }, { type: "null" }]
  },
  apparentTemperatureCelsius: {
    oneOf: [{ type: "number", minimum: -120, maximum: 90 }, { type: "null" }]
  },
  relativeHumidityPercent: {
    oneOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }]
  },
  windSpeedMetresPerSecond: {
    oneOf: [{ type: "number", minimum: 0, maximum: 150 }, { type: "null" }]
  },
  windGustMetresPerSecond: {
    oneOf: [{ type: "number", minimum: 0, maximum: 200 }, { type: "null" }]
  },
  windDirectionDegrees: {
    oneOf: [
      { type: "number", minimum: 0, exclusiveMaximum: 360 },
      { type: "null" }
    ]
  },
  precipitationMillimetres: {
    oneOf: [{ type: "number", minimum: 0, maximum: 5000 }, { type: "null" }]
  },
  pressureHectopascals: {
    oneOf: [{ type: "number", minimum: 800, maximum: 1200 }, { type: "null" }]
  },
  visibilityMetres: {
    oneOf: [{ type: "number", minimum: 0, maximum: 1_000_000 }, { type: "null" }]
  },
  uvIndex: {
    oneOf: [{ type: "number", minimum: 0, maximum: 30 }, { type: "null" }]
  },
  cloudCoverPercent: {
    oneOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }]
  },
  conditionCode: {
    oneOf: [{ type: "string", enum: conditionCodes }, { type: "null" }]
  }
};

const metricValueRequired = Object.keys(metricValueProperties);

export const weatherV1Schemas: Readonly<Record<string, JsonSchema>> = Object.freeze({
  UtcDateTime: {
    type: "string",
    format: "date-time",
    pattern: "Z$",
    description: "An RFC 3339 timestamp normalized to UTC."
  },
  CalendarDate: {
    type: "string",
    format: "date",
    pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
  },
  WeatherUnits: {
    type: "object",
    additionalProperties: false,
    required: [
      "temperature",
      "windSpeed",
      "precipitation",
      "pressure",
      "visibility",
      "relativeHumidity",
      "probability",
      "direction"
    ],
    properties: {
      temperature: { type: "string", const: "celsius" },
      windSpeed: { type: "string", const: "metres_per_second" },
      precipitation: { type: "string", const: "millimetres" },
      pressure: { type: "string", const: "hectopascals" },
      visibility: { type: "string", const: "metres" },
      relativeHumidity: { type: "string", const: "percent" },
      probability: { type: "string", const: "percent" },
      direction: { type: "string", const: "degrees" }
    },
    description: "The fixed metric SI-oriented unit set for every public v1 weather value."
  },
  Attribution: {
    type: "object",
    additionalProperties: false,
    required: ["name", "url"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      url: {
        type: "string",
        format: "uri",
        pattern: "^https://",
        maxLength: 500
      }
    }
  },
  SourceIdentity: {
    type: "object",
    additionalProperties: false,
    required: ["provider", "attribution"],
    properties: {
      provider: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Public source name, never a provider endpoint or credential."
      },
      attribution: schemaRef("Attribution")
    }
  },
  ValidInterval: {
    type: "object",
    additionalProperties: false,
    required: ["from", "to"],
    properties: {
      from: schemaRef("UtcDateTime"),
      to: schemaRef("UtcDateTime")
    }
  },
  WeatherQuality: {
    type: "object",
    additionalProperties: false,
    required: ["state", "missingFields"],
    properties: {
      state: { type: "string", enum: ["complete", "partial"] },
      missingFields: {
        type: "array",
        uniqueItems: true,
        maxItems: normalizedWeatherFields.length,
        items: { type: "string", enum: normalizedWeatherFields }
      }
    },
    description: "Missing measurements remain null and are named here; zero is never a missing-value sentinel."
  },
  WeatherProvenance: {
    type: "object",
    additionalProperties: false,
    required: [
      "provider",
      "parserVersion",
      "snapshotId",
      "providerIssuedAt",
      "fetchedAt",
      "expiresAt"
    ],
    properties: {
      provider: { type: "string", minLength: 1, maxLength: 100 },
      parserVersion: {
        type: "string",
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"
      },
      snapshotId: {
        type: "string",
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
        description: "Opaque normalized snapshot identifier."
      },
      providerIssuedAt: nullableRef("UtcDateTime"),
      fetchedAt: schemaRef("UtcDateTime"),
      expiresAt: schemaRef("UtcDateTime")
    },
    description: "Provider-issued time is nullable and is never inferred from fetchedAt."
  },
  WeatherFreshness: {
    oneOf: freshnessStates.map((state) => ({
      type: "object",
      additionalProperties: false,
      required: [
        "state",
        "assessedAt",
        "freshUntil",
        "staleUntil",
        "displayEligible",
        "riskEligible",
        "routeEligible"
      ],
      properties: {
        state: { type: "string", const: state },
        assessedAt: schemaRef("UtcDateTime"),
        freshUntil: nullableRef("UtcDateTime"),
        staleUntil: nullableRef("UtcDateTime"),
        displayEligible: state === "expired" || state === "unavailable"
          ? { type: "boolean", const: false }
          : { type: "boolean" },
        riskEligible: state === "fresh"
          ? { type: "boolean" }
          : { type: "boolean", const: false },
        routeEligible: state === "fresh"
          ? { type: "boolean" }
          : { type: "boolean", const: false }
      }
    })),
    description: "Stale data may be displayable but is not eligible for risk or route decisions."
  },
  DatasetCoverage: {
    type: "object",
    additionalProperties: false,
    required: [
      "dataset",
      "status",
      "validInterval",
      "expectedIntervals",
      "returnedIntervals",
      "gaps"
    ],
    properties: {
      dataset: { type: "string", enum: datasetNames },
      status: {
        type: "string",
        enum: ["complete", "partial", "unavailable", "not_requested"]
      },
      validInterval: nullableRef("ValidInterval"),
      expectedIntervals: nullableInteger(0, 72),
      returnedIntervals: { type: "integer", minimum: 0, maximum: 72 },
      gaps: {
        type: "array",
        maxItems: 72,
        items: schemaRef("ValidInterval")
      }
    }
  },
  WeatherQueryCoverage: {
    type: "object",
    additionalProperties: false,
    required: ["requested", "effectiveHorizonHours", "datasets"],
    properties: {
      requested: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        uniqueItems: true,
        items: { type: "string", enum: datasetNames }
      },
      effectiveHorizonHours: { type: "integer", minimum: 0, maximum: 72 },
      datasets: {
        type: "object",
        additionalProperties: false,
        required: ["current", "hourly", "daily"],
        properties: {
          current: schemaRef("DatasetCoverage"),
          hourly: schemaRef("DatasetCoverage"),
          daily: schemaRef("DatasetCoverage")
        }
      }
    }
  },
  FeatureAccountCapability: {
    type: "object",
    additionalProperties: false,
    required: ["supported", "verifiedAt", "maximumHorizonHours"],
    properties: {
      supported: { type: "boolean" },
      verifiedAt: nullableRef("UtcDateTime"),
      maximumHorizonHours: nullableInteger()
    }
  },
  FeatureEntitlement: {
    type: "object",
    additionalProperties: false,
    required: ["allowed", "maximumHorizonHours"],
    properties: {
      allowed: { type: "boolean" },
      maximumHorizonHours: nullableInteger()
    }
  },
  FeatureProviderCoverage: {
    type: "object",
    additionalProperties: false,
    required: ["available", "maximumHorizonHours"],
    properties: {
      available: { type: "boolean" },
      maximumHorizonHours: nullableInteger()
    }
  },
  FreshnessPolicy: {
    type: "object",
    additionalProperties: false,
    required: [
      "freshForSeconds",
      "staleDisplayForSeconds",
      "staleDisplayEligible",
      "staleRiskEligible",
      "staleRouteEligible"
    ],
    properties: {
      freshForSeconds: nullableInteger(0, 86_400),
      staleDisplayForSeconds: nullableInteger(0, 86_400),
      staleDisplayEligible: { type: "boolean" },
      staleRiskEligible: { type: "boolean", const: false },
      staleRouteEligible: { type: "boolean", const: false }
    }
  },
  WeatherFeatureCapability: {
    type: "object",
    additionalProperties: false,
    required: [
      "enabled",
      "granularityMinutes",
      "account",
      "entitlement",
      "providerCoverage",
      "operationalMaximumHorizonHours",
      "effectiveMaximumHorizonHours",
      "freshnessPolicy"
    ],
    properties: {
      enabled: { type: "boolean" },
      granularityMinutes: nullableInteger(1, 1_440),
      account: schemaRef("FeatureAccountCapability"),
      entitlement: schemaRef("FeatureEntitlement"),
      providerCoverage: schemaRef("FeatureProviderCoverage"),
      operationalMaximumHorizonHours: {
        type: "integer",
        minimum: 0,
        maximum: 72
      },
      effectiveMaximumHorizonHours: {
        type: "integer",
        minimum: 0,
        maximum: 72
      },
      freshnessPolicy: schemaRef("FreshnessPolicy")
    },
    description: "effectiveMaximumHorizonHours is the minimum valid account, entitlement, provider and operational ceiling."
  },
  WeatherCapabilities: {
    type: "object",
    additionalProperties: false,
    required: [
      "apiVersion",
      "updatedAt",
      "canonicalTimezone",
      "units",
      "fallback",
      "providerMixing",
      "operationalMaximumHorizonHours",
      "source",
      "features"
    ],
    properties: {
      apiVersion: { type: "string", const: "v1" },
      updatedAt: schemaRef("UtcDateTime"),
      canonicalTimezone: { type: "string", const: "Asia/Ho_Chi_Minh" },
      units: schemaRef("WeatherUnits"),
      fallback: { type: "string", const: "none" },
      providerMixing: { type: "boolean", const: false },
      operationalMaximumHorizonHours: { type: "integer", const: 72 },
      source: schemaRef("SourceIdentity"),
      features: {
        type: "object",
        additionalProperties: false,
        required: ["current", "hourly", "daily", "nowcast", "alerts", "spatialLayers"],
        properties: {
          current: schemaRef("WeatherFeatureCapability"),
          hourly: schemaRef("WeatherFeatureCapability"),
          daily: schemaRef("WeatherFeatureCapability"),
          nowcast: schemaRef("WeatherFeatureCapability"),
          alerts: schemaRef("WeatherFeatureCapability"),
          spatialLayers: schemaRef("WeatherFeatureCapability")
        }
      }
    }
  },
  WeatherCapabilitiesResponse: {
    type: "object",
    additionalProperties: false,
    required: ["status", "data", "correlationId"],
    properties: {
      status: { type: "string", const: "success" },
      data: schemaRef("WeatherCapabilities"),
      correlationId: {
        type: "string",
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$"
      }
    }
  },
  LocationIdTarget: {
    type: "object",
    additionalProperties: false,
    required: ["locationId"],
    properties: {
      locationId: {
        type: "string",
        format: "uuid",
        pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
      }
    }
  },
  CoordinateTarget: {
    type: "object",
    additionalProperties: false,
    required: ["coordinates"],
    properties: {
      coordinates: {
        type: "object",
        additionalProperties: false,
        required: ["latitude", "longitude"],
        properties: {
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 }
        }
      }
    }
  },
  WeatherQueryTarget: {
    oneOf: [schemaRef("LocationIdTarget"), schemaRef("CoordinateTarget")],
    description: "Exactly one canonical locationId or coordinate pair. Coordinates are never echoed in errors."
  },
  WeatherQueryRequest: {
    type: "object",
    additionalProperties: false,
    required: ["target", "include"],
    properties: {
      target: schemaRef("WeatherQueryTarget"),
      include: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        uniqueItems: true,
        items: { type: "string", enum: datasetNames }
      }
    }
  },
  ResolvedWeatherTarget: {
    type: "object",
    additionalProperties: false,
    required: ["locationId", "timezone"],
    properties: {
      locationId: {
        oneOf: [
          {
            type: "string",
            format: "uuid",
            pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
          },
          { type: "null" }
        ]
      },
      timezone: { type: "string", const: "Asia/Ho_Chi_Minh" }
    },
    description: "A coordinate query is resolved without returning the submitted coordinates."
  },
  CurrentWeatherValue: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "observedAt", "validInterval", "quality", ...metricValueRequired],
    properties: {
      kind: { type: "string", const: "observation" },
      observedAt: schemaRef("UtcDateTime"),
      validInterval: schemaRef("ValidInterval"),
      quality: schemaRef("WeatherQuality"),
      ...metricValueProperties
    }
  },
  HourlyWeatherValue: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "validInterval",
      "quality",
      ...metricValueRequired,
      "precipitationProbabilityPercent"
    ],
    properties: {
      kind: { type: "string", const: "forecast" },
      validInterval: schemaRef("ValidInterval"),
      quality: schemaRef("WeatherQuality"),
      ...metricValueProperties,
      precipitationProbabilityPercent: {
        oneOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }]
      }
    },
    description: "One-hour provider-neutral forecast interval."
  },
  DailyWeatherValue: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "date",
      "validInterval",
      "quality",
      "minimumTemperatureCelsius",
      "maximumTemperatureCelsius",
      "precipitationMillimetres",
      "maximumPrecipitationProbabilityPercent",
      "maximumWindSpeedMetresPerSecond",
      "averageRelativeHumidityPercent",
      "conditionCode"
    ],
    properties: {
      kind: { type: "string", const: "forecast" },
      date: schemaRef("CalendarDate"),
      validInterval: schemaRef("ValidInterval"),
      quality: schemaRef("WeatherQuality"),
      minimumTemperatureCelsius: {
        oneOf: [{ type: "number", minimum: -100, maximum: 70 }, { type: "null" }]
      },
      maximumTemperatureCelsius: {
        oneOf: [{ type: "number", minimum: -100, maximum: 70 }, { type: "null" }]
      },
      precipitationMillimetres: metricValueProperties.precipitationMillimetres,
      maximumPrecipitationProbabilityPercent: {
        oneOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }]
      },
      maximumWindSpeedMetresPerSecond: {
        oneOf: [{ type: "number", minimum: 0, maximum: 200 }, { type: "null" }]
      },
      averageRelativeHumidityPercent: metricValueProperties.relativeHumidityPercent,
      conditionCode: metricValueProperties.conditionCode
    },
    description: "One-day forecast interval in the canonical product timezone."
  },
  CurrentWeatherSection: {
    type: "object",
    additionalProperties: false,
    required: ["provenance", "freshness", "coverage", "value"],
    properties: {
      provenance: schemaRef("WeatherProvenance"),
      freshness: schemaRef("WeatherFreshness"),
      coverage: schemaRef("DatasetCoverage"),
      value: schemaRef("CurrentWeatherValue")
    }
  },
  HourlyWeatherSection: {
    type: "object",
    additionalProperties: false,
    required: ["provenance", "freshness", "coverage", "values"],
    properties: {
      provenance: schemaRef("WeatherProvenance"),
      freshness: schemaRef("WeatherFreshness"),
      coverage: schemaRef("DatasetCoverage"),
      values: {
        type: "array",
        minItems: 1,
        maxItems: 72,
        items: schemaRef("HourlyWeatherValue")
      }
    }
  },
  DailyWeatherSection: {
    type: "object",
    additionalProperties: false,
    required: ["provenance", "freshness", "coverage", "values"],
    properties: {
      provenance: schemaRef("WeatherProvenance"),
      freshness: schemaRef("WeatherFreshness"),
      coverage: schemaRef("DatasetCoverage"),
      values: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: schemaRef("DailyWeatherValue")
      }
    }
  },
  WeatherQueryData: {
    type: "object",
    additionalProperties: false,
    required: [
      "target",
      "units",
      "providerMixing",
      "attribution",
      "coverage",
      "current",
      "hourly",
      "daily"
    ],
    properties: {
      target: schemaRef("ResolvedWeatherTarget"),
      units: schemaRef("WeatherUnits"),
      providerMixing: { type: "boolean", const: false },
      attribution: schemaRef("Attribution"),
      coverage: schemaRef("WeatherQueryCoverage"),
      current: nullableRef("CurrentWeatherSection"),
      hourly: nullableRef("HourlyWeatherSection"),
      daily: nullableRef("DailyWeatherSection")
    }
  },
  WeatherDegradedIssue: {
    type: "object",
    additionalProperties: false,
    required: ["code", "dataset", "retryable"],
    properties: {
      code: {
        type: "string",
        enum: [
          "CURRENT_UNAVAILABLE",
          "HOURLY_PARTIAL",
          "DAILY_PARTIAL",
          "STALE_DATA",
          "COVERAGE_REDUCED"
        ]
      },
      dataset: {
        oneOf: [{ type: "string", enum: datasetNames }, { type: "null" }]
      },
      retryable: { type: "boolean" }
    },
    description: "A stable, sanitized issue. It never contains coordinates, provider URLs or raw provider messages."
  },
  WeatherQuerySuccessResponse: {
    type: "object",
    additionalProperties: false,
    required: ["status", "data", "correlationId"],
    properties: {
      status: { type: "string", const: "success" },
      data: schemaRef("WeatherQueryData"),
      correlationId: {
        type: "string",
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$"
      }
    }
  },
  WeatherQueryDegradedResponse: {
    type: "object",
    additionalProperties: false,
    required: ["status", "data", "issues", "correlationId"],
    properties: {
      status: { type: "string", const: "degraded" },
      data: schemaRef("WeatherQueryData"),
      issues: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: schemaRef("WeatherDegradedIssue")
      },
      correlationId: {
        type: "string",
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$"
      }
    }
  },
  WeatherQueryPendingResponse: {
    type: "object",
    additionalProperties: false,
    required: ["status", "retryAfterSeconds", "correlationId"],
    properties: {
      status: { type: "string", const: "pending" },
      retryAfterSeconds: { type: "integer", minimum: 1, maximum: 60 },
      correlationId: {
        type: "string",
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$"
      }
    },
    description: "The caller may repeat the same query after the bounded retry delay."
  },
  WeatherError: {
    oneOf: weatherErrorVariants,
    description: "Stable public error without coordinates, request payloads, provider endpoints, credentials or raw provider messages."
  },
  WeatherErrorResponse: {
    type: "object",
    additionalProperties: false,
    required: ["status", "error"],
    properties: {
      status: { type: "string", const: "error" },
      error: schemaRef("WeatherError")
    }
  },
  WeatherUnavailableResponse: {
    type: "object",
    additionalProperties: false,
    required: ["status", "error"],
    properties: {
      status: { type: "string", const: "unavailable" },
      error: schemaRef("WeatherError")
    }
  },
  WeatherQueryResponse: {
    oneOf: [
      schemaRef("WeatherQuerySuccessResponse"),
      schemaRef("WeatherQueryDegradedResponse"),
      schemaRef("WeatherQueryPendingResponse"),
      schemaRef("WeatherUnavailableResponse"),
      schemaRef("WeatherErrorResponse")
    ],
    discriminator: { propertyName: "status" }
  },
  WeatherCapabilitiesApiResponse: {
    oneOf: [schemaRef("WeatherCapabilitiesResponse"), schemaRef("WeatherErrorResponse")],
    discriminator: { propertyName: "status" }
  }
});

const jsonContent = (schemaName: string): Readonly<Record<string, unknown>> => ({
  "application/json": { schema: schemaRef(schemaName) }
});

const response = (
  description: string,
  schemaName: string,
  headers?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => ({
  description,
  ...(headers === undefined ? {} : { headers }),
  content: jsonContent(schemaName)
});

const retryAfterHeader = {
  "Retry-After": {
    description: "Whole seconds before repeating the same request.",
    schema: { type: "integer", minimum: 1, maximum: 60 }
  }
};

export const weatherOpenApiV1: WeatherOpenApiV1Document = Object.freeze({
  openapi: "3.1.0",
  jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
  info: {
    title: "Vietnam Weather API",
    version: "1.0.0",
    description:
      "Provider-neutral Phase 5 weather contract. Public values use fixed metric SI-oriented units; raw provider payloads are never part of this API."
  },
  security: [{ cookieAuth: [] }],
  paths: {
    "/api/v1/weather/capabilities": {
      get: {
        operationId: "getWeatherCapabilitiesV1",
        summary: "Get effective weather capabilities",
        description:
          "Returns separate account, entitlement, provider-valid and operational ceilings. No CSRF token is required for this read-only operation.",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Current effective capabilities.",
            content: jsonContent("WeatherCapabilitiesResponse")
          },
          "401": { $ref: "#/components/responses/AuthenticationRequired" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" }
        }
      }
    },
    "/api/v1/weather/query": {
      post: {
        operationId: "queryWeatherV1",
        summary: "Query normalized point weather",
        description:
          "Treat this POST as a protected mutation: require an authenticated cookie, an exact allowlisted Origin header and a valid CSRF header. A provider-backed request returns success, pending, degraded or unavailable within the API timeout boundary.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/Origin" },
          { $ref: "#/components/parameters/CsrfToken" }
        ],
        requestBody: {
          required: true,
          content: jsonContent("WeatherQueryRequest")
        },
        responses: {
          "200": {
            description: "Complete or explicitly degraded normalized weather.",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    schemaRef("WeatherQuerySuccessResponse"),
                    schemaRef("WeatherQueryDegradedResponse")
                  ],
                  discriminator: { propertyName: "status" }
                }
              }
            }
          },
          "202": response(
            "The durable provider-backed query is still pending.",
            "WeatherQueryPendingResponse",
            retryAfterHeader
          ),
          "400": { $ref: "#/components/responses/InvalidRequest" },
          "401": { $ref: "#/components/responses/AuthenticationRequired" },
          "403": { $ref: "#/components/responses/MutationForbidden" },
          "404": { $ref: "#/components/responses/LocationNotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
          "503": response(
            "No weather is displayable inside the approved stale window.",
            "WeatherUnavailableResponse",
            retryAfterHeader
          )
        }
      }
    }
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "__Host-vnwa_session",
        description: "Opaque HttpOnly, Secure, SameSite session cookie."
      }
    },
    parameters: {
      Origin: {
        name: "Origin",
        in: "header",
        required: true,
        description: "Must exactly match a configured application origin.",
        schema: { type: "string", format: "uri" }
      },
      CsrfToken: {
        name: "X-CSRF-Token",
        in: "header",
        required: true,
        description: "Signed CSRF token bound to the authenticated browser flow.",
        schema: { type: "string", minLength: 32, maxLength: 512 }
      }
    },
    responses: {
      InvalidRequest: response("Request shape or values are invalid.", "WeatherErrorResponse"),
      AuthenticationRequired: response("A valid authenticated session is required.", "WeatherErrorResponse"),
      MutationForbidden: response(
        "The Origin is not allowlisted or CSRF validation failed.",
        "WeatherErrorResponse"
      ),
      LocationNotFound: response("The canonical target cannot be resolved.", "WeatherErrorResponse"),
      RateLimited: response("The stable rate limit was exceeded.", "WeatherErrorResponse", retryAfterHeader),
      InternalError: response("A sanitized internal error.", "WeatherErrorResponse")
    },
    schemas: weatherV1Schemas
  },
  "x-error-catalog": WEATHER_ERROR_CATALOG,
  "x-data-governance": {
    rawProviderPayloadStored: false,
    rawCoordinatesInErrors: false,
    providerIssuedTimeNullable: true,
    normalizedCurrentMaximumRetentionSeconds: 3_600,
    normalizedForecastMaximumRetentionSeconds: 86_400,
    sanitizedRunMetadataMaximumRetentionDays: 30
  }
});
