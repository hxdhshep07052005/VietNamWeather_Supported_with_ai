export interface HealthResponse {
  readonly service: string;
  readonly status: "live" | "ready";
  readonly timestamp: string;
}
