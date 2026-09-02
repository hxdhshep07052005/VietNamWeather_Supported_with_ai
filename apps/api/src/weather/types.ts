import type {
  WeatherCapabilitiesResponse,
  WeatherQueryRequest,
  WeatherQueryResponse
} from "@vietnam-weather/contracts";

/**
 * Typed surface for the weather HTTP routes. The runtime module keeps
 * WeatherService as the source of truth; the route layer only narrows
 * the input (so a malformed JSON body returns 400) and unwraps the
 * already-validated contract response.
 */
export interface WeatherCapabilitiesRoute {
  readonly correlationId: string;
  readonly response: WeatherCapabilitiesResponse;
}

export interface WeatherQueryRoute {
  readonly correlationId: string;
  readonly request: WeatherQueryRequest;
  readonly response: WeatherQueryResponse;
}

/**
 * Reader-friendly DTO used by `/api/v1/weather/observation` so the
 * front-end info panel can poll the latest observation without paying
 * for the full bundle. This is the slice the right-hand panel needs
 * for status + alerts.
 */
export interface WeatherObservationRoute {
  readonly correlationId: string;
  readonly target: WeatherQueryRequest["target"];
  readonly response: WeatherQueryResponse;
}
