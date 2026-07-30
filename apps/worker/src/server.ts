import { createServer, type Server } from "node:http";

import type { HealthResponse } from "@vietnam-weather/contracts";

export interface WorkerServerOptions {
  readonly serviceName: string;
  readonly port: number;
}

function createHealthResponse(
  serviceName: string,
  status: HealthResponse["status"]
): HealthResponse {
  return {
    service: serviceName,
    status,
    timestamp: new Date().toISOString()
  };
}

export function createWorkerServer(options: WorkerServerOptions): Server {
  let ready = false;
  const server = createServer((request, response) => {
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }

    if (request.url === "/health/live") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(createHealthResponse(options.serviceName, "live")));
      return;
    }

    if (request.url === "/health/ready") {
      response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify(createHealthResponse(options.serviceName, "ready")));
      return;
    }

    response.writeHead(404).end();
  });

  server.on("listening", () => {
    ready = true;
  });
  server.on("close", () => {
    ready = false;
  });
  return server;
}
