import { requireEnvironmentPort, requireEnvironmentValue } from "@vietnam-weather/config";

import { createWorkerServer } from "./server.js";

const serviceName = requireEnvironmentValue(process.env, "WORKER_SERVICE_NAME");
const port = requireEnvironmentPort(process.env, "WORKER_PORT");
const server = createWorkerServer({ serviceName, port });

function shutdown(signal: NodeJS.Signals): void {
  process.stdout.write(`${JSON.stringify({ event: "shutdown", signal, service: serviceName })}\n`);
  server.close((error) => {
    if (error) {
      process.stderr.write(`${JSON.stringify({ event: "shutdown_error", service: serviceName })}\n`);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`${JSON.stringify({ event: "ready", port, service: serviceName })}\n`);
});
