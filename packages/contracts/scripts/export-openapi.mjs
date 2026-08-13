import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { weatherOpenApiV1 } from "../dist/openapi-v1.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(packageRoot, "openapi/v1.json");
const expected = `${JSON.stringify(weatherOpenApiV1, null, 2)}\n`;
const mode = process.argv[2];

if (mode === "--write") {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected, "utf8");
  process.stdout.write("WEATHER_OPENAPI_WRITE_OK version=v1\n");
} else if (mode === "--check") {
  const actual = await readFile(outputPath, "utf8").catch(() => "");
  if (actual !== expected) {
    throw new Error("Weather OpenAPI artifact drifted; run pnpm --filter @vietnam-weather/contracts openapi:write");
  }
  process.stdout.write("WEATHER_OPENAPI_DRIFT_OK version=v1\n");
} else {
  throw new Error("Expected --write or --check");
}
