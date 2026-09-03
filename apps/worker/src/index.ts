import pg from "pg";
import {
  requireEnvironmentPort,
  requireEnvironmentValue,
} from "@vietnam-weather/config";

import { createWorkerServer } from "./server.js";
import { parseWeatherRuntimeConfig, parseWeatherRuntimeSecrets } from "./runtime/config.js";
import { PostgresWeatherRuntimeStore } from "./runtime/postgres-store.js";
import { WeatherDurableRuntime } from "./runtime/runtime.js";

async function main(): Promise<void> {
  const serviceName = requireEnvironmentValue(process.env, "WORKER_SERVICE_NAME");
  const port = requireEnvironmentPort(process.env, "WORKER_PORT");

  // Database config
  const dbHost = requireEnvironmentValue(process.env, "DB_HOST");
  const dbPort = requireEnvironmentPort(process.env, "DB_PORT");
  const dbDatabase = requireEnvironmentValue(process.env, "DB_DATABASE");
  const dbUser = requireEnvironmentValue(process.env, "WEATHER_WORKER_DB_USER");
  const dbPassword = requireEnvironmentValue(process.env, "WEATHER_WORKER_DB_PASSWORD");

  // Parse runtime config
  const config = parseWeatherRuntimeConfig(process.env);
  const secrets = parseWeatherRuntimeSecrets(process.env);

  // Create PostgreSQL pool
  const pool = new pg.Pool({
    host: dbHost,
    port: dbPort,
    database: dbDatabase,
    user: dbUser,
    password: dbPassword,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Create store
  const store = new PostgresWeatherRuntimeStore(pool);

  // Create logger
  const logger = {
    info: (entry: { event: string; status?: string; workerId?: string }) => console.log(JSON.stringify(entry)),
    error: (entry: { event: string; code?: string }) => console.error(JSON.stringify(entry)),
  };

  // Create runtime
  const runtime = new WeatherDurableRuntime({
    config,
    secrets,
    store,
    logger,
    now: () => new Date(),
    random: Math.random,
  });

  // Create server
  const server = createWorkerServer({ serviceName, port });

  // Start runtime
  await runtime.start();
  logger.info({ event: "weather_runtime_started", workerId: config.workerId });

  // Start server
  server.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ event: "ready", port, service: serviceName }));
  });

  function shutdown(signal: NodeJS.Signals): void {
    console.log(JSON.stringify({ event: "shutdown", signal, service: serviceName }));
    runtime.stop().then(async () => {
      await pool.end();
      server.close((error) => {
        if (error) {
          console.error(JSON.stringify({ event: "shutdown_error", service: serviceName }));
          process.exitCode = 1;
        }
      });
    });
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "fatal_error", error: String(error) }));
  process.exit(1);
});
