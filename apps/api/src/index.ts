import { requireEnvironmentValue } from "@vietnam-weather/config";

import { loadApiConfig } from "./config.js";
import { createApiServer } from "./server.js";

const config = loadApiConfig(process.env);
const server = await createApiServer({ config });

function shutdown(signal: NodeJS.Signals): void {
  process.stdout.write(`${JSON.stringify({ event: "shutdown", signal, service: config.serviceName })}\n`);
  server.close().then(
    () => { process.exitCode = 0; },
    () => { process.exitCode = 1; }
  );
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await server.listen({
  port: config.port,
  host: "0.0.0.0"
});
process.stdout.write(`${JSON.stringify({ event: "ready", port: config.port, service: requireEnvironmentValue(process.env, "API_SERVICE_NAME") })}\n`);
