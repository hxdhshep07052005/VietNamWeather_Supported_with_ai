/**
 * Weather Scheduler Service
 * Periodically enqueues weather requests for all Vietnam provinces
 * This ensures weather data is always available in the database
 */

import { createHash } from "node:crypto";
import type { WeatherStore } from "../weather-store.js";
import type { WeatherQueryTarget } from "@vietnam-weather/contracts";
import { VIETNAM_PROVINCES } from "./vietnam-provinces.js";

export interface VietnamProvince {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface WeatherSchedulerConfig {
  readonly intervalMilliseconds: number;
  readonly batchSize: number;
  readonly providerKey: string;
  readonly parserVersion: string;
}

export interface WeatherSchedulerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

const NOOP_LOGGER: WeatherSchedulerLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
};

function generateIdempotencyKey(
  provinceId: string,
  bucket: number,
  requestKind: string
): string {
  const data = `${provinceId}:${bucket}:${requestKind}`;
  return createHash("sha256").update(data).digest("hex");
}

function getCurrentBucket(now: Date, intervalMilliseconds: number): number {
  return Math.floor(now.getTime() / intervalMilliseconds);
}

export class WeatherScheduler {
  #store: WeatherStore;
  #config: WeatherSchedulerConfig;
  #logger: WeatherSchedulerLogger;
  #now: () => Date;
  #intervalHandle: ReturnType<typeof setInterval> | null = null;
  #isRunning = false;
  #lastRunAt: Date | null = null;

  constructor(
    store: WeatherStore,
    config: WeatherSchedulerConfig,
    logger?: WeatherSchedulerLogger,
    now?: () => Date
  ) {
    this.#store = store;
    this.#config = config;
    this.#logger = logger ?? NOOP_LOGGER;
    this.#now = now ?? (() => new Date());
  }

  start(): void {
    if (this.#isRunning) {
      this.#logger.warn("Weather scheduler is already running");
      return;
    }

    this.#isRunning = true;
    this.#logger.info("Weather scheduler started", {
      intervalMs: this.#config.intervalMilliseconds,
      provinceCount: VIETNAM_PROVINCES.length,
    });

    this.#run().catch((error) => {
      this.#logger.error("Weather scheduler initial run failed", { error: String(error) });
    });

    this.#intervalHandle = setInterval(() => {
      this.#run().catch((error) => {
        this.#logger.error("Weather scheduler periodic run failed", { error: String(error) });
      });
    }, this.#config.intervalMilliseconds);
  }

  async stop(): Promise<void> {
    if (!this.#isRunning) {
      return;
    }

    this.#isRunning = false;
    if (this.#intervalHandle !== null) {
      clearInterval(this.#intervalHandle);
      this.#intervalHandle = null;
    }

    this.#logger.info("Weather scheduler stopped", {
      lastRunAt: this.#lastRunAt?.toISOString() ?? "never",
    });
  }

  async #run(): Promise<void> {
    const startTime = this.#now();
    this.#logger.info("Weather scheduler run started");

    const bucket = getCurrentBucket(startTime, this.#config.intervalMilliseconds);
    const results = {
      enqueued: 0,
      skipped: 0,
      errors: 0,
    };

    for (let i = 0; i < VIETNAM_PROVINCES.length; i += this.#config.batchSize) {
      const batch = VIETNAM_PROVINCES.slice(i, i + this.#config.batchSize);
      const batchPromises = batch.map((province) =>
        this.#enqueueProvince(province, bucket).then((result) => {
          if (result === "enqueued") {
            results.enqueued++;
          } else if (result === "skipped") {
            results.skipped++;
          } else {
            results.errors++;
          }
        }).catch((error) => {
          this.#logger.error("Failed to enqueue weather request", {
            provinceId: province.id,
            provinceName: province.name,
            error: String(error),
          });
          results.errors++;
        })
      );

      await Promise.all(batchPromises);

      if (i + this.#config.batchSize < VIETNAM_PROVINCES.length) {
        await this.#sleep(100);
      }
    }

    this.#lastRunAt = startTime;
    const duration = this.#now().getTime() - startTime.getTime();

    this.#logger.info("Weather scheduler run completed", {
      durationMs: duration,
      ...results,
    });
  }

  async #enqueueProvince(
    province: VietnamProvince,
    bucket: number
  ): Promise<"enqueued" | "skipped" | "error"> {
    const target: WeatherQueryTarget = {
      coordinates: {
        latitude: province.latitude,
        longitude: province.longitude,
      },
    };

    const idempotencyKey = generateIdempotencyKey(
      province.id,
      bucket,
      this.#config.providerKey
    );

    try {
      const result = await this.#store.enqueue(
        target,
        "bundle",
        idempotencyKey,
        this.#now()
      );

      if (result.inserted) {
        return "enqueued";
      } else {
        return "skipped";
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("idempotency") || errorMessage.includes("23505")) {
        return "skipped";
      }
      throw error;
    }
  }

  async runOnce(): Promise<void> {
    await this.#run();
  }

  #sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createDefaultSchedulerConfig(): WeatherSchedulerConfig {
  return {
    intervalMilliseconds: 10 * 60 * 1000,
    batchSize: 10,
    providerKey: "weatherapi",
    parserVersion: "weatherapi-forecast-v1",
  };
}
