import {
  WeatherApiAdapter,
  WEATHERAPI_ALLOWED_ORIGIN,
  WEATHERAPI_PARSER_VERSION,
  WEATHERAPI_PROVIDER_ID,
  WeatherProviderError
} from "../weather/index.js";

import { mapNormalizedWeatherPayload, WeatherRuntimeMappingError } from "./mapping.js";
import type {
  ClaimedWeatherRun,
  WeatherAdapterFactory,
  WeatherPersistenceResult,
  WeatherRuntimeConfig,
  WeatherRuntimeLifecycleState,
  WeatherRuntimeLogger,
  WeatherRuntimeReadiness,
  WeatherRuntimeSecrets,
  WeatherRuntimeStore,
  WeatherRuntimeWakeChannel,
  WeatherRunTerminalStatus
} from "./types.js";

export const WEATHERAPI_CREDENTIAL_REFERENCE = "env:WEATHERAPI_API_KEY";

const NOOP_LOGGER: WeatherRuntimeLogger = Object.freeze({
  info: () => {},
  error: () => {}
});

const defaultAdapterFactory: WeatherAdapterFactory = (options) => new WeatherApiAdapter(options);

interface ClassifiedRuntimeError {
  readonly code: string;
  readonly retryable: boolean;
  readonly message: string;
}

export interface WeatherDurableRuntimeOptions {
  readonly config: WeatherRuntimeConfig;
  readonly secrets: WeatherRuntimeSecrets;
  readonly store: WeatherRuntimeStore;
  readonly wakeChannel?: WeatherRuntimeWakeChannel;
  readonly adapterFactory?: WeatherAdapterFactory;
  readonly logger?: WeatherRuntimeLogger;
  readonly now?: () => Date;
  readonly random?: () => number;
}

class WeatherRuntimeRunError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "WeatherRuntimeRunError";
  }
}

function safeDate(clock: () => Date): Date {
  const value = clock();
  const date = new Date(value.getTime());
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("Weather runtime clock returned an invalid value.");
  }
  return date;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(finish, milliseconds);
    function finish(): void {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

function fixedProviderMessage(code: string): string {
  if (code === "weather_provider_auth_failed") {
    return "Weather provider authentication failed.";
  }
  if (code === "weather_provider_schema_invalid") {
    return "Weather provider response schema was rejected.";
  }
  if (code === "weather_provider_quota_exhausted") {
    return "Weather provider quota is exhausted.";
  }
  if (code === "weather_provider_configuration_invalid") {
    return "Weather provider configuration was rejected.";
  }
  return "Weather provider request failed.";
}

function providerErrorCode(error: WeatherProviderError): string {
  return error.code.toLowerCase();
}

function errorCodeValue(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function classifyError(error: unknown): ClassifiedRuntimeError {
  if (error instanceof WeatherProviderError) {
    const code = providerErrorCode(error);
    return {
      code,
      retryable: error.retryable,
      message: fixedProviderMessage(code)
    };
  }
  if (error instanceof WeatherRuntimeMappingError) {
    return {
      code: error.code,
      retryable: false,
      message: error.message
    };
  }
  if (error instanceof WeatherRuntimeRunError) {
    return {
      code: error.code,
      retryable: error.retryable,
      message: error.message
    };
  }
  const dependencyCode = errorCodeValue(error);
  if (
    dependencyCode?.startsWith("22") === true ||
    dependencyCode === "23502" ||
    dependencyCode === "23503" ||
    dependencyCode === "23505" ||
    dependencyCode === "23514"
  ) {
    return {
      code: dependencyCode === "23505"
        ? "weather_persistence_conflict"
        : "weather_provider_schema_invalid",
      retryable: false,
      message: dependencyCode === "23505"
        ? "Normalized weather identity conflicted."
        : "Normalized weather data was rejected."
    };
  }
  if (dependencyCode === "42501" || dependencyCode === "3F000" || dependencyCode === "42883") {
    return {
      code: "weather_runtime_configuration_invalid",
      retryable: false,
      message: "Weather runtime database configuration was rejected."
    };
  }
  return {
    code: "weather_runtime_unavailable",
    retryable: true,
    message: "Weather runtime dependency is unavailable."
  };
}

function validateClaim(run: ClaimedWeatherRun): void {
  if (
    run.providerKey !== WEATHERAPI_PROVIDER_ID ||
    run.providerBaseUrl !== WEATHERAPI_ALLOWED_ORIGIN ||
    run.credentialReference !== WEATHERAPI_CREDENTIAL_REFERENCE ||
    run.parserVersion !== WEATHERAPI_PARSER_VERSION
  ) {
    throw new WeatherRuntimeRunError(
      "weather_provider_configuration_invalid",
      false,
      "Weather provider configuration was rejected."
    );
  }
}

function writtenRecordCount(result: WeatherPersistenceResult): number {
  return result.observationsInserted + result.observationsExisting +
    result.forecastsInserted + result.forecastsExisting;
}

export function calculateWeatherRetryDelayMilliseconds(
  attemptCount: number,
  baseDelayMilliseconds: number,
  maximumDelayMilliseconds: number,
  jitterRatio: number,
  randomSample: number
): number {
  if (
    !Number.isSafeInteger(attemptCount) || attemptCount < 1 ||
    !Number.isSafeInteger(baseDelayMilliseconds) || baseDelayMilliseconds < 1 ||
    !Number.isSafeInteger(maximumDelayMilliseconds) || maximumDelayMilliseconds < baseDelayMilliseconds ||
    !Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 0.5 ||
    !Number.isFinite(randomSample) || randomSample < 0 || randomSample > 1
  ) {
    throw new RangeError("Weather retry policy is invalid.");
  }

  const exponentialDelay = baseDelayMilliseconds * (2 ** Math.min(attemptCount - 1, 30));
  const boundedDelay = Math.min(maximumDelayMilliseconds, exponentialDelay);
  const jitterMultiplier = 1 - jitterRatio + (2 * jitterRatio * randomSample);
  return Math.max(1, Math.min(maximumDelayMilliseconds, Math.round(boundedDelay * jitterMultiplier)));
}

export class WeatherDurableRuntime {
  readonly #config: WeatherRuntimeConfig;
  readonly #secrets: WeatherRuntimeSecrets;
  readonly #store: WeatherRuntimeStore;
  readonly #wakeChannel: WeatherRuntimeWakeChannel | undefined;
  readonly #adapterFactory: WeatherAdapterFactory;
  readonly #logger: WeatherRuntimeLogger;
  readonly #now: () => Date;
  readonly #random: () => number;
  #state: WeatherRuntimeLifecycleState = "stopped";
  #acceptingWork = false;
  #activeRun = false;
  #consecutivePollFailures = 0;
  #lastSuccessfulPollAt: Date | null = null;
  #stopController: AbortController | null = null;
  #loopPromise: Promise<void> | null = null;
  #providerFailureCount = 0;
  #providerCircuitOpenUntil = 0;

  constructor(options: WeatherDurableRuntimeOptions) {
    this.#config = options.config;
    this.#secrets = options.secrets;
    this.#store = options.store;
    this.#wakeChannel = options.wakeChannel;
    this.#adapterFactory = options.adapterFactory ?? defaultAdapterFactory;
    this.#logger = options.logger ?? NOOP_LOGGER;
    this.#now = options.now ?? (() => new Date());
    this.#random = options.random ?? Math.random;
  }

  getReadiness(): WeatherRuntimeReadiness {
    return {
      state: this.#state,
      ready: this.#state === "ready",
      acceptingWork: this.#acceptingWork,
      activeRun: this.#activeRun,
      consecutivePollFailures: this.#consecutivePollFailures,
      lastSuccessfulPollAt: this.#lastSuccessfulPollAt === null
        ? null
        : new Date(this.#lastSuccessfulPollAt.getTime())
    };
  }

  start(): void {
    if (this.#state !== "stopped") {
      throw new Error("Weather runtime is already started.");
    }
    this.#state = "starting";
    this.#acceptingWork = true;
    this.#consecutivePollFailures = 0;
    this.#lastSuccessfulPollAt = null;
    this.#stopController = new AbortController();
    this.#loopPromise = this.#pollLoop(this.#stopController.signal);
  }

  async stop(): Promise<void> {
    if (this.#state === "stopped") return;
    this.#state = "stopping";
    this.#acceptingWork = false;
    this.#stopController?.abort();
    await this.#loopPromise;
    await Promise.allSettled([
      this.#wakeChannel?.close?.() ?? Promise.resolve(),
      this.#store.close?.() ?? Promise.resolve()
    ]);
    this.#activeRun = false;
    this.#state = "stopped";
    this.#stopController = null;
    this.#loopPromise = null;
    this.#logger.info({ event: "weather_runtime_stopped" });
  }

  async #pollLoop(stopSignal: AbortSignal): Promise<void> {
    while (!stopSignal.aborted) {
      let run: ClaimedWeatherRun | null = null;
      try {
        run = await this.#store.claim(
          this.#config.workerId,
          this.#config.leaseDurationMilliseconds
        );
        this.#lastSuccessfulPollAt = safeDate(this.#now);
        this.#consecutivePollFailures = 0;
        if (this.#state === "starting" || this.#state === "degraded") {
          this.#state = "ready";
          this.#logger.info({ event: "weather_runtime_ready" });
        }
      } catch {
        this.#consecutivePollFailures += 1;
        if (this.#state !== "stopping") this.#state = "degraded";
        this.#logger.error({
          event: "weather_runtime_poll_failed",
          code: "weather_store_unavailable"
        });
      }

      if (run !== null && !stopSignal.aborted) {
        this.#activeRun = true;
        try {
          await this.#processRun(run);
        } finally {
          this.#activeRun = false;
        }
        continue;
      }
      if (!stopSignal.aborted) {
        await this.#waitForPoll(stopSignal);
      }
    }
  }

  async #waitForPoll(stopSignal: AbortSignal): Promise<void> {
    if (this.#wakeChannel === undefined) {
      await delay(this.#config.pollIntervalMilliseconds, stopSignal);
      return;
    }
    const waitController = new AbortController();
    const stopWait = (): void => waitController.abort();
    stopSignal.addEventListener("abort", stopWait, { once: true });
    try {
      const pollingDelay = delay(
        this.#config.pollIntervalMilliseconds,
        waitController.signal
      );
      const wake = this.#wakeChannel.waitForWake(waitController.signal).catch(() => pollingDelay);
      await Promise.race([pollingDelay, wake]);
    } finally {
      stopSignal.removeEventListener("abort", stopWait);
      waitController.abort();
    }
  }

  async #processRun(run: ClaimedWeatherRun): Promise<void> {
    try {
      validateClaim(run);
      if (safeDate(this.#now).getTime() < this.#providerCircuitOpenUntil) {
        throw new WeatherRuntimeRunError(
          "weather_provider_circuit_open",
          true,
          "Weather provider circuit is open."
        );
      }
      const apiKey = this.#secrets.WEATHERAPI_API_KEY;
      const adapter = this.#adapterFactory({
        apiKey,
        timeoutMilliseconds: this.#config.providerTimeoutMilliseconds
      });
      if (adapter.providerId !== WEATHERAPI_PROVIDER_ID) {
        throw new WeatherRuntimeRunError(
          "weather_provider_configuration_invalid",
          false,
          "Weather provider configuration was rejected."
        );
      }

      const { bundle, persistence } = await this.#withHeartbeat(run, async (signal) => {
        const payload = await adapter.getWeather({
          target: {
            latitude: run.targetLatitude,
            longitude: run.targetLongitude
          },
          forecastDays: this.#config.forecastDays,
          signal
        });
        if (
          payload.source.provider !== WEATHERAPI_PROVIDER_ID ||
          payload.source.parserVersion !== run.parserVersion ||
          payload.target.latitude !== run.targetLatitude ||
          payload.target.longitude !== run.targetLongitude
        ) {
          throw new WeatherRuntimeMappingError();
        }
        const mapped = mapNormalizedWeatherPayload(payload, run.requestKind);
        const persisted = await this.#store.persist(run.runId, run.leaseToken, mapped);
        return { bundle: mapped, persistence: persisted };
      });

      const recordsReceived = bundle.observations.length + bundle.forecasts.length;
      const recordsWritten = writtenRecordCount(persistence);
      const partial = bundle.partial || recordsWritten !== recordsReceived;
      const status = partial ? "partial" : "succeeded";
      await this.#store.complete(
        run.runId,
        run.leaseToken,
        status,
        recordsReceived,
        recordsWritten,
        partial ? "weather_data_partial" : null,
        partial ? "Normalized weather data is partial." : null
      );
      this.#providerFailureCount = 0;
      this.#providerCircuitOpenUntil = 0;
      await this.#publishTransition(status);
      this.#logger.info({ event: "weather_run_transitioned", status });
    } catch (error) {
      const classified = classifyError(error);
      if (classified.retryable && classified.code.startsWith("weather_provider_") && classified.code !== "weather_provider_circuit_open") {
        this.#providerFailureCount += 1;
        if (this.#providerFailureCount >= this.#config.circuitFailureThreshold) {
          this.#providerCircuitOpenUntil = safeDate(this.#now).getTime() + this.#config.circuitResetMilliseconds;
        }
      }
      await this.#transitionFailure(run, classified);
    }
  }

  async #withHeartbeat<T>(
    run: ClaimedWeatherRun,
    action: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const heartbeatController = new AbortController();
    const actionController = new AbortController();
    const actionPromise = action(actionController.signal);
    const heartbeatPromise = this.#heartbeatLoop(run, heartbeatController.signal).catch(() => {
      actionController.abort();
      throw new WeatherRuntimeRunError(
        "weather_run_lease_lost",
        true,
        "Weather run lease was lost."
      );
    });

    try {
      return await Promise.race([
        actionPromise,
        heartbeatPromise.then(() => actionPromise)
      ]);
    } finally {
      heartbeatController.abort();
      await heartbeatPromise.catch(() => {});
      void actionPromise.catch(() => {});
    }
  }

  async #heartbeatLoop(run: ClaimedWeatherRun, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      await delay(this.#config.heartbeatIntervalMilliseconds, signal);
      if (signal.aborted) return;
      await this.#store.heartbeat(
        run.runId,
        run.leaseToken,
        this.#config.workerId,
        this.#config.leaseDurationMilliseconds
      );
    }
  }

  async #transitionFailure(
    run: ClaimedWeatherRun,
    error: ClassifiedRuntimeError
  ): Promise<void> {
    try {
      let status: WeatherRunTerminalStatus;
      if (error.retryable) {
        const retryDelay = calculateWeatherRetryDelayMilliseconds(
          run.attemptCount,
          this.#config.retryBaseDelayMilliseconds,
          this.#config.retryMaximumDelayMilliseconds,
          this.#config.retryJitterRatio,
          this.#random()
        );
        const retryAt = new Date(safeDate(this.#now).getTime() + retryDelay);
        const result = await this.#store.retry(
          run.runId,
          run.leaseToken,
          retryAt,
          error.code,
          error.message
        );
        status = result.runStatus;
      } else {
        status = await this.#store.fail(
          run.runId,
          run.leaseToken,
          error.code,
          error.message
        );
      }
      await this.#publishTransition(status);
      this.#logger.info({ event: "weather_run_transitioned", status, code: error.code });
    } catch {
      this.#logger.error({
        event: "weather_run_transition_failed",
        code: "weather_store_unavailable"
      });
    }
  }

  async #publishTransition(status: WeatherRunTerminalStatus): Promise<void> {
    try {
      await this.#wakeChannel?.publish?.({ type: "weather_run_state_changed", status });
    } catch {
      // Redis/coordination is optional; PostgreSQL polling remains authoritative.
    }
  }
}
