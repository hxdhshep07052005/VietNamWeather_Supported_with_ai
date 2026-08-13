/**
 * Phase 7 Trend Service
 * Calculates trends from forecast data
 *
 * Based on decision FCAST-002
 * - Trend = change within forecast window
 * - Temperature: >2°C = increasing/decreasing
 */

import { randomUUID } from "node:crypto";

import {
  TREND_DIRECTIONS,
  TEMP_TREND_THRESHOLD_C,
  TREND_VARIABLES,
  DEFAULT_TREND_PERIOD_HOURS,
  MAX_TREND_PERIOD_HOURS,
  MIN_TREND_DATA_POINTS,
  PRECIP_TREND_THRESHOLD_MM,
  WIND_TREND_THRESHOLD_MS,
  TREND_TEXT,
  formatDisplayTime,
  type TrendDirection,
  type VariableTrend,
  type TrendSummary,
  type TrendRequest,
} from "@vietnam-weather/contracts";

// =============================================================================
// Types
// =============================================================================

export interface TrendServiceOptions {
  readonly getHourlyData: (locationId: string, hours: number) => Promise<TrendDataPoint[]>;
}

interface TrendDataPoint {
  time: string;
  temp_c: number | null;
  precip_mm: number | null;
  wind_speed: number | null;
}

// =============================================================================
// Trend Direction Calculation
// =============================================================================

/**
 * Calculate trend direction based on change amount and threshold
 */
function calculateTrendDirection(
  change: number,
  positiveThreshold: number,
  negativeThreshold: number
): TrendDirection {
  if (change > positiveThreshold) {
    return TREND_DIRECTIONS.INCREASING;
  }
  if (change < -negativeThreshold) {
    return TREND_DIRECTIONS.DECREASING;
  }
  return TREND_DIRECTIONS.STABLE;
}

// =============================================================================
// Trend Calculation Functions
// =============================================================================

/**
 * Calculate temperature trend
 */
function calculateTemperatureTrend(
  data: TrendDataPoint[],
  threshold: number
): VariableTrend | null {
  const validTemps = data
    .filter((d) => d.temp_c !== null)
    .map((d) => d.temp_c as number);

  if (validTemps.length < MIN_TREND_DATA_POINTS) {
    return null;
  }

  // Simple linear regression for trend
  const n = validTemps.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = validTemps.reduce((a, b) => a + b, 0);
  const sumXY = validTemps.reduce((acc, y, x) => acc + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Total change over the period
  const totalChange = slope * (n - 1);

  const direction = calculateTrendDirection(
    totalChange,
    threshold,
    threshold
  );

  // Calculate confidence based on R²
  const mean = sumY / n;
  const ssTotal = validTemps.reduce((acc, y) => acc + Math.pow(y - mean, 2), 0);
  const ssResidual = validTemps.reduce((acc, y, x) => {
    const predicted = mean + slope * x;
    return acc + Math.pow(y - predicted, 2);
  }, 0);
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
  const confidence = Math.round(Math.max(0, Math.min(100, rSquared * 100)));

  return {
    variable: TREND_VARIABLES.TEMPERATURE,
    direction,
    change: Math.round(totalChange * 10) / 10,
    unit: "°C",
    confidence,
    data_points: validTemps.length,
    span_hours: n,
  };
}

/**
 * Calculate precipitation trend
 */
function calculatePrecipitationTrend(
  data: TrendDataPoint[],
  threshold: number
): VariableTrend | null {
  const validPrecip = data
    .filter((d) => d.precip_mm !== null)
    .map((d) => d.precip_mm as number);

  if (validPrecip.length < MIN_TREND_DATA_POINTS) {
    return null;
  }

  // Compare first half vs second half averages
  const mid = Math.floor(validPrecip.length / 2);
  const firstHalf = validPrecip.slice(0, mid);
  const secondHalf = validPrecip.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const change = secondAvg - firstAvg;

  const direction = calculateTrendDirection(change, threshold, threshold);

  // Confidence based on variance
  const allVals = [...firstHalf, ...secondHalf];
  const mean = allVals.reduce((a, b) => a + b, 0) / allVals.length;
  const variance = allVals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / allVals.length;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.min(100, Math.round((1 / (1 + stdDev / 10)) * 100));

  return {
    variable: TREND_VARIABLES.PRECIPITATION,
    direction,
    change: Math.round(change * 10) / 10,
    unit: "mm",
    confidence,
    data_points: validPrecip.length,
    span_hours: validPrecip.length,
  };
}

/**
 * Calculate wind trend
 */
function calculateWindTrend(
  data: TrendDataPoint[],
  threshold: number
): VariableTrend | null {
  const validWind = data
    .filter((d) => d.wind_speed !== null)
    .map((d) => d.wind_speed as number);

  if (validWind.length < MIN_TREND_DATA_POINTS) {
    return null;
  }

  // Compare first half vs second half averages
  const mid = Math.floor(validWind.length / 2);
  const firstHalf = validWind.slice(0, mid);
  const secondHalf = validWind.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const change = secondAvg - firstAvg;

  const direction = calculateTrendDirection(change, threshold, threshold);

  // Confidence based on variance
  const allVals = [...firstHalf, ...secondHalf];
  const mean = allVals.reduce((a, b) => a + b, 0) / allVals.length;
  const variance = allVals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / allVals.length;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.min(100, Math.round((1 / (1 + stdDev / 5)) * 100));

  return {
    variable: TREND_VARIABLES.WIND,
    direction,
    change: Math.round(change * 10) / 10,
    unit: "m/s",
    confidence,
    data_points: validWind.length,
    span_hours: validWind.length,
  };
}

// =============================================================================
// Summary Text Generation
// =============================================================================

/**
 * Generate summary text from variable trends
 */
function generateSummaryText(
  trends: VariableTrend[],
  language: "vi" | "en"
): { vi: string; en: string } {
  const texts: { vi: string; en: string }[] = [];

  for (const trend of trends) {
    const text = TREND_TEXT[language][trend.variable]?.[trend.direction];
    if (text) {
      texts.push({
        vi: `${text} (${trend.change > 0 ? "+" : ""}${trend.change}${trend.unit})`,
        en: `${text} (${trend.change > 0 ? "+" : ""}${trend.change}${trend.unit})`,
      });
    }
  }

  if (texts.length === 0) {
    return {
      vi: "Không đủ dữ liệu để tính xu hướng",
      en: "Insufficient data to calculate trend",
    };
  }

  return {
    vi: texts.map((t) => t.vi).join("; "),
    en: texts.map((t) => t.en).join("; "),
  };
}

// =============================================================================
// Trend Service
// =============================================================================

export class TrendService {
  private readonly getHourlyData: (locationId: string, hours: number) => Promise<TrendDataPoint[]>;

  constructor(options: TrendServiceOptions) {
    this.getHourlyData = options.getHourlyData;
  }

  /**
   * Calculate trends for a location
   */
  async calculateTrends(request: TrendRequest): Promise<TrendSummary> {
    const locationId = request.location_id;
    const periodHours = Math.min(
      request.period_hours ?? DEFAULT_TREND_PERIOD_HOURS,
      MAX_TREND_PERIOD_HOURS
    );
    const language = request.language ?? "vi";

    // Get hourly data
    const data = await this.getHourlyData(locationId, periodHours);

    if (data.length === 0) {
      throw new TrendServiceError(
        "TREND_NO_DATA",
        "No weather data available for trend calculation",
        randomUUID(),
        false
      );
    }

    // Calculate individual trends
    const tempTrend = calculateTemperatureTrend(data, TEMP_TREND_THRESHOLD_C);
    const precipTrend = calculatePrecipitationTrend(data, PRECIP_TREND_THRESHOLD_MM);
    const windTrend = calculateWindTrend(data, WIND_TREND_THRESHOLD_MS);

    const variableTrends: VariableTrend[] = [];
    if (tempTrend) variableTrends.push(tempTrend);
    if (precipTrend) variableTrends.push(precipTrend);
    if (windTrend) variableTrends.push(windTrend);

    // Generate summary
    const summaryText = generateSummaryText(variableTrends, language);

    // Calculate period
    const sortedData = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const periodStart = sortedData[0]!.time;
    const periodEnd = sortedData[sortedData.length - 1]!.time;

    return {
      location_id: locationId,
      period_start: periodStart,
      period_end: periodEnd,
      variable_trends: variableTrends,
      summary_text: summaryText,
      display_period: `${formatDisplayTime(periodStart)} - ${formatDisplayTime(periodEnd)}`,
    };
  }
}

// =============================================================================
// Trend Service Error
// =============================================================================

export class TrendServiceError extends Error {
  readonly code: string;
  readonly correlationId: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, correlationId: string, retryable: boolean) {
    super(message);
    this.name = "TrendServiceError";
    this.code = code;
    this.correlationId = correlationId;
    this.retryable = retryable;
  }

  toResponse() {
    return {
      code: this.code,
      message: this.message,
      correlation_id: this.correlationId,
      retryable: this.retryable,
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createTrendService(options: TrendServiceOptions): TrendService {
  return new TrendService(options);
}
