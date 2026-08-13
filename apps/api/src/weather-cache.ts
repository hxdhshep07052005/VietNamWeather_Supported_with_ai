import type { Redis } from "ioredis";

import {
  isWeatherQueryResponse,
  type WeatherQueryResponse
} from "@vietnam-weather/contracts";

export interface WeatherCache {
  get(key: string): Promise<WeatherQueryResponse | null>;
  set(key: string, value: WeatherQueryResponse, ttlSeconds: number): Promise<void>;
}

export class RedisWeatherCache implements WeatherCache {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<WeatherQueryResponse | null> {
    const serialized = await this.redis.get(`weather:v1:response:${key}`);
    if (serialized === null) return null;
    try {
      const value: unknown = JSON.parse(serialized);
      return isWeatherQueryResponse(value) ? value : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: WeatherQueryResponse, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      `weather:v1:response:${key}`,
      JSON.stringify(value),
      "EX",
      ttlSeconds
    );
  }
}
